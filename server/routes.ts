import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import multer from "multer";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { runDetectors, aggregateCategoryScore } from "./detectors";
import { yandexAnalyze, yandexComplete } from "./yandex";
import { runWolfAudit } from "./wolfDetector";
import { runFitGuard } from "./fitGuard";
import { runGitHubDeepScan } from "./githubDeepScan";
import { stripPhantomText } from "./pipelineAnalyzer";
import type {
  TeamFitReport,
  OceanScores,
  MbtiCluster,
  FitAxis,
  InterviewHypothesis,
  GitHubDeepScanReport,
  GhTechProfile,
  GhBehaviorProfile,
  GhRiskFlag,
  GhOceanHints,
  GhEvidenceLink,
} from "@shared/schema";
import type {
  Finding,
  FullReport,
  SubcategoryScore,
  FindingCategory,
  RecruiterAction,
  RecruiterForm,
  EtkStructured,
  SingleStepReport,
  SearchReason,
  AttitudeToFormer,
  TimePressure,
  References,
} from "@shared/schema";
import { runPipelineAnalysis } from "./pipelineAnalyzer";

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

function safeJsonParse(s: string | null | undefined): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

async function extractPdfText(buf: Buffer): Promise<string> {
  // pdfjs-dist legacy-сборка работает в Node без canvas/native-зависимостей.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    let full = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items: any[] = content.items || [];
      // Склеиваем строки с учётом маркеров EOL от pdfjs
      const pageText = items
        .map((it) => {
          if (!it) return "";
          if (typeof it.str === "string") {
            return it.str + (it.hasEOL ? "\n" : "");
          }
          return "";
        })
        .join("");
      full += pageText + "\n";
      try { page.cleanup?.(); } catch {}
    }
    return full.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } finally {
    try { await doc.destroy?.(); } catch {}
  }
}

async function parseUploadedFile(mime: string, buf: Buffer, name: string): Promise<string> {
  const lowerName = name.toLowerCase();
  if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return await extractPdfText(buf);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }
  return buf.toString("utf-8");
}

function mergeFindings(auto: Finding[], llm: Finding[]): Finding[] {
  const out: Finding[] = [...auto];
  for (const f of llm) {
    const dup = out.find(
      (x) => x.id === f.id || x.title.toLowerCase().trim() === f.title.toLowerCase().trim(),
    );
    if (!dup) out.push(f);
  }
  return out;
}

// Тонкая калибровка вердикта — учитываем confidence и плотность доказательств
function verdictFromScore(score: number, confidence: number): "green" | "yellow" | "red" {
  // При низкой уверенности (<55) не эскалируем в red раньше, чем score перейдёт 70
  if (confidence < 55) {
    if (score >= 70) return "red";
    if (score >= 35) return "yellow";
    return "green";
  }
  if (score >= 61) return "red";
  if (score >= 31) return "yellow";
  return "green";
}

function extractCandidateName(text: string): string | null {
  const lines = text.split(/\r?\n/).slice(0, 10);
  for (const line of lines) {
    const m = line.match(/^\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)\s*$/);
    if (m) return m[1];
  }
  return null;
}

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  chronology: "Хронология и структура",
  qualification: "Квалификация и соответствие",
  achievement: "Достижения и метрики",
  identity: "Косвенные контакты",
  behavior: "Поведенческие паттерны",
  linguistic: "Лингвистика и стиль",
  reputation: "Репутация и работодатели",
  other: "Прочее",
};

function buildSubcategoryBreakdown(allFindings: Finding[]): SubcategoryScore[] {
  const groups: Record<string, Finding[]> = {};
  for (const f of allFindings) {
    const key = f.category || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  const result: SubcategoryScore[] = [];
  for (const key of Object.keys(groups) as FindingCategory[]) {
    const items = groups[key];
    if (!items.length) continue;
    // Взвешенный скор: медиана + бонус за плотность
    const sorted = [...items].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const avg =
      items.reduce((s, f) => s + f.score * (f.confidence / 100), 0) /
      items.length;
    const densityBonus = Math.min(20, items.length * 4);
    const score = Math.max(0, Math.min(100, Math.round(avg + densityBonus * 0.5)));
    result.push({
      key,
      label: CATEGORY_LABELS[key] || "Прочее",
      score,
      findingsCount: items.length,
      topIssue: top?.title,
    });
  }
  return result.sort((a, b) => b.score - a.score);
}

// Если LLM не прислала recruiterActionPlan — строим типовой шаблон
function buildDefaultActionPlan(
  findings: Finding[],
  verdict: "green" | "yellow" | "red",
): RecruiterAction[] {
  const criticals = findings.filter((f) => f.severity === "critical" || f.severity === "high");
  const chronoIssues = findings.filter((f) => f.category === "chronology");
  const qualIssues = findings.filter((f) => f.category === "qualification");
  const achievIssues = findings.filter((f) => f.category === "achievement");
  const idIssues = findings.filter((f) => f.category === "identity");
  const behavIssues = findings.filter((f) => f.category === "behavior");

  const plan: RecruiterAction[] = [];

  plan.push({
    step: 1,
    title: "Скрининг-звонок 15 мин: верификация хронологии и мотивации",
    description:
      "Попросить последовательно рассказать о каждом месте работы за последние 5 лет: даты, грейд, команда, реальные задачи, причины ухода. Отметить паузы, совмещения, несостыковки с резюме.",
    priority: verdict === "green" ? "should" : "must",
    estimatedTime: "15 минут",
    targets: chronoIssues.map((f) => f.id).slice(0, 5),
  });

  if (qualIssues.length || criticals.some((f) => f.category === "qualification")) {
    plan.push({
      step: plan.length + 1,
      title: "Техническое интервью: реальная глубина стека",
      description:
        "Задать 3–5 детальных вопросов по заявленным технологиям и архитектурным решениям. Попросить разобрать одну из заявленных задач «как именно делали, какие trade-offs, что не сработало». Поверхностные ответы — сигнал инфляции.",
      priority: "must",
      estimatedTime: "45–60 минут",
      targets: qualIssues.map((f) => f.id).slice(0, 5),
    });
  }

  if (achievIssues.length) {
    plan.push({
      step: plan.length + 1,
      title: "Проверка достижений: цифры и роль",
      description:
        "По каждому громкому достижению спросить: базовый показатель до, итоговый после, период, размер команды, личный вклад (I/we). Отсутствие цифр и размытое «мы» — red flag.",
      priority: "should",
      estimatedTime: "20 минут",
      targets: achievIssues.map((f) => f.id).slice(0, 5),
    });
  }

  plan.push({
    step: plan.length + 1,
    title: "Reference check: 2 независимых источника",
    description:
      "Запросить контакты бывшего руководителя и коллеги/подчинённого с двух последних мест работы. Проверить: тайтл, даты, реальные задачи, причины ухода, качество работы. ВАЖНО: не ограничиваться контактами, которые дал сам кандидат — искать знакомых через OSINT.",
    priority: verdict === "red" ? "must" : "should",
    estimatedTime: "1–2 часа",
    targets: [...chronoIssues, ...qualIssues].map((f) => f.id).slice(0, 5),
  });

  if (idIssues.length || verdict !== "green") {
    plan.push({
      step: plan.length + 1,
      title: "OSINT-проверка косвенных контактов",
      description:
        "Прогнать домен email и префикс телефона (регион), сверить с заявленным городом. Найти профили в LinkedIn/HH/GitHub — сопоставить тайтлы, даты, стек. Искать репутационные упоминания (форумы, открытые источники).",
      priority: idIssues.length ? "must" : "should",
      estimatedTime: "30–45 минут",
      targets: idIssues.map((f) => f.id).slice(0, 5),
    });
  }

  if (behavIssues.length) {
    plan.push({
      step: plan.length + 1,
      title: "Поведенческое интервью: причины частых смен",
      description:
        "Разобрать каждый короткий контракт (<12 мес): почему ушёл, с чем столкнулся, что бы сделал иначе. Искать паттерн: всегда ли виноваты другие; упоминание чатов/сообществ смены работы.",
      priority: "should",
      estimatedTime: "20 минут",
      targets: behavIssues.map((f) => f.id).slice(0, 5),
    });
  }

  if (verdict === "red") {
    plan.push({
      step: plan.length + 1,
      title: "Документальная верификация: трудовая книжка / СЗВ-ТД",
      description:
        "При положительном офере потребовать документы, подтверждающие все заявленные места работы и даты. Сверить с тем, что было озвучено в скрининге. Расхождения — основание для отказа.",
      priority: "must",
      estimatedTime: "30 минут",
      targets: chronoIssues.map((f) => f.id).slice(0, 5),
    });
  }

  return plan;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", async (_req, res) => {
    res.json({
      ok: true,
      yandexConfigured: Boolean(process.env.YANDEX_API_KEY),
      time: Date.now(),
    });
  });

  // Извлечение текста из PDF/DOCX
  app.post(
    "/api/extract",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ message: "Файл не прислан" });
        const text = await parseUploadedFile(file.mimetype, file.buffer, file.originalname);
        if (!text || text.trim().length < 30) {
          return res.status(400).json({ message: "Не удалось извлечь текст из файла." });
        }
        res.json({ text, fileName: file.originalname });
      } catch (e: any) {
        res.status(500).json({ message: `Ошибка парсинга: ${e.message}` });
      }
    },
  );

  // Список проверок
  app.get("/api/checks", async (_req, res) => {
    try {
      const items = await storage.listChecks(100);
      const ids = items.map((c) => c.id);
      const pipelines = await storage.listPipelinesByParentIds(ids);
      const pipelineCountByParent = new Map<string, number>();
      for (const p of pipelines) {
        if (!p.parentId) continue;
        pipelineCountByParent.set(p.parentId, (pipelineCountByParent.get(p.parentId) || 0) + 1);
      }
      res.json(
        items.map((c) => ({
          id: c.id,
          createdAt: c.createdAt,
          candidateName: c.candidateName,
          riskScore: c.riskScore,
          inflationScore: c.inflationScore,
          wolvesScore: c.wolvesScore,
          totalScore: c.totalScore,
          verdict: c.verdict,
          hasPipeline: (pipelineCountByParent.get(c.id) || 0) > 0,
          pipelineCount: pipelineCountByParent.get(c.id) || 0,
        })),
      );
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/checks/:id", async (req, res) => {
    try {
      const c = await storage.getCheck(req.params.id);
      if (!c) return res.status(404).json({ message: "Не найдено" });
      const pipelines = await storage.listPipelinesByParent(c.id);
      res.json({
        id: c.id,
        createdAt: c.createdAt,
        candidateName: c.candidateName,
        resumeText: c.resumeText,
        report: JSON.parse(c.reportJson) as FullReport,
        pipelines: pipelines.map((p) => ({
          id: p.id,
          createdAt: p.createdAt,
          version: p.version,
          compositeScore: p.compositeScore,
          resolutionCode: p.resolutionCode,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/checks/:id", async (req, res) => {
    try {
      await storage.deleteCheck(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Основной анализ
  app.post("/api/analyze", async (req, res) => {
    try {
      const { text } = req.body || {};
      if (typeof text !== "string" || text.trim().length < 100) {
        return res.status(400).json({
          message: "Текст резюме слишком короткий (мин. 100 символов).",
        });
      }

      const det = runDetectors(text);

      // Параллельно: базовый анализ + усиленный Wolf Detector v1.0
      const [llm, wolfAuditResult] = await Promise.all([
        yandexAnalyze(text, [...det.risks, ...det.inflation, ...det.wolves]),
        runWolfAudit(text, {}).catch((err) => {
          console.error("Wolf Detector error:", err);
          return null;
        }),
      ]);

      const risksAll = mergeFindings(det.risks, llm.risks.findings);
      const inflationAll = mergeFindings(det.inflation, llm.inflation.findings);
      const wolvesAll = mergeFindings(det.wolves, llm.wolves.findings);

      const riskScore = Math.max(aggregateCategoryScore(risksAll, 10), llm.risks.score);
      const inflationScore = Math.max(
        aggregateCategoryScore(inflationAll, 10),
        llm.inflation.score,
      );
      const wolvesScore = Math.max(aggregateCategoryScore(wolvesAll, 5), llm.wolves.score);

      const totalScore = Math.round(
        riskScore * 0.4 + inflationScore * 0.4 + wolvesScore * 0.2,
      );

      // Средняя уверенность модели (для калибровки вердикта)
      const avgConfidence = Math.round(
        (llm.confidence +
          (llm.risks.confidence || 60) +
          (llm.inflation.confidence || 60) +
          (llm.wolves.confidence || 60)) /
          4,
      );

      const verdict = verdictFromScore(totalScore, avgConfidence);

      const candidateName = llm.candidateName || extractCandidateName(text);

      // Сводная разбивка по 5 субкатегориям
      const allFindings = [...risksAll, ...inflationAll, ...wolvesAll];
      const subcategoryBreakdown = buildSubcategoryBreakdown(allFindings);

      // Action plan: берём от LLM, если пустой — генерируем шаблонный
      const recruiterActionPlan =
        llm.recruiterActionPlan && llm.recruiterActionPlan.length > 0
          ? llm.recruiterActionPlan
          : buildDefaultActionPlan(allFindings, verdict);

      const id = nanoid(10);
      const report: FullReport = {
        candidateName,
        riskScore,
        inflationScore,
        wolvesScore,
        totalScore,
        verdict,
        confidence: avgConfidence,
        executiveSummary: llm.executiveSummary,
        risks: {
          score: riskScore,
          summary: llm.risks.summary,
          confidence: llm.risks.confidence,
          findings: risksAll.sort((a, b) => b.score - a.score),
        },
        inflation: {
          score: inflationScore,
          summary: llm.inflation.summary,
          confidence: llm.inflation.confidence,
          findings: inflationAll.sort((a, b) => b.score - a.score),
        },
        wolves: {
          score: wolvesScore,
          summary: llm.wolves.summary,
          confidence: llm.wolves.confidence,
          findings: wolvesAll.sort((a, b) => b.score - a.score),
        },
        subcategoryBreakdown,
        redFlags: llm.redFlags,
        positiveSignals: llm.positiveSignals,
        interviewQuestions: llm.interviewQuestions,
        sbRecommendations: llm.sbRecommendations,
        recruiterActionPlan,
        wolfAudit: wolfAuditResult || undefined,
        createdAt: Date.now(),
      };

      await storage.saveCheck({
        id,
        createdAt: report.createdAt,
        candidateName,
        resumeText: text,
        riskScore,
        inflationScore,
        wolvesScore,
        totalScore,
        verdict,
        reportJson: JSON.stringify(report),
      });

      res.json({ id, report });
    } catch (e: any) {
      console.error("Analyze error:", e);
      res.status(500).json({ message: e.message || "Внутренняя ошибка анализа" });
    }
  });

  // ==========================================================
  // SINGLE-STEP PIPELINE v3.0
  // ==========================================================

  const SEARCH_REASONS: SearchReason[] = [
    "growth", "low_salary", "layoff", "conflict",
    "burnout", "no_growth", "other",
  ];
  const ATTITUDES: AttitudeToFormer[] = ["positive", "neutral", "critical", "hostile"];
  const PRESSURES: TimePressure[] = ["has_offer", "personal_deadline", "no_pressure", "not_specified"];
  const REFS: References[] = ["has_ready", "has_not_ready", "none", "not_discussed"];

  function normalizeForm(raw: any): RecruiterForm | null {
    if (!raw || typeof raw !== "object") return null;
    const searchReason = SEARCH_REASONS.includes(raw.searchReason) ? raw.searchReason : "other";
    const attitudeToFormer = ATTITUDES.includes(raw.attitudeToFormer) ? raw.attitudeToFormer : "neutral";
    const timePressure = PRESSURES.includes(raw.timePressure) ? raw.timePressure : "not_specified";
    const references = REFS.includes(raw.references) ? raw.references : "not_discussed";
    const note = String(raw.note ?? "").slice(0, 300);
    return { searchReason, attitudeToFormer, timePressure, references, note };
  }

  function normalizeEtk(raw: any): EtkStructured {
    if (!raw || typeof raw !== "object") {
      return { records: [], source: "none" };
    }
    const records = Array.isArray(raw.records)
      ? raw.records.slice(0, 30).map((r: any) => ({
          company: String(r?.company || "").slice(0, 200),
          position: r?.position ? String(r.position).slice(0, 200) : undefined,
          startDate: r?.startDate ? String(r.startDate).slice(0, 20) : undefined,
          endDate: r?.endDate === null ? null : r?.endDate ? String(r.endDate).slice(0, 20) : undefined,
          reason: r?.reason ? String(r.reason).slice(0, 400) : undefined,
          inn: r?.inn ? String(r.inn).slice(0, 20) : undefined,
        })).filter((r: any) => r.company.length > 0)
      : [];
    const src: "xml" | "text" | "none" =
      raw.source === "xml" || raw.source === "text"
        ? raw.source
        : records.length > 0 ? "text" : "none";
    return {
      records,
      source: src,
      note: raw.note ? String(raw.note).slice(0, 400) : undefined,
    };
  }

  async function doPipelineAnalyze(params: {
    resumeText: string;
    etk: EtkStructured;
    etkRawText: string;
    interviewText: string;
    referencesText: string;
    form: RecruiterForm;
    parentId?: string;
    version: number;
  }) {
    const report = await runPipelineAnalysis({
      resumeText: params.resumeText,
      etk: params.etk,
      etkRawText: params.etkRawText,
      interviewText: params.interviewText,
      referencesText: params.referencesText,
      form: params.form,
    });
    // v3.6.1: сохраняем структуру + сырой текст в одном JSON для recompute
    const hasStructured = params.etk.records.length > 0;
    const hasRaw = params.etkRawText && params.etkRawText.trim().length > 0;
    const etkPayload =
      hasStructured || hasRaw
        ? JSON.stringify({
            _kind: "pipeline-etk-v2",
            structured: params.etk,
            rawText: params.etkRawText || "",
          })
        : null;
    const id = nanoid(10);
    await storage.savePipelineCheck({
      id,
      createdAt: report.createdAt,
      parentId: params.parentId ?? null,
      version: params.version,
      candidateName: report.candidateName,
      resumeText: params.resumeText,
      etkText: etkPayload,
      interviewText: params.interviewText || null,
      referencesText: params.referencesText || null,
      recruiterForm: JSON.stringify(params.form),
      compositeScore: report.compositeScore,
      resolutionCode: report.resolution.code,
      reportJson: JSON.stringify(report),
    });
    return { id, report };
  }

  // Распаковка сохранённого etkText: поддерживает старый формат (EtkStructured) и новый v2 ({structured, rawText}).
  function unpackEtkText(raw: string | null | undefined): { etk: EtkStructured; rawText: string } {
    if (!raw) return { etk: { records: [], source: "none" }, rawText: "" };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed._kind === "pipeline-etk-v2") {
        return {
          etk: normalizeEtk(parsed.structured),
          rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
        };
      }
      return { etk: normalizeEtk(parsed), rawText: "" };
    } catch {
      return { etk: { records: [], source: "none" }, rawText: "" };
    }
  }

  app.post("/api/pipeline/analyze", async (req, res) => {
    try {
      const {
        resumeText,
        etk,
        etkText,
        interviewText,
        referencesText,
        form,
        parentCheckId,
      } = req.body || {};

      if (typeof resumeText !== "string" || resumeText.trim().length < 100) {
        return res.status(400).json({
          message: "Резюме слишком короткое (мин. 100 символов).",
        });
      }
      const nForm = normalizeForm(form);
      if (!nForm) {
        return res.status(400).json({ message: "Не заполнена форма рекрутера." });
      }
      const nEtk = normalizeEtk(etk);
      const nEtkRaw = typeof etkText === "string" ? etkText.slice(0, 200000) : "";
      // parentCheckId — связь с исходной обычной проверкой (checks.id)
      // С v3.3 пайплайн создаётся ТОЛЬКО на базе существующей базовой проверки.
      if (typeof parentCheckId !== "string" || !parentCheckId.trim()) {
        return res.status(400).json({
          message: "Пайплайн можно создать только на базе существующей базовой проверки (parentCheckId обязателен).",
        });
      }
      const parent = await storage.getCheck(parentCheckId.trim());
      if (!parent) {
        return res.status(400).json({
          message: "Базовая проверка не найдена. Сначала выполните обычную проверку резюме.",
        });
      }
      const parentId: string = parent.id;
      const result = await doPipelineAnalyze({
        resumeText,
        etk: nEtk,
        etkRawText: nEtkRaw,
        interviewText: String(interviewText || ""),
        referencesText: String(referencesText || ""),
        form: nForm,
        parentId,
        version: 1,
      });
      res.json(result);
    } catch (e: any) {
      console.error("Pipeline analyze error:", e);
      res.status(500).json({ message: e.message || "Внутренняя ошибка пайплайна" });
    }
  });

  app.get("/api/pipeline/:id", async (req, res) => {
    try {
      const c = await storage.getPipelineCheck(req.params.id);
      if (!c) return res.status(404).json({ message: "Не найдено" });
      res.json({
        id: c.id,
        createdAt: c.createdAt,
        version: c.version,
        parentId: c.parentId,
        candidateName: c.candidateName,
        report: JSON.parse(c.reportJson) as SingleStepReport,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/pipeline/:id/recompute", async (req, res) => {
    try {
      const prev = await storage.getPipelineCheck(req.params.id);
      if (!prev) return res.status(404).json({ message: "Не найдено" });

      // Опциональный патч: клиент может передать обновлённую форму/тексты
      const patch = req.body || {};
      const form = normalizeForm(patch.form) || (JSON.parse(prev.recruiterForm) as RecruiterForm);
      // Сырой текст ЭТК и структуру восстанавливаем из сохранённого payload; патч может переопределить.
      const stored = unpackEtkText(prev.etkText);
      const etk = normalizeEtk(patch.etk ?? stored.etk);
      const etkRawText =
        typeof patch.etkText === "string" ? patch.etkText.slice(0, 200000) : stored.rawText;
      const resumeText = typeof patch.resumeText === "string" && patch.resumeText.trim().length >= 100
        ? patch.resumeText
        : prev.resumeText;
      const interviewText = typeof patch.interviewText === "string"
        ? patch.interviewText
        : (prev.interviewText || "");
      const referencesText = typeof patch.referencesText === "string"
        ? patch.referencesText
        : (prev.referencesText || "");

      const result = await doPipelineAnalyze({
        resumeText,
        etk,
        etkRawText,
        interviewText,
        referencesText,
        form,
        parentId: prev.parentId || prev.id,
        version: prev.version + 1,
      });
      res.json(result);
    } catch (e: any) {
      console.error("Pipeline recompute error:", e);
      res.status(500).json({ message: e.message || "Ошибка пересчёта" });
    }
  });

  // ==========================================================
  // CHAT v3.3 — ИИ-ассистент в контексте базовой проверки + пайплайна
  // ==========================================================

  // GET история чата по id базовой проверки
  app.get("/api/checks/:id/chat", async (req, res) => {
    try {
      const c = await storage.getCheck(req.params.id);
      if (!c) return res.status(404).json({ message: "Базовая проверка не найдена" });
      const messages = await storage.listChatMessages(c.id);
      res.json({
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST новое сообщение — вызывает LLM в контексте базовой проверки + последнего пайплайна
  app.post("/api/checks/:id/chat/message", async (req, res) => {
    try {
      const baseCheck = await storage.getCheck(req.params.id);
      if (!baseCheck) return res.status(404).json({ message: "Базовая проверка не найдена" });

      const userText = String(req.body?.message || "").trim();
      if (!userText || userText.length > 4000) {
        return res.status(400).json({
          message: "Сообщение должно содержать от 1 до 4000 символов.",
        });
      }

      // Собираем контекст: все вкладки карточки кандидата (базовая проверка, пайплайн, Team Fit, GitHub DeepScan)
      const baseReport = JSON.parse(baseCheck.reportJson) as FullReport;
      const pipelines = await storage.listPipelinesByParent(baseCheck.id);
      const lastPipeline = pipelines[0]; // сортировка desc(created_at) уже на стороне ХРАНИЛИЩА
      const pipelineReport = lastPipeline
        ? (JSON.parse(lastPipeline.reportJson) as SingleStepReport)
        : null;
      const teamFitRow = await storage.getTeamFitReportByCheckId(baseCheck.id);
      const githubDeepRow = await storage.getGithubDeepScanReportByCheckId(baseCheck.id);

      // Компактный JSON срез отчётов (чтобы не перегружать контекст)
      const baseSlim = {
        candidateName: baseReport.candidateName,
        verdict: baseReport.verdict,
        totalScore: baseReport.totalScore,
        executiveSummary: baseReport.executiveSummary,
        risks: { score: baseReport.risks.score, summary: baseReport.risks.summary, findings: baseReport.risks.findings.slice(0, 10).map((f) => ({ title: f.title, severity: f.severity, description: f.description })) },
        inflation: { score: baseReport.inflation.score, summary: baseReport.inflation.summary, findings: baseReport.inflation.findings.slice(0, 10).map((f) => ({ title: f.title, severity: f.severity, description: f.description })) },
        wolves: { score: baseReport.wolves.score, summary: baseReport.wolves.summary, findings: baseReport.wolves.findings.slice(0, 10).map((f) => ({ title: f.title, severity: f.severity, description: f.description })) },
        redFlags: baseReport.redFlags?.slice(0, 8),
        positiveSignals: baseReport.positiveSignals?.slice(0, 8),
      };
      const pipelineSlim = pipelineReport
        ? {
            version: pipelineReport.version,
            candidateName: pipelineReport.candidateName,
            compositeScore: pipelineReport.compositeScore,
            resolution: pipelineReport.resolution,
            verification: pipelineReport.verification,
            motivation: pipelineReport.motivation,
            culturalFit: pipelineReport.culturalFit,
            loyalty: pipelineReport.loyalty,
            linguisticAudit: pipelineReport.linguisticAudit,
          }
        : null;
      const teamFitSlim = teamFitRow
        ? {
            ocean: safeJsonParse(teamFitRow.ocean),
            mbtiCluster: teamFitRow.mbtiCluster,
            mbtiReasoning: teamFitRow.mbtiReasoning,
            valueFit: safeJsonParse(teamFitRow.valueFit),
            vendorFit: safeJsonParse(teamFitRow.vendorFit),
            productFit: safeJsonParse(teamFitRow.productFit),
            methodologyFit: safeJsonParse(teamFitRow.methodologyFit),
            behavioralProfile: safeJsonParse(teamFitRow.behavioralProfile),
            hypotheses: safeJsonParse(teamFitRow.hypotheses),
            summary: teamFitRow.summary,
            dataInsufficient: Boolean(teamFitRow.dataInsufficient),
          }
        : null;
      const githubSlim = githubDeepRow
        ? {
            handle: githubDeepRow.githubHandle,
            profileUrl: githubDeepRow.profileUrl,
            sbScore: githubDeepRow.sbScore,
            techScore: githubDeepRow.techScore,
            behaviorScore: githubDeepRow.behaviorScore,
            riskScore: githubDeepRow.riskScore,
            confidence: githubDeepRow.confidence,
            summary: githubDeepRow.summary,
            recommendation: githubDeepRow.recommendation,
            riskFlags: safeJsonParse(githubDeepRow.riskFlags),
            dataInsufficient: Boolean(githubDeepRow.dataInsufficient),
          }
        : null;

      const systemPrompt = [
        "Ты — ассистент службы безопасности по имени bot-sbshnik.",
        "Отвечай СТРОГО на основании отчётов ниже (базовая проверка, пайплайн, Team Fit, GitHub DeepScan — все вкладки карточки кандидата). Не выдумывай факты.",
        "Если в отчётах нет ответа на вопрос — прямо скажи: «информация не найдена в отчёте» и предложи шаг верификации.",
        "ЗАПРЕЩЕНО утверждать «компания не существует/не зарегистрирована/фиктивна/ликвидирована/сайт не открывается/ИНН не найден/пустышка». У тебя нет доступа к Реестрам (ЕГРЮЛ/ИНН) и к сайтам. Единственный допустимый статус: «Информация не найдена», + рекомендуй ручную проверку через ЕГРЮЛ/rusprofile.ru.",
        "Стиль: лаконично, профессионально, на русском. Можно markdown для списков.",
        "",
        "=== БАЗОВЫЙ ОТЧЁТ (JSON) ===",
        JSON.stringify(baseSlim),
        "",
        pipelineSlim
          ? "=== ПАЙПЛАЙН (JSON) ===\n" + JSON.stringify(pipelineSlim)
          : "=== ПАЙПЛАЙН не создан ===",
        "",
        teamFitSlim
          ? "=== TEAM FIT (JSON) ===\n" + JSON.stringify(teamFitSlim)
          : "=== TEAM FIT не запускался ===",
        "",
        githubSlim
          ? "=== GITHUB DEEPSCAN (JSON) ===\n" + JSON.stringify(githubSlim)
          : "=== GITHUB DEEPSCAN не запускался ===",
      ].join("\n");

      // Загружаем последние сообщения из базы для непрерывного диалога (макс 16)
      const history = await storage.listChatMessages(baseCheck.id, 200);
      const tail = history.slice(-16);

      const messages: Array<{ role: "system" | "user" | "assistant"; text: string }> = [
        { role: "system", text: systemPrompt },
        ...tail.map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          text: m.content,
        })),
        { role: "user", text: userText },
      ];

      let assistantRaw = "";
      try {
        assistantRaw = await yandexComplete(messages, { temperature: 0.3, maxTokens: 1500 });
      } catch (e: any) {
        return res.status(502).json({ message: "LLM недоступен: " + (e?.message || "ошибка") });
      }
      const assistantText = stripPhantomText(assistantRaw) || assistantRaw;

      const now = Date.now();
      const userMsg = await storage.appendChatMessage({
        id: nanoid(10),
        parentCheckId: baseCheck.id,
        pipelineCheckId: lastPipeline?.id ?? null,
        createdAt: now,
        role: "user",
        content: userText,
      });
      const asstMsg = await storage.appendChatMessage({
        id: nanoid(10),
        parentCheckId: baseCheck.id,
        pipelineCheckId: lastPipeline?.id ?? null,
        createdAt: now + 1,
        role: "assistant",
        content: assistantText,
      });

      res.json({
        user: { id: userMsg.id, role: userMsg.role, content: userMsg.content, createdAt: userMsg.createdAt },
        assistant: { id: asstMsg.id, role: asstMsg.role, content: asstMsg.content, createdAt: asstMsg.createdAt },
      });
    } catch (e: any) {
      console.error("Chat message error:", e);
      res.status(500).json({ message: e.message || "Ошибка чата" });
    }
  });

  // DELETE — очистка истории чата (по id базовой проверки)
  app.delete("/api/checks/:id/chat", async (req, res) => {
    try {
      await storage.deleteChatByParent(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // =====================================================================
  // Team Fit / Fit Guard v3 (v3.4)
  // =====================================================================

  // Хелпер десериализации строки из БД в TeamFitReport
  function rowToTeamFitReport(row: any): TeamFitReport {
    const safeParse = <T,>(s: string, fallback: T): T => {
      try { return JSON.parse(s); } catch { return fallback; }
    };
    return {
      id: row.id,
      checkId: row.checkId,
      createdAt: row.createdAt,
      ocean: safeParse<OceanScores>(row.ocean, {
        O: 5, C: 5, E: 5, A: 5, N: 5,
        rationale: { O: "", C: "", E: "", A: "", N: "" },
      }),
      mbtiCluster: (row.mbtiCluster || "none") as MbtiCluster,
      mbtiReasoning: row.mbtiReasoning || "",
      valueFit: safeParse<FitAxis>(row.valueFit, { status: "не выявлен", evidence: [], note: "" }),
      vendorFit: safeParse<FitAxis>(row.vendorFit, { status: "не выявлен", evidence: [], note: "" }),
      productFit: safeParse<FitAxis>(row.productFit, { status: "не выявлен", evidence: [], note: "" }),
      methodologyFit: safeParse<FitAxis>(row.methodologyFit, { status: "не выявлен", evidence: [], note: "" }),
      behavioralProfile: safeParse<string[]>(row.behavioralProfile, []),
      hypotheses: safeParse<InterviewHypothesis[]>(row.hypotheses, []),
      summary: row.summary || "",
      dataInsufficient: Boolean(row.dataInsufficient),
    };
  }

  // GET — вернуть сохранённый отчёт Team Fit по id проверки (или null, если ещё не создан)
  app.get("/api/checks/:id/team-fit", async (req, res) => {
    try {
      const row = await storage.getTeamFitReportByCheckId(req.params.id);
      if (!row) { res.json(null); return; }
      res.json(rowToTeamFitReport(row));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST — запустить анализ Fit Guard v3, сохранить и вернуть отчёт
  app.post("/api/checks/:id/team-fit", async (req, res) => {
    try {
      const checkId = req.params.id;
      const check = await storage.getCheck(checkId);
      if (!check) {
        res.status(404).json({ message: "Проверка не найдена" });
        return;
      }
      const analysis = await runFitGuard(check.resumeText);
      const saved = await storage.createTeamFitReport({
        id: nanoid(),
        checkId,
        createdAt: Date.now(),
        ocean: JSON.stringify(analysis.ocean),
        mbtiCluster: analysis.mbtiCluster,
        mbtiReasoning: analysis.mbtiReasoning,
        valueFit: JSON.stringify(analysis.valueFit),
        vendorFit: JSON.stringify(analysis.vendorFit),
        productFit: JSON.stringify(analysis.productFit),
        methodologyFit: JSON.stringify(analysis.methodologyFit),
        behavioralProfile: JSON.stringify(analysis.behavioralProfile),
        hypotheses: JSON.stringify(analysis.hypotheses),
        summary: analysis.summary,
        dataInsufficient: analysis.dataInsufficient,
      });
      res.json(rowToTeamFitReport(saved));
    } catch (e: any) {
      console.error("Team Fit analysis error:", e);
      res.status(500).json({ message: e?.message || "Ошибка анализа Team Fit" });
    }
  });

  // DELETE — удалить отчёт Team Fit для проверки
  app.delete("/api/checks/:id/team-fit", async (req, res) => {
    try {
      await storage.deleteTeamFitReport(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // =====================================================================
  // GitHub DeepScan v3.5
  // =====================================================================

  function rowToGithubDeepScan(row: any): GitHubDeepScanReport {
    const safeParse = <T,>(s: string, fallback: T): T => {
      try { return JSON.parse(s); } catch { return fallback; }
    };
    return {
      id: row.id,
      checkId: row.checkId,
      createdAt: row.createdAt,
      githubHandle: row.githubHandle,
      profileUrl: row.profileUrl,
      sbScore: row.sbScore,
      techScore: row.techScore,
      behaviorScore: row.behaviorScore,
      riskScore: row.riskScore,
      confidence: row.confidence,
      techProfile: safeParse<GhTechProfile>(row.techProfile, {
        primary: [], languages: [], publicRepos: 0, originalRepos: 0,
        totalStars: 0, accountAgeYears: 0, depthYears: 0, topRepos: [], notes: [],
      }),
      behaviorProfile: safeParse<GhBehaviorProfile>(row.behaviorProfile, {
        hourHistogramMsk: new Array(24).fill(0),
        nightShare: 0, workHoursShare: 0, weekendShare: 0,
        inferredTimezone: "unknown", commitsPerWeek: 0, regularity: 0, notes: [],
      }),
      riskFlags: safeParse<GhRiskFlag[]>(row.riskFlags, []),
      oceanHints: safeParse<GhOceanHints>(row.oceanHints, {
        O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5,
        rationale: { O: "", C: "", E: "", A: "", N: "" },
      }),
      evidence: safeParse<GhEvidenceLink[]>(row.evidence, []),
      summary: row.summary || "",
      recommendation: row.recommendation || "",
      dataInsufficient: Boolean(row.dataInsufficient),
      fetchError: row.fetchError || null,
    };
  }

  // GET — вернуть сохранённый отчёт GitHub DeepScan (или null)
  app.get("/api/checks/:id/github-deepscan", async (req, res) => {
    try {
      const row = await storage.getGithubDeepScanReportByCheckId(req.params.id);
      if (!row) { res.json(null); return; }
      res.json(rowToGithubDeepScan(row));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST — запустить DeepScan (handle из body.githubHandle или из резюме)
  app.post("/api/checks/:id/github-deepscan", async (req, res) => {
    try {
      const checkId = req.params.id;
      const check = await storage.getCheck(checkId);
      if (!check) {
        res.status(404).json({ message: "Проверка не найдена" });
        return;
      }
      const handleOverride =
        typeof req.body?.githubHandle === "string" ? req.body.githubHandle : undefined;

      const analysis = await runGitHubDeepScan({
        resumeText: check.resumeText,
        handleOverride,
      });

      if (analysis.dataInsufficient && !analysis.githubHandle) {
        res.status(400).json({
          message: analysis.fetchError || "GitHub handle не найден. Укажите его вручную.",
        });
        return;
      }

      const saved = await storage.createGithubDeepScanReport({
        id: nanoid(),
        checkId,
        createdAt: Date.now(),
        githubHandle: analysis.githubHandle,
        profileUrl: analysis.profileUrl,
        sbScore: analysis.sbScore,
        techScore: analysis.techScore,
        behaviorScore: analysis.behaviorScore,
        riskScore: analysis.riskScore,
        confidence: analysis.confidence,
        techProfile: JSON.stringify(analysis.techProfile),
        behaviorProfile: JSON.stringify(analysis.behaviorProfile),
        riskFlags: JSON.stringify(analysis.riskFlags),
        oceanHints: JSON.stringify(analysis.oceanHints),
        evidence: JSON.stringify(analysis.evidence),
        summary: analysis.summary,
        recommendation: analysis.recommendation,
        dataInsufficient: analysis.dataInsufficient,
        fetchError: analysis.fetchError,
      });
      res.json(rowToGithubDeepScan(saved));
    } catch (e: any) {
      console.error("GitHub DeepScan error:", e);
      res.status(500).json({ message: e?.message || "Ошибка анализа GitHub DeepScan" });
    }
  });

  app.delete("/api/checks/:id/github-deepscan", async (req, res) => {
    try {
      await storage.deleteGithubDeepScanReport(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
