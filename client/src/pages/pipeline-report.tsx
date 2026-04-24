import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PipelineReport } from "@/components/PipelineReport";
import { ArrowLeft, Download, Printer, Workflow, FileSearch } from "lucide-react";
import type { SingleStepReport } from "@/lib/types";
import { useMemo } from "react";

export default function PipelineReportPage() {
  const [, params] = useRoute("/pipeline-report/:id");
  const id = params?.id;

  const { data, isLoading, error } = useQuery<{
    id: string;
    createdAt: number;
    version: number;
    parentId: string | null;
    candidateName: string | null;
    report: SingleStepReport;
  }>({
    queryKey: ["/api/pipeline", id],
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
          Отчёт пайплайна не найден.
        </div>
      </div>
    );
  }

  const handlePrint = () => window.print();
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data.report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-sbshnik-pipeline-${data.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8 print:py-2">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                На главную
              </a>
            </Link>
            {data.parentId && (
              <Link href={`/report/${data.parentId}`}>
                <a
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid="link-parent-check"
                >
                  <FileSearch className="h-4 w-4" />
                  Исходная проверка №{data.parentId}
                </a>
              </Link>
            )}
          </div>
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

        <Card className="mb-6 border-card-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Workflow className="h-3 w-3" />
            Полный AI-пайплайн · Single-Step v3.0 · №{data.id}
          </div>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <h1 className="text-xl font-bold">
                {data.candidateName || data.report.candidateName || "Кандидат (ФИО не извлечено)"}
              </h1>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                Дата: {dateStr} · Версия отчёта v{data.version}
              </div>
            </div>
          </div>
        </Card>

        <PipelineReport
          report={data.report}
          parentCheckId={data.parentId || undefined}
          candidateDisplayName={data.candidateName || data.report.candidateName || null}
          pipelineId={data.id}
        />

        <div className="mt-8 rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Полный пайплайн: верификация опыта (ЭТК), анализ мотивации, Cultural Fit V3
          и Индекс лояльности. Результат — Composite Score и финальная резолюция.
          Отчёт не заменяет решение сотрудника СБ.
        </div>
      </main>
    </div>
  );
}
