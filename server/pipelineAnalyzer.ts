import { yandexComplete } from "./yandex";
import { buildTimeline, formatMonths } from "./timeline";
import { runLinguisticAudit } from "./linguistics";
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
  ExecutiveSummary,
  KeyFinding,
  ConsistencyCheck,
  TimelineMetrics,
  LinguisticAudit,
} from "@shared/schema";

// ==========================================================
// Методология и системный промпт
// ==========================================================

const SYSTEM_PROMPT = `Ты — единый AI-аналитик Службы Безопасности и HR. Твоя задача — за один проход провести четыре параллельных модуля анализа кандидата (верификация опыта, мотивация, культурное соответствие, индекс лояльности) и собрать СОГЛАСОВАННУЮ итоговую сводку для руководителя.

⚠️ КРИТИЧЕСКИ ВАЖНО — ФОРМАТ ОТВЕТА:
- Ты ОБЯЗАН вернуть JSON строго по предоставленной схеме.
- НЕ ПРИДУМЫВАЙ свои поля и структуры. НЕ ПЕРЕИМЕНОВЫВАЙ ключи.
- Используй ТОЛЬКО те ключи, которые указаны в секции «ТРЕБУЕМЫЙ JSON». Лишние ключи будут отброшены.
- Обязательные корневые ключи ровно эти (и никаких других): candidateName, verification, motivation, culturalFit, loyalty, executiveSummary.
- Запрещено заворачивать ответ в markdown-блоки (три обратных апострофа + json) или любые другие markdown-фрагменты. Первый символ ответа — "{", последний — "}".
- Запрещены любые комментарии, пояснения, префиксы, суффиксы и «Я проанализировал...» до или после JSON.

ГЛАВНЫЕ ПРИНЦИПЫ:
1) ОБОСНОВАННОСТЬ: каждая оценка опирается на дословные цитаты или точно сформулированные наблюдения. Не выдумывай факты, которых нет во входных данных.
2) PII-FREE: не используй ФИО (кроме поля candidateName), точную дату рождения, паспорт, СНИЛС, ИНН, полный телефон. Допустимы косвенные маркеры (домен email, регион).
3) РАБОТА С ДАТАМИ — АБСОЛЮТНЫЙ ЗАПРЕТ НА ФАНТОМНЫЕ НЕСТЫКОВКИ:
   • Даты в ЭТК предоставлены в формате ISO (YYYY-MM-DD). Длительность каждой работы уже посчитана сервером и передана тебе в поле «продолжительность» — НЕ пересчитывай её сам, НЕ сравнивай со своей оценкой и НЕ спорь с ней.
   • Текущая дата ТОЛЬКО та, что указана в блоке [ТЕКУЩАЯ ДАТА]. Дата обновления резюме (если встречается в тексте) — это НЕ «сегодня», это просто дата документа. Для расчёта «по настоящее время» используй ТОЛЬКО [ТЕКУЩАЯ ДАТА].
   • При сопоставлении периодов резюме × ЭТК допустимо расхождение ДО 90 дней (3 месяца) включительно — это «partial», а не «conflict».
   • «Конфликт» — только если: (а) компании из резюме НЕТ в ЭТК, или (б) период отличается БОЛЕЕ чем на 3 месяца, или (в) явное противоречие в должности.
   • НЕ трактуй «март 2020» и «2020-03-15» как разные даты — это одно и то же.
   • 🚫 ПОЛНЫЙ И БЕЗУСЛОВНЫЙ ЗАПРЕТ на следующие формулировки, выводы и риск-сигналы (они НИКОГДА не являются нестыковкой, конфликтом, фальсификацией, искажением фактов или риском):
     – «Работа в будущем», «работает в будущем», «будущее время», «работа после даты резюме».
     – «Фантомный опыт», «фантомные даты», «фантомный период».
     – «Хронологическое противоречие» или «искажение фактов» на основании того, что декларированный в резюме срок («2 года», «3 года») НЕ равен точному количеству месяцев до даты обновления резюме. Срок «X лет» в резюме считается ОТ даты начала ДО [ТЕКУЩАЯ ДАТА], а НЕ до даты обновления резюме.
     – «Период составляет 2 года, хотя прошло менее 24 месяцев» — это НЕ противоречие. «2 года» — это разговорное округление, которое кандидат считает от сегодняшнего дня или в уме. НЕ сравнивай цифру в скобках рядом с периодом с собственным расчётом количества месяцев.
     – Округления «23 месяца ≈ 2 года», «11 месяцев ≈ 1 год», «3 года 1 месяц ≈ 3 года» — это нормально. НЕ упоминай их как проблему.
     – Расхождение статуса «по настоящее время» / endDate=null между резюме и ЭТК, если в обоих записях период открыт.
     – Сам факт endDate=null, «открытая запись», «работа продолжается».
   • ПРАВИЛО О СРОКЕ В РЕЗЮМЕ: если кандидат написал «Период: апрель 2024 — настоящее время (2 года)» — это корректно всегда, когда с даты начала прошло от ~18 до ~30 месяцев. НЕ пиши про «искажение фактов», «расхождение срока», «менее 24 месяцев».
   • Если у тебя возникает мысль сравнить дату резюме с датой работы — ОСТАНОВИСЬ. Такой проверки в этом продукте НЕТ.
   • Расчёт относительно текущей даты уже выполнен сервером. Используй [ТЕКУЩАЯ ДАТА], не выдумывай свою.
   • ⚠️ Любая строка в поле note/summary/redFlags/keyFindings, содержащая слова «фантом», «в будущем», «искажение фактов», «менее 24 месяцев», «хронологическое противоречие», «дата обновления резюме» в контексте риска — будет УДАЛЕНА программно, а твой ответ помечен как некорректный. Не пиши их.
4) БЛОКИРУЮЩЕЕ РАСХОЖДЕНИЕ: status="conflict" (🔴) ставится ТОЛЬКО при реальном противоречии данных, не при отсутствии записи в ЭТК.
4а) ПРОВЕРКА КОМПАНИЙ — АБСОЛЮТНЫЙ ЗАПРЕТ: у тебя НЕТ доступа к интернету, единым реестрам (ЕГРЮЛ, rusprofile), сайтам компаний и СМИ.
   ЗАПРЕЩЕНО утверждать о компании: «не существует», «не зарегистрирована», «не работает», «ликвидирована», «фиктивная», «сайт не открывается», «домен не активен», «компания-пустышка», «ИНН не найден».
   Единственный допустимый статус при отсутствии данных о компании: «Информация не найдена» — с рекомендацией рекрутеру проверить самостоятельно. Такие утверждения ВСЕГДА удаляются программно.
5) КАЛИБРОВКА ЦЕННОСТЕЙ (1–5): 1 — явные антиподы; 2 — слабо выражено; 3 — нейтрально/нет данных; 4 — хорошо видно; 5 — ярко и последовательно. Если данных нет — ставь 3 и явно укажи это в note.
6) ТРИ ЦЕННОСТИ V3.0 (только эти, именно с этими key): responsibility, partnership, entrepreneurship.
7) СОГЛАСОВАННОСТЬ ВЫВОДОВ — обязательна:
   • Если у кандидата redFlags по мотивации, score мотивации НЕ может быть >70.
   • Если attitudeToFormer="hostile" или "critical", оценка «Партнёрство» НЕ может быть выше 3.
   • Если sHistory < 40 (короткие контракты), в loyalty.flags обязан быть маркер о job-hopping.
   • Если sLanguage > 70, в evidence ценностей должны быть позитивные цитаты, согласованные с языком.
   • Executive summary должен ОДНОЗНАЧНО следовать из модулей: не утверждай в headline «низкий риск», если у любого модуля score < 50.`;

// ==========================================================
// Лейблы для русского промпта
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

// ==========================================================
// Подготовка входных блоков для промпта (с уже посчитанными датами)
// ==========================================================

function buildEtkBlock(etk: EtkStructured): string {
  if (!etk.records.length) {
    return etk.source === "none"
      ? "— ЭТК не предоставлена. Все статусы верификации = not_checked, blockingConflict=false, etkAvailable=false. —"
      : "— ЭТК прислана, но записи не извлечены. —";
  }
  return etk.records
    .map((r, i) => {
      const period = `${r.startDate ?? "?"} — ${r.endDate ?? "по настоящее время"}`;
      const pos = r.position ? `, ${r.position}` : "";
      const reason = r.reason ? `, основание: ${r.reason}` : "";
      return `  ${i + 1}. ${r.company}${pos} [${period}]${reason}`;
    })
    .join("\n");
}

function buildTimelineBlock(timeline: TimelineMetrics | null): string {
  if (!timeline || !timeline.spans.length) {
    return "— Хронология опыта не извлечена автоматически. Опирайся на тексты резюме/ЭТК. —";
  }
  const header = `Источник: ${timeline.source.toUpperCase()}; всего позиций: ${timeline.jobsCount}; общий стаж: ${formatMonths(timeline.totalMonths)}; средняя длительность: ${formatMonths(timeline.avgMonths)}; коротких контрактов <12 мес: ${timeline.shortStintsCount}; суммарные пробелы между работами: ${formatMonths(timeline.gapsMonths)}.`;
  const lines = timeline.spans
    .map((s, i) => {
      const period = `${s.startISO ?? "?"} — ${s.endISO ?? "по настоящее время"}`;
      const dur = s.months !== null ? formatMonths(s.months) : "длительность не определена";
      const pos = s.position ? `, ${s.position}` : "";
      return `  ${i + 1}. ${s.company}${pos} [${period}] · продолжительность: ${dur}`;
    })
    .join("\n");
  return `${header}\n${lines}`;
}

function buildLinguisticBlock(audit: LinguisticAudit): string {
  const l = audit.liwc;
  const rm = audit.realityMonitoring;
  const cl = audit.cognitiveLoad;
  const ac = audit.acid;
  const rmBlocksTxt = rm.blocks.map((b) =>
    `    • ${b.label}: сенсорика=${b.sensoryDetails}, пространство=${b.spatialContext}, время=${b.temporalContext}, аффект=${b.affect}, логика=${b.logicalCoherence}, self-ref=${b.selfReference} → сумма ${b.totalScore}/12 (${b.verdict})`
  ).join("\n") || "    — блоки не выделены —";
  const acidBlocksTxt = ac.blocks.map((b) =>
    `    • ${b.label}: honest-score ${b.honestScore}/10 → ${b.verdict}`
  ).join("\n") || "    — блоки не выделены —";
  return `[ЛИНГВИСТИЧЕСКИЙ АУДИТ — уже посчитано детерминированно, НЕ пересчитывай цифры]
LIWC (на 100 токенов): я=${l.rates.firstPersonSingular}%, мы=${l.rates.firstPersonPlural}%, 3-л=${l.rates.thirdPerson}%, нег.эмоц=${l.rates.negativeEmotions}%, поз.эмоц=${l.rates.positiveEmotions}%, исключители=${l.rates.exclusives}%, функц.слова=${l.rates.functionWords}%, когн.механ=${l.rates.cognitiveMechanisms}%.
LIWC-маркеры: iDominant=${l.markers.iDominant}, weDominant=${l.markers.weDominant}, blamesOthers=${l.markers.blamesOthers}, emotionalNegative=${l.markers.emotionalNegative}, highExclusives=${l.markers.highExclusives}, lowCognitiveComplexity=${l.markers.lowCognitiveComplexity}. Риск LIWC: ${l.riskScore}/100.
Reality Monitoring (средний балл ${rm.averageScore}/12, вердикт ${rm.verdict}):
${rmBlocksTxt}
Cognitive Load: хеджирование=${cl.hedgingCount}, противоречий=${cl.contradictionsCount}, структурная симметрия=${cl.structuralSymmetry}%, повторяющихся шаблонов=${cl.repetitivePatterns.length}. Риск CL: ${cl.riskScore}/100.
ACID (overallVerdict: ${ac.overallVerdict}):
${acidBlocksTxt}

Итоговый лингвистический риск: ${audit.linguisticRisk}/100, вердикт: ${audit.verdict}.`;
}

function buildAnalyzePrompt(
  resumeText: string,
  etk: EtkStructured,
  interviewText: string,
  referencesText: string,
  form: RecruiterForm,
  timeline: TimelineMetrics | null,
  linguistic: LinguisticAudit,
): string {
  const nowIso = new Date().toISOString().slice(0, 10);
  return `Проведи ЕДИНЫЙ анализ кандидата по 4 модулям + собери executive summary. Верни строго JSON по схеме.

==============================
ВХОДНЫЕ ДАННЫЕ
==============================

[ТЕКУЩАЯ ДАТА] ${nowIso} — это «сегодня». Все открытые периоды (endDate=null, «по настоящее время») идут ДО этой даты. Дата обновления резюме может быть РАНЬШЕ текущей — это нормально, это не «работа в будущем».

[РЕЗЮМЕ — текст]
"""
${resumeText.slice(0, 10000)}
"""

[ЭТК / СФР — структурированные записи]
${buildEtkBlock(etk)}

[ХРОНОЛОГИЯ ОПЫТА — уже посчитана автоматически, используй эти данные]
${buildTimelineBlock(timeline)}

[ЗАМЕТКИ ИНТЕРВЬЮ]
"""
${(interviewText || "— не предоставлено —").slice(0, 4000)}
"""

[РЕФЕРЕНСЫ / РЕКОМЕНДАЦИИ]
"""
${(referencesText || "— не предоставлено —").slice(0, 3000)}
"""

${buildLinguisticBlock(linguistic)}

[ФОРМА РЕКРУТЕРА]
• Причина поиска работы (по словам рекрутера): ${reasonLabel(form.searchReason)}
• Отношение к бывшим работодателям: ${attitudeLabel(form.attitudeToFormer)}
• Временной прессинг: ${pressureLabel(form.timePressure)}
• Рекомендатели: ${refLabel(form.references)}
• Заметка рекрутера: «${(form.note || "").slice(0, 300)}»

==============================
МОДУЛЬ 1 — ВЕРИФИКАЦИЯ ОПЫТА
==============================
Сопоставь каждое место работы из РЕЗЮМЕ с записями ЭТК.
• "confirmed" — компания и период совпадают (расхождение ≤ 30 дней).
• "partial" — компания совпадает, но расхождение в датах 31–90 дней ИЛИ различие в должности.
• "conflict" — компания отсутствует в ЭТК ИЛИ расхождение > 90 дней ИЛИ явное противоречие.
• "not_checked" — ЭТК отсутствует.
Если ЭТК отсутствует — ВСЕ статусы должны быть "not_checked", overall "not_checked", blockingConflict=false, etkAvailable=false.
В поле declared указывай период в формате «YYYY-MM — YYYY-MM» (обе даты — ISO-месяцы). Для открытого периода используй «YYYY-MM — present». Не используй текстовые форматы типа «март 2020» или «наст.время» — только ISO.
ВАЖНО: расхождение статуса «открыт» между резюме и ЭТК (в обоих источниках нет endDate) — это НЕ partial и НЕ conflict, это "confirmed".

==============================
МОДУЛЬ 2 — АНАЛИЗ МОТИВАЦИИ
==============================
Оцени здоровье мотивации (0–100). Сопоставь декларируемую кандидатом причину поиска (declaredReason) с тем, что отметил рекрутер (recruiterReason="${form.searchReason}").
• reasonConsistency: "match" если совпадают, "partial" если близки/смежны, "mismatch" если противоречат.
• ВАЖНО: если рекрутер отметил "${form.searchReason === "other" ? "other" : form.searchReason}" = "other" (другое/не указано), всегда ставь reasonConsistency="partial" и поясни в summary.
• Найди признаки нездоровой мотивации: «работодатель-тиран», «все вокруг виноваты», обвинения, выгорание с перекладыванием ответственности, оверэмплоймент.
• urgencyNote: краткая интерпретация прессинга. Если timePressure="no_pressure" — пиши: «давления нет», и НЕ выдумывай рисков срочности. Если "not_specified" — пиши: «не обсуждалось».
• ОГРАНИЧЕНИЕ СОГЛАСОВАННОСТИ: если в redFlags есть хоть один элемент — score ≤ 70. Если redFlags пуст и greenFlags ≥ 2 — score ≥ 60.

==============================
МОДУЛЬ 3 — CULTURAL FIT V3 (3 ЦЕННОСТИ)
==============================
Оцени 1–5 по каждой ценности:
• responsibility — «Ответственность за результат»: берёт ответственность, доводит до конца, не перекладывает вину, думает о результате для бизнеса.
• partnership — «Партнёрство»: командность, признание чужого вклада, говорит «мы», помогает, договаривается, уважает работодателя.
• entrepreneurship — «Дух предпринимательства»: инициатива, работа в неопределённости, готовность запускать новое, проактивность.
ОГРАНИЧЕНИЯ СОГЛАСОВАННОСТИ:
• Если attitudeToFormer="hostile" или "critical" — partnership НЕ может быть выше 3.
• Если есть короткие контракты (<12 мес) и кандидат уходил по «conflict»/«burnout» — responsibility НЕ может быть выше 3.
• Если данных по ценности недостаточно — ставь 3 и в note напиши: «свидетельств недостаточно».
В evidence — 1–3 дословные цитаты с указанием источника в скобках: «...текст...» (резюме / интервью / референс).

==============================
МОДУЛЬ 4 — ИНДЕКС ЛОЯЛЬНОСТИ И СТАБИЛЬНОСТИ (ILS)
==============================
sHistory (0–100) — стабильность трудовой истории. Опирайся ИСКЛЮЧИТЕЛЬНО на блок [ХРОНОЛОГИЯ ОПЫТА]. Ориентир:
   • средняя длительность ≥ 36 мес и нет коротких контрактов → 80–95
   • средняя 24–35 мес → 60–79
   • средняя 12–23 мес или 1–2 коротких контракта → 40–59
   • средняя <12 мес или ≥3 коротких контрактов → 0–39
sRecruiter (0–100) — на основе формы рекрутера: отношение к бывшим, рекомендатели, временной прессинг, причина поиска. Ориентир:
   • positive + есть рекомендатели + нет прессинга → 80–95
   • neutral + рекомендатели обсуждались → 60–79
   • critical → 40–59; hostile → 0–39
sLanguage (0–100) — по языку резюме/интервью/референсов:
   • конструктивный язык, благодарность бывшим, «мы»/«команда» → 80–95
   • нейтральный, без эмоций → 60–79
   • жалобы, «я vs они», обвинения → 30–59
   • язык «волков»/оверэмплоймента, агрессия → 0–29
flags — 0–5 коротких маркеров рисков лояльности (например: «частая смена работодателей», «обвинение бывших», «оверэмплоймент»).
СОГЛАСОВАННОСТЬ: если sHistory < 40 — обязан быть flag о job-hopping. Если sRecruiter < 40 — обязан быть flag об отношениях с бывшими.

==============================
МОДУЛЬ 5 — ЛИНГВИСТИЧЕСКИЙ АУДИТ (ИНТЕРПРЕТАЦИЯ, НЕ ПЕРЕСЧЁТ)
==============================
Цифры уже посчитаны в блоке [ЛИНГВИСТИЧЕСКИЙ АУДИТ]. Твоя задача — дать КАЧЕСТВЕННУЮ интерпретацию по каждой из 4 методик в 1–2 предложения. НЕ пересчитывай проценты, вердикты и счётчики. Используй их как вход для психологической оценки:
• liwcSummary — психолингвистический профиль (1–2 предложения): кто говорит «я» vs «мы», есть ли признаки обвинения, абстрактности или обмана (по Pennebaker/Newman).
• rmSummary — Reality Monitoring (1–2 предложения): насколько опыт/достижения/проекты выглядят как прожитый опыт в противовес конструированию.
• clSummary — Cognitive Load (1–2 предложения): шаблонность описаний, хеджирование, противоречия.
• acidSummary — ACID (1–2 предложения): какие блоки похожи на честный нарратив, а какие на сконструированный.
• linguisticHeadline — 1 предложение для сводки руководителю.
• linguisticOverallSummary — 2–3 предложения: общий лингвистический профиль.

==============================
EXECUTIVE SUMMARY (СВОДКА ДЛЯ РУКОВОДИТЕЛЯ)
==============================
Собери непротиворечивую сводку, которая ОДНОЗНАЧНО следует из модулей выше.
• headline (1 предложение, до 150 символов): итог одной строкой («Сильный кандидат с риском по X», «Не рекомендован из-за Y», «Условно рекомендован — нужно проверить Z»).
• paragraph (2–3 предложения): расширенный итог, упоминающий главный плюс, главный риск и рекомендуемое действие.
• keyFindings (3–6 элементов): {type:"strength|risk|neutral", module:"verification|motivation|culturalFit|loyalty", text:"короткое наблюдение"}. Минимум 1 strength (если есть) и 1 risk (если есть).
• consistency: {status:"ok|warning|conflict", notes:["..."]} — твоя самооценка согласованности модулей. Если ты дал высокий культурный score при враждебном отношении к бывшим — это conflict.

==============================
ТРЕБУЕМЫЙ JSON (строго эта схема)
==============================
{
  "candidateName": "ФИО или null",
  "verification": {
    "status": "confirmed|partial|conflict|not_checked",
    "summary": "1-2 предложения",
    "blockingConflict": false,
    "etkAvailable": ${etk.source !== "none" && etk.records.length > 0 ? "true" : "false"},
    "items": [
      { "company": "...", "position": "...", "declared": "YYYY-MM — YYYY-MM или YYYY-MM — present", "etk": "период по ЭТК или пусто", "status": "confirmed|partial|conflict|not_checked", "note": "краткий комментарий" }
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
      { "key": "responsibility", "label": "Ответственность за результат", "score": 3, "evidence": ["цитата (резюме)"], "note": "опц." },
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
  },
  "executiveSummary": {
    "headline": "1 предложение",
    "paragraph": "2-3 предложения",
    "keyFindings": [
      {"type": "strength|risk|neutral", "module": "verification|motivation|culturalFit|loyalty", "text": "..."}
    ],
    "consistency": {"status": "ok|warning|conflict", "notes": ["..."]}
  },
  "linguistic": {
    "liwcSummary": "1-2 предложения",
    "rmSummary": "1-2 предложения",
    "clSummary": "1-2 предложения",
    "acidSummary": "1-2 предложения",
    "linguisticHeadline": "1 предложение",
    "linguisticOverallSummary": "2-3 предложения"
  }
}

ПРАВИЛА:
- Цитаты в evidence — дословно из текстов. Не придумывай.
- Если данных недостаточно — ставь 3 и пиши «свидетельств недостаточно».
- НИЧЕГО кроме JSON в ответе.

==============================
ПРИМЕР ПРАВИЛЬНОГО ОТВЕТА (для другого кандидата, только для иллюстрации СТРУКТУРЫ)
==============================
{"candidateName":"Иванов И.И.","verification":{"status":"partial","summary":"Опыт подтверждён частично: расхождение в должности.","blockingConflict":false,"etkAvailable":true,"items":[{"company":"ООО Пример","position":"Senior","declared":"2022-01 — present","etk":"2022-01 — present","status":"partial","note":"В ЭТК должность ‘Разработчик’, в резюме ‘Senior’."}]},"motivation":{"score":55,"summary":"Мотивация смешанная: есть рост, но и прессинг оффера.","declaredReason":"рост","recruiterReason":"growth","reasonConsistency":"match","redFlags":["прессинг оффера"],"greenFlags":["позитив о команде"],"urgencyNote":"есть оффер"},"culturalFit":{"summary":"Средний фит.","values":[{"key":"responsibility","label":"Ответственность за результат","score":4,"evidence":["довёл проект до прода (резюме)"],"note":""},{"key":"partnership","label":"Партнёрство","score":4,"evidence":["говорит «мы» о команде (резюме)"],"note":""},{"key":"entrepreneurship","label":"Дух предпринимательства","score":3,"evidence":[],"note":"свидетельств недостаточно"}]},"loyalty":{"sHistory":70,"sRecruiter":65,"sLanguage":75,"summary":"Стабильный кандидат.","flags":[]},"executiveSummary":{"headline":"Условно рекомендован — проверить должность.","paragraph":"Хорошая культурная совместимость и стабильность. Расхождение в должности требует верификации. Рекомендуется уточнить грейд на интервью.","keyFindings":[{"type":"strength","module":"culturalFit","text":"Командность и ответственность"},{"type":"risk","module":"verification","text":"Расхождение должности Senior vs Разработчик"}],"consistency":{"status":"ok","notes":[]}}}

⚠️ НИЖЕ ТВОЙ ОТВЕТ ДОЛЖЕН ИМЕТЬ ТОЧНО ТАКУЮ ЖЕ СТРУКТУРУ КЛЮЧЕЙ (содержание иное — на основе данных выше).`;
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

/**
 * Попытка ремонта обрезанного JSON: балансируем скобки/кавычки и закрываем.
 * Это нужно, когда Qwen3 упирается в max_tokens и ответ обрывается посреди строки.
 */
function repairJson(s: string): string {
  let str = s.trim();
  // Убираем markdown-обложку если есть
  const fence = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) str = fence[1].trim();
  const start = str.indexOf("{");
  if (start < 0) return s;
  str = str.slice(start);
  // Проходим по строке, отслеживая скобки/скобки массивов и строки
  let depth = 0;
  let inStr = false;
  let escape = false;
  let lastValidEnd = -1;
  const stack: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") { stack.push(c); depth++; }
    else if (c === "}" || c === "]") { stack.pop(); depth--; if (depth === 0) lastValidEnd = i; }
  }
  if (depth === 0 && lastValidEnd >= 0) return str.slice(0, lastValidEnd + 1);
  // Незакрыто. Докручиваем.
  let repaired = str;
  // Закрываем незакрытую строку
  if (inStr) repaired += '"';
  // Обрезаем трейлинг запятую перед дозакрыванием
  repaired = repaired.replace(/,(\s*)$/, "$1");
  // Дозакрываем скобки в обратном порядке
  while (stack.length > 0) {
    const open = stack.pop();
    repaired += open === "{" ? "}" : "]";
  }
  return repaired;
}

// =====================================================================
// Фильтр фантомных формулировок (даты/округления/резюме-в-будущем)
// Это детерминированная страховка на случай, если LLM всё же выдаст запрещённые фразы.
// =====================================================================
export const PHANTOM_PATTERNS: RegExp[] = [
  /фантомные?\s*(?:даты|период|опыт)/i,
  /работа(?:ет)?\s+в\s+будущем/i,
  /будущее?\s+время/i,
  /в\s+будущем/i,
  /на\s+\d+\s+(?:год|года|лет|месяц)\w*\s+в\s+будущ/i,
  /начинает(?:ся)?\s+в\s+будущ/i,
  /работа\s+после\s+даты\s+резюме/i,
  /менее\s+24\s+месяц/i,
  /меньше\s+24\s+месяц/i,
  /хронологическое?\s+противоречи/i,
  /временн(?:о́)?е?\s+противоречи/i,
  /аномал\w+\s+хронолог/i,
  /искажение?\s+фактов/i,
  /фальсификация\s+хронолог/i,
  /указывающ\w+\s+на\s+фальсификаци/i,
  /округление?\s+вверх/i,
  /близком\s+к\s+порогу/i,
  /дата\s+обновления\s+резюме/i,
  /обновлено?\s+\d+\s+\w+\s+20\d{2}/i,
  /после\s+обновления\s+резюме/i,
  /прошло\s+менее\s+\d+\s+месяц/i,
  /23\s+месяц\w*\s+представлен/i,
  /телепорт\w*/i,
  /текущий\s+опыт\s+\d+\s+(?:год|лет)\w*\s+в\s+будущ/i,
  /что\s+делает\s+текущий\s+опыт/i,
  /по\s+настоящее\s+время\s*\([^)]*\)\s*.{0,40}\s+будущ/i,
  // Фантомные утверждения о компаниях — у LLM нет доступа к реестрам/сайтам
  /компан[ияий]{1,3}[^.!?\n]{0,80}?\s+не\s+существу/iu,
  /компан[ияий]{1,3}[^.!?\n]{0,80}?\s+не\s+зарегистриров/iu,
  /компан[ияий]{1,3}[^.!?\n]{0,80}?\s+ликвидиров/iu,
  /компан[ияий]{1,3}[^.!?\n]{0,80}?\s+не\s+работает/iu,
  /ооо\s+[^.!?\n]{0,80}?\s+ликвидиров/iu,
  /ооо\s+[^.!?\n]{0,80}?\s+не\s+существу/iu,
  /компан[ияий]{1,3}[-\s—]+пустышк/iu,
  /фиктивная?\s+компан/iu,
  /сайт[^!?\n]{0,80}не\s+открывается/iu,
  /домен[^!?\n]{0,60}не\s+актив/iu,
  /ИНН[^!?\n]{0,60}не\s+найден/iu,
  /не\s+найден\w*\s+в\s+ЕГРЮЛ/iu,
  /отсутствует\s+в\s+ЕГРЮЛ/iu,
  /(?:компан[ияий]{1,3}|ооо|организаци)[^!?\n]{0,80}не\s+найдена?\s+в\s+ЕГРЮЛ/iu,
  /организаци[яюи]\s+не\s+зарегистриров/iu,
];

/** Возвращает true, если строка содержит фантомные формулировки. */
export function isPhantom(text: string): boolean {
  if (!text) return false;
  return PHANTOM_PATTERNS.some((re) => re.test(text));
}

/** Удаляет фразы/предложения с фантомными упоминаниями из текста, сохраняя остальное. */
export function stripPhantomText(text: string): string {
  if (!text) return text;
  const parts = text.split(/(?<=[.!?—])\s+/);
  const clean = parts.filter((p) => !isPhantom(p));
  const result = clean.join(" ").trim();
  // Если весь текст был фантомным — вернём пустую строку
  return result.length > 0 ? result : "";
}

/** Фильтрует массив строк от фантомных. */
export function stripPhantomArray(arr: string[]): string[] {
  return arr.map(stripPhantomText).filter((s) => s.length > 0);
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
    ? v.items.slice(0, 20).map((it: any) => {
        let status: VerificationStatus = VSTATUSES.includes(it?.status) ? it.status : "not_checked";
        let note = it?.note ? String(it.note).slice(0, 500) : undefined;
        // Если note содержит фантомные обоснования — чистим и доводим статус до confirmed
        if (note && isPhantom(note)) {
          note = stripPhantomText(note);
          if (status === "conflict" || status === "partial") {
            status = "confirmed";
          }
          if (!note) note = "Опыт подтверждён ЭТК.";
        }
        return {
          company: String(it?.company || "").slice(0, 200),
          position: it?.position ? String(it.position).slice(0, 200) : undefined,
          declared: String(it?.declared || "").slice(0, 300),
          etk: it?.etk ? String(it.etk).slice(0, 300) : undefined,
          status,
          note,
        };
      })
    : [];

  // Если ЭТК нет — принудительно all not_checked
  if (!etkAvailable) {
    for (const it of items) it.status = "not_checked";
  }
  const hasConflict = etkAvailable && items.some((i) => i.status === "conflict");

  let overall: VerificationStatus = VSTATUSES.includes(v?.status) ? v.status : "not_checked";
  if (!etkAvailable) overall = "not_checked";
  else if (hasConflict) overall = "conflict";
  else if (items.some((i) => i.status === "partial")) overall = "partial";
  else if (items.length && items.every((i) => i.status === "confirmed")) overall = "confirmed";

  let summary = String(v?.summary || "").slice(0, 600);
  if (isPhantom(summary)) summary = stripPhantomText(summary);

  return {
    status: overall,
    summary,
    items,
    blockingConflict: hasConflict,
    etkAvailable,
  };
}

function normalizeMotivation(
  m: any,
  recruiterReason: SearchReason,
  timePressure: TimePressure,
): MotivationAnalysis {
  let score = clamp(m?.score, 0, 100, 50);
  // Фильтруем фантомные red flags по датам/округлениям
  const redFlagsRaw = Array.isArray(m?.redFlags) ? m.redFlags.map(String).slice(0, 6) : [];
  const redFlags = stripPhantomArray(redFlagsRaw).slice(0, 6);
  const greenFlagsRaw = Array.isArray(m?.greenFlags) ? m.greenFlags.map(String).slice(0, 6) : [];
  const greenFlags = stripPhantomArray(greenFlagsRaw).slice(0, 6);

  // Жёсткое правило: red flags → score ≤ 70
  if (redFlags.length > 0 && score > 70) score = 70;

  // reasonConsistency: при "other" не может быть match
  let reasonConsistency = CONSISTENCY.includes(m?.reasonConsistency) ? m.reasonConsistency : "partial";
  if (recruiterReason === "other" && reasonConsistency === "match") {
    reasonConsistency = "partial";
  }

  // urgencyNote: согласованность с timePressure
  let urgencyNote = m?.urgencyNote ? String(m.urgencyNote).slice(0, 400) : undefined;
  if (timePressure === "no_pressure") {
    urgencyNote = "Давления по срокам нет — кандидат не торопит решение.";
  } else if (timePressure === "not_specified" && !urgencyNote) {
    urgencyNote = "Временной прессинг не обсуждался.";
  }

  let mSummary = String(m?.summary || "").slice(0, 600);
  if (isPhantom(mSummary)) mSummary = stripPhantomText(mSummary);

  return {
    score,
    summary: mSummary,
    declaredReason: String(m?.declaredReason || "").slice(0, 400),
    recruiterReason,
    reasonConsistency,
    redFlags,
    greenFlags,
    urgencyNote,
  };
}

function normalizeCultural(c: any, attitudeToFormer: AttitudeToFormer): CulturalFitV3 {
  const raw: any[] = Array.isArray(c?.values) ? c.values : [];
  const byKey = new Map<CulturalValueKey, any>();
  for (const v of raw) {
    if (VALUE_KEYS.includes(v?.key)) byKey.set(v.key, v);
  }
  const values: CulturalValueScore[] = VALUE_KEYS.map((k) => {
    const v = byKey.get(k) || {};
    let score = clamp15(v?.score, 3);
    // Жёсткое правило: hostile/critical → partnership ≤ 3
    if (k === "partnership" && (attitudeToFormer === "hostile" || attitudeToFormer === "critical") && score > 3) {
      score = 3;
    }
    return {
      key: k,
      label: VALUE_LABELS[k],
      score,
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

function normalizeLoyalty(l: any, timeline: TimelineMetrics | null): LoyaltyScore {
  let sH = clamp(l?.sHistory, 0, 100, 50);
  const sR = clamp(l?.sRecruiter, 0, 100, 50);
  const sL = clamp(l?.sLanguage, 0, 100, 50);

  // Если есть локальная хронология — корректируем sHistory по объективным данным
  if (timeline && timeline.spans.length >= 2) {
    const avg = timeline.avgMonths;
    let calculated: number;
    if (avg >= 36 && timeline.shortStintsCount === 0) calculated = 88;
    else if (avg >= 24) calculated = 70;
    else if (avg >= 12 || timeline.shortStintsCount <= 2) calculated = 50;
    else calculated = 30;
    // Берём среднее с моделью, чтобы не было резких расхождений
    sH = Math.round((sH + calculated) / 2);
  }

  const rawFlags: string[] = Array.isArray(l?.flags) ? l.flags.map(String).slice(0, 6) : [];
  const flags = stripPhantomArray(rawFlags);

  // Гарантируем флаги при низких баллах
  if (sH < 40 && !flags.some((f) => /смена|hopping|короткие|нестабильн/i.test(f))) {
    flags.unshift("Частая смена работодателей / короткие контракты");
  }

  const score = Math.round(0.4 * sH + 0.35 * sR + 0.25 * sL);
  return {
    score: Math.max(0, Math.min(100, score)),
    sHistory: sH,
    sRecruiter: sR,
    sLanguage: sL,
    summary: String(l?.summary || "").slice(0, 600),
    flags: flags.slice(0, 6),
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

function buildResolutionReason(
  compositeScore: number,
  verificationStatus: VerificationStatus,
  modules: { motivation: MotivationAnalysis; culturalFit: CulturalFitV3; loyalty: LoyaltyScore },
  blockingConflict: boolean,
): string {
  if (blockingConflict) {
    return "Резюме противоречит данным ЭТК — есть позиции, которых нет в реестре или периоды отличаются более чем на 90 дней. Это блокирует приём решения до выяснения.";
  }
  const parts: string[] = [];
  // Сильные стороны
  const strongs: string[] = [];
  if (modules.motivation.score >= 70) strongs.push("здоровая мотивация");
  if (modules.culturalFit.totalScore >= 12) strongs.push("высокое культурное соответствие");
  if (modules.loyalty.score >= 70) strongs.push("стабильность и лояльность");
  if (verificationStatus === "confirmed") strongs.push("опыт подтверждён ЭТК");
  // Слабые стороны
  const weaks: string[] = [];
  if (modules.motivation.score < 50) weaks.push("слабая мотивация");
  if (modules.culturalFit.totalScore <= 7) weaks.push("низкое культурное соответствие");
  if (modules.loyalty.score < 50) weaks.push("риски лояльности");
  if (verificationStatus === "conflict") weaks.push("расхождения с ЭТК");

  const strongPart = strongs.length ? `Сильные стороны: ${strongs.join(", ")}.` : "";
  const weakPart = weaks.length ? ` Зоны риска: ${weaks.join(", ")}.` : "";
  const csPart = `Composite Score = ${compositeScore} из 100.`;
  return `${csPart}${strongPart ? " " + strongPart : ""}${weakPart}`.trim();
}

export function deriveResolution(
  compositeScore: number,
  verificationStatus: VerificationStatus,
  blockingConflict: boolean,
  etkAvailable: boolean,
  modules: {
    motivation: MotivationAnalysis;
    culturalFit: CulturalFitV3;
    loyalty: LoyaltyScore;
  },
): FinalResolution {
  // Собираем условия (только релевантные, дедуплицированные)
  const conditionsSet = new Set<string>();
  if (modules.motivation.redFlags.length) {
    conditionsSet.add("Углубить вопросы о мотивации на следующем этапе интервью");
  }
  const weakValue = modules.culturalFit.values.find((v) => v.score <= 2);
  if (weakValue) {
    conditionsSet.add(`Отработать слабую ценность «${weakValue.label}» (оценка ${weakValue.score}/5)`);
  }
  if (modules.loyalty.sHistory < 50) {
    conditionsSet.add("Проверить причины коротких контрактов / частой смены работодателей");
  }
  if (modules.loyalty.flags.length && modules.loyalty.score < 60) {
    conditionsSet.add("Провести reference-check по последним 2 работодателям");
  }

  const reason = buildResolutionReason(compositeScore, verificationStatus, modules, blockingConflict);

  // 1) Блокирующее расхождение → NOT_RECOMMENDED
  if (blockingConflict) {
    return {
      code: "NOT_RECOMMENDED",
      label: "❌ НЕ РЕКОМЕНДОВАН",
      compositeScore,
      reason,
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
      reason,
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
      reason,
      conditions: [
        "Запросить у кандидата ЭТК / выписку из СФР перед оффером",
        ...Array.from(conditionsSet),
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
      reason,
      conditions: Array.from(conditionsSet),
    };
  }
  // 5) CS 50–69 → CONDITIONAL
  const baseConditions = conditionsSet.size
    ? Array.from(conditionsSet)
    : [
        "Провести дополнительное интервью по слабым зонам",
        "Запросить рекомендательные контакты с последних мест работы",
      ];
  return {
    code: "CONDITIONAL",
    label: "⚠️ УСЛОВНО РЕКОМЕНДОВАН",
    compositeScore,
    reason,
    conditions: baseConditions,
  };
}

// ==========================================================
// Executive Summary — пост-обработка и cross-check
// ==========================================================

function normalizeExecutiveSummary(
  raw: any,
  modules: {
    verification: VerificationResult;
    motivation: MotivationAnalysis;
    culturalFit: CulturalFitV3;
    loyalty: LoyaltyScore;
  },
  resolution: FinalResolution,
  recruiterForm: RecruiterForm,
): ExecutiveSummary {
  // Headline и paragraph: используем то, что дала модель, но если пусто или противоречит — генерируем сами
  let headline = String(raw?.headline || "").trim().slice(0, 300);
  let paragraph = String(raw?.paragraph || "").trim().slice(0, 800);

  // Фильтр фантомных фраз
  if (isPhantom(headline)) headline = stripPhantomText(headline);
  if (isPhantom(paragraph)) paragraph = stripPhantomText(paragraph);

  // Cross-check: если headline говорит «низкий риск/рекомендован», а резолюция NOT_RECOMMENDED — переписываем
  const headlineSuggestsPositive = /рекоменд|низк\w*\s+риск|сильн|надёжн/i.test(headline);
  const headlineSuggestsNegative = /не\s+рекоменд|высок\w*\s+риск|конфликт|блокир/i.test(headline);

  if (resolution.code === "NOT_RECOMMENDED" && headlineSuggestsPositive && !headlineSuggestsNegative) {
    headline = "";
  }
  if (resolution.code === "RECOMMENDED" && headlineSuggestsNegative && !headlineSuggestsPositive) {
    headline = "";
  }

  if (!headline) {
    switch (resolution.code) {
      case "RECOMMENDED":
        headline = "Кандидат рекомендован — ключевые модули в зелёной зоне.";
        break;
      case "CONDITIONAL":
        headline = "Условно рекомендован — есть пограничные зоны, требующие проверки.";
        break;
      case "UNVERIFIED":
        headline = "Рекомендован, но опыт не подтверждён ЭТК — нужна верификация перед оффером.";
        break;
      case "NOT_RECOMMENDED":
        headline = resolution.blockingFactor
          ? `Не рекомендован: ${resolution.blockingFactor.toLowerCase()}.`
          : "Не рекомендован — баллы ниже порога.";
        break;
    }
  }

  if (!paragraph) {
    paragraph = resolution.reason;
  }

  // KeyFindings: нормализуем + добавляем недостающие из модулей
  const TYPES = new Set(["strength", "risk", "neutral"]);
  const MODS = new Set(["verification", "motivation", "culturalFit", "loyalty"]);
  const rawFindings: KeyFinding[] = Array.isArray(raw?.keyFindings)
    ? raw.keyFindings
        .map((f: any) => ({
          type: TYPES.has(f?.type) ? f.type : "neutral",
          module: MODS.has(f?.module) ? f.module : "motivation",
          text: String(f?.text || "").slice(0, 300),
        }))
        .filter((f: KeyFinding) => f.text.length > 0)
        // Вырезаем findings с фантомными формулировками
        .filter((f: KeyFinding) => !isPhantom(f.text))
        .slice(0, 8)
    : [];

  // Догенерация фактических выводов
  const findings: KeyFinding[] = [...rawFindings];

  function hasFinding(text: string): boolean {
    return findings.some((f) => f.text.toLowerCase().includes(text.toLowerCase()));
  }

  if (modules.verification.status === "confirmed" && !hasFinding("ЭТК")) {
    findings.push({ type: "strength", module: "verification", text: "Опыт работы полностью подтверждён ЭТК." });
  }
  if (modules.verification.status === "conflict" && !hasFinding("расхожден")) {
    findings.push({ type: "risk", module: "verification", text: "Обнаружены расхождения с ЭТК — нужна проверка." });
  }
  if (modules.motivation.score >= 75 && !hasFinding("мотивац")) {
    findings.push({ type: "strength", module: "motivation", text: `Здоровая мотивация (score ${modules.motivation.score}/100).` });
  }
  if (modules.motivation.redFlags.length > 0 && !hasFinding("red flag") && !hasFinding("риск мотивац")) {
    findings.push({ type: "risk", module: "motivation", text: `Риски мотивации: ${modules.motivation.redFlags[0]}.` });
  }
  if (modules.culturalFit.totalScore >= 12 && !hasFinding("культурн")) {
    findings.push({ type: "strength", module: "culturalFit", text: `Высокое культурное соответствие (${modules.culturalFit.totalScore}/15).` });
  }
  const weakValue = modules.culturalFit.values.find((v) => v.score <= 2);
  if (weakValue && !hasFinding(weakValue.label)) {
    findings.push({ type: "risk", module: "culturalFit", text: `Слабая ценность «${weakValue.label}» (${weakValue.score}/5).` });
  }
  if (modules.loyalty.score >= 75 && !hasFinding("лояльн")) {
    findings.push({ type: "strength", module: "loyalty", text: `Стабильная трудовая история (ILS ${modules.loyalty.score}/100).` });
  }
  if (modules.loyalty.score < 50 && !hasFinding("стабильн") && !hasFinding("смена")) {
    findings.push({ type: "risk", module: "loyalty", text: `Низкий индекс лояльности (ILS ${modules.loyalty.score}/100).` });
  }

  // Consistency check
  const consistencyNotes: string[] = Array.isArray(raw?.consistency?.notes)
    ? raw.consistency.notes.map(String).slice(0, 5)
    : [];
  let consistencyStatus: "ok" | "warning" | "conflict" =
    raw?.consistency?.status === "warning" || raw?.consistency?.status === "conflict"
      ? raw.consistency.status
      : "ok";

  // Авто-проверка согласованности (программная)
  const autoChecks: string[] = [];
  if (
    (recruiterForm.attitudeToFormer === "hostile" || recruiterForm.attitudeToFormer === "critical") &&
    modules.culturalFit.values.find((v) => v.key === "partnership")!.score > 3
  ) {
    autoChecks.push("Высокая оценка «Партнёрства» при критическом отношении к бывшим — несогласованность.");
    consistencyStatus = "conflict";
  }
  if (modules.motivation.redFlags.length > 0 && modules.motivation.score > 70) {
    autoChecks.push("Высокий score мотивации при наличии red flags — несогласованность.");
    consistencyStatus = consistencyStatus === "conflict" ? "conflict" : "warning";
  }
  if (modules.loyalty.sHistory < 40 && modules.loyalty.flags.length === 0) {
    autoChecks.push("Низкий sHistory без явных флагов — добавлен авто-флаг.");
    consistencyStatus = consistencyStatus === "ok" ? "warning" : consistencyStatus;
  }

  const consistency: ConsistencyCheck = {
    status: consistencyStatus,
    notes: [...autoChecks, ...consistencyNotes].slice(0, 5),
  };

  return {
    headline,
    paragraph,
    keyFindings: findings.slice(0, 6),
    consistency,
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

  // Pre-process: считаем хронологию ЛОКАЛЬНО, чтобы LLM не делал арифметику
  const timeline = buildTimeline(resumeText, etk);

  // Pre-process: лингвистический аудит (все цифры — детерминированно)
  const linguisticBase = runLinguisticAudit(resumeText, interviewText || "");

  const userPrompt = buildAnalyzePrompt(
    resumeText,
    etk,
    interviewText,
    referencesText,
    form,
    timeline,
    linguisticBase,
  );

  let parsed: any = null;
  let fallbackNote: string | undefined;

  try {
    const raw = await yandexComplete(
      [
        { role: "system", text: SYSTEM_PROMPT },
        { role: "user", text: userPrompt },
      ],
      { temperature: 0, maxTokens: 12000 },
    );
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (e) {
      // Второй шанс: ремонт обрезанного JSON
      try {
        const repaired = repairJson(raw);
        parsed = JSON.parse(repaired);
        fallbackNote = "JSON от Yandex GPT был обрезан по лимиту токенов, но успешно восстановлен.";
        console.warn('[pipelineAnalyzer] JSON repaired after truncation.');
      } catch (e2) {
        const snippet = extractJson(raw).slice(0, 800);
        console.error('[pipelineAnalyzer] Failed to parse JSON. Raw len:', raw.length, 'Snippet:', snippet);
        fallbackNote = `Не удалось распарсить JSON от Yandex GPT — использованы значения по умолчанию (raw.length=${raw.length}). Фрагмент: ${snippet.slice(0, 600)}`;
        parsed = {};
      }
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
  const motivation = normalizeMotivation(parsed?.motivation, form.searchReason, form.timePressure);
  const culturalFit = normalizeCultural(parsed?.culturalFit, form.attitudeToFormer);
  const loyalty = normalizeLoyalty(parsed?.loyalty, timeline);

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

  const executiveSummary = normalizeExecutiveSummary(
    parsed?.executiveSummary,
    { verification, motivation, culturalFit, loyalty },
    resolution,
    form,
  );

  const linguisticAudit = mergeLinguisticAudit(linguisticBase, parsed?.linguistic);

  return {
    version: "3.3",
    candidateName,
    createdAt: Date.now(),
    recruiterForm: form,
    etk,
    verification,
    motivation,
    culturalFit,
    loyalty,
    linguisticAudit,
    compositeScore,
    resolution,
    executiveSummary,
    timeline: timeline || undefined,
    rawAnalysisNote: fallbackNote,
  };
}

// ==========================================================
// Merge: LLM-интерпретации накладываем на детерминированную базу
// ==========================================================
function pickStr(v: any, fallback: string): string {
  if (typeof v === "string" && v.trim().length > 0) {
    const clean = stripPhantomText(v.trim());
    return clean.length > 0 ? clean.slice(0, 800) : fallback;
  }
  return fallback;
}

function mergeLinguisticAudit(base: LinguisticAudit, llm: any): LinguisticAudit {
  const liwcSummary = pickStr(llm?.liwcSummary, base.liwc.summary);
  const rmSummary = pickStr(llm?.rmSummary, base.realityMonitoring.summary);
  const clSummary = pickStr(llm?.clSummary, base.cognitiveLoad.summary);
  const acidSummary = pickStr(llm?.acidSummary, base.acid.summary);
  const headline = pickStr(llm?.linguisticHeadline, base.headline);
  const overall = pickStr(llm?.linguisticOverallSummary, base.summary);
  return {
    ...base,
    liwc: { ...base.liwc, summary: liwcSummary },
    realityMonitoring: { ...base.realityMonitoring, summary: rmSummary },
    cognitiveLoad: { ...base.cognitiveLoad, summary: clSummary },
    acid: { ...base.acid, summary: acidSummary },
    headline,
    summary: overall,
  };
}
