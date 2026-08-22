// Абстракция LLM-провайдеров: Yandex (native + OpenAI-compatible) и любые
// OpenAI-compatible (Cloud.ru и др.). Маршрутизация: активный провайдер + fallback.

import { fetchWithRetry, type LlmMessage } from "./http";
import type { ProviderRuntime } from "../settings";
import { getActiveProviderConfig, getFallbackProviderConfig } from "../settings";

export type LlmCompleteOpts = { temperature?: number; maxTokens?: number };

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  complete(messages: LlmMessage[], opts: LlmCompleteOpts): Promise<string>;
}

/** Yandex-эндпоинты используют Api-Key, прочие OpenAI-compatible (Cloud.ru) — Bearer. */
function authHeader(p: ProviderRuntime): string {
  return /yandex/i.test(p.endpoint) ? `Api-Key ${p.apiKey}` : `Bearer ${p.apiKey}`;
}

/** Поле model: для yandex — gpt://FOLDER/MODEL/latest; для Cloud.ru — как есть. */
function modelField(p: ProviderRuntime): string {
  if (p.protocol === "yandex-native") return `gpt://${p.folderId}/${p.model}/latest`;
  return p.folderId ? `gpt://${p.folderId}/${p.model}/latest` : p.model;
}

export class YandexNativeProvider implements LLMProvider {
  constructor(private p: ProviderRuntime) {}
  get id() {
    return this.p.id;
  }
  get name() {
    return this.p.name;
  }
  async complete(messages: LlmMessage[], opts: LlmCompleteOpts): Promise<string> {
    if (!this.p.apiKey) throw new Error(`Провайдер «${this.p.name}»: нет API-ключа.`);
    const body = {
      modelUri: modelField(this.p),
      completionOptions: {
        stream: false,
        temperature: opts.temperature ?? 0.2,
        maxTokens: String(opts.maxTokens ?? 2000),
        reasoningOptions: { mode: "DISABLED" },
      },
      messages,
    };
    const res = await fetchWithRetry(this.p.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader(this.p) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LLM «${this.p.name}» (native) error ${res.status}: ${txt}`);
    }
    const data: any = await res.json();
    const text = data?.result?.alternatives?.[0]?.message?.text;
    if (!text) throw new Error(`LLM «${this.p.name}» (native): пустой ответ`);
    return text as string;
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private p: ProviderRuntime) {}
  get id() {
    return this.p.id;
  }
  get name() {
    return this.p.name;
  }
  async complete(messages: LlmMessage[], opts: LlmCompleteOpts): Promise<string> {
    if (!this.p.apiKey) throw new Error(`Провайдер «${this.p.name}»: нет API-ключа.`);
    const openaiMessages = messages.map((m) => ({ role: m.role, content: m.text }));
    const body = {
      model: modelField(this.p),
      messages: openaiMessages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2000,
    };
    const res = await fetchWithRetry(this.p.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader(this.p) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LLM «${this.p.name}» (openai) error ${res.status}: ${txt}`);
    }
    const data: any = await res.json();
    const choice = data?.choices?.[0]?.message;
    const text: string | null | undefined = choice?.content ?? choice?.reasoning_content;
    if (!text) {
      throw new Error(`LLM «${this.p.name}» (openai): пустой ответ. finish_reason=${data?.choices?.[0]?.finish_reason ?? "?"}`);
    }
    return text as string;
  }
}

export function makeProvider(p: ProviderRuntime): LLMProvider {
  return p.protocol === "yandex-native" ? new YandexNativeProvider(p) : new OpenAICompatibleProvider(p);
}

/** Единая точка LLM-вызова: активный провайдер, при ошибке — fallback. */
export async function llmComplete(messages: LlmMessage[], opts: LlmCompleteOpts = {}): Promise<string> {
  const active = getActiveProviderConfig();
  if (!active) {
    throw new Error("Не настроен активный LLM-провайдер (личный кабинет → Провайдеры).");
  }
  try {
    return await makeProvider(active).complete(messages, opts);
  } catch (err) {
    const fallback = getFallbackProviderConfig();
    if (fallback && fallback.id !== active.id) {
      console.error(
        `LLM active «${active.name}» упал, пробуем fallback «${fallback.name}»:`,
        (err as Error)?.message || err,
      );
      return await makeProvider(fallback).complete(messages, opts);
    }
    throw err;
  }
}
