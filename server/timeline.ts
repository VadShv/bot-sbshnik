// ==========================================================
// Парсинг и нормализация дат, расчёт длительности опыта.
// Используется как pre-processing для LLM (чтобы модель
// не считала даты вручную) и для UI-отчёта.
// ==========================================================

import type { EtkStructured, EmploymentSpan, TimelineMetrics } from "@shared/schema";

const RU_MONTHS: Record<string, number> = {
  "янв": 1, "январ": 1,
  "фев": 2, "феврал": 2,
  "мар": 3, "март": 3,
  "апр": 4, "апрел": 4,
  "май": 5, "мая": 5, "маe": 5,
  "июн": 6, "июнь": 6,
  "июл": 7, "июль": 7,
  "авг": 8, "август": 8,
  "сен": 9, "сент": 9, "сентябр": 9,
  "окт": 10, "октябр": 10,
  "ноя": 11, "ноябр": 11,
  "дек": 12, "декабр": 12,
};

const PRESENT_RE = /(по\s+наст(оящ\w*)?\s*врем\w*|настоящее\s+врем\w*|now|present|current|по\s+сей\s+день|н\.в\.?|сейчас)/i;

/** Преобразует «март 2020», «03.2020», «2020-03», «2020-03-15», «2020» в YYYY-MM-DD. */
export function parseFlexibleDate(input: string | null | undefined, isEnd = false): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (PRESENT_RE.test(s)) return null; // null = по настоящее время

  // 1) ISO YYYY-MM-DD или YYYY-MM
  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (iso) {
    const y = +iso[1];
    const m = Math.min(12, Math.max(1, +iso[2]));
    const d = iso[3] ? Math.min(28, Math.max(1, +iso[3])) : (isEnd ? 28 : 1);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // 2) DD.MM.YYYY или MM.YYYY или MM/YYYY
  const dot = s.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?$/);
  if (dot) {
    let part1 = +dot[1];
    let part2 = +dot[2];
    const part3 = dot[3] ? +dot[3] : null;
    if (part3 !== null) {
      // DD.MM.YYYY
      const y = part3 < 100 ? 2000 + part3 : part3;
      return `${y}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
    }
    // MM.YYYY
    const y = part2 < 100 ? 2000 + part2 : part2;
    return `${y}-${String(part1).padStart(2, "0")}-${isEnd ? "28" : "01"}`;
  }

  // 3) «март 2020» или «март 2020 г.»
  const ru = s.match(/([а-яё]{3,})\.?\s+(\d{4})/i);
  if (ru) {
    const stem = ru[1].slice(0, 6);
    let month: number | null = null;
    for (const [k, v] of Object.entries(RU_MONTHS)) {
      if (stem.startsWith(k)) { month = v; break; }
    }
    if (month) {
      const y = +ru[2];
      return `${y}-${String(month).padStart(2, "0")}-${isEnd ? "28" : "01"}`;
    }
  }

  // 4) Только год: «2020»
  const year = s.match(/^(\d{4})$/);
  if (year) {
    const y = +year[1];
    return isEnd ? `${y}-12-28` : `${y}-01-01`;
  }

  // 5) «2020 г.» или «2020г»
  const yearG = s.match(/^(\d{4})\s*г\.?$/);
  if (yearG) {
    const y = +yearG[1];
    return isEnd ? `${y}-12-28` : `${y}-01-01`;
  }

  return null;
}

export function monthsBetween(startISO: string | null, endISO: string | null): number | null {
  if (!startISO) return null;
  const start = new Date(startISO + "T00:00:00Z");
  const end = endISO ? new Date(endISO + "T00:00:00Z") : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}

/** Сравнивает две даты с допуском в днях. */
export function datesClose(a: string | null, b: string | null, toleranceDays = 90): boolean {
  if (!a || !b) return a === b;
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  if (isNaN(da) || isNaN(db)) return false;
  return Math.abs(da - db) <= toleranceDays * 24 * 3600 * 1000;
}

export type ResumeJobLike = {
  company: string;
  position?: string;
  startDate?: string | null;
  endDate?: string | null;
};

/** Извлекает места работы из текста резюме (эвристика для случаев когда LLM ещё не отработал). */
export function extractResumeJobs(resumeText: string): ResumeJobLike[] {
  const jobs: ResumeJobLike[] = [];
  if (!resumeText) return jobs;
  const lines = resumeText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Простая эвристика: ищем строки с двумя датами через тире/дефис.
  const dateRangeRe =
    /(\d{4}|[а-яё]{3,}\.?\s+\d{4}|\d{1,2}[.\/]\d{4}|\d{4}-\d{1,2})\s*[-–—]\s*(\d{4}|[а-яё]{3,}\.?\s+\d{4}|\d{1,2}[.\/]\d{4}|\d{4}-\d{1,2}|по\s+наст\w*|настоящее\s+врем\w*|н\.в\.?|сейчас)/i;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(dateRangeRe);
    if (!m) continue;
    const start = parseFlexibleDate(m[1], false);
    const end = parseFlexibleDate(m[2], true);
    if (!start) continue;
    // Компанию ищем в текущей строке (после диапазона) или в следующей
    const after = lines[i].replace(m[0], "").replace(/^[\s,•\-—]+|[\s,•\-—]+$/g, "");
    const company = (after || lines[i + 1] || "").slice(0, 200).trim();
    if (!company) continue;
    jobs.push({ company, startDate: start, endDate: end });
  }
  return jobs;
}

export function buildTimelineFromEtk(etk: EtkStructured): TimelineMetrics | null {
  if (etk.source === "none" || !etk.records.length) return null;
  const spans: EmploymentSpan[] = etk.records.map((r) => {
    const startISO = parseFlexibleDate(r.startDate, false);
    const endISO = parseFlexibleDate(r.endDate, true);
    return {
      company: r.company,
      position: r.position,
      startISO,
      endISO,
      months: monthsBetween(startISO, endISO),
      source: "etk" as const,
    };
  });
  return summarizeSpans(spans, "etk");
}

export function buildTimelineFromResume(resumeText: string): TimelineMetrics | null {
  const jobs = extractResumeJobs(resumeText);
  if (!jobs.length) return null;
  const spans: EmploymentSpan[] = jobs.map((j) => {
    const startISO = j.startDate || null;
    const endISO = j.endDate ?? null;
    return {
      company: j.company,
      position: j.position,
      startISO,
      endISO,
      months: monthsBetween(startISO, endISO),
      source: "resume" as const,
    };
  });
  return summarizeSpans(spans, "resume");
}

function summarizeSpans(spans: EmploymentSpan[], source: "resume" | "etk" | "merged"): TimelineMetrics {
  // Сортируем по дате начала по возрастанию
  const sorted = [...spans].sort((a, b) => {
    const sa = a.startISO || "9999";
    const sb = b.startISO || "9999";
    return sa.localeCompare(sb);
  });

  const totalMonths = sorted.reduce((s, sp) => s + (sp.months || 0), 0);
  const jobsCount = sorted.length;
  const valid = sorted.filter((s) => typeof s.months === "number" && s.months !== null) as (EmploymentSpan & { months: number })[];
  const avgMonths = valid.length ? Math.round(totalMonths / valid.length) : 0;
  const shortStintsCount = valid.filter((s) => s.months > 0 && s.months < 12).length;

  // Считаем гэпы между последовательными работами
  let gapsMonths = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].endISO;
    const curStart = sorted[i].startISO;
    if (!prevEnd || !curStart) continue;
    const gap = monthsBetween(prevEnd, curStart);
    if (gap && gap > 1) gapsMonths += gap;
  }

  return { totalMonths, jobsCount, avgMonths, shortStintsCount, gapsMonths, spans: sorted, source };
}

export function buildTimeline(resumeText: string, etk: EtkStructured): TimelineMetrics | null {
  // ЭТК — приоритетный источник, но если ЭТК нет — берём из резюме
  return buildTimelineFromEtk(etk) || buildTimelineFromResume(resumeText);
}

export function formatMonths(m: number): string {
  if (m < 12) return `${m} мес`;
  const years = Math.floor(m / 12);
  const months = m % 12;
  if (months === 0) return `${years} г`;
  return `${years} г ${months} мес`;
}
