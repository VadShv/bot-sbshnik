import { checks, pipelineChecks, chatMessages, teamFitReports, githubDeepScanReports } from "@shared/schema";
import type {
  Check,
  InsertCheck,
  PipelineCheck,
  InsertPipelineCheck,
  ChatMessage,
  InsertChatMessage,
  InsertTeamFitReport,
  TeamFitReportRow,
  InsertGithubDeepScanReport,
  GithubDeepScanReportRow,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, asc, desc } from "drizzle-orm";
import path from "path";
import fs from "fs";

// Путь к БД: по умолчанию data.db в корне, можно переопределить через DATABASE_PATH.
// На Railway выставляем DATABASE_PATH=/data/data.db, где /data — persistent volume.
const dbPath = process.env.DATABASE_PATH || "data.db";
const dbDir = path.dirname(dbPath);
if (dbDir && dbDir !== "." && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// Миграция
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    candidate_name TEXT,
    resume_text TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    inflation_score INTEGER NOT NULL,
    wolves_score INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    report_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pipeline_checks (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    parent_id TEXT,
    version INTEGER NOT NULL,
    candidate_name TEXT,
    resume_text TEXT NOT NULL,
    etk_text TEXT,
    interview_text TEXT,
    references_text TEXT,
    recruiter_form TEXT NOT NULL,
    composite_score INTEGER NOT NULL,
    resolution_code TEXT NOT NULL,
    report_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pipeline_created ON pipeline_checks(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pipeline_parent ON pipeline_checks(parent_id);
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    parent_check_id TEXT NOT NULL,
    pipeline_check_id TEXT,
    created_at INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_parent ON chat_messages(parent_check_id, created_at ASC);
  CREATE TABLE IF NOT EXISTS team_fit_reports (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ocean TEXT NOT NULL,
    mbti_cluster TEXT NOT NULL,
    mbti_reasoning TEXT NOT NULL,
    value_fit TEXT NOT NULL,
    vendor_fit TEXT NOT NULL,
    product_fit TEXT NOT NULL,
    methodology_fit TEXT NOT NULL,
    behavioral_profile TEXT NOT NULL,
    hypotheses TEXT NOT NULL,
    summary TEXT NOT NULL,
    data_insufficient INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_team_fit_check ON team_fit_reports(check_id);
  CREATE TABLE IF NOT EXISTS github_deepscan_reports (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    github_handle TEXT NOT NULL,
    profile_url TEXT NOT NULL,
    sb_score INTEGER NOT NULL,
    tech_score INTEGER NOT NULL,
    behavior_score INTEGER NOT NULL,
    risk_score INTEGER NOT NULL,
    confidence INTEGER NOT NULL,
    tech_profile TEXT NOT NULL,
    behavior_profile TEXT NOT NULL,
    risk_flags TEXT NOT NULL,
    ocean_hints TEXT NOT NULL,
    evidence TEXT NOT NULL,
    summary TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    data_insufficient INTEGER NOT NULL,
    fetch_error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_github_deepscan_check ON github_deepscan_reports(check_id);
  CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    model TEXT NOT NULL,
    folder_id TEXT,
    api_key_cipher TEXT,
    api_key_nonce TEXT,
    api_key_tag TEXT,
    api_key_env TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_key TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_prompt_key ON prompt_versions(prompt_key);
  CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY,
    thresholds_json TEXT NOT NULL,
    toggles_json TEXT NOT NULL,
    active_provider_id TEXT,
    fallback_provider_id TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jd_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings_audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    field TEXT NOT NULL,
    diff_json TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON settings_audit_log(created_at DESC);
`);

export const db = drizzle(sqlite);

export interface IStorage {
  // Классические проверки
  saveCheck(check: InsertCheck): Promise<Check>;
  getCheck(id: string): Promise<Check | undefined>;
  listChecks(limit?: number): Promise<Check[]>;
  deleteCheck(id: string): Promise<void>;
  // Пайплайн v3.0
  savePipelineCheck(check: InsertPipelineCheck): Promise<PipelineCheck>;
  getPipelineCheck(id: string): Promise<PipelineCheck | undefined>;
  listPipelineChecks(limit?: number): Promise<PipelineCheck[]>;
  listPipelinesByParent(parentId: string): Promise<PipelineCheck[]>;
  listPipelinesByParentIds(parentIds: string[]): Promise<PipelineCheck[]>;
  deletePipelineCheck(id: string): Promise<void>;
  // Чат v3.3
  appendChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  listChatMessages(parentCheckId: string, limit?: number): Promise<ChatMessage[]>;
  deleteChatByParent(parentCheckId: string): Promise<void>;
  // Team Fit v3.4
  createTeamFitReport(row: InsertTeamFitReport): Promise<TeamFitReportRow>;
  getTeamFitReportByCheckId(checkId: string): Promise<TeamFitReportRow | undefined>;
  deleteTeamFitReport(checkId: string): Promise<void>;
  // GitHub DeepScan v3.5
  createGithubDeepScanReport(row: InsertGithubDeepScanReport): Promise<GithubDeepScanReportRow>;
  getGithubDeepScanReportByCheckId(checkId: string): Promise<GithubDeepScanReportRow | undefined>;
  deleteGithubDeepScanReport(checkId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async saveCheck(check: InsertCheck): Promise<Check> {
    return db.insert(checks).values(check).returning().get();
  }
  async getCheck(id: string): Promise<Check | undefined> {
    return db.select().from(checks).where(eq(checks.id, id)).get();
  }
  async listChecks(limit = 100): Promise<Check[]> {
    return db.select().from(checks).orderBy(desc(checks.createdAt)).limit(limit).all();
  }
  async deleteCheck(id: string): Promise<void> {
    db.delete(checks).where(eq(checks.id, id)).run();
  }
  async savePipelineCheck(check: InsertPipelineCheck): Promise<PipelineCheck> {
    return db.insert(pipelineChecks).values(check).returning().get();
  }
  async getPipelineCheck(id: string): Promise<PipelineCheck | undefined> {
    return db.select().from(pipelineChecks).where(eq(pipelineChecks.id, id)).get();
  }
  async listPipelineChecks(limit = 100): Promise<PipelineCheck[]> {
    return db
      .select()
      .from(pipelineChecks)
      .orderBy(desc(pipelineChecks.createdAt))
      .limit(limit)
      .all();
  }
  async listPipelinesByParent(parentId: string): Promise<PipelineCheck[]> {
    return db
      .select()
      .from(pipelineChecks)
      .where(eq(pipelineChecks.parentId, parentId))
      .orderBy(desc(pipelineChecks.createdAt))
      .all();
  }
  async listPipelinesByParentIds(parentIds: string[]): Promise<PipelineCheck[]> {
    if (parentIds.length === 0) return [];
    // Простой путь: параметризованный IN через drizzle inArray
    const { inArray } = await import("drizzle-orm");
    return db
      .select()
      .from(pipelineChecks)
      .where(inArray(pipelineChecks.parentId, parentIds))
      .all();
  }
  async deletePipelineCheck(id: string): Promise<void> {
    db.delete(pipelineChecks).where(eq(pipelineChecks.id, id)).run();
  }
  async appendChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    return db.insert(chatMessages).values(msg).returning().get();
  }
  async listChatMessages(parentCheckId: string, limit = 200): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.parentCheckId, parentCheckId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit)
      .all();
  }
  async deleteChatByParent(parentCheckId: string): Promise<void> {
    db.delete(chatMessages).where(eq(chatMessages.parentCheckId, parentCheckId)).run();
  }
  async createTeamFitReport(row: InsertTeamFitReport): Promise<TeamFitReportRow> {
    // Удаляем предыдущий отчёт по этой проверке, если был — храним один актуальный
    db.delete(teamFitReports).where(eq(teamFitReports.checkId, row.checkId)).run();
    return db.insert(teamFitReports).values(row).returning().get();
  }
  async getTeamFitReportByCheckId(checkId: string): Promise<TeamFitReportRow | undefined> {
    return db
      .select()
      .from(teamFitReports)
      .where(eq(teamFitReports.checkId, checkId))
      .orderBy(desc(teamFitReports.createdAt))
      .get();
  }
  async deleteTeamFitReport(checkId: string): Promise<void> {
    db.delete(teamFitReports).where(eq(teamFitReports.checkId, checkId)).run();
  }
  async createGithubDeepScanReport(row: InsertGithubDeepScanReport): Promise<GithubDeepScanReportRow> {
    db.delete(githubDeepScanReports).where(eq(githubDeepScanReports.checkId, row.checkId)).run();
    return db.insert(githubDeepScanReports).values(row).returning().get();
  }
  async getGithubDeepScanReportByCheckId(checkId: string): Promise<GithubDeepScanReportRow | undefined> {
    return db
      .select()
      .from(githubDeepScanReports)
      .where(eq(githubDeepScanReports.checkId, checkId))
      .orderBy(desc(githubDeepScanReports.createdAt))
      .get();
  }
  async deleteGithubDeepScanReport(checkId: string): Promise<void> {
    db.delete(githubDeepScanReports).where(eq(githubDeepScanReports.checkId, checkId)).run();
  }
}

export const storage = new DatabaseStorage();
