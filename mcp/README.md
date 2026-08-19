# ProjectRA MCP на Ubuntu 24.04

MCP-сервер даёт Codex доступ к ProjectRA: агент читает доски, задачи, описания и комментарии, создаёт и редактирует задачи, назначает исполнителей, добавляет комментарии, меняет статусы и перемещает карточки.

Эта инструкция рассчитана на следующую схему:

- ProjectRA и Codex CLI работают на одном сервере с Ubuntu 24.04;
- ProjectRA доступна на этом сервере по `http://127.0.0.1:3000`;
- репозиторий расположен в `/opt/ProjectRA`;
- MCP находится в `/opt/ProjectRA/mcp`.

Пути Linux чувствительны к регистру: `/opt/ProjectRA` и `/opt/projectra` — разные каталоги. Если каталог другой, замените `/opt/ProjectRA` во всех командах на свой путь.

В терминах MCP `project` — это доска `Board` в ProjectRA. MCP не подключается к PostgreSQL и Prisma напрямую: все операции проходят через защищённый API `POST /api/agent` основного приложения.

## Возможности и ограничения

- Все команды выполняются от имени пользователя, которому принадлежит bearer-токен.
- ProjectRA проверяет активность пользователя, разрешения, роль на доске и приватность задачи.
- Личные доски и задачи не становятся видимыми через MCP без соответствующего права ProjectRA.
- Изменения записываются в историю задачи; назначения и упоминания создают уведомления; интерфейс получает realtime-событие.
- Нет инструментов удаления, массовых операций и управления пользователями, ролями или разрешениями.
- Перед записью агент должен получить точные ID проекта, колонки, задачи и сотрудника.

## Требования

На Ubuntu должны быть установлены:

- Node.js 22 и npm;
- `curl`;
- `jq` для получения токена из JSON;
- работающая ProjectRA.

Проверка версий:

```bash
node --version
npm --version
curl --version
jq --version
```

Если ProjectRA запускается через Docker Compose, проверьте контейнеры и локальный порт:

```bash
cd /opt/ProjectRA
docker compose ps
curl -fsS http://127.0.0.1:3000/login >/dev/null
echo "ProjectRA доступна"
```

## Важно: обновляется весь ProjectRA

Для MCP недостаточно скопировать только каталог `mcp`. Основное приложение также должно содержать:

```text
/opt/ProjectRA/src/app/api/agent/route.ts
/opt/ProjectRA/src/app/api/agent/token/route.ts
/opt/ProjectRA/src/lib/agent/contracts.ts
/opt/ProjectRA/src/lib/agent/policy.ts
/opt/ProjectRA/src/lib/agent/service.ts
```

Кроме того, обновлены `src/lib/auth.ts` и `src/lib/session.ts`. После доставки всей версии проекта пересоберите контейнер приложения:

```bash
cd /opt/ProjectRA

test -f src/lib/agent/policy.ts
test -f src/app/api/agent/route.ts
test -f src/app/api/agent/token/route.ts

docker compose up -d --build app
docker compose ps
```

Проверьте новый API. Для пустого запроса ожидается HTTP `400`, а не `404`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{}' \
  http://127.0.0.1:3000/api/agent/token
```

## Установка MCP

```bash
cd /opt/ProjectRA/mcp
npm ci
npm run build
npm test
```

После сборки должны существовать файлы:

```text
/opt/ProjectRA/mcp/dist/stdio.js
/opt/ProjectRA/mcp/dist/http.js
```

## Получение токена ProjectRA

Токен выпускается для обычной учётной записи ProjectRA и наследует все её права.

```bash
read -r -p "Логин ProjectRA: " PROJECTRA_LOGIN
read -r -s -p "Пароль ProjectRA: " PROJECTRA_PASSWORD
echo

TOKEN_RESPONSE="$({
  jq -n \
    --arg username "$PROJECTRA_LOGIN" \
    --arg password "$PROJECTRA_PASSWORD" \
    '{username: $username, password: $password}'
} | curl -fsS \
  -X POST \
  -H 'Content-Type: application/json' \
  --data-binary @- \
  http://127.0.0.1:3000/api/agent/token)"

unset PROJECTRA_PASSWORD
export PROJECTRA_TOKEN="$(jq -er '.data.accessToken' <<<"$TOKEN_RESPONSE")"
unset TOKEN_RESPONSE

echo "Токен получен"
```

Токен действует 30 дней и перестаёт работать, если пользователя отключили. Не добавляйте его в Git, `config.toml`, аргументы команды или unit-файл systemd.

Чтобы сохранить токен для следующих сеансов текущего Linux-пользователя:

```bash
install -d -m 700 "$HOME/.config/projectra-mcp"
printf 'export PROJECTRA_TOKEN=%q\n' "$PROJECTRA_TOKEN" \
  > "$HOME/.config/projectra-mcp/token.env"
chmod 600 "$HOME/.config/projectra-mcp/token.env"
```

Перед запуском Codex загрузите его:

```bash
source "$HOME/.config/projectra-mcp/token.env"
```

## Рекомендуемый вариант: stdio

Когда Codex CLI и ProjectRA находятся на одном Ubuntu-хосте, отдельный HTTP-сервис MCP не требуется. Codex запускает `dist/stdio.js` сам и общается с ним через stdin/stdout.

Откройте пользовательский конфиг Codex:

```bash
mkdir -p "$HOME/.codex"
nano "$HOME/.codex/config.toml"
```

Добавьте:

```toml
[mcp_servers.projectra]
command = "node"
args = ["/opt/ProjectRA/mcp/dist/stdio.js"]
cwd = "/opt/ProjectRA/mcp"
env = { PROJECTRA_BASE_URL = "http://127.0.0.1:3000" }
env_vars = ["PROJECTRA_TOKEN"]
startup_timeout_sec = 20
tool_timeout_sec = 60
required = true
default_tools_approval_mode = "writes"
```

Режим `writes` просит подтверждение для изменяющих инструментов, но разрешает чтение без подтверждения. После проверки работы можно изменить политику одобрений под свой сценарий.

Запуск и проверка:

```bash
source "$HOME/.config/projectra-mcp/token.env"
codex mcp list
codex
```

В открытом Codex выполните `/mcp`. В списке должен появиться сервер `projectra`.

### Быстрая проверка stdio без Codex

```bash
cd /opt/ProjectRA/mcp
source "$HOME/.config/projectra-mcp/token.env"
PROJECTRA_BASE_URL=http://127.0.0.1:3000 node dist/stdio.js
```

Процесс будет ожидать MCP-сообщения через stdin. Сообщение `ProjectRA MCP running on stdio.` в stderr означает, что сервер запустился. Завершить его можно сочетанием `Ctrl+C`.

## Альтернатива: постоянный Streamable HTTP

Этот вариант нужен, если к одному MCP-процессу должны подключаться несколько локальных процессов или вы хотите управлять им через systemd. На одном хосте порт остаётся закрытым на `127.0.0.1`.

Создайте файл окружения:

```bash
sudo install -m 600 /dev/null /etc/projectra-mcp.env
sudo nano /etc/projectra-mcp.env
```

Содержимое:

```dotenv
PROJECTRA_BASE_URL=http://127.0.0.1:3000
MCP_HOST=127.0.0.1
MCP_PORT=3100
```

`PROJECTRA_TOKEN` сервису HTTP не нужен: Codex передаёт токен в каждом запросе.

Создайте `/etc/systemd/system/projectra-mcp.service`:

```ini
[Unit]
Description=ProjectRA MCP server
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=projectra
Group=projectra
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

Замените `User` и `Group`, если ProjectRA развёрнута не от пользователя `projectra`. Проверьте фактический путь Node.js командой `command -v node` и при необходимости исправьте `ExecStart`.

Запустите сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now projectra-mcp
sudo systemctl status projectra-mcp --no-pager
curl -fsS http://127.0.0.1:3100/health
```

Для HTTP-варианта конфигурация Codex выглядит так:

```toml
[mcp_servers.projectra]
url = "http://127.0.0.1:3100/mcp"
bearer_token_env_var = "PROJECTRA_TOKEN"
startup_timeout_sec = 20
tool_timeout_sec = 60
required = true
default_tools_approval_mode = "writes"
```

После изменения конфигурации:

```bash
source "$HOME/.config/projectra-mcp/token.env"
codex mcp list
```

Не открывайте порт `3100` в UFW и не публикуйте его через Nginx, если Codex работает на том же сервере.

## Инструменты агента

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
| `move_task` | Перемещение в точную колонку той же доски |
| `set_task_status` | Ручной статус или `auto` для статуса колонки |
| `complete_task` | Завершение с проверкой подтверждений исполнителей |

Также доступны read-only resources `project://{projectId}` и `task://{taskId}`, а также prompts `project_review`, `task_analysis` и `project_summary`.

## Обновление

После получения новой версии пересоберите и основное приложение, и MCP:

```bash
cd /opt/ProjectRA
docker compose up -d --build app

cd /opt/ProjectRA/mcp
npm ci
npm run build
npm test
```

Для stdio больше ничего делать не нужно: Codex запустит новую сборку при следующем соединении.

Для systemd-варианта перезапустите сервис:

```bash
sudo systemctl restart projectra-mcp
sudo journalctl -u projectra-mcp -n 100 --no-pager
```

## Диагностика

### `ProjectRA is unavailable`

```bash
curl -v http://127.0.0.1:3000/login
docker compose -f /opt/ProjectRA/docker-compose.yml ps
```

Проверьте `PROJECTRA_BASE_URL` и доступность порта ProjectRA с самого Ubuntu-хоста.

### `invalid or expired token` или HTTP 401

Получите новый токен, обновите `$HOME/.config/projectra-mcp/token.env`, затем заново выполните `source` и перезапустите Codex.

### Codex не видит `PROJECTRA_TOKEN`

```bash
source "$HOME/.config/projectra-mcp/token.env"
test -n "$PROJECTRA_TOKEN" && echo "Переменная загружена"
codex mcp list
```

Codex должен запускаться из оболочки, в которой загружена переменная.

### Ошибка systemd

```bash
sudo systemctl status projectra-mcp --no-pager
sudo journalctl -u projectra-mcp -n 100 --no-pager
command -v node
```

## Документация

- [OpenAI Docs: подключение MCP к Codex](https://learn.chatgpt.com/docs/extend/mcp)
- [MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)
- [Streamable HTTP transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html)
