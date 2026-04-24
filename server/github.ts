// ============================================================
// GitHub Collector (v3.5) — сбор публичных данных GitHub-профиля
// через REST API. Без авторизации — 60 req/hour,
// при наличии GITHUB_TOKEN — 5000 req/hour.
// ============================================================

const GH_BASE = "https://api.github.com";

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bot-sbshnik/3.5",
    ...(extra || {}),
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

export class GitHubRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

export class GitHubNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubNotFoundError";
  }
}

async function ghGet<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  const url = path.startsWith("http") ? path : `${GH_BASE}${path}`;
  const res = await fetch(url, { headers: headers(extraHeaders) });
  if (res.status === 404) {
    throw new GitHubNotFoundError(`GitHub 404: ${path}`);
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    throw new GitHubRateLimitError(
      `GitHub rate-limit exceeded (status=${res.status}, remaining=${remaining ?? "?"})`,
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

// Извлекает github handle из URL или текста.
// Возвращает handle в lowercase или null.
export function extractGithubHandle(input: string): string | null {
  if (!input) return null;
  const text = String(input);

  // 1) Явные URL github.com/<handle>
  const urlRe = /github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})(?:[\/\s?#]|$)/i;
  const m1 = text.match(urlRe);
  if (m1) {
    const h = m1[1];
    if (!isReservedPath(h)) return h.toLowerCase();
  }

  // 2) "github: octocat", "github - octocat", "gh octocat"
  const kvRe = /(?:github|gh)\s*[:\-—]\s*@?([A-Za-z0-9][A-Za-z0-9-]{0,38})\b/i;
  const m2 = text.match(kvRe);
  if (m2) {
    const h = m2[1];
    if (!isReservedPath(h)) return h.toLowerCase();
  }

  return null;
}

function isReservedPath(s: string): boolean {
  const reserved = new Set([
    "orgs",
    "marketplace",
    "features",
    "topics",
    "collections",
    "trending",
    "events",
    "pricing",
    "enterprise",
    "about",
    "contact",
    "settings",
    "login",
    "join",
    "logout",
    "new",
    "issues",
    "pulls",
    "notifications",
    "search",
    "explore",
    "sponsors",
  ]);
  return reserved.has(s.toLowerCase());
}

// ============ Типы сырых данных ============

export type GhUser = {
  login: string;
  id: number;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  avatar_url: string;
  hireable?: boolean | null;
};

export type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  size: number; // KB
  created_at: string;
  pushed_at: string;
  updated_at: string;
  default_branch: string;
  archived: boolean;
  topics?: string[];
};

export type GhLanguages = Record<string, number>; // язык -> байты

export type GhEvent = {
  id: string;
  type: string; // PushEvent, PullRequestEvent, IssuesEvent, CreateEvent, ...
  actor: { login: string };
  repo: { name: string; url: string };
  created_at: string;
  payload: any;
};

export type GhCommitHit = {
  sha: string;
  html_url: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
  repository?: { full_name: string; html_url: string };
};

export type GitHubCollected = {
  user: GhUser;
  repos: GhRepo[];         // сортировано по updated, без forks
  allRepos: GhRepo[];      // включая forks
  topRepos: GhRepo[];      // топ 5 по stars + recent
  languagesByRepo: Record<string, GhLanguages>; // repo fullName -> languages
  totalLanguageBytes: Record<string, number>;   // агрегированные байты по языкам
  events: GhEvent[];
  commitHits: GhCommitHit[]; // search/commits
  fetchedAt: number;
  warnings: string[];
};

// ============ Collector ============

export async function collectGitHubProfile(handle: string): Promise<GitHubCollected> {
  const warnings: string[] = [];

  const user = await ghGet<GhUser>(`/users/${encodeURIComponent(handle)}`);

  // Репозитории (до 100), сортировка по updated — последние активные
  let allRepos: GhRepo[] = [];
  try {
    allRepos = await ghGet<GhRepo[]>(
      `/users/${encodeURIComponent(handle)}/repos?sort=updated&per_page=100&type=owner`,
    );
  } catch (e: any) {
    warnings.push(`Не удалось получить репозитории: ${e?.message || e}`);
  }

  const repos = allRepos.filter((r) => !r.fork);

  // Топ-5: по stars, затем по дате push
  const topRepos = [...repos]
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
    })
    .slice(0, 5);

  // Берём языки для топ-10 оригинальных репозиториев
  const reposForLangs = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10);
  const languagesByRepo: Record<string, GhLanguages> = {};
  const totalLanguageBytes: Record<string, number> = {};
  for (const r of reposForLangs) {
    try {
      const langs = await ghGet<GhLanguages>(`/repos/${r.full_name}/languages`);
      languagesByRepo[r.full_name] = langs;
      for (const [lang, bytes] of Object.entries(langs)) {
        totalLanguageBytes[lang] = (totalLanguageBytes[lang] || 0) + bytes;
      }
    } catch (e: any) {
      if (e instanceof GitHubRateLimitError) {
        warnings.push("Rate-limit при сборе языков репозиториев.");
        throw e;
      }
      warnings.push(`Не удалось получить языки ${r.full_name}: ${e?.message || e}`);
    }
  }

  // Публичные события (до 100)
  let events: GhEvent[] = [];
  try {
    events = await ghGet<GhEvent[]>(
      `/users/${encodeURIComponent(handle)}/events/public?per_page=100`,
    );
  } catch (e: any) {
    warnings.push(`Не удалось получить события: ${e?.message || e}`);
  }

  // Коммиты через /search/commits (preview API)
  let commitHits: GhCommitHit[] = [];
  try {
    const search = await ghGet<{ items: GhCommitHit[] }>(
      `/search/commits?q=author:${encodeURIComponent(handle)}&per_page=100&sort=author-date&order=desc`,
      { Accept: "application/vnd.github.cloak-preview+json" },
    );
    commitHits = search.items || [];
  } catch (e: any) {
    if (e instanceof GitHubRateLimitError) {
      warnings.push("Rate-limit при поиске коммитов.");
    } else {
      warnings.push(`Не удалось получить коммиты через search: ${e?.message || e}`);
    }
  }

  return {
    user,
    repos,
    allRepos,
    topRepos,
    languagesByRepo,
    totalLanguageBytes,
    events,
    commitHits,
    fetchedAt: Date.now(),
    warnings,
  };
}
