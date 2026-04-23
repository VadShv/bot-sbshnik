import { Card } from "@/components/ui/card";
import type {
  SingleStepReport,
  VerificationStatus,
  ResolutionCode,
  CulturalValueKey,
  KeyFinding,
} from "@/lib/types";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Gauge,
  Compass,
  Handshake,
  Rocket,
  Users,
  FileText,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarRange,
} from "lucide-react";

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
    case "culturalFit": return "Cultural Fit";
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

const VALUE_ICONS: Record<CulturalValueKey, any> = {
  responsibility: ShieldCheck,
  partnership: Handshake,
  entrepreneurship: Rocket,
};

function scoreBar(score: number, total = 100): string {
  const pct = Math.max(0, Math.min(100, (score / total) * 100));
  return `${pct.toFixed(0)}%`;
}

// ==========================================================
// Основной компонент
// ==========================================================

export function PipelineReport({ report }: { report: SingleStepReport }) {
  const tone = resolutionTone(report.resolution.code);
  const Icon = tone.icon;
  const vBadge = statusBadge(report.verification.status);

  return (
    <div className="space-y-5">
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

      {/* 4 модуля — сетка */}
      <div className="grid gap-4 lg:grid-cols-2">
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

        {/* 3. Cultural Fit */}
        <Card className="border-card-border bg-card p-5" data-testid="card-cultural-fit">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-fuchsia-400" />
              <div className="font-semibold">Cultural Fit · 3 ценности</div>
            </div>
            <div className="font-mono text-lg font-bold tabular-nums text-fuchsia-300">
              {report.culturalFit.totalScore}
              <span className="text-xs text-muted-foreground">/15</span>
            </div>
          </div>
          {report.culturalFit.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{report.culturalFit.summary}</p>
          )}
          <div className="mt-3 space-y-2">
            {report.culturalFit.values.map((v) => {
              const VIcon = VALUE_ICONS[v.key];
              return (
                <div
                  key={v.key}
                  className="rounded-md border border-card-border bg-background/40 p-3"
                  data-testid={`value-${v.key}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <VIcon className="h-3.5 w-3.5 text-fuchsia-400" />
                      <div className="text-sm font-semibold">{v.label}</div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`h-2 w-4 rounded-sm ${
                            n <= v.score ? "bg-fuchsia-500" : "bg-muted"
                          }`}
                        />
                      ))}
                      <span className="ml-1 font-mono text-xs tabular-nums">{v.score}/5</span>
                    </div>
                  </div>
                  {v.evidence.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                      {v.evidence.slice(0, 3).map((e, i) => (
                        <li key={i} className="italic">«{e}»</li>
                      ))}
                    </ul>
                  )}
                  {v.note && <div className="mt-1 text-[11px] text-muted-foreground">{v.note}</div>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 4. Лояльность */}
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
        </Card>
      )}

      {/* Формула */}
      <Card className="border-card-border bg-card/50 p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Composite Score · формула
        </div>
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          CS = 0.30 · ({report.motivation.score}/100) + 0.35 · ({report.culturalFit.totalScore}/15) + 0.35 · ({report.loyalty.score}/100) = <span className="font-bold text-foreground">{report.compositeScore}</span>
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
