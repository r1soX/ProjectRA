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

# 5) Применить схему к Postgres и перенести данные — одной командой в контейнере.
#    Точка входа сама сделает `prisma db push`, затем запустит миграцию.
docker compose run --rm \
  -v "$PWD/prisma/dev.db:/app/prisma/dev.db:ro" \
  app node --experimental-sqlite --import tsx \
  scripts/migrate-sqlite-to-postgres.ts
#    (сверьте счётчики строк в выводе)

# 6) Запустить приложение
docker compose up -d app     # или `docker compose up -d` (db+app)
docker compose logs -f app   # проверить, что стартовало

# 7) Проверить на домене/IP:3000 — войти прежними логинами, убедиться что данные на месте.

# 8) Только когда всё ок — убрать старый процесс, чтобы не занимал порт 3000
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
