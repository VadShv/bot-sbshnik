import { Card } from "@/components/ui/card";
import type {
  WolfAudit,
  WolfSignalType,
  WolfSignalCategory,
  WolfArchetype,
  OsintCheck,
  TimelineAnomaly,
  ProgressionAnomaly,
  AchievementItem,
  SkillIssue,
  EmployerCheck,
  PolygraphQuestionKind,
  WolfSchoolDetection,
  WolfSchoolCode,
  OveremploymentRisk,
} from "@/lib/types";
import {
  AlertTriangle,
  Shield,
  Clock,
  TrendingUp,
  Building2,
  Trophy,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  MessageSquare,
  Activity,
  Sparkles,
  Eye,
  ShieldAlert,
  FileText,
  Users,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ========== Константы визуализации ==========

const RISK_LEVELS: Record<
  1 | 2 | 3 | 4 | 5,
  { emoji: string; label: string; color: string; bg: string; border: string }
> = {
  1: { emoji: "🟢", label: "Низкий", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  2: { emoji: "🟡", label: "Умеренный", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  3: { emoji: "🟠", label: "Повышенный", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  4: { emoji: "🔴", label: "Высокий", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  5: { emoji: "⛔", label: "Критический", color: "text-red-500", bg: "bg-red-600/15", border: "border-red-600/40" },
};

const WOLF_INDEX_META: Record<0 | 1 | 2 | 3, { icon: string; label: string; desc: string }> = {
  0: { icon: "—", label: "Не волк", desc: "Признаков серийных коротких контрактов не обнаружено" },
  1: { icon: "🐺", label: "Слабые признаки", desc: "Один-два маркера поведения «волка»" },
  2: { icon: "🐺🐺", label: "Явные признаки", desc: "Несколько устойчивых паттернов — усиленная проверка" },
  3: { icon: "🐺🐺🐺", label: "Критично", desc: "Устойчивый паттерн «волка» — максимальная осторожность" },
};

const OSINT_PRIORITY_META: Record<
  OsintCheck["priority"],
  { emoji: string; label: string; color: string; bg: string }
> = {
  must: { emoji: "🔴", label: "Обязательно", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  high: { emoji: "🟠", label: "Высокий приоритет", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  medium: { emoji: "🟡", label: "Средний приоритет", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  situational: { emoji: "🟢", label: "Ситуативно", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
};

const WOLF_SIGNAL_LABELS: Record<WolfSignalType, string> = {
  "frequent-switches": "Частая смена мест",
  "competitor-hopping": "Переходы к конкурентам",
  "parallel-business": "Параллельный бизнес",
  "downshift": "Необъяснимый даунгрейд",
  "no-references": "Нет рекомендателей",
  "hidden-jobs": "Скрытые работы",
  "aggressive-brand": "Агрессивный личный бренд",
  "blame-others": "Обвинение работодателей",
  "dead-contacts": "Мёртвые контакты",
  "aggressive-negotiation": "Агрессивные переговоры",
  "osint-gap": "Расхождения с OSINT",
  "other": "Прочее",
};

const WOLF_SIGNAL_CATEGORY_META: Record<
  WolfSignalCategory,
  { label: string; emoji: string; color: string }
> = {
  frequency: { label: "Частота смены", emoji: "🔁", color: "text-orange-400" },
  narrative: { label: "Нарративные аномалии", emoji: "📖", color: "text-yellow-400" },
  "self-presentation": { label: "Самопрезентация", emoji: "🎭", color: "text-pink-400" },
  "osint-divergence": { label: "OSINT-расхождения", emoji: "🔎", color: "text-blue-400" },
  network: { label: "Сетевые аномалии", emoji: "🕸️", color: "text-purple-400" },
  behavior: { label: "Поведенческие маркеры", emoji: "⚠️", color: "text-red-400" },
};

const ARCHETYPE_META: Record<
  WolfArchetype,
  { label: string; icon: string; short: string; color: string }
> = {
  "job-hopper": {
    label: "Волк-перебежчик",
    icon: "🏃",
    short: "Скачет между компаниями, маскирует частоту смен",
    color: "text-orange-400",
  },
  fabricator: {
    label: "Фальсификатор",
    icon: "🎨",
    short: "Придумывает должности, проекты, метрики",
    color: "text-red-400",
  },
  manipulator: {
    label: "Социопроходимец интервью",
    icon: "🎭",
    short: "Безупречен на словах, пуст в конкретике",
    color: "text-pink-400",
  },
  "team-destroyer": {
    label: "Разрушитель команды",
    icon: "💣",
    short: "Во всех компаниях «виноваты все вокруг», нет рекомендателей",
    color: "text-yellow-400",
  },
  "corporate-spy": {
    label: "Корпоративный шпион",
    icon: "🕵️",
    short: "Параллельный бизнес, переходы к конкурентам",
    color: "text-purple-400",
  },
};

const SEVERITY_META: Record<
  "low" | "medium" | "high",
  { label: string; color: string }
> = {
  low: { label: "low", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  medium: { label: "medium", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
  high: { label: "high", color: "text-red-400 border-red-500/30 bg-red-500/10" },
};

const POLYGRAPH_KIND_META: Record<
  PolygraphQuestionKind,
  { label: string; icon: string; color: string }
> = {
  relevant: { label: "Релевантный", icon: "🎯", color: "text-red-400" },
  control: { label: "Контрольный", icon: "🧭", color: "text-emerald-400" },
  comparison: { label: "Сравнительный", icon: "⚖️", color: "text-yellow-400" },
  behavioral: { label: "Поведенческий", icon: "🎬", color: "text-orange-400" },
};

const VERIFIABILITY_META: Record<
  "high" | "medium" | "low" | "unknown",
  { label: string; color: string }
> = {
  high: { label: "высокая", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  medium: { label: "средняя", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  low: { label: "низкая", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  unknown: { label: "?", color: "bg-muted text-muted-foreground border-border" },
};

const PROGRESSION_VERDICT_META: Record<
  "normal" | "suspicious" | "critical",
  { emoji: string; label: string; color: string }
> = {
  normal: { emoji: "✅", label: "В норме", color: "text-emerald-400" },
  suspicious: { emoji: "⚠️", label: "Подозрительно", color: "text-orange-400" },
  critical: { emoji: "🚨", label: "Критично", color: "text-red-400" },
};

// ========== Главный компонент ==========

export function WolfReport({ audit }: { audit: WolfAudit }) {
  const riskMeta = RISK_LEVELS[audit.riskScore] || RISK_LEVELS[3];
  const wolfMeta = WOLF_INDEX_META[audit.wolfIndex] || WOLF_INDEX_META[0];
  const progressionMeta = PROGRESSION_VERDICT_META[audit.progressionVerdict] || PROGRESSION_VERDICT_META.normal;

  return (
    <section className="mt-10 space-y-5" data-testid="section-wolf-report">
      {/* Заголовок-баннер */}
      <Card className="border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-[260px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>🐺</span>
              <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400">
                Дополнительный модуль · v1.0
              </div>
            </div>
            <h2 className="text-2xl font-bold" data-testid="text-wolf-title">
              Wolf Detector — усиленная проверка на «волка»
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Отдельный агент со своим system prompt и 7-проходным анализом поверх базовой проверки.
              Задача — выявить серийного «волка»: кандидата, который маскирует частые смены мест,
              раздувает роль и умеет проходить интервью. По умолчанию работает на Yandex GPT Pro (flagship).
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <MetricTile
              label="RISK SCORE"
              emoji={riskMeta.emoji}
              value={String(audit.riskScore)}
              subtitle={riskMeta.label}
              color={riskMeta.color}
              bg={riskMeta.bg}
              border={riskMeta.border}
              testId="tile-risk-score"
            />
            <MetricTile
              label="WOLF INDEX"
              emoji={wolfMeta.icon}
              value={String(audit.wolfIndex)}
              subtitle={wolfMeta.label}
              color="text-orange-400"
              bg="bg-orange-500/10"
              border="border-orange-500/30"
              testId="tile-wolf-index"
            />
          </div>
        </div>

        {audit.recommendation && (
          <div className="mt-4 rounded-md border border-primary/30 bg-primary/[0.04] p-3 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Рекомендация
            </span>
            <p className="mt-1" data-testid="text-wolf-recommendation">{audit.recommendation}</p>
          </div>
        )}
      </Card>

      {/* Executive Summary */}
      {audit.executiveSummary && (
        <Card className="border-primary/30 bg-primary/[0.03] p-5">
          <SectionHeader icon={FileText} title="Executive Summary" accent="для руководителя" />
          <p className="mt-3 text-sm leading-relaxed" data-testid="text-wolf-executive-summary">
            {audit.executiveSummary}
          </p>
        </Card>
      )}

      {/* Архетипы «волка» */}
      {audit.archetypes && audit.archetypes.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader
            icon={Users}
            title="Архетипы «волка»"
            accent="5 типов · вероятность"
          />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {audit.archetypes
              .slice()
              .sort((a, b) => b.confidence - a.confidence)
              .map((a, i) => {
                const meta = ARCHETYPE_META[a.type];
                const barColor =
                  a.confidence >= 66
                    ? "bg-red-500"
                    : a.confidence >= 33
                    ? "bg-orange-500"
                    : "bg-emerald-500";
                return (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden>
                          {meta.icon}
                        </span>
                        <div>
                          <div className={cn("text-sm font-semibold", meta.color)}>
                            {meta.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {meta.short}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold">
                        {a.confidence}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full transition-all", barColor)}
                        style={{ width: `${a.confidence}%` }}
                      />
                    </div>
                    {a.justification && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {a.justification}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Injection warning */}
      {audit.injectionDetected && (
        <Card className="border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
            <div>
              <div className="font-semibold text-red-400">Обнаружена попытка prompt injection</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {audit.injectionNote || "В тексте резюме найдены инструкции, пытающиеся изменить поведение AI. Не доверяйте декларативным утверждениям — усильте документальную проверку."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Топ-3 findings */}
      {audit.topFindings && audit.topFindings.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader icon={AlertTriangle} title="Топ-3 наблюдения" accent="главные сигналы" />
          <ol className="mt-3 space-y-2">
            {audit.topFindings.slice(0, 3).map((f, i) => (
              <li key={i} className="flex gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
                <span className="font-mono text-xs text-orange-400">{i + 1}.</span>
                <div className="flex-1">
                  <div className="font-medium">{f.title}</div>
                  {f.quote && (
                    <div className="mt-1 border-l-2 border-orange-500/50 pl-2 text-xs italic text-muted-foreground">
                      «{f.quote}»
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Блок 1 — Временная шкала */}
      {(audit.timeline.length > 0 || audit.timelineAnomalies.length > 0) && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader icon={Clock} title="Хронология и временная шкала" accent="блок 1" />
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {audit.declaredTenureYears !== null && (
              <StatChip label="Декларировано" value={`${audit.declaredTenureYears} лет`} />
            )}
            {audit.calculatedTenureYears !== null && (
              <StatChip label="Подсчитано" value={`${audit.calculatedTenureYears} лет`} />
            )}
          </div>

          {audit.timeline.length > 0 && (
            <div className="mt-4 space-y-2">
              {audit.timeline.map((entry, i) => {
                const v = VERIFIABILITY_META[entry.verifiability];
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm"
                  >
                    <div className="min-w-[150px] font-mono text-xs text-muted-foreground">
                      {entry.period}
                      {entry.durationMonths != null && (
                        <span className="ml-2 opacity-70">· {entry.durationMonths} мес.</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium">{entry.role}</div>
                      <div className="text-xs text-muted-foreground">{entry.company}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                          v.color,
                        )}
                      >
                        {v.label}
                      </span>
                      {entry.verifiabilityReason && (
                        <span className="max-w-[200px] text-right text-[11px] text-muted-foreground">
                          {entry.verifiabilityReason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {audit.timelineAnomalies.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-orange-400">Аномалии хронологии</div>
              {audit.timelineAnomalies.map((a, i) => (
                <AnomalyRow key={i} type={a.type} description={a.description} quote={a.quote} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Блок 2 — Прогрессия */}
      {(audit.progressionLogic || audit.progressionAnomalies.length > 0) && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader icon={TrendingUp} title="Карьерная прогрессия" accent="блок 2" />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className={cn("font-semibold", progressionMeta.color)}>
              {progressionMeta.emoji} {progressionMeta.label}
            </span>
          </div>
          {audit.progressionLogic && (
            <p className="mt-2 text-sm text-muted-foreground">{audit.progressionLogic}</p>
          )}
          {audit.progressionAnomalies.length > 0 && (
            <div className="mt-3 space-y-2">
              {audit.progressionAnomalies.map((a, i) => (
                <AnomalyRow key={i} type={a.type} description={a.description} quote={a.quote} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Блок 3 — Работодатели */}
      {audit.employers.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader icon={Building2} title="Верификация работодателей" accent="блок 3" />
          <GrayRatioBar
            hardToVerify={audit.grayRatio.hardToVerify}
            total={audit.grayRatio.total}
          />
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {audit.employers.map((emp, i) => (
              <EmployerRow key={i} employer={emp} />
            ))}
          </div>
        </Card>
      )}

      {/* Блок 4 — Достижения */}
      {audit.achievementsAudit && audit.achievementsAudit.items.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader icon={Trophy} title="Аудит достижений" accent="блок 4" />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <StatChip
              label="Правдоподобность"
              value={`${audit.achievementsAudit.credibilityPercent}%`}
            />
            <AiGenerationBadge
              likelihood={audit.achievementsAudit.aiGenerationLikelihood}
              reason={audit.achievementsAudit.aiGenerationReason}
            />
          </div>
          <div className="mt-3 space-y-2">
            {audit.achievementsAudit.items.map((it, i) => (
              <AchievementRow key={i} item={it} />
            ))}
          </div>
        </Card>
      )}

      {/* Блок 5 — Навыки */}
      {audit.skillAudit &&
        (audit.skillAudit.issues.length > 0 ||
          audit.skillAudit.vacuumSkills.length > 0 ||
          audit.skillAudit.trustedSkills.length > 0) && (
          <Card className="border-card-border bg-card p-5">
            <SectionHeader icon={Wrench} title="Аудит навыков" accent="блок 5" />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {audit.skillAudit.trustedSkills.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-emerald-400">
                    Подтверждены опытом
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {audit.skillAudit.trustedSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {audit.skillAudit.vacuumSkills.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold text-orange-400">
                    «Пылесосные» / без опоры
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {audit.skillAudit.vacuumSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {audit.skillAudit.issues.length > 0 && (
              <div className="mt-4 space-y-2">
                {audit.skillAudit.issues.map((iss, i) => (
                  <SkillIssueRow key={i} issue={iss} />
                ))}
              </div>
            )}
          </Card>
        )}

      {/* Блок 6 — Wolf Signals (по 6 категориям) */}
      {audit.wolfSignals.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/[0.03] p-5">
          <SectionHeader
            icon={Activity}
            title="Сигналы «волка» по категориям"
            accent={`блок 6 · ${wolfMeta.icon} ${wolfMeta.label}`}
          />
          {audit.wolfInterpretation && (
            <p className="mt-2 text-sm text-muted-foreground">{audit.wolfInterpretation}</p>
          )}
          <div className="mt-4 space-y-4">
            {(
              [
                "frequency",
                "narrative",
                "self-presentation",
                "osint-divergence",
                "network",
                "behavior",
              ] as WolfSignalCategory[]
            ).map((cat) => {
              const items = audit.wolfSignals.filter((s) => s.category === cat);
              if (items.length === 0) return null;
              const meta = WOLF_SIGNAL_CATEGORY_META[cat];
              return (
                <div key={cat}>
                  <div className={cn("mb-2 flex items-center gap-2 text-xs font-semibold", meta.color)}>
                    <span aria-hidden>{meta.emoji}</span>
                    {meta.label}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      · {items.length}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((s, i) => {
                      const sev = SEVERITY_META[s.severity];
                      return (
                        <div
                          key={i}
                          className="rounded-md border border-orange-500/20 bg-background/50 p-3"
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span aria-hidden>🐺</span>
                              <span className="text-sm font-semibold">{s.title}</span>
                            </div>
                            <span
                              className={cn(
                                "rounded-full border px-1.5 py-0 font-mono text-[9px] uppercase tracking-widest",
                                sev.color,
                              )}
                            >
                              {sev.label}
                            </span>
                          </div>
                          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-orange-400">
                            {WOLF_SIGNAL_LABELS[s.type]}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                          {s.evidence && s.evidence.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {s.evidence.slice(0, 3).map((q, j) => (
                                <li
                                  key={j}
                                  className="border-l-2 border-orange-500/50 pl-2 text-[11px] italic text-muted-foreground"
                                >
                                  «{q}»
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* —— Подфича: Wolf School Detector (компактный подблок внутри секции «волков») —— */}
          {audit.schoolDetection && (
            <WolfSchoolBlock detection={audit.schoolDetection} />
          )}
        </Card>
      )}

      {/* Блок 8 — Вопросы-триплеты (opener → deepener → verifier) */}
      {audit.interviewTriplets.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader
            icon={MessageSquare}
            title="Вопросы-триплеты для интервью"
            accent="открыватель · углубитель · верификатор"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Методология STAR/PARLA: нейтральный opener приглашает к рассказу, deepener ловит
            противоречия, verifier требует конкретику — имена, кейсы, контакты для проверки.
          </p>
          <div className="mt-3 space-y-4">
            {audit.interviewTriplets.map((t, i) => {
              const opener = t.opener || t.direct || "";
              const deepener = t.deepener || t.indirect || "";
              const verifier = t.verifier || t.stress || "";
              return (
                <div key={i} className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="mb-2 text-xs font-semibold text-primary">
                    Аномалия: {t.anomaly}
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <TripletCell label="1. Открыватель" color="text-emerald-400" text={opener} />
                    <TripletCell label="2. Углубитель" color="text-yellow-400" text={deepener} />
                    <TripletCell label="3. Верификатор" color="text-red-400" text={verifier} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* OSINT checklist — 12 фиксированных источников с URL */}
      {audit.osintChecklist.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader
            icon={Search}
            title="OSINT-чек-лист"
            accent="12 источников · открытые данные"
          />
          <div className="mt-3 space-y-3">
            {(["must", "high", "medium", "situational"] as const).map((prio) => {
              const items = audit.osintChecklist.filter((x) => x.priority === prio);
              if (items.length === 0) return null;
              const meta = OSINT_PRIORITY_META[prio];
              return (
                <div key={prio}>
                  <div className={cn("mb-2 text-xs font-semibold", meta.color)}>
                    {meta.emoji} {meta.label}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((it, i) => (
                      <div key={i} className={cn("rounded-md border p-3", meta.bg)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">{it.source}</div>
                          {it.url && (
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-primary hover:underline"
                              data-testid={`link-osint-${it.id}`}
                            >
                              открыть
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {it.whatToCheck}
                        </div>
                        {it.expectedSignal && (
                          <div className="mt-2 rounded border border-orange-500/20 bg-orange-500/[0.04] p-2 text-[11px] text-orange-400/90">
                            <span className="font-semibold">Что ищем: </span>
                            {it.expectedSignal}
                          </div>
                        )}
                        {it.tool && (
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            tool: {it.tool}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Reference check + test tasks */}
      {(audit.referenceCheckNotes.length > 0 || audit.testTaskRecommendations.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {audit.referenceCheckNotes.length > 0 && (
            <Card className="border-card-border bg-card p-5">
              <SectionHeader icon={Eye} title="Reference check" accent="что спросить" />
              <ul className="mt-3 space-y-2 text-sm">
                {audit.referenceCheckNotes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">▸</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {audit.testTaskRecommendations.length > 0 && (
            <Card className="border-card-border bg-card p-5">
              <SectionHeader icon={Wrench} title="Тестовые задания" accent="что поручить" />
              <ul className="mt-3 space-y-2 text-sm">
                {audit.testTaskRecommendations.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">▸</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Polygraph triggers — 4 типа: relevant / control / comparison / behavioral */}
      {audit.polygraphTriggers.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <SectionHeader
            icon={Shield}
            title="Триггеры для профайлинга"
            accent="4 типа вопросов"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Релевантные — прямо по флагам. Контрольные — базовая линия честности.
            Сравнительные — поиск аномалий реакции. Поведенческие — паттерны прошлого.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {audit.polygraphTriggers.map((t, i) => {
              const kindMeta = t.kind ? POLYGRAPH_KIND_META[t.kind] : null;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-md border p-3",
                    t.applies
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-border bg-muted/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {t.applies ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        {kindMeta && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0 font-mono text-[9px] uppercase tracking-widest",
                              kindMeta.color,
                            )}
                          >
                            <span aria-hidden>{kindMeta.icon}</span>
                            {kindMeta.label}
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "mt-1 font-medium",
                          t.applies ? "" : "text-muted-foreground",
                        )}
                      >
                        {t.trigger}
                      </div>
                      {t.question && (
                        <div className="mt-2 rounded border border-border bg-background/60 p-2 text-xs italic">
                          «{t.question}»
                        </div>
                      )}
                      {t.note && (
                        <div className="mt-1 text-xs text-muted-foreground">{t.note}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Positive markers */}
      {audit.positiveMarkers.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.03] p-5">
          <SectionHeader
            icon={Sparkles}
            title="Позитивные маркеры"
            accent="в пользу кандидата"
          />
          <ul className="mt-3 space-y-1.5 text-sm">
            {audit.positiveMarkers.map((m, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

// ========== Вспомогательные компоненты ==========

function SectionHeader({
  icon: Icon,
  title,
  accent,
}: {
  icon: typeof Shield;
  title: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <div className="font-semibold">{title}</div>
      <div className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {accent}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  emoji,
  value,
  subtitle,
  color,
  bg,
  border,
  testId,
}: {
  label: string;
  emoji: string;
  value: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-[130px] rounded-lg border p-3 text-center",
        bg,
        border,
      )}
      data-testid={testId}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 flex items-center justify-center gap-1 text-2xl font-bold", color)}>
        <span aria-hidden>{emoji}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className={cn("mt-0.5 text-xs", color)}>{subtitle}</div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-0.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-mono font-semibold">{value}</span>
    </span>
  );
}

function AnomalyRow({
  type,
  description,
  quote,
}: {
  type: TimelineAnomaly["type"] | ProgressionAnomaly["type"];
  description: string;
  quote?: string;
}) {
  return (
    <div className="rounded-md border border-orange-500/20 bg-orange-500/[0.04] p-3 text-sm">
      <div className="mb-1 flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-orange-400">
          {type}
        </span>
      </div>
      <p>{description}</p>
      {quote && (
        <div className="mt-1 border-l-2 border-orange-500/50 pl-2 text-xs italic text-muted-foreground">
          «{quote}»
        </div>
      )}
    </div>
  );
}

function GrayRatioBar({ hardToVerify, total }: { hardToVerify: number; total: number }) {
  const pct = total > 0 ? Math.round((hardToVerify / total) * 100) : 0;
  const color =
    pct >= 60 ? "bg-red-500" : pct >= 30 ? "bg-orange-500" : "bg-emerald-500";
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Трудно верифицируемых работодателей
        </span>
        <span className="font-mono font-semibold">
          {hardToVerify} / {total} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EmployerRow({ employer }: { employer: EmployerCheck }) {
  const riskColor = {
    low: "text-emerald-400",
    medium: "text-yellow-400",
    high: "text-red-400",
  }[employer.verificationRisk];
  const statusLabels: Record<EmployerCheck["status"], string> = {
    known: "Известная компания",
    startup: "Стартап",
    closed: "Закрыта",
    foreign: "Зарубежная",
    freelance: "Фриланс / ИП",
    unclear: "Неясно",
  };
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">{employer.name}</div>
        <span className={cn("font-mono text-[10px] uppercase tracking-widest", riskColor)}>
          {employer.verificationRisk}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {statusLabels[employer.status]}
      </div>
      {employer.note && (
        <p className="mt-1 text-xs text-muted-foreground">{employer.note}</p>
      )}
    </div>
  );
}

function AiGenerationBadge({
  likelihood,
  reason,
}: {
  likelihood: "yes" | "no" | "probable";
  reason?: string;
}) {
  const meta = {
    yes: { label: "AI-текст: да", color: "text-red-400 border-red-500/40 bg-red-500/10" },
    probable: { label: "AI-текст: вероятно", color: "text-orange-400 border-orange-500/40 bg-orange-500/10" },
    no: { label: "AI-текст: нет", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  }[likelihood];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        meta.color,
      )}
      title={reason}
    >
      {meta.label}
    </span>
  );
}

function AchievementRow({ item }: { item: AchievementItem }) {
  const isVerifiable = item.kind === "verifiable";
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        isVerifiable
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-orange-500/20 bg-orange-500/[0.04]",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        {isVerifiable ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
        )}
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            isVerifiable ? "text-emerald-400" : "text-orange-400",
          )}
        >
          {isVerifiable ? "верифицируемо" : "декларативно"}
        </span>
      </div>
      <p>{item.text}</p>
      {item.reason && (
        <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
      )}
    </div>
  );
}

function SkillIssueRow({ issue }: { issue: SkillIssue }) {
  const labels: Record<SkillIssue["issue"], string> = {
    "no-evidence": "нет подтверждения",
    incompatible: "несовместимо",
    overclaim: "завышение",
    "no-depth": "нет глубины",
    vacuum: "вакуум",
  };
  return (
    <div className="rounded-md border border-orange-500/20 bg-orange-500/[0.04] p-3 text-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold">{issue.skill}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-orange-400">
          {labels[issue.issue]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{issue.description}</p>
    </div>
  );
}

function TripletCell({
  label,
  color,
  text,
}: {
  label: string;
  color: string;
  text: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-2.5">
      <div className={cn("mb-1 font-mono text-[10px] uppercase tracking-widest", color)}>
        {label}
      </div>
      <p className="text-xs">{text}</p>
    </div>
  );
}

// ========== Wolf School Detector (компактный подблок) ==========

const WOLF_SCHOOL_META: Record<
  WolfSchoolCode,
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  "ОМ":   { label: "Осознанная меркантильность",    short: "ОМ",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
  "НА":   { label: "Взламываем найм",          short: "НА",  color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  "ЛЕГ":  { label: "Легенда-фабрика",           short: "ЛЕГ", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  "ОЭ":   { label: "Оверэмплоймент",           short: "ОЭ",  color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
  "АТС":  { label: "ATS-оптимизаторы",         short: "АТС", color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30" },
  "?":    { label: "Не идентифицирована",        short: "?",   color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border" },
  "none": { label: "Нет признаков школы",     short: "—",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
};

const OVEREMPLOYMENT_META: Record<OveremploymentRisk, { label: string; color: string }> = {
  yes:     { label: "Оверэмплоймент да", color: "text-red-400" },
  suspect: { label: "Подозрение",         color: "text-yellow-400" },
  no:      { label: "Не обнаружен",      color: "text-emerald-400" },
};

function WolfSchoolBlock({ detection }: { detection: WolfSchoolDetection }) {
  const meta = WOLF_SCHOOL_META[detection.schoolIndex] || WOLF_SCHOOL_META["none"];
  const oe = OVEREMPLOYMENT_META[detection.overemploymentRisk];
  return (
    <div className="mt-5 rounded-md border border-dashed border-orange-500/30 bg-background/40 p-3">
      {/* Заголовок подсекции */}
      <div className="mb-2 flex items-center gap-2">
        <GraduationCap className="h-3.5 w-3.5 text-orange-400" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
          Wolf School Detector
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">подфича</span>
      </div>

      {/* Бэджи в одну линию */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={cn("rounded-full border px-2 py-0.5 font-mono font-semibold", meta.bg, meta.color, meta.border)}>
          {meta.short} · {meta.label}
        </span>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-muted-foreground">
          confidence {detection.confidence}%
        </span>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-muted-foreground">
          Ideology {detection.ideologicalMatch}/5
        </span>
        <span className={cn("rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono", oe.color)}>
          {oe.label}
        </span>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-muted-foreground">
          Network L{detection.networkRiskLevel}
        </span>
      </div>

      {/* Короткое justification */}
      {detection.justification && (
        <p className="mt-2 text-xs text-muted-foreground">{detection.justification}</p>
      )}

      {/* Компактные примечания по overemployment / network, если есть */}
      {(detection.overemploymentEvidence || detection.networkRiskNote || detection.ideologicalMatchNote) && (
        <div className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground md:grid-cols-3">
          {detection.overemploymentEvidence && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Overemployment</span>
              <p>{detection.overemploymentEvidence}</p>
            </div>
          )}
          {detection.networkRiskNote && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Network</span>
              <p>{detection.networkRiskNote}</p>
            </div>
          )}
          {detection.ideologicalMatchNote && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-orange-400">Ideology</span>
              <p>{detection.ideologicalMatchNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Маркеры — чипы */}
      {detection.markers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {detection.markers.map((m, i) => (
            <span
              key={i}
              className="rounded-sm border border-orange-500/20 bg-orange-500/5 px-1.5 py-0.5 font-mono text-[10px] text-orange-300"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Школьные триплеты — сжато в одну строку на вопрос */}
      {detection.schoolTriplets.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-orange-400">
            Специализированные триплеты
          </div>
          {detection.schoolTriplets.map((t, i) => {
            const opener = t.opener || t.direct || "";
            const deepener = t.deepener || t.indirect || "";
            const verifier = t.verifier || t.stress || "";
            return (
              <div key={i} className="rounded border border-border bg-background/50 p-2 text-[11px]">
                {t.anomaly && (
                  <div className="mb-1 text-[10px] font-semibold text-primary">{t.anomaly}</div>
                )}
                {opener && <p className="text-muted-foreground"><span className="text-emerald-400">→</span> {opener}</p>}
                {deepener && <p className="text-muted-foreground"><span className="text-yellow-400">→</span> {deepener}</p>}
                {verifier && <p className="text-muted-foreground"><span className="text-red-400">→</span> {verifier}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
