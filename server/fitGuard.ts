// ============================================================
// FIT GUARD v3 — модуль Team Fit (психо-поведенческая гипотеза)
// 5 осей: Values / Vendor / Product / Methodology / Psychotype (OCEAN + MBTI NT)
// ============================================================
//
// ВАЖНО:
// - Все выводы — гипотезы для верификации на интервью, не диагноз и не основание для отказа.
// - Если резюме < 300 слов → dataInsufficient = true, содержательная часть пустая.
// - Вендорный фит целится в российских вендоров промышленного/корпоративного ПО.
//
import { yandexComplete } from "./yandex";
import { stripPhantomText } from "./pipelineAnalyzer";
import type {
  TeamFitReport,
  OceanScores,
  MbtiCluster,
  FitAxis,
  FitAxisStatus,
  InterviewHypothesis,
} from "@shared/schema";

// ============ Утилиты ============

function extractJson(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function countWords(text: string): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function clamp0to10(n: any): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

function normStr(v: any, def = ""): string {
  if (typeof v !== "string") return def;
  return stripPhantomText(v.trim()) || def;
}

function normArr(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? stripPhantomText(x.trim()) : ""))
    .filter((s) => s.length > 0);
}

function normAxis(raw: any): FitAxis {
  const allowed: FitAxisStatus[] = ["выявлен", "частично", "не выявлен"];
  const statusRaw = typeof raw?.status === "string" ? raw.status.toLowerCase().trim() : "";
  let status: FitAxisStatus = "не выявлен";
  if (statusRaw.startsWith("выяв")) status = "выявлен";
  else if (statusRaw.startsWith("част")) status = "частично";
  else if (statusRaw.startsWith("не") || statusRaw.includes("не выяв")) status = "не выявлен";
  else if (allowed.includes(statusRaw as FitAxisStatus)) status = statusRaw as FitAxisStatus;
  return {
    status,
    evidence: normArr(raw?.evidence).slice(0, 6),
    note: normStr(raw?.note),
  };
}

function normMbti(raw: any): MbtiCluster {
  const allowed: MbtiCluster[] = ["INTJ", "INTP", "ENTJ", "ENTP", "none"];
  const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (allowed.includes(v as MbtiCluster)) return v as MbtiCluster;
  if (v === "NONE" || v === "") return "none";
  return "none";
}

function normHypotheses(raw: any): InterviewHypothesis[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 5)
    .map((h) => ({
      hypothesis: normStr(h?.hypothesis),
      rationale: normStr(h?.rationale),
      questions: normArr(h?.questions).slice(0, 2),
    }))
    .filter((h) => h.hypothesis.length > 0);
}

function normOcean(raw: any): OceanScores {
  const r = raw || {};
  const rationale = r?.rationale || {};
  return {
    O: clamp0to10(r?.O),
    C: clamp0to10(r?.C),
    E: clamp0to10(r?.E),
    A: clamp0to10(r?.A),
    N: clamp0to10(r?.N),
    rationale: {
      O: normStr(rationale?.O),
      C: normStr(rationale?.C),
      E: normStr(rationale?.E),
      A: normStr(rationale?.A),
      N: normStr(rationale?.N),
    },
  };
}

// ============ System prompt ============

export const FIT_GUARD_SYSTEM_PROMPT = `Ты — Fit Guard v3, модуль Team Fit внутри «БОТ СБшник».
Твоя задача — построить ГИПОТЕЗЫ о культурном и психо-поведенческом соответствии кандидата команде строго по тексту резюме. Ты не HR и не психолог-диагност. Ты ставишь аккуратные гипотезы для верификации на интервью.

ЖЕЛЕЗНЫЕ ПРАВИЛА:
1. Все выводы — ГИПОТЕЗЫ, требующие проверки на интервью. Никогда не формулируй их как диагноз.
2. Работай ТОЛЬКО с текстом резюме. Не додумывай биографию, семью, здоровье, убеждения.
3. Не делай выводов о расе, поле, возрасте, национальности, религии, сексуальности, политике, здоровье.
4. Если резюме короткое/бедное — честно помечай недостаток данных.
5. Каждое утверждение о кандидате подкрепляй короткой опорой из резюме (психолингвистический маркер, факт, формулировка).
6. Пиши по-русски, профессионально, без «воды», без канцелярита, без эмодзи.
7. Формат ответа — СТРОГО валидный JSON по схеме из пользовательского промпта, без пояснений до/после.

МЕТОДОЛОГИЯ — 5 осей Team Fit:

[1] Ценностный фит (valueFit)
Ищи маркеры ценностей: ответственность за результат, командность, развитие/наставничество, прозрачность, этика, отношение к ошибкам. Опора: глаголы, формулировки достижений, упоминания ролей в команде.

[2] Вендорный фит (vendorFit) — РОССИЙСКИЕ вендоры корпоративного/промышленного ПО
Ищи явные упоминания: 1С, Галактика, Bitrix24, Мой Офис, Контур, СберТех, Яндекс.Облако, VK Tech, Astra Linux, РЕД ОС, ALT Linux, Postgres Pro, Arenadata, Tarantool, ГК «Цифра», Docsvision, Directum, ELMA, Naumen, Т1, КРОК, Диасофт, Р-Стиль, ЦФТ, БАРС Груп, «Базис», Р7-Офис и подобные. Если явных упоминаний нет — status = «не выявлен».

[3] Продуктовый фит (productFit)
Ищи, работал ли кандидат с продуктовым подходом: продуктовые метрики (retention, conversion, LTV, CAC, ARPU), discovery/delivery, гипотезы, A/B, customer development, roadmap, OKR по продукту. Если встречаются только проектные формулировки — «частично» или «не выявлен».

[4] Методологический фит (methodologyFit)
Ищи маркеры Agile/Scrum/Kanban/SAFe/LeSS: роли (PO, SM, RTE), артефакты (беклог, спринт, стендап, ретро, ревью), фреймворки (Scrum, Kanban, SAFe), waterfall/PMBOK/PRINCE2 в проектной среде. Без явных маркеров — «не выявлен».

[5] Психотип-Аналитик (OCEAN + MBTI NT-кластер)

OCEAN (Big Five) — для каждой оси гипотетический балл 0..10 (0 — низкая, 5 — умеренная, 10 — высокая) + краткое (1 предложение) обоснование из резюме:
- O (Openness / Открытость): любознательность, разнообразие ролей/доменов, обучение, R&D, смена стеков.
- C (Conscientiousness / Добросовестность): доведение до результата, метрики, сроки, регламенты, документирование.
- E (Extraversion / Экстраверсия): менторство, публичные выступления, работа со стейкхолдерами, фасилитация.
- A (Agreeableness / Доброжелательность): командная работа, наставничество, формулировки о «мы», эмпатия.
- N (Neuroticism / Нейротизм): признаки частых конфликтов, резкие смены места, эмоциональные формулировки; низкий балл = стабильность.

MBTI NT-кластер (гипотеза о когнитивном стиле, не диагноз):
- INTJ — архитектор: стратег, системность, долгосрочные проекты, сам разрабатывает концепции, критичен к процессам.
- INTP — мыслитель: исследователь, глубина, R&D, аналитика данных/алгоритмов, склонность копать «как устроено».
- ENTJ — командир: лидирует изменения, драйвит команды и сроки, ставит цели другим, управляет программами.
- ENTP — новатор: генератор гипотез, много инициатив, кросс-домены, эксперименты, любит новые направления.
- none — недостаточно признаков NT-кластера (например, ярко выражен S/F профиль или данных мало).

ПСИХОЛИНГВИСТИЧЕСКИЕ МАРКЕРЫ (используй как опоры, не цитируй целые абзацы):
- Субъектность («я запустил», «я построил») vs обезличенность («была внедрена система»).
- Конкретика (числа, имена, системы) vs абстрактика («существенно улучшил»).
- Командность («мы», «совместно с…») vs одиночество («сам», «единолично»).
- Причинность (почему/зачем) vs простое перечисление.
- Тональность: деловая / эмоциональная / оценочная.

ГАРДЫ:
- Если резюме < 300 слов или крайне скудное по содержанию — верни dataInsufficient = true, все оси в статусе «не выявлен», OCEAN баллы = 5 с пустыми rationale, mbtiCluster = "none", поведенческий профиль и гипотезы — пустые массивы, summary = "Недостаточно данных в резюме для психотипирования и оценки Team Fit. Необходимо интервью."
- Никогда не рекомендуй отказать кандидату на основании Team Fit — это только гипотезы к интервью.

СХЕМА ОТВЕТА (только JSON):
{
  "dataInsufficient": boolean,
  "ocean": { "O": 0..10, "C": 0..10, "E": 0..10, "A": 0..10, "N": 0..10,
             "rationale": { "O": "1 предл.", "C": "...", "E": "...", "A": "...", "N": "..." } },
  "mbtiCluster": "INTJ" | "INTP" | "ENTJ" | "ENTP" | "none",
  "mbtiReasoning": "1–3 предложения, на чём строится гипотеза кластера",
  "valueFit":       { "status": "выявлен|частично|не выявлен", "evidence": ["..."], "note": "..." },
  "vendorFit":      { "status": "выявлен|частично|не выявлен", "evidence": ["..."], "note": "..." },
  "productFit":     { "status": "выявлен|частично|не выявлен", "evidence": ["..."], "note": "..." },
  "methodologyFit": { "status": "выявлен|частично|не выявлен", "evidence": ["..."], "note": "..." },
  "behavioralProfile": ["5 коротких буллетов: сильные стороны и риски стиля работы"],
  "hypotheses": [
    { "hypothesis": "гипотеза о соответствии/риске", "rationale": "опора в резюме",
      "questions": ["проверочный вопрос 1", "проверочный вопрос 2"] }
  ],
  "summary": "2–3 предложения: общее впечатление и ключевые зоны проверки на интервью"
}

Верни от 3 до 5 гипотез в hypotheses. Не пиши ничего вне JSON.`;

// ============ Prompt ============

function buildUserPrompt(resumeText: string): string {
  return `РЕЗЮМЕ КАНДИДАТА (plain text, как есть):
"""
${resumeText}
"""

Сформируй Team Fit гипотезу по схеме из системного промпта. Только JSON.`;
}

// ============ Fallback (для ошибок LLM / слишком короткого резюме) ============

function emptyAxis(): FitAxis {
  return { status: "не выявлен", evidence: [], note: "" };
}

function insufficientReport(): Omit<TeamFitReport, "id" | "checkId" | "createdAt"> {
  const emptyRat = { O: "", C: "", E: "", A: "", N: "" };
  return {
    ocean: { O: 5, C: 5, E: 5, A: 5, N: 5, rationale: emptyRat },
    mbtiCluster: "none",
    mbtiReasoning: "",
    valueFit: emptyAxis(),
    vendorFit: emptyAxis(),
    productFit: emptyAxis(),
    methodologyFit: emptyAxis(),
    behavioralProfile: [],
    hypotheses: [],
    summary:
      "Недостаточно данных в резюме для психотипирования и оценки Team Fit. Необходимо интервью.",
    dataInsufficient: true,
  };
}

// ============ Основная функция ============

export async function runFitGuard(
  resumeText: string,
): Promise<Omit<TeamFitReport, "id" | "checkId" | "createdAt">> {
  const wordCount = countWords(resumeText);
  if (wordCount < 300) {
    return insufficientReport();
  }

  try {
    const raw = await yandexComplete(
      [
        { role: "system", text: FIT_GUARD_SYSTEM_PROMPT },
        { role: "user", text: buildUserPrompt(resumeText) },
      ],
      { temperature: 0.3, maxTokens: 6000 },
    );
    const parsed = JSON.parse(extractJson(raw));

    const dataInsufficient = Boolean(parsed?.dataInsufficient);
    if (dataInsufficient) {
      return insufficientReport();
    }

    return {
      ocean: normOcean(parsed?.ocean),
      mbtiCluster: normMbti(parsed?.mbtiCluster),
      mbtiReasoning: normStr(parsed?.mbtiReasoning),
      valueFit: normAxis(parsed?.valueFit),
      vendorFit: normAxis(parsed?.vendorFit),
      productFit: normAxis(parsed?.productFit),
      methodologyFit: normAxis(parsed?.methodologyFit),
      behavioralProfile: normArr(parsed?.behavioralProfile).slice(0, 7),
      hypotheses: normHypotheses(parsed?.hypotheses),
      summary: normStr(parsed?.summary),
      dataInsufficient: false,
    };
  } catch (e: any) {
    console.warn("Fit Guard fallback:", e?.message || e);
    return insufficientReport();
  }
}
