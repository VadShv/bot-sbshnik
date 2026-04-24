// Ре-экспорт типов отчёта из shared, чтобы фронт и бэкенд были в синхроне.
import type { ResolutionCode } from "@shared/schema";

export type {
  Severity,
  EvidenceType,
  Evidence,
  VerificationStep,
  FindingCategory,
  Finding,
  CategoryReport,
  SubcategoryScore,
  RedFlag,
  RecruiterAction,
  FullReport,
  // Wolf Detector v1.0
  TimelineEntry,
  TimelineAnomaly,
  ProgressionAnomaly,
  EmployerCheck,
  AchievementItem,
  SkillIssue,
  WolfSignalType,
  WolfSignalCategory,
  WolfArchetype,
  WolfSignal,
  OsintSourceId,
  OsintCheck,
  InterviewQuestionTriplet,
  PolygraphQuestionKind,
  PolygraphTrigger,
  WolfSchoolCode,
  OveremploymentRisk,
  WolfSchoolDetection,
  WolfAudit,
  // Single-Step Pipeline v3.0
  RecruiterForm,
  SearchReason,
  AttitudeToFormer,
  TimePressure,
  References,
  EtkRecord,
  EtkStructured,
  VerificationStatus,
  VerificationItem,
  VerificationResult,
  MotivationAnalysis,
  CulturalValueKey,
  CulturalValueScore,
  CulturalFitV3,
  LoyaltyScore,
  ResolutionCode,
  FinalResolution,
  SingleStepReport,
  ExecutiveSummary,
  KeyFinding,
  ConsistencyCheck,
  TimelineMetrics,
  EmploymentSpan,
  // Linguistic Audit v1.0
  LiwcCounters,
  LiwcAnalysis,
  RmBlockKind,
  RmBlockScore,
  RealityMonitoringAnalysis,
  CognitiveLoadAnalysis,
  AcidCriterion,
  AcidBlockClassification,
  AcidAnalysis,
  LinguisticAuditVerdict,
  LinguisticAudit,
  // Team Fit / Fit Guard v3 (v3.4)
  TeamFitReport,
  OceanScores,
  MbtiCluster,
  FitAxis,
  FitAxisStatus,
  InterviewHypothesis,
} from "@shared/schema";

export type CheckListItem = {
  id: string;
  createdAt: number;
  candidateName: string | null;
  riskScore: number;
  inflationScore: number;
  wolvesScore: number;
  totalScore: number;
  verdict: "green" | "yellow" | "red";
  hasPipeline?: boolean;
  pipelineCount?: number;
};

export type PipelineSummary = {
  id: string;
  createdAt: number;
  version: number;
  compositeScore: number;
  resolutionCode: ResolutionCode;
};
