import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Brain,
  Users,
  Building2,
  Package,
  Workflow,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  MinusCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TeamFitReport,
  OceanScores,
  FitAxis,
  FitAxisStatus,
  MbtiCluster,
  InterviewHypothesis,
} from "@/lib/types";

// =====================================================================
// Team Fit / Fit Guard v3 — вкладка отчёта
// =====================================================================

export function TeamFitTab({ checkId }: { checkId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<TeamFitReport | null>({
    queryKey: ["/api/checks", checkId, "team-fit"],
    enabled: Boolean(checkId),
  });

  const runMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/checks/${checkId}/team-fit`);
      return (await res.json()) as TeamFitReport;
    },
    onSuccess: (r) => {
      qc.setQueryData(["/api/checks", checkId, "team-fit"], r);
    },
  });

  // Первый заход, нет отчёта — показываем кнопку запуска
  if (isLoading) {
    return (
      <Card className="border-card-border bg-card p-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        Загрузка Team Fit отчёта…
      </Card>
    );
  }

  if (!data) {
    return (
      <Card
        className="border-card-border bg-card p-8"
        data-testid="card-team-fit-empty"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">Team Fit · Fit Guard v3</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Модуль строит гипотезы о культурном, продуктовом и психо-поведенческом
            соответствии кандидата команде по тексту резюме. Анализ идёт по 5 осям:
            ценности, вендоры, продуктовый подход, методологии, психотип (OCEAN + MBTI NT).
            Все выводы — гипотезы для проверки на интервью, не диагноз.
          </p>
          <Button
            size="lg"
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            data-testid="button-run-team-fit"
          >
            {runMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Анализ запущен…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Запустить Team Fit
              </>
            )}
          </Button>
          {runMut.isError && (
            <div className="mt-4 text-xs text-red-400" data-testid="text-team-fit-error">
              Не удалось запустить анализ. Попробуйте ещё раз.
            </div>
          )}
        </div>
      </Card>
    );
  }

  return <TeamFitView report={data} onRerun={() => runMut.mutate()} rerunPending={runMut.isPending} />;
}

// =====================================================================
// Основной вид
// =====================================================================

function TeamFitView({
  report,
  onRerun,
  rerunPending,
}: {
  report: TeamFitReport;
  onRerun: () => void;
  rerunPending: boolean;
}) {
  const dateStr = new Date(report.createdAt).toLocaleString("ru-RU");

  if (report.dataInsufficient) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/[0.04] p-6" data-testid="card-team-fit-insufficient">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <div className="mb-1 font-semibold">Недостаточно данных для психотипирования</div>
            <p className="text-sm text-muted-foreground">
              {report.summary ||
                "Резюме слишком короткое или скудное по содержанию. Проведите интервью и повторите анализ при необходимости."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onRerun}
                disabled={rerunPending}
                data-testid="button-rerun-team-fit"
              >
                {rerunPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Перезапуск…</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Повторить анализ</>
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
    <div className="space-y-4" data-testid="team-fit-report">
      {/* Заголовок + резюме */}
      <Card className="border-card-border bg-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">Team Fit · Fit Guard v3</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {dateStr}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRerun}
            disabled={rerunPending}
            data-testid="button-rerun-team-fit"
          >
            {rerunPending ? (
              <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Перезапуск…</>
            ) : (
              <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Перезапустить</>
            )}
          </Button>
        </div>
        {report.summary && (
          <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-team-fit-summary">
            {report.summary}
          </p>
        )}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Все выводы модуля — гипотезы для верификации на интервью. Не являются диагнозом
            и не могут быть единственным основанием для отказа в найме.
          </span>
        </div>
      </Card>

      {/* 4 фит-оси */}
      <Card className="border-card-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-primary" />
          <div className="font-semibold text-sm">Оси соответствия</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FitAxisCard icon={<Users className="h-4 w-4" />} title="Ценностный фит" axis={report.valueFit} testid="axis-value" />
          <FitAxisCard icon={<Building2 className="h-4 w-4" />} title="Вендорный фит (РФ ПО)" axis={report.vendorFit} testid="axis-vendor" />
          <FitAxisCard icon={<Package className="h-4 w-4" />} title="Продуктовый фит" axis={report.productFit} testid="axis-product" />
          <FitAxisCard icon={<Workflow className="h-4 w-4" />} title="Методологический фит" axis={report.methodologyFit} testid="axis-methodology" />
        </div>
      </Card>

      {/* Психотип: OCEAN + MBTI */}
      <Card className="border-card-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <div className="font-semibold text-sm">Психотип-Аналитик</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            гипотеза
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
          <OceanBars ocean={report.ocean} />
          <MbtiCard cluster={report.mbtiCluster} reasoning={report.mbtiReasoning} />
        </div>
      </Card>

      {/* Поведенческий профиль */}
      {report.behavioralProfile.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">Поведенческий профиль</div>
          </div>
          <ul className="space-y-2 text-sm" data-testid="list-behavioral-profile">
            {report.behavioralProfile.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-foreground/90">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Гипотезы для интервью */}
      {report.hypotheses.length > 0 && (
        <Card className="border-card-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <div className="font-semibold text-sm">
              Гипотезы для верификации на интервью ({report.hypotheses.length})
            </div>
          </div>
          <div className="space-y-2">
            {report.hypotheses.map((h, i) => (
              <HypothesisItem key={i} item={h} index={i} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// =====================================================================
// Вспомогательные компоненты
// =====================================================================

function statusMeta(s: FitAxisStatus): { label: string; className: string; Icon: React.FC<{ className?: string }> } {
  switch (s) {
    case "выявлен":
      return {
        label: "выявлен",
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        Icon: CheckCircle2,
      };
    case "частично":
      return {
        label: "частично",
        className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        Icon: CircleDot,
      };
    case "не выявлен":
    default:
      return {
        label: "не выявлен",
        className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
        Icon: MinusCircle,
      };
  }
}

function FitAxisCard({
  icon,
  title,
  axis,
  testid,
}: {
  icon: React.ReactNode;
  title: string;
  axis: FitAxis;
  testid: string;
}) {
  const m = statusMeta(axis.status);
  return (
    <div
      className="rounded-lg border border-card-border bg-background/40 p-4"
      data-testid={`card-${testid}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            m.className,
          )}
          data-testid={`status-${testid}`}
        >
          <m.Icon className="h-3 w-3" />
          {m.label}
        </span>
      </div>
      {axis.note && (
        <p className="mb-2 text-xs leading-relaxed text-foreground/80">{axis.note}</p>
      )}
      {axis.evidence.length > 0 && (
        <ul className="space-y-1">
          {axis.evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OceanBars({ ocean }: { ocean: OceanScores }) {
  const axes: { key: keyof Pick<OceanScores, "O" | "C" | "E" | "A" | "N">; label: string; hint: string }[] = [
    { key: "O", label: "O · Открытость", hint: "любознательность, новое" },
    { key: "C", label: "C · Добросовестность", hint: "результат, регламенты" },
    { key: "E", label: "E · Экстраверсия", hint: "стейкхолдеры, публичность" },
    { key: "A", label: "A · Доброжелательность", hint: "командность, эмпатия" },
    { key: "N", label: "N · Нейротизм", hint: "низкий балл = стабильность" },
  ];
  return (
    <div data-testid="ocean-bars">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        OCEAN · Big Five
      </div>
      <div className="space-y-2">
        {axes.map((a) => {
          const score = (ocean[a.key] as number) ?? 0;
          const pct = Math.max(0, Math.min(10, score)) * 10;
          const rationale = ocean.rationale?.[a.key] || "";
          return (
            <div key={a.key} data-testid={`ocean-${a.key}`}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="text-xs font-medium">
                  {a.label}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    · {a.hint}
                  </span>
                </div>
                <div className="font-mono text-xs tabular-nums text-foreground/80">
                  {score.toFixed(1)} / 10
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    a.key === "N" ? "bg-amber-400/80" : "bg-primary/80",
                  )}
                  style={{ width: `${pct}%` }}
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
    </div>
  );
}

function MbtiCard({ cluster, reasoning }: { cluster: MbtiCluster; reasoning: string }) {
  const meta: Record<MbtiCluster, { label: string; desc: string; accent: string }> = {
    INTJ: {
      label: "INTJ · Архитектор",
      desc: "Стратег, системность, долгосрочные концепции, критичен к процессам.",
      accent: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
    },
    INTP: {
      label: "INTP · Мыслитель",
      desc: "Исследователь, глубина, R&D, аналитика, копает «как устроено».",
      accent: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    },
    ENTJ: {
      label: "ENTJ · Командир",
      desc: "Лидирует изменения, драйвит команды и сроки, управляет программами.",
      accent: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    },
    ENTP: {
      label: "ENTP · Новатор",
      desc: "Генератор гипотез, кросс-домены, эксперименты, новые направления.",
      accent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    },
    none: {
      label: "NT-кластер не выявлен",
      desc: "Недостаточно признаков NT-кластера в резюме — требуется интервью для уточнения.",
      accent: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    },
  };
  const m = meta[cluster] ?? meta.none;
  return (
    <div data-testid={`mbti-${cluster}`}>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        MBTI · NT-кластер (гипотеза)
      </div>
      <div
        className={cn(
          "rounded-lg border p-4",
          m.accent,
        )}
      >
        <div className="mb-1 text-sm font-semibold">{m.label}</div>
        <div className="text-xs opacity-90">{m.desc}</div>
      </div>
      {reasoning && (
        <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Опора: </span>
          {reasoning}
        </div>
      )}
    </div>
  );
}

function HypothesisItem({ item, index }: { item: InterviewHypothesis; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div
      className="rounded-lg border border-card-border bg-background/40"
      data-testid={`hypothesis-${index}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-muted/20"
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="flex-1 text-sm font-medium">
          <span className="mr-2 font-mono text-[11px] text-muted-foreground">
            Гипотеза {index + 1}
          </span>
          {item.hypothesis}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          {item.rationale && (
            <div className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/80">Опора в резюме: </span>
              {item.rationale}
            </div>
          )}
          {item.questions.length > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Проверочные вопросы
              </div>
              <ul className="space-y-1.5">
                {item.questions.map((q, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-foreground/90"
                    data-testid={`hypothesis-${index}-q-${i}`}
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{q}</span>
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
