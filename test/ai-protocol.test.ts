import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCompletionMessage } from "../src/lib/ai/protocol";

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
