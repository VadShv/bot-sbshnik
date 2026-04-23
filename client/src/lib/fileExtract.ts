import { XMLParser } from "fast-xml-parser";
import { apiRequestForm } from "./queryClient";
import type { EtkRecord, EtkStructured } from "./types";

/** Тип извлечённого артефакта */
export type ExtractKind = "resume" | "etk" | "interview" | "references";

export type ExtractResult = {
  fileName: string;
  text: string;
  // Для ЭТК — дополнительные структурированные записи
  etk?: EtkStructured;
};

// ==========================================================
// Универсальный экстрактор текста
// ==========================================================

export async function extractText(file: File): Promise<{ text: string; fileName: string }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".xml")) {
    const text = await file.text();
    return { text, fileName: file.name };
  }
  // PDF / DOCX — отправляем на сервер (там pdf-parse + mammoth)
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiRequestForm("/api/extract", fd);
  const data = await res.json();
  return { text: data.text as string, fileName: data.fileName as string };
}

// ==========================================================
// ЭТК — XML-маппинг (форма СЗВ-ТД / ЭТК СФР)
// ==========================================================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  removeNSPrefix: true,
});

function collect(obj: any, keys: string[]): any[] {
  // Рекурсивно находит все значения по списку тегов (напр. "СвТД" в ЭТК СФР)
  const out: any[] = [];
  const visit = (node: any) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (typeof node !== "object") return;
    for (const k of Object.keys(node)) {
      if (keys.includes(k)) {
        const v = node[k];
        if (Array.isArray(v)) out.push(...v);
        else out.push(v);
      } else {
        visit(node[k]);
      }
    }
  };
  visit(obj);
  return out;
}

function firstString(...vals: any[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function normalizeDate(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  // "2023-05-15", "15.05.2023", "2023-05", "15.05.2023 00:00:00"
  const m1 = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m1) return m1[3] ? `${m1[1]}-${m1[2]}-${m1[3]}` : `${m1[1]}-${m1[2]}`;
  const m2 = t.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return t.slice(0, 20);
}

/**
 * Маппинг ЭТК XML → EtkRecord[]
 * Поддерживает популярные структуры: СЗВ-ТД / ЭТК СФР, а также любые вложенные
 * объекты с полями типа «Работодатель/Организация», «Должность», «ДатаПриема» и т.д.
 */
export function parseEtkXml(xml: string): EtkStructured {
  let root: any;
  try {
    root = xmlParser.parse(xml);
  } catch {
    return { records: [], source: "text", note: "Не удалось распарсить XML — файл передан как текст." };
  }

  // Частые контейнеры записей по форматам ПФР/СФР
  const itemKeys = [
    "СвТД",               // СЗВ-ТД — сведения о трудовой деятельности
    "СведТрудДеят",
    "СведТД",
    "МероприятиеТД",
    "Мероприятие",
    "Запись",
    "РабМесто",
    "Работа",
    "JobRecord",
    "WorkPlace",
  ];

  let items = collect(root, itemKeys);
  if (!items.length) {
    // fallback: если корневой элемент сам — массив записей
    const topKeys = Object.keys(root || {});
    for (const k of topKeys) {
      const v = root[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "object") {
        items = v;
        break;
      }
    }
  }

  const records: EtkRecord[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const company = firstString(
      raw["НаимРаб"], raw["НаимОрг"], raw["Организация"],
      raw["Работодатель"], raw["Компания"], raw["Employer"], raw["Company"],
      raw["@_НаимРаб"], raw["@_Организация"],
    );
    if (!company) continue;
    const position = firstString(
      raw["НаимДолж"], raw["Должность"], raw["НаимПроф"], raw["Профессия"],
      raw["Position"], raw["@_НаимДолж"],
    );
    const startDate = normalizeDate(firstString(
      raw["ДатаПриема"], raw["ДатаНачала"], raw["ДатаМероприятия"], raw["НачалоПериода"],
      raw["Date"], raw["StartDate"],
    ));
    const endRaw = firstString(
      raw["ДатаУвольнения"], raw["ДатаОкончания"], raw["ОкончаниеПериода"],
      raw["EndDate"],
    );
    const endDate = endRaw ? normalizeDate(endRaw) ?? null : null;
    const reason = firstString(
      raw["ОснованиеПрекращения"], raw["ПричинаУвольнения"], raw["Основание"],
      raw["Reason"],
    );
    const inn = firstString(raw["ИНН"], raw["INN"], raw["@_ИНН"]);
    records.push({ company, position, startDate, endDate, reason, inn });
  }

  // Если структурированных записей не нашли — отдаём просто текст
  if (records.length === 0) {
    return {
      records: [],
      source: "text",
      note: "XML распарсен, но типовые теги ЭТК/СЗВ-ТД не распознаны — анализ проведён по сырому тексту.",
    };
  }
  // Сортируем по startDate по убыванию
  records.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  return { records, source: "xml" };
}

// ==========================================================
// Обёртка «обработать файл ЭТК»
// ==========================================================

export async function extractEtk(file: File): Promise<{ text: string; fileName: string; etk: EtkStructured }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xml")) {
    const text = await file.text();
    const etk = parseEtkXml(text);
    return { text, fileName: file.name, etk };
  }
  // txt/pdf/docx — извлекаем текст, ЭТК остаётся текстовой
  const ext = await extractText(file);
  return {
    text: ext.text,
    fileName: ext.fileName,
    etk: {
      records: [],
      source: "text",
      note: "ЭТК передана как текст — структурированное сопоставление будет сделано LLM.",
    },
  };
}

// ==========================================================
// Извлечение имени кандидата (локально, без ПДн в отчёте)
// ==========================================================

export function extractCandidateName(text: string): string | null {
  const lines = text.split(/\r?\n/).slice(0, 10);
  for (const line of lines) {
    const m = line.match(/^\s*([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)\s*$/);
    if (m) return m[1];
  }
  return null;
}
