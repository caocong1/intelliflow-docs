import { describe, expect, test } from "vitest";

import {
  hasExplicitLiveClaudeEnv,
  pickLiveClaudeModel,
  type LiveClaudeModelRow,
} from "./live-config";

const SAMPLE_ROWS: LiveClaudeModelRow[] = [
  {
    modelId: "kimi-k2.5",
    displayName: "Kimi K2.5",
    providerName: "Volcengine Claude Gateway",
    providerType: "claude_agent_sdk",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    apiKey: "secret-1",
  },
  {
    modelId: "doubao-seed-2.0-pro",
    displayName: "Doubao Seed 2.0 Pro",
    providerName: "Volcengine Claude Gateway",
    providerType: "claude_agent_sdk",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    apiKey: "secret-2",
  },
  {
    modelId: "gpt-4.1",
    displayName: "GPT 4.1",
    providerName: "OpenAI Compatible",
    providerType: "openai_compatible",
    baseUrl: "https://example.com/v1",
    apiKey: "secret-3",
  },
];

describe("hasExplicitLiveClaudeEnv", () => {
  test("returns true when base url and api key exist", () => {
    expect(
      hasExplicitLiveClaudeEnv({
        ANTHROPIC_BASE_URL: "https://ark.cn-beijing.volces.com/api/coding",
        ANTHROPIC_API_KEY: "secret",
      }),
    ).toBe(true);
  });

  test("returns false when base url or key is missing", () => {
    expect(hasExplicitLiveClaudeEnv({ ANTHROPIC_BASE_URL: "https://ark.cn-beijing.volces.com" })).toBe(false);
    expect(hasExplicitLiveClaudeEnv({ ANTHROPIC_API_KEY: "secret" })).toBe(false);
  });
});

describe("pickLiveClaudeModel", () => {
  test("picks the first claude_agent_sdk row by default", () => {
    const hit = pickLiveClaudeModel(SAMPLE_ROWS);
    expect(hit?.modelId).toBe("kimi-k2.5");
  });

  test("picks the preferred model when present", () => {
    const hit = pickLiveClaudeModel(SAMPLE_ROWS, "doubao-seed-2.0-pro");
    expect(hit?.displayName).toBe("Doubao Seed 2.0 Pro");
  });

  test("ignores non-claude-agent rows", () => {
    const hit = pickLiveClaudeModel([SAMPLE_ROWS[2]]);
    expect(hit).toBeNull();
  });

  test("requires an api key on the selected row", () => {
    const hit = pickLiveClaudeModel([
      {
        ...SAMPLE_ROWS[0],
        apiKey: null,
      },
    ]);
    expect(hit).toBeNull();
  });
});
