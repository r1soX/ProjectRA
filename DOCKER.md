# PostgreSQL + Docker Compose

Проект переведён с SQLite на PostgreSQL и запускается через Docker Compose.

## Быстрый старт (всё в контейнерах)

```bash
# 1. Задай секрет (можно сгенерировать)
#    В .env: AUTH_SECRET=...   (POSTGRES_* уже заданы)
docker compose up -d --build

# 2. (первый раз) наполнить демо-данными — опционально:
docker compose exec app npm run db:seed
```

- Приложение: http://localhost:3000
- Postgres: localhost:5432 (проброшен для локальных инструментов)
- Схема применяется автоматически при старте контейнера (`prisma db push` в `docker-entrypoint.sh`).
- Загрузки (вложения/аватары) хранятся в томе `uploads`, данные БД — в томе `pgdata`.

## Локальная разработка (БД в Docker, приложение локально)

```bash
docker compose up -d db          # поднять только Postgres
npm install
npx prisma generate
npm run db:push                  # применить схему
npm run db:seed                  # (опц.) демо-данные
npm run dev
```

`DATABASE_URL` в `.env` указывает на `localhost:5432`. Внутри compose-сети
приложение использует хост `db` (см. `docker-compose.yml`).

## Перенос существующих данных из SQLite

Скрипт `scripts/migrate-sqlite-to-postgres.ts` копирует все данные из
`prisma/dev.db` в текущую БД (Postgres), сохраняя id и связи. Идемпотентный
(`skipDuplicates`), безопасно перезапускать. Есть `DRY_RUN=1` (только чтение).

## Продакшн (Ubuntu): переезд на Postgres+Docker БЕЗ потери данных

Предполагается, что сейчас прод крутится на SQLite (pm2 + `prisma/dev.db`).

```bash
# 0) Поставить Docker Engine + плагин compose (если ещё нет)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker   # чтобы без sudo

# 1) БЭКАП старой базы (обязательно!)
cp prisma/dev.db ~/projectra-dev.db.$(date +%F).bak

# 2) Остановить старое приложение, чтобы в SQLite не было записи во время переноса
pm2 stop all        # или ваш способ запуска

# 3) Забрать новый код и проверить .env
git pull
#   В .env оставьте ваш прежний AUTH_SECRET.
#   Задайте надёжный POSTGRES_PASSWORD. DATABASE_URL уже указывает на localhost:5432.

# 4) Собрать образ и поднять только Postgres
docker compose build
docker compose up -d db
docker compose ps          # дождаться, пока db => healthy

# 5) ВАЖНО: влить WAL в основной файл (SQLite хранит свежие записи в dev.db-wal).
#    Иначе часть данных не перенесётся! После этого dev.db самодостаточен.
sqlite3 prisma/dev.db 'PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;'
#    нет sqlite3?  →  sudo apt-get install -y sqlite3

# 6) Применить схему к Postgres и перенести данные — одной командой в контейнере.
#    Точка входа сама сделает `prisma db push`, затем запустит миграцию.
docker compose run --rm \
  -v "$PWD/prisma/dev.db:/app/prisma/dev.db:ro" \
  app node --experimental-sqlite --import tsx \
  scripts/migrate-sqlite-to-postgres.ts
#    (сверьте счётчики строк в выводе)

# 7) Запустить приложение
docker compose up -d app     # или `docker compose up -d` (db+app)
docker compose logs -f app   # проверить, что стартовало

# 8) Проверить на домене/IP:3000 — войти прежними логинами, убедиться что данные на месте.

# 9) Только когда всё ок — убрать старый процесс, чтобы не занимал порт 3000
pm2 delete all && pm2 save
```

Nginx (если используется) должен по-прежнему проксировать на `127.0.0.1:3000` —
менять не нужно. Бэкап `dev.db` держите, пока не убедитесь в переносе.

> Node на хосте не требуется — миграция и `db push` выполняются внутри контейнера
> (`node:22-alpine` содержит `node:sqlite`). Если предпочитаете запуск с хоста —
> нужен Node ≥ 22.5, `npm ci`, `npx prisma db push`, затем
> `node --experimental-sqlite --import tsx scripts/migrate-sqlite-to-postgres.ts`.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | строка подключения (host-side: `localhost`, in-compose: `db`) |
| `AUTH_SECRET` | секрет для подписи сессий (обязателен) |
| `POSTGRES_USER/PASSWORD/DB` | параметры контейнера Postgres |
| `RUN_SEED=1` | если задан у сервиса `app` — сидить при старте |
| `DISABLE_DEADLINE_SCHEDULER=1` | отключить встроенный планировщик напоминаний |
| `PROJECTRA_AI_PROVIDER` | основной провайдер: `cerebras`, `gemini` или `groq` |
| `PROJECTRA_AI_PROXY_URL` | общий HTTP(S)-прокси для всех ИИ-провайдеров |
| `PROJECTRA_AI_HISTORY_MESSAGES` | число последних сообщений в контексте модели, по умолчанию 12 |
| `CEREBRAS_API_KEY` | серверный ключ Cerebras; первый провайдер по умолчанию |
| `GEMINI_API_KEY` | серверный ключ Gemini; автоматический fallback после Cerebras |
| `GROQ_API_KEY` | необязательный третий fallback-провайдер |
| `CEREBRAS_MODEL` | модель Cerebras, по умолчанию `gpt-oss-120b` |
| `GEMINI_MODEL` | модель Gemini, по умолчанию `gemini-3.7-flash` |
| `*_PROXY_URL`, `*_BASE_URL`, `*_TIMEOUT_MS` | индивидуальные настройки каждого провайдера |
| `PROJECTRA_AI_DEBUG=1` | писать в логи номера раундов и названия вызванных инструментов |

## Встроенный ИИ-помощник Cerebras + Gemini на Ubuntu

Помощник находится в левом меню ProjectRA и открывается поверх текущей
страницы. Он работает от имени вошедшего пользователя и использует те же
проверки прав, что и агентский API. История сообщений хранится в PostgreSQL,
поэтому не пропадает после закрытия браузера или перезапуска контейнера.

На сервере, где проект расположен в `/opt/ProjectRA`, выполните:

```bash
cd /opt/ProjectRA
nano .env
```

Добавьте в `.env` (без пробелов вокруг `=`). Ключ Gemini называется именно
`GEMINI_API_KEY`:

```dotenv
PROJECTRA_AI_PROVIDER=cerebras
PROJECTRA_AI_HISTORY_MESSAGES=12
PROJECTRA_AI_MAX_COMPLETION_TOKENS=2048
PROJECTRA_AI_MAX_TOOL_ROUNDS=6

CEREBRAS_API_KEY=csk_ваш_ключ
CEREBRAS_MODEL=gpt-oss-120b
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1

GEMINI_API_KEY=ваш_ключ_Gemini
GEMINI_MODEL=gemini-3.7-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai

# Если исходящие запросы должны идти через один прокси:
PROJECTRA_AI_PROXY_URL=http://login:password@proxy-host:proxy-port

# Необязательно: существующий ключ Groq будет третьим fallback.
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
```

Порядок по умолчанию: **Cerebras → Gemini → Groq**. Провайдер без ключа
пропускается. Если прокси не нужен, оставьте `PROJECTRA_AI_PROXY_URL=` пустым.
Если конкретному провайдеру нужен отдельный прокси, задайте
`CEREBRAS_PROXY_URL`, `GEMINI_PROXY_URL` или `GROQ_PROXY_URL`: индивидуальная
настройка имеет приоритет над общей. Если логин или пароль
содержит `@`, `:`, `/`, `#` или другие специальные символы URL, закодируйте их
percent-encoding. Ключ и адрес прокси не добавляйте в Git и не размещайте в
клиентском JavaScript.

После загрузки обновлённых файлов пересоберите только приложение:

```bash
cd /opt/ProjectRA
docker compose up -d --build app
docker compose ps
docker compose logs --tail=100 app
```

При старте `docker-entrypoint.sh` автоматически выполнит `prisma db push` и
создаст таблицы `AiConversation` и `AiMessage`. Существующие доски, задачи и
пользователи не удаляются. Проверить наличие переменных без вывода секретов:

```bash
docker compose exec app sh -lc 'test -n "$CEREBRAS_API_KEY" && echo "Cerebras key: OK" || echo "Cerebras key: MISSING"'
docker compose exec app sh -lc 'test -n "$GEMINI_API_KEY" && echo "Gemini key: OK" || echo "Gemini key: MISSING"'
docker compose exec app sh -lc 'test -n "$PROJECTRA_AI_PROXY_URL" && echo "AI proxy: SET" || echo "AI proxy: OFF"'
```

Затем войдите на `https://projectra.ru`, нажмите **ИИ-помощник** слева и
отправьте сначала безопасный запрос: «Покажи мои актуальные задачи». После
этого проверьте действие записи, например создание тестовой задачи. Nginx для
этого чата дополнительно настраивать не нужно: браузер обращается к ProjectRA,
а к ИИ-провайдерам подключается серверный контейнер.

### Ошибка `invalid onRequestStart method`

Она возникает на Node.js 22, если `ProxyAgent` из npm-пакета `undici`
передать встроенному в Node `fetch` другой версии. В актуальном коде ProjectRA
при включённом прокси и запрос, и диспетчер создаются одной версией `undici`.
Если ошибка появилась после обновления, убедитесь, что контейнер действительно
пересобран:

```bash
cd /opt/ProjectRA
docker compose up -d --build app
docker compose logs --tail=100 app
```

Если Compose по-прежнему запускает старый образ:

```bash
docker compose build --no-cache app
docker compose up -d app
```

### Логи работы ИИ-помощника

Внутренние рассуждения моделей не выводятся, но ProjectRA умеет безопасно
логировать ход агентской цепочки: номер раунда, названия инструментов и момент
формирования итогового ответа. Тексты сообщений, аргументы инструментов, ключ и
данные прокси в этот лог не записываются.

Включите в `/opt/ProjectRA/.env`:

```dotenv
PROJECTRA_AI_DEBUG=1
```

Пересоздайте приложение и следите за логом:

```bash
cd /opt/ProjectRA
docker compose up -d --force-recreate app
docker compose logs -f app
```

Только строки помощника:

```bash
docker compose logs -f app | grep --line-buffered 'ProjectRA AI'
```
