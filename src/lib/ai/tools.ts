import "server-only";

import type Groq from "groq-sdk";
import { ZodError } from "zod";
import { agentRequestSchema } from "@/lib/agent/contracts";
import {
  AgentServiceError,
  ProjectraAgentService,
} from "@/lib/agent/service";

type JsonSchema = Record<string, unknown>;

const id = { type: "string", minLength: 1, maxLength: 128 };
const date = {
  type: ["string", "null"],
  description: "Дата YYYY-MM-DD, UTC timestamp ISO-8601 или null для очистки.",
};
const priority = {
  type: "string",
  enum: ["NOT_URGENT", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
};

function functionTool(
  name: string,
  description: string,
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): Groq.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

export const PROJECTRA_AI_TOOLS: Groq.Chat.ChatCompletionTool[] = [
  functionTool("list_projects", "Показать доступные текущему пользователю доски ProjectRA.", {
    query: { type: "string", maxLength: 120 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  }),
  functionTool("get_project", "Получить колонки, статусы и возможности конкретной доски.", {
    projectId: id,
  }, ["projectId"]),
  functionTool("list_project_members", "Получить сотрудников доски и их точные ID перед назначением.", {
    projectId: id,
  }, ["projectId"]),
  functionTool("search_tasks", "Найти доступные задачи по заголовку или описанию.", {
    query: { type: "string", minLength: 2, maxLength: 300 },
    projectId: id,
    assigneeId: id,
    status: { type: "string", minLength: 1, maxLength: 80 },
    includeCompleted: { type: "boolean" },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  }, ["query"]),
  functionTool("get_task", "Прочитать задачу, описание, сроки, исполнителей, комментарии и доступные действия.", {
    taskId: id,
    commentsLimit: { type: "integer", minimum: 0, maximum: 100 },
  }, ["taskId"]),
  functionTool("list_my_tasks", "Показать задачи, назначенные текущему пользователю.", {
    projectId: id,
    includeCompleted: { type: "boolean" },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  }),
  functionTool("get_project_summary", "Получить сводку доски по срокам, статусам и приоритетам.", {
    projectId: id,
  }, ["projectId"]),
  functionTool("create_task", "Создать одну задачу. Перед вызовом нужно определить точные ID доски, колонки и исполнителей. Поле description поддерживает Markdown.", {
    projectId: id,
    columnId: id,
    title: { type: "string", minLength: 1, maxLength: 240 },
    description: {
      type: "string",
      maxLength: 20_000,
      description: "Описание задачи в Markdown: заголовки, списки, чек-листы, выделение, ссылки и блоки кода.",
    },
    priority,
    startDate: { type: "string", description: "Дата YYYY-MM-DD или UTC timestamp ISO-8601." },
    dueDate: { type: "string", description: "Дата YYYY-MM-DD или UTC timestamp ISO-8601." },
    assigneeIds: { type: "array", items: id, maxItems: 20 },
    isPersonal: { type: "boolean" },
  }, ["projectId", "title"]),
  functionTool("update_task", "Изменить только явно указанные поля одной задачи. При изменении description используй Markdown и сохраняй полезное существующее форматирование.", {
    taskId: id,
    title: { type: "string", minLength: 1, maxLength: 240 },
    description: {
      type: ["string", "null"],
      maxLength: 20_000,
      description: "Новое описание в Markdown или null для очистки.",
    },
    priority,
    startDate: date,
    dueDate: date,
    isPersonal: { type: "boolean" },
  }, ["taskId"]),
  functionTool("assign_task", "Назначить одного сотрудника по точным taskId и userId.", {
    taskId: id,
    userId: id,
  }, ["taskId", "userId"]),
  functionTool("unassign_task", "Снять одного исполнителя по точным taskId и userId.", {
    taskId: id,
    userId: id,
  }, ["taskId", "userId"]),
  functionTool("add_task_comment", "Добавить к задаче комментарий от текущего пользователя. Комментарий поддерживает Markdown.", {
    taskId: id,
    body: {
      type: "string",
      minLength: 1,
      maxLength: 10_000,
      description: "Текст комментария в Markdown: списки, выделение, ссылки, цитаты и блоки кода.",
    },
  }, ["taskId", "body"]),
  functionTool("move_task", "Переместить задачу в точную колонку той же доски.", {
    taskId: id,
    targetColumnId: id,
  }, ["taskId", "targetColumnId"]),
  functionTool("set_task_status", "Задать точный статус задачи без перемещения; status=auto возвращает статус колонки.", {
    taskId: id,
    status: { type: "string", minLength: 1, maxLength: 80 },
  }, ["taskId", "status"]),
  functionTool("set_my_task_completion", "Установить или снять подтверждение выполнения только у текущего авторизованного исполнителя.", {
    taskId: id,
    completed: { type: "boolean" },
  }, ["taskId", "completed"]),
  functionTool("complete_task", "Перенести задачу в системную колонку завершённых после подтверждения всех исполнителей.", {
    taskId: id,
  }, ["taskId"]),
];

const WRITE_TOOLS = new Set([
  "create_task",
  "update_task",
  "assign_task",
  "unassign_task",
  "add_task_comment",
  "move_task",
  "set_task_status",
  "set_my_task_completion",
  "complete_task",
]);

const ACTION_LABELS: Record<string, string> = {
  create_task: "Задача создана",
  update_task: "Задача обновлена",
  assign_task: "Исполнитель назначен",
  unassign_task: "Исполнитель снят",
  add_task_comment: "Комментарий добавлен",
  move_task: "Задача перемещена",
  set_task_status: "Статус изменён",
  set_my_task_completion: "Моя отметка выполнения изменена",
  complete_task: "Задача завершена",
};

const PROGRESS_LABELS: Record<string, string> = {
  list_projects: "Получаю список доступных досок",
  get_project: "Читаю колонки и настройки доски",
  list_project_members: "Ищу сотрудников доски",
  search_tasks: "Ищу подходящие задачи",
  get_task: "Читаю задачу, описание и комментарии",
  list_my_tasks: "Получаю ваши актуальные задачи",
  get_project_summary: "Собираю сводку по доске",
  create_task: "Создаю задачу",
  update_task: "Обновляю задачу",
  assign_task: "Назначаю исполнителя",
  unassign_task: "Снимаю исполнителя",
  add_task_comment: "Добавляю Markdown-комментарий",
  move_task: "Перемещаю задачу",
  set_task_status: "Изменяю статус задачи",
  set_my_task_completion: "Ставлю вашу отметку выполнения",
  complete_task: "Завершаю задачу",
};

export type AiVisibleAction = {
  tool: string;
  label: string;
  success: boolean;
  href?: string;
};

export type AiToolExecution = {
  content: string;
  action?: AiVisibleAction;
};

export async function executeProjectraAiTool(
  service: ProjectraAgentService,
  name: string,
  rawArguments: string,
): Promise<AiToolExecution> {
  const write = WRITE_TOOLS.has(name);
  try {
    const input = JSON.parse(rawArguments) as unknown;
    const request = agentRequestSchema.parse({ operation: name, input });
    const result = await service.execute(request);
    return {
      content: compactJson({ ok: true, data: result }),
      ...(write
        ? {
            action: {
              tool: name,
              label: ACTION_LABELS[name] ?? "Изменение выполнено",
              success: true,
              ...taskHref(result),
            },
          }
        : {}),
    };
  } catch (error) {
    const message = safeToolError(error);
    return {
      content: compactJson({ ok: false, error: message }),
      ...(write
        ? {
            action: {
              tool: name,
              label: `${ACTION_LABELS[name] ?? "Изменение"}: ${message}`,
              success: false,
            },
          }
        : {}),
    };
  }
}

export function isWriteAiTool(name: string) {
  return WRITE_TOOLS.has(name);
}

export function aiToolProgressLabel(name: string) {
  return PROGRESS_LABELS[name] ?? `Выполняю действие: ${name}`;
}

function safeToolError(error: unknown) {
  if (error instanceof AgentServiceError) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Некорректные параметры инструмента.";
  }
  if (error instanceof SyntaxError) return "Модель передала некорректный JSON.";
  console.error("ProjectRA AI tool failed", error);
  return "ProjectRA не смогла выполнить операцию из-за внутренней ошибки.";
}

function compactJson(value: unknown) {
  const serialized = JSON.stringify(value);
  return serialized.length <= 24_000
    ? serialized
    : `${serialized.slice(0, 23_900)}…`;
}

function taskHref(result: unknown): { href?: string } {
  if (!result || typeof result !== "object") return {};
  const row = result as Record<string, unknown>;
  const taskId = typeof row.taskId === "string"
    ? row.taskId
    : typeof row.id === "string"
      ? row.id
      : undefined;
  const project = row.project && typeof row.project === "object"
    ? row.project as Record<string, unknown>
    : null;
  const projectId = typeof row.projectId === "string"
    ? row.projectId
    : typeof project?.id === "string"
      ? project.id
      : undefined;
  return taskId && projectId
    ? { href: `/boards/${encodeURIComponent(projectId)}?task=${encodeURIComponent(taskId)}` }
    : {};
}
