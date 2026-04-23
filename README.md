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
| `BASIC_AUTH_PASS` | Пароль базовой HTTP-авторизации |
| `PORT` | Порт сервера (по умолчанию `5000`) |

## Деплой на Render.com

1. Залогиньтесь на [render.com](https://render.com), подключите GitHub-аккаунт
2. **New → Blueprint** → выберите этот репозиторий
3. Render автоматически прочитает `render.yaml`
4. Укажите секретные переменные: `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`
5. Нажмите **Apply** — через 3-5 минут приложение будет доступно на `https://bot-sbshnik.onrender.com`

## Структура проекта

```
bot-sbshnik/
├── client/          # React frontend
│   └── src/
│       ├── pages/   # home, pipeline, report, history, about, pipeline-report
│       ├── lib/     # queryClient, types, utils
│       └── components/
├── server/          # Express backend
│   ├── index.ts     # точка входа
│   ├── routes.ts    # API маршруты
│   └── storage.ts   # работа с БД
├── shared/          # общие TS-типы и Drizzle-схема
├── script/build.ts  # скрипт сборки (esbuild + vite)
└── render.yaml      # конфигурация Render
```

## API

- `GET /api/checks` — список всех проверок
- `GET /api/checks/:id` — детали проверки + связанные пайплайны
- `POST /api/analyze` — запуск обычной проверки
- `POST /api/pipeline/analyze` — запуск полного пайплайна (принимает `parentCheckId`)
- `GET /api/pipeline/:id` — детали пайплайн-отчёта

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
