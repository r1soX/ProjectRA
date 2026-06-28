# Деплой Projectra (Ubuntu + pm2 + nginx)

Next.js 16 (App Router) + Prisma + SQLite. Реалтайм на SSE. Напоминания о
дедлайнах крутит внутренний планировщик (`src/instrumentation.ts`).

## 1. Окружение

Установи Node 20+ и pm2 (`npm i -g pm2`). Клонируй в `/opt/ProjectRA`.

Создай `.env` в корне проекта (он в `.gitignore`, в репозиторий не попадает):

```dotenv
# SQLite-файл. Путь у Prisma резолвится относительно папки prisma/,
# поэтому проще указать абсолютный путь:
DATABASE_URL="file:/opt/ProjectRA/prisma/prod.db"

# ОБЯЗАТЕЛЬНО: секрет для подписи сессий (иначе приложение падает).
# Сгенерировать:  openssl rand -base64 32
AUTH_SECRET="<вставь_сюда_случайную_строку>"

# Необязательно: защита внешнего вызова /api/cron/deadlines
# CRON_SECRET="<строка>"

# Необязательно: отключить встроенный планировщик напоминаний
# (если будешь дёргать /api/cron/deadlines внешним cron)
# DISABLE_DEADLINE_SCHEDULER="1"
```

## 2. Первый запуск

```bash
cd /opt/ProjectRA
npm ci                     # зависимости строго по lock-файлу
npx prisma generate        # клиент Prisma
npx prisma db push         # создать схему в SQLite
npm run db:seed            # создать админа (логин по seed, пароль Qq123456) и демо-данные — по желанию
npm run build              # ПРОД-сборка (обязательно, не next dev!)
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                # один раз: автозапуск pm2 после ребута (выполни выданную команду)
```

Проверка, что сервер жив и НЕ перезапускается в цикле:

```bash
pm2 logs projectra --lines 20     # должен быть ОДИН "✓ Ready", без повторов
pm2 describe projectra | grep -iE 'restarts|watch'   # restarts не должен расти, watching: disabled
curl -I http://localhost:3000     # стабильно 200/307, без зависаний
```

## 3. Обновление (после `git push`)

```bash
cd /opt/ProjectRA
git pull
npm ci
npx prisma generate
npx prisma db push         # если менялась схема БД
npm run build
pm2 reload ecosystem.config.cjs
```

## 4. nginx (важно для SSE!)

Приложение держит долгоживущие SSE-стримы (доски, чат, уведомления, онлайн).
nginx по умолчанию их буферизует → вкладка «бесконечно грузится». Нужен
`proxy_buffering off`. И `server_name` должен совпадать с доменом сертификата.

```nginx
server {
    listen 80;
    server_name projectra.ru;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name projectra.ru;            # совпадает с доменом сертификата

    ssl_certificate     /etc/letsencrypt/live/projectra.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/projectra.ru/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_buffering off;     # критично для SSE
        proxy_cache off;
        proxy_read_timeout 1h;   # стримы долгоживущие
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

## Типичные проблемы

- **Бесконечная загрузка / таймаут, в логах много «✓ Ready» подряд** — pm2 в режиме
  `--watch` рестартит приложение на каждую запись в SQLite/.next. Запускай через
  `ecosystem.config.cjs` (там `watch: false`), не передавай `--watch`.
- **`AUTH_SECRET is not set`** — не задан `AUTH_SECRET` в `.env`.
- **`next dev` вместо прод-режима** (появляется папка `.next/dev`, тормоза) — нужно
  `npm run build` + `next start` (как в ecosystem.config.cjs), а не `npm run dev`.
- **502 Bad Gateway** — приложение не слушает :3000 (`pm2 logs projectra`).
- **Дубли напоминаний** — запущено больше одной ноды (cluster mode). Держи
  `exec_mode: fork`, `instances: 1`.
