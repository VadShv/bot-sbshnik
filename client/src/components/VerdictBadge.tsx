import { cn } from "@/lib/utils";

const map: Record<
  "green" | "yellow" | "red",
  { label: string; cls: string; dot: string }
> = {
  green: {
    label: "Допуск без ограничений",
    cls: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
    dot: "bg-emerald-400",
  },
  yellow: {
    label: "Требуется доп. проверка",
    cls: "bg-amber-950/60 text-amber-300 border-amber-800",
    dot: "bg-amber-400",
  },
  red: {
    label: "Высокий риск — отклонить/эскалировать",
    cls: "bg-red-950/60 text-red-300 border-red-800",
    dot: "bg-red-500",
  },
};

export function VerdictBadge({
  verdict,
  size = "md",
}: {
  verdict: "green" | "yellow" | "red";
  size?: "sm" | "md" | "lg";
}) {
  const m = map[verdict];
  return (
    <div
      data-testid={`badge-verdict-${verdict}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-medium",
        m.cls,
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", m.dot)} />
      {m.label}
    </div>
  );
}

export function SeverityChip({
  severity,
}: {
  severity: "low" | "medium" | "high" | "critical";
}) {
  const map2 = {
    low: "bg-zinc-800 text-zinc-300 border-zinc-700",
    medium: "bg-amber-950/60 text-amber-300 border-amber-800",
    high: "bg-orange-950/60 text-orange-300 border-orange-800",
    critical: "bg-red-950/60 text-red-300 border-red-800",
  } as const;
  const lbl = {
    low: "низкий",
    medium: "средний",
    high: "высокий",
    critical: "критический",
  }[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        map2[severity]
      )}
    >
      {lbl}
    </span>
  );
}
