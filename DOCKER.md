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

## Перенос существующих данных из SQLite (опционально)

Схема применяется в пустую БД. Если нужно перенести данные из старого
`prisma/dev.db` — это отдельный шаг (экспорт/импорт по таблицам в порядке
зависимостей). По умолчанию рекомендуется чистый старт + `npm run db:seed`.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | строка подключения (host-side: `localhost`, in-compose: `db`) |
| `AUTH_SECRET` | секрет для подписи сессий (обязателен) |
| `POSTGRES_USER/PASSWORD/DB` | параметры контейнера Postgres |
| `RUN_SEED=1` | если задан у сервиса `app` — сидить при старте |
| `DISABLE_DEADLINE_SCHEDULER=1` | отключить встроенный планировщик напоминаний |
