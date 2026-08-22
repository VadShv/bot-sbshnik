import { listPromptVersions, savePromptVersion } from "./settings";
import type { PromptKey } from "@shared/schema";
import { DEFAULT_ANALYZE_SYSTEM_PROMPT } from "./yandex";
import { WOLF_SYSTEM_PROMPT } from "./wolfDetector";
import { FIT_GUARD_SYSTEM_PROMPT } from "./fitGuard";
import { DEFAULT_AIDETECTOR_SYSTEM_PROMPT } from "./aiDetector";
import { DEFAULT_DEEPSCAN_SYSTEM_PROMPT } from "./githubDeepScan";
import { DEFAULT_PIPELINE_SYSTEM_PROMPT } from "./pipelineAnalyzer";

const DEFAULTS: Record<PromptKey, string> = {
  analyze_system: DEFAULT_ANALYZE_SYSTEM_PROMPT,
  wolf_system: WOLF_SYSTEM_PROMPT,
  fitguard_system: FIT_GUARD_SYSTEM_PROMPT,
  aidetector_system: DEFAULT_AIDETECTOR_SYSTEM_PROMPT,
  deepscan_system: DEFAULT_DEEPSCAN_SYSTEM_PROMPT,
  pipeline_system: DEFAULT_PIPELINE_SYSTEM_PROMPT,
  chat_system: "", // chat-дефолт живёт в routes.ts (DEFAULT_CHAT_SYSTEM_PROMPT); здесь не сидируется
};

/** Сидирует промпты значениями по умолчанию из кода, если для ключа ещё нет ни одной версии. */
export function seedPromptsIfEmpty(): void {
  for (const key of Object.keys(DEFAULTS) as PromptKey[]) {
    const content = DEFAULTS[key];
    if (!content) continue;
    const existing = listPromptVersions(key);
    if (existing.length === 0) {
      savePromptVersion(key, content);
    }
  }
}
