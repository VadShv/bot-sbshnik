import type { Thresholds, Toggles } from "@shared/schema";

// DB-free значения по умолчанию (импортируются без подключения БД — для детекторов/тестов).
export const DEFAULT_THRESHOLDS: Thresholds = {
  gapMonths: 6,
  overlapMonths: 2,
  shortStintMonths: 9,
  jobHoppingCount: 3,
  stackInflationCount: 25,
  seniorMinYears: 3,
  kpiPercent: 300,
  kpiTimes: 10,
  aiDetectorThreshold: 60,
  csRejectBelow: 50,
  csRecommendAbove: 70,
};

export const DEFAULT_TOGGLES: Toggles = {
  etcVerification: true,
  detectors: true,
  linguistic: true,
  aiDetector: true,
  wolfAudit: true,
  teamFit: true,
  githubDeepScan: true,
};
