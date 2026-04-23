import { cn } from "@/lib/utils";

export function ScoreGauge({
  score,
  label,
  size = 120,
  compact,
}: {
  score: number;
  label: string;
  size?: number;
  compact?: boolean;
}) {
  const radius = size / 2 - 8;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 61
      ? "hsl(0 72% 55%)"
      : score >= 31
      ? "hsl(38 92% 55%)"
      : "hsl(142 60% 50%)";
  return (
    <div className={cn("flex flex-col items-center", compact && "scale-90")}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        data-testid={`gauge-${label}`}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth={8}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={8}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 800ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-3xl font-bold" style={{ color }}>
            {score}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            из 100
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
