import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShieldCheck,
  GraduationCap,
  Crosshair,
  Users,
  FileWarning,
  Briefcase,
  Search,
  CheckCircle2,
  Info,
  Sparkles,
  Brain,
  Building2,
  Package,
  Workflow,
  Github,
  Code2,
  Clock,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";

export default function ModulesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
          <ShieldCheck className="h-3 w-3" />
          <span>Дополнительные модули · add-ons</span>
        </div>
        <h1 className="mb-2 text-xl font-bold">Модули</h1>
        <p className="mb-8 max-w-3xl text-sm text-muted-foreground">
          Базовая проверка содержит детерминированные детекторы и интегральный
          риск-скор. Для отдельных кандидатов и контекстов доступны
          специализированные модули — подключаются к базовой проверке и
          расширяют её результат.
        </p>

        {/* ============ FIT GUARD v3 (Team Fit) ============ */}
        <Collapsible className="mb-4">
          <Card
            className="border-primary/30 bg-primary/[0.04]"
            data-testid="module-fit-guard"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 p-5 text-left"
                data-testid="toggle-fit-guard"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="rounded-md bg-primary/15 p-2 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold">Fit Guard</div>
                      <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                        v3
                      </span>
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                        включён по умолчанию
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Team Fit · психо-поведенческая гипотеза по 5 осям
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-6 pb-6 pt-5">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  Модуль строит гипотезы о культурном, продуктовом и психо-поведенческом
                  соответствии кандидата команде на основе текста резюме. Результат —
                  рамка для интервью, не диагноз и не основание для отказа. Выводы помечаются
                  как гипотезы с опорой на резюме и проверочными вопросами.
                </p>

                <div className="mb-5 rounded-md border border-border bg-background/60 p-4">
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    5 осей Team Fit
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <AxisRow
                      icon={<Users className="h-3.5 w-3.5" />}
                      title="[1] Ценностный фит"
                      desc="Ответственность, командность, наставничество, прозрачность, отношение к ошибкам."
                    />
                    <AxisRow
                      icon={<Building2 className="h-3.5 w-3.5" />}
                      title="[2] Вендорный фит (РФ ПО)"
                      desc="1С, Галактика, Контур, Яндекс.Облако, Astra Linux, Postgres Pro, Naumen, Directum, Тарантул и др."
                    />
                    <AxisRow
                      icon={<Package className="h-3.5 w-3.5" />}
                      title="[3] Продуктовый фит"
                      desc="Retention/LTV/CAC, discovery/delivery, гипотезы, A/B, customer development, OKR по продукту."
                    />
                    <AxisRow
                      icon={<Workflow className="h-3.5 w-3.5" />}
                      title="[4] Методологический фит"
                      desc="Agile/Scrum/Kanban/SAFe: роли PO/SM, артефакты (беклог, спринт, ретро), waterfall/PMBOK."
                    />
                    <AxisRow
                      icon={<Brain className="h-3.5 w-3.5" />}
                      title="[5] Психотип-Аналитик"
                      desc="OCEAN (Big Five) баллы 0–10 и MBTI NT-кластер (INTJ / INTP / ENTJ / ENTP) — гипотеза когнитивного стиля."
                    />
                  </div>
                </div>

                <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300/90">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Гарды: если резюме короче 300 слов — модуль сообщает о недостатке данных.
                    Ни один вывод не должен быть единственным основанием для отказа кандидату.
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    Вывод строится как гипотезы для интервью (3–5 формулировок с проверочными вопросами).
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ============ GITHUB DEEPSCAN v3.5 ============ */}
        <Collapsible className="mb-4">
          <Card
            className="border-primary/30 bg-primary/[0.04]"
            data-testid="module-github-deepscan"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 p-5 text-left"
                data-testid="toggle-github-deepscan"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="rounded-md bg-primary/15 p-2 text-primary">
                    <Github className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold">GitHub DeepScan</div>
                      <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                        v3.5
                      </span>
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                        включён по умолчанию
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Глубокий анализ публичного GitHub-профиля кандидата
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-6 pb-6 pt-5">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  Модуль автоматически извлекает GitHub-хэндл из резюме (или принимает
                  вручную) и строит SB-Score по публичным данным: технологический стек,
                  ритм коммитов по часам МСК, риск-сигналы и OCEAN-гипотезы.
                  Все выводы — гипотезы с permalink-доказательствами, не диагноз.
                </p>

                <div className="mb-5 rounded-md border border-border bg-background/60 p-4">
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    3 субскора в SB-Score
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <AxisRow
                      icon={<Code2 className="h-3.5 w-3.5" />}
                      title="Tech Score"
                      desc="Оригинальные репо, звёзды, возраст аккаунта, глубина по основному языку."
                    />
                    <AxisRow
                      icon={<Clock className="h-3.5 w-3.5" />}
                      title="Behavior Score"
                      desc="Регулярность коммитов, доля в рабочие часы МСК, активность/неделю."
                    />
                    <AxisRow
                      icon={<ShieldAlert className="h-3.5 w-3.5" />}
                      title="Risk Score (инв.)"
                      desc="Секреты в коммитах, NSFW, мунлайтинг, слабая идентичность, расхождение таймзоны."
                    />
                  </div>
                </div>

                <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300/90">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Гарды: анализируем только публичные данные. При rate-limit GitHub API —
                    graceful degradation. Для снятия лимитов можно настроить серверный GITHUB_TOKEN.
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    Каждый риск-флаг подкрепляется permalink-и на конкретные коммиты или репозитории.
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ============ WOLF DETECTOR v1.0 ============ */}
        <Collapsible className="mb-4">
          <Card
            className="border-primary/30 bg-primary/[0.04]"
            data-testid="module-wolf-detector"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 p-5 text-left"
                data-testid="toggle-wolf-detector"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="rounded-md bg-primary/15 p-2 text-primary">
                    <Crosshair className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold">Wolf Detector</div>
                      <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                        v1.0
                      </span>
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                        включён по умолчанию
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      8-проходный риск-аудит резюме · 5 архетипов «волка»
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-6 pb-6 pt-5">
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  Специализированный AI-модуль для выявления фальсификаций, накрутки
                  опыта, скрытых рисков и поведенческих паттернов «волка». Работает
                  параллельно с базовой проверкой, дополняет её 8-ю проходами анализа
                  и классификацией по 5 архетипам.
                </p>

                <div className="mb-5 rounded-md border border-border bg-background/60 p-4">
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    5 архетипов «волка»
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <ArchetypeRow
                      title="Волк-перебежчик (job-hopper)"
                      desc="Прыгает между компаниями, маскирует частоту смен."
                    />
                    <ArchetypeRow
                      title="Фальсификатор (fabricator)"
                      desc="Придумывает должности, компании, проекты, метрики."
                    />
                    <ArchetypeRow
                      title="Социопроходимец (manipulator)"
                      desc="Безупречен на словах, пуст в конкретике; управляет эмоциями интервьюера."
                    />
                    <ArchetypeRow
                      title="Разрушитель команды (team-destroyer)"
                      desc="В каждой компании «виноваты все вокруг», нет рекомендателей."
                    />
                    <ArchetypeRow
                      title="Корпоративный шпион (corporate-spy)"
                      desc="Параллельный бизнес, переходы к прямым конкурентам, интерес к чувствительным данным."
                    />
                  </div>
                </div>

                <div className="mb-5 rounded-md border border-border bg-background/60 p-4">
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    8 проходов анализа
                  </div>
                  <ol className="grid gap-1.5 text-sm md:grid-cols-2">
                    <PassRow n={1} label="Временная шкала и хронология" />
                    <PassRow n={2} label="Фактологический аудит" />
                    <PassRow n={3} label="Накрутка опыта и лексика" />
                    <PassRow n={4} label="Поведенческие паттерны" />
                    <PassRow n={5} label="Cultural & motivation fit" />
                    <PassRow n={6} label="Референсы и верифицируемость" />
                    <PassRow n={7} label="Интервью-триплеты (STAR/PARLA)" />
                    <PassRow n={8} label="Wolf School Detector (подфича)" />
                  </ol>
                </div>

                {/* ============ САБФИЧА: WOLF SCHOOL DETECTOR ============ */}
                <div
                  className="rounded-md border border-primary/30 bg-background/60 p-4"
                  data-testid="subfeature-wolf-school"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <div className="font-semibold">Wolf School Detector</div>
                    <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                      подфича · проход 8
                    </span>
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Определяет, прошёл ли кандидат специализированную подготовку в
                    одной из «волчьих школ» — сообществ по оверэмплойменту, взлому
                    найма и фабрике легенд. Возвращает индикатор школы, уровень
                    сетевого риска (1–3) и идеологическую близость (1–5).
                  </p>

                  <div className="grid gap-2">
                    <SchoolRow
                      code="ОМ"
                      title="Осознанная меркантильность"
                      desc="Назаров / m0rtymerr. Идеология оверэмплоймента и «волчистости», зарплатная агрессия, тарифные уровни «Волчонок / Волк / Волчара / Фенрир»."
                      icon={<Users className="h-3.5 w-3.5" />}
                    />
                    <SchoolRow
                      code="НА"
                      title="«Взламываем найм» и аналоги"
                      desc="«Паровозик» — несколько кандидатов подают в одну компанию согласованно. Фабрика референсов, заученные скрипты STAR под типовые вопросы."
                      icon={<Briefcase className="h-3.5 w-3.5" />}
                    />
                    <SchoolRow
                      code="ЛЕГ"
                      title="Легенда-фабрика"
                      desc="Синтетические референсы и контакты, фейковый GitHub с шаблонными коммитами, покупка истории работы в закрытых/иностранных компаниях."
                      icon={<FileWarning className="h-3.5 w-3.5" />}
                    />
                    <SchoolRow
                      code="ОЭ"
                      title="Оверэмплоймент-сообщества"
                      desc="Открытое/скрытое совмещение 2–4 работ, асинхронный режим, социальная дистанция от команды, схемы ГПХ/ИП, избегание созвонов."
                      icon={<Users className="h-3.5 w-3.5" />}
                    />
                    <SchoolRow
                      code="АТС"
                      title="ATS-оптимизаторы (легальная грань)"
                      desc="Идеальные ключевые слова под конкретную вакансию, «пылесосный» набор технологий, провал при техническом углублении."
                      icon={<Search className="h-3.5 w-3.5" />}
                    />
                    <SchoolRow
                      code="?"
                      title="Школа не идентифицирована"
                      desc="Системные признаки школьной подготовки есть, но конкретная школа не определена."
                    />
                    <SchoolRow
                      code="none"
                      title="Признаков не обнаружено"
                      desc="Кандидат не проявляет признаков школьной подготовки."
                      muted
                    />
                  </div>

                  <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-3 text-[12px] leading-relaxed text-muted-foreground">
                    <Info className="mr-1 inline h-3 w-3" />
                    Дополнительно: <span className="font-semibold">Ideological Match</span>{" "}
                    (1–5) — идеологическая близость «волчьим» ценностям,{" "}
                    <span className="font-semibold">Overemployment Risk</span> (yes/no/suspect),{" "}
                    <span className="font-semibold">Network Risk Level</span> (1 —
                    индивидуал; 2 — активный участник; 3 — альфа/наставник/спикер школы).
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ============ ROADMAP ============ */}
        <Collapsible className="mb-4">
          <Card className="border-card-border bg-card" data-testid="module-roadmap">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 p-5 text-left"
                data-testid="toggle-roadmap"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="rounded-md bg-muted p-2 text-muted-foreground">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">Планируется</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      модули в разработке
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/60 px-6 pb-6 pt-5">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-semibold text-foreground">
                        OSINT-интеграция
                      </span>{" "}
                      — автоматическая проверка компаний по ЕГРЮЛ/rusprofile и
                      профилей в открытых источниках.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-semibold text-foreground">
                        Reference Verifier
                      </span>{" "}
                      — автоматическая проверка референсов через каналы СБ.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-semibold text-foreground">
                        Интервью-ассистент
                      </span>{" "}
                      — live-подсказки во время звонка на основе триплетов STAR/PARLA.
                    </span>
                  </li>
                </ul>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </main>
    </div>
  );
}

function PassRow({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[10px] font-bold text-primary">
        {n}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}

function ArchetypeRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded border border-border/60 bg-muted/30 p-3">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function AxisRow({
  icon,
  title,
  desc,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {icon ? <span className="text-primary">{icon}</span> : null}
        {title}
      </div>
      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {desc}
      </div>
    </div>
  );
}

function SchoolRow({
  code,
  title,
  desc,
  icon,
  muted,
}: {
  code: string;
  title: string;
  desc: string;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 rounded border ${
        muted
          ? "border-border/40 bg-muted/20"
          : "border-border/60 bg-muted/40"
      } p-3`}
    >
      <div
        className={`flex h-8 min-w-[52px] shrink-0 items-center justify-center rounded px-2 font-mono text-[11px] font-bold tracking-wider ${
          muted
            ? "bg-muted text-muted-foreground"
            : "bg-primary/15 text-primary"
        }`}
      >
        {code}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {icon}
          {title}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {desc}
        </div>
      </div>
    </div>
  );
}
