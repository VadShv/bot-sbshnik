import { checks, pipelineChecks } from "@shared/schema";
import type {
  Check,
  InsertCheck,
  PipelineCheck,
  InsertPipelineCheck,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();
