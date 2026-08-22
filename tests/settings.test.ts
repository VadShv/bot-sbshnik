import { describe, it, expect, beforeAll } from "vitest";
import { rmSync } from "node:fs";

let settings: typeof import("../server/settings");

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_PATH = "/tmp/kilo/bot-sbshnik-test.db";
  try {
    rmSync("/tmp/kilo/bot-sbshnik-test.db", { force: true });
  } catch {
    // ignore
  }
  settings = await import("../server/settings");
  settings.invalidateSettingsCache();
  settings.seedSettingsIfEmpty();
});

describe("settings (M1)", () => {
  it("seed создаёт дефолтные пороги", () => {
    expect(settings.getThresholds()).toEqual(settings.DEFAULT_THRESHOLDS);
  });

  it("seed создаёт дефолтные тогглы (всё вкл)", () => {
    const t = settings.getToggles();
    expect(t).toEqual(settings.DEFAULT_TOGGLES);
    expect(Object.values(t).every(Boolean)).toBe(true);
  });

  it("getPrompt возвращает null без сидированных промптов → fallback к коду", () => {
    expect(settings.getPrompt("analyze_system")).toBeNull();
  });

  it("updateThresholds объединяет и инвалидирует кэш", () => {
    const before = settings.getThresholds().gapMonths;
    const updated = settings.updateThresholds({ gapMonths: before + 1 });
    expect(updated.gapMonths).toBe(before + 1);
    expect(settings.getThresholds().gapMonths).toBe(before + 1);
    // откатываем, чтобы не влиять на другие тесты
    settings.updateThresholds({ gapMonths: before });
  });

  it("audit log фиксирует изменения", () => {
    settings.updateToggles({ teamFit: false });
    const log = settings.listAuditLog(10);
    expect(log.length).toBeGreaterThan(0);
    expect(log.some((e) => e.action === "toggles_update")).toBe(true);
  });
});
