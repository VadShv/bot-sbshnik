import { SeverityChip } from "./VerdictBadge";
import type { Finding, Evidence, VerificationStep } from "@/lib/types";
import { useState } from "react";
import {
  ChevronDown,
  Quote,
  AlertTriangle,
  CircleDashed,
  Activity,
  Wifi,
  Phone,
  Mic,
  FileText,
  Users,
  Wrench,
  Globe,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EVIDENCE_META: Record<
  Evidence["type"],
  { label: string; Icon: typeof Quote; color: string }
> = {
  quote: { label: "Цитата", Icon: Quote, color: "text-primary" },
  contradiction: { label: "Противоречие", Icon: AlertTriangle, color: "text-red-400" },
  absence: { label: "Отсутствие", Icon: CircleDashed, color: "text-amber-400" },
  pattern: { label: "Паттерн", Icon: Activity, color: "text-blue-400" },
  indirect: { label: "Косвенно", Icon: Wifi, color: "text-purple-400" },
};

const METHOD_META: Record<
  VerificationStep["method"],
  { label: string; Icon: typeof Phone }
> = {
  call: { label: "Звонок", Icon: Phone },
  interview: { label: "Интервью", Icon: Mic },
  document: { label: "Документы", Icon: FileText },
  reference: { label: "Reference", Icon: Users },
  technical: { label: "Тех. проверка", Icon: Wrench },
  osint: { label: "OSINT", Icon: Globe },
  external: { label: "Внешний источник", Icon: ShieldCheck },
};

const PRIORITY_LABEL = {
  must: "обязательно",
  should: "желательно",
  nice: "опционально",
};

const PRIORITY_COLOR = {
  must: "bg-red-500/15 text-red-400 border-red-500/30",
  should: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  nice: "bg-muted text-muted-foreground border-border",
};

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);

  // Собираем детальные evidence (если нет — строим из legacy evidence)
  const detailed: Evidence[] =
    finding.evidenceDetailed && finding.evidenceDetailed.length > 0
      ? finding.evidenceDetailed
      : finding.evidence.map((t) => ({ type: "quote" as const, text: t }));

  const steps = finding.verificationSteps || [];

  return (
    <div
      className="rounded-md border border-card-border bg-card/50 p-4"
      data-testid={`finding-${finding.id}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left"
        data-testid={`button-toggle-${finding.id}`}
      >
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={finding.severity} />
            <span className="font-medium text-foreground">{finding.title}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {finding.description}
          </p>
          {finding.impact && (
            <div className="mt-2 flex items-start gap-2 rounded border-l-2 border-amber-500/50 bg-amber-500/5 px-3 py-1.5">
              <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="text-xs text-amber-100/90">{finding.impact}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="font-mono text-lg font-bold text-primary">
              {finding.score}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              увер. {finding.confidence}%
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-t border-border pt-3">
          {/* Evidence */}
          {detailed.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Доказательства ({detailed.length})
              </div>
              <ul className="space-y-2">
                {detailed.map((ev, i) => {
                  const meta = EVIDENCE_META[ev.type] || EVIDENCE_META.quote;
                  const { Icon } = meta;
                  return (
                    <li
                      key={i}
                      className="rounded border border-border/60 bg-muted/40 p-2.5"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <Icon className={cn("h-3 w-3", meta.color)} />
                        <span
                          className={cn(
                            "font-mono text-[10px] uppercase tracking-wider",
                            meta.color,
                          )}
                        >
                          {meta.label}
                        </span>
                        {ev.location && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            · {ev.location}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs leading-relaxed text-foreground">
                        {ev.text}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {detailed.length === 0 && (
            <div className="text-xs italic text-muted-foreground">
              Прямых цитат нет — детектор сработал по совокупности признаков.
            </div>
          )}

          {/* Verification steps */}
          {steps.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Как верифицировать ({steps.length})
              </div>
              <ul className="space-y-2">
                {steps.map((s, i) => {
                  const meta = METHOD_META[s.method] || METHOD_META.interview;
                  const { Icon } = meta;
                  return (
                    <li
                      key={i}
                      className="rounded border border-border/60 bg-background/40 p-3"
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                            PRIORITY_COLOR[s.priority],
                          )}
                        >
                          {PRIORITY_LABEL[s.priority]}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          <Icon className="h-2.5 w-2.5" />
                          {meta.label}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          · трудозатраты: {s.effort}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {s.action}
                      </div>
                      {s.expectedOutcome && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Ожидаемый результат: {s.expectedOutcome}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
