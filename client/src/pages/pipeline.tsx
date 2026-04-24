import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { PipelineReport } from "@/components/PipelineReport";
import {
  Upload,
  Loader2,
  FileText,
  ShieldAlert,
  Play,
  FileCheck,
  MessageCircle,
  ClipboardList,
  UserCheck,
  RefreshCw,
  ChevronRight,
  FileSearch,
  ExternalLink,
} from "lucide-react";
import type {
  RecruiterForm,
  SearchReason,
  AttitudeToFormer,
  TimePressure,
  References,
  EtkStructured,
  SingleStepReport,
} from "@/lib/types";
import { extractText, extractEtk } from "@/lib/fileExtract";

// ==========================================================
// Слоты ввода
// ==========================================================

type SlotKey = "resume" | "etk" | "interview" | "references";

const SLOTS: { key: SlotKey; title: string; desc: string; icon: any; required: boolean }[] = [
  { key: "resume", title: "Резюме", desc: "PDF / DOCX / TXT. Обязательно.", icon: FileText, required: true },
  { key: "etk", title: "ЭТК / СФР", desc: "XML или PDF. Для верификации опыта.", icon: FileCheck, required: false },
  { key: "interview", title: "Заметки интервью", desc: "TXT / DOCX / PDF. Опционально.", icon: MessageCircle, required: false },
  { key: "references", title: "Рекомендации", desc: "TXT / DOCX / PDF. Опционально.", icon: UserCheck, required: false },
];

// ==========================================================
// Форма рекрутера — опции
// ==========================================================

const REASON_OPTIONS: { value: SearchReason; label: string }[] = [
  { value: "growth", label: "Карьерный рост" },
  { value: "low_salary", label: "Низкая зарплата" },
  { value: "layoff", label: "Сокращение / увольнение" },
  { value: "conflict", label: "Конфликт с руководством" },
  { value: "burnout", label: "Выгорание" },
  { value: "no_growth", label: "Отсутствие роста" },
  { value: "other", label: "Другое / не указано" },
];
const ATTITUDE_OPTIONS: { value: AttitudeToFormer; label: string }[] = [
  { value: "positive", label: "Позитивное" },
  { value: "neutral", label: "Нейтральное" },
  { value: "critical", label: "Критическое" },
  { value: "hostile", label: "Враждебное" },
];
const PRESSURE_OPTIONS: { value: TimePressure; label: string }[] = [
  { value: "no_pressure", label: "Нет прессинга" },
  { value: "has_offer", label: "Есть параллельный оффер" },
  { value: "personal_deadline", label: "Личный дедлайн" },
  { value: "not_specified", label: "Не обсуждалось" },
];
const REF_OPTIONS: { value: References; label: string }[] = [
  { value: "has_ready", label: "Есть готовые контакты" },
  { value: "has_not_ready", label: "Есть, но контакты не предоставлены" },
  { value: "none", label: "Нет рекомендателей" },
  { value: "not_discussed", label: "Не обсуждалось" },
];

// ==========================================================
// Компонент
// ==========================================================

type SlotState = {
  file: File | null;
  text: string;
  fileName: string | null;
  loading: boolean;
  error: string | null;
};

function emptySlot(): SlotState {
  return { file: null, text: "", fileName: null, loading: false, error: null };
}

// Читаем ?fromCheck=XXX из hash-строки (wouter с useHashLocation отбрасывает query за путём)
function readFromCheckParam(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash || "";
  // h примерно вида "#/pipeline?fromCheck=abc"
  const q = h.indexOf("?");
  if (q < 0) return null;
  const sp = new URLSearchParams(h.slice(q + 1));
  const v = sp.get("fromCheck");
  return v && v.trim() ? v.trim() : null;
}

export default function PipelinePage() {
  const { toast } = useToast();
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>({
    resume: emptySlot(),
    etk: emptySlot(),
    interview: emptySlot(),
    references: emptySlot(),
  });
  const [etkStructured, setEtkStructured] = useState<EtkStructured>({ records: [], source: "none" });

  const [form, setForm] = useState<RecruiterForm>({
    searchReason: "growth",
    attitudeToFormer: "neutral",
    timePressure: "no_pressure",
    references: "not_discussed",
    note: "",
  });

  const [report, setReport] = useState<SingleStepReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [savedPipelineId, setSavedPipelineId] = useState<string | null>(null);
  const [parentCheckId, setParentCheckId] = useState<string | null>(() => readFromCheckParam());
  const [progress, setProgress] = useState<{
    verification: "idle" | "running" | "done";
    motivation: "idle" | "running" | "done";
    culturalFit: "idle" | "running" | "done";
    loyalty: "idle" | "running" | "done";
  }>({ verification: "idle", motivation: "idle", culturalFit: "idle", loyalty: "idle" });

  // Предзаполнение резюме из исходной проверки, если пришли с ?fromCheck=
  const parentQuery = useQuery<{
    id: string;
    candidateName: string | null;
    resumeText: string;
  }>({
    queryKey: ["/api/checks", parentCheckId],
    enabled: Boolean(parentCheckId),
  });

  // v3.3: запуск пайплайна без базовой проверки запрещён на уровне бэкенда (POST /api/pipeline/analyze вернёт 400).
  // На фронте НЕ редиректим, иначе при hash-навигации с ?fromCheck=... есть гонка инициализации
  // и страница мгновенно уходит на главную. Вместо редиректа — показываем предупреждение и прячем кнопку запуска.
  // Повторная попытка прочитать hash, если первый рендер произошёл раньше, чем wouter обновил location.
  useEffect(() => {
    if (parentCheckId) return;
    const v = readFromCheckParam();
    if (v) setParentCheckId(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (parentQuery.data && slots.resume.text.trim().length === 0) {
      setSlots((s) => ({
        ...s,
        resume: {
          ...s.resume,
          text: parentQuery.data!.resumeText,
          fileName: parentQuery.data!.candidateName
            ? `Резюме · ${parentQuery.data!.candidateName}`
            : `Резюме из проверки №${parentQuery.data!.id}`,
          loading: false,
          error: null,
        },
      }));
      toast({
        title: "Резюме загружено из предыдущей проверки",
        description: `№${parentQuery.data!.id} — можно сразу запускать пайплайн`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentQuery.data]);

  const fileInputs = {
    resume: useRef<HTMLInputElement>(null),
    etk: useRef<HTMLInputElement>(null),
    interview: useRef<HTMLInputElement>(null),
    references: useRef<HTMLInputElement>(null),
  };

  const patchSlot = (k: SlotKey, p: Partial<SlotState>) =>
    setSlots((s) => ({ ...s, [k]: { ...s[k], ...p } }));

  const handleFile = async (k: SlotKey, f: File) => {
    patchSlot(k, { loading: true, error: null, file: f, fileName: f.name });
    try {
      if (k === "etk") {
        const r = await extractEtk(f);
        patchSlot(k, { text: r.text, fileName: r.fileName, loading: false });
        setEtkStructured(r.etk);
        toast({
          title: "ЭТК загружена",
          description:
            r.etk.source === "xml"
              ? `Структурировано записей: ${r.etk.records.length}`
              : "Передана как текст — LLM сопоставит",
        });
      } else {
        const r = await extractText(f);
        patchSlot(k, { text: r.text, fileName: r.fileName, loading: false });
        toast({ title: "Файл обработан", description: r.fileName });
      }
    } catch (e: any) {
      const msg = (e?.message || "Ошибка").replace(/^\d+:\s*/, "").slice(0, 240);
      patchSlot(k, { loading: false, error: msg });
      toast({ title: "Не удалось обработать файл", description: msg, variant: "destructive" });
    }
  };

  const runMut = useMutation({
    mutationFn: async () => {
      // Включаем «прогресс» — последовательно помечаем модули как running/done
      setProgress({ verification: "running", motivation: "running", culturalFit: "running", loyalty: "running" });
      const res = await apiRequest("POST", "/api/pipeline/analyze", {
        resumeText: slots.resume.text,
        etk: etkStructured,
        interviewText: slots.interview.text,
        referencesText: slots.references.text,
        form,
        parentCheckId: parentCheckId || undefined,
      });
      return res.json() as Promise<{ id: string; report: SingleStepReport }>;
    },
    onSuccess: (d) => {
      setReport(d.report);
      setReportId(d.id);
      setSavedPipelineId(d.id);
      setProgress({ verification: "done", motivation: "done", culturalFit: "done", loyalty: "done" });
      toast({ title: "Пайплайн завершён", description: `Итог: ${d.report.resolution.label}` });
      // Прокрутка к отчёту
      setTimeout(() => {
        document.getElementById("pipeline-report")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    },
    onError: (e: any) => {
      setProgress({ verification: "idle", motivation: "idle", culturalFit: "idle", loyalty: "idle" });
      toast({
        title: "Ошибка пайплайна",
        description: (e?.message || "").replace(/^\d+:\s*/, "").slice(0, 240),
        variant: "destructive",
      });
    },
  });

  const recomputeMut = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("Нет текущего отчёта");
      const res = await apiRequest("POST", `/api/pipeline/${reportId}/recompute`, {
        form,
        etk: etkStructured,
        interviewText: slots.interview.text,
        referencesText: slots.references.text,
      });
      return res.json() as Promise<{ id: string; report: SingleStepReport }>;
    },
    onSuccess: (d) => {
      setReport(d.report);
      setReportId(d.id);
      setSavedPipelineId(d.id);
      toast({ title: "Пересчёт выполнен", description: `Новая резолюция: ${d.report.resolution.label}` });
    },
    onError: (e: any) => {
      toast({
        title: "Ошибка пересчёта",
        description: (e?.message || "").replace(/^\d+:\s*/, "").slice(0, 240),
        variant: "destructive",
      });
    },
  });

  const running = runMut.isPending || recomputeMut.isPending;
  const tooShort = slots.resume.text.trim().length < 100;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* v3.3: Пайплайн доступен только из базовой проверки */}
        {!parentCheckId && (
          <Card
            className="mb-4 border-amber-500/40 bg-amber-500/[0.06] p-4 text-sm"
            data-testid="card-no-parent-warning"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <div className="space-y-2">
                <div className="font-semibold text-amber-200">
                  Пайплайн недоступен без базовой проверки
                </div>
                <div className="text-muted-foreground">
                  Полный AI-скрининг запускается только из карточки уже проведённой базовой проверки.
                  Откройте репорт проверки и на вкладке «Пайплайн» нажмите «Провести полный пайплайн».
                </div>
                <Link href="/">
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    data-testid="link-go-home"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Перейти на главную и запустить базовую проверку
                  </a>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Связь с исходной проверкой */}
        {parentCheckId && (
          <Card
            className="mb-4 border-primary/30 bg-primary/[0.04] p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
            data-testid="card-parent-check-banner"
          >
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-primary" />
              <span className="font-mono uppercase tracking-widest text-[10px] text-primary">
                Исходная обычная проверка
              </span>
              <span className="font-mono">№{parentCheckId}</span>
              {parentQuery.data?.candidateName && (
                <span className="text-muted-foreground">· {parentQuery.data.candidateName}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/report/${parentCheckId}`}>
                <a
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  data-testid="link-back-to-check"
                >
                  <ExternalLink className="h-3 w-3" />
                  Открыть карточку
                </a>
              </Link>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setParentCheckId(null)}
                data-testid="button-unlink-parent"
              >
                отвязать
              </button>
            </div>
          </Card>
        )}

        {/* Hero */}
        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            <ShieldAlert className="h-3 w-3" />
            Единый пайплайн · Single-Step v3.0
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Полный AI-скрининг кандидата за один проход
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Один экран, один клик — финальная резолюция. Четыре модуля (верификация опыта, мотивация, Cultural Fit, лояльность и стабильность) анализируются параллельно, результат сводится в Composite Score и матрицу из пяти решений.
          </p>
        </div>

        {/* Слоты файлов */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SLOTS.map((s) => {
            const state = slots[s.key];
            const Icon = s.icon;
            return (
              <Card
                key={s.key}
                className={`border-card-border bg-card p-4 ${
                  state.fileName ? "border-primary/50" : ""
                }`}
                data-testid={`slot-${s.key}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="text-sm font-semibold">{s.title}</div>
                  </div>
                  {s.required && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-red-400">
                      обязат.
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.desc}</p>

                <input
                  ref={fileInputs[s.key]}
                  type="file"
                  accept={s.key === "etk" ? ".xml,.pdf,.docx,.txt" : ".pdf,.docx,.txt"}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(s.key, f);
                  }}
                  data-testid={`input-file-${s.key}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => fileInputs[s.key].current?.click()}
                  disabled={state.loading || running}
                  data-testid={`button-upload-${s.key}`}
                >
                  {state.loading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-3.5 w-3.5" />
                  )}
                  {state.fileName ? "Заменить файл" : "Загрузить"}
                </Button>

                {state.fileName && (
                  <div className="mt-2 truncate rounded-md border border-card-border bg-background/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {state.fileName} · {state.text.length.toLocaleString("ru-RU")} симв.
                  </div>
                )}
                {s.key === "etk" && etkStructured.source === "xml" && etkStructured.records.length > 0 && (
                  <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-300">
                    ✓ Структурировано: {etkStructured.records.length} записей
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Текст резюме (можно без файла) */}
        <Card className="mt-5 border-card-border bg-card p-5">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Резюме (текст) — можно вставить вручную
          </Label>
          <Textarea
            className="mt-2 min-h-[160px] resize-y font-mono text-xs"
            value={slots.resume.text}
            onChange={(e) => patchSlot("resume", { text: e.target.value })}
            placeholder="Если не загружали файл — вставьте текст резюме сюда. Минимум 100 символов."
            data-testid="textarea-resume"
            disabled={running}
          />
        </Card>

        {/* Форма рекрутера */}
        <Card className="mt-5 border-card-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <div className="font-semibold">Форма рекрутера</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSelect
              label="Причина поиска работы"
              value={form.searchReason}
              onChange={(v) => setForm({ ...form, searchReason: v as SearchReason })}
              options={REASON_OPTIONS}
              testId="select-reason"
            />
            <FieldSelect
              label="Отношение к бывшим работодателям"
              value={form.attitudeToFormer}
              onChange={(v) => setForm({ ...form, attitudeToFormer: v as AttitudeToFormer })}
              options={ATTITUDE_OPTIONS}
              testId="select-attitude"
            />
            <FieldSelect
              label="Временной прессинг"
              value={form.timePressure}
              onChange={(v) => setForm({ ...form, timePressure: v as TimePressure })}
              options={PRESSURE_OPTIONS}
              testId="select-pressure"
            />
            <FieldSelect
              label="Рекомендатели"
              value={form.references}
              onChange={(v) => setForm({ ...form, references: v as References })}
              options={REF_OPTIONS}
              testId="select-references"
            />
          </div>
          <div className="mt-4">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Заметка рекрутера (до 300 симв.)
            </Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 300) })}
              placeholder="Свободные наблюдения: общее впечатление, сомнения, яркие цитаты кандидата…"
              className="mt-2 min-h-[80px] resize-y text-sm"
              data-testid="textarea-note"
              disabled={running}
              maxLength={300}
            />
            <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
              {form.note.length}/300
            </div>
          </div>
        </Card>

        {/* Запуск + прогресс */}
        <Card className="mt-5 border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Запуск пайплайна
              </div>
              <div className="mt-0.5 text-sm">
                {tooShort
                  ? `Загрузите/вставьте резюме (мин. 100 симв., сейчас ${slots.resume.text.trim().length})`
                  : "Всё готово. Нажмите «Запустить пайплайн»."}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {reportId && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => recomputeMut.mutate()}
                  disabled={running}
                  data-testid="button-recompute"
                >
                  {recomputeMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Пересчитать
                </Button>
              )}
              <Button
                size="lg"
                onClick={() => runMut.mutate()}
                disabled={running || tooShort || !parentCheckId}
                data-testid="button-run-pipeline"
              >
                {runMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Анализ…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Запустить пайплайн
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Прогресс 4 модулей */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "verification", label: "Верификация опыта" },
              { key: "motivation", label: "Мотивация" },
              { key: "culturalFit", label: "Cultural Fit" },
              { key: "loyalty", label: "Лояльность (ILS)" },
            ].map((m) => {
              const st = progress[m.key as keyof typeof progress];
              return (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-card-border bg-background/60 px-3 py-2 text-xs"
                  data-testid={`progress-${m.key}`}
                >
                  <div>{m.label}</div>
                  <div className="shrink-0">
                    {st === "idle" && <span className="text-muted-foreground">⬜</span>}
                    {st === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {st === "done" && <span className="text-emerald-400">✅</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Отчёт */}
        {report && (
          <div id="pipeline-report" className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Результат пайплайна
                {savedPipelineId && <span className="normal-case tracking-normal">· отчёт №{savedPipelineId}</span>}
              </div>
              {savedPipelineId && (
                <Link href={`/pipeline-report/${savedPipelineId}`}>
                  <a
                    className="inline-flex items-center gap-1 normal-case tracking-normal text-primary hover:underline"
                    data-testid="link-open-saved-pipeline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Открыть сохранённый отчёт
                  </a>
                </Link>
              )}
            </div>
            <PipelineReport report={report} />
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================================
// Вспомогательный Field
// ==========================================================

function FieldSelect({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testId: string;
}) {
  return (
    <div>
      <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
