import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  SingleStepReport,
  VerificationStatus,
  ResolutionCode,
  KeyFinding,
  LinguisticAudit,
  LinguisticAuditVerdict,
  RmBlockScore,
  AcidBlockClassification,
} from "@/lib/types";
import type { FullReport, TeamFitReport, GitHubDeepScanReport } from "@shared/schema";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Gauge,
  Compass,
  FileText,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarRange,
  Brain,
  Eye,
  BookText,
  ClipboardCheck,
  Layers,
  Download,
  Users,
  Github,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Идет слово по уровню образования
function levelLabel(level: string): string {
  switch (level) {
    case "bachelor": return "бакалавр";
    case "master": return "магистр";
    case "specialist": return "специалитет";
    case "phd": return "PhD/кандидат";
    case "college": return "колледж";
    case "school": return "школа";
    case "high": return "высшее";
    case "secondary": return "среднее";
    case "courses": return "курсы";
    default: return level;
  }
}

// Формат месяцев в «2 г 3 мес»
function formatMonths(m: number): string {
  if (m < 12) return `${m} мес`;
  const years = Math.floor(m / 12);
  const months = m % 12;
  if (months === 0) return `${years} г`;
  return `${years} г ${months} мес`;
}

function findingIcon(type: KeyFinding["type"]) {
  if (type === "strength") return TrendingUp;
  if (type === "risk") return TrendingDown;
  return Minus;
}
function findingTone(type: KeyFinding["type"]) {
  if (type === "strength") return "border-emerald-500/30 bg-emerald-500/5 text-emerald-300";
  if (type === "risk") return "border-red-500/30 bg-red-500/5 text-red-300";
  return "border-card-border bg-background/40 text-muted-foreground";
}
function moduleLabel(mod: KeyFinding["module"]): string {
  switch (mod) {
    case "verification": return "Верификация";
    case "motivation": return "Мотивация";
    case "loyalty": return "Лояльность";
  }
}

// ==========================================================
// Вспомогательное
// ==========================================================

function resolutionTone(code: ResolutionCode) {
  switch (code) {
    case "RECOMMENDED":
      return {
        icon: CheckCircle2,
        badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        border: "border-emerald-500/50",
        glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.3)]",
      };
    case "CONDITIONAL":
      return {
        icon: AlertTriangle,
        badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        border: "border-amber-500/50",
        glow: "shadow-[0_0_0_1px_rgba(245,158,11,0.3)]",
      };
    case "UNVERIFIED":
      return {
        icon: HelpCircle,
        badge: "border-sky-500/40 bg-sky-500/10 text-sky-300",
        border: "border-sky-500/50",
        glow: "shadow-[0_0_0_1px_rgba(14,165,233,0.3)]",
      };
    case "NOT_RECOMMENDED":
      return {
        icon: XCircle,
        badge: "border-red-500/50 bg-red-500/10 text-red-300",
        border: "border-red-500/60",
        glow: "shadow-[0_0_0_1px_rgba(239,68,68,0.35)]",
      };
  }
}

function statusBadge(s: VerificationStatus): { text: string; className: string } {
  switch (s) {
    case "confirmed":
      return { text: "✅ Подтверждено", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
    case "partial":
      return { text: "⚠️ Частично", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
    case "conflict":
      return { text: "🔴 Расхождение", className: "border-red-500/50 bg-red-500/10 text-red-300" };
    case "not_checked":
      return { text: "⬜ Не проверялось", className: "border-muted bg-muted/30 text-muted-foreground" };
  }
}

function scoreBar(score: number, total = 100): string {
  const pct = Math.max(0, Math.min(100, (score / total) * 100));
  return `${pct.toFixed(0)}%`;
}

// ==========================================================
// Основной компонент
// ==========================================================

export function PipelineReport({
  report,
  parentCheckId,
  candidateDisplayName,
  pipelineId,
}: {
  report: SingleStepReport;
  parentCheckId?: string;
  candidateDisplayName?: string | null;
  pipelineId?: string;
}) {
  const tone = resolutionTone(report.resolution.code);
  const Icon = tone.icon;
  const vBadge = statusBadge(report.verification.status);

  // Подгружаем все отчёты карточки, если задан parentCheckId
  const baseCheckQuery = useQuery<{
    id: string;
    createdAt: number;
    candidateName: string | null;
    resumeText: string;
    report: FullReport;
  }>({
    queryKey: ["/api/checks", parentCheckId],
    enabled: Boolean(parentCheckId),
  });
  const teamFitQuery = useQuery<TeamFitReport | null>({
    queryKey: ["/api/checks", parentCheckId, "team-fit"],
    enabled: Boolean(parentCheckId),
  });
  const githubDeepQuery = useQuery<GitHubDeepScanReport | null>({
    queryKey: ["/api/checks", parentCheckId, "github-deepscan"],
    enabled: Boolean(parentCheckId),
  });

  const baseCheck = baseCheckQuery.data;
  const teamFit = teamFitQuery.data || null;
  const githubDeep = githubDeepQuery.data || null;

  return (
    <div className="space-y-5">
      {/* Сводка по карточке кандидата (все вкладки) */}
      {parentCheckId && (
        <CandidateDossierSummary
          parentCheckId={parentCheckId}
          pipelineId={pipelineId}
          pipelineReport={report}
          candidateDisplayName={candidateDisplayName}
          baseReport={baseCheck?.report || null}
          teamFit={teamFit}
          githubDeep={githubDeep}
        />
      )}

      {/* Executive Summary — сводка для руководителя */}
      {report.executiveSummary && (
        <Card className="border-card-border bg-gradient-to-br from-primary/5 via-background to-background p-5" data-testid="card-executive-summary">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Сводка для руководителя
            </div>
            {report.executiveSummary.consistency.status !== "ok" && (
              <span
                className={`ml-auto rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                  report.executiveSummary.consistency.status === "conflict"
                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
                data-testid="badge-consistency"
              >
                {report.executiveSummary.consistency.status === "conflict"
                  ? "⚠ Противоречия в данных"
                  : "⚠ Есть несостыковки"}
              </span>
            )}
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight" data-testid="text-executive-headline">
            {report.executiveSummary.headline}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground" data-testid="text-executive-paragraph">
            {report.executiveSummary.paragraph}
          </p>
          {report.executiveSummary.keyFindings.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {report.executiveSummary.keyFindings.map((f, i) => {
                const FIcon = findingIcon(f.type);
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md border p-2.5 ${findingTone(f.type)}`}
                    data-testid={`finding-${i}`}
                  >
                    <FIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="flex-1 text-xs">
                      <div className="font-mono text-[9px] uppercase tracking-widest opacity-70">
                        {moduleLabel(f.module)}
                      </div>
                      <div className="mt-0.5">{f.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {report.executiveSummary.consistency.notes.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
                Замечания по согласованности
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-200/90">
                {report.executiveSummary.consistency.notes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Финальная резолюция */}
      <Card className={`border-2 ${tone.border} ${tone.glow} bg-gradient-to-br from-background via-background to-background/50 p-6`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${tone.badge}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Итоговая резолюция · Single-Step v3.0
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight" data-testid="text-resolution-label">
              {report.resolution.label}
            </div>
            <p className="mt-2 text-sm text-muted-foreground" data-testid="text-resolution-reason">
              {report.resolution.reason}
            </p>
            {report.resolution.blockingFactor && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-red-300">
                <XCircle className="h-3 w-3" /> Блокирующий фактор: {report.resolution.blockingFactor}
              </div>
            )}
          </div>
          <div className="shrink-0 rounded-xl border border-card-border bg-background/60 px-4 py-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Composite Score
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums" data-testid="text-composite-score">
              {report.compositeScore}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">из 100</div>
          </div>
        </div>

        {/* Условия */}
        {report.resolution.conditions.length > 0 && (
          <div className="mt-5 rounded-md border border-card-border bg-background/50 p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <FileText className="h-3 w-3" /> Условия / что сделать до оффера
            </div>
            <ul className="space-y-1.5 text-sm">
              {report.resolution.conditions.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 3 модуля — сетка */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. Верификация */}
        <Card className="border-card-border bg-card p-5" data-testid="card-verification">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div className="font-semibold">Верификация опыта</div>
            </div>
            <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${vBadge.className}`}>
              {vBadge.text}
            </span>
          </div>
          {report.verification.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{report.verification.summary}</p>
          )}
          {report.verification.items.length > 0 && (
            <div className="mt-3 space-y-2">
              {report.verification.items.slice(0, 8).map((it, i) => {
                const b = statusBadge(it.status);
                return (
                  <div
                    key={i}
                    className="rounded-md border border-card-border bg-background/40 p-3 text-sm"
                    data-testid={`verification-item-${i}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-medium">{it.company}</div>
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${b.className}`}>
                        {b.text}
                      </span>
                    </div>
                    {it.position && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{it.position}</div>
                    )}
                    <div className="mt-1.5 grid gap-1 text-xs sm:grid-cols-2">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Резюме · </span>
                        {it.declared}
                      </div>
                      {it.etk && (
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">ЭТК · </span>
                          {it.etk}
                        </div>
                      )}
                    </div>
                    {it.note && <div className="mt-1.5 text-[11px] text-muted-foreground">{it.note}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {!report.verification.etkAvailable && (
            <div className="mt-3 rounded-md border border-sky-500/30 bg-sky-500/5 p-2 text-xs text-sky-300">
              ЭТК не предоставлена — верификация опыта невозможна, это может повлиять на резолюцию (UNVERIFIED).
            </div>
          )}
        </Card>

        {/* 2. Мотивация */}
        <Card className="border-card-border bg-card p-5" data-testid="card-motivation">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-amber-400" />
              <div className="font-semibold">Мотивация</div>
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-amber-300">
              {report.motivation.score}
            </div>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-amber-500" style={{ width: scoreBar(report.motivation.score) }} />
          </div>
          {report.motivation.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{report.motivation.summary}</p>
          )}
          <div className="mt-3 grid gap-2 text-xs">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Слова кандидата: </span>
              {report.motivation.declaredReason || "—"}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Согласованность с рекрутером:</span>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                  report.motivation.reasonConsistency === "match"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : report.motivation.reasonConsistency === "partial"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
                }`}
              >
                {report.motivation.reasonConsistency === "match"
                  ? "совпадает"
                  : report.motivation.reasonConsistency === "partial"
                  ? "частично"
                  : "расхождение"}
              </span>
            </div>
            {report.motivation.urgencyNote && (
              <div className="text-muted-foreground">
                <span className="font-mono text-[10px] uppercase tracking-widest">Прессинг: </span>
                {report.motivation.urgencyNote}
              </div>
            )}
          </div>
          {(report.motivation.redFlags.length > 0 || report.motivation.greenFlags.length > 0) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {report.motivation.redFlags.length > 0 && (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-300">Red flags</div>
                  <ul className="space-y-1 text-xs">
                    {report.motivation.redFlags.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.motivation.greenFlags.length > 0 && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300">Green flags</div>
                  <ul className="space-y-1 text-xs">
                    {report.motivation.greenFlags.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 3. Лояльность */}
        <Card className="border-card-border bg-card p-5" data-testid="card-loyalty">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-400" />
              <div className="font-semibold">Лояльность и стабильность (ILS)</div>
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-cyan-300">
              {report.loyalty.score}
            </div>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-cyan-500" style={{ width: scoreBar(report.loyalty.score) }} />
          </div>
          {report.loyalty.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{report.loyalty.summary}</p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "История", val: report.loyalty.sHistory, w: "40%" },
              { label: "Рекрутер", val: report.loyalty.sRecruiter, w: "35%" },
              { label: "Язык", val: report.loyalty.sLanguage, w: "25%" },
            ].map((b) => (
              <div key={b.label} className="rounded-md border border-card-border bg-background/40 p-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {b.label} · {b.w}
                </div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{b.val}</div>
              </div>
            ))}
          </div>
          {report.loyalty.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {report.loyalty.flags.map((f, i) => (
                <span
                  key={i}
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Лингвистический аудит (4 методологии) */}
      {report.linguisticAudit && <LinguisticSection audit={report.linguisticAudit} />}

      {/* Хронология опыта (локальные метрики) */}
      {report.timeline && report.timeline.spans.length > 0 && (
        <Card className="border-card-border bg-card p-5" data-testid="card-timeline">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              <div className="font-semibold">Хронология опыта</div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Источник: {report.timeline.source.toUpperCase()}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-card-border bg-background/40 p-2.5 text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Общий стаж</div>
              <div className="mt-0.5 text-base font-bold">{formatMonths(report.timeline.totalMonths)}</div>
            </div>
            <div className="rounded-md border border-card-border bg-background/40 p-2.5 text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Позиций</div>
              <div className="mt-0.5 text-base font-bold">{report.timeline.jobsCount}</div>
            </div>
            <div className="rounded-md border border-card-border bg-background/40 p-2.5 text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Средняя</div>
              <div className="mt-0.5 text-base font-bold">{formatMonths(report.timeline.avgMonths)}</div>
            </div>
            <div className="rounded-md border border-card-border bg-background/40 p-2.5 text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Коротких &lt;12м</div>
              <div className={`mt-0.5 text-base font-bold ${report.timeline.shortStintsCount > 0 ? "text-amber-300" : ""}`}>{report.timeline.shortStintsCount}</div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {report.timeline.spans.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 rounded border border-card-border bg-background/30 px-3 py-1.5 text-xs">
                <div className="flex-1 truncate">
                  <span className="font-medium">{s.company}</span>
                  {s.position && <span className="text-muted-foreground"> · {s.position}</span>}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {s.startISO ?? "?"} — {s.endISO ?? "наст.время"}
                </div>
                <div className={`shrink-0 font-mono text-[10px] tabular-nums ${s.months !== null && s.months < 12 ? "text-amber-300" : "text-muted-foreground"}`}>
                  {s.months !== null ? formatMonths(s.months) : "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Образование — для сравнения с периодами работы */}
          {report.timeline.education && report.timeline.education.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <BookText className="h-4 w-4 text-primary/80" />
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Образование</div>
              </div>
              <div className="space-y-1.5">
                {report.timeline.education.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2 rounded border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
                    <div className="flex-1 truncate">
                      <span className="font-medium">{e.institution}</span>
                      {e.field && <span className="text-muted-foreground"> · {e.field}</span>}
                      {e.level && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary/80">{levelLabel(e.level)}</span>}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {e.startISO ?? "?"} — {e.endISO ?? "по наст.время"}
                    </div>
                    <div className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {typeof e.months === "number" && e.months > 0 ? formatMonths(e.months) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Формула */}
      <Card className="border-card-border bg-card/50 p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Composite Score · формула
        </div>
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          CS = 0.40 · ({report.motivation.score}/100) + 0.60 · ({report.loyalty.score}/100) = <span className="font-bold text-foreground">{report.compositeScore}</span>
        </div>
      </Card>

      {report.rawAnalysisNote && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
          {report.rawAnalysisNote}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Linguistic Audit section (4 methodologies)
// ============================================================

function verdictTone(v: LinguisticAuditVerdict | "real" | "ambiguous" | "constructed" | "honest" | "mixed" | "fabricated") {
  // green=honest/real, yellow=mixed/ambiguous, orange=constructed, red=fabricated
  if (v === "honest" || v === "real") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (v === "mixed" || v === "ambiguous") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (v === "constructed") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function verdictLabel(v: LinguisticAuditVerdict | "real" | "ambiguous" | "constructed"): string {
  switch (v) {
    case "honest": return "честный нарратив";
    case "real": return "реальный опыт";
    case "mixed": return "смешанный";
    case "ambiguous": return "неоднозначный";
    case "constructed": return "сконструирован";
    case "fabricated": return "фальсификация";
    default: return String(v);
  }
}

export function LinguisticSection({ audit }: { audit: LinguisticAudit }) {
  const [open, setOpen] = useState<"liwc" | "rm" | "cl" | "acid" | null>("liwc");
  const toggle = (k: "liwc" | "rm" | "cl" | "acid") => setOpen(open === k ? null : k);

  return (
    <Card className="border-card-border bg-card p-5" data-testid="card-linguistic">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          <div className="font-semibold">Лингвистический аудит · 4 методологии</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(audit.verdict)}`}>
            {verdictLabel(audit.verdict)}
          </span>
          <div className="font-mono text-base font-bold tabular-nums text-violet-300" title="Лингвистический риск">
            {audit.linguisticRisk}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{audit.headline}</p>
      <p className="mt-1 text-xs text-muted-foreground">{audit.summary}</p>

      <div className="mt-4 grid gap-2">
        {/* LIWC */}
        <button
          type="button"
          onClick={() => toggle("liwc")}
          className="flex w-full items-center justify-between rounded-md border border-card-border bg-background/40 px-3 py-2 text-left transition hover:bg-background/60"
          data-testid="btn-liwc-toggle"
        >
          <div className="flex items-center gap-2">
            <BookText className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-medium">LIWC · психолингвистический профиль</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">риск {audit.liwc.riskScore}</span>
        </button>
        {open === "liwc" && (
          <div className="rounded-md border border-card-border bg-background/30 p-3 text-xs">
            <p className="mb-2 text-muted-foreground">{audit.liwc.summary}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {[
                ["«я»", audit.liwc.rates.firstPersonSingular],
                ["«мы»", audit.liwc.rates.firstPersonPlural],
                ["3-е лицо", audit.liwc.rates.thirdPerson],
                ["нег. эмоции", audit.liwc.rates.negativeEmotions],
                ["поз. эмоции", audit.liwc.rates.positiveEmotions],
                ["исключители", audit.liwc.rates.exclusives],
                ["функц. слова", audit.liwc.rates.functionWords],
                ["когн. механ.", audit.liwc.rates.cognitiveMechanisms],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded border border-card-border bg-background/50 p-1.5 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
                  <div className="font-mono text-sm font-bold tabular-nums">{val}%</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {audit.liwc.markers.iDominant && <Chip label="я-доминирование" tone="orange" />}
              {audit.liwc.markers.weDominant && <Chip label="мы-доминирование" tone="green" />}
              {audit.liwc.markers.blamesOthers && <Chip label="обвинение других" tone="red" />}
              {audit.liwc.markers.emotionalNegative && <Chip label="негативный аффект" tone="orange" />}
              {audit.liwc.markers.highExclusives && <Chip label="высокие исключители (Newman 2003)" tone="red" />}
              {audit.liwc.markers.lowCognitiveComplexity && <Chip label="низкая когнитивная сложность" tone="orange" />}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Всего токенов: {audit.liwc.counters.totalTokens}. Методология: Pennebaker, Booth &amp; Francis (2003); Newman et al. (2003).
            </p>
          </div>
        )}

        {/* Reality Monitoring */}
        <button
          type="button"
          onClick={() => toggle("rm")}
          className="flex w-full items-center justify-between rounded-md border border-card-border bg-background/40 px-3 py-2 text-left transition hover:bg-background/60"
          data-testid="btn-rm-toggle"
        >
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium">Reality Monitoring · 6 критериев по блокам</span>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(audit.realityMonitoring.verdict)}`}>
            {verdictLabel(audit.realityMonitoring.verdict)} · {audit.realityMonitoring.averageScore}/12
          </span>
        </button>
        {open === "rm" && (
          <div className="rounded-md border border-card-border bg-background/30 p-3 text-xs">
            <p className="mb-2 text-muted-foreground">{audit.realityMonitoring.summary}</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-card-border text-left text-muted-foreground">
                    <th className="py-1.5 pr-2">Блок</th>
                    <th className="px-1.5 text-center">Сенс.</th>
                    <th className="px-1.5 text-center">Простр.</th>
                    <th className="px-1.5 text-center">Время</th>
                    <th className="px-1.5 text-center">Аффект</th>
                    <th className="px-1.5 text-center">Логика</th>
                    <th className="px-1.5 text-center">Self</th>
                    <th className="px-1.5 text-center">Σ</th>
                    <th className="px-1.5 text-right">Вердикт</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.realityMonitoring.blocks.map((b: RmBlockScore, i) => (
                    <tr key={i} className="border-b border-card-border/40">
                      <td className="py-1.5 pr-2 font-medium">{b.label}</td>
                      <td className="px-1.5 text-center font-mono tabular-nums">{b.sensoryDetails}</td>
                      <td className="px-1.5 text-center font-mono tabular-nums">{b.spatialContext}</td>
                      <td className="px-1.5 text-center font-mono tabular-nums">{b.temporalContext}</td>
                      <td className="px-1.5 text-center font-mono tabular-nums">{b.affect}</td>
                      <td className="px-1.5 text-center font-mono tabular-nums">{b.logicalCoherence}</td>
                      <td className="px-1.5 text-center font-mono tabular-nums">{b.selfReference}</td>
                      <td className="px-1.5 text-center font-mono font-bold tabular-nums">{b.totalScore}</td>
                      <td className="px-1.5 text-right">
                        <span className={`rounded-full border px-1.5 py-0.5 ${verdictTone(b.verdict)}`}>
                          {verdictLabel(b.verdict)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Каждый критерий: 0 (нет) · 1 (частично) · 2 (ярко). Сумма ≥9 = реальный опыт, 5–8 неоднозначно, ≤4 сконструировано. Методология: Johnson &amp; Raye (1981).
            </p>
          </div>
        )}

        {/* Cognitive Load */}
        <button
          type="button"
          onClick={() => toggle("cl")}
          className="flex w-full items-center justify-between rounded-md border border-card-border bg-background/40 px-3 py-2 text-left transition hover:bg-background/60"
          data-testid="btn-cl-toggle"
        >
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium">Cognitive Load · маркеры перегрузки</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">риск {audit.cognitiveLoad.riskScore}</span>
        </button>
        {open === "cl" && (
          <div className="rounded-md border border-card-border bg-background/30 p-3 text-xs">
            <p className="mb-2 text-muted-foreground">{audit.cognitiveLoad.summary}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className="rounded border border-card-border bg-background/50 p-1.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Хеджирование</div>
                <div className="font-mono text-sm font-bold tabular-nums">{audit.cognitiveLoad.hedgingCount}</div>
              </div>
              <div className="rounded border border-card-border bg-background/50 p-1.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Противоречия</div>
                <div className="font-mono text-sm font-bold tabular-nums">{audit.cognitiveLoad.contradictionsCount}</div>
              </div>
              <div className="rounded border border-card-border bg-background/50 p-1.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Симметрия</div>
                <div className={`font-mono text-sm font-bold tabular-nums ${audit.cognitiveLoad.structuralSymmetry > 60 ? "text-orange-300" : ""}`}>
                  {audit.cognitiveLoad.structuralSymmetry}%
                </div>
              </div>
              <div className="rounded border border-card-border bg-background/50 p-1.5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Шаблонов</div>
                <div className="font-mono text-sm font-bold tabular-nums">{audit.cognitiveLoad.repetitivePatterns.length}</div>
              </div>
            </div>
            {audit.cognitiveLoad.symmetryNote && (
              <p className="mt-2 text-[11px] text-muted-foreground">{audit.cognitiveLoad.symmetryNote}</p>
            )}
            {audit.cognitiveLoad.hedgingExamples.length > 0 && (
              <div className="mt-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Примеры хеджирования</div>
                <ul className="mt-1 space-y-0.5">
                  {audit.cognitiveLoad.hedgingExamples.map((ex, i) => (
                    <li key={i} className="text-[11px] italic text-muted-foreground">«{ex}»</li>
                  ))}
                </ul>
              </div>
            )}
            {audit.cognitiveLoad.contradictions.length > 0 && (
              <div className="mt-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Противоречия</div>
                <ul className="mt-1 space-y-0.5">
                  {audit.cognitiveLoad.contradictions.map((c, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">
                      <span className="text-emerald-300">«{c.claim}»</span> vs <span className="text-red-300">«{c.counter}»</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Методология: Vrij (2008) «Lying Is Harder Than Truth». Высокая структурная симметрия (&gt;60%) — признак шаблонного или скопированного описания.
            </p>
          </div>
        )}

        {/* ACID */}
        <button
          type="button"
          onClick={() => toggle("acid")}
          className="flex w-full items-center justify-between rounded-md border border-card-border bg-background/40 px-3 py-2 text-left transition hover:bg-background/60"
          data-testid="btn-acid-toggle"
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-pink-400" />
            <span className="text-sm font-medium">ACID · классификация нарратива</span>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(audit.acid.overallVerdict)}`}>
            {verdictLabel(audit.acid.overallVerdict)}
          </span>
        </button>
        {open === "acid" && (
          <div className="rounded-md border border-card-border bg-background/30 p-3 text-xs">
            <p className="mb-2 text-muted-foreground">{audit.acid.summary}</p>
            <div className="grid gap-2">
              {audit.acid.blocks.map((b: AcidBlockClassification, i) => (
                <div key={i} className="rounded border border-card-border bg-background/50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{b.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{b.honestScore}/10</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${verdictTone(b.verdict)}`}>
                        {verdictLabel(b.verdict)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 sm:grid-cols-5">
                    {b.criteria.map((c) => (
                      <div
                        key={c.key}
                        className={`rounded border px-1.5 py-1 text-[10px] ${
                          c.honestIndicator
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-red-500/20 bg-red-500/5 text-red-300/70"
                        }`}
                        title={c.evidence || ""}
                      >
                        {c.honestIndicator ? "✓" : "✗"} {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Методология: Steller &amp; Köhnken (1989), Criteria-Based Content Analysis. 10 критериев честного нарратива: ≥8 = честный, 5–7 смешанный, 3–4 сконструирован, ≤2 фальсификация.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function Chip({ label, tone }: { label: string; tone: "green" | "orange" | "red" }) {
  const cls =
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "orange"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
      : "border-red-500/30 bg-red-500/10 text-red-300";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{label}</span>;
}

// ==========================================================
// Сводка по карточке кандидата + кнопка скачать все отчёты одним файлом
// ==========================================================

function verdictBadgeBase(v: "green" | "yellow" | "red") {
  switch (v) {
    case "green":
      return { label: "✅ Зелёный", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
    case "yellow":
      return { label: "⚠️ Жёлтый", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
    case "red":
      return { label: "⛔ Красный", cls: "border-red-500/50 bg-red-500/10 text-red-300" };
  }
}

function resolutionBadge(code: ResolutionCode) {
  switch (code) {
    case "RECOMMENDED":
      return { label: "Рекомендован", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
    case "CONDITIONAL":
      return { label: "Условно", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
    case "UNVERIFIED":
      return { label: "Не проверено", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" };
    case "NOT_RECOMMENDED":
      return { label: "Не рекомендован", cls: "border-red-500/50 bg-red-500/10 text-red-300" };
  }
}

type SummaryTabRow = {
  key: string;
  title: string;
  icon: any;
  available: boolean;
  primary: string;   // вердикт / score
  secondary: string; // короткий комментарий
  tone: "green" | "yellow" | "red" | "neutral";
};

function toneClasses(t: SummaryTabRow["tone"]) {
  switch (t) {
    case "green":
      return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
    case "yellow":
      return "border-amber-500/30 bg-amber-500/5 text-amber-200";
    case "red":
      return "border-red-500/30 bg-red-500/5 text-red-200";
    default:
      return "border-card-border bg-background/40 text-muted-foreground";
  }
}

function aggregateFinalDecision(opts: {
  base: FullReport | null;
  pipeline: SingleStepReport;
  teamFit: TeamFitReport | null;
  github: GitHubDeepScanReport | null;
}): { tone: "green" | "yellow" | "red"; headline: string; paragraph: string; bullets: string[] } {
  const { base, pipeline, teamFit, github } = opts;
  const bullets: string[] = [];

  // По базовой проверке
  let baseTone: "green" | "yellow" | "red" | null = null;
  if (base) {
    baseTone = base.verdict;
    bullets.push(
      `Базовая проверка: ${verdictBadgeBase(base.verdict).label.replace(/^[^А-яЁё]+/u, "")}, суммарный балл ${base.totalScore}/100`,
    );
  }

  // По пайплайну
  let pipeTone: "green" | "yellow" | "red" = "yellow";
  if (pipeline.resolution.code === "RECOMMENDED") pipeTone = "green";
  else if (pipeline.resolution.code === "NOT_RECOMMENDED") pipeTone = "red";
  else if (pipeline.resolution.code === "CONDITIONAL" || pipeline.resolution.code === "UNVERIFIED") pipeTone = "yellow";
  bullets.push(
    `Пайплайн: ${resolutionBadge(pipeline.resolution.code).label}, интегральный балл ${pipeline.compositeScore}/100`,
  );

  // Лингвистика (внутри пайплайна)
  let lingTone: "green" | "yellow" | "red" | null = null;
  if (pipeline.linguisticAudit) {
    const v = pipeline.linguisticAudit.verdict;
    if (v === "honest") lingTone = "green";
    else if (v === "mixed") lingTone = "yellow";
    else lingTone = "red";
    const verdictRu =
      v === "honest" ? "честный нарратив" :
      v === "mixed" ? "смешанный" :
      v === "constructed" ? "сконструирован" : "фальсификация";
    bullets.push(`Лингвистический слой: ${verdictRu}`);
  }

  // Team Fit
  if (teamFit) {
    bullets.push(
      teamFit.dataInsufficient
        ? "Team Fit: данных недостаточно для кластеризации"
        : `Team Fit: кластер ${teamFit.mbtiCluster}`,
    );
  }

  // GitHub Deep Scan
  if (github) {
    const flags = Array.isArray(github.riskFlags) ? github.riskFlags : [];
    const highFlags = flags.filter((f: any) => f?.severity === "high").length;
    bullets.push(
      `GitHub DeepScan: профиль @${github.githubHandle}` +
        (highFlags > 0 ? `, рисков high: ${highFlags}` : ", критических рисков не найдено"),
    );
  }

  // Агрегация тона по всем вкладкам: худший выигрывает
  const tones = [baseTone, pipeTone, lingTone].filter(Boolean) as ("green" | "yellow" | "red")[];
  let finalTone: "green" | "yellow" | "red" = "green";
  if (tones.includes("red") || pipeline.resolution.code === "NOT_RECOMMENDED") finalTone = "red";
  else if (tones.includes("yellow") || pipeline.resolution.code === "CONDITIONAL" || pipeline.resolution.code === "UNVERIFIED") finalTone = "yellow";
  else finalTone = "green";

  let headline: string;
  if (finalTone === "green") headline = "Сводное решение: кандидат рекомендован";
  else if (finalTone === "yellow") headline = "Сводное решение: условная рекомендация";
  else headline = "Сводное решение: кандидат не рекомендован";

  const paragraph =
    finalTone === "green"
      ? "Оценки по всем активным вкладкам согласуются и указывают на низкий уровень риска."
      : finalTone === "yellow"
      ? "По части вкладок зафиксированы настораживающие сигналы — рекомендуется расширить проверку."
      : "По одной или нескольким вкладкам выявлены критические риски. Рекомендуется отказ или углублённая проверка.";

  return { tone: finalTone, headline, paragraph, bullets };
}

function CandidateDossierSummary({
  parentCheckId,
  pipelineId,
  pipelineReport,
  candidateDisplayName,
  baseReport,
  teamFit,
  githubDeep,
}: {
  parentCheckId: string;
  pipelineId?: string;
  pipelineReport: SingleStepReport;
  candidateDisplayName?: string | null;
  baseReport: FullReport | null;
  teamFit: TeamFitReport | null;
  githubDeep: GitHubDeepScanReport | null;
}) {
  const rows: SummaryTabRow[] = [];

  // 1. Базовая проверка
  if (baseReport) {
    const vb = verdictBadgeBase(baseReport.verdict);
    const ai = baseReport.aiDetector;
    const aiPart = ai
      ? ` · AI ${ai.aiScore}/100${ai.triggeredLinguistic ? " + лингвистика" : ""}`
      : "";
    rows.push({
      key: "base",
      title: "Базовая проверка",
      icon: ShieldCheck,
      available: true,
      primary: `${vb.label} · ${baseReport.totalScore}/100`,
      secondary: `риски ${baseReport.riskScore} · инфляция ${baseReport.inflationScore} · волки ${baseReport.wolvesScore}${aiPart}`,
      tone: baseReport.verdict,
    });
  } else {
    rows.push({
      key: "base",
      title: "Базовая проверка",
      icon: ShieldCheck,
      available: false,
      primary: "—",
      secondary: "данные не загружены",
      tone: "neutral",
    });
  }

  // 2. Пайплайн
  const rb = resolutionBadge(pipelineReport.resolution.code);
  const pipeTone: SummaryTabRow["tone"] =
    pipelineReport.resolution.code === "RECOMMENDED" ? "green" :
    pipelineReport.resolution.code === "NOT_RECOMMENDED" ? "red" : "yellow";
  rows.push({
    key: "pipeline",
    title: "Пайплайн AI",
    icon: Layers,
    available: true,
    primary: `${rb.label} · ИБ ${pipelineReport.compositeScore}/100`,
    secondary: `верификация, мотивация, лояльность${pipelineReport.linguisticAudit ? ", лингвистика" : ""}`,
    tone: pipeTone,
  });

  // 3. Team Fit
  if (teamFit) {
    rows.push({
      key: "teamfit",
      title: "Team Fit",
      icon: Users,
      available: true,
      primary: teamFit.dataInsufficient ? "Данных недостаточно" : `Кластер ${teamFit.mbtiCluster}`,
      secondary: teamFit.summary?.slice(0, 120) || "поведенческий профиль и ценностный fit",
      tone: teamFit.dataInsufficient ? "neutral" : "green",
    });
  } else {
    rows.push({
      key: "teamfit",
      title: "Team Fit",
      icon: Users,
      available: false,
      primary: "—",
      secondary: "анализ не запускался",
      tone: "neutral",
    });
  }

  // 4. GitHub DeepScan
  if (githubDeep) {
    const flags = Array.isArray(githubDeep.riskFlags) ? githubDeep.riskFlags : [];
    const highFlags = flags.filter((f: any) => f?.severity === "high").length;
    const medFlags = flags.filter((f: any) => f?.severity === "medium").length;
    const ghTone: SummaryTabRow["tone"] = highFlags > 0 ? "red" : medFlags > 0 ? "yellow" : "green";
    rows.push({
      key: "github",
      title: "GitHub DeepScan",
      icon: Github,
      available: true,
      primary: `@${githubDeep.githubHandle}`,
      secondary: highFlags > 0 ? `риски high: ${highFlags}` : medFlags > 0 ? `риски medium: ${medFlags}` : "критических рисков нет",
      tone: ghTone,
    });
  } else {
    rows.push({
      key: "github",
      title: "GitHub DeepScan",
      icon: Github,
      available: false,
      primary: "—",
      secondary: "анализ не запускался",
      tone: "neutral",
    });
  }

  const decision = aggregateFinalDecision({
    base: baseReport,
    pipeline: pipelineReport,
    teamFit,
    github: githubDeep,
  });

  const decisionTone =
    decision.tone === "green"
      ? { border: "border-emerald-500/50", bg: "bg-emerald-500/5", text: "text-emerald-200", icon: CheckCircle2, iconCls: "text-emerald-400" }
      : decision.tone === "yellow"
      ? { border: "border-amber-500/50", bg: "bg-amber-500/5", text: "text-amber-200", icon: AlertTriangle, iconCls: "text-amber-400" }
      : { border: "border-red-500/50", bg: "bg-red-500/5", text: "text-red-200", icon: XCircle, iconCls: "text-red-400" };
  const DecisionIcon = decisionTone.icon;

  const handleDownloadAll = () => {
    const html = buildCombinedReportHtml({
      candidateName: candidateDisplayName || pipelineReport.candidateName || baseReport?.candidateName || "Кандидат",
      parentCheckId,
      pipelineId,
      baseReport,
      pipelineReport,
      teamFit,
      githubDeep,
      decision,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (candidateDisplayName || baseReport?.candidateName || "кандидат").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    a.href = url;
    a.download = `bot-sbshnik-досье-${safeName}-${parentCheckId}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Card
      className="border-card-border bg-gradient-to-br from-background via-background to-primary/5 p-5"
      data-testid="card-candidate-dossier-summary"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Сводка по карточке кандидата
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadAll}
          className="print:hidden"
          data-testid="button-download-all-reports"
        >
          <Download className="mr-2 h-3.5 w-3.5" />
          Скачать все отчёты одним файлом
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const RIcon = row.icon;
          return (
            <div
              key={row.key}
              className={`flex items-start gap-2 rounded-md border p-2.5 ${toneClasses(row.tone)} ${!row.available ? "opacity-60" : ""}`}
              data-testid={`summary-row-${row.key}`}
            >
              <RIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 text-xs">
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-70">
                  {row.title}
                </div>
                <div className="mt-0.5 font-medium">{row.primary}</div>
                <div className="mt-0.5 text-[11px] opacity-80">{row.secondary}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Итоговое решение по своду всех вкладок */}
      <div className={`mt-4 rounded-md border p-3 ${decisionTone.border} ${decisionTone.bg}`}>
        <div className="flex items-center gap-2">
          <DecisionIcon className={`h-4 w-4 ${decisionTone.iconCls}`} />
          <div className={`font-mono text-[10px] uppercase tracking-widest ${decisionTone.text}`}>
            Итоговое решение по всем вкладкам
          </div>
        </div>
        <div className={`mt-1.5 text-sm font-semibold ${decisionTone.text}`} data-testid="text-final-headline">
          {decision.headline}
        </div>
        <p className={`mt-1 text-xs ${decisionTone.text} opacity-90`}>{decision.paragraph}</p>
        <ul className="mt-2 space-y-0.5 text-[11px] opacity-80">
          {decision.bullets.map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ==========================================================
// Генерация единого HTML-отчёта по карточке
// ==========================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCombinedReportHtml(opts: {
  candidateName: string;
  parentCheckId: string;
  pipelineId?: string;
  baseReport: FullReport | null;
  pipelineReport: SingleStepReport;
  teamFit: TeamFitReport | null;
  githubDeep: GitHubDeepScanReport | null;
  decision: { tone: "green" | "yellow" | "red"; headline: string; paragraph: string; bullets: string[] };
}): string {
  const { candidateName, parentCheckId, pipelineId, baseReport, pipelineReport, teamFit, githubDeep, decision } = opts;
  const now = new Date().toLocaleString("ru-RU");

  const section = (title: string, inner: string) =>
    `<section><h2>${escapeHtml(title)}</h2>${inner}</section>`;

  const baseHtml = baseReport
    ? section(
        "1. Базовая проверка",
        `<p><b>Вердикт:</b> ${escapeHtml(verdictBadgeBase(baseReport.verdict).label)} · <b>суммарный балл:</b> ${baseReport.totalScore}/100</p>
         <ul>
           <li>Риски: ${baseReport.riskScore}/100</li>
           <li>Инфляция: ${baseReport.inflationScore}/100</li>
           <li>Волки: ${baseReport.wolvesScore}/100</li>
         </ul>
         ${baseReport.executiveSummary ? `<p><b>Сводка:</b> ${escapeHtml(baseReport.executiveSummary)}</p>` : ""}
         ${baseReport.positiveSignals && baseReport.positiveSignals.length > 0
            ? `<p><b>Положительные сигналы:</b></p><ul>${baseReport.positiveSignals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
            : ""}
         ${baseReport.redFlags && baseReport.redFlags.length > 0
            ? `<p><b>Красные флаги:</b></p><ul>${baseReport.redFlags.map((f: any) => `<li>${escapeHtml(f.title || f.category || "флаг")}: ${escapeHtml(f.explanation || "")}</li>`).join("")}</ul>`
            : ""}
         ${baseReport.aiDetector
            ? `<p><b>AI-детектор:</b> AI-score ${baseReport.aiDetector.aiScore}/100 · вердикт «${escapeHtml(baseReport.aiDetector.verdict)}» · уверенность модели ${baseReport.aiDetector.confidence}%${baseReport.aiDetector.triggeredLinguistic ? " · запущен лингвистический слой" : ""}</p>${baseReport.aiDetector.summary ? `<p>${escapeHtml(baseReport.aiDetector.summary)}</p>` : ""}${baseReport.aiDetector.markers && baseReport.aiDetector.markers.length > 0 ? `<ul>${baseReport.aiDetector.markers.map((m: any) => `<li><b>${escapeHtml(m.type || "")}:</b> ${escapeHtml(m.description || "")}${m.example ? ` — «${escapeHtml(m.example)}»` : ""}</li>`).join("")}</ul>` : ""}`
            : ""}
         ${baseReport.linguisticAudit
            ? `<p><b>Лингвистический аудит (базовый, условный):</b> вердикт «${escapeHtml(baseReport.linguisticAudit.verdict)}» — ${escapeHtml(baseReport.linguisticAudit.summary || "")}</p>`
            : ""}`,
      )
    : section("1. Базовая проверка", "<p><i>Данные не загружены.</i></p>");

  const pipelineHtml = section(
    "2. Пайплайн AI-скрининга",
    `<p><b>Резолюция:</b> ${escapeHtml(resolutionBadge(pipelineReport.resolution.code).label)} · <b>Интегральный балл:</b> ${pipelineReport.compositeScore}/100</p>
     <p><b>Верификация:</b> ${escapeHtml(pipelineReport.verification.summary)}</p>
     ${pipelineReport.motivation ? `<p><b>Мотивация:</b> ${pipelineReport.motivation.score}/100 — ${escapeHtml(pipelineReport.motivation.summary || "")}</p>` : ""}
     ${pipelineReport.loyalty ? `<p><b>Лояльность (ИПЛ):</b> ${pipelineReport.loyalty.score}/100 — ${escapeHtml(pipelineReport.loyalty.summary || "")}</p>` : ""}
     ${pipelineReport.linguisticAudit ? `<p><b>Лингвистический аудит:</b> ${escapeHtml(pipelineReport.linguisticAudit.verdict)} — ${escapeHtml(pipelineReport.linguisticAudit.summary || "")}</p>` : ""}
     ${pipelineReport.executiveSummary ? `<p><b>Сводка для руководителя:</b> ${escapeHtml(pipelineReport.executiveSummary.paragraph)}</p>` : ""}`,
  );

  const teamFitHtml = teamFit
    ? section(
        "3. Team Fit",
        `<p><b>Кластер MBTI:</b> ${escapeHtml(teamFit.mbtiCluster)} — ${escapeHtml(teamFit.mbtiReasoning || "")}</p>
         <p><b>Сводка:</b> ${escapeHtml(teamFit.summary || "")}</p>
         ${teamFit.dataInsufficient ? "<p><i>Отмечена недостаточность данных для устойчивой кластеризации.</i></p>" : ""}`,
      )
    : section("3. Team Fit", "<p><i>Анализ не запускался.</i></p>");

  const githubHtml = githubDeep
    ? section(
        "4. GitHub DeepScan",
        `<p><b>Профиль:</b> @${escapeHtml(githubDeep.githubHandle)}</p>
         <p><b>Сводка:</b> ${escapeHtml((githubDeep as any).summary || "")}</p>
         ${(githubDeep as any).riskFlags && Array.isArray((githubDeep as any).riskFlags) && (githubDeep as any).riskFlags.length > 0
            ? `<p><b>Флаги риска:</b></p><ul>${(githubDeep as any).riskFlags.map((f: any) => `<li>[${escapeHtml(f.severity || "")}] ${escapeHtml(f.type || "")} — ${escapeHtml(f.evidence || "")}</li>`).join("")}</ul>`
            : ""}`,
      )
    : section("4. GitHub DeepScan", "<p><i>Анализ не запускался.</i></p>");

  const decisionColor =
    decision.tone === "green" ? "#10b981" : decision.tone === "yellow" ? "#f59e0b" : "#ef4444";

  const decisionHtml = `
    <section class="decision" style="border-left: 4px solid ${decisionColor};">
      <h2>Итоговое решение по всем вкладкам</h2>
      <p style="font-size:16px;font-weight:600;color:${decisionColor};">${escapeHtml(decision.headline)}</p>
      <p>${escapeHtml(decision.paragraph)}</p>
      <ul>${decision.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </section>
  `;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Досье кандидата — ${escapeHtml(candidateName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #0f172a; line-height: 1.55; }
    header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .meta { color: #64748b; font-size: 12px; }
    h2 { font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 28px; }
    section { margin-bottom: 18px; }
    section.decision { background: #f8fafc; padding: 14px 18px; border-radius: 6px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 3px; }
    code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <header>
    <h1>Досье кандидата: ${escapeHtml(candidateName)}</h1>
    <div class="meta">
      Базовая проверка №${escapeHtml(parentCheckId)}${pipelineId ? ` · Пайплайн №${escapeHtml(pipelineId)}` : ""} · Сформировано ${escapeHtml(now)}
    </div>
  </header>
  ${decisionHtml}
  ${baseHtml}
  ${pipelineHtml}
  ${teamFitHtml}
  ${githubHtml}
  <footer class="meta" style="margin-top:36px; border-top:1px solid #e2e8f0; padding-top:10px;">
    Отчёт сформирован автоматически системой bot-sbshnik. Не заменяет решение СБ.
  </footer>
</body>
</html>`;
}

