import { describe, it, expect } from "vitest";
import {
  bandFromScore,
  decisionFromRI,
  confidenceFromEvidence,
  computeRI,
  makeSubIndex,
  computeAuthenticity,
  verificationToScore,
  DEFAULT_RI_WEIGHTS,
} from "../server/scoring";
import type { Finding, EvidenceType } from "@shared/schema";

function f(type: EvidenceType): Finding {
  return {
    id: "x",
    title: "t",
    severity: "medium",
    score: 50,
    confidence: 80,
    description: "",
    evidence: [],
    evidenceDetailed: [{ type, text: "q" }],
  };
}

describe("scoring v2 (Risk Index)", () => {
  it("bandFromScore: 4 полосы + clamp", () => {
    expect(bandFromScore(0)).toBe("low");
    expect(bandFromScore(29)).toBe("low");
    expect(bandFromScore(30)).toBe("moderate");
    expect(bandFromScore(54)).toBe("moderate");
    expect(bandFromScore(55)).toBe("elevated");
    expect(bandFromScore(79)).toBe("elevated");
    expect(bandFromScore(80)).toBe("high");
    expect(bandFromScore(100)).toBe("high");
    expect(bandFromScore(150)).toBe("high");
    expect(bandFromScore(-5)).toBe("low");
  });

  it("decisionFromRI: полосы + blocking + not_checked", () => {
    expect(decisionFromRI(10)).toBe("recommend");
    expect(decisionFromRI(40)).toBe("verify");
    expect(decisionFromRI(60)).toBe("conditional");
    expect(decisionFromRI(90)).toBe("reject");
    expect(decisionFromRI(10, { blockingConflict: true })).toBe("reject");
    expect(decisionFromRI(10, { verificationStatus: "not_checked" })).toBe("verify");
    expect(decisionFromRI(40, { verificationStatus: "not_checked" })).toBe("conditional");
  });

  it("confidenceFromEvidence: по типу доказательств", () => {
    expect(confidenceFromEvidence([f("quote"), f("contradiction")])).toBe("high");
    expect(confidenceFromEvidence([f("quote")])).toBe("medium");
    expect(confidenceFromEvidence([f("pattern"), f("absence")])).toBe("medium");
    expect(confidenceFromEvidence([f("pattern")])).toBe("low");
    expect(confidenceFromEvidence([])).toBe("low");
  });

  it("computeRI: взвешенный композит + полоса + драйверы", () => {
    const ri = computeRI(
      [
        makeSubIndex("chronology", "Хронология", 80, ["gap 14 мес"]),
        makeSubIndex("qualification", "Квалификация", 40, ["senior@2года"]),
        makeSubIndex("authenticity", "Аутентичность", 90, ["AI: generated"]),
        makeSubIndex("behavior", "Поведение", 95, ["wolf-лексика"]),
      ],
      DEFAULT_RI_WEIGHTS,
    );
    // 0.3*80 + 0.25*40 + 0.2*90 + 0.25*95 = 75.75 → 76
    expect(ri.score).toBe(76);
    expect(ri.band).toBe("elevated");
    expect(ri.decision).toBe("conditional");
    expect(ri.drivers.length).toBeLessThanOrEqual(3);
    expect(ri.subIndices).toHaveLength(4);
  });

  it("computeAuthenticity: композит AI + лингвистика", () => {
    expect(computeAuthenticity(80, 60)).toBe(70);
    expect(computeAuthenticity(80)).toBe(80);
    expect(computeAuthenticity(undefined, 60)).toBe(60);
    expect(computeAuthenticity()).toBe(0);
  });

  it("verificationToScore: статус ЭТК", () => {
    expect(verificationToScore("confirmed")).toBe(10);
    expect(verificationToScore("partial")).toBe(40);
    expect(verificationToScore("not_checked")).toBe(50);
    expect(verificationToScore("conflict")).toBe(90);
  });
});
