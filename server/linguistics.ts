/**
 * МОДУЛЬ 5 — LINGUISTIC AUDIT v1.0
 * Детерминированные детекторы 4 методик:
 *   1. LIWC            — психолингвистический профиль (местоимения, эмоции, экскл.)
 *   2. Reality Monitoring (RM) — 6 критериев живого воспоминания по блокам
 *   3. Cognitive Load  — хеджирование / противоречия / структурная симметрия
 *   4. ACID            — 10 индикаторов честного нарратива
 *
 * Принцип: вся арифметика считается ЗДЕСЬ (быстро, дёшево, воспроизводимо),
 * LLM — только интерпретирует в 1–2 предложения.
 */

import type {
  LiwcCounters,
  LiwcAnalysis,
  RmBlockKind,
  RmBlockScore,
  RealityMonitoringAnalysis,
  CognitiveLoadAnalysis,
  AcidCriterion,
  AcidBlockClassification,
  AcidAnalysis,
  LinguisticAudit,
  LinguisticAuditVerdict,
} from "@shared/schema";

// ====================================================================
// 0. Токенизация и вспомогательные функции
// ====================================================================

function normalize(text: string): string {
  return text
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLowerCase();
}

function tokenize(text: string): string[] {
  if (!text) return [];
  const t = normalize(text);
  const tokens = t.match(/[а-яa-z0-9\-]+/g) || [];
  return tokens;
}

function countMatches(tokens: string[], lexicon: Set<string>): number {
  let n = 0;
  for (const tok of tokens) if (lexicon.has(tok)) n++;
  return n;
}

function countPhrases(text: string, phrases: string[]): number {
  const t = normalize(text);
  let n = 0;
  for (const p of phrases) {
    const re = new RegExp(`\\b${p.replace(/[\-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
    const m = t.match(re);
    if (m) n += m.length;
  }
  return n;
}

function rate(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 10000) / 100; // на 100 токенов, 2 знака
}

// ====================================================================
// 1. LIWC — русские лексиконы
// ====================================================================

const LEX_FIRST_SG = new Set([
  "я", "меня", "мне", "мной", "мною", "мой", "моя", "моё", "мое", "мои",
  "моего", "моей", "моих", "моим", "моему", "моими",
]);

const LEX_FIRST_PL = new Set([
  "мы", "нас", "нам", "нами", "наш", "наша", "наше", "наши",
  "нашего", "нашей", "наших", "нашим", "нашему", "нашими",
]);

const LEX_THIRD = new Set([
  "они", "их", "им", "ими", "он", "она", "оно", "его", "её", "ее",
  "ему", "ей", "ней", "нем", "ней", "ним", "ними",
]);

const LEX_NEG_EMO = new Set([
  "плохо", "плохой", "плохая", "плохие",
  "ужасно", "ужасный", "ужасная",
  "отвратительно", "отвратительный",
  "ненавижу", "ненависть",
  "злой", "злость", "зло",
  "невыносимо", "невыносимый",
  "кошмар", "кошмарный",
  "провал", "провальный", "провалил",
  "раздражать", "раздражает", "раздражал",
  "бесить", "бесит", "бесило",
  "тиран", "тирания",
  "виноват", "виновата", "виноваты",
  "токсичный", "токсичная", "токсики",
  "враждебный", "враждебно",
  "конфликт", "конфликты", "конфликтный",
]);

const LEX_POS_EMO = new Set([
  "отлично", "отличный", "отличная",
  "прекрасно", "прекрасный", "прекрасная",
  "рад", "рада", "рады",
  "благодарен", "благодарна", "благодарны", "благодарность",
  "горжусь", "гордость", "гордый",
  "удовольствие",
  "вдохновляет", "вдохновение", "вдохновлён",
  "люблю", "любимый", "любимая",
  "нравится", "нравился", "нравилась",
  "спасибо",
  "доволен", "довольна",
  "счастлив", "счастлива", "счастье",
]);

const LEX_EXCLUSIVES = new Set([
  "кроме", "без", "не", "нет",
  "никогда", "никто", "ничего", "никак",
  "только", "лишь",
  "исключительно", "единственный", "единственная",
  "но", "однако", "хотя",
]);

const LEX_FUNCTION = new Set([
  "в", "на", "и", "но", "или", "с", "со", "по", "от", "до", "для", "о", "об", "у",
  "к", "за", "из", "при", "про", "через", "над", "под", "между", "перед",
  "а", "же", "ли", "бы", "что", "чтобы", "как", "если", "то",
]);

const PHRASE_COGNITIVE = [
  "потому что", "поэтому", "так как", "следовательно", "значит",
  "благодаря", "вследствие", "из-за", "в результате",
  "решил", "решила", "думал", "думала", "считал", "считала",
  "понял", "поняла", "осознал", "осознала",
];

export function runLiwc(text: string): LiwcAnalysis {
  const tokens = tokenize(text);
  const totalTokens = tokens.length;

  const counters: LiwcCounters = {
    totalTokens,
    firstPersonSingular: countMatches(tokens, LEX_FIRST_SG),
    firstPersonPlural: countMatches(tokens, LEX_FIRST_PL),
    thirdPerson: countMatches(tokens, LEX_THIRD),
    negativeEmotions: countMatches(tokens, LEX_NEG_EMO),
    positiveEmotions: countMatches(tokens, LEX_POS_EMO),
    exclusives: countMatches(tokens, LEX_EXCLUSIVES),
    functionWords: countMatches(tokens, LEX_FUNCTION),
    cognitiveMechanisms: countPhrases(text, PHRASE_COGNITIVE),
  };

  const rates = {
    firstPersonSingular: rate(counters.firstPersonSingular, totalTokens),
    firstPersonPlural: rate(counters.firstPersonPlural, totalTokens),
    thirdPerson: rate(counters.thirdPerson, totalTokens),
    negativeEmotions: rate(counters.negativeEmotions, totalTokens),
    positiveEmotions: rate(counters.positiveEmotions, totalTokens),
    exclusives: rate(counters.exclusives, totalTokens),
    functionWords: rate(counters.functionWords, totalTokens),
    cognitiveMechanisms: rate(counters.cognitiveMechanisms, totalTokens),
  };

  const iDominant = counters.firstPersonSingular > 0 &&
    counters.firstPersonSingular >= 2 * Math.max(1, counters.firstPersonPlural);
  const weDominant = counters.firstPersonPlural > 0 &&
    counters.firstPersonPlural >= 1.5 * Math.max(1, counters.firstPersonSingular);
  const blamesOthers = rates.thirdPerson > 3 && rates.negativeEmotions > 1.5;
  const emotionalNegative = rates.negativeEmotions > 2;
  const highExclusives = rates.exclusives > 5;
  const lowCognitiveComplexity = rates.functionWords < 25 && rates.cognitiveMechanisms < 0.5;

  // Риск: чем больше «подозрительных» маркеров, тем выше
  let riskScore = 0;
  if (iDominant && blamesOthers) riskScore += 25;
  if (emotionalNegative) riskScore += 20;
  if (highExclusives) riskScore += 25;
  if (lowCognitiveComplexity) riskScore += 15;
  if (blamesOthers) riskScore += 15;
  if (rates.positiveEmotions > 0 && rates.negativeEmotions < 0.5) riskScore = Math.max(0, riskScore - 10);
  riskScore = Math.max(0, Math.min(100, riskScore));

  const summary = buildLiwcSummary(rates, {
    iDominant, weDominant, blamesOthers, emotionalNegative, highExclusives, lowCognitiveComplexity,
  });

  return {
    counters,
    rates,
    markers: { iDominant, weDominant, blamesOthers, emotionalNegative, highExclusives, lowCognitiveComplexity },
    riskScore,
    summary,
  };
}

function buildLiwcSummary(
  rates: LiwcAnalysis["rates"],
  m: LiwcAnalysis["markers"],
): string {
  const parts: string[] = [];
  if (m.iDominant) parts.push(`доминирование «я» (${rates.firstPersonSingular}%) над «мы» (${rates.firstPersonPlural}%)`);
  else if (m.weDominant) parts.push(`преобладание «мы» (${rates.firstPersonPlural}%) — командный нарратив`);
  else parts.push("баланс между «я» и «мы» в норме");

  if (m.blamesOthers) parts.push("высокая доля 3-го лица + негатив — признаки перекладывания ответственности");
  if (m.emotionalNegative) parts.push(`негативные эмоции повышены (${rates.negativeEmotions}%)`);
  if (m.highExclusives) parts.push(`избыточные исключители (${rates.exclusives}%) — по Newman et al. 2003 сигнал обмана`);
  if (m.lowCognitiveComplexity) parts.push("низкая когнитивная сложность (мало причинно-следственных связок)");

  return parts.slice(0, 3).join("; ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

// ====================================================================
// 2. Разбиение резюме на блоки
// ====================================================================

type RawBlock = { kind: RmBlockKind; label: string; text: string };

const BLOCK_HEADERS: Array<{ kind: RmBlockKind; label: string; patterns: RegExp[] }> = [
  {
    kind: "experience",
    label: "Опыт работы",
    patterns: [/опыт\s+работы/i, /места?\s+работы/i, /карьер/i, /трудовой\s+опыт/i],
  },
  {
    kind: "achievements",
    label: "Достижения",
    patterns: [/достижени/i, /ключевые\s+результаты/i, /основные\s+результаты/i],
  },
  {
    kind: "projects",
    label: "Проекты",
    patterns: [/проект/i, /кейс/i, /портфолио/i],
  },
  {
    kind: "about",
    label: "О себе",
    patterns: [/о\s+себе/i, /резюме/i, /профиль/i, /summary/i],
  },
];

export function splitBlocks(resumeText: string): RawBlock[] {
  if (!resumeText || resumeText.trim().length === 0) return [];
  const text = resumeText;

  // Находим позиции заголовков
  type Hit = { pos: number; kind: RmBlockKind; label: string };
  const hits: Hit[] = [];
  for (const hdr of BLOCK_HEADERS) {
    for (const re of hdr.patterns) {
      const gRe = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      let m: RegExpExecArray | null;
      while ((m = gRe.exec(text)) !== null) {
        hits.push({ pos: m.index, kind: hdr.kind, label: hdr.label });
      }
    }
  }
  hits.sort((a, b) => a.pos - b.pos);

  // Дедупликация: один kind — первый встреченный
  const seen = new Set<RmBlockKind>();
  const uniqHits = hits.filter((h) => {
    if (seen.has(h.kind)) return false;
    seen.add(h.kind);
    return true;
  });

  const blocks: RawBlock[] = [];
  if (uniqHits.length === 0) {
    // Если ни один заголовок не найден — треактуем весь текст как "experience"
    blocks.push({ kind: "experience", label: "Опыт работы", text: text.trim() });
    return blocks;
  }

  // Префикс до первого заголовка считаем "about"
  const firstPos = uniqHits[0].pos;
  if (firstPos > 80 && !uniqHits.some((h) => h.kind === "about")) {
    const prefix = text.slice(0, firstPos).trim();
    if (prefix.length > 50) blocks.push({ kind: "about", label: "О себе", text: prefix });
  }

  for (let i = 0; i < uniqHits.length; i++) {
    const start = uniqHits[i].pos;
    const end = i + 1 < uniqHits.length ? uniqHits[i + 1].pos : text.length;
    const segment = text.slice(start, end).trim();
    blocks.push({ kind: uniqHits[i].kind, label: uniqHits[i].label, text: segment });
  }

  return blocks.filter((b) => b.text.length > 40);
}

// ====================================================================
// 3. Reality Monitoring — 6 критериев × {0,1,2}
// ====================================================================

function scoreSensory(text: string): 0 | 1 | 2 {
  const t = normalize(text);
  const markers = [
    "видел", "видела", "увидел", "услышал", "слышал",
    "почувствовал", "ощутил", "запах", "цвет", "звук",
    "громко", "тихо", "ярко", "темно", "холодно", "жарко",
  ];
  let hits = 0;
  for (const m of markers) if (t.includes(m)) hits++;
  if (hits === 0) return 0;
  if (hits <= 2) return 1;
  return 2;
}

function scoreSpatial(text: string): 0 | 1 | 2 {
  const t = normalize(text);
  // Топонимы, адреса, офисы, конкретные локации
  const markers = [
    /\bмосква\b/i, /\bспб\b|санкт-петербург/i, /офис/i, /улиц/i, /проспект/i,
    /\bг\.\s*\w/i, /район/i, /здани/i, /корпус/i, /этаж/i,
    /в\s+(москве|петербурге|киеве|минске|алматы|казани|новосибирске)/i,
  ];
  let hits = 0;
  for (const re of markers) if (re.test(t)) hits++;
  if (hits === 0) return 0;
  if (hits <= 2) return 1;
  return 2;
}

function scoreTemporal(text: string): 0 | 1 | 2 {
  // Конкретные даты, месяцы, годы, последовательность
  const t = normalize(text);
  const dateHits = (t.match(/\b(19|20)\d{2}\b/g) || []).length;
  const monthHits = (t.match(/\b(январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр)\w*/gi) || []).length;
  const sequenceHits = (t.match(/\b(сначала|затем|потом|после|далее|в\s+итоге|спустя)\b/gi) || []).length;
  const total = dateHits + monthHits + sequenceHits;
  if (total === 0) return 0;
  if (total <= 3) return 1;
  return 2;
}

function scoreAffect(text: string): 0 | 1 | 2 {
  const tokens = tokenize(text);
  const pos = countMatches(tokens, LEX_POS_EMO);
  const neg = countMatches(tokens, LEX_NEG_EMO);
  const total = pos + neg;
  if (total === 0) return 0;
  if (total <= 2) return 1;
  return 2;
}

function scoreLogical(text: string): 0 | 1 | 2 {
  const cog = countPhrases(text, PHRASE_COGNITIVE);
  if (cog === 0) return 0;
  if (cog <= 2) return 1;
  return 2;
}

function scoreSelfRef(text: string): 0 | 1 | 2 {
  const tokens = tokenize(text);
  const sg = countMatches(tokens, LEX_FIRST_SG);
  const pl = countMatches(tokens, LEX_FIRST_PL);
  // Личные глаголы прошедшего времени 1-го лица (я сделал, я запустил)
  const verbs = (normalize(text).match(/\bя\s+\w+(л|ла|ли)\b/g) || []).length;
  const total = sg + Math.floor(pl / 2) + verbs * 2;
  if (total === 0) return 0;
  if (total <= 4) return 1;
  return 2;
}

export function runRealityMonitoring(blocks: RawBlock[]): RealityMonitoringAnalysis {
  if (blocks.length === 0) {
    return {
      blocks: [],
      averageScore: 0,
      verdict: "mixed",
      summary: "Блоки для Reality Monitoring не выделены — текст слишком короткий.",
    };
  }

  const rmBlocks: RmBlockScore[] = blocks.map((b) => {
    const sensory = scoreSensory(b.text);
    const spatial = scoreSpatial(b.text);
    const temporal = scoreTemporal(b.text);
    const affect = scoreAffect(b.text);
    const logical = scoreLogical(b.text);
    const selfRef = scoreSelfRef(b.text);
    const total = sensory + spatial + temporal + affect + logical + selfRef;
    const verdict: RmBlockScore["verdict"] =
      total >= 9 ? "real" : total >= 5 ? "ambiguous" : "constructed";
    return {
      kind: b.kind,
      label: b.label,
      sampleText: b.text.slice(0, 300),
      sensoryDetails: sensory,
      spatialContext: spatial,
      temporalContext: temporal,
      affect,
      logicalCoherence: logical,
      selfReference: selfRef,
      totalScore: total,
      verdict,
    };
  });

  const avg = rmBlocks.reduce((s, b) => s + b.totalScore, 0) / rmBlocks.length;
  const verdict: RealityMonitoringAnalysis["verdict"] =
    avg >= 9 ? "real" : avg >= 5 ? "mixed" : "constructed";

  const realN = rmBlocks.filter((b) => b.verdict === "real").length;
  const ambN = rmBlocks.filter((b) => b.verdict === "ambiguous").length;
  const constN = rmBlocks.filter((b) => b.verdict === "constructed").length;

  const summary = `Средний RM-балл ${avg.toFixed(1)}/12. «Живых» блоков: ${realN}, неоднозначных: ${ambN}, сконструированных: ${constN}.`;

  return {
    blocks: rmBlocks,
    averageScore: Math.round(avg * 10) / 10,
    verdict,
    summary,
  };
}

// ====================================================================
// 4. Cognitive Load
// ====================================================================

const LEX_HEDGING = [
  "возможно", "примерно", "около", "в целом", "якобы",
  "наверное", "кажется", "вроде", "порядка", "приблизительно",
  "где-то", "скорее всего", "по-видимому", "условно", "в принципе",
];

function shingle(text: string, n = 5): Set<string> {
  const tokens = tokenize(text);
  const out = new Set<string>();
  if (tokens.length < n) return out;
  for (let i = 0; i <= tokens.length - n; i++) {
    out.add(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((x) => { if (b.has(x)) inter++; });
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function findContradictions(blocks: RawBlock[]): Array<{ claim: string; counter: string }> {
  // Простая эвристика: ищем противоположные триггеры «увеличил X%» и «снизил X%» в разных блоках
  // либо: «команда из 5 человек» vs «команда из 15»
  const out: Array<{ claim: string; counter: string }> = [];
  const numPattern = /(команд\w*\s+из\s+(\d+)|\b(\d{1,3})\s+человек)/gi;
  const foundSizes: Array<{ size: number; text: string }> = [];
  for (const b of blocks) {
    const matches = Array.from(b.text.matchAll(numPattern));
    for (const m of matches) {
      const size = parseInt(m[2] || m[3], 10);
      if (!isNaN(size)) foundSizes.push({ size, text: m[0] });
    }
  }
  if (foundSizes.length >= 2) {
    const min = Math.min(...foundSizes.map((x) => x.size));
    const max = Math.max(...foundSizes.map((x) => x.size));
    if (max - min >= 5 && max / Math.max(1, min) >= 2) {
      const a = foundSizes.find((x) => x.size === min)!;
      const b = foundSizes.find((x) => x.size === max)!;
      out.push({ claim: a.text, counter: b.text });
    }
  }
  return out.slice(0, 4);
}

function findRepetitivePatterns(blocks: RawBlock[]): string[] {
  // Ищем одинаковые n-граммы (длиной 4) которые встречаются в 2+ блоках
  const counts = new Map<string, number>();
  for (const b of blocks) {
    const seen = new Set<string>();
    const tokens = tokenize(b.text);
    for (let i = 0; i + 4 <= tokens.length; i++) {
      const gram = tokens.slice(i, i + 4).join(" ");
      if (!seen.has(gram)) { seen.add(gram); counts.set(gram, (counts.get(gram) || 0) + 1); }
    }
  }
  const repeated = Array.from(counts.entries())
    .filter(([g, n]) => n >= 2 && g.length > 15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g]) => g);
  return repeated;
}

export function runCognitiveLoad(resumeText: string, blocks: RawBlock[]): CognitiveLoadAnalysis {
  // Хеджирование
  let hedgingCount = 0;
  const hedgingExamples: string[] = [];
  const sentences = resumeText.split(/(?<=[.!?])\s+/).slice(0, 200);
  for (const s of sentences) {
    for (const h of LEX_HEDGING) {
      if (new RegExp(`\\b${h}\\b`, "i").test(s)) {
        hedgingCount++;
        if (hedgingExamples.length < 4) hedgingExamples.push(s.trim().slice(0, 180));
        break;
      }
    }
  }

  // Структурная симметрия между описаниями работ
  const expBlocks = blocks.filter((b) => b.kind === "experience" || b.kind === "projects");
  let avgSymmetry = 0;
  let pairs = 0;
  if (expBlocks.length >= 2) {
    // Разбиваем experience-блок на подпункты, если есть (по маркерам)
    const chunks: string[] = [];
    for (const b of expBlocks) {
      const splits = b.text.split(/\n\s*[—–\-•\*]\s+|\n{2,}/).filter((s) => s.trim().length > 60);
      if (splits.length >= 2) chunks.push(...splits);
      else chunks.push(b.text);
    }
    if (chunks.length >= 2) {
      const shingles = chunks.map((c) => shingle(c, 5));
      for (let i = 0; i < shingles.length; i++) {
        for (let j = i + 1; j < shingles.length; j++) {
          avgSymmetry += jaccard(shingles[i], shingles[j]);
          pairs++;
        }
      }
      if (pairs > 0) avgSymmetry = (avgSymmetry / pairs) * 100;
    }
  }
  avgSymmetry = Math.round(avgSymmetry);

  const contradictions = findContradictions(blocks);
  const repetitivePatterns = findRepetitivePatterns(blocks);

  let riskScore = 0;
  if (hedgingCount >= 5) riskScore += 25;
  else if (hedgingCount >= 2) riskScore += 10;
  if (avgSymmetry > 60) riskScore += 30;
  else if (avgSymmetry > 40) riskScore += 15;
  if (contradictions.length > 0) riskScore += 25;
  if (repetitivePatterns.length >= 2) riskScore += 15;
  riskScore = Math.max(0, Math.min(100, riskScore));

  const parts: string[] = [];
  parts.push(`хеджирование: ${hedgingCount} случ.`);
  parts.push(`структурная симметрия описаний работ: ${avgSymmetry}%${avgSymmetry > 60 ? " (шаблонность)" : ""}`);
  if (contradictions.length) parts.push(`противоречий: ${contradictions.length}`);
  if (repetitivePatterns.length) parts.push(`повторяющихся оборотов: ${repetitivePatterns.length}`);
  const summary = parts.join("; ") + ".";

  return {
    hedgingCount,
    hedgingExamples,
    contradictionsCount: contradictions.length,
    contradictions,
    structuralSymmetry: avgSymmetry,
    symmetryNote: avgSymmetry > 60
      ? "Высокая симметрия описаний — возможна шаблонность или копирование между местами работы."
      : avgSymmetry > 40
      ? "Средняя симметрия описаний — повторяются формулировки."
      : "Описания работ разнородны — признак индивидуального нарратива.",
    repetitivePatterns,
    riskScore,
    summary,
  };
}

// ====================================================================
// 5. ACID — 10 критериев честного нарратива
// ====================================================================

const ACID_SPECS: Array<{
  key: string;
  label: string;
  check: (text: string, tokens: string[]) => { ok: boolean; evidence?: string };
}> = [
  {
    key: "first_person_anchor",
    label: "Привязка к 1-му лицу",
    check: (text, tokens) => {
      const hits = countMatches(tokens, LEX_FIRST_SG);
      return { ok: hits >= 2, evidence: hits > 0 ? `«я/мой/мне» встречается ${hits} раз` : undefined };
    },
  },
  {
    key: "unique_details",
    label: "Уникальные детали",
    check: (text) => {
      const uniqNums = (text.match(/\b\d+(?:[.,]\d+)?\s*(?:%|млн|млрд|тыс|рублей|долларов|k|м|шт|чел|раз)\b/gi) || []);
      return { ok: uniqNums.length >= 2, evidence: uniqNums.slice(0, 2).join("; ") };
    },
  },
  {
    key: "specific_names",
    label: "Конкретные имена/названия",
    check: (text) => {
      const names = (text.match(/\b[А-Я][а-я]{2,}\s+[А-Я][а-я]{2,}/g) || []);
      const brands = (text.match(/\b(ООО|ОАО|ЗАО|ПАО|АО)\s+[«"][^»"]+[»"]/g) || []);
      return { ok: names.length + brands.length >= 1, evidence: [...names.slice(0, 2), ...brands.slice(0, 1)].join("; ") };
    },
  },
  {
    key: "temporal_precision",
    label: "Временная точность",
    check: (text) => {
      const dates = (text.match(/\b(19|20)\d{2}\b|\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g) || []);
      return { ok: dates.length >= 2, evidence: dates.slice(0, 3).join("; ") };
    },
  },
  {
    key: "affect_presence",
    label: "Эмоциональная реакция",
    check: (text, tokens) => {
      const aff = countMatches(tokens, LEX_POS_EMO) + countMatches(tokens, LEX_NEG_EMO);
      return { ok: aff >= 1, evidence: aff > 0 ? `аффективных слов: ${aff}` : undefined };
    },
  },
  {
    key: "causal_chain",
    label: "Причинно-следственная цепь",
    check: (text) => {
      const cog = countPhrases(text, PHRASE_COGNITIVE);
      return { ok: cog >= 2, evidence: cog > 0 ? `причинно-следственных связок: ${cog}` : undefined };
    },
  },
  {
    key: "uncorrected_errors",
    label: "Следы самокоррекции",
    check: (text) => {
      const corr = (text.match(/\b(вернее|точнее|то есть|т\.е\.|скорее|не совсем|а именно)\b/gi) || []);
      return { ok: corr.length >= 1, evidence: corr.slice(0, 2).join("; ") };
    },
  },
  {
    key: "peripheral_details",
    label: "Периферийные детали",
    check: (text) => {
      // детали, не относящиеся прямо к задаче: имя коллеги, название встречи, конкретное место
      const det = (text.match(/\b(коллег\w*|встреч\w*|в\s+офисе|на\s+митинг\w*|на\s+совещани\w*|в\s+переговор\w*)\b/gi) || []);
      return { ok: det.length >= 1, evidence: det.slice(0, 2).join("; ") };
    },
  },
  {
    key: "complication_resolution",
    label: "Осложнение → разрешение",
    check: (text) => {
      const probl = (text.match(/\b(проблем\w*|сложност\w*|риск\w*|баг\w*|инцидент|авари\w*|задерж\w*|конфликт\w*)\b/gi) || []);
      const solv = (text.match(/\b(решил\w*|устранил\w*|исправил\w*|разрешил\w*|оптимизировал\w*|внедрил\w*|запустил\w*)\b/gi) || []);
      return { ok: probl.length >= 1 && solv.length >= 1, evidence: `проблем: ${probl.length}, решений: ${solv.length}` };
    },
  },
  {
    key: "self_doubt",
    label: "Собственные сомнения/ограничения",
    check: (text) => {
      const doubt = (text.match(/\b(не\s+знал\w*|сомнева\w*|рискну\w*|опасал\w*|неуверен\w*|учусь\w*|изучаю\w*|разбира\w*)\b/gi) || []);
      return { ok: doubt.length >= 1, evidence: doubt.slice(0, 2).join("; ") };
    },
  },
];

function classifyAcidBlock(block: RawBlock): AcidBlockClassification {
  const tokens = tokenize(block.text);
  const criteria: AcidCriterion[] = ACID_SPECS.map((spec) => {
    const res = spec.check(block.text, tokens);
    return {
      key: spec.key,
      label: spec.label,
      honestIndicator: !!res.ok,
      evidence: res.evidence,
    };
  });
  const honestScore = criteria.filter((c) => c.honestIndicator).length;
  const verdict: AcidBlockClassification["verdict"] =
    honestScore >= 8 ? "honest" :
    honestScore >= 5 ? "mixed" :
    honestScore >= 3 ? "constructed" : "fabricated";
  return {
    kind: block.kind,
    label: block.label,
    honestScore,
    verdict,
    criteria,
  };
}

export function runAcid(blocks: RawBlock[]): AcidAnalysis {
  if (blocks.length === 0) {
    return {
      blocks: [],
      overallVerdict: "mixed",
      summary: "Недостаточно текста для ACID-классификации.",
    };
  }
  const classified = blocks.map(classifyAcidBlock);
  const avgHonest = classified.reduce((s, b) => s + b.honestScore, 0) / classified.length;
  const overall: AcidAnalysis["overallVerdict"] =
    avgHonest >= 8 ? "honest" :
    avgHonest >= 5 ? "mixed" :
    avgHonest >= 3 ? "constructed" : "fabricated";
  const counts = {
    honest: classified.filter((b) => b.verdict === "honest").length,
    mixed: classified.filter((b) => b.verdict === "mixed").length,
    constructed: classified.filter((b) => b.verdict === "constructed").length,
    fabricated: classified.filter((b) => b.verdict === "fabricated").length,
  };
  const summary = `Средний honest-score: ${avgHonest.toFixed(1)}/10. Блоков honest: ${counts.honest}, mixed: ${counts.mixed}, constructed: ${counts.constructed}, fabricated: ${counts.fabricated}.`;
  return { blocks: classified, overallVerdict: overall, summary };
}

// ====================================================================
// 6. Сводный лингвистический аудит
// ====================================================================

function mapVerdictToRisk(v: LinguisticAuditVerdict): number {
  return v === "honest" ? 10 : v === "mixed" ? 40 : v === "constructed" ? 70 : 90;
}

function composeOverallVerdict(risk: number): LinguisticAuditVerdict {
  if (risk < 25) return "honest";
  if (risk < 50) return "mixed";
  if (risk < 75) return "constructed";
  return "fabricated";
}

function rmToVerdict(v: RealityMonitoringAnalysis["verdict"]): LinguisticAuditVerdict {
  if (v === "real") return "honest";
  if (v === "mixed") return "mixed";
  return "constructed";
}

export function runLinguisticAudit(
  resumeText: string,
  interviewText: string = "",
): LinguisticAudit {
  const combinedText = [resumeText, interviewText].filter(Boolean).join("\n\n").slice(0, 30000);
  const liwc = runLiwc(combinedText);
  const blocks = splitBlocks(resumeText);
  const rm = runRealityMonitoring(blocks);
  const cognitiveLoad = runCognitiveLoad(resumeText, blocks);
  const acid = runAcid(blocks);

  // Итоговый риск: взвешенное среднее
  const rmRisk = mapVerdictToRisk(rmToVerdict(rm.verdict));
  const acidRisk = mapVerdictToRisk(acid.overallVerdict);
  const linguisticRisk = Math.round(
    0.3 * liwc.riskScore +
    0.25 * rmRisk +
    0.25 * cognitiveLoad.riskScore +
    0.2 * acidRisk,
  );

  const verdict = composeOverallVerdict(linguisticRisk);

  const headlineMap: Record<LinguisticAuditVerdict, string> = {
    honest: "Лингвистический профиль: нарратив выглядит достоверным.",
    mixed: "Лингвистический профиль: смешанные признаки — частично достоверный нарратив.",
    constructed: "Лингвистический профиль: признаки сконструированного нарратива.",
    fabricated: "Лингвистический профиль: высокий риск фальсификации нарратива.",
  };

  const summary = [
    `Общий лингвистический риск ${linguisticRisk}/100 (${verdict}).`,
    `LIWC: ${liwc.summary}`,
    `RM: ${rm.summary}`,
    `Когнитивная нагрузка: ${cognitiveLoad.summary}`,
    `ACID: ${acid.summary}`,
  ].join(" ");

  return {
    version: "1.0",
    liwc,
    realityMonitoring: rm,
    cognitiveLoad,
    acid,
    linguisticRisk,
    verdict,
    headline: headlineMap[verdict],
    summary,
  };
}
