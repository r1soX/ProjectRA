import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCompletionMessage } from "../src/lib/ai/protocol";
import {
  claimsCompletedMutation,
  hasExplicitWriteIntent,
  isRetryRequest,
} from "../src/lib/ai/intent";
import {
  agentTextIncludes,
  normalizeAgentSearchText,
} from "../src/lib/agent/search-text";
import { messageContent } from "../src/lib/ai/message-context";

test("selected references add trusted exact IDs to the model context", () => {
  const content = messageContent({
    role: "USER",
    body: "Создай задачу на этой доске",
    references: [{
      type: "project",
      id: "project-42",
      label: "Задачи (Смолин В.С.)",
      marker: "#Задачи (Смолин В.С.)",
    }],
  });

  assert.match(content, /<projectra_references>/);
  assert.match(content, /"id":"project-42"/);
  assert.doesNotMatch(messageContent({ role: "ASSISTANT", body: "Готово", references: [] }), /projectra_references/);
});

test("agent search ignores punctuation and Russian spelling variants", () => {
  assert.equal(
    agentTextIncludes("Задачи (Смолин В.С.)", "Задачи Смолин В.С."),
    true,
  );
  assert.equal(
    agentTextIncludes("Идеи к реализации автоматизации", "Идеи для реализации"),
    true,
  );
  assert.equal(
    normalizeAgentSearchText("Завершённые-задачи"),
    "завершенные задачи",
  );
});

test("OpenRouter tool metadata is preserved for the next round", () => {
  const payload = {
    model: "openai/gpt-oss-120b",
    choices: [{
      message: {
        content: null,
        tool_calls: [{
          id: "call-1",
          type: "function",
          function: { name: "get_project", arguments: '{"projectId":"p1"}' },
          extra_content: {
            google: { thought_signature: "opaque-signature" },
          },
        }],
      },
    }],
  };

  const message = normalizeCompletionMessage(payload);

  assert.deepEqual(message?.tool_calls?.[0]?.extra_content, {
    google: { thought_signature: "opaque-signature" },
  });
});

test("OpenRouter reasoning blocks are preserved exactly", () => {
  const reasoningDetails = [{
    type: "reasoning.encrypted",
    data: "opaque-reasoning-data",
  }];
  const payload = {
    choices: [{
      message: {
        content: null,
        reasoning: "Checking the available project",
        reasoning_details: reasoningDetails,
        tool_calls: [{
          id: "call-2",
          type: "function",
          function: { name: "list_projects", arguments: "{}" },
        }],
      },
    }],
  };

  const message = normalizeCompletionMessage(payload);

  assert.equal(message?.reasoning, "Checking the available project");
  assert.deepEqual(message?.reasoning_details, reasoningDetails);
});

test("invalid tool calls are discarded without losing text", () => {
  const payload = {
    choices: [{
      message: {
        content: "Готово",
        tool_calls: [{ id: "broken", function: { name: "get_project" } }],
      },
    }],
  };

  const message = normalizeCompletionMessage(payload);

  assert.equal(message?.content, "Готово");
  assert.equal(message?.tool_calls, undefined);
});

test("explicit task mutations require a real write tool", () => {
  assert.equal(hasExplicitWriteIntent("Создай задачу Подготовить отчёт"), true);
  assert.equal(hasExplicitWriteIntent("Назначь Ивана исполнителем"), true);
  assert.equal(hasExplicitWriteIntent("Покажи актуальные задачи"), false);
  assert.equal(hasExplicitWriteIntent("Предложи задачу, но не создавай её"), false);
  assert.equal(hasExplicitWriteIntent("Как создать задачу?"), false);
  assert.equal(isRetryRequest("Попробуй ещё раз"), true);
  assert.equal(isRetryRequest("Покажи задачи"), false);
});

test("unsupported success claims are recognized", () => {
  assert.equal(claimsCompletedMutation("Готово."), true);
  assert.equal(claimsCompletedMutation("Задача успешно создана"), true);
  assert.equal(claimsCompletedMutation("Не удалось создать задачу"), false);
  assert.equal(claimsCompletedMutation("Уточните, на какой доске создать задачу"), false);
});
