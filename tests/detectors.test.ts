import { describe, it, expect } from "vitest";
import { runDetectors, extractPeriods, aggregateCategoryScore } from "../server/detectors";

describe("extractPeriods", () => {
  it("парсит «Месяц YYYY — Месяц YYYY»", () => {
    const p = extractPeriods("январь 2020 — март 2022");
    expect(p.length).toBe(1);
    expect(p[0].start.getFullYear()).toBe(2020);
  });

  it("парсит «по настоящее время»", () => {
    const p = extractPeriods("03.2020 — настоящее время");
    expect(p.length).toBe(1);
    expect(p[0].end).toBe("present");
  });

  it("парсит YYYY — YYYY", () => {
    const p = extractPeriods("2018 - 2021");
    expect(p.length).toBe(1);
  });
});

describe("runDetectors — риски", () => {
  it("детектит обратные даты (critical)", () => {
    const text =
      "Опыт работы\nянварь 2022 — март 2020\nКомпания А\n\nфевраль 2018 — март 2019\nКомпания Б";
    const det = runDetectors(text);
    const reverse = det.risks.find((f) => f.id === "reverse-dates");
    expect(reverse).toBeDefined();
    expect(reverse!.severity).toBe("critical");
  });

  it("детектит одноразовый email", () => {
    const det = runDetectors("test@mailinator.com\nопыт 2020-2022");
    expect(det.risks.some((f) => f.id === "disposable-email")).toBe(true);
  });

  it("детектит стоп-слова (откаты/обнал)", () => {
    const det = runDetectors("опыт 2020-2022\nзанимался откатами и обналом");
    expect(det.risks.some((f) => f.id.startsWith("stopword"))).toBe(true);
  });
});

describe("runDetectors — накрутка опыта", () => {
  it("детектит senior при малом стаже", () => {
    const det = runDetectors("Senior разработчик\n2022 - 2023\nКомпания");
    expect(det.inflation.some((f) => f.id === "senior-low-exp")).toBe(true);
  });

  it("детектит стек-инфляцию: C++/C#/.NET теперь считаются (фикс \\b)", () => {
    // 24 «буквенных» технологии + C++/C#/.NET. До фикса \\b последние не матчились
    // (24 < 25 → детектор не срабатывал); после фикса — 27 ≥ 25.
    const techs = [
      "Python", "TypeScript", "JavaScript", "Java", "Go", "Ruby", "PHP", "Swift",
      "Kotlin", "Rust", "Scala", "React", "Vue", "Angular", "Svelte", "Next.js",
      "Nuxt", "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring", "Laravel",
      "C++", "C#", ".NET",
    ].join(", ");
    const det = runDetectors("Senior " + techs + "\n2020-2024");
    expect(det.inflation.some((f) => f.id === "stack-inflation")).toBe(true);
  });
});

describe("runDetectors — волки", () => {
  it("детектит серийные короткие контракты (job-hopping)", () => {
    const text = [
      "январь 2020 — март 2020",
      "апрель 2020 — июнь 2020",
      "июль 2020 — сентябрь 2020",
    ].join("\n");
    const det = runDetectors(text);
    expect(det.wolves.some((f) => f.id === "job-hopping")).toBe(true);
  });
});

describe("runDetectors — кириллические границы (фикс \\b)", () => {
  it("детектит senior по кириллическому «сеньор»", () => {
    const det = runDetectors("сеньор разработчик\n2022 - 2023\nКомпания");
    expect(det.inflation.some((f) => f.id === "senior-low-exp")).toBe(true);
  });

  it("детектит «волк» в лексике сообщества", () => {
    const det = runDetectors("резюме кандидат волк");
    expect(det.wolves.some((f) => f.id === "wolves-lexicon")).toBe(true);
  });

  it("детектит «в 10 раз» как нереалистичный KPI", () => {
    const det = runDetectors("опыт 2020-2024\nувеличил выручку в 10 раз");
    expect(det.inflation.some((f) => f.id === "unrealistic-kpi")).toBe(true);
  });
});

describe("aggregateCategoryScore", () => {
  it("возвращает baseline при пустых findings", () => {
    expect(aggregateCategoryScore([], 7)).toBe(7);
  });

  it("ограничен 100", () => {
    const f = [{
      id: "x", title: "t", severity: "high" as const,
      score: 200, confidence: 100, description: "", evidence: [],
    }];
    expect(aggregateCategoryScore(f, 5)).toBeLessThanOrEqual(100);
  });
});
