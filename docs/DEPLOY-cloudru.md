# Деплой «Бот СБшник» на Cloud.ru (ВМ + Docker)

Целевая конфигурация: ВМ Compute Cloud + Docker + SQLite на постоянном диске + nginx (TLS).
Railway/Render остаются как альтернативные варианты (см. `railway.json`, `render.yaml`).

## 1. Заказ ВМ
- Compute Cloud → ВМ с Ubuntu 22.04/24.04, 2 vCPU / 4 ГБ RAM (хватит для одного админа).
- Присоедините **постоянный диск** (Volume) и смонтируйте его в `/data` (или отдельный раздел).
- Откройте порты: 22 (SSH), 80/443 (nginx). Приложение слушает 5000 только на localhost.

## 2. Установка Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## 3. Код и сборка
```bash
git clone https://github.com/VadShv/bot-sbshnik.git
cd bot-sbshnik
```

## 4. Переменные окружения (`.env.docker`, НЕ коммитить)
```bash
cat > .env.docker <<'EOF'
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=<сильный пароль>
ENCRYPTION_KEY=<32 байта hex: openssl rand -hex 32>
YANDEX_API_KEY=<ключ Yandex>
YANDEX_FOLDER_ID=<folder id>
YANDEX_MODEL=yandexgpt
GITHUB_TOKEN=<опционально, для GitHub DeepScan>
TRUST_PROXY=1
EOF
chmod 600 .env.docker
```
- `BASIC_AUTH_USER/PASS` — обязательны в production (без них приложение не стартует).
- `ENCRYPTION_KEY` — мастер-ключ для шифрования API-ключей провайдеров, сохраняемых через UI.
  **Сделайте резервную копию ключа** (при потере сохранённые ключи нельзя расшифровать).
- Провайдеры (Yandex/Cloud.ru) можно также добавить и переключать через **Личный кабинет → Провайдеры**
  (ключи шифруются, в UI видна маска). Сид-провайдер Yandex создаётся из env автоматически.

## 5. Постоянный диск
```bash
sudo mkdir -p /data
sudo chown $USER:$USER /data   # чтобы контейнер мог писать SQLite
```
`docker-compose.yml` монтирует `./data:/data`; `DATABASE_PATH=/data/data.db` задан в Dockerfile.
Чтобы переживал рестарты, держите `./data` на постоянном диске (или монтируйте диск в `./data`).

## 6. Запуск
```bash
docker compose up -d --build
docker compose logs -f
# проверка
curl -u admin:<пароль> http://127.0.0.1:5000/api/health
```
При первом старте автоматически создаются таблицы БД и сидируются настройки по умолчанию
(пороги, тогглы, промпты из кода, активный провайдер Yandex из env).

## 7. nginx + TLS (реверс-прокси)
```nginx
server {
  listen 443 ssl http2;
  server_name sbshnik.example.ru;
  ssl_certificate     /etc/letsencrypt/live/sbshnik.example.ru/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/sbshnik.example.ru/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;   # LLM-анализ может быть долгим
    client_max_body_size 20m;  # загрузка PDF/DOCX
  }
}
```
TLS-сертификат: Let's Encrypt (`certbot`) или сертификат Cloud.ru. HTTP → редирект на HTTPS.

## 8. Бэкапы
- SQLite: `sqlite3 /data/data.db ".backup '/data/backup-$(date +%F).db'"` по cron (раз в сутки).
- Снимки постоянного диска в Cloud.ru.
- Резервная копия `ENCRYPTION_KEY` (в хранилище секретов, не в репо).

## 9. Обновление
```bash
git pull
docker compose up -d --build
```
Миграции (`CREATE TABLE IF NOT EXISTS`) и сид выполняются при старте автоматически.

## 10. Личный кабинет
После запуска откройте `/settings` (ввод Basic-auth):
- **Провайдеры** — добавить Cloud.ru (OpenAI-compatible endpoint + ключ), выбрать активным/fallback.
- **Промпты** — редактировать SYSTEM-промпты, версии, rollback.
- **Пороги** — gap/overlap/shortStint/stack/senior/KPI/CS и др.
- **Тогглы** — вкл/выкл верификации ЭТК и модулей.
- **Вакансии** — шаблоны JD (подставляются в анализ/Wolf).
- **Журнал** — аудит изменений настроек.
- **Тест-прогон** — проверить настройки на образце резюме.
