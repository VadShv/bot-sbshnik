import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, apiRequestForm } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import {
  Upload,
  ShieldAlert,
  Loader2,
  FileText,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import type { FullReport } from "@/lib/types";

export default function Home() {
  const [, navigate] = useLocation();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const extractMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiRequestForm("/api/extract", fd);
      return res.json() as Promise<{ text: string; fileName: string }>;
    },
    onSuccess: (d) => {
      setText(d.text);
      setFileName(d.fileName);
      toast({ title: "Текст извлечён", description: `Файл: ${d.fileName}` });
    },
    onError: (e: any) => {
      toast({
        title: "Не удалось извлечь текст",
        description: (e.message || "").replace(/^\d+:\s*/, "").slice(0, 200),
        variant: "destructive",
      });
    },
  });

  const analyzeMut = useMutation({
    mutationFn: async (resumeText: string) => {
      const res = await apiRequest("POST", "/api/analyze", { text: resumeText });
      return res.json() as Promise<{ id: string; report: FullReport }>;
    },
    onSuccess: (d) => {
      navigate(`/report/${d.id}`);
    },
    onError: (e: any) => {
      toast({
        title: "Ошибка анализа",
        description: (e.message || "").replace(/^\d+:\s*/, "").slice(0, 200),
        variant: "destructive",
      });
    },
  });

  const loading = extractMut.isPending || analyzeMut.isPending;
  const tooShort = text.trim().length < 100;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Мягкие декоративные blobs на фоне — создают ощущение глубины и «дыхания» */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
      >
        <div className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-orange-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Header />

      <main className="relative mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <section className="mb-8 animate-in fade-in duration-500">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)] transition-all duration-300 hover:bg-primary/15">
            <ShieldAlert className="h-3 w-3" />
            Проверка без ПДн · Yandex GPT
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Жёсткая проверка резюме — без персональных данных
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Сервис анализирует риски, накрутку опыта и принадлежность сообществу «волков»,
            <strong className="font-semibold text-foreground"> не используя ФИО, паспорт,
            точный телефон и полный email</strong>. В модель уходит только обезличенный текст
            резюме. При этом сохраняются <strong className="font-semibold text-foreground">косвенные
            маркеры контактов</strong> — домен почты (gmail.com, yandex.ru, корпоративный), префикс
            мобильного (+7 9XX), город, ссылки на соцсети — они остаются для оценки риска.
          </p>
        </section>

        {/* ────────── Баннер «Без ПДн» — компактно, свёрнут по умолчанию ────────── */}
        <Accordion type="single" collapsible className="mb-4">
          <AccordionItem
            value="pdn"
            className="rounded-xl border border-primary/30 bg-primary/5 px-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-primary/[0.07]"
          >
            <AccordionTrigger
              data-testid="trigger-pdn"
              className="py-3 hover:no-underline"
            >
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                <ShieldAlert className="h-3 w-3" />
                <span>🛡️ Принцип работы · Анализ без персональных данных</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                    🙈 Не используется в анализе
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• ФИО, точная дата рождения</li>
                    <li>• Паспорт, СНИЛС, ИНН</li>
                    <li>• Полный номер телефона</li>
                    <li>• Локальная часть email (ivan.sidorov@…)</li>
                    <li>• Точный адрес проживания</li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    🔍 Используется как косвенные маркеры
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• Возраст в годах (без точной ДР) — соотношение с грейдом и стажем</li>
                    <li>• Домен почты (gmail.com / корпоративный / одноразовый)</li>
                    <li>• Префикс мобильного (+7 9XX — оператор / регион)</li>
                    <li>• Город / регион (без улицы и дома)</li>
                    <li>• Домены соцсетей и мессенджеров (t.me, vk.com)</li>
                    <li>• Домены работодателей и учебных заведений</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* ═════════════ ОСНОВНОЕ ОКНО ЗАПУСКА ПРОВЕРКИ ═════════════ */}
        <Card className="relative rounded-2xl border-card-border bg-card/95 p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_14px_50px_-18px_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Вход: текст резюме
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) extractMut.mutate(f);
                }}
                data-testid="input-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
                disabled={loading}
                data-testid="button-upload"
                className="transition-all duration-200 hover:border-primary/60 hover:bg-primary/5"
              >
                {extractMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Загрузить PDF / DOCX
              </Button>
            </div>
          </div>

          {fileName && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300">
              <FileText className="h-3.5 w-3.5" />
              <span className="font-mono">{fileName}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                {text.length.toLocaleString("ru-RU")} симв.
              </span>
            </div>
          )}

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставьте текст резюме сюда или загрузите файл (PDF / DOCX / TXT).&#10;Минимум 100 символов."
            className="min-h-[280px] resize-y rounded-xl font-mono text-xs transition-shadow duration-200 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
            data-testid="textarea-resume"
            disabled={loading}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {tooShort
                ? `Нужно минимум 100 симв. (сейчас ${text.trim().length})`
                : `Готово к анализу: ${text.trim().length.toLocaleString("ru-RU")} симв.`}
            </div>
            <Button
              size="lg"
              disabled={loading || tooShort}
              onClick={() => analyzeMut.mutate(text)}
              data-testid="button-analyze"
              className="transition-all duration-200 hover:shadow-[0_8px_24px_-10px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5 active:translate-y-0"
            >
              {analyzeMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Анализ Yandex GPT...
                </>
              ) : (
                <>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Запустить проверку
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* ────────── v3.3 Подсказка про пайплайн ────────── */}
        <div
          data-testid="cta-pipeline-hint"
          className="mt-6 block rounded-xl border border-border bg-muted/20 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-muted/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                🎯 Single-Step v3.3 · Единый пайплайн
              </div>
              <div className="text-sm font-semibold">
                Пайплайн запускается только из готовой базовой проверки
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Сделайте обычную проверку резюме выше → откройте отчёт → вкладка «Пайплайн».
                Там же доступна 3-я вкладка «ИИ-ассистент» — задавайте вопросы в контексте отчётов.
              </p>
            </div>
          </div>
        </div>

        {/* ════════ НИЖНИЕ БЛОКИ: категории сигналов ════════ */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              🎪 Матрица сигналов · на что смотрит детектив
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <Accordion type="multiple" className="space-y-3">
            {SIGNAL_SECTIONS.map((section) => (
              <AccordionItem
                key={section.title}
                value={section.title}
                className={`rounded-xl border ${section.accentClass} bg-card/90 px-4 backdrop-blur-sm transition-all duration-300 hover:bg-card data-[state=open]:shadow-[0_8px_30px_-15px_rgba(0,0,0,0.5)]`}
              >
                <AccordionTrigger
                  data-testid={`trigger-section-${section.title}`}
                  className={`py-3 hover:no-underline ${section.chevronClass ? `[&>svg]:${section.chevronClass}` : ""}`}
                >
                  <div className="flex w-full items-center justify-between gap-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base transition-transform duration-300 group-hover:scale-110" aria-hidden>{section.emoji}</span>
                      <section.Icon className={`h-4 w-4 ${section.iconClass}`} />
                      <div className="text-sm font-semibold text-foreground">{section.title}</div>
                    </div>
                    <div
                      className={`font-mono text-[10px] uppercase tracking-widest ${section.weightClass}`}
                    >
                      вес {section.weight}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li
                        key={item.title}
                        className="flex items-start gap-2.5 rounded-lg border border-card-border bg-background/40 px-3 py-2 transition-all duration-200 hover:border-card-border/80 hover:bg-background/60 hover:-translate-y-px"
                        data-testid={`signal-${item.title}`}
                      >
                        <span className="mt-0.5 text-base leading-none" aria-hidden>
                          {item.emoji}
                        </span>
                        <div className="flex-1 text-xs">
                          <span className="font-semibold text-foreground">{item.title}</span>
                          <span className="text-muted-foreground"> — {item.meaning}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

        </section>

        {/* ────────── Wolf Detector v1.0 — внизу под «Матрицей сигналов» ────────── */}
        <Accordion type="single" collapsible className="mt-10">
          <AccordionItem
            value="wolf"
            className="rounded-2xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-background px-4 backdrop-blur-sm transition-all duration-300 hover:border-orange-500/60 hover:shadow-[0_10px_40px_-15px_rgba(249,115,22,0.35)]"
          >
            <AccordionTrigger
              data-testid="trigger-wolf"
              className="py-3 hover:no-underline [&>svg]:text-orange-300"
            >
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-orange-400">
                <span aria-hidden>🐺</span>
                Wolf Detector v1.0 · усиленная проверка — кто прячется в стае
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[240px] flex-1">
                  <div className="text-sm font-bold">
                    5 архетипов «волка» — что выявляет агент
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Отдельный AI-агент со своим system prompt и 7-проходным анализом ловит
                    один из пяти устойчивых паттернов нелояльного кандидата.
                  </p>
                </div>
                <div className="rounded-xl border border-orange-500/30 bg-background/60 px-3 py-2 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Движок
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-orange-400">Yandex GPT Pro</div>
                  <div className="text-[11px] text-muted-foreground">Gen 5.x · flagship</div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { icon: "🏃", title: "Перебежчик", desc: "Job-hopper с маскировкой частоты смен" },
                  { icon: "🎨", title: "Фальсификатор", desc: "Придумывает должности, проекты, метрики" },
                  { icon: "🎭", title: "Манипулятор", desc: "Социопроходимец интервью — пуст в конкретике" },
                  { icon: "💣", title: "Токсик", desc: "Разрушитель команды — «все вокруг виноваты»" },
                  { icon: "🕵️", title: "Шпион", desc: "Параллельный бизнес / переходы к конкурентам" },
                ].map((a) => (
                  <div
                    key={a.title}
                    className="rounded-lg border border-orange-500/30 bg-background/50 p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-500/50 hover:bg-background/70"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-base" aria-hidden>{a.icon}</span>
                      <div className="text-xs font-semibold text-orange-300">{a.title}</div>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">{a.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  "📊 Risk Score 1–5",
                  "🐺 Wolf Index 0–3",
                  "🔍 OSINT · 12 источников с URL",
                  "💬 Триплеты STAR/PARLA",
                  "🎯 Профайлинг · 4 типа вопросов",
                  "📄 Executive Summary",
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-300 transition-colors duration-200 hover:bg-orange-500/15"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* ────────── Дисклеймер про шуточные имена — под Wolf Detector ────────── */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          🎭 Имена шуточные — под капотом строгая методология. Полное формальное описание —{" "}
          <Link href="/about">
            <a className="text-primary underline decoration-dotted underline-offset-2 transition-colors hover:text-primary/80">
              на странице «О методике»
            </a>
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

// ============ Категории сигналов — со смайликами и юмором ============
const SIGNAL_SECTIONS = [
  {
    title: "Риски резюме",
    emoji: "🕵️",
    weight: "40%",
    Icon: AlertTriangle,
    iconClass: "text-red-400",
    weightClass: "text-red-400",
    accentClass: "border-red-500/30",
    chevronClass: "text-red-300",
    items: [
      {
        emoji: "🃏",
        title: "Крапленая колода дат",
        meaning:
          "Хронология рассыпается при первой проверке — пересечения, разрывы, аномалии",
      },
      {
        emoji: "🎭",
        title: "Личность взята напрокат",
        meaning:
          "Одноразовая почта и телефон без верификации — цифровой след обрывается",
      },
      {
        emoji: "🗑️",
        title: "Досье с душком",
        meaning: "Стоп-слова в тексте: серые схемы, аффилированность, банкротства",
      },
      {
        emoji: "✂️",
        title: "Улика подброшена",
        meaning: "Резкая смена стиля — резюме сшито из чужих фрагментов",
      },
      {
        emoji: "👻",
        title: "Свидетель, которого не существует",
        meaning: "Работодатель не найден ни в одном открытом реестре",
      },
      {
        emoji: "🗺️",
        title: "Маршрут не совпадает с показаниями",
        meaning: "Города, компании и даты географически не складываются",
      },
    ],
  },
  {
    title: "Накрутка опыта",
    emoji: "🎈",
    weight: "40%",
    Icon: TrendingUp,
    iconClass: "text-amber-400",
    weightClass: "text-amber-400",
    accentClass: "border-amber-500/30",
    chevronClass: "text-amber-300",
    items: [
      {
        emoji: "💉",
        title: "Синдром раздутого эго",
        meaning: "KPI без контекста и масштаба — цифры не поддаются проверке",
      },
      {
        emoji: "👑",
        title: "Блеф на Senior при руках джуна",
        meaning: "Грейд заявлен, суммарный стаж его не подтверждает",
      },
      {
        emoji: "🔁",
        title: "INFINITE LOOP: Role.clone()",
        meaning: "Одни и те же обязанности дублируются под разными должностями",
      },
      {
        emoji: "🎰",
        title: "Олл-ин на чужой стек",
        meaning: "Технологии вписаны ради красоты — с реальными задачами не вяжутся",
      },
      {
        emoji: "🏆",
        title: "Туз из чужой колоды",
        meaning: "Командные результаты полностью присвоены единолично",
      },
      {
        emoji: "🧬",
        title: "Мутация тайтла IV стадии",
        meaning: "Должность меняется быстрее, чем растёт зона ответственности",
      },
      {
        emoji: "💥",
        title: "OVERFLOW: KPI Exceeds Physical Limits",
        meaning: "Объём задач и проектов физически невозможен за указанный срок",
      },
    ],
  },
  {
    title: "Сообщество «волков»",
    emoji: "🐺",
    weight: "20%",
    Icon: Users,
    iconClass: "text-orange-400",
    weightClass: "text-orange-400",
    accentClass: "border-orange-500/30",
    chevronClass: "text-orange-300",
    items: [
      {
        emoji: "🎲",
        title: "Серийный игрок за чужими столами",
        meaning: "Контракты по 3–6 месяцев — ротация ради офферов, а не карьерный рост",
      },
      {
        emoji: "🗣️",
        title: "Язык посвящённых",
        meaning:
          "Лексика тусовки охотников за офферами выдаёт принадлежность к сообществу",
      },
      {
        emoji: "🎓",
        title: "Отпечатки пальцев коуча",
        meaning: "Натасканные формулировки вместо живого профессионального опыта",
      },
      {
        emoji: "🔔",
        title: "Рейз без намерения выходить",
        meaning: "Оффер собирается как фишка давления — реального интереса к позиции нет",
      },
      {
        emoji: "📣",
        title: "Охота транслируется в прямом эфире",
        meaning: "Публичные посты с хвастовством офферами и размерами вилок",
      },
      {
        emoji: "⏰",
        title: "Выход на рынок по бонусному календарю",
        meaning:
          "Активность в поиске строго совпадает с периодами выплат на текущем месте",
      },
    ],
  },
] as const;
