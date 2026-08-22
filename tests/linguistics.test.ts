import { describe, it, expect } from "vitest";
import { runLiwc, runLinguisticAudit, splitBlocks } from "../server/linguistics";

describe("runLiwc", () => {
  it("считает 1-е лицо ед.ч.", () => {
    const r = runLiwc("я сделал я запустил мой проект");
    expect(r.counters.firstPersonSingular).toBeGreaterThanOrEqual(3);
  });

  it("помечает iDominant когда «я» >> «мы»", () => {
    const r = runLiwc("я я я я мы");
    expect(r.markers.iDominant).toBe(true);
  });

  it("помечает blamesOthers (3-е лицо + негатив)", () => {
    const r = runLiwc("они плохие токсичные конфликтные начальники");
    expect(r.markers.blamesOthers).toBe(true);
  });

  it("считает когнитивные механизмы (C2: кириллические границы фраз)", () => {
    // До фикса \b не работал с кириллицей — «решил» и «потому что» не считывались.
    const r = runLiwc("я решил задачу потому что это было важно");
    expect(r.counters.cognitiveMechanisms).toBeGreaterThanOrEqual(2);
  });
});

describe("splitBlocks", () => {
  it("выделяет блоки по заголовкам", () => {
    const text =
      "Опыт работы\nя разработал систему и внедрил её в продакшн успешно\n\n" +
      "Достижения\nвыиграл хакатон и поднял конверсию на двадцать процентов";
    const blocks = splitBlocks(text);
    const kinds = blocks.map((b) => b.kind);
    expect(kinds).toContain("experience");
    expect(kinds).toContain("achievements");
  });

  it("fallback на один блок при отсутствии заголовков", () => {
    const text = "просто текст без заголовков достаточной длины чтобы пройти фильтр".repeat(2);
    const blocks = splitBlocks(text);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("runLinguisticAudit", () => {
  it("возвращает вердикт и riskScore", () => {
    const a = runLinguisticAudit(
      "я разработчик с опытом работы\nопыт работы\nсделал проект и запустил его",
      "",
    );
    expect(a).toHaveProperty("linguisticRisk");
    expect(a).toHaveProperty("verdict");
    expect(["honest", "mixed", "constructed", "fabricated"]).toContain(a.verdict);
  });
});
