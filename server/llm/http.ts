// Общий HTTP-слой для LLM-провайдеров: таймаут + экспоненциальный backoff-ретрай.

export type LlmMessage = { role: "system" | "user" | "assistant"; text: string };

const LLM_TIMEOUT_MS = 30_000;
const LLM_MAX_RETRIES = 2;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** fetch с таймаутом и экспоненциальным backoff-ретраем на транзиентные ошибки (429/5xx/аборты). */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? LLM_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? LLM_MAX_RETRIES;
  let lastErr: unknown = new Error("LLM request failed");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await sleep(Math.min(2000, 250 * 2 ** attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt < maxRetries) {
        await sleep(Math.min(2000, 250 * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
