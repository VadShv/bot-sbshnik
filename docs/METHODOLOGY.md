# Бот СБшник — Методология и функционал

> Документ подготовлен по результатам анализа исходного кода репозитория
> `VadShv/bot-sbshnik` (HEAD `0e9c980`, версия **v3.7.0**, 2026-04-27).
> Все числовые веса, пороги и строковые константы подтверждены дословно из исходников.

## 1. Назначение и архитектура

**Бот СБшник** — веб-приложение Службы безопасности для проверки кандидатов по
резюме/интервью с гибридной (детерминированной + LLM) методологией. LLM = Yandex GPT
(`yandexgpt` и совместимый с OpenAI эндпоинт для Qwen3 / gpt-oss / deepseek / gemma).

| Слой | Стек |
|---|---|
| Frontend | React 18, Vite 7, Tailwind v3, shadcn/ui, wouter, TanStack Query, Recharts |
| Backend | Node.js, Express 5, TypeScript (tsx → esbuild) |
| БД | SQLite + Drizzle ORM + better-sqlite3 (WAL) |
| AI | Yandex Cloud Foundation Models API (native + OpenAI-compatible) |
| Парсинг | pdfjs-dist (legacy), mammoth (docx) |
| Auth | HTTP Basic Auth на весь сервис (`timingSafeEqual`) |
| Деплой | Railway (`nixpacks.toml` / `railway.json`), Render (`render.yaml`) |

**Потоки:** 1) Базовая проверка (`POST /api/analyze`); 2) Полный пайплайн
(`POST /api/pipeline/analyze`); + вспомогательные Team Fit, GitHub DeepScan, Chat.

## 2. Базовая проверка — методология (`routes.ts` → `/api/analyze`)

Конвейер: **парсинг → детерминированные детекторы → 3 параллельных LLM-прохода →
условный лингвистический аудит → слияние и скоринг → сохранение**.

### 2.1. Детерминированные детекторы (`detectors.ts`, `runDetectors`)
Вся арифметика считается локально (быстро, воспроизводимо, без LLM).

- **`extractPeriods`** — regex-извлечение периодов работы
  (`Месяц YYYY — Месяц YYYY`, `MM.YYYY`, `YYYY — YYYY`, `по настоящее время`).
- **Хронология**: обратные даты (end<start, critical), пересечения >60 дней, пробелы >180 дней.
- **Образование**: несколько дипломов за <2 года.
- **Контакты**: одноразовые email-домены, отсутствие контактов.
- **Стоп-слова**: упоминания серых схем/откатов, судимости, банкротства работодателей.
- **Накрутка опыта**: senior при стаже <3 лет; нереалистичные KPI (≥300% или ≥10×);
  дублирование буллетов copy-paste; стек-инфляция (≥25 технологий); быстрый рост
  junior→senior; низкая плотность конкретики; тайтл-инфляция (Head Of в стартапе <5 чел).
- **«Волки»**: серийные короткие контракты <9 мес (≥3); лексика сообщества
  (`волк`, `оферхантинг`, `гонка оферов`); следы коучинга по собесам (STAR, system design prep).
- **`aggregateCategoryScore`** = топ-finding × confidence + 0.15 × хвост.

### 2.2. LLM-анализ (`yandex.ts`, `yandexAnalyze`)
System-prompt «ведущий аналитик СБ», 5 уровней: **A** хронология, **B** квалификация,
**C** достижения/метрики, **D** косвенные контакты/identity, **E** лингвистика/поведение.
Каждый finding содержит `evidenceDetailed` (`quote|contradiction|absence|pattern|indirect`),
`verificationSteps`, `impact`. Калибровка confidence: 90–100 прямое противоречие, 70–89
косвенный паттерн, 50–69 интерпретация, <30 не включать. `temperature=0.15`, `maxTokens=7000`.

### 2.3. Wolf Detector v1.0 (`wolfDetector.ts`, `runWolfAudit`)
8-проходный LLM-аудит. **5 архетипов** (job-hopper / fabricator / manipulator /
team-destroyer / corporate-spy), **6 категорий сигналов** (frequency / narrative /
self-presentation / osint-divergence / network / behavior), `wolfIndex` 0–3,
`riskScore` 1–5. **12 фиксированных OSINT-источников** (HH, LinkedIn, VK, Telegram,
GitHub, ЕГРЮЛ, Habr, Google, Wayback, kad.arbitr, реестр дисквалифицированных, базы утечек).
**Интервью-триплеты** (opener → deepener → verifier). **Полиграф-триггеры** 4 видов
(relevant/control/comparison/behavioral). **Wolf School Detector**: 5 «школ»
(ОМ / НА / ЛЕГ / ОЭ / АТС + ?/none), `ideologicalMatch` 1–5, `overemploymentRisk`,
`networkRiskLevel` 1–3. `temperature=0.2`, `maxTokens=8000`.
Под блоком Wolf Detector в UI есть дисклеймер (добавлен в v3.6.4): сигналы — не вердикт.

### 2.4. AI Detector v1.0 (`aiDetector.ts`, `runAiDetector`)
«Привратник»: один LLM-вызов, `aiScore` 0–100, вердикт
`human_written | lightly_edited | heavily_edited | ai_generated`. 6 типов маркеров:
cliche / symmetry / smoothness / vocabulary / structure / hedging. `threshold=60`.
Консервативный фолбэк при ошибке.

### 2.5. Условный лингвистический аудит (`linguistics.ts`, `runLinguisticAudit`)
Запускается только при `aiScore ≥ threshold`. **4 детерминированные методики:**

| Методика | Источник | Что считает |
|---|---|---|
| **LIWC** | Pennebaker | Русские лексиконы: 1-е лицо ед./мн., 3-е лицо, эмоции ±, исключители, функциональные слова, когнитивные механизмы. Частоты на 100 токенов. Маркеры: `iDominant`, `blamesOthers`, `highExclusives` (Newman et al. 2003), `lowCognitiveComplexity`. riskScore 0–100 |
| **Reality Monitoring** | Johnson & Raye 1981 | Резюме бьётся на блоки (experience/achievements/projects/about), 6 критериев × {0,1,2}: сенсорика, пространство, время, аффект, логика, self-ref. Σ/12 → real/ambiguous/constructed |
| **Cognitive Load** | Vrij 2008 | Хеджирование, структурная симметрия (5-шинглы + Jaccard между блоками опыта), противоречия (размер команды), повторяющиеся 4-граммы. riskScore |
| **ACID** | Assessment Criteria Indicative of Deception | 10 критериев честного нарратива (first_person_anchor, unique_details, specific_names, temporal_precision, affect_presence, causal_chain, uncorrected_errors, peripheral_details, complication_resolution, self_doubt). honestScore/10 → honest/mixed/constructed/fabricated |

**Итог**: `linguisticRisk = 0.3·LIWC + 0.25·RM + 0.25·CL + 0.2·ACID`.

### 2.6. Слияние и скоринг
`mergeFindings` (дедуп по id/title). `riskScore = max(aggregate, llm.score)` по каждой
категории. `totalScore = 0.4·risk + 0.4·inflation + 0.2·wolves`. `verdictFromScore`
(green/yellow/red) с калибровкой по confidence. `subcategoryBreakdown` по 8 категориям.
План действий от LLM или шаблонный `buildDefaultActionPlan`. Сохранение в таблицу `checks`.

## 3. Полный пайплайн — методология (`pipelineAnalyzer.ts`)

Вход: резюме + ЭТК/СФР + заметки интервью + референсы + форма рекрутера (4 поля + note).

### 3.1. Pre-processing (детерминированно)
- **`buildTimeline`** (`timeline.ts`): парсит ЭТК (приоритет) или резюме → `EmploymentSpan[]`,
  считает `totalMonths`, `avgMonths`, `shortStintsCount` (<12 мес), `gapsMonths`, плюс
  извлечение образования.
- **`runLinguisticAudit`**: те же 4 методики, считаются локально и **передаются в LLM
  как готовые числа** (модель не пересчитывает).

### 3.2. Один LLM-вызов (`temperature=0`, `maxTokens=12000`), 4 модуля
- **Модуль 1 — Верификация опыта**: резюме × ЭТК. `confirmed` (≤30 дней), `partial`
  (31–90 дней или должность), `conflict` (>90 дней или отсутствует), `not_checked`.
  `blockingConflict`. ЭТК принимается как структурированные записи **или** сырой текст
  (LLM извлекает сам).
- **Модуль 2 — Мотивация**: score 0–100, `reasonConsistency`, redFlags/greenFlags,
  `urgencyNote`. Жёстко: redFlags → score ≤70.
- **Модуль 3 — ILS (индекс лояльности/стабильности)**: `sHistory` (по таймлайну),
  `sRecruiter` (по форме), `sLanguage` (по тексту). `score = 0.4·sH + 0.35·sR + 0.25·sL`.
  `sHistory` корректируется объективными данными таймлайна.
- **Модуль 5 — Лингвистика (интерпретация)**: LLM качественно интерпретирует уже
  посчитанные LIWC/RM/CL/ACID в 1–2 предложения. (Модуль 4 Cultural Fit — удалён.)

### 3.3. Post-processing (детерминированно)
- **Composite Score** = `0.4·motivation + 0.6·loyalty` (лояльность весит больше).
- **`deriveResolution`**: `NOT_RECOMMENDED` (blockingConflict или CS<50) → `UNVERIFIED`
  (CS≥70 + not_checked) → `RECOMMENDED` (CS≥70 + confirmed/partial) → `CONDITIONAL`
  (CS 50–69) с условиями.
- **`normalizeExecutiveSummary`**: cross-check заголовка vs резолюции, авто-генерация
  keyFindings, программная проверка согласованности.
- **Фантом-фильтр** (`PHANTOM_PATTERNS`, ~30 regex): вырезает «работа в будущем»,
  «телепорт», «компания не существует/ликвидирована» и т.п. галлюцинации LLM.
- **`repairJson`**: чинит обрезанный по токенам JSON.
- Сохранение в `pipeline_checks` (версионируется, `parentId` → базовая проверка).
  `POST /api/pipeline/:id/recompute` — пересчёт с патчем.

## 4. Вспомогательные модули

| Модуль | Endpoint | Суть |
|---|---|---|
| **Team Fit / Fit Guard v3** (`fitGuard.ts`) | `POST /api/checks/:id/team-fit` | 5 осей: valueFit, vendorFit (российские вендоры ПО), productFit, methodologyFit, психотип (OCEAN 0–10 + MBTI NT-кластер INTJ/INTP/ENTJ/ENTP). Требует ≥300 слов. 3–5 гипотез для интервью. **Явно гипотезы, не диагноз, не основание для отказа** |
| **GitHub DeepScan v3.5** (`githubDeepScan.ts`+`github.ts`) | `POST /api/checks/:id/github-deepscan` | Сбор публичного профиля (user, repos без forks, языки, events, search/commits). Детекторы: Tech Stack, Behavior Timeline (гистограмма по МСК, ночные/выходные, inferred TZ, регулярность), Risk Flags (secret_leak, nsfw, moonlighting, identity_weak, contribution_authenticity, timezone_mismatch). `sbScore = 0.4·tech + 0.3·behavior + 0.3·risk`. LLM-проба для code quality + OCEAN-hints. `GITHUB_TOKEN` опционален (60→5000 req/ч) |
| **Chat** | `POST /api/checks/:id/chat/message` | LLM в контексте всех вкладок карточки (base + pipeline + team fit + github). Последние 16 сообщений. Фантом-фильтр на выходе |

## 5. API-поверхность
`GET /api/health` · `POST /api/extract` (PDF/DOCX→text) · `GET/POST/DELETE /api/checks[/:id]` ·
`POST /api/analyze` · `POST /api/pipeline/analyze` · `GET /api/pipeline/:id` ·
`POST /api/pipeline/:id/recompute` · `GET/POST/DELETE /api/checks/:id/chat[/message]` ·
`GET/POST/DELETE /api/checks/:id/team-fit` · `GET/POST/DELETE /api/checks/:id/github-deepscan`

## 6. Сквозные принципы методологии
1. **Детерминированно-первое**: вся арифметика локально, LLM только интерпретирует.
2. **No claim without evidence**: каждый finding — `quote|contradiction|absence|pattern|indirect`.
3. **Фантом-фильтр**: страховка от галлюцинаций LLM о датах/компаниях/реестрах.
4. **Презумпция + калибровка**: severity medium предпочтительнее пропуска, но без оснований
   не эскалировать до critical.
5. **Согласованность принудительная**: redFlags→score≤70, sHistory<40→флаг job-hopping,
   headline↔resolution cross-check.
6. **PII-free reasoning**: LLM игнорирует точные ДОБ/ФИО/паспорт/СНИЛС/ИНН/телефон/email-local;
   использует только косвенные маркеры.
7. **Этика**: Team Fit — гипотезы, не диагноз; нет выводов по защищённым классам
   (раса/пол/возраст/религия/здоровье).
8. **Graceful degradation**: у каждого LLM-модуля есть консервативный фолбэк.

## 7. Конфигурируемость (личный кабинет, M1–M7)
Пороги, тогглы, промпты и провайдеры LLM управляются через UI (`/settings`) без правки кода:
- **Пороги** (см. 2.1, 3.3): `gapMonths`, `overlapMonths`, `shortStintMonths`, `jobHoppingCount`, `stackInflationCount`, `seniorMinYears`, `kpiPercent`, `kpiTimes`, `aiDetectorThreshold`, `csRejectBelow`, `csRecommendAbove` — хранятся в БД, дефолты в `server/defaults.ts`.
- **Тогглы**: верификация опыта (ЭТК) и модули (детекторы/лингвистика/AI-детектор/Wolf/TeamFit/GitHub DeepScan) — вкл/выкл.
- **Промпты**: 7 SYSTEM-промптов с версионированием и rollback; пустая версия → кодовый дефолт.
- **Провайдеры**: Yandex + Cloud.ru (+ OpenAI-compatible), активный + fallback; ключи шифруются at-rest (AES-256-GCM, `ENCRYPTION_KEY`).
- **Шаблоны вакансий (JD)**: подставляются в контекст анализа/Wolf.
- **Журнал**: аудит всех изменений настроек.

Изменения применяются без перезапуска (in-memory кэш инвалидируется при мутациях).

## 8. Модель скоринга v2 — Risk Index (полосы + драйверы + действие)
Замена непрозрачного «риска 0–100» интерпретируемой шкалой: каждое число = **полоса + метка + смысл + драйверы + действие + уверенность**.

**3 полосы (итог + каждый критерий):**
| Полоса | Диапазон | Метка | Действие по умолчанию |
|---|---|---|---|
| 🟢 | 0–24 | Не вызывает вопросов | Рутинная проверка не требуется |
| 🟡 | 25–49 | Факты или периоды требуют проверки | Проверить отдельные факты/периоды |
| 🔴 | 50–100 | Факты или периоды требуют тщательной проверки | Тщательная проверка + reference-check |

- **Sub-indices (базовая проверка):** Хронология и контакты · Квалификация · Аутентичность текста (AI + лингвистика) · Поведение. `RI = 0.30·Хронология + 0.25·Квалификация + 0.20·Аутентичность + 0.25·Поведение` (веса конфигурируемы).
- **Пайплайн:** Верификация (ЭТК) · Мотивация · Лояльность · Аутентичность — единый Risk Index и тот же словарь решений.
- **Решение:** Рекомендовать / Требует проверки / Требует тщательной проверки / Не рекомендовать — по полосе RI (`blockingConflict`→🔴, `not_checked`→строже на ступень).
- **Уверенность:** Высокая/Средняя/Низкая — программно по типу и числу доказательств (не self-report LLM).

Пример: `RI 72 🔴 Факты или периоды требуют тщательной проверки — Хронология 70 · Квалификация 45 · Аутентичность 60 · Поведение 95. Драйверы: gap 14 мес · wolf-лексика. Действие: тщательная проверка + reference-check. Уверенность: Средняя.`

Лингвистический аудит теперь выполняется всегда (когда модуль включён), без gating по `aiScore`.
