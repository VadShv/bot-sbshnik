import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/VerdictBadge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { FindingCard } from "@/components/FindingCard";
import { WolfReport } from "@/components/WolfReport";
import {
  ArrowLeft,
  Download,
  Printer,
  ShieldAlert,
  Bot,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Target,
  Phone,
  Mic,
  FileText,
  Users,
  Wrench,
  Globe,
  ShieldCheck,
  Workflow,
  ChevronRight,
} from "lucide-react";
import type { FullReport, RecruiterAction, RedFlag, PipelineSummary } from "@/lib/types";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export default function ReportPage() {
  const [, params] = useRoute("/report/:id");
  const id = params?.id;

  const { data, isLoading, error } = useQuery<{
    id: string;
    createdAt: number;
    resumeText: string;
    report: FullReport;
    pipelines: PipelineSummary[];
  }>({
    queryKey: ["/api/checks", id],
    enabled: Boolean(id),
  });

  const dateStr = useMemo(() => {
    if (!data) return "";
    return new Date(data.createdAt).toLocaleString("ru-RU");
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-5xl px-6 py-10 text-center text-muted-foreground">
          Отчёт не найден.
        </div>
      </div>
    );
  }

  const r = data.report;

  const handlePrint = () => window.print();
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-sbshnik-${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8 print:py-2">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Новая проверка
            </a>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download-json">
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
              <Printer className="mr-2 h-4 w-4" />
              Печать / PDF
            </Button>
          </div>
        </div>

        {/* Шапка отчёта */}
        <Card className="mb-6 border-card-border bg-card p-6 print:border-gray-300">
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <ShieldAlert className="h-3 w-3" />
            <span>Заключение службы безопасности · №{data.id}</span>
            <span
              className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] tracking-widest text-primary"
              data-testid="badge-check-type"
            >
              Тип: обычная проверка
            </span>
            {data.pipelines && data.pipelines.length > 0 && (
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] tracking-widest text-emerald-400">
                + пайплайн × {data.pipelines.length}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <h1 className="text-xl font-bold">
                {r.candidateName || "Кандидат (ФИО не извлечено)"}
              </h1>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                Дата: {dateStr}
                {typeof r.confidence === "number" && (
                  <> · Уверенность модели: {r.confidence}%</>
                )}
              </div>
              <div className="mt-3">
                <VerdictBadge verdict={r.verdict} size="lg" />
              </div>
              {r.executiveSummary && (
                <div className="mt-4 max-w-2xl rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Executive summary
                  </div>
                  {r.executiveSummary}
                </div>
              )}
            </div>
            <div className="flex items-center gap-6">
              <ScoreGauge score={r.totalScore} label="Интегральный риск" size={140} />
            </div>
          </div>
        </Card>

        {/* Блок «Полный пайплайн» — кнопка запуска + список связанных отчётов */}
        <Card
          className="mb-6 border-primary/30 bg-primary/[0.04] p-5 print:hidden"
          data-testid="card-pipeline-link"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/15 p-2 text-primary">
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  Полный скрининг · Single-Step v3.0
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {data.pipelines && data.pipelines.length > 0
                    ? "Проведён полный пайплайн по этому кандидату"
                    : "Нужна более глубокая проверка?"}
                </div>
                <div className="mt-1 max-w-xl text-xs text-muted-foreground">
                  Верификация опыта (Резюме × ЭТК × интервью × рекомендации), анализ мотивации, Cultural Fit V3 и Индекс лояльности. Результат — Composite Score и финальная резолюция.
                </div>
              </div>
            </div>
            <Link href={`/pipeline?fromCheck=${data.id}`}>
              <Button size="lg" data-testid="button-run-pipeline-from-check">
                <Workflow className="mr-2 h-4 w-4" />
                {data.pipelines && data.pipelines.length > 0
                  ? "Провести пайплайн ещё раз"
                  : "Провести полный пайплайн"}
              </Button>
            </Link>
          </div>

          {data.pipelines && data.pipelines.length > 0 && (
            <div className="mt-4 border-t border-primary/20 pt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Связанные отчёты пайплайна
              </div>
              <ul className="space-y-2">
                {data.pipelines.map((p) => (
                  <li key={p.id}>
                    <Link href={`/pipeline-report/${p.id}`}>
                      <a
                        className="group flex items-center justify-between gap-3 rounded-md border border-card-border bg-background/60 px-3 py-2 hover:border-primary/50 hover:bg-background"
                        data-testid={`link-pipeline-${p.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm">Отчёт пайплайна №{p.id}</span>
                            <ResolutionPill code={p.resolutionCode} />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              v{p.version} · CS {p.compositeScore}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {new Date(p.createdAt).toLocaleString("ru-RU")}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Red flags — топ-критичные сигналы */}
        {r.redFlags && r.redFlags.length > 0 && (
          <Card className="mb-6 border-red-500/30 bg-red-500/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <div className="font-semibold text-red-400">Красные флаги</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                топ-{r.redFlags.length} критичных сигналов
              </div>
            </div>
            <ul className="space-y-2">
              {r.redFlags.map((rf, i) => (
                <RedFlagRow key={i} rf={rf} />
              ))}
            </ul>
          </Card>
        )}

        {/* Positive signals */}
        {r.positiveSignals && r.positiveSignals.length > 0 && (
          <Card className="mb-6 border-card-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <div className="font-semibold">Положительные сигналы</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                что говорит в пользу
              </div>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {r.positiveSignals.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Три интегральные категории */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="border-card-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Риски</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                вес 40%
              </div>
            </div>
            <ScoreGauge score={r.riskScore} label="Риск-скор" size={100} />
            {typeof r.risks.confidence === "number" && (
              <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                увер. {r.risks.confidence}%
              </div>
            )}
          </Card>
          <Card className="border-card-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Накрутка опыта</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                вес 40%
              </div>
            </div>
            <ScoreGauge score={r.inflationScore} label="Инфляция" size={100} />
            {typeof r.inflation.confidence === "number" && (
              <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                увер. {r.inflation.confidence}%
              </div>
            )}
          </Card>
          <Card className="border-card-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">«Волки»</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                вес 20%
              </div>
            </div>
            <ScoreGauge score={r.wolvesScore} label="Паттерны" size={100} />
            {typeof r.wolves.confidence === "number" && (
              <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                увер. {r.wolves.confidence}%
              </div>
            )}
          </Card>
        </div>

        {/* Детализация по субкатегориям */}
        {r.subcategoryBreakdown && r.subcategoryBreakdown.length > 0 && (
          <Card className="mb-6 border-card-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <div className="font-semibold">Разбивка по субкатегориям</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                взвешенный скор × confidence + плотность
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {r.subcategoryBreakdown.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center gap-3 rounded border border-border/60 bg-muted/30 p-3"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded font-mono text-sm font-bold",
                      s.score >= 61
                        ? "bg-red-500/15 text-red-400"
                        : s.score >= 31
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-green-500/15 text-green-400",
                    )}
                  >
                    {s.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.label}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {s.findingsCount} сигнал(ов)
                      {s.topIssue && <> · {s.topIssue}</>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Детали по трём основным категориям */}
        <CategorySection
          title="1. Общие риски"
          cat={r.risks}
          accent="Любая нестыковка — сигнал. Презумпция подозрения."
        />
        <CategorySection
          title="2. Накрутка опыта"
          cat={r.inflation}
          accent="Глубокий анализ: метрики, стек, темп роста, тайтлы."
        />
        <CategorySection
          title="3. Принадлежность сообществу «волков»"
          cat={r.wolves}
          accent="Паттерны серийных коротких контрактов и лексика."
        />

        {/* Wolf Detector v1.0 — усиленная проверка */}
        {r.wolfAudit && <WolfReport audit={r.wolfAudit} />}

        {/* Recruiter Action Plan */}
        {r.recruiterActionPlan && r.recruiterActionPlan.length > 0 && (
          <Card className="mt-6 border-primary/30 bg-primary/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <div className="font-semibold">План действий для рекрутера</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                пошаговая верификация
              </div>
            </div>
            <ol className="space-y-3">
              {r.recruiterActionPlan.map((action) => (
                <ActionStep key={action.step} action={action} />
              ))}
            </ol>
          </Card>
        )}

        {/* Вопросы и рекомендации */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="border-card-border bg-card p-5">
            <div className="mb-3 font-semibold">Вопросы для верификации</div>
            {r.interviewQuestions.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">
                Модель не предложила вопросов.
              </div>
            ) : (
              <ol className="space-y-2 text-sm">
                {r.interviewQuestions.map((q, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-mono text-xs text-primary">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card className="border-card-border bg-card p-5">
            <div className="mb-3 font-semibold">Рекомендации СБ</div>
            {r.sbRecommendations.length === 0 ? (
              <div className="text-sm italic text-muted-foreground">
                Рекомендации не сформированы.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {r.sbRecommendations.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-primary">▸</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="mt-8 rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Bot className="mr-1.5 inline h-3 w-3" />
          Отчёт сформирован автоматически: детерминированные детекторы + Yandex GPT
          (модель {`"yandexgpt"`}, folder b1gncpokmh18knpjgadr). Не является основанием
          для окончательного отказа — результат должен проверить сотрудник СБ.
        </div>
      </main>
    </div>
  );
}

// ============ Вспомогательные компоненты ============

function ResolutionPill({ code }: { code: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    RECOMMENDED: { label: "✅ Рекомендован", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    CONDITIONAL: { label: "⚠️ Условно", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    NOT_RECOMMENDED: { label: "❌ Отказ", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    UNVERIFIED: { label: "⚠️ Не верифицирован", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[code] || { label: code, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider", m.cls)}>
      {m.label}
    </span>
  );
}

function RedFlagRow({ rf }: { rf: RedFlag }) {
  return (
    <li className="flex items-start gap-3 rounded border border-red-500/20 bg-red-500/5 p-3">
      <AlertTriangle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          rf.severity === "critical" ? "text-red-500" : "text-red-400",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{rf.title}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              rf.severity === "critical"
                ? "bg-red-500/20 text-red-400"
                : "bg-red-500/10 text-red-300",
            )}
          >
            {rf.severity}
          </span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{rf.reason}</div>
      </div>
    </li>
  );
}

const METHOD_ICON = {
  call: Phone,
  interview: Mic,
  document: FileText,
  reference: Users,
  technical: Wrench,
  osint: Globe,
  external: ShieldCheck,
};

function ActionStep({ action }: { action: RecruiterAction }) {
  return (
    <li
      className="relative rounded border border-border/60 bg-background/60 p-4"
      data-testid={`action-step-${action.step}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold",
            action.priority === "must"
              ? "border-red-500/50 bg-red-500/10 text-red-400"
              : action.priority === "should"
              ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {action.step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{action.title}</span>
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                action.priority === "must"
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : action.priority === "should"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {action.priority === "must"
                ? "обязательно"
                : action.priority === "should"
                ? "желательно"
                : "опционально"}
            </span>
            {action.estimatedTime && (
              <span className="font-mono text-[10px] text-muted-foreground">
                ≈ {action.estimatedTime}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {action.description}
          </p>
          {action.targets && action.targets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {action.targets.slice(0, 6).map((t, i) => (
                <span
                  key={i}
                  className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function CategorySection({
  title,
  cat,
  accent,
}: {
  title: string;
  cat: FullReport["risks"];
  accent: string;
}) {
  return (
    <Card className="mb-4 border-card-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="mt-1 text-xs font-mono uppercase tracking-widest text-primary">
            {accent}
          </div>
          {cat.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{cat.summary}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className="font-mono text-3xl font-bold"
            style={{
              color:
                cat.score >= 61
                  ? "hsl(0 72% 55%)"
                  : cat.score >= 31
                  ? "hsl(38 92% 55%)"
                  : "hsl(142 60% 50%)",
            }}
          >
            {cat.score}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            из 100
          </div>
        </div>
      </div>

      {cat.findings.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm italic text-muted-foreground">
          Детекторов в этой категории не сработало.
        </div>
      ) : (
        <div className="space-y-2">
          {cat.findings.map((f, i) => (
            <FindingCard key={`${f.id}-${i}`} finding={f} />
          ))}
        </div>
      )}
    </Card>
  );
}
