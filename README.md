# Бот СБшник

Веб-приложение для проверки кандидатов на основе лингвистического анализа резюме и интервью с использованием Yandex GPT.

## Возможности

- **Обычная проверка** — анализ резюме по методике (Wolf-лексика, накрутка опыта, маркеры токсичности)
- **Полный пайплайн** — глубокая проверка с темпоральным анализом, NER-верификацией, плотностью buzzword
- **Карточка кандидата** — история всех проверок по одному кандидату с привязкой пайплайнов
- **Методика** — развёрнутое описание подхода (включая расширенный лингвистический и темпоральный анализ)

## Технологии

- **Frontend**: React + Vite + Tailwind CSS v3 + shadcn/ui + wouter
- **Backend**: Node.js + Express + TypeScript
- **БД**: SQLite через Drizzle ORM + better-sqlite3
- **AI**: Yandex GPT (`yandexgpt` через `/latest`)
- **PDF-парсер**: `pdfjs-dist` (legacy-сборка, без нативных зависимостей)

## Локальный запуск

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать .env.example → .env и заполнить ключи
cp .env.example .env
# отредактируйте .env

# 3. Запустить БД миграции
npm run db:push

# 4. Dev-режим
npm run dev

# Или production-сборка
npm run build
npm start
```

Приложение запустится на `http://localhost:5000`.

## Переменные окружения

| Переменная | Описание |
|-----------|----------|
| `YANDEX_API_KEY` | API-ключ Yandex Cloud |
| `YANDEX_FOLDER_ID` | ID каталога в Yandex Cloud |
| `YANDEX_MODEL` | Модель (по умолчанию `yandexgpt`) |
| `BASIC_AUTH_USER` | Логин базовой HTTP-авторизации |
| `BASIC_AUTH_PASS` | Пароль базовой HTTP-авторизации (обязателен в production) |
| `PORT` | Порт сервера (по умолчанию `5000`) |
| `ENCRYPTION_KEY` | Мастер-ключ (32 байта hex) для шифрования API-ключей провайдеров в БД |
| `DATABASE_PATH` | Путь к SQLite (по умолчанию `data.db`; на Cloud.ru/Railway — `/data/data.db`) |
| `GITHUB_TOKEN` | Опционально, для GitHub DeepScan (60→5000 req/ч) |
| `TRUST_PROXY` | Уровень доверия прокси (по умолчанию `1`; `0` — без прокси) |

## Деплой на Railway.app

1. Откройте [railway.app](https://railway.app), войдите через GitHub
2. **New Project → Deploy from GitHub repo** → выберите `VadShv/bot-sbshnik`
3. Railway прочитает `railway.json` / `nixpacks.toml` и начнёт сборку
4. В **Settings → Volumes** создайте volume на точку `/data` (для SQLite)
5. В **Variables** добавьте:
   - `DATABASE_PATH=/data/data.db`
   - `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `YANDEX_MODEL=yandexgpt`
   - `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`
6. В **Settings → Networking → Generate Domain** для публичного URL

## Деплой на Render.com

1. Залогиньтесь на [render.com](https://render.com), подключите GitHub-аккаунт
2. **New → Blueprint** → выберите этот репозиторий
3. Render автоматически прочитает `render.yaml`
4. Укажите секретные переменные: `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`
5. Нажмите **Apply** — через 3-5 минут приложение будет доступно на `https://bot-sbshnik.onrender.com`

## Деплой на Cloud.ru (ВМ + Docker)

Подробно — в [`docs/DEPLOY-cloudru.md`](docs/DEPLOY-cloudru.md). Кратко:
```bash
cp .env.example .env.docker   # заполнить BASIC_AUTH_*, ENCRYPTION_KEY, YANDEX_*
docker compose up -d --build
```
Мультистейдж-`Dockerfile` (Node 22, сборка better-sqlite3), SQLite на постоянном диске `/data`, nginx + TLS.

## Личный кабинет (`/settings`)

Админ-панель за Basic-auth для управления без правки кода:
- **Провайдеры LLM** — Yandex + Cloud.ru (+ любые OpenAI-compatible), активный + fallback; ключи шифруются at-rest.
- **Промпты** — редактор 7 SYSTEM-промптов с версионированием и rollback.
- **Пороги** — gap/overlap/shortStint/stack/senior/KPI/CS и др.
- **Тогглы** — вкл/выкл верификации ЭТК и модулей (детекторы/лингвистика/AI/Wolf/TeamFit/GitHub).
- **Вакансии (JD)** — шаблоны, подставляемые в анализ/Wolf.
- **Журнал** — аудит изменений настроек.
- **Тест-прогон** — проверка настроек на образце резюме.

## Структура проекта

```
bot-sbshnik/
├── client/          # React frontend
│   └── src/
│       ├── pages/   # home, pipeline, report, history, about, pipeline-report
│       ├── lib/     # queryClient, types, utils
│       └── components/
├── server/          # Express backend
│   ├── index.ts     # точка входа + auth + rate-limit
│   ├── routes.ts    # API маршруты (вкл. /api/settings)
│   ├── storage.ts   # Drizzle + миграции
│   ├── settings.ts  # настройки (кэш, мутации, audit log, seed)
│   ├── defaults.ts  # дефолты порогов/тогглов (без БД)
│   ├── seedPrompts.ts
│   ├── llm/         # провайдеры LLM (provider.ts, http.ts)
│   ├── lib/crypto.ts# AES-256-GCM для секретов
│   └── …            # detectors, linguistics, wolfDetector, pipelineAnalyzer и др.
├── shared/          # общие TS-типы и Drizzle-схема
├── script/build.ts  # скрипт сборки (esbuild + vite)
├── Dockerfile       # Cloud.ru / Docker
├── docker-compose.yml
└── render.yaml      # конфигурация Render
```

## API

- `GET /api/checks` — список всех проверок
- `GET /api/checks/:id` — детали проверки + связанные пайплайны
- `POST /api/analyze` — запуск обычной проверки
- `POST /api/pipeline/analyze` — запуск полного пайплайна (принимает `parentCheckId`)
- `GET /api/pipeline/:id` — детали пайплайн-отчёта
- `GET /api/settings` — сводка настроек (провайдеры/промпты/пороги/тогглы)
- `/api/settings/{providers,prompts,thresholds,toggles,jd-templates,audit-log}` — управление личным кабинетом
- `POST /api/settings/test-run` — тест-прогон настроек на образце резюме

## Методика

Методика включает 7 разделов:
1. Общий подход (без ПДн)
2. Wolf-лексика
3. Накрутка опыта
4. Темпоральный анализ (резюме vs. интервью)
5. Интерпретация результата
6. Ограничения и этика
7. **Расширенный лингвистический и темпоральный анализ** (LIWC-маркеры, Timeline Graph, плотность buzzword, NER-верификация)

Полный текст доступен на странице `/about` приложения.
