import { yandexComplete } from "./yandex";
import type {
  RecruiterForm,
  EtkStructured,
  SingleStepReport,
  VerificationResult,
  VerificationItem,
  VerificationStatus,
  MotivationAnalysis,
  CulturalFitV3,
  CulturalValueScore,
  CulturalValueKey,
  LoyaltyScore,
  FinalResolution,
  ResolutionCode,
  SearchReason,
  AttitudeToFormer,
  TimePressure,
  References,
} from "@shared/schema";

// ==========================================================
// Методология и системный промпт
// ==========================================================

const SYSTEM_PROMPT = `Ты — единый AI-аналитик Службы Безопасности и HR. Твоя задача — за один проход провести четыре параллельных модуля анализа кандидата: верификация опыта (резюме × ЭТК), анализ мотивации, оценка культурного соответствия по 3 ценностям и индекс лояльности и стабильности (ILS).

Принципы:
1) Принцип обоснованности: каждая оценка опирается на дословные цитаты или точно сформулированные наблюдения.
2) Принцип PII-free: не используй ФИО, точную дату рождения, паспорт, СНИЛС, ИНН, полный телефон. Допустимы косвенные маркеры (домен email, префикс телефона, регион).
3) Принцип блокирующего расхождения: если резюме и ЭТК прямо противоречат друг другу по компаниям/периодам — status="conflict" (🔴), это блокирующий фактор.
4) Принцип калибровки ценностей: 1 — явные антиподы ценности, 2 — слабо выражено, 3 — нейтрально/не проявляется, 4 — хорошо видно, 5 — ярко и последовательно.
5) Принцип 3 ценностей (v3.0): только три ценности — «Ответственность за результат», «Партнёрство», «Дух предпринимательства».
6) Возвращай СТРОГО JSON без markdown и комментариев.`;

// ==========================================================
// Формирование промпта
// ==========================================================

function reasonLabel(r: SearchReason): string {
  switch (r) {
    case "growth": return "карьерный рост";
    case "low_salary": return "низкая зарплата";
    case "layoff": return "сокращение / увольнение";
    case "conflict": return "конфликт с руководством/коллегами";
    case "burnout": return "выгорание";
    case "no_growth": return "отсутствие роста";
    default: return "другое / не указано";
  }
}
function attitudeLabel(a: AttitudeToFormer): string {
  switch (a) {
    case "positive": return "позитивное";
    case "neutral": return "нейтральное";
    case "critical": return "критическое";
    case "hostile": return "враждебное";
  }
}
function pressureLabel(p: TimePressure): string {
  switch (p) {
    case "has_offer": return "есть параллельный оффер";
    case "personal_deadline": return "личный дедлайн";
    case "no_pressure": return "нет прессинга";
    case "not_specified": return "не обсуждалось";
  }
}
function refLabel(r: References): string {
  switch (r) {
    case "has_ready": return "есть готовые контакты";
    case "has_not_ready": return "есть, но контакты не предоставлены";
    case "none": return "нет рекомендателей";
    case "not_discussed": return "не обсуждалось";
  }
}

function buildEtkBlock(etk: EtkStructured): string {
  if (!etk.records.length) {
    return etk.source === "none"
      ? "— ЭТК не предоставлена —"
      : "— ЭТК прислана, но записи не извлечены —";
  }
  return etk.records
    .map((r, i) => {
      const period = [r.startDate ?? "?", r.endDate ?? "наст.время"].join(" — ");
      const pos = r.position ? `, ${r.position}` : "";
      const reason = r.reason ? `, причина: ${r.reason}` : "";
      return `  ${i + 1}. ${r.company}${pos} [${period}]${reason}`;
    })
    .join("\n");
}

function buildAnalyzePrompt(
  resumeText: string,
  etk: EtkStructured,
  interviewText: string,
  referencesText: string,
  form: RecruiterForm,
): string {
  return `Проведи ЕДИНЫЙ анализ кандидата по 4 модулям. Верни строго JSON по схеме.

==============================
ВХОДНЫЕ ДАННЫЕ
==============================

[РЕЗЮМЕ]
"""
${resumeText.slice(0, 10000)}
"""

[ЭТК / СФР — структурированные записи]
${buildEtkBlock(etk)}

[ЗАМЕТКИ ИНТЕРВЬЮ]
"""
${(interviewText || "— не предоставлено —").slice(0, 4000)}
"""

[РЕФЕРЕНСЫ / РЕКОМЕНДАЦИИ]
"""
${(referencesText || "— не предоставлено —").slice(0, 3000)}
"""

[ФОРМА РЕКРУТЕРА]
• Причина поиска работы: ${reasonLabel(form.searchReason)}
• Отношение к бывшим работодателям: ${attitudeLabel(form.attitudeToFormer)}
• Временной прессинг: ${pressureLabel(form.timePressure)}
• Рекомендатели: ${refLabel(form.references)}
• Заметка рекрутера: «${(form.note || "").slice(0, 300)}»

==============================
МОДУЛЬ 1 — ВЕРИФИКАЦИЯ ОПЫТА
==============================
Сопоставь каждое место работы из РЕЗЮМЕ с записями ЭТК.
Статусы по каждому месту: "confirmed" (полное совпадение компании и периода), "partial" (компания совпадает, но расхождение ±3 мес в датах или различие в должности), "conflict" (компания отсутствует в ЭТК или период отличается более чем на 3 месяца), "not_checked" (ЭТК не предоставлена или запись невозможно сопоставить).
Если ЭТК отсутствует — для всех мест выстави "not_checked" и поставь общий статус "not_checked", blockingConflict=false, etkAvailable=false.
blockingConflict=true тогда и только тогда, когда есть хотя бы один "conflict".

==============================
МОДУЛЬ 2 — АНАЛИЗ МОТИВАЦИИ
==============================
Оцени здоровье мотивации (0–100). Сопоставь декларируемую в резюме/интервью причину поиска с тем, что отметил рекрутер (reasonConsistency: match/partial/mismatch). Найди признаки нездоровой мотивации (работодатель-тиран, «все вокруг виноваты», выгорание с перекладыванием ответственности). Зафиксируй urgencyNote по временному прессингу.

==============================
МОДУЛЬ 3 — CULTURAL FIT V3 (3 ЦЕННОСТИ)
==============================
Оцени по шкале 1–5 каждую из трёх ценностей:
• responsibility — «Ответственность за результат»: берёт на себя ответственность, доводит до конца, не перекладывает вину, думает про результат для бизнеса.
• partnership — «Партнёрство»: работает в команде, признаёт чужой вклад, говорит «мы», помогает коллегам, умеет договариваться, уважает работодателя.
• entrepreneurship — «Дух предпринимательства»: инициатива, работа в неопределённости, готовность запускать новое, проактивность, предприимчивость.
Для каждой ценности — 1–3 дословных цитаты или точных наблюдений в поле evidence.

==============================
МОДУЛЬ 4 — ИНДЕКС ЛОЯЛЬНОСТИ И СТАБИЛЬНОСТИ (ILS)
==============================
sHistory (0–100) — стабильность трудовой истории: средняя длительность контрактов, частота смен, наличие коротких <12 мес контрактов.
sRecruiter (0–100) — на основе формы рекрутера: отношение к бывшим, рекомендатели, временной прессинг, причина поиска.
sLanguage (0–100) — по языку резюме/интервью: конфликтные формулировки, «я vs работодатель», жалобы, язык сообществ «волков» / оверэмплоймента.
Итоговый score вычисляется агентом-оркестратором, ты просто верни три компонента честно. Но для справки: ILS = 0.40·S_history + 0.35·S_recruiter + 0.25·S_language.
flags — 0–5 коротких маркеров рисков лояльности.

==============================
ТРЕБУЕМЫЙ JSON (строго эта схема)
==============================
{
  "candidateName": "ФИО или null",
  "verification": {
    "status": "confirmed|partial|conflict|not_checked",
    "summary": "1-2 предложения",
    "blockingConflict": false,
    "etkAvailable": true,
    "items": [
      { "company": "...", "position": "...", "declared": "период/должность по резюме", "etk": "период/должность по ЭТК или пусто", "status": "confirmed|partial|conflict|not_checked", "note": "краткий комментарий" }
    ]
  },
  "motivation": {
    "score": 0,
    "summary": "1-2 предложения",
    "declaredReason": "как сам кандидат формулирует причину",
    "recruiterReason": "${form.searchReason}",
    "reasonConsistency": "match|partial|mismatch",
    "redFlags": ["..."],
    "greenFlags": ["..."],
    "urgencyNote": "краткая интерпретация прессинга"
  },
  "culturalFit": {
    "summary": "1-2 предложения",
    "values": [
      { "key": "responsibility", "label": "Ответственность за результат", "score": 3, "evidence": ["цитата1","цитата2"], "note": "опц." },
      { "key": "partnership", "label": "Партнёрство", "score": 3, "evidence": ["..."], "note": "опц." },
      { "key": "entrepreneurship", "label": "Дух предпринимательства", "score": 3, "evidence": ["..."], "note": "опц." }
    ]
  },
  "loyalty": {
    "sHistory": 0,
    "sRecruiter": 0,
    "sLanguage": 0,
    "summary": "1-2 предложения",
    "flags": ["..."]
  }
}

ПРАВИЛА:
- Цитаты в evidence — дословно из резюме/интервью/референсов. Не придумывай.
- Если данных недостаточно для ценности — выставь 3 и укажи в note, что свидетельств недостаточно.
- НИЧЕГО кроме JSON.`;
}

// ==========================================================
// Нормализация и фолбэки
// ==========================================================

function clamp(n: any, lo: number, hi: number, def: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
function clamp15(n: any, def: 1 | 2 | 3 | 4 | 5 = 3): 1 | 2 | 3 | 4 | 5 {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  const r = Math.max(1, Math.min(5, Math.round(v))) as 1 | 2 | 3 | 4 | 5;
  return r;
}
function extractJson(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

const VSTATUSES: VerificationStatus[] = ["confirmed", "partial", "conflict", "not_checked"];
const CONSISTENCY = ["match", "partial", "mismatch"] as const;
const VALUE_KEYS: CulturalValueKey[] = ["responsibility", "partnership", "entrepreneurship"];
const VALUE_LABELS: Record<CulturalValueKey, string> = {
  responsibility: "Ответственность за результат",
  partnership: "Партнёрство",
  entrepreneurship: "Дух предпринимательства",
};

function normalizeVerification(v: any, etkAvailable: boolean): VerificationResult {
  const items: VerificationItem[] = Array.isArray(v?.items)
    ? v.items.slice(0, 20).map((it: any) => ({
        company: String(it?.company || "").slice(0, 200),
        position: it?.position ? String(it.position).slice(0, 200) : undefined,
        declared: String(it?.declared || "").slice(0, 300),
        etk: it?.etk ? String(it.etk).slice(0, 300) : undefined,
        status: VSTATUSES.includes(it?.status) ? it.status : "not_checked",
        note: it?.note ? String(it.note).slice(0, 500) : undefined,
      }))
    : [];

  const hasConflict = items.some((i) => i.status === "conflict");
  // Если ЭТК нет — принудительно all not_checked
  if (!etkAvailable) {
    for (const it of items) it.status = "not_checked";
  }

  let overall: VerificationStatus = VSTATUSES.includes(v?.status) ? v.status : "not_checked";
  if (!etkAvailable) overall = "not_checked";
  else if (hasConflict) overall = "conflict";
  else if (items.some((i) => i.status === "partial")) overall = "partial";
  else if (items.length && items.every((i) => i.status === "confirmed")) overall = "confirmed";

  return {
    status: overall,
    summary: String(v?.summary || "").slice(0, 600),
    items,
    blockingConflict: etkAvailable && hasConflict,
    etkAvailable,
  };
}

function normalizeMotivation(m: any, recruiterReason: SearchReason): MotivationAnalysis {
  return {
    score: clamp(m?.score, 0, 100, 50),
    summary: String(m?.summary || "").slice(0, 600),
    declaredReason: String(m?.declaredReason || "").slice(0, 400),
    recruiterReason,
    reasonConsistency: CONSISTENCY.includes(m?.reasonConsistency) ? m.reasonConsistency : "partial",
    redFlags: Array.isArray(m?.redFlags) ? m.redFlags.map(String).slice(0, 6) : [],
    greenFlags: Array.isArray(m?.greenFlags) ? m.greenFlags.map(String).slice(0, 6) : [],
    urgencyNote: m?.urgencyNote ? String(m.urgencyNote).slice(0, 400) : undefined,
  };
}

function normalizeCultural(c: any): CulturalFitV3 {
  const raw: any[] = Array.isArray(c?.values) ? c.values : [];
  const byKey = new Map<CulturalValueKey, any>();
  for (const v of raw) {
    if (VALUE_KEYS.includes(v?.key)) byKey.set(v.key, v);
  }
  const values: CulturalValueScore[] = VALUE_KEYS.map((k) => {
    const v = byKey.get(k) || {};
    return {
      key: k,
      label: VALUE_LABELS[k],
      score: clamp15(v?.score, 3),
      evidence: Array.isArray(v?.evidence) ? v.evidence.map(String).slice(0, 4) : [],
      note: v?.note ? String(v.note).slice(0, 300) : undefined,
    };
  });
  const total = values.reduce((s, v) => s + v.score, 0);
  return {
    values,
    totalScore: total,
    summary: String(c?.summary || "").slice(0, 600),
  };
}

function normalizeLoyalty(l: any): LoyaltyScore {
  const sH = clamp(l?.sHistory, 0, 100, 50);
  const sR = clamp(l?.sRecruiter, 0, 100, 50);
  const sL = clamp(l?.sLanguage, 0, 100, 50);
  const score = Math.round(0.4 * sH + 0.35 * sR + 0.25 * sL);
  return {
    score: Math.max(0, Math.min(100, score)),
    sHistory: sH,
    sRecruiter: sR,
    sLanguage: sL,
    summary: String(l?.summary || "").slice(0, 600),
    flags: Array.isArray(l?.flags) ? l.flags.map(String).slice(0, 6) : [],
  };
}

// ==========================================================
// Composite Score и матрица резолюций
// ==========================================================

export function computeCompositeScore(
  motivation: number, // 0..100
  culturalSum: number, // 3..15
  loyalty: number, // 0..100
): number {
  const cs =
    0.3 * (motivation / 100) +
    0.35 * (culturalSum / 15) +
    0.35 * (loyalty / 100);
  return Math.max(0, Math.min(100, Math.round(cs * 100)));
}

export function deriveResolution(
  compositeScore: number,
  verificationStatus: VerificationStatus,
  blockingConflict: boolean,
  etkAvailable: boolean,
  flags: {
    motivation: MotivationAnalysis;
    culturalFit: CulturalFitV3;
    loyalty: LoyaltyScore;
  },
): FinalResolution {
  const conditions: string[] = [];
  // Собираем типовые условия
  if (flags.motivation.redFlags.length) {
    conditions.push("Углубить вопросы о мотивации на следующем этапе интервью");
  }
  const weakValue = flags.culturalFit.values.find((v) => v.score <= 2);
  if (weakValue) {
    conditions.push(`Отработать слабую ценность: ${weakValue.label} (оценка ${weakValue.score}/5)`);
  }
  if (flags.loyalty.flags.length) {
    conditions.push("Провести reference-check по последним 2 работодателям");
  }

  // 1) Блокирующее расхождение → NOT_RECOMMENDED
  if (blockingConflict) {
    return {
      code: "NOT_RECOMMENDED",
      label: "❌ НЕ РЕКОМЕНДОВАН",
      compositeScore,
      reason: "Обнаружено блокирующее расхождение между резюме и ЭТК — данные кандидата не подтверждаются реестром.",
      conditions: [],
      blockingFactor: "🔴 Расхождение резюме × ЭТК",
    };
  }
  // 2) CS < 50 → NOT_RECOMMENDED
  if (compositeScore < 50) {
    return {
      code: "NOT_RECOMMENDED",
      label: "❌ НЕ РЕКОМЕНДОВАН",
      compositeScore,
      reason: `Композитный балл ${compositeScore} ниже минимального порога 50 — мотивация, культурное соответствие и лояльность в сумме не проходят.`,
      conditions: [],
      blockingFactor: `Composite Score = ${compositeScore} < 50`,
    };
  }
  // 3) CS ≥ 70 + not_checked → UNVERIFIED
  if (compositeScore >= 70 && verificationStatus === "not_checked") {
    return {
      code: "UNVERIFIED",
      label: "⚠️ РЕКОМЕНДОВАН (опыт не верифицирован)",
      compositeScore,
      reason: `Композитный балл ${compositeScore} высокий, но ЭТК не предоставлена — опыт работы не подтверждён реестром.`,
      conditions: [
        "Запросить у кандидата ЭТК / выписку из СФР перед оффером",
        ...conditions,
      ],
    };
  }
  // 4) CS ≥ 70 + confirmed/partial → RECOMMENDED
  if (
    compositeScore >= 70 &&
    (verificationStatus === "confirmed" || verificationStatus === "partial")
  ) {
    return {
      code: "RECOMMENDED",
      label: "✅ РЕКОМЕНДОВАН",
      compositeScore,
      reason: `Композитный балл ${compositeScore}, опыт ${
        verificationStatus === "confirmed" ? "подтверждён" : "в целом согласуется"
      } с ЭТК. Кандидат проходит по всем ключевым критериям.`,
      conditions,
    };
  }
  // 5) CS 50–69 → CONDITIONAL
  return {
    code: "CONDITIONAL",
    label: "⚠️ УСЛОВНО РЕКОМЕНДОВАН",
    compositeScore,
    reason: `Композитный балл ${compositeScore} в пограничной зоне 50–69 — есть сильные и слабые стороны. Требуется дополнительная верификация до оффера.`,
    conditions: conditions.length
      ? conditions
      : [
          "Провести дополнительное интервью по слабым зонам",
          "Запросить рекомендательные контакты с последних мест работы",
        ],
  };
}

// ==========================================================
// Основная функция анализа
// ==========================================================

export type PipelineAnalyzeInput = {
  resumeText: string;
  etk: EtkStructured;
  interviewText: string;
  referencesText: string;
  form: RecruiterForm;
};

export async function runPipelineAnalysis(
  input: PipelineAnalyzeInput,
): Promise<SingleStepReport> {
  const { resumeText, etk, interviewText, referencesText, form } = input;
  const etkAvailable = etk.source !== "none" && etk.records.length > 0;

  const userPrompt = buildAnalyzePrompt(
    resumeText,
    etk,
    interviewText,
    referencesText,
    form,
  );

  let parsed: any = null;
  let fallbackNote: string | undefined;

  try {
    const raw = await yandexComplete(
      [
        { role: "system", text: SYSTEM_PROMPT },
        { role: "user", text: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 8000 },
    );
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (e) {
      fallbackNote = `Не удалось распарсить JSON от Yandex GPT — использованы значения по умолчанию. Фрагмент ответа: ${extractJson(raw).slice(0, 240)}`;
      parsed = {};
    }
  } catch (e: any) {
    fallbackNote = `Ошибка обращения к Yandex GPT: ${e?.message || e}. Использованы значения по умолчанию.`;
    parsed = {};
  }

  const candidateName =
    typeof parsed?.candidateName === "string" && parsed.candidateName.trim().length > 0
      ? parsed.candidateName.trim().slice(0, 200)
      : null;

  const verification = normalizeVerification(parsed?.verification, etkAvailable);
  const motivation = normalizeMotivation(parsed?.motivation, form.searchReason);
  const culturalFit = normalizeCultural(parsed?.culturalFit);
  const loyalty = normalizeLoyalty(parsed?.loyalty);

  const compositeScore = computeCompositeScore(
    motivation.score,
    culturalFit.totalScore,
    loyalty.score,
  );

  const resolution = deriveResolution(
    compositeScore,
    verification.status,
    verification.blockingConflict,
    etkAvailable,
    { motivation, culturalFit, loyalty },
  );

  return {
    version: "3.0",
    candidateName,
    createdAt: Date.now(),
    recruiterForm: form,
    etk,
    verification,
    motivation,
    culturalFit,
    loyalty,
    compositeScore,
    resolution,
    rawAnalysisNote: fallbackNote,
  };
}
