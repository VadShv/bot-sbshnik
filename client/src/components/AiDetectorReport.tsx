import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, AlertTriangle } from "lucide-react";
import type {
  AIDetectorReport,
  AIDetectorVerdict,
  AIDetectorMarker,
} from "@/lib/types";

const VERDICT_LABELS: Record<AIDetectorVerdict, string> = {
  human_written: "написано человеком",
  lightly_edited: "лёгкая машинная редактура",
  heavily_edited: "значительная переработка ИИ",
  ai_generated: "сгенерировано ИИ",
};

const MARKER_LABELS: Record<AIDetectorMarker["type"], string> = {
  cliche: "штампы",
  symmetry: "симметрия структуры",
  smoothness: "избыточная гладкость",
  vocabulary: "канцелярит / лексика LLM",
  structure: "формальная структура",
  hedging: "хеджинг-обороты",
  other: "иное",
};

function scoreTone(score: number): { label: string; bg: string; fg: string; border: string } {
  if (score >= 85) {
    return {
      label: "очень высокий",
      bg: "bg-red-500/10",
      fg: "text-red-700 dark:text-red-300",
      border: "border-red-500/40",
    };
  }
  if (score >= 60) {
    return {
      label: "высокий",
      bg: "bg-orange-500/10",
      fg: "text-orange-700 dark:text-orange-300",
      border: "border-orange-500/40",
    };
  }
  if (score >= 30) {
    return {
      label: "умеренный",
      bg: "bg-yellow-500/10",
      fg: "text-yellow-700 dark:text-yellow-300",
      border: "border-yellow-500/40",
    };
  }
  return {
    label: "низкий",
    bg: "bg-emerald-500/10",
    fg: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40",
  };
}

export function AiDetectorReportBlock({ report }: { report: AIDetectorReport }) {
  const tone = scoreTone(report.aiScore);
  const verdictLabel = VERDICT_LABELS[report.verdict] || report.verdict;

  return (
    <Card
      className="border-card-border bg-card p-5"
      data-testid="card-ai-detector"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Анализ машинной обработки</div>
            <div className="text-xs text-muted-foreground">
              AI-детектор резюме · LLM-разбор стиля и структуры
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`rounded-md border px-3 py-1 text-sm font-semibold ${tone.bg} ${tone.fg} ${tone.border}`}
            data-testid="badge-ai-score"
          >
            AI-score: {report.aiScore}/100 · {tone.label}
          </div>
          <Badge variant="outline" data-testid="badge-ai-verdict">
            {verdictLabel}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            уверенность модели: {report.confidence}%
          </Badge>
        </div>
      </div>

      {report.summary && (
        <p
          className="mt-4 text-sm leading-relaxed text-foreground"
          data-testid="text-ai-summary"
        >
          {report.summary}
        </p>
      )}

      {report.triggeredLinguistic && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs leading-relaxed text-orange-800 dark:text-orange-200"
          data-testid="note-linguistic-triggered"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">
              Запущен углублённый лингвистический анализ
            </div>
            <div>
              AI-score ≥ {report.threshold} — резюме отправлено на дополнительную
              проверку (LIWC, Reality Monitoring, Cognitive Load, ACID).
            </div>
          </div>
        </div>
      )}

      {report.markers && report.markers.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Найденные маркеры машинной обработки
          </div>
          <ul className="space-y-2">
            {report.markers.map((m, idx) => (
              <li
                key={idx}
                className="rounded-md border border-card-border bg-muted/40 p-3 text-xs"
                data-testid={`marker-ai-${idx}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {MARKER_LABELS[m.type] || m.type}
                  </Badge>
                </div>
                <div className="text-foreground">{m.description}</div>
                {m.example && (
                  <div className="mt-1 rounded border-l-2 border-primary/40 bg-background/60 px-2 py-1 italic text-muted-foreground">
                    «{m.example}»
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!report.markers || report.markers.length === 0) && report.aiScore < 30 && (
        <div className="mt-4 text-xs text-muted-foreground">
          Маркеры машинной обработки не выявлены — стиль соответствует
          человеческому письму.
        </div>
      )}
    </Card>
  );
}
