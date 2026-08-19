# ProjectRA MCP: сервер Ubuntu 24.04, Codex на локальном ПК

Эта инструкция рассчитана на конкретную схему:

```text
Codex на Windows
    -> HTTPS https://projectra.ru/mcp
    -> Nginx на VPS
    -> ProjectRA MCP 127.0.0.1:3100
    -> ProjectRA API 127.0.0.1:3000
```

ProjectRA и MCP находятся на одном VPS в `/opt/ProjectRA`, но Codex запускается на локальном ПК. Поэтому используется Streamable HTTP, а не `stdio`. Отдельный поддомен не требуется: Nginx отправляет только точный путь `/mcp` в MCP, остальные запросы продолжает обслуживать ProjectRA.

MCP позволяет Codex читать доски, задачи, описания и комментарии, создавать и редактировать задачи, назначать сотрудников, добавлять комментарии, менять статус и перемещать карточки. Все действия выполняются с правами пользователя, которому принадлежит bearer-токен.

## 1. Что должно быть загружено на VPS

Недостаточно загрузить только каталог `mcp`. Основное приложение ProjectRA тоже содержит новый агентский API.

Проверьте на VPS:

```bash
cd /opt/ProjectRA

test -f src/app/api/agent/route.ts
test -f src/app/api/agent/token/route.ts
test -f src/lib/agent/contracts.ts
test -f src/lib/agent/policy.ts
test -f src/lib/agent/service.ts
test -f mcp/src/http.ts

grep -n '"mcp"' tsconfig.json
tail -n 5 .dockerignore
```

Кроме перечисленных файлов обновлены `src/lib/auth.ts`, `src/lib/session.ts`, корневой `tsconfig.json` и `.dockerignore`. В `tsconfig.json` каталог `mcp` исключён из сборки Next.js, а в `.dockerignore` должна быть строка `mcp`. Это отделяет сборку ProjectRA от самостоятельного Node.js-пакета MCP.

Linux чувствителен к регистру: правильный путь — `/opt/ProjectRA`, а не `/opt/projectra`.

## 2. Проверить ProjectRA и собрать MCP

На VPS под `root`:

```bash
cd /opt/ProjectRA
docker compose ps
curl -fsS http://127.0.0.1:3000/login >/dev/null
echo "ProjectRA доступна"

cd /opt/ProjectRA/mcp
npm ci
npm run build
npm test
```

Все test-файлы должны завершиться успешно. После сборки должны существовать:

```bash
test -f /opt/ProjectRA/mcp/dist/http.js
test -f /opt/ProjectRA/mcp/dist/stdio.js
```

Тест `policy.test.ts` импортирует политику из основного приложения. Поэтому ошибка `Cannot find module '../../src/lib/agent/policy'` означает, что на VPS загружен не весь проект либо файл лежит не в `/opt/ProjectRA/src/lib/agent/policy.ts`.

## 3. Пересобрать контейнер ProjectRA

Новый `/api/agent` находится в основном приложении, поэтому контейнер `app` нужно пересобрать:

```bash
cd /opt/ProjectRA
docker compose up -d --build app
docker compose ps
docker compose logs --tail=100 app
```

Команду `docker compose down` выполнять не нужно — база данных продолжит работать.

Проверьте новый endpoint. Для пустого тела ожидается HTTP `400`, но не `404`:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{}' \
  http://127.0.0.1:3000/api/agent/token
```

Если получен `404`, контейнер собран из старой версии проекта или в Docker build context отсутствуют новые API-файлы.

## 4. Запустить MCP как systemd-сервис

Сначала проверьте путь Node.js:

```bash
command -v node
node --version
```

Далее предполагается, что команда вернула `/usr/bin/node`. Если путь другой, укажите фактический абсолютный путь в `ExecStart` ниже. Node.js должен быть установлен системно и быть доступен не только пользователю `root`.

Создайте файл окружения:

```bash
install -m 600 /dev/null /etc/projectra-mcp.env
nano /etc/projectra-mcp.env
```

Содержимое:

```dotenv
PROJECTRA_BASE_URL=http://127.0.0.1:3000
MCP_HOST=127.0.0.1
MCP_PORT=3100
MCP_ALLOWED_HOSTS=projectra.ru,127.0.0.1,localhost
```

`PROJECTRA_TOKEN` на VPS в этот файл добавлять не нужно. MCP получает токен от локального Codex в каждом запросе и проверяет его через ProjectRA.

Создайте unit-файл:

```bash
nano /etc/systemd/system/projectra-mcp.service
```

Содержимое:

```ini
[Unit]
Description=ProjectRA MCP Streamable HTTP server
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
DynamicUser=true
WorkingDirectory=/opt/ProjectRA/mcp
Environment=NODE_ENV=production
EnvironmentFile=/etc/projectra-mcp.env
ExecStart=/usr/bin/node /opt/ProjectRA/mcp/dist/http.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectControlGroups=true
ProtectKernelTunables=true

[Install]
WantedBy=multi-user.target
```

Запустите сервис:

```bash
systemctl daemon-reload
systemctl enable --now projectra-mcp
systemctl status projectra-mcp --no-pager
curl -fsS -H 'Host: projectra.ru' http://127.0.0.1:3100/health
```

Ожидаемый ответ health-check:

```json
{"ok":true,"service":"projectra-mcp"}
```

Убедитесь, что MCP слушает только loopback-интерфейс:

```bash
ss -lntp | grep ':3100'
```

В выводе должен быть `127.0.0.1:3100`, а не `0.0.0.0:3100`. Порт `3100` не нужно открывать в UFW или Docker.

## 5. Добавить `/mcp` в Nginx

Сначала найдите файл с активным HTTPS-блоком домена:

```bash
nginx -T 2>/dev/null | grep -n -B 3 -A 12 'server_name projectra.ru'
```

Откройте найденный файл в `/etc/nginx/sites-available/` или `/etc/nginx/conf.d/`. В существующий блок `server`, где настроены `listen 443 ssl` и `server_name projectra.ru`, добавьте точный location:

```nginx
location = /mcp {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    client_max_body_size 1m;
}
```

Важно:

- добавляйте location в уже существующий HTTPS-блок `projectra.ru`;
- `location = /mcp` является точным совпадением и не перехватывает остальной сайт;
- в `proxy_pass` не дописывайте `/mcp`: исходный URI уже равен `/mcp`;
- не заменяйте существующий `location /`, который ведёт на ProjectRA.

Проверьте конфигурацию и только затем перезагрузите Nginx:

```bash
nginx -t
systemctl reload nginx
```

Проверьте маршрут с VPS:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' https://projectra.ru/mcp
```

Без токена ожидается HTTP `401`. Это означает, что HTTPS, Nginx и MCP связаны правильно.

- `404` — запрос попал не в тот Nginx location;
- `502` — Nginx не может подключиться к MCP на `127.0.0.1:3100`;
- `403` — значение `Host` отсутствует в `MCP_ALLOWED_HOSTS`;
- `401` — нормальный ответ для запроса без токена.

## 6. Получить токен на локальном Windows-ПК

Откройте новую PowerShell-сессию на локальном ПК:

```powershell
$projectraLogin = Read-Host "Логин ProjectRA"
$projectraPassword = Read-Host "Пароль ProjectRA" -AsSecureString
$projectraCredential = [pscredential]::new($projectraLogin, $projectraPassword)

$projectraBody = @{
    username = $projectraLogin
    password = $projectraCredential.GetNetworkCredential().Password
} | ConvertTo-Json

$projectraResponse = Invoke-RestMethod `
    -Uri "https://projectra.ru/api/agent/token" `
    -Method Post `
    -ContentType "application/json" `
    -Body $projectraBody

$env:PROJECTRA_TOKEN = $projectraResponse.data.accessToken
Remove-Variable projectraBody, projectraResponse, projectraCredential, projectraPassword

if ($env:PROJECTRA_TOKEN) { "Токен получен" }
```

Команды не выводят токен на экран. Токен действует 30 дней, наследует права этой учётной записи и перестаёт работать, если пользователь ProjectRA отключён.

Для постоянного использования можно сохранить токен в пользовательскую переменную окружения Windows:

```powershell
[Environment]::SetEnvironmentVariable(
    "PROJECTRA_TOKEN",
    $env:PROJECTRA_TOKEN,
    "User"
)
```

После этого полностью закройте и заново откройте Codex, чтобы новый процесс увидел переменную. Не записывайте сам токен в Git, README или `config.toml`.

Проверьте токен прямым запросом к ProjectRA:

```powershell
$whoamiBody = @{ operation = "whoami"; input = @{} } | ConvertTo-Json -Depth 3

Invoke-RestMethod `
    -Uri "https://projectra.ru/api/agent" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $env:PROJECTRA_TOKEN" } `
    -ContentType "application/json" `
    -Body $whoamiBody
```

Ожидается объект с `ok = true` и данными пользователя.

## 7. Подключить MCP к локальному Codex

Откройте пользовательский конфиг Codex на Windows:

```powershell
notepad "$env:USERPROFILE\.codex\config.toml"
```

Добавьте:

```toml
[mcp_servers.projectra]
url = "https://projectra.ru/mcp"
bearer_token_env_var = "PROJECTRA_TOKEN"
startup_timeout_sec = 20
tool_timeout_sec = 60
required = true
default_tools_approval_mode = "writes"
```

Здесь не должно быть `command`, `args`, `cwd` или Linux-путей: они используются только для локального `stdio`, а ваш Codex подключается к удалённому HTTP-серверу.

Режим `writes` оставляет чтение без подтверждения и просит подтверждение перед изменяющими инструментами. После сохранения полностью перезапустите Codex.

Если установлен Codex CLI, проверьте:

```powershell
codex mcp list
```

В Codex также можно выполнить `/mcp`. Сервер `projectra` должен быть подключён.

## 8. Первая безопасная проверка агента

Сначала попросите выполнить только чтение:

```text
Покажи доступные мне доски ProjectRA и кратко опиши их, ничего не изменяй.
```

Затем проверьте изменение на тестовой задаче:

```text
Найди тестовую доску, покажи её колонки и сотрудников. Ничего не создавай, пока я не подтвержу.
```

После подтверждения можно дать команду:

```text
Создай на тестовой доске задачу «Проверка MCP», добавь описание, назначь меня и напиши комментарий «Создано через Codex».
```

## 9. Инструменты агента

| Инструмент | Назначение |
| --- | --- |
| `list_projects` | Доступные доски и краткие счётчики |
| `get_project` | Колонки, статусы, роль и доступные действия |
| `list_project_members` | Сотрудники, которых можно назначать |
| `search_tasks` | Поиск по заголовку и описанию |
| `get_task` | Задача, описание, исполнители и комментарии |
| `list_my_tasks` | Задачи текущего пользователя |
| `get_project_summary` | Сводка по срокам, статусам и приоритетам |
| `create_task` | Создание задачи с описанием, сроками и исполнителями |
| `update_task` | Изменение полей задачи |
| `assign_task` / `unassign_task` | Назначение и снятие исполнителя |
| `add_task_comment` | Комментарий с поддержкой `@username` |
| `move_task` | Перемещение в колонку той же доски |
| `set_task_status` | Ручной статус или статус колонки |
| `set_my_task_completion` | Установить или снять отметку выполнения текущего авторизованного исполнителя |
| `complete_task` | Завершение с проверкой подтверждений исполнителей |

Удаление, массовые операции и управление пользователями, ролями или разрешениями через MCP не предоставляются.

## 10. Обновление

После загрузки новой версии проекта на VPS:

```bash
cd /opt/ProjectRA
docker compose up -d --build app

cd /opt/ProjectRA/mcp
npm ci
npm run build
npm test
systemctl restart projectra-mcp
systemctl status projectra-mcp --no-pager
```

Nginx повторно менять не требуется, пока адрес остаётся `https://projectra.ru/mcp`.

## 11. Диагностика

Состояние и журнал MCP:

```bash
systemctl status projectra-mcp --no-pager
journalctl -u projectra-mcp -n 100 --no-pager
```

Проверка всей цепочки:

```bash
curl -fsS http://127.0.0.1:3000/login >/dev/null && echo ProjectRA_OK
curl -fsS -H 'Host: projectra.ru' http://127.0.0.1:3100/health && echo
curl -sS -o /dev/null -w 'PUBLIC_MCP_HTTP=%{http_code}\n' https://projectra.ru/mcp
```

Ожидается `ProjectRA_OK`, успешный JSON health-check и `PUBLIC_MCP_HTTP=401`.

Если Codex сообщает `invalid or expired token`, получите новый токен, обновите `PROJECTRA_TOKEN` и полностью перезапустите Codex.

## Документация

- [OpenAI: подключение MCP к Codex](https://learn.chatgpt.com/docs/extend/mcp)
- [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [Streamable HTTP transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html)
