import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/VerdictBadge";
import { Trash2, FileSearch, Workflow } from "lucide-react";
import type { CheckListItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<CheckListItem[]>({
    queryKey: ["/api/checks"],
  });

  const del = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/checks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checks"] });
      toast({ title: "Удалено" });
    },
    onError: (e: any) =>
      toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 text-xl font-bold">История проверок</h1>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <Card className="border-card-border bg-card p-10 text-center">
            <FileSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <div className="mb-1 font-semibold">Пока нет ни одной проверки</div>
            <div className="text-sm text-muted-foreground">
              Проверьте первое резюме — оно появится здесь.
            </div>
            <Link href="/">
              <Button className="mt-4" data-testid="button-start-check">
                Запустить проверку
              </Button>
            </Link>
          </Card>
        )}

        <div className="space-y-2">
          {(data || []).map((c) => (
            <Card
              key={c.id}
              className="border-card-border bg-card p-4"
              data-testid={`row-check-${c.id}`}
            >
              <div className="flex items-center justify-between gap-4">
                <Link href={`/report/${c.id}`}>
                  <a className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold truncate">
                        {c.candidateName || "Без ФИО"}
                      </div>
                      <VerdictBadge verdict={c.verdict} size="sm" />
                      {c.hasPipeline && (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400"
                          data-testid={`badge-has-pipeline-${c.id}`}
                          title={
                            c.pipelineCount && c.pipelineCount > 1
                              ? `Проведён полный пайплайн × ${c.pipelineCount}`
                              : "Проведён полный пайплайн"
                          }
                        >
                          <Workflow className="h-3 w-3" />
                          +пайплайн
                          {c.pipelineCount && c.pipelineCount > 1 ? ` ×${c.pipelineCount}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("ru-RU")} · №{c.id}
                    </div>
                  </a>
                </Link>
                <div className="hidden gap-4 md:flex">
                  <ScoreCell v={c.riskScore} l="Риск" />
                  <ScoreCell v={c.inflationScore} l="Накрутка" />
                  <ScoreCell v={c.wolvesScore} l="Волки" />
                  <ScoreCell v={c.totalScore} l="Итог" bold />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Удалить проверку?")) del.mutate(c.id);
                  }}
                  data-testid={`button-delete-${c.id}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function ScoreCell({ v, l, bold }: { v: number; l: string; bold?: boolean }) {
  const color =
    v >= 61 ? "text-red-400" : v >= 31 ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="w-16 text-right">
      <div
        className={`font-mono text-base ${color} ${
          bold ? "font-bold text-lg" : ""
        }`}
      >
        {v}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {l}
      </div>
    </div>
  );
}
