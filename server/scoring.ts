// Модель скоринга v2: Risk Index — интерпретируемые скоры (полосы + драйверы + действие).
// Заменяет непрозрачный «риск 0–100» понятной шкалой: число + полоса + метка + драйверы + действие + уверенность.

import type {
  Band,
  Decision,
  ConfidenceLevel,
  SubIndex,
  SubIndexKey,
  RiskIndex,
  Finding,
  VerificationStatus,
} from "@shared/schema";

export const RI_BANDS: { band: Band; min: number; max: number; label: string; action: string }[] = [
  { band: "green", min: 0, max: 24, label: "Не вызывает вопросов", action: "Рутинная проверка не требуется" },
  { band: "yellow", min: 25, max: 49, label: "Факты или периоды требуют проверки", action: "Проверить отдельные факты/периоды" },
  { band: "red", min: 50, max: 100, label: "Факты или периоды требуют тщательной проверки", action: "Тщательная проверка + reference-check" },
];

export const DECISION_LABELS: Record<Decision, string> = {
  recommend: "Рекомендовать",
  verify: "Требует проверки",
  conditional: "Требует тщательной проверки",
  reject: "Не рекомендовать",
};

export function bandFromScore(score: number): Band {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= 50) return "red";
  if (s >= 25) return "yellow";
  return "green";
}
export function bandLabel(b: Band): string {
  return RI_BANDS.find((x) => x.band === b)!.label;
}
export function bandAction(b: Band): string {
  return RI_BANDS.find((x) => x.band === b)!.action;
}

export function decisionFromRI(
  score: number,
  opts: { blockingConflict?: boolean; verificationStatus?: VerificationStatus } = {},
): Decision {
  if (opts.blockingConflict) return "reject";
  const b = bandFromScore(score);
  let d: Decision;
  if (b === "red") d = "conditional";
  else if (b === "yellow") d = "verify";
  else d = "recommend";
  // не верифицирован → строже на ступень
  if (opts.verificationStatus === "not_checked") {
    if (d === "recommend") d = "verify";
    else if (d === "verify") d = "conditional";
  }
  return d;
}

export function confidenceFromEvidence(findings: Finding[]): ConfidenceLevel {
  let direct = 0;
  let indirect = 0;
  for (const f of findings) {
    for (const e of f.evidenceDetailed || []) {
      if (e.type === "quote" || e.type === "contradiction") direct++;
      else indirect++;
    }
  }
  if (direct >= 2) return "high";
  if (direct >= 1 || indirect >= 2) return "medium";
  return "low";
}

export const DEFAULT_RI_WEIGHTS: Record<SubIndexKey, number> = {
  chronology: 0.3,
  qualification: 0.25,
  authenticity: 0.2,
  behavior: 0.25,
  verification: 0,
  motivation: 0,
  loyalty: 0,
};

export const DEFAULT_PIPELINE_RI_WEIGHTS: Record<SubIndexKey, number> = {
  verification: 0.25,
  motivation: 0.3,
  loyalty: 0.3,
  authenticity: 0.15,
  chronology: 0,
  qualification: 0,
  behavior: 0,
};

export function driversFromFindings(findings: Finding[], n = 3): string[] {
  return [...findings]
    .sort((a, b) => b.score * b.confidence - a.score * a.confidence)
    .slice(0, n)
    .map((f) => f.title);
}

export function makeSubIndex(key: SubIndexKey, label: string, score: number, drivers: string[]): SubIndex {
  return {
    key,
    label,
    score: Math.max(0, Math.min(100, Math.round(score))),
    band: bandFromScore(score),
    drivers: drivers.slice(0, 3),
  };
}

export function computeRI(
  subs: SubIndex[],
  weights: Record<SubIndexKey, number>,
  opts: { blockingConflict?: boolean; verificationStatus?: VerificationStatus; findings?: Finding[] } = {},
): RiskIndex {
  let total = 0;
  let wsum = 0;
  for (const s of subs) {
    const w = weights[s.key] ?? 0;
    total += s.score * w;
    wsum += w;
  }
  const score = wsum > 0 ? Math.round(total / wsum) : 0;
  const band = bandFromScore(score);
  const drivers = subs
    .flatMap((s) => s.drivers.map((d) => ({ d, sc: s.score })))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3)
    .map((x) => x.d);
  const decision = decisionFromRI(score, opts);
  const confidence = opts.findings ? confidenceFromEvidence(opts.findings) : "medium";
  return { score, band, label: bandLabel(band), action: bandAction(band), decision, confidence, subIndices: subs, drivers };
}

/** Композитный индекс аутентичности из AI-детектора (0–100) и лингво-риска (0–100). */
export function computeAuthenticity(aiScore?: number, linguisticRisk?: number): number {
  if (aiScore != null && linguisticRisk != null) return Math.round(0.5 * aiScore + 0.5 * linguisticRisk);
  if (aiScore != null) return aiScore;
  if (linguisticRisk != null) return linguisticRisk;
  return 0;
}

/** Перевод статуса верификации ЭТК в 0–100 (выше = хуже). */
export function verificationToScore(status: VerificationStatus): number {
  switch (status) {
    case "confirmed":
      return 10;
    case "partial":
      return 40;
    case "not_checked":
      return 50;
    case "conflict":
      return 90;
  }
}
