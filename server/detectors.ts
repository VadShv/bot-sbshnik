import type { Finding } from "@shared/schema";

// ===== УТИЛИТЫ =====

const MONTHS: Record<string, number> = {
  "январь": 1, "января": 1, "янв": 1, "january": 1, "jan": 1,
  "февраль": 2, "февраля": 2, "фев": 2, "february": 2, "feb": 2,
  "март": 3, "марта": 3, "мар": 3, "march": 3, "mar": 3,
  "апрель": 4, "апреля": 4, "апр": 4, "april": 4, "apr": 4,
  "май": 5, "мая": 5, "may": 5,
  "июнь": 6, "июня": 6, "июн": 6, "june": 6, "jun": 6,
  "июль": 7, "июля": 7, "июл": 7, "july": 7, "jul": 7,
  "август": 8, "августа": 8, "авг": 8, "august": 8, "aug": 8,
  "сентябрь": 9, "сентября": 9, "сен": 9, "september": 9, "sep": 9, "sept": 9,
  "октябрь": 10, "октября": 10, "окт": 10, "october": 10, "oct": 10,
  "ноябрь": 11, "ноября": 11, "ноя": 11, "november": 11, "nov": 11,
  "декабрь": 12, "декабря": 12, "дек": 12, "december": 12, "dec": 12,
};

type Period = { start: Date; end: Date | "present"; raw: string };

function parseMonth(s: string): number | null {
  const v = MONTHS[s.toLowerCase().trim()];
  return v ?? null;
}

// Ищем периоды работы: "январь 2020 — март 2022", "2020 - 2022", "2020-наст. время", "01.2020—03.2022"
export function extractPeriods(text: string): Period[] {
  const periods: Period[] = [];
  const dash = "[—–\\-−]+";

  // Формат: "Месяц YYYY — Месяц YYYY" или "Месяц YYYY — настоящее время"
  const re1 = new RegExp(
    `([а-яёa-z]{3,12})\\s+(\\d{4})\\s*${dash}\\s*(?:(по\\s+)?(настоящ\\w*|наст\\.?\\s*время|present|now|н\\.в\\.?)|([а-яёa-z]{3,12})\\s+(\\d{4}))`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text))) {
    const sm = parseMonth(m[1]);
    const sy = parseInt(m[2]);
    if (!sm || !sy) continue;
    const start = new Date(sy, sm - 1, 1);
    let end: Date | "present";
    if (m[4]) {
      end = "present";
    } else {
      const em = parseMonth(m[5]);
      const ey = parseInt(m[6]);
      if (!em || !ey) continue;
      end = new Date(ey, em - 1, 28);
    }
    periods.push({ start, end, raw: m[0] });
  }

  // Формат: "MM.YYYY — MM.YYYY" или "MM/YYYY"
  const re2 = new RegExp(`(\\d{1,2})[./](\\d{4})\\s*${dash}\\s*(?:(настоящ\\w*|наст\\w*|present|now|н\\.в\\.?)|(\\d{1,2})[./](\\d{4}))`, "gi");
  while ((m = re2.exec(text))) {
    const sm = parseInt(m[1]);
    const sy = parseInt(m[2]);
    if (!sm || !sy || sm > 12) continue;
    const start = new Date(sy, sm - 1, 1);
    let end: Date | "present";
    if (m[3]) {
      end = "present";
    } else {
      const em = parseInt(m[4]);
      const ey = parseInt(m[5]);
      if (!em || !ey || em > 12) continue;
      end = new Date(ey, em - 1, 28);
    }
    periods.push({ start, end, raw: m[0] });
  }

  // Формат: "YYYY — YYYY"
  const re3 = new RegExp(`(?<![./\\d])(\\d{4})\\s*${dash}\\s*(?:(настоящ\\w*|наст\\w*|present|now|н\\.в\\.?)|(\\d{4}))(?!\\d)`, "gi");
  while ((m = re3.exec(text))) {
    const sy = parseInt(m[1]);
    if (sy < 1960 || sy > 2100) continue;
    const start = new Date(sy, 0, 1);
    let end: Date | "present";
    if (m[2]) {
      end = "present";
    } else {
      const ey = parseInt(m[3]);
      if (ey < 1960 || ey > 2100) continue;
      end = new Date(ey, 11, 31);
    }
    // избегаем дубликатов с re1/re2
    if (!periods.some(p => p.raw.includes(m![1]) && (typeof p.end === "string" ? m![2] : m![3] && p.raw.includes(m![3])))) {
      periods.push({ start, end, raw: m[0] });
    }
  }

  return periods;
}

function endOf(p: Period, now: Date): Date {
  return p.end === "present" ? now : p.end;
}

// ===== ДЕТЕКТОРЫ РИСКОВ =====

function findingsChronology(text: string, now: Date): Finding[] {
  const findings: Finding[] = [];
  const periods = extractPeriods(text);
  if (periods.length < 2) return findings;

  // Будущие даты
  for (const p of periods) {
    if (p.start > now || (p.end !== "present" && p.end > new Date(now.getFullYear() + 1, 0, 1))) {
      findings.push({
        id: "future-date",
        title: "Даты из будущего",
        severity: "high",
        score: 75,
        confidence: 95,
        description: "В резюме указаны даты работы, которые ещё не наступили — признак небрежности или фабрикации.",
        evidence: [p.raw],
      });
    }
    if (p.end !== "present" && p.end < p.start) {
      findings.push({
        id: "reverse-dates",
        title: "Конец периода раньше начала",
        severity: "critical",
        score: 90,
        confidence: 99,
        description: "Дата окончания работы раньше даты начала — грубая нестыковка.",
        evidence: [p.raw],
      });
    }
  }

  // Пересечения периодов (>1 месяца)
  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      const aEnd = endOf(a, now);
      const overlap = Math.min(aEnd.getTime(), endOf(b, now).getTime()) - b.start.getTime();
      const days = overlap / (1000 * 60 * 60 * 24);
      if (days > 45) {
        findings.push({
          id: "overlap",
          title: "Пересечение периодов занятости",
          severity: days > 180 ? "high" : "medium",
          score: Math.min(85, 40 + Math.round(days / 10)),
          confidence: 90,
          description: `Периоды работы пересекаются на ~${Math.round(days)} дн. — совмещение возможно, но требует объяснения.`,
          evidence: [a.raw, b.raw],
        });
      }
    }
  }

  // Пробелы >6 месяцев
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const aEnd = endOf(a, now);
    const gap = (b.start.getTime() - aEnd.getTime()) / (1000 * 60 * 60 * 24);
    if (gap > 180) {
      findings.push({
        id: "gap",
        title: "Необъяснённый пробел в опыте",
        severity: gap > 540 ? "high" : "medium",
        score: Math.min(75, 30 + Math.round(gap / 30)),
        confidence: 85,
        description: `Пробел ~${Math.round(gap / 30)} мес. между "${a.raw}" и "${b.raw}". Уточнить причину.`,
        evidence: [a.raw, b.raw],
      });
    }
  }

  return findings;
}

function findingsEducation(text: string, now: Date): Finding[] {
  const findings: Finding[] = [];

  // Нереалистичный возраст выпускника
  const eduYear = /(?:окончил|окончание|год окончания|выпуск|graduated?)\D{0,30}(\d{4})/gi;
  const yrs: number[] = [];
  let m;
  while ((m = eduYear.exec(text))) {
    const y = parseInt(m[1]);
    if (y > 1950 && y <= now.getFullYear() + 10) yrs.push(y);
  }
  if (yrs.length >= 2) {
    const min = Math.min(...yrs);
    const max = Math.max(...yrs);
    if (max - min < 2 && yrs.length >= 3) {
      findings.push({
        id: "multiple-degrees-same-year",
        title: "Несколько дипломов за короткий срок",
        severity: "medium",
        score: 55,
        confidence: 70,
        description: "Указано несколько годов окончания в близком диапазоне — возможно, компиляция.",
        evidence: yrs.map(String),
      });
    }
  }

  // Вуз + дата окончания в будущем >2 лет
  const futureYr = yrs.find((y) => y > now.getFullYear() + 2);
  if (futureYr) {
    findings.push({
      id: "future-graduation",
      title: "Нереалистичная дата окончания образования",
      severity: "high",
      score: 70,
      confidence: 90,
      description: `Указан год окончания ${futureYr}, что более чем на 2 года в будущем.`,
      evidence: [String(futureYr)],
    });
  }

  return findings;
}

function findingsContacts(text: string): Finding[] {
  const findings: Finding[] = [];
  const disposableDomains = [
    "mailinator.com", "tempmail", "guerrillamail", "10minutemail", "yopmail",
    "throwaway", "dispostable", "sharklasers",
  ];
  const emails = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  for (const e of emails) {
    const domain = e.split("@")[1].toLowerCase();
    if (disposableDomains.some((d) => domain.includes(d))) {
      findings.push({
        id: "disposable-email",
        title: "Одноразовый email",
        severity: "high",
        score: 80,
        confidence: 95,
        description: `Адрес ${e} — из сервиса одноразовой почты.`,
        evidence: [e],
      });
    }
  }

  if (emails.length === 0 && !/\+?\d[\d\s\-()]{8,}/.test(text)) {
    findings.push({
      id: "no-contacts",
      title: "Отсутствуют контактные данные",
      severity: "medium",
      score: 50,
      confidence: 80,
      description: "В резюме не найдено ни email, ни телефона.",
      evidence: [],
    });
  }

  return findings;
}

function findingsStopWords(text: string): Finding[] {
  const findings: Finding[] = [];
  const patterns: { re: RegExp; title: string; desc: string }[] = [
    {
      re: /(обнал|серая?\s+(?:схем|зарплат)|откат(?:ы|ов|ами)?|откатн)/gi,
      title: "Упоминание серых схем",
      desc: "В резюме прямые упоминания обнала/откатов/серых схем.",
    },
    {
      re: /(судим|судеб\w*\s+преслед|уголовн\w*\s+дел)/gi,
      title: "Упоминания судимости/уголовного преследования",
      desc: "Встречаются явные маркеры проблем с законом.",
    },
    {
      re: /(банкрот\w*\s+(?:компан|работодател)|ликвидац\w*\s+компани)/gi,
      title: "Работодатели с признаками банкротства",
      desc: "Указаны компании с явным статусом банкротства/ликвидации.",
    },
  ];
  for (const p of patterns) {
    const matches = text.match(p.re);
    if (matches && matches.length > 0) {
      findings.push({
        id: `stopword-${p.title.slice(0, 12)}`,
        title: p.title,
        severity: "high",
        score: 75,
        confidence: 85,
        description: p.desc,
        evidence: matches.slice(0, 3),
      });
    }
  }
  return findings;
}

// ===== ДЕТЕКТОРЫ НАКРУТКИ ОПЫТА =====

function findingsInflation(text: string, now: Date): Finding[] {
  const findings: Finding[] = [];
  const periods = extractPeriods(text);

  // Общий стаж
  let totalMonths = 0;
  for (const p of periods) {
    const end = endOf(p, now);
    totalMonths += Math.max(0, (end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }
  const years = totalMonths / 12;

  // Грейд vs стаж
  const hasSenior = /\b(senior|сеньор|ведущ\w+|главный|lead|principal|tech\s*lead|head\s*of|руководитель\s+отдела|директор|архитектор|architect|CTO|CIO|CPO|CFO)\b/i.test(text);
  if (hasSenior && years > 0 && years < 3) {
    findings.push({
      id: "senior-low-exp",
      title: "Senior-грейд при малом стаже",
      severity: "high",
      score: 80,
      confidence: 85,
      description: `Указан senior/lead уровень, но суммарный стаж по датам ~${years.toFixed(1)} лет.`,
      evidence: [],
    });
  }

  // Нереалистичные KPI
  const kpiMatches = text.match(/(?:на|до|в)\s+(\d{3,5})\s*[%×x]|\bв\s+(\d{2,4})\s*раз/gi);
  if (kpiMatches && kpiMatches.length > 0) {
    const ev: string[] = [];
    for (const km of kpiMatches.slice(0, 5)) {
      const n = parseInt(km.replace(/\D/g, ""));
      if ((km.includes("%") && n >= 300) || (/раз/i.test(km) && n >= 10) || /[×x]/i.test(km)) {
        ev.push(km);
      }
    }
    if (ev.length > 0) {
      findings.push({
        id: "unrealistic-kpi",
        title: "Нереалистичные метрики достижений",
        severity: ev.length >= 3 ? "high" : "medium",
        score: Math.min(85, 50 + ev.length * 10),
        confidence: 80,
        description: "Упоминаются рост/увеличение показателей на сотни процентов или в десятки раз — требуют верификации.",
        evidence: ev,
      });
    }
  }

  // Дублирование буллетов между компаниями (copy-paste)
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length >= 40 && l.length <= 300);
  const lineMap = new Map<string, number>();
  for (const l of lines) {
    const key = l.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?()"']/g, "");
    lineMap.set(key, (lineMap.get(key) || 0) + 1);
  }
  const dupes: string[] = [];
  for (const [k, cnt] of lineMap.entries()) {
    if (cnt >= 2) dupes.push(k.slice(0, 120));
  }
  if (dupes.length >= 2) {
    findings.push({
      id: "duplicate-bullets",
      title: "Дублирование обязанностей между компаниями",
      severity: dupes.length >= 4 ? "high" : "medium",
      score: Math.min(85, 45 + dupes.length * 8),
      confidence: 90,
      description: `Найдено ${dupes.length} повторяющихся фрагментов описания обязанностей — признак copy-paste из шаблона.`,
      evidence: dupes.slice(0, 3),
    });
  }

  // Стек-инфляция: 25+ технологий
  const techList = text.match(/\b(Python|TypeScript|JavaScript|Java|C\+\+|C#|Go|Ruby|PHP|Swift|Kotlin|Rust|Scala|React|Vue|Angular|Svelte|Next\.?js|Nuxt|Node\.?js|Express|Django|Flask|FastAPI|Spring|Laravel|Rails|\.NET|PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|Kafka|RabbitMQ|Docker|Kubernetes|Terraform|AWS|GCP|Azure|Git|Jenkins|Linux|Nginx|GraphQL|REST|gRPC|TensorFlow|PyTorch|Kubernetes|Ansible|Prometheus|Grafana)\b/gi);
  if (techList) {
    const unique = new Set(techList.map((t) => t.toLowerCase()));
    if (unique.size >= 25) {
      findings.push({
        id: "stack-inflation",
        title: "Стек-инфляция",
        severity: unique.size >= 40 ? "high" : "medium",
        score: Math.min(80, 40 + unique.size),
        confidence: 85,
        description: `Перечислено ${unique.size} уникальных технологий — подозрение на перечисление без реальной глубины.`,
        evidence: [...unique].slice(0, 10),
      });
    }
  }

  // Темп роста: junior→lead за <1.5 года
  const hasJunior = /\b(junior|джуниор|стажёр|стажер|intern|trainee)\b/i.test(text);
  if (hasJunior && hasSenior && years > 0 && years < 3.5) {
    findings.push({
      id: "fast-career-growth",
      title: "Нереалистичный темп карьерного роста",
      severity: "medium",
      score: 65,
      confidence: 75,
      description: `В резюме фигурируют и junior, и senior/lead позиции при общем стаже ~${years.toFixed(1)} лет.`,
      evidence: [],
    });
  }

  // «Плотность» конкретики: числа, метрики на единицу текста
  const textLen = text.length;
  const numbers = (text.match(/\d+\s*(?:%|млн|тыс|раз|человек|чел|команда|команды|K)/gi) || []).length;
  if (textLen > 2000 && numbers / (textLen / 1000) < 1) {
    findings.push({
      id: "low-density",
      title: "Низкая плотность конкретики",
      severity: "medium",
      score: 55,
      confidence: 70,
      description: `В резюме мало конкретных метрик (${numbers} числовых достижений на ${Math.round(textLen / 1000)}K символов) — много воды.`,
      evidence: [],
    });
  }

  // Тайтл-инфляция: "Head of / Director" без подчинённых или в стартапе из <5 чел
  const titleInfl = /\b(head\s+of|директор|chief|CEO|CTO|CFO)\b/i;
  const smallCompany = /\b(стартап|startup|команда\s+из\s+[1-4]\s+чел|команда\s+[1-4]\s+чел)/i;
  if (titleInfl.test(text) && smallCompany.test(text)) {
    findings.push({
      id: "title-inflation",
      title: "Возможная тайтл-инфляция",
      severity: "medium",
      score: 60,
      confidence: 65,
      description: "Указан high-level титул в контексте маленькой команды/стартапа — уточнить реальный скоуп.",
      evidence: [],
    });
  }

  return findings;
}

// ===== ДЕТЕКТОРЫ «ВОЛКОВ» =====

function findingsWolves(text: string, now: Date): Finding[] {
  const findings: Finding[] = [];
  const periods = extractPeriods(text);

  // Серийные короткие контракты (<9 мес)
  const shortStints = periods.filter((p) => {
    const end = endOf(p, now);
    const months = (end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return months > 0 && months < 9;
  });
  if (shortStints.length >= 3) {
    findings.push({
      id: "job-hopping",
      title: "Серийные короткие контракты",
      severity: shortStints.length >= 5 ? "high" : "medium",
      score: Math.min(85, 40 + shortStints.length * 10),
      confidence: 90,
      description: `Найдено ${shortStints.length} мест работы длительностью <9 мес. — паттерн сообщества «волков» (частые переходы ради роста ЗП).`,
      evidence: shortStints.slice(0, 5).map((p) => p.raw),
    });
  }

  // Лексика сообщества
  const wolvesLex = /\b(волк|волчь\w+|офер[а-я]*\s+коллекци|гонка\s+оферов|rate\s+fighter|rate\s*раш|фарм\s+оферов|собес\w+\s+марафон|волчья?\s+стая|1\s+к\s+3|оферхантер|offer\s*hunt)/gi;
  const matches = text.match(wolvesLex);
  if (matches && matches.length > 0) {
    findings.push({
      id: "wolves-lexicon",
      title: "Лексика сообщества «волков»",
      severity: "high",
      score: 85,
      confidence: 90,
      description: "В резюме/сопроводительном встречаются прямые маркеры сообщества.",
      evidence: [...new Set(matches)].slice(0, 5),
    });
  }

  // Признаки коучинга по собесам
  const coaching = /\b(STAR\s*метод\w*|подготовка\s+к\s+собеседовани|коуч\w+\s+по\s+(?:собес|интервью)|прохождение\s+секций|behavioral\s+prep|system\s+design\s+prep)\b/gi;
  const cm = text.match(coaching);
  if (cm && cm.length >= 2) {
    findings.push({
      id: "interview-coaching",
      title: "Следы коучинга по прохождению собеседований",
      severity: "medium",
      score: 55,
      confidence: 65,
      description: "В резюме упомянуты методики, типичные для platform-коучинга под собесы.",
      evidence: [...new Set(cm)].slice(0, 3),
    });
  }

  return findings;
}

// ===== ГЛАВНАЯ ФУНКЦИЯ =====

export type DetectorResult = {
  risks: Finding[];
  inflation: Finding[];
  wolves: Finding[];
};

export function runDetectors(text: string): DetectorResult {
  const now = new Date();
  return {
    risks: [
      ...findingsChronology(text, now),
      ...findingsEducation(text, now),
      ...findingsContacts(text),
      ...findingsStopWords(text),
    ],
    inflation: findingsInflation(text, now),
    wolves: findingsWolves(text, now),
  };
}

export function aggregateCategoryScore(findings: Finding[], baseline = 5): number {
  if (findings.length === 0) return baseline;
  // Взвешенная агрегация: худший детектор + вклад остальных
  const sorted = [...findings].sort((a, b) => b.score * b.confidence - a.score * a.confidence);
  const top = sorted[0].score * (sorted[0].confidence / 100);
  const tailBonus = sorted.slice(1).reduce((acc, f) => acc + (f.score * f.confidence / 100) * 0.15, 0);
  return Math.min(100, Math.round(top + tailBonus));
}
