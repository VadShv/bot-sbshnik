import { db } from "./storage";
import {
  llmProviders,
  promptVersions,
  appConfig,
  jdTemplates,
  settingsAuditLog,
} from "@shared/schema";
import type {
  Thresholds,
  Toggles,
  PromptKey,
  ProviderProtocol,
  LlmProviderMasked,
  JdTemplate,
  SettingsAuditLogEntry,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { encrypt, decrypt } from "./lib/crypto";
import { nanoid } from "nanoid";
import { DEFAULT_THRESHOLDS, DEFAULT_TOGGLES } from "./defaults";

export { DEFAULT_THRESHOLDS, DEFAULT_TOGGLES };

export type ProviderRuntime = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  endpoint: string;
  model: string;
  folderId: string | null;
  apiKey: string;
};

type Cached = {
  thresholds: Thresholds;
  toggles: Toggles;
  activeProviderId: string | null;
  fallbackProviderId: string | null;
  providers: typeof llmProviders.$inferSelect[];
  prompts: Map<string, string>;
};

let cache: Cached | null = null;

export function invalidateSettingsCache(): void {
  cache = null;
}

function load(): Cached {
  if (cache) return cache;
  const cfg = db.select().from(appConfig).where(eq(appConfig.id, 1)).get();
  const providers = db.select().from(llmProviders).orderBy(desc(llmProviders.createdAt)).all();
  const prompts = new Map<string, string>();
  const active = db.select().from(promptVersions).where(eq(promptVersions.isActive, true)).all();
  for (const p of active) prompts.set(p.promptKey, p.content);
  cache = {
    thresholds: cfg ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(cfg.thresholdsJson) } : DEFAULT_THRESHOLDS,
    toggles: cfg ? { ...DEFAULT_TOGGLES, ...JSON.parse(cfg.togglesJson) } : DEFAULT_TOGGLES,
    activeProviderId: cfg?.activeProviderId ?? null,
    fallbackProviderId: cfg?.fallbackProviderId ?? null,
    providers,
    prompts,
  };
  return cache;
}

// ============ Чтение ============
export function getThresholds(): Thresholds {
  return load().thresholds;
}
export function getToggles(): Toggles {
  return load().toggles;
}
export function getPrompt(key: PromptKey): string | null {
  return load().prompts.get(key) ?? null;
}
export function getJdTemplate(id: string): JdTemplate | null {
  const row = db.select().from(jdTemplates).where(eq(jdTemplates.id, id)).get();
  return row
    ? { id: row.id, name: row.name, content: row.content, createdAt: row.createdAt, updatedAt: row.updatedAt }
    : null;
}

function resolveProvider(id: string | null): ProviderRuntime | null {
  if (!id) return null;
  const row = load().providers.find((p) => p.id === id);
  if (!row) return null;
  let apiKey = "";
  if (row.apiKeyCipher) {
    apiKey = decrypt(row.apiKeyCipher, row.apiKeyNonce!, row.apiKeyTag!);
  } else if (row.apiKeyEnv) {
    apiKey = process.env[row.apiKeyEnv] || "";
  }
  return {
    id: row.id,
    name: row.name,
    protocol: row.protocol as ProviderProtocol,
    endpoint: row.endpoint,
    model: row.model,
    folderId: row.folderId,
    apiKey,
  };
}

export function getActiveProviderConfig(): ProviderRuntime | null {
  return resolveProvider(load().activeProviderId);
}
export function getFallbackProviderConfig(): ProviderRuntime | null {
  return resolveProvider(load().fallbackProviderId);
}

// ============ Маскированный список для API ============
function maskProvider(row: typeof llmProviders.$inferSelect): LlmProviderMasked {
  let apiKeyDisplay = "—";
  if (row.apiKeyCipher) {
    try {
      apiKeyDisplay = "••••" + decrypt(row.apiKeyCipher, row.apiKeyNonce!, row.apiKeyTag!).slice(-4);
    } catch {
      apiKeyDisplay = "••••";
    }
  } else if (row.apiKeyEnv) {
    apiKeyDisplay = `env:${row.apiKeyEnv}`;
  }
  return {
    id: row.id,
    name: row.name,
    protocol: row.protocol as ProviderProtocol,
    endpoint: row.endpoint,
    model: row.model,
    folderId: row.folderId,
    apiKeyDisplay,
    createdAt: row.createdAt,
  };
}

export function listProvidersMasked(): LlmProviderMasked[] {
  return load().providers.map(maskProvider);
}

export function listPromptVersions(promptKey?: PromptKey) {
  const rows = promptKey
    ? db.select().from(promptVersions).where(eq(promptVersions.promptKey, promptKey)).orderBy(desc(promptVersions.version)).all()
    : db.select().from(promptVersions).orderBy(desc(promptVersions.createdAt)).all();
  return rows.map((r) => ({
    id: r.id,
    promptKey: r.promptKey,
    version: r.version,
    content: r.content,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export function getAppConfigSummary() {
  const c = load();
  return {
    thresholds: c.thresholds,
    toggles: c.toggles,
    activeProviderId: c.activeProviderId,
    fallbackProviderId: c.fallbackProviderId,
    providers: c.providers.map(maskProvider),
    prompts: Array.from(c.prompts.keys()),
  };
}

// ============ Audit log ============
export function appendAuditLog(action: string, field: string, diff: unknown, actor = "admin"): void {
  db.insert(settingsAuditLog)
    .values({
      id: nanoid(),
      action,
      field,
      diffJson: JSON.stringify(diff),
      actor,
      createdAt: Date.now(),
    })
    .run();
}

export function listAuditLog(limit = 100): SettingsAuditLogEntry[] {
  const rows = db.select().from(settingsAuditLog).orderBy(desc(settingsAuditLog.createdAt)).limit(limit).all();
  return rows.map((r) => {
    let diff: unknown = null;
    try {
      diff = JSON.parse(r.diffJson);
    } catch {
      diff = r.diffJson;
    }
    return { id: r.id, action: r.action, field: r.field, diff, actor: r.actor, createdAt: r.createdAt };
  });
}

// ============ Мутации ============
export function updateThresholds(next: Partial<Thresholds>, actor = "admin"): Thresholds {
  const cur = getThresholds();
  const merged = { ...cur, ...next };
  db.update(appConfig).set({ thresholdsJson: JSON.stringify(merged), updatedAt: Date.now() }).where(eq(appConfig.id, 1)).run();
  appendAuditLog("thresholds_update", "thresholds", { from: cur, to: merged }, actor);
  invalidateSettingsCache();
  return merged;
}

export function updateToggles(next: Partial<Toggles>, actor = "admin"): Toggles {
  const cur = getToggles();
  const merged = { ...cur, ...next };
  db.update(appConfig).set({ togglesJson: JSON.stringify(merged), updatedAt: Date.now() }).where(eq(appConfig.id, 1)).run();
  appendAuditLog("toggles_update", "toggles", { from: cur, to: merged }, actor);
  invalidateSettingsCache();
  return merged;
}

export type ProviderInput = {
  name: string;
  protocol: ProviderProtocol;
  endpoint: string;
  model: string;
  folderId?: string | null;
  apiKey?: string;
  apiKeyEnv?: string | null;
};

export function createProvider(input: ProviderInput, actor = "admin"): LlmProviderMasked {
  const id = nanoid();
  const enc = input.apiKey ? encrypt(input.apiKey) : { cipher: null, nonce: null, tag: null };
  const useEnv = !input.apiKey && !!input.apiKeyEnv;
  db.insert(llmProviders)
    .values({
      id,
      name: input.name,
      protocol: input.protocol,
      endpoint: input.endpoint,
      model: input.model,
      folderId: input.folderId ?? null,
      apiKeyCipher: enc.cipher,
      apiKeyNonce: enc.nonce,
      apiKeyTag: enc.tag,
      apiKeyEnv: useEnv ? input.apiKeyEnv! : null,
      createdAt: Date.now(),
    })
    .run();
  const row = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get()!;
  appendAuditLog("provider_create", "provider", { to: maskProvider(row) }, actor);
  invalidateSettingsCache();
  return maskProvider(row);
}

export function updateProvider(id: string, input: Partial<ProviderInput>, actor = "admin"): LlmProviderMasked | null {
  const row = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!row) return null;
  const before = maskProvider(row);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.protocol !== undefined) patch.protocol = input.protocol;
  if (input.endpoint !== undefined) patch.endpoint = input.endpoint;
  if (input.model !== undefined) patch.model = input.model;
  if (input.folderId !== undefined) patch.folderId = input.folderId ?? null;
  if (input.apiKey !== undefined) {
    if (input.apiKey) {
      const enc = encrypt(input.apiKey);
      patch.apiKeyCipher = enc.cipher;
      patch.apiKeyNonce = enc.nonce;
      patch.apiKeyTag = enc.tag;
      patch.apiKeyEnv = null;
    } else {
      patch.apiKeyCipher = null;
      patch.apiKeyNonce = null;
      patch.apiKeyTag = null;
    }
  }
  if (input.apiKeyEnv !== undefined) {
    patch.apiKeyEnv = input.apiKeyEnv ?? null;
    if (input.apiKeyEnv) {
      patch.apiKeyCipher = null;
      patch.apiKeyNonce = null;
      patch.apiKeyTag = null;
    }
  }
  if (Object.keys(patch).length > 0) {
    db.update(llmProviders).set(patch as any).where(eq(llmProviders.id, id)).run();
  }
  const after = maskProvider(db.select().from(llmProviders).where(eq(llmProviders.id, id)).get()!);
  appendAuditLog("provider_update", "provider", { from: before, to: after }, actor);
  invalidateSettingsCache();
  return after;
}

export function deleteProvider(id: string, actor = "admin"): boolean {
  const row = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!row) return false;
  const before = maskProvider(row);
  db.delete(llmProviders).where(eq(llmProviders.id, id)).run();
  const cfg = db.select().from(appConfig).where(eq(appConfig.id, 1)).get();
  if (cfg) {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (cfg.activeProviderId === id) patch.activeProviderId = null;
    if (cfg.fallbackProviderId === id) patch.fallbackProviderId = null;
    db.update(appConfig).set(patch as any).where(eq(appConfig.id, 1)).run();
  }
  appendAuditLog("provider_delete", "provider", { from: before }, actor);
  invalidateSettingsCache();
  return true;
}

export function setActiveProvider(id: string, actor = "admin"): boolean {
  const row = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
  if (!row) return false;
  const before = db.select().from(appConfig).where(eq(appConfig.id, 1)).get()?.activeProviderId ?? null;
  db.update(appConfig).set({ activeProviderId: id, updatedAt: Date.now() }).where(eq(appConfig.id, 1)).run();
  appendAuditLog("provider_activate", "activeProviderId", { from: before, to: id }, actor);
  invalidateSettingsCache();
  return true;
}

export function setFallbackProvider(id: string | null, actor = "admin"): boolean {
  if (id !== null) {
    const row = db.select().from(llmProviders).where(eq(llmProviders.id, id)).get();
    if (!row) return false;
  }
  const before = db.select().from(appConfig).where(eq(appConfig.id, 1)).get()?.fallbackProviderId ?? null;
  db.update(appConfig).set({ fallbackProviderId: id, updatedAt: Date.now() }).where(eq(appConfig.id, 1)).run();
  appendAuditLog("provider_fallback", "fallbackProviderId", { from: before, to: id }, actor);
  invalidateSettingsCache();
  return true;
}

export function savePromptVersion(promptKey: PromptKey, content: string, actor = "admin") {
  const rows = db.select().from(promptVersions).where(eq(promptVersions.promptKey, promptKey)).all();
  const nextVersion = rows.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  db.update(promptVersions).set({ isActive: false }).where(eq(promptVersions.promptKey, promptKey)).run();
  const id = nanoid();
  db.insert(promptVersions)
    .values({
      id,
      promptKey,
      version: nextVersion,
      content,
      isActive: true,
      createdAt: Date.now(),
    })
    .run();
  appendAuditLog("prompt_publish", promptKey, { version: nextVersion }, actor);
  invalidateSettingsCache();
  return { id, promptKey, version: nextVersion, content, isActive: true, createdAt: Date.now() };
}

export function activatePromptVersion(promptKey: PromptKey, version: number, actor = "admin"): boolean {
  const row = db
    .select()
    .from(promptVersions)
    .where(and(eq(promptVersions.promptKey, promptKey), eq(promptVersions.version, version)))
    .get();
  if (!row) return false;
  db.update(promptVersions).set({ isActive: false }).where(eq(promptVersions.promptKey, promptKey)).run();
  db.update(promptVersions)
    .set({ isActive: true })
    .where(and(eq(promptVersions.promptKey, promptKey), eq(promptVersions.version, version)))
    .run();
  appendAuditLog("prompt_activate", promptKey, { version }, actor);
  invalidateSettingsCache();
  return true;
}

// ============ JD CRUD ============
export function listJdTemplates(): JdTemplate[] {
  return db
    .select()
    .from(jdTemplates)
    .orderBy(desc(jdTemplates.updatedAt))
    .all()
    .map((r) => ({ id: r.id, name: r.name, content: r.content, createdAt: r.createdAt, updatedAt: r.updatedAt }));
}
export function createJdTemplate(name: string, content: string, actor = "admin"): JdTemplate {
  const id = nanoid();
  const now = Date.now();
  db.insert(jdTemplates).values({ id, name, content, createdAt: now, updatedAt: now }).run();
  appendAuditLog("jd_create", "jd", { to: { id, name } }, actor);
  return { id, name, content, createdAt: now, updatedAt: now };
}
export function updateJdTemplate(id: string, patch: { name?: string; content?: string }, actor = "admin"): JdTemplate | null {
  const row = db.select().from(jdTemplates).where(eq(jdTemplates.id, id)).get();
  if (!row) return null;
  const p: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.content !== undefined) p.content = patch.content;
  db.update(jdTemplates).set(p as any).where(eq(jdTemplates.id, id)).run();
  appendAuditLog("jd_update", "jd", { id, from: { name: row.name }, to: patch }, actor);
  const after = db.select().from(jdTemplates).where(eq(jdTemplates.id, id)).get()!;
  return { id: after.id, name: after.name, content: after.content, createdAt: after.createdAt, updatedAt: after.updatedAt };
}
export function deleteJdTemplate(id: string, actor = "admin"): boolean {
  const row = db.select().from(jdTemplates).where(eq(jdTemplates.id, id)).get();
  if (!row) return false;
  db.delete(jdTemplates).where(eq(jdTemplates.id, id)).run();
  appendAuditLog("jd_delete", "jd", { from: { id, name: row.name } }, actor);
  return true;
}

// ============ Seed при первом старте ============
export function seedSettingsIfEmpty(): void {
  const existing = db.select().from(appConfig).where(eq(appConfig.id, 1)).get();
  if (existing) return;

  db.insert(appConfig)
    .values({
      id: 1,
      thresholdsJson: JSON.stringify(DEFAULT_THRESHOLDS),
      togglesJson: JSON.stringify(DEFAULT_TOGGLES),
      activeProviderId: null,
      fallbackProviderId: null,
      updatedAt: Date.now(),
    })
    .run();

  // Сид-провайдер Yandex из env (env-backed: ключ не хранится в БД, читается из env).
  const yandexKey = process.env.YANDEX_API_KEY || "";
  const yandexFolder = process.env.YANDEX_FOLDER_ID || "";
  const yandexModel = process.env.YANDEX_MODEL || "yandexgpt";
  if (yandexKey && yandexFolder) {
    const requiresOAI = /(qwen|gpt-oss|deepseek|gemma)/i.test(yandexModel);
    const endpoint = requiresOAI
      ? "https://llm.api.cloud.yandex.net/v1/chat/completions"
      : "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
    const id = "yandex-default";
    db.insert(llmProviders)
      .values({
        id,
        name: "Yandex (env)",
        protocol: requiresOAI ? "openai-compatible" : "yandex-native",
        endpoint,
        model: yandexModel,
        folderId: yandexFolder,
        apiKeyCipher: null,
        apiKeyNonce: null,
        apiKeyTag: null,
        apiKeyEnv: "YANDEX_API_KEY",
        createdAt: Date.now(),
      })
      .run();
    db.update(appConfig).set({ activeProviderId: id, updatedAt: Date.now() }).where(eq(appConfig.id, 1)).run();
  }
  invalidateSettingsCache();
}
