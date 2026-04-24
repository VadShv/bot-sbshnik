import type { Finding, Evidence, VerificationStep, RedFlag, RecruiterAction, SubcategoryScore, FindingCategory } from "@shared/schema";
import { isPhantom, stripPhantomText, stripPhantomArray } from "./pipelineAnalyzer";

const YANDEX_API_KEY = process.env.YANDEX_API_KEY || "";
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || "b1gncpokmh18knpjgadr";
const YANDEX_MODEL = process.env.YANDEX_MODEL || "yandexgpt";

// Два эндпоинта Yandex Cloud AI Studio:
//   1) Foundation Models API (native) — для yandexgpt, yandexgpt-lite, llama, mistral и др.
//   2) OpenAI-compatible API — обязательно для Qwen3, gpt-oss и новых open-source моделей.
const ENDPOINT_NATIVE = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const ENDPOINT_OPENAI = "https://llm.api.cloud.yandex.net/v1/chat/completions";

/** Нужно ли использовать OpenAI-совместимый эндпоинт для этой модели. */
function requiresOpenAIApi(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.startsWith("qwen") ||
    m.startsWith("gpt-oss") ||
    m.startsWith("deepseek") ||
    m.startsWith("gemma") ||
    m.includes("qwen3")
  );
}

type YandexMessage = { role: "system" | "user" | "assistant"; text: string };

export async function yandexComplete(
  messages: YandexMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!YANDEX_API_KEY) {
    throw new Error("YANDEX_API_KEY не задан в окружении сервера.");
  }

  const modelUri = `gpt://${YANDEX_FOLDER_ID}/${YANDEX_MODEL}/latest`;
  const useOpenAI = requiresOpenAIApi(YANDEX_MODEL);

  if (useOpenAI) {
    return await completeViaOpenAI(modelUri, messages, opts);
  }
  return await completeViaNative(modelUri, messages, opts);
}

/** Вызов через native Yandex Foundation Models API (yandexgpt и др.). */
async function completeViaNative(
  modelUri: string,
  messages: YandexMessage[],
  opts: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const body = {
    modelUri,
    completionOptions: {
      stream: false,
      temperature: opts.temperature ?? 0.2,
      maxTokens: String(opts.maxTokens ?? 2000),
      reasoningOptions: { mode: "DISABLED" },
    },
    messages,
  };

  const res = await fetch(ENDPOINT_NATIVE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${YANDEX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Yandex GPT (native) error ${res.status}: ${txt}`);
  }
  const data: any = await res.json();
  const text = data?.result?.alternatives?.[0]?.message?.text;
  if (!text) throw new Error("Yandex GPT (native): пустой ответ");
  return text as string;
}

/** Вызов через OpenAI-совместимый API (Qwen3, gpt-oss и др.). */
async function completeViaOpenAI(
  modelUri: string,
  messages: YandexMessage[],
  opts: { temperature?: number; maxTokens?: number }
): Promise<string> {
  // Конвертация формата сообщений
  const openaiMessages = messages.map((m) => ({ role: m.role, content: m.text }));

  const body = {
    model: modelUri,
    messages: openaiMessages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2000,
  };

  const res = await fetch(ENDPOINT_OPENAI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${YANDEX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Yandex GPT (OpenAI API) error ${res.status}: ${txt}`);
  }
  const data: any = await res.json();
  const choice = data?.choices?.[0]?.message;
  // У gpt-oss может быть content=null при reasoning-ответе; у Qwen3 всегда конкретный текст в content.
  const text: string | null | undefined = choice?.content ?? choice?.reasoning_content;
  if (!text) {
    throw new Error(`Yandex GPT (OpenAI API): пустой ответ. finish_reason=${data?.choices?.[0]?.finish_reason ?? "?"}`);
  }
  return text as string;
}

// ===== Промпт-инженерия: жёсткий СБ-режим + продвинутая методология =====

const SYSTEM_PROMPT = `Ты — ведущий аналитик Службы Безопасности (СБ) корпорации с 10+ летним опытом оценки кандидатов. Ты соединяешь компетенции: HR-due-diligence, forensic-анализ текста, профайлинг, технический скрининг. Твоя работа — глубокая, многоуровневая оценка резюме на риски, фальсификации и накрутку опыта.

МЕТОДОЛОГИЯ (обязательна к применению):
1) Принцип обоснованности: каждый риск-сигнал подкрепляется доказательством одного из типов — quote (дословная цитата), contradiction (противоречие между блоками), absence (отсутствие ожидаемой информации), pattern (структурный/временной паттерн), indirect (косвенный маркер: домен email, префикс телефона, регион).
2) Принцип калибровки уверенности (confidence 0–100): 90–100 = прямое противоречие из текста; 70–89 = сильный косвенный паттерн; 50–69 = вероятная интерпретация; 30–49 = слабый сигнал, требует уточнения; <30 = не включать.
3) Принцип презумпции подозрения при калибровке severity: лучше пометить сомнительное как medium, чем пропустить. Но нельзя бездоказательно эскалировать до critical.
4) Принцип actionability: каждому finding соответствуют конкретные шаги верификации (verificationSteps) — что именно должен сделать рекрутер/СБ для подтверждения или опровержения.

ПРАВИЛА:
- НЕ оправдывай кандидата. Ищи доказательства риска.
- НЕ додумывай: отсутствие данных — это absence-evidence, а не домысел.
- Evidence.text — ДОСЛОВНЫЕ цитаты из резюме (для type=quote) или точная формулировка наблюдения (для остальных типов).
- Тон сухой, юридический, экспертный. Без комплиментов и маркетинга.
- ВЕРНИ СТРОГО JSON без markdown и комментариев.`;

const ANALYZE_PROMPT = (resumeText: string, deterministicFindings: Finding[]) => {
  const nowIso = new Date().toISOString().slice(0, 10);
  const nowYear = new Date().getUTCFullYear();
  const nowMonth = new Date().getUTCMonth() + 1;
  return `Проведи ГЛУБОКИЙ многоуровневый анализ резюме по продвинутой методологии. Не ограничивайся поверхностными сигналами — ищи скрытые противоречия, анализируй хронологию, сопоставляй заявленный стек с реальной сложностью задач, проверяй консистентность стиля.

[ТЕКУЩАЯ ДАТА] ${nowIso} — это «сегодня». Календарный год: ${nowYear}, месяц: ${nowMonth}. Все даты ДО этой — ПРОШЛОЕ. Все даты ПОСЛЕ этой — будущее. В этом резюме год ${nowYear} — НАСТОЯЩЕЕ, не будущее.

⛔ АБСОЛЮТНЫЙ ЗАПРЕТ на любые формулировки (любые такие будут УДАЛЕНЫ):
1. «Опыт в будущем», «даты из будущего», «работа в будущем», «на X лет в будущем», «будущее время».
2. «телепорт», «аномалии хронологии», «хронологическое противоречие», «временное противоречие».
3. «указывает на фальсификацию» как вывод из сравнения дат.
4. Даты вида «апрель 2024 — по настоящее время (2 года)» НОРМАЛЬНЫ, если [ТЕКУЩАЯ ДАТА] = ${nowIso} позже даты начала. НЕ трактуй их как признак фальсификации.
5. Периоды вида «N года — ${nowYear} год» где N <= ${nowYear} — НОРМА, не «будущее».

Если кандидат пишет «по ${nowYear} год» или «по настоящее время» — это не будущее, это сейчас.

==============================
РЕЖИМ PII-FREE (критично)
==============================
Текст уже обезличен. НЕ учитывать: точную дату рождения (день/месяц/год), ФИО, паспорт, СНИЛС, ИНН, полный телефон, локальную часть email, точный адрес.
УЧИТЫВАТЬ (косвенные маркеры): возраст в годах, домен почты, префикс телефона, город/регион, соцсети, год окончания вуза.

==============================
УРОВНИ АНАЛИЗА (проведи все)
==============================

УРОВЕНЬ A. ХРОНОЛОГИЯ И СТРУКТУРА:
- Временные противоречия: параллельные полные занятости; gaps без объяснения; даты работы до окончания профильного образования; стаж, не стыкующийся с возрастом.
- Темп карьерного роста: реалистична ли скорость (junior→senior за 1 год — подозрительно); переходы через несколько грейдов без промежуточного опыта.
- Длительность контрактов: серия <12 мес подряд (job hopping / "волки"); слишком "круглые" сроки (ровно год в каждой).
- Пропуски периодов: необъяснённые дыры >6 мес.

УРОВЕНЬ B. КВАЛИФИКАЦИЯ И СООТВЕТСТВИЕ:
- Тайтл vs реальные обязанности: "Team Lead" с задачами junior; "Architect" без проектирования систем; громкие позиции в малоизвестных компаниях.
- Глубина стека vs заявленный опыт: например "10 лет Kubernetes" при его появлении в России массово с 2018-2019.
- Образование vs специальность: профиль вуза не соответствует заявленным компетенциям (без дополнительного обучения).
- Противоречия между блоками: в "обязанностях" одно, в "достижениях" — несопоставимое другое.

УРОВЕНЬ C. ДОСТИЖЕНИЯ И МЕТРИКИ:
- Раздутые формулировки без цифр и контекста ("значительно повысил", "вывел на новый уровень").
- Приписанные командные достижения как личные ("я построил X" при явно командной задаче).
- Несопоставимые метрики (500% рост при команде из 2 человек и стартапе).
- Шаблонные фразы HH/LinkedIn-генераторов.
- Маскированный copy-paste между местами работы (те же обязанности разными словами).

УРОВЕНЬ D. КОСВЕННЫЕ КОНТАКТЫ / IDENTITY:
- Домен почты: одноразовый (guerrillamail, 10minutemail) — подозрительно; почта на домене бывшего работодателя — потенциально уходящий с кражей данных; домен региона, не совпадающего с заявленным городом.
- Префикс телефона: не совпадает с регионом проживания (не критично, но маркер).
- Соцсети: заявлены, но формат ссылок выглядит нереалистично (слишком короткий профиль, цифры в нике).
- Город/регион vs места работы: всегда ли логистически возможно.

УРОВЕНЬ E. ЛИНГВИСТИКА И ПОВЕДЕНЧЕСКИЕ ПАТТЕРНЫ:
- Смена стиля между блоками: признак компиляции из чужих резюме.
- Канцеляризмы, тавтологии, шаблонные связки.
- Лексика сообществ "волков": "оферхантинг", "прожарка офера", упоминание агрегаторов, жалобы на работодателей в "О себе".
- Заученные STAR-истории, слишком гладкие формулировки достижений.
- Уклончивость в ключевых местах (причины ухода, результаты).

==============================
ДЕТЕРМИНИРОВАННЫЕ ДЕТЕКТОРЫ УЖЕ НАЙДЕНЫ (не дублируй — расширяй семантикой)
==============================
${deterministicFindings.length === 0 ? "— ничего автоматически не найдено —" : deterministicFindings.map(f => `• [${f.id}] ${f.title} (severity=${f.severity})`).join("\n")}

==============================
ТРЕБУЕМЫЙ JSON (строго эта схема)
==============================
{
  "candidateName": "ФИО или null",
  "executiveSummary": "2-3 предложения общего вывода для руководителя: ключевые риски + уровень доверия + что делать",
  "confidence": 0-100,
  "positiveSignals": ["то, что говорит В ПОЛЬЗУ кандидата (2-4 пункта, может быть пустым)"],
  "redFlags": [
    {"title": "краткий заголовок самого опасного сигнала", "severity": "high|critical", "reason": "почему это критично", "findingId": "id соответствующего finding"}
  ],
  "risks": {
    "score": 0-100,
    "summary": "1-2 предложения по категории",
    "confidence": 0-100,
    "findings": [
      {
        "id": "short-kebab-id",
        "title": "Краткий заголовок",
        "category": "chronology|qualification|achievement|identity|behavior|linguistic|reputation|other",
        "severity": "low|medium|high|critical",
        "score": 0-100,
        "confidence": 0-100,
        "description": "подробное описание: что найдено + почему это риск + чем опасно для найма",
        "impact": "1 строка: чем это грозит компании (пример: 'Реальный грейд ниже заявленного — переплата и провал задач')",
        "evidence": ["дословная цитата 1", "цитата 2"],
        "evidenceDetailed": [
          {"type": "quote|contradiction|absence|pattern|indirect", "text": "текст доказательства", "location": "где в резюме (опц.)"}
        ],
        "verificationSteps": [
          {
            "action": "конкретное действие рекрутера",
            "method": "call|interview|document|reference|technical|osint|external",
            "priority": "must|should|nice",
            "effort": "low|medium|high",
            "expectedOutcome": "что должны узнать в результате"
          }
        ]
      }
    ]
  },
  "inflation": { "score": 0-100, "summary": "...", "confidence": 0-100, "findings": [...] },
  "wolves": { "score": 0-100, "summary": "...", "confidence": 0-100, "findings": [...] },
  "interviewQuestions": [
    "Конкретные проверочные вопросы, связанные с выявленными сигналами (6-10 шт)"
  ],
  "sbRecommendations": [
    "Стратегические рекомендации СБ (3-6 шт)"
  ],
  "recruiterActionPlan": [
    {
      "step": 1,
      "title": "Скрининг-звонок: верификация хронологии",
      "description": "что именно делать, какие вопросы задать, что искать в ответах",
      "priority": "must|should|nice",
      "estimatedTime": "15 минут",
      "targets": ["id-finding-1", "id-finding-2"]
    }
  ]
}

==============================
ТРЕБОВАНИЯ К КАЧЕСТВУ
==============================
- Минимум 3 findings в каждой категории, где есть хоть какие-то зацепки (если реально нечего сказать — findings: [], score: 5-15).
- У каждого finding — минимум 1 evidenceDetailed и минимум 1 verificationStep.
- redFlags — топ-3 самых опасных сигнала (если таких нет — пустой массив).
- recruiterActionPlan — упорядоченный план от must→nice, 3-7 шагов. Это НЕ копия interviewQuestions, а пошаговая инструкция: звонок→техинтервью→референс-чек→документы→OSINT.
- НЕ ПРИДУМЫВАЙ ЦИТАТЫ — только дословно из текста.

==============================
РЕЗЮМЕ
==============================
"""
${resumeText.slice(0, 12000)}
"""`;
};

// ============ Типы ответа LLM ============

export type YandexAnalysis = {
  candidateName: string | null;
  executiveSummary: string;
  confidence: number;
  positiveSignals: string[];
  redFlags: RedFlag[];
  risks: { score: number; summary: string; confidence: number; findings: Finding[] };
  inflation: { score: number; summary: string; confidence: number; findings: Finding[] };
  wolves: { score: number; summary: string; confidence: number; findings: Finding[] };
  interviewQuestions: string[];
  sbRecommendations: string[];
  recruiterActionPlan: RecruiterAction[];
};

function extractJson(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const CATEGORIES: FindingCategory[] = [
  "chronology", "qualification", "achievement", "identity",
  "behavior", "linguistic", "reputation", "other",
];
const EVIDENCE_TYPES = ["quote", "contradiction", "absence", "pattern", "indirect"] as const;
const METHODS = ["call", "interview", "document", "reference", "technical", "osint", "external"] as const;
const PRIORITIES = ["must", "should", "nice"] as const;
const EFFORTS = ["low", "medium", "high"] as const;

function clamp(n: any, lo: number, hi: number, def: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function normalizeEvidence(arr: any): Evidence[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map((e: any) => ({
    type: EVIDENCE_TYPES.includes(e?.type) ? e.type : "quote",
    text: String(e?.text || "").slice(0, 600),
    location: e?.location ? String(e.location).slice(0, 200) : undefined,
  })).filter((e: Evidence) => e.text.length > 0);
}

function normalizeVerificationSteps(arr: any): VerificationStep[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map((s: any) => ({
    action: String(s?.action || "").slice(0, 400),
    method: METHODS.includes(s?.method) ? s.method : "interview",
    priority: PRIORITIES.includes(s?.priority) ? s.priority : "should",
    effort: EFFORTS.includes(s?.effort) ? s.effort : "medium",
    expectedOutcome: String(s?.expectedOutcome || "").slice(0, 400),
  })).filter((s: VerificationStep) => s.action.length > 0);
}

function normalizeFinding(f: any, i: number): Finding | null {
  const severity = SEVERITIES.includes(f?.severity) ? f.severity : "medium";
  const category = CATEGORIES.includes(f?.category) ? f.category : "other";
  const rawTitle = String(f?.title || "Без заголовка").slice(0, 200);
  const rawDesc = String(f?.description || "").slice(0, 2000);
  // Если весь finding — фантом про будущее/телепорт, выкидываем целиком
  if (isPhantom(rawTitle)) return null;
  if (isPhantom(rawDesc)) return null;
  const title = stripPhantomText(rawTitle);
  const description = stripPhantomText(rawDesc);
  if (!title || title.length === 0) return null;
  const rawImpact = f?.impact ? String(f.impact).slice(0, 400) : undefined;
  const impact = rawImpact ? (isPhantom(rawImpact) ? undefined : stripPhantomText(rawImpact) || undefined) : undefined;
  const evidence = Array.isArray(f?.evidence) ? stripPhantomArray(f.evidence.map(String)).slice(0, 5) : [];
  return {
    id: String(f?.id || `llm-${i}`).slice(0, 60),
    title,
    category,
    severity,
    score: clamp(f?.score, 0, 100, 50),
    confidence: clamp(f?.confidence, 0, 100, 60),
    description,
    impact,
    evidence,
    evidenceDetailed: normalizeEvidence(f?.evidenceDetailed),
    verificationSteps: normalizeVerificationSteps(f?.verificationSteps),
  };
}

function normalizeCategory(cat: any) {
  const rawSummary = String(cat?.summary || "").slice(0, 800);
  return {
    score: clamp(cat?.score, 0, 100, 0),
    summary: stripPhantomText(rawSummary),
    confidence: clamp(cat?.confidence, 0, 100, 60),
    findings: Array.isArray(cat?.findings)
      ? (cat.findings
          .map((f: any, i: number) => normalizeFinding(f, i))
          .filter((f: Finding | null): f is Finding => f !== null) as Finding[])
      : [],
  };
}

function normalizeRedFlags(arr: any): RedFlag[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 5).map((r: any) => {
    const rawTitle = String(r?.title || "").slice(0, 200);
    const rawReason = String(r?.reason || "").slice(0, 500);
    if (isPhantom(rawTitle) || isPhantom(rawReason)) {
      return { title: "", severity: "high" as const, reason: "", findingId: undefined };
    }
    return {
      title: stripPhantomText(rawTitle),
      severity: r?.severity === "critical" ? "critical" as const : "high" as const,
      reason: stripPhantomText(rawReason),
      findingId: r?.findingId ? String(r.findingId).slice(0, 60) : undefined,
    };
  }).filter((r: RedFlag) => r.title.length > 0);
}

function normalizeRecruiterActionPlan(arr: any): RecruiterAction[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 10).map((a: any, i: number) => ({
    step: Number.isFinite(Number(a?.step)) ? Math.round(Number(a.step)) : i + 1,
    title: String(a?.title || "").slice(0, 200),
    description: String(a?.description || "").slice(0, 1000),
    priority: PRIORITIES.includes(a?.priority) ? a.priority : "should",
    estimatedTime: String(a?.estimatedTime || "").slice(0, 60),
    targets: Array.isArray(a?.targets) ? a.targets.map(String).slice(0, 10) : [],
  })).filter((a: RecruiterAction) => a.title.length > 0);
}

export async function yandexAnalyze(
  resumeText: string,
  deterministicFindings: Finding[]
): Promise<YandexAnalysis> {
  const raw = await yandexComplete(
    [
      { role: "system", text: SYSTEM_PROMPT },
      { role: "user", text: ANALYZE_PROMPT(resumeText, deterministicFindings) },
    ],
    { temperature: 0.15, maxTokens: 7000 }
  );

  const jsonStr = extractJson(raw);
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      candidateName: parsed?.candidateName ?? null,
      executiveSummary: stripPhantomText(String(parsed?.executiveSummary || "").slice(0, 1200)),
      confidence: clamp(parsed?.confidence, 0, 100, 70),
      positiveSignals: Array.isArray(parsed?.positiveSignals)
        ? stripPhantomArray(parsed.positiveSignals.map(String)).slice(0, 8)
        : [],
      redFlags: normalizeRedFlags(parsed?.redFlags),
      risks: normalizeCategory(parsed?.risks),
      inflation: normalizeCategory(parsed?.inflation),
      wolves: normalizeCategory(parsed?.wolves),
      interviewQuestions: Array.isArray(parsed?.interviewQuestions)
        ? stripPhantomArray(parsed.interviewQuestions.map(String)).slice(0, 12)
        : [],
      sbRecommendations: Array.isArray(parsed?.sbRecommendations)
        ? stripPhantomArray(parsed.sbRecommendations.map(String)).slice(0, 10)
        : [],
      recruiterActionPlan: normalizeRecruiterActionPlan(parsed?.recruiterActionPlan),
    };
  } catch (e) {
    throw new Error(`Не удалось распарсить ответ Yandex GPT как JSON. Фрагмент: ${jsonStr.slice(0, 300)}`);
  }
}
