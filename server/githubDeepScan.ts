// ============================================================
// GITHUB DEEPSCAN v3.5 — анализ публичного GitHub-профиля
// Детекторы: Identity Resolver, Tech Stack Profiler, Contribution Authenticity,
// Behavior Timeline, Moonlighting Detector, Red Flags, Secrets heuristics.
// Плюс единичный LLM-проход: Code Quality Probe + OCEAN-hints.
// ============================================================
//
// ВАЖНО:
// - Все выводы — ГИПОТЕЗЫ с permalink-доказательствами.
// - Не претендуем на проверку приватного кода; работаем только с публичным.
// - При rate-limit / 404 возвращаем dataInsufficient=true с fetchError.
//
import {
  collectGitHubProfile,
  extractGithubHandle,
  GitHubCollected,
  GitHubNotFoundError,
  GitHubRateLimitError,
  GhRepo,
  GhCommitHit,
} from "./github";
import { yandexComplete } from "./yandex";
import { getPrompt } from "./settings";
import { stripPhantomText } from "./pipelineAnalyzer";
import type {
  GitHubDeepScanReport,
  GhTechProfile,
  GhBehaviorProfile,
  GhRiskFlag,
  GhOceanHints,
  GhEvidenceLink,
  GhLanguageUsage,
} from "@shared/schema";

// ============ Утилиты ============

function extractJson(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function clampInt(n: any, min = 0, max = 100, def = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function clamp01(n: any, def = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(0, Math.min(1, v));
}

function normStr(v: any, def = ""): string {
  if (typeof v !== "string") return def;
  return stripPhantomText(v.trim()) || def;
}

function yearsBetween(fromIso: string, toMs = Date.now()): number {
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return 0;
  const diff = toMs - from;
  return Math.max(0, diff / (365.25 * 24 * 3600 * 1000));
}

// ============ Пустой отчёт (data insufficient / ошибка) ============

function emptyTechProfile(): GhTechProfile {
  return {
    primary: [],
    languages: [],
    publicRepos: 0,
    originalRepos: 0,
    totalStars: 0,
    accountAgeYears: 0,
    depthYears: 0,
    topRepos: [],
    notes: [],
  };
}

function emptyBehaviorProfile(): GhBehaviorProfile {
  return {
    hourHistogramMsk: new Array(24).fill(0),
    nightShare: 0,
    workHoursShare: 0,
    weekendShare: 0,
    inferredTimezone: "unknown",
    commitsPerWeek: 0,
    regularity: 0,
    notes: [],
  };
}

function emptyOceanHints(): GhOceanHints {
  return {
    O: 0.5,
    C: 0.5,
    E: 0.5,
    A: 0.5,
    N: 0.5,
    rationale: { O: "", C: "", E: "", A: "", N: "" },
  };
}

export function insufficientReport(
  handle: string,
  profileUrl: string,
  fetchError: string | null,
): Omit<GitHubDeepScanReport, "id" | "checkId" | "createdAt"> {
  return {
    githubHandle: handle,
    profileUrl,
    sbScore: 0,
    techScore: 0,
    behaviorScore: 0,
    riskScore: 0,
    confidence: 0,
    techProfile: emptyTechProfile(),
    behaviorProfile: emptyBehaviorProfile(),
    riskFlags: [],
    oceanHints: emptyOceanHints(),
    evidence: [],
    summary:
      "Недостаточно публичных данных для анализа GitHub-профиля. Проверьте правильность хэндла или попробуйте позже.",
    recommendation:
      "Уточните актуальный GitHub-хэндл у кандидата или запросите доступ к приватным репозиториям на интервью.",
    dataInsufficient: true,
    fetchError,
  };
}

// ============ Detector: Tech Stack Profile ============

function buildTechProfile(data: GitHubCollected): GhTechProfile {
  const { user, repos, totalLanguageBytes, topRepos } = data;

  const totalBytes = Object.values(totalLanguageBytes).reduce((a, b) => a + b, 0) || 1;
  const languages: GhLanguageUsage[] = Object.entries(totalLanguageBytes)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: Math.round((bytes / totalBytes) * 1000) / 10,
    }))
    .sort((a, b) => b.percent - a.percent);

  const primary = languages.slice(0, 3).map((l) => l.name);

  // Глубина по основному языку — по дате создания самого старого репозитория
  // с таким основным языком.
  let depthYears = 0;
  if (primary[0]) {
    const first = repos.find((r) => r.language === primary[0]);
    if (first) depthYears = Math.round(yearsBetween(first.created_at) * 10) / 10;
  }

  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const accountAgeYears = Math.round(yearsBetween(user.created_at) * 10) / 10;

  const notes: string[] = [];
  if (primary.length === 0) notes.push("Не удалось определить основной стек: мало публичных данных.");
  if (totalStars === 0) notes.push("Репозитории не получали звёзд — сложно судить о публичном признании.");
  if (repos.length === 0) notes.push("Нет оригинальных публичных репозиториев.");

  return {
    primary,
    languages,
    publicRepos: user.public_repos,
    originalRepos: repos.length,
    totalStars,
    accountAgeYears,
    depthYears,
    topRepos: topRepos.map((r) => ({
      name: r.full_name,
      url: r.html_url,
      stars: r.stargazers_count,
      language: r.language,
    })),
    notes,
  };
}

// ============ Detector: Behavior Timeline ============
// Используем коммиты из search/commits, приводим дату к MSK (UTC+3).

function buildBehaviorProfile(data: GitHubCollected): GhBehaviorProfile {
  const commits = data.commitHits || [];
  const hist = new Array(24).fill(0);
  const weekBuckets = new Set<string>();
  let night = 0;
  let work = 0;
  let weekend = 0;
  let total = 0;

  for (const c of commits) {
    const d = new Date(c.commit.author.date);
    if (!Number.isFinite(d.getTime())) continue;
    const mskMs = d.getTime() + 3 * 3600 * 1000;
    const msk = new Date(mskMs);
    const hour = msk.getUTCHours();
    const dow = msk.getUTCDay(); // 0 — вс, 6 — сб
    hist[hour]++;
    total++;
    if (hour < 6) night++;
    if (dow >= 1 && dow <= 5 && hour >= 10 && hour < 19) work++;
    if (dow === 0 || dow === 6) weekend++;
    // неделя от создания коммита
    const weekKey = `${msk.getUTCFullYear()}-W${Math.floor(
      (msk.getTime() - Date.UTC(msk.getUTCFullYear(), 0, 1)) / (7 * 24 * 3600 * 1000),
    )}`;
    weekBuckets.add(weekKey);
  }

  const histNorm = hist.map((x) => (total > 0 ? Math.round((x / total) * 1000) / 1000 : 0));

  // Таймзона: по модальному часу (самый активный)
  let inferredTimezone = "unknown";
  if (total > 0) {
    let peak = 0;
    for (let i = 1; i < 24; i++) if (hist[i] > hist[peak]) peak = i;
    // Если пик в 10–19 MSK → UTC+3 (MSK). Сдвиг относительно 14 (середина рабочего дня MSK).
    const offset = Math.round(((peak - 14) + 3 + 24) % 24);
    const tzOffset = offset > 12 ? offset - 24 : offset;
    inferredTimezone = tzOffset >= 0 ? `UTC+${tzOffset}` : `UTC${tzOffset}`;
  }

  // Коммитов в неделю — грубая оценка за ~52 недели (используем найденные коммиты)
  const weeks = Math.max(1, weekBuckets.size);
  const commitsPerWeek = Math.round((total / weeks) * 10) / 10;
  const regularity = Math.max(0, Math.min(1, weeks / 52));

  const notes: string[] = [];
  if (total === 0) notes.push("Нет данных о коммитах в публичном доступе.");
  if (total > 0 && night / total > 0.35) notes.push("Заметная доля ночных коммитов (может указывать на иную таймзону или фриланс).");
  if (total > 0 && weekend / total > 0.35) notes.push("Много активности в выходные.");

  return {
    hourHistogramMsk: histNorm,
    nightShare: total ? Math.round((night / total) * 1000) / 1000 : 0,
    workHoursShare: total ? Math.round((work / total) * 1000) / 1000 : 0,
    weekendShare: total ? Math.round((weekend / total) * 1000) / 1000 : 0,
    inferredTimezone,
    commitsPerWeek,
    regularity: Math.round(regularity * 100) / 100,
    notes,
  };
}

// ============ Detector: Risk Flags ============

const SECRET_RE =
  /(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{20,}|-----BEGIN (?:RSA|OPENSSH|PRIVATE) KEY-----)/;

const NSFW_KEYWORDS = [
  "nsfw",
  "porn",
  "xxx",
  "onlyfans",
  "casino",
  "gambling",
  "взлом",
  "читер",
  "cheat",
  "crack",
  "warez",
];

const MOONLIGHT_KEYWORDS = [
  "freelance",
  "фриланс",
  "upwork",
  "kwork",
  "fiverr",
  "подработ",
  "заказ",
];

function detectRiskFlags(
  data: GitHubCollected,
  resumeText: string | undefined,
): GhRiskFlag[] {
  const flags: GhRiskFlag[] = [];
  const { user, repos, commitHits, events } = data;

  // Секреты: ищем в публичных messages и описаниях
  const leakedCommits: GhCommitHit[] = [];
  for (const c of commitHits) {
    if (SECRET_RE.test(c.commit?.message || "")) leakedCommits.push(c);
  }
  if (leakedCommits.length > 0) {
    flags.push({
      type: "secret_leak",
      severity: "high",
      title: "Возможная утечка секретов в сообщениях коммитов",
      description: `Найдено ${leakedCommits.length} публичных коммитов с паттернами ключей/токенов в сообщении.`,
      evidenceUrls: leakedCommits.slice(0, 5).map((c) => c.html_url),
    });
  }

  // NSFW / сомнительный контент в названиях и описаниях
  const nsfwRepos = repos.filter((r) => {
    const blob = `${r.name} ${r.description || ""} ${(r.topics || []).join(" ")}`.toLowerCase();
    return NSFW_KEYWORDS.some((k) => blob.includes(k));
  });
  if (nsfwRepos.length > 0) {
    flags.push({
      type: "nsfw_content",
      severity: "medium",
      title: "Сомнительный контент в репозиториях",
      description: `Найдены репозитории с потенциально нежелательными ключевыми словами.`,
      evidenceUrls: nsfwRepos.slice(0, 5).map((r) => r.html_url),
    });
  }

  // Moonlighting: бэйджи фриланс-бирж в описании профиля/репозиториев
  const bio = (user.bio || "").toLowerCase();
  const hasMoonBio = MOONLIGHT_KEYWORDS.some((k) => bio.includes(k));
  const moonRepos = repos.filter((r) => {
    const blob = `${r.name} ${r.description || ""}`.toLowerCase();
    return MOONLIGHT_KEYWORDS.some((k) => blob.includes(k));
  });
  if (hasMoonBio || moonRepos.length > 0) {
    flags.push({
      type: "moonlighting",
      severity: "medium",
      title: "Признаки параллельной фриланс-занятости",
      description: hasMoonBio
        ? "В био профиля упоминается фриланс / подработка."
        : `Найдены репозитории с признаками фриланс-активности (${moonRepos.length}).`,
      evidenceUrls: moonRepos.slice(0, 5).map((r) => r.html_url),
    });
  }

  // Identity weakness: пустое имя, пустая bio, нет email/company
  const idMissing =
    !user.name && !user.company && !user.email && !user.blog && !user.bio;
  if (idMissing) {
    flags.push({
      type: "identity_weak",
      severity: "low",
      title: "Слабая цифровая идентичность",
      description:
        "В профиле не заполнены имя, компания, email, блог и био — сложно верифицировать личность.",
      evidenceUrls: [user.html_url],
    });
  }

  // Contribution authenticity: много репозиториев, но у всех 0 коммитов активности
  if (repos.length > 5 && commitHits.length === 0 && events.length === 0) {
    flags.push({
      type: "contribution_authenticity",
      severity: "medium",
      title: "Подозрительно низкая активность",
      description: `У пользователя ${repos.length} публичных репозиториев, но не найдено коммитов и событий.`,
      evidenceUrls: [user.html_url],
    });
  }

  // Timezone mismatch (если в резюме есть город)
  if (resumeText) {
    const rus = /(москв|питер|санкт-петерб|казан|новосиб|екатеринб)/i.test(resumeText);
    const tzOk = commitHits.length > 5;
    if (rus && tzOk) {
      // Если большинство коммитов ночью MSK — возможная нестыковка
      let night = 0;
      for (const c of commitHits) {
        const d = new Date(c.commit.author.date);
        const mskHour = new Date(d.getTime() + 3 * 3600 * 1000).getUTCHours();
        if (mskHour < 6) night++;
      }
      if (night / commitHits.length > 0.4) {
        flags.push({
          type: "timezone_mismatch",
          severity: "low",
          title: "Несоответствие таймзоны",
          description:
            "Кандидат указывает российский город, но >40% коммитов приходятся на ночь по МСК.",
          evidenceUrls: [user.html_url],
        });
      }
    }
  }

  return flags;
}

// ============ Scorer ============

function scoreTech(tp: GhTechProfile): number {
  // От 0 до 100
  const reposScore = Math.min(30, tp.originalRepos * 2); // до 30
  const starsScore = Math.min(25, Math.sqrt(tp.totalStars) * 5); // до 25
  const ageScore = Math.min(20, tp.accountAgeYears * 2.5); // до 20
  const langScore = Math.min(15, tp.languages.length * 2); // до 15
  const depthScore = Math.min(10, tp.depthYears * 2); // до 10
  return clampInt(reposScore + starsScore + ageScore + langScore + depthScore);
}

function scoreBehavior(bp: GhBehaviorProfile): number {
  const regularityScore = bp.regularity * 50; // до 50
  const workScore = bp.workHoursShare * 30; // до 30
  const activityScore = Math.min(20, bp.commitsPerWeek * 2); // до 20
  return clampInt(regularityScore + workScore + activityScore);
}

function scoreRisk(flags: GhRiskFlag[]): number {
  // Risk score: 100 — чисто, 0 — куча тяжёлых флагов. Чем больше флагов и сильнее — тем ниже.
  let penalty = 0;
  for (const f of flags) {
    if (f.severity === "critical") penalty += 40;
    else if (f.severity === "high") penalty += 20;
    else if (f.severity === "medium") penalty += 10;
    else penalty += 3;
  }
  return clampInt(100 - penalty);
}

function computeConfidence(data: GitHubCollected): number {
  let base = 40;
  if (data.repos.length > 0) base += 15;
  if (Object.keys(data.totalLanguageBytes).length > 0) base += 10;
  if (data.commitHits.length > 10) base += 20;
  if (data.events.length > 10) base += 10;
  if (data.warnings.length === 0) base += 5;
  return clampInt(base);
}

// ============ LLM-проход: Code Quality Probe + OCEAN-hints ============

export const DEFAULT_DEEPSCAN_SYSTEM_PROMPT = `Ты — GitHub DeepScan v3.5 внутри «БОТ СБшник».
Твоя задача — по сжатой сводке публичного GitHub-профиля сформулировать:
1) Code Quality Probe — короткую гипотезу о зрелости кода (на основании выборки названий репозиториев, языков, звёзд, тем).
2) OCEAN-hints (Big Five) — гипотезы 0..1 для O/C/E/A/N по поведенческим сигналам (стек, регулярность, ко-авторство, PR).

ЖЕЛЕЗНЫЕ ПРАВИЛА:
- Все выводы — гипотезы, не диагноз.
- Не оценивай расу/пол/возраст/религию/политику.
- Пиши по-русски, коротко, без канцелярита, без эмодзи.
- Ответ — СТРОГО валидный JSON, без пояснений.

СХЕМА ОТВЕТА:
{
  "codeQualityNotes": ["1-3 коротких пункта"],
  "oceanHints": {
    "O": 0..1, "C": 0..1, "E": 0..1, "A": 0..1, "N": 0..1,
    "rationale": { "O": "...", "C": "...", "E": "...", "A": "...", "N": "..." }
  },
  "summary": "2-3 предложения",
  "recommendation": "1-2 предложения: что уточнить на интервью"
}`;

function buildDeepScanUserPrompt(
  data: GitHubCollected,
  tp: GhTechProfile,
  bp: GhBehaviorProfile,
): string {
  const topReposStr = tp.topRepos
    .map((r) => `- ${r.name} ⭐${r.stars} [${r.language || "?"}]`)
    .join("\n");
  const langsStr = tp.languages
    .slice(0, 8)
    .map((l) => `${l.name}: ${l.percent}%`)
    .join(", ");

  return `GitHub handle: ${data.user.login}
Имя: ${data.user.name || "(не указано)"} | Компания: ${data.user.company || "(не указано)"} | Био: ${data.user.bio || "(нет)"}
Аккаунт: создан ${data.user.created_at}, подписчики ${data.user.followers}
Публичные репозитории: ${data.user.public_repos}, оригинальных: ${tp.originalRepos}, звёзд всего: ${tp.totalStars}

Языки: ${langsStr || "(нет данных)"}

Топ-репозитории:
${topReposStr || "(нет)"}

Поведение: коммитов/неделю ≈ ${bp.commitsPerWeek}, регулярность ${bp.regularity}, ночные ${Math.round(bp.nightShare * 100)}%, выходные ${Math.round(bp.weekendShare * 100)}%, таймзона ≈ ${bp.inferredTimezone}

Сформируй JSON по схеме из системного промпта. Только JSON.`;
}

async function runLlmProbe(
  data: GitHubCollected,
  tp: GhTechProfile,
  bp: GhBehaviorProfile,
): Promise<{
  codeQualityNotes: string[];
  oceanHints: GhOceanHints;
  summary: string;
  recommendation: string;
}> {
  try {
    const raw = await yandexComplete(
      [
        { role: "system", text: getPrompt("deepscan_system") ?? DEFAULT_DEEPSCAN_SYSTEM_PROMPT },
        { role: "user", text: buildDeepScanUserPrompt(data, tp, bp) },
      ],
      { temperature: 0.3, maxTokens: 3000 },
    );
    const parsed = JSON.parse(extractJson(raw));
    const hints = parsed?.oceanHints || {};
    const rat = hints?.rationale || {};
    return {
      codeQualityNotes: Array.isArray(parsed?.codeQualityNotes)
        ? parsed.codeQualityNotes.map((s: any) => normStr(s)).filter(Boolean).slice(0, 5)
        : [],
      oceanHints: {
        O: clamp01(hints?.O, 0.5),
        C: clamp01(hints?.C, 0.5),
        E: clamp01(hints?.E, 0.5),
        A: clamp01(hints?.A, 0.5),
        N: clamp01(hints?.N, 0.5),
        rationale: {
          O: normStr(rat?.O),
          C: normStr(rat?.C),
          E: normStr(rat?.E),
          A: normStr(rat?.A),
          N: normStr(rat?.N),
        },
      },
      summary: normStr(parsed?.summary),
      recommendation: normStr(parsed?.recommendation),
    };
  } catch (e: any) {
    console.warn("DeepScan LLM fallback:", e?.message || e);
    return {
      codeQualityNotes: [],
      oceanHints: emptyOceanHints(),
      summary: "",
      recommendation: "",
    };
  }
}

// ============ Evidence builder ============

function buildEvidence(data: GitHubCollected): GhEvidenceLink[] {
  const items: GhEvidenceLink[] = [];
  items.push({ label: "Профиль GitHub", url: data.user.html_url });
  for (const r of data.topRepos.slice(0, 5)) {
    items.push({ label: `Репозиторий ${r.name} (⭐${r.stargazers_count})`, url: r.html_url });
  }
  return items;
}

// ============ Основная функция ============

export type GitHubDeepScanInput = {
  resumeText?: string;       // текст резюме — для извлечения handle и перекрёстных проверок
  handleOverride?: string;   // явно заданный handle (из UI)
};

export async function runGitHubDeepScan(
  input: GitHubDeepScanInput,
): Promise<Omit<GitHubDeepScanReport, "id" | "checkId" | "createdAt">> {
  const rawHandle =
    input.handleOverride?.trim() ||
    (input.resumeText ? extractGithubHandle(input.resumeText) : null);

  const handle = rawHandle ? rawHandle.replace(/^@/, "").trim() : "";

  if (!handle) {
    return {
      ...insufficientReport("", "", "GitHub handle не найден в резюме и не указан вручную."),
    };
  }

  const profileUrl = `https://github.com/${handle}`;

  let collected: GitHubCollected;
  try {
    collected = await collectGitHubProfile(handle);
  } catch (e: any) {
    let msg = e?.message || String(e);
    if (e instanceof GitHubNotFoundError) msg = `Профиль GitHub @${handle} не найден (404).`;
    if (e instanceof GitHubRateLimitError)
      msg = `Исчерпан лимит GitHub API. Попробуйте позже${process.env.GITHUB_TOKEN ? "" : " или настройте GITHUB_TOKEN"}.`;
    return insufficientReport(handle, profileUrl, msg);
  }

  const techProfile = buildTechProfile(collected);
  const behaviorProfile = buildBehaviorProfile(collected);
  const riskFlags = detectRiskFlags(collected, input.resumeText);
  const evidence = buildEvidence(collected);

  const llm = await runLlmProbe(collected, techProfile, behaviorProfile);
  const oceanHints = llm.oceanHints;

  // Объединяем notes из детекторов и LLM
  if (llm.codeQualityNotes.length > 0) {
    techProfile.notes = [...techProfile.notes, ...llm.codeQualityNotes].slice(0, 8);
  }

  const techScore = scoreTech(techProfile);
  const behaviorScore = scoreBehavior(behaviorProfile);
  const riskScore = scoreRisk(riskFlags);
  const sbScore = clampInt(
    Math.round(techScore * 0.4 + behaviorScore * 0.3 + riskScore * 0.3),
  );
  const confidence = computeConfidence(collected);

  const dataInsufficient =
    collected.repos.length === 0 &&
    collected.commitHits.length === 0 &&
    collected.events.length === 0;

  // Summary и recommendation: берём из LLM, если пустые — собираем дефолт
  const summary =
    llm.summary ||
    `GitHub-активность @${handle}: ${techProfile.originalRepos} оригинальных репозиториев, ` +
      `${techProfile.totalStars}⭐, основной стек: ${techProfile.primary.join(", ") || "—"}.`;

  const recommendation =
    llm.recommendation ||
    (riskFlags.length > 0
      ? "Обсудить на интервью найденные сигналы и подтвердить самостоятельность кода."
      : "Дополнительные проверки не требуются — продолжайте по стандартному интервью-процессу.");

  return {
    githubHandle: handle,
    profileUrl,
    sbScore,
    techScore,
    behaviorScore,
    riskScore,
    confidence,
    techProfile,
    behaviorProfile,
    riskFlags,
    oceanHints,
    evidence,
    summary,
    recommendation,
    dataInsufficient,
    fetchError: collected.warnings.length > 0 ? collected.warnings.join("; ") : null,
  };
}
