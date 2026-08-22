import { describe, it, expect } from "vitest";
import { isPhantom, stripPhantomText } from "../server/pipelineAnalyzer";

describe("isPhantom", () => {
  it("ловит «работа в будущем»", () => {
    expect(isPhantom("опыт работы в будущем")).toBe(true);
  });

  it("ловит «телепорт»", () => {
    expect(isPhantom("телепорт даты")).toBe(true);
  });

  it("ловит «ООО ... не существует»", () => {
    expect(isPhantom("ООО Ромашка не существует")).toBe(true);
  });

  it("не срабатывает на нормальном тексте", () => {
    expect(isPhantom("опыт работы 2020-2022 в компании")).toBe(false);
  });
});

describe("stripPhantomText", () => {
  it("вырезает фантомные предложения, сохраняя остальное", () => {
    const s = "опыт подтверждён. работа в будущем обнаружена. всё ок.";
    const cleaned = stripPhantomText(s);
    expect(cleaned).not.toContain("будущем");
    expect(cleaned).toContain("опыт подтверждён");
  });

  it("возвращает пустую строку, если весь текст фантомный", () => {
    expect(stripPhantomText("работа в будущем")).toBe("");
  });
});
