import { describe, it, expect, vi, afterEach } from "vitest";

// Мокаем settings, чтобы управлять активным/fallback провайдером без БД.
vi.mock("../server/settings", () => ({
  getActiveProviderConfig: vi.fn(),
  getFallbackProviderConfig: vi.fn(),
}));

import { makeProvider, llmComplete, YandexNativeProvider, OpenAICompatibleProvider } from "../server/llm/provider";
import { getActiveProviderConfig, getFallbackProviderConfig } from "../server/settings";

const fakeActive = {
  id: "a", name: "Active", protocol: "openai-compatible" as const,
  endpoint: "https://cloud.ru/v1/chat/completions", model: "gpt-4o",
  folderId: null, apiKey: "key-a",
};
const fakeFallback = {
  id: "b", name: "Fallback", protocol: "openai-compatible" as const,
  endpoint: "https://cloud.ru/v1/chat/completions", model: "gpt-4o",
  folderId: null, apiKey: "key-b",
};

describe("llm/provider (M2)", () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("makeProvider выбирает класс по protocol", () => {
    expect(makeProvider({ ...fakeActive, protocol: "yandex-native" })).toBeInstanceOf(YandexNativeProvider);
    expect(makeProvider({ ...fakeActive, protocol: "openai-compatible" })).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("llmComplete: активный упал (400) → fallback отдаёт текст", async () => {
    (getActiveProviderConfig as any).mockReturnValue(fakeActive);
    (getFallbackProviderConfig as any).mockReturnValue(fakeFallback);
    let calls = 0;
    global.fetch = vi.fn(async (_url: string, init: any) => {
      calls++;
      const auth = init?.headers?.Authorization || "";
      if (auth.includes("key-a")) {
        return { ok: false, status: 400, text: async () => "active bad request" } as any;
      }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "FALLBACK_OK" } }] }) } as any;
    }) as any;
    const out = await llmComplete([{ role: "user", text: "hi" }], { maxTokens: 100 });
    expect(out).toBe("FALLBACK_OK");
    expect(calls).toBe(2);
  });

  it("llmComplete: нет активного → понятная ошибка", async () => {
    (getActiveProviderConfig as any).mockReturnValue(null);
    (getFallbackProviderConfig as any).mockReturnValue(null);
    await expect(llmComplete([{ role: "user", text: "hi" }])).rejects.toThrow(/активный LLM-провайдер/);
  });

  it("llmComplete: активный ок → fallback не вызывается", async () => {
    (getActiveProviderConfig as any).mockReturnValue(fakeActive);
    (getFallbackProviderConfig as any).mockReturnValue(fakeFallback);
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "ACTIVE_OK" } }] }) } as any;
    }) as any;
    const out = await llmComplete([{ role: "user", text: "hi" }]);
    expect(out).toBe("ACTIVE_OK");
    expect(calls).toBe(1);
  });
});
