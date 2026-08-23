import type { RiskIndex, Band, Decision, ConfidenceLevel } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BAND_STYLE: Record<Band, { color: string; emoji: string }> = {
  green: { color: "text-green-600", emoji: "🟢" },
  yellow: { color: "text-yellow-600", emoji: "🟡" },
  red: { color: "text-red-600", emoji: "🔴" },
};

const DECISION_LABEL: Record<Decision, string> = {
  recommend: "Рекомендовать",
  verify: "Нужна верификация",
  conditional: "Условно",
  reject: "Не рекомендовать",
};

const CONF_LABEL: Record<ConfidenceLevel, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
};

export function Scorecard({ ri }: { ri?: RiskIndex | null }) {
  if (!ri) return null;
  const style = BAND_STYLE[ri.band];
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`text-4xl font-bold leading-none ${style.color}`}>{ri.score}</div>
        <div className="min-w-0">
          <div className={`font-semibold ${style.color}`}>
            {style.emoji} {ri.label}
          </div>
          <div className="text-xs text-muted-foreground">Risk Index · {ri.action}</div>
        </div>
        <Badge className="ml-auto whitespace-nowrap">{DECISION_LABEL[ri.decision]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ri.subIndices.map((s) => {
          const bs = BAND_STYLE[s.band];
          return (
            <div key={s.key} className="rounded-md border p-2">
              <div className="text-[11px] text-muted-foreground truncate">{s.label}</div>
              <div className={`text-lg font-semibold ${bs.color}`}>
                {bs.emoji} {s.score}
              </div>
              {s.drivers.length > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{s.drivers.join(" · ")}</div>
              )}
            </div>
          );
        })}
      </div>

      {ri.drivers.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Драйверы: </span>
          {ri.drivers.join(" · ")}
        </div>
      )}

      <div className="text-xs text-muted-foreground">Уверенность: {CONF_LABEL[ri.confidence]}</div>
    </Card>
  );
}
