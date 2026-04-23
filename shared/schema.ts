import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Проверки резюме ---
export const checks = sqliteTable("checks", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  candidateName: text("candidate_name"),
  resumeText: text("resume_text").notNull(),
  riskScore: integer("risk_score").notNull(),
  inflationScore: integer("inflation_score").notNull(),
  wolvesScore: integer("wolves_score").notNull(),
  totalScore: integer("total_score").notNull(),
  verdict: text("verdict").notNull(), // green | yellow | red
  reportJson: text("report_json").notNull(),
});

export const insertCheckSchema = createInsertSchema(checks);
export type InsertCheck = z.infer<typeof insertCheckSchema>;
export type Check = typeof checks.$inferSelect;

// --- Типы отчёта ---
export type Severity = "low" | "medium" | "high" | "critical";

export type EvidenceType =
  | "quote"           // дословная цитата из резюме
  | "contradiction"   // противоречие между блоками
  | "absence"         // отсутствие ожидаемой информации
  | "pattern"         // статистический/структурный паттерн
  | "indirect";       // косвенный маркер (домен email, префикс телефона, регион)

export type Evidence = {
  type: EvidenceType;
  text: string;         // цитата / описание наблюдения
  location?: string;    // где в резюме (например "Блок: Опыт работы, 2021-2023")
};

export type VerificationStep = {
  action: string;                          // что сделать: "Позвонить в компанию X", "Проверить стек на интервью"
  method: "call" | "interview" | "document" | "reference" | "technical" | "osint" | "external";
  priority: "must" | "should" | "nice";    // обязательно / желательно / опционально
  effort: "low" | "medium" | "high";       // трудозатраты
  expectedOutcome: string;                 // что рассчитываем узнать
};

export type Finding = {
  id: string;
  title: string;
  category?: FindingCategory;      // к какой под-категории относится (новое поле)
  severity: Severity;
  score: number;                   // 0-100 вклад в риск
  confidence: number;              // 0-100 насколько уверены в наблюдении
  description: string;
  evidence: string[];              // legacy: простые цитаты (обратная совместимость)
  evidenceDetailed?: Evidence[];   // новое: структурированные доказательства
  verificationSteps?: VerificationStep[]; // новое: что делать рекрутеру
  impact?: string;                 // почему это важно для найма (одна строка)
};

export type FindingCategory =
  | "chronology"       // временные нестыковки, gaps, параллелизм работ
  | "qualification"    // несоответствие грейда/стека/образования
  | "achievement"      // раздутые достижения, пустые метрики
  | "identity"         // косвенные контакты, домены, регионы
  | "behavior"         // паттерны job-hopping, лексика сообществ
  | "linguistic"       // компиляция из чужих резюме, шаблоны
  | "reputation"       // проблемные работодатели
  | "other";

export type CategoryReport = {
  score: number;
  summary: string;
  findings: Finding[];
  confidence?: number;             // общая уверенность по категории
};

// Сводная матрица по 5 субкатегориям (новая модель)
export type SubcategoryScore = {
  key: FindingCategory;
  label: string;
  score: number;                   // 0-100
  findingsCount: number;
  topIssue?: string;               // краткое описание главного сигнала
};

// Топ red flags
export type RedFlag = {
  title: string;
  severity: "high" | "critical";
  reason: string;
  findingId?: string;              // ссылка на finding, если есть
};

// План действий рекрутера
export type RecruiterAction = {
  step: number;
  title: string;                   // "Скрининг-звонок: уточнить хронологию"
  description: string;             // развернутое описание
  priority: "must" | "should" | "nice";
  estimatedTime: string;           // "15 минут", "1 час"
  targets: string[];               // к каким findings относится (id)
};

// ============================================================
// WOLF DETECTOR v1.0 — усиленный модуль проверки на «волка»
// ============================================================

export type TimelineEntry = {
  company: string;
  role: string;
  period: string;              // "2021-03 — 2022-08"
  durationMonths: number | null;
  verifiability: "high" | "medium" | "low" | "unknown"; // known / startup / closed / foreign / freelance
  verifiabilityReason?: string;
};

export type TimelineAnomaly = {
  type: "overlap" | "gap" | "too-short" | "teleport" | "age-vs-tenure";
  description: string;
  quote?: string;
};

export type ProgressionAnomaly = {
  type: "too-fast" | "unexplained-downshift" | "title-duplication" | "title-vs-duties";
  description: string;
  quote?: string;
};

export type EmployerCheck = {
  name: string;
  status: "known" | "startup" | "closed" | "foreign" | "freelance" | "unclear";
  verificationRisk: "low" | "medium" | "high";
  note?: string;
};

export type AchievementItem = {
  text: string;
  kind: "verifiable" | "declarative";
  reason?: string;
};

export type SkillIssue = {
  skill: string;
  issue: "no-evidence" | "incompatible" | "overclaim" | "no-depth" | "vacuum";
  description: string;
};

// Категория сигнала по ТЗ (5 групп)
export type WolfSignalCategory =
  | "frequency"      // Частота смены
  | "narrative"      // Нарративные аномалии
  | "self-presentation"  // Масштаб самопрезентации
  | "osint-divergence"   // OSINT-расхождения
  | "network"            // Сетевые аномалии
  | "behavior";          // Поведенческие маркеры

// Типология «волка» по ТЗ (5 типов)
export type WolfArchetype =
  | "job-hopper"         // с маскировкой
  | "fabricator"         // фальсификатор
  | "manipulator"        // социопроходимец интервью
  | "team-destroyer"     // токсик
  | "corporate-spy";     // угроза конкуренции

export type WolfSignalType =
  | "frequent-switches"       // частая смена > 4 за 3 года
  | "competitor-hopping"      // переходы к конкурентам
  | "parallel-business"       // ИП/ООО параллельно найму
  | "downshift"               // директор → специалист
  | "no-references"           // отсутствие рекомендателей
  | "hidden-jobs"             // пробелы, скрывающие работу
  | "aggressive-brand"        // "я сделал" при командной работе
  | "blame-others"            // все работодатели «плохие»
  | "dead-contacts"           // мёртвые ссылки/контакты
  | "aggressive-negotiation"  // давление на оффере/сроки
  | "osint-gap"               // профили в OSINT не бьются
  | "other";

export type WolfSignal = {
  type: WolfSignalType;
  category: WolfSignalCategory;  // к какой группе относится
  title: string;
  description: string;
  evidence: string[];           // дословные цитаты
  severity: "low" | "medium" | "high";
};

// 12 фиксированных OSINT-источников по ТЗ
export type OsintSourceId =
  | "hh"          // HeadHunter
  | "linkedin"    // LinkedIn
  | "vk"          // ВКонтакте
  | "telegram"    // Telegram
  | "github"      // GitHub / GitLab
  | "egrul"       // ЕГРЮЛ / Rusprofile
  | "habr"        // Habr Career
  | "search"      // Google / Яндекс
  | "wayback"     // Wayback Machine
  | "arbitr"      // Картотека арбитражных дел
  | "disqualified"// Реестр дисквалифицированных
  | "breaches";   // Базы утечек

export type OsintCheck = {
  id: OsintSourceId | string;
  priority: "must" | "high" | "medium" | "situational"; // 🔴 / 🟠 / 🟡 / 🟢
  source: string;               // "LinkedIn", "ЕГРЮЛ", "kad.arbitr.ru"
  url?: string;                 // прямая ссылка на источник
  whatToCheck: string;
  expectedSignal?: string;      // что именно ищем / какой красный флаг
  tool?: string;                // инструмент ("egrul.nalog.ru", "Web Archive")
  relatesTo?: string[];         // id findings / wolf signals
};

export type InterviewQuestionTriplet = {
  anomaly: string;              // о какой аномалии идёт речь
  // Методология триплета по ТЗ: открыватель → углубитель → верификатор
  opener: string;               // нейтральный, приглашает к рассказу
  deepener: string;             // ловит противоречия, уточняет детали
  verifier: string;             // закрывающий — требует конкретику, имена, доказательства
  // Совместимость со старым API — поля legacy
  direct?: string;
  indirect?: string;
  stress?: string;
};

// Полиграф-триггер по ТЗ: 4 типа вопросов
export type PolygraphQuestionKind = "relevant" | "control" | "comparison" | "behavioral";

export type PolygraphTrigger = {
  trigger: string;              // какой флаг кандидата покрывает
  applies: boolean;
  kind?: PolygraphQuestionKind; // релевантный / контрольный / сравнительный / поведенческий
  question?: string;            // конкретный вопрос для интервью
  note?: string;
};

// --- Wolf School Detector (подфича) ---
export type WolfSchoolCode =
  | "ОМ"    // «Осознанная меркантильность» / Назаров
  | "НА"    // «Взламываем найм» и аналоги
  | "ЛЕГ"   // Легенда-фабрика
  | "ОЭ"    // Оверэмплоймент-сообщества
  | "АТС"   // ATS-оптимизаторы (легальная грань)
  | "?"     // системные признаки есть, специфичные маркеры не идентифицированы
  | "none"; // нет признаков школьной подготовки

export type OveremploymentRisk = "yes" | "no" | "suspect";

export type WolfSchoolDetection = {
  // Индекс школы — вероятная принадлежность конкретной волчьей школе
  schoolIndex: WolfSchoolCode;
  schoolName?: string;            // human-readable, напр. «Осознанная меркантильность»
  confidence: number;             // 0-100
  justification: string;          // что именно указывает на школу
  // Ideological Match Score 1-5 — соответствие идеологии (меркантилизм / «волчистость»)
  ideologicalMatch: 1 | 2 | 3 | 4 | 5;
  ideologicalMatchNote?: string;
  // Overemployment flag
  overemploymentRisk: OveremploymentRisk;
  overemploymentEvidence?: string;
  // Network Risk Level 1-3
  networkRiskLevel: 1 | 2 | 3;
  networkRiskNote?: string;
  // Ключевые маркеры школьной подготовки (до 6 шт.)
  markers: string[];
  // Специализированные триплеты — для выявления выпускника конкретной школы (до 3 шт.)
  schoolTriplets: InterviewQuestionTriplet[];
};

export type WolfAudit = {
  version: "1.0";
  // Executive summary — текст для топ-менеджмента
  executiveSummary?: string;
  // Архетипы «волка» — какие паттерны прослеживаются
  archetypes?: Array<{
    type: WolfArchetype;
    confidence: number;       // 0–100
    justification: string;
  }>;
  // Блок 1 — Хронология
  timeline: TimelineEntry[];
  timelineAnomalies: TimelineAnomaly[];
  declaredTenureYears: number | null;
  calculatedTenureYears: number | null;
  // Блок 2 — Карьерная прогрессия
  progressionLogic: string;
  progressionAnomalies: ProgressionAnomaly[];
  progressionVerdict: "normal" | "suspicious" | "critical";
  // Блок 3 — Верификация работодателей
  employers: EmployerCheck[];
  grayRatio: { hardToVerify: number; total: number };
  // Блок 4 — Достижения
  achievementsAudit: {
    items: AchievementItem[];
    aiGenerationLikelihood: "yes" | "no" | "probable";
    aiGenerationReason?: string;
    credibilityPercent: number; // 0-100
  };
  // Блок 5 — Навыки
  skillAudit: {
    issues: SkillIssue[];
    vacuumSkills: string[];     // «пылесосные» навыки
    trustedSkills: string[];    // подтверждённые опытом
  };
  // Блок 6 — Индекс «Волка»
  wolfSignals: WolfSignal[];
  wolfIndex: 0 | 1 | 2 | 3;     // 0 = нет, 3 = максимум
  wolfInterpretation: string;
  // Блок 7 — Итог
  riskScore: 1 | 2 | 3 | 4 | 5;
  riskLevel: string;            // "🟢 Низкий" и т.д.
  recommendation: string;
  topFindings: Array<{ title: string; quote?: string }>; // топ-3
  // Блок 8 — Верификация
  interviewTriplets: InterviewQuestionTriplet[];
  osintChecklist: OsintCheck[];
  referenceCheckNotes: string[]; // что спросить у бывших руководителей
  testTaskRecommendations: string[];
  polygraphTriggers: PolygraphTrigger[];
  // Проход 8 — Wolf School Detector (подфича, может отсутствовать на старых отчётах)
  schoolDetection?: WolfSchoolDetection;
  // Позитивные маркеры
  positiveMarkers: string[];
  // Prompt injection guard
  injectionDetected: boolean;
  injectionNote?: string;
};

export type FullReport = {
  candidateName: string | null;
  riskScore: number;
  inflationScore: number;
  wolvesScore: number;
  totalScore: number;
  verdict: "green" | "yellow" | "red";
  confidence?: number;             // средняя уверенность модели (0-100)
  executiveSummary?: string;       // 2-3 предложения для руководителя
  risks: CategoryReport;
  inflation: CategoryReport;
  wolves: CategoryReport;
  subcategoryBreakdown?: SubcategoryScore[];  // новое
  redFlags?: RedFlag[];                       // новое: топ-3 критических
  positiveSignals?: string[];                 // новое: то, что говорит в пользу
  interviewQuestions: string[];
  sbRecommendations: string[];
  recruiterActionPlan?: RecruiterAction[];    // новое: упорядоченный план
  wolfAudit?: WolfAudit;                      // Wolf Detector v1.0
  createdAt: number;
};

// ============================================================
// SINGLE-STEP PIPELINE v3.0 — единый пайплайн AI-скрининга
// ============================================================

export const pipelineChecks = sqliteTable("pipeline_checks", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  parentId: text("parent_id"),                  // для версий / пересчётов
  version: integer("version").notNull(),        // 1, 2, 3 ...
  candidateName: text("candidate_name"),
  resumeText: text("resume_text").notNull(),
  etkText: text("etk_text"),
  interviewText: text("interview_text"),
  referencesText: text("references_text"),
  recruiterForm: text("recruiter_form").notNull(),    // JSON
  compositeScore: integer("composite_score").notNull(),
  resolutionCode: text("resolution_code").notNull(),  // RECOMMENDED | CONDITIONAL | NOT_RECOMMENDED | UNVERIFIED
  reportJson: text("report_json").notNull(),
});

export const insertPipelineCheckSchema = createInsertSchema(pipelineChecks);
export type InsertPipelineCheck = z.infer<typeof insertPipelineCheckSchema>;
export type PipelineCheck = typeof pipelineChecks.$inferSelect;

// --- Форма рекрутера (4 поля + заметка) ---
export type SearchReason =
  | "growth" | "low_salary" | "layoff" | "conflict"
  | "burnout" | "no_growth" | "other";

export type AttitudeToFormer = "positive" | "neutral" | "critical" | "hostile";

export type TimePressure =
  | "has_offer" | "personal_deadline" | "no_pressure" | "not_specified";

export type References =
  | "has_ready" | "has_not_ready" | "none" | "not_discussed";

export type RecruiterForm = {
  searchReason: SearchReason;
  attitudeToFormer: AttitudeToFormer;
  timePressure: TimePressure;
  references: References;
  note: string; // free-form, до 300 симв.
};

// --- ЭТК (структурированные записи СФР) ---
export type EtkRecord = {
  company: string;         // наименование работодателя
  position?: string;       // должность
  startDate?: string;      // YYYY-MM-DD или YYYY-MM
  endDate?: string | null; // null = текущее место
  reason?: string;         // основание прекращения
  inn?: string;
};

export type EtkStructured = {
  records: EtkRecord[];
  source: "xml" | "text" | "none";
  note?: string;
};

// --- Модуль 1: Верификация опыта (резюме × ЭТК) ---
export type VerificationStatus =
  | "confirmed"      // ✅ Подтверждено
  | "partial"        // ⚠️ Частично
  | "conflict"       // 🔴 Расхождение (BLOCKING)
  | "not_checked";   // ⬜ Не проверялось

export type VerificationItem = {
  company: string;
  position?: string;
  declared: string;   // как в резюме (период/тайтл)
  etk?: string;       // как в ЭТК
  status: VerificationStatus;
  note?: string;
};

export type VerificationResult = {
  status: VerificationStatus;       // общий статус
  summary: string;                  // 1-2 предложения
  items: VerificationItem[];        // по каждому месту работы
  blockingConflict: boolean;        // true = есть хотя бы одно 🔴
  etkAvailable: boolean;            // есть ли данные ЭТК
};

// --- Модуль 2: Анализ мотивации ---
export type MotivationAnalysis = {
  score: number;                    // 0–100 (здоровье мотивации)
  summary: string;
  declaredReason: string;           // как сам кандидат формулирует причину
  recruiterReason: SearchReason;    // что отметил рекрутер
  reasonConsistency: "match" | "partial" | "mismatch";
  redFlags: string[];               // «работодатель-тиран», «все плохие»
  greenFlags: string[];
  urgencyNote?: string;             // интерпретация временного прессинга
};

// --- Модуль 3: Cultural Fit V3 (3 объединённые ценности) ---
export type CulturalValueKey = "responsibility" | "partnership" | "entrepreneurship";

export type CulturalValueScore = {
  key: CulturalValueKey;
  label: string;                    // «Ответственность за результат» и т.д.
  score: 1 | 2 | 3 | 4 | 5;
  evidence: string[];               // дословные цитаты / наблюдения
  note?: string;
};

export type CulturalFitV3 = {
  values: CulturalValueScore[];     // ровно 3
  totalScore: number;               // 3-15
  summary: string;
};

// --- Модуль 4: Индекс лояльности и стабильности (ILS) ---
export type LoyaltyScore = {
  score: number;                    // 0–100
  sHistory: number;                 // 0–100 (стабильность по хронологии)
  sRecruiter: number;               // 0–100 (по форме рекрутера)
  sLanguage: number;                // 0–100 (по языку резюме/интервью)
  summary: string;
  flags: string[];                  // «оверэмплоймент», «конфликтность»
};

// --- Финальная резолюция ---
export type ResolutionCode =
  | "RECOMMENDED"           // ✅
  | "CONDITIONAL"           // ⚠️ условно
  | "NOT_RECOMMENDED"       // ❌
  | "UNVERIFIED";           // ⚠️ рекомендован, но опыт не верифицирован

export type FinalResolution = {
  code: ResolutionCode;
  label: string;                    // «✅ РЕКОМЕНДОВАН» и т.п.
  compositeScore: number;           // 0-100
  reason: string;                   // краткое обоснование
  conditions: string[];             // для CONDITIONAL/UNVERIFIED: что сделать до оффера
  blockingFactor?: string;          // если есть 🔴 или CS<50
};

// --- Итоговый отчёт пайплайна ---
export type SingleStepReport = {
  version: "3.0";
  candidateName: string | null;
  createdAt: number;
  recruiterForm: RecruiterForm;
  etk: EtkStructured;
  verification: VerificationResult;
  motivation: MotivationAnalysis;
  culturalFit: CulturalFitV3;
  loyalty: LoyaltyScore;
  compositeScore: number;
  resolution: FinalResolution;
  rawAnalysisNote?: string;         // служебное: fallback-сообщение
};
