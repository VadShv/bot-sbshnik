// ============================================================
// AI Detector v1.0
// ============================================================
// Один LLM-вызов, который оценивает вероятность того, что резюме
// написано/обработано языковой моделью. Выдаёт:
//   - aiScore 0..100 (100 = точно ИИ)
//   - verdict: human_written | lightly_edited | heavily_edited | ai_generated
//   - markers: список наблюдаемых машинных маркеров с описанием
//
// Используется как «привратник» лингвистического слоя в базовой проверке:
// если aiScore >= threshold, запускается углублённый лингвистический аудит.

import { yandexComplete } from "./yandex";
import type {
  AIDetectorReport,
  AIDetectorVerdict,
  AIDetectorMarker,
} from "@shared/schema";

const SYSTEM_PROMPT = `Ты — эксперт по обнаружению машинно-сгенерированного текста на русском языке.
Твоя задача — определить, написано ли резюме кандидата человеком самостоятельно
или обработано/сгенерировано языковой моделью (ChatGPT, YandexGPT, GigaChat и т. п.).

ОЦЕНИВАЙ ПО СЛЕДУЮЩИМ МАРКЕРАМ МАШИННОГО ТЕКСТА:
1. cliche — типовые LLM-клише ("оптимизировал процессы", "возглавил инициативу",
   "достиг измеримых результатов", "комплексный подход", "стратегическое видение").
2. symmetry — идеальные параллельные конструкции, симметричные списки достижений,
   одинаковая длина пунктов, одинаковые глагольные формы в начале.
3. smoothness — неестественно "гладкий" слог: ровная длина предложений, отсутствие
   разговорных вставок, низкая burstiness (нет вариативности сложности фраз).
4. vocabulary — лексика, характерная для GPT-моделей: канцелярит, абстрактные
   существительные, обилие отглагольных существительных без конкретики.
5. structure — излишне формальная, энциклопедичная структура: правильные заголовки,
   симметричные блоки, подозрительная "идеальность" оформления текста.
6. hedging — хеджинг-обороты LLM ("важно отметить", "следует подчеркнуть",
   "стоит выделить", "необходимо учитывать").

ПРИЗНАКИ ЧЕЛОВЕЧЕСКОГО ТЕКСТА:
- разная длина предложений и пунктов;
- разговорные вставки, аббревиатуры, опечатки, нестандартное оформление;
- конкретные цифры, имена систем, особенности компании, мелкие детали;
- эмоциональная окраска, личные оценки;
- неровный стиль между разделами (резюме обычно дописывается урывками).

ВЕРДИКТЫ:
- human_written — aiScore 0..29: резюме написано человеком, машинной обработки нет;
- lightly_edited — aiScore 30..59: лёгкая машинная чистка/перевод/редактура;
- heavily_edited — aiScore 60..84: значительная переработка LLM или
  по существенной части текста явно работала модель;
- ai_generated — aiScore 85..100: текст практически целиком сгенерирован ИИ.

ВАЖНО:
- Шаблонные резюме сами по себе НЕ означают AI-генерацию. Многие люди пишут шаблонно.
- Машинной обработке свидетельствует именно СОВОКУПНОСТЬ маркеров.
- Если данных мало (короткое резюме), снижай confidence и не давай высокий aiScore.
- Markers выдавай ТОЛЬКО если действительно нашёл их в тексте.

ФОРМАТ ОТВЕТА — строгий JSON:
{
  "aiScore": number 0..100,
  "verdict": "human_written" | "lightly_edited" | "heavily_edited" | "ai_generated",
  "confidence": number 0..100,
  "summary": "одна-две фразы по-русски с обоснованием вердикта",
  "markers": [
    {
      "type": "cliche" | "symmetry" | "smoothness" | "vocabulary" | "structure" | "hedging" | "other",
      "description": "короткое описание маркера",
      "example": "цитата из резюме (опционально, до 200 символов)"
    }
  ]
}
Возвращай ТОЛЬКО JSON, без обрамляющих markdown-блоков и без комментариев.
`;

const ALLOWED_VERDICTS: AIDetectorVerdict[] = [
  "human_written",
  "lightly_edited",
  "heavily_edited",
  "ai_generated",
];
const ALLOWED_MARKER_TYPES: AIDetectorMarker["type"][] = [
  "cliche",
  "symmetry",
  "smoothness",
  "vocabulary",
  "structure",
  "hedging",
  "other",
];

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function safeParseJson(raw: string): any {
  // Срезаем возможные ```json ... ``` обёртки
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  // На случай, если модель добавила пояснения после JSON — берём первый объект
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(s);
}

function deriveVerdictFromScore(score: number): AIDetectorVerdict {
  if (score >= 85) return "ai_generated";
  if (score >= 60) return "heavily_edited";
  if (score >= 30) return "lightly_edited";
  return "human_written";
}

function normalizeMarker(raw: any): AIDetectorMarker | null {
  if (!raw || typeof raw !== "object") return null;
  const type = ALLOWED_MARKER_TYPES.includes(raw.type) ? raw.type : "other";
  const description = String(raw.description ?? "").trim().slice(0, 280);
  if (!description) return null;
  const exampleRaw = raw.example ? String(raw.example).trim().slice(0, 240) : "";
  return {
    type,
    description,
    example: exampleRaw || undefined,
  };
}

/**
 * Эвристический фолбэк, если LLM недоступен или вернул мусор.
 * Дает консервативный результат — «человек, низкая уверенность».
 */
function heuristicFallback(reason: string): AIDetectorReport {
  return {
    version: "1.0",
    aiScore: 0,
    verdict: "human_written",
    confidence: 30,
    summary: `Автоматический детектор недоступен (${reason}). Применён нейтральный вердикт: машинная обработка не подтверждена.`,
    markers: [],
    triggeredLinguistic: false,
    threshold: 60,
  };
}

export const AI_DETECTOR_DEFAULT_THRESHOLD = 60;

/**
 * Главный вход. Возвращает AIDetectorReport. Никогда не бросает исключений —
 * при ошибке LLM возвращает консервативный фолбэк.
 */
export async function runAiDetector(
  resumeText: string,
  threshold: number = AI_DETECTOR_DEFAULT_THRESHOLD,
): Promise<AIDetectorReport> {
  const text = (resumeText ?? "").trim();
  if (text.length < 80) {
    return {
      version: "1.0",
      aiScore: 0,
      verdict: "human_written",
      confidence: 20,
      summary: "Текст слишком короткий для надёжной оценки на машинную обработку.",
      markers: [],
      triggeredLinguistic: false,
      threshold,
    };
  }

  // Урезаем сэмпл до разумного объёма (экономим токены)
  const sample = text.slice(0, 12000);

  let raw: string;
  try {
    raw = await yandexComplete(
      [
        { role: "system", text: SYSTEM_PROMPT },
        {
          role: "user",
          text: `Ниже текст резюме кандидата. Проанализируй и верни JSON по описанной схеме.\n\n=== РЕЗЮМЕ ===\n${sample}\n=== /РЕЗЮМЕ ===`,
        },
      ],
      { temperature: 0.2, maxTokens: 1200 },
    );
  } catch (e: any) {
    console.error("[aiDetector] LLM error:", e?.message || e);
    return heuristicFallback("ошибка обращения к языковой модели");
  }

  let parsed: any;
  try {
    parsed = safeParseJson(raw);
  } catch (e: any) {
    console.error("[aiDetector] JSON parse error:", e?.message || e, "\nraw=", raw?.slice(0, 400));
    return heuristicFallback("не удалось разобрать ответ модели");
  }

  const aiScore = clamp(Number(parsed?.aiScore ?? 0), 0, 100);
  const confidence = clamp(Number(parsed?.confidence ?? 50), 0, 100);

  let verdict: AIDetectorVerdict =
    ALLOWED_VERDICTS.includes(parsed?.verdict)
      ? parsed.verdict
      : deriveVerdictFromScore(aiScore);

  // Гарантируем согласованность score↔verdict
  const expected = deriveVerdictFromScore(aiScore);
  if (verdict !== expected) {
    // Если расхождение существенное — выравниваем
    const diff = Math.abs(
      ALLOWED_VERDICTS.indexOf(verdict) - ALLOWED_VERDICTS.indexOf(expected),
    );
    if (diff >= 2) verdict = expected;
  }

  const summary =
    typeof parsed?.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 500)
      : `Оценка машинной обработки: ${aiScore}/100 (${verdict}).`;

  const markersRaw = Array.isArray(parsed?.markers) ? parsed.markers : [];
  const markers: AIDetectorMarker[] = markersRaw
    .map(normalizeMarker)
    .filter((m: AIDetectorMarker | null): m is AIDetectorMarker => m !== null)
    .slice(0, 8);

  return {
    version: "1.0",
    aiScore,
    verdict,
    confidence,
    summary,
    markers,
    triggeredLinguistic: false, // выставится позже, если запустим лингвистику
    threshold,
  };
}
