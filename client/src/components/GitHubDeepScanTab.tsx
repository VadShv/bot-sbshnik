import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Github,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Info,
  ExternalLink,
  Code2,
  Clock,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GitHubDeepScanReport,
  GhTechProfile,
  GhBehaviorProfile,
  GhRiskFlag,
  GhRiskSeverity,
  GhOceanHints,
} from "@/lib/types";

// =====================================================================
// GitHub DeepScan v3.5 — вкладка отчёта
// =====================================================================

export function GitHubDeepScanTab({ checkId }: { checkId: string }) {
  const qc = useQueryClient();
  const [manualHandle, setManualHandle] = useState("");

  const { data, isLoading } = useQuery<GitHubDeepScanReport | null>({
    queryKey: ["/api/checks", checkId, "github-deepscan"],
    enabled: Boolean(checkId),
  });

  const runMut = useMutation({
    mutationFn: async (body?: { githubHandle?: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/checks/${checkId}/github-deepscan`,
        body || {},
      );
      return (await res.json()) as GitHubDeepScanReport;
    },
    onSuccess: (r) => {
      qc.setQueryData(["/api/checks", checkId, "github-deepscan"], r);
    },
  });

  if (isLoading) {
    return (
      <Card className="border-card-border bg-card p-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        Загрузка GitHub DeepScan…
      </Card>
    );
  }

  if (!data) {
    return (
      <Card
        className="border-card-border bg-card p-8"
        data-testid="card-github-deepscan-empty"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Github className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">GitHub DeepScan</h3>
          <p className="mb-5 text-sm text-muted-foreground">
            Модуль анализирует публичный GitHub-профиль кандидата: технологический
            стек, ритм активности по часам МСК, косвенные риск-сигналы и гипотезы
            OCEAN. Хэндл извлекается из резюме автоматически — или задайте его вручную.
          </p>
          <div className="mb-4 flex w-full max-w-md items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">github.com/</span>
            <Input
              value={manualHandle}
              onChange={(e) => setManualHandle(e.target.value)}
              placeholder="octocat"
              data-testid="input-github-handle"
              className="flex-1"
            />
          </div>
          <Button
            size="lg"
            onClick={() =>
              runMut.mutate(manualHandle.trim() ? { githubHandle: manualHandle.trim() } : undefined)
            }
            disabled={runMut.isPending}
            data-testid="button-run-github-deepscan"
          >
            {runMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Анализ запущен…
              </>
            ) : (
              <>
                <Github className="mr-2 h-4 w-4" />
                Запустить DeepScan
              </>
            )}
          </Button>
          {runMut.isError && (
            <div
              className="mt-4 text-xs text-red-400"
              data-testid="text-github-deepscan-error"
            >
              {(runMut.error as any)?.message || "Не удалось запустить анализ. Попробуйте ещё раз."}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <GitHubDeepScanView
      report={data}
      onRerun={(h?: string) => runMut.mutate(h ? { githubHandle: h } : undefined)}
      rerunPending={runMut.isPending}
    />
  );
}

// =====================================================================
// Основной вид
// =====================================================================

function GitHubDeepScanView({
  report,
  onRerun,
  rerunPending,
}: {
  report: GitHubDeepScanReport;
  onRerun: (h?: string) => void;
  rerunPending: boolean;
}) {
  const dateStr = new Date(report.createdAt).toLocaleString("ru-RU");

  if (report.dataInsufficient) {
    return (
      <Card
        className="border-amber-500/30 bg-amber-500/[0.04] p-6"
        data-testid="card-github-deepscan-insufficient"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <div className="mb-1 font-semibold">
              {report.githubHandle
                ? `Недостаточно публичных данных для @${report.githubHandle}`
                : "GitHub handle не найден"}
            </div>
            <p className="text-sm text-muted-foreground">
              {report.fetchError || report.summary}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRerun()}
                disabled={rerunPending}
                data-testid="button-rerun-github-deepscan"
              >
                {rerunPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Перезапуск…</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Повторить</>
                )}
              </Button>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {dateStr}
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="github-deepscan-report">
      {/* Заголовок + скоры */}
      <Card className="border-card-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">
              GitHub DeepScan ·{" "}
              <a
                href={report.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
                data-testid="link-github-profile"
              >
                @{report.githubHandle}
              </a>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {dateStr}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRerun()}
            disabled={rerunPending}
            data-testid="button-rerun-github-deepscan"
          >
            {rerunPending ? (
              <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Перезапуск…</>
            ) : (
              <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Перезапустить</>
            )}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <ScoreGauge label="SB-Score" value={report.sbScore} highlight />
          <ScoreGauge label="Tech" value={report.techScore} />
          <ScoreGauge label="Behavior" value={report.behaviorScore} />
          <ScoreGauge label="Risk (инв.)" value={report.riskScore} />
        </div>

        {report.summary && (
          <p
            className="mt-4 text-sm leading-relaxed text-foreground/90"
            data-testid="text-github-deepscan-summary"
          >
            {report.summary}
          </p>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Все выводы — гипотезы по публичным данным GitHub. Приватные репозитории
            не анализируются. Уверенность оценки: {report.confidence}/100.
          </span>
        </div>
      </Card>

      {/* Tech Profile */}
      <TechProfileCard tp={report.techProfile} />

      {/* Behavior Timeline */}
      <BehaviorProfileCard bp={report.behaviorProfile} />

      {/* Risk Flags */}
      {report.riskFlags.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">
              Риск-флаги ({report.riskFlags.length})
            </div>
          </div>
          <div className="space-y-2">
            {report.riskFlags.map((f, i) => (
              <RiskFlagItem key={i} flag={f} index={i} />
            ))}
          </div>
        </Card>
      )}

      {/* OCEAN hints */}
      <OceanHintsCard hints={report.oceanHints} />

      {/* Рекомендация */}
      {report.recommendation && (
        <Card
          className="border-primary/30 bg-primary/[0.04] p-5"
          data-testid="card-github-deepscan-recommendation"
        >
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">Рекомендация</div>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {report.recommendation}
          </p>
        </Card>
      )}
    </div>
  );
}

// =====================================================================
// Score gauge — компактный
// =====================================================================

function ScoreGauge({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div
      className={cn(
        "rounded-lg border border-card-border bg-background/40 p-3",
        highlight && "border-primary/40 bg-primary/5",
      )}
      data-testid={`score-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mb-1.5 font-mono text-2xl font-bold tabular-nums">
        {pct}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// =====================================================================
// Tech Profile card
// =====================================================================

function TechProfileCard({ tp }: { tp: GhTechProfile }) {
  return (
    <Card className="border-card-border bg-card p-5" data-testid="card-tech-profile">
      <div className="mb-3 flex items-center gap-2">
        <Code2 className="h-4 w-4 text-primary" />
        <div className="font-semibold text-sm">Технологический профиль</div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MiniStat label="Оригинальных репо" value={String(tp.originalRepos)} />
        <MiniStat label="Всего звёзд" value={String(tp.totalStars)} />
        <MiniStat label="Возраст аккаунта" value={`${tp.accountAgeYears} г.`} />
        <MiniStat label="Глубина по основному" value={`${tp.depthYears} г.`} />
      </div>

      {tp.languages.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Языки
          </div>
          <div className="space-y-1.5">
            {tp.languages.slice(0, 6).map((l) => (
              <div key={l.name} data-testid={`lang-${l.name}`}>
                <div className="mb-0.5 flex items-baseline justify-between">
                  <div className="text-xs font-medium">{l.name}</div>
                  <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {l.percent}%
                  </div>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/80"
                    style={{ width: `${Math.min(100, l.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tp.topRepos.length > 0 && (
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Топ-репозитории
          </div>
          <ul className="space-y-1.5">
            {tp.topRepos.map((r) => (
              <li key={r.url} className="flex items-center justify-between gap-2 text-sm">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1.5 truncate text-foreground hover:text-primary hover:underline"
                  data-testid={`repo-${r.name}`}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{r.name}</span>
                </a>
                <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  {r.language && <span>{r.language}</span>}
                  <span>⭐ {r.stars}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tp.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-[11px] text-muted-foreground">
          {tp.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-card-border bg-background/40 p-2.5">
      <div className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// =====================================================================
// Behavior Profile card — мини-гистограмма 24 ч.
// =====================================================================

function BehaviorProfileCard({ bp }: { bp: GhBehaviorProfile }) {
  const max = Math.max(0.01, ...bp.hourHistogramMsk);
  return (
    <Card className="border-card-border bg-card p-5" data-testid="card-behavior-profile">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <div className="font-semibold text-sm">
          Временной профиль активности (МСК)
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MiniStat label="Коммитов/неделю" value={String(bp.commitsPerWeek)} />
        <MiniStat label="Регулярность" value={`${Math.round(bp.regularity * 100)}%`} />
        <MiniStat label="Ночью" value={`${Math.round(bp.nightShare * 100)}%`} />
        <MiniStat label="Таймзона" value={bp.inferredTimezone} />
      </div>

      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Распределение коммитов по часам (0–23 МСК)
        </div>
        <div className="flex h-20 items-end gap-0.5" data-testid="hour-histogram">
          {bp.hourHistogramMsk.map((v, h) => {
            const pct = max > 0 ? (v / max) * 100 : 0;
            const color =
              h < 6
                ? "bg-rose-400/70"
                : h >= 10 && h < 19
                ? "bg-emerald-500/70"
                : "bg-primary/60";
            return (
              <div
                key={h}
                className="flex flex-1 flex-col items-center justify-end"
                title={`${h}:00 — ${Math.round(v * 1000) / 10}%`}
              >
                <div
                  className={cn("w-full rounded-sm", color)}
                  style={{ height: `${Math.max(3, pct)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </div>

      {bp.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-[11px] text-muted-foreground">
          {bp.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// =====================================================================
// Risk Flag item
// =====================================================================

function severityMeta(s: GhRiskSeverity) {
  switch (s) {
    case "critical":
      return { label: "critical", cls: "border-rose-600/60 bg-rose-600/15 text-rose-300" };
    case "high":
      return { label: "high", cls: "border-rose-500/40 bg-rose-500/10 text-rose-300" };
    case "medium":
      return { label: "medium", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
    case "low":
    default:
      return {
        label: "low",
        cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      };
  }
}

function RiskFlagItem({ flag, index }: { flag: GhRiskFlag; index: number }) {
  const [open, setOpen] = useState(false);
  const m = severityMeta(flag.severity);
  return (
    <div
      className="rounded-lg border border-card-border bg-background/40"
      data-testid={`risk-flag-${index}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted/20"
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="flex-1 text-sm font-medium">{flag.title}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
            m.cls,
          )}
        >
          {m.label}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          <div className="text-xs leading-relaxed text-foreground/90">
            {flag.description}
          </div>
          {flag.evidenceUrls.length > 0 && (
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Доказательства (permalinks)
              </div>
              <ul className="space-y-1">
                {flag.evidenceUrls.map((u, i) => (
                  <li key={i}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      data-testid={`risk-flag-${index}-evidence-${i}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// OCEAN hints (краткий блок)
// =====================================================================

function OceanHintsCard({ hints }: { hints: GhOceanHints }) {
  const axes: { key: "O" | "C" | "E" | "A" | "N"; label: string }[] = [
    { key: "O", label: "O · Открытость" },
    { key: "C", label: "C · Добросовестность" },
    { key: "E", label: "E · Экстраверсия" },
    { key: "A", label: "A · Доброжелательность" },
    { key: "N", label: "N · Нейротизм" },
  ];
  return (
    <Card className="border-card-border bg-card p-5" data-testid="card-ocean-hints">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="font-semibold text-sm">OCEAN-hints по GitHub-сигналам</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          гипотеза
        </div>
      </div>
      <div className="space-y-2">
        {axes.map((a) => {
          const v = hints[a.key];
          const rationale = hints.rationale?.[a.key] || "";
          return (
            <div key={a.key} data-testid={`ocean-hint-${a.key}`}>
              <div className="mb-1 flex items-baseline justify-between">
                <div className="text-xs font-medium">{a.label}</div>
                <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {v.toFixed(2)} / 1.0
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    a.key === "N" ? "bg-amber-400/80" : "bg-primary/80",
                  )}
                  style={{ width: `${v * 100}%` }}
                />
              </div>
              {rationale && (
                <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {rationale}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
