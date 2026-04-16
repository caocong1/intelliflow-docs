import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../db/schema", () => ({
  desensitizeMappings: {},
  documents: {},
  modelCallLogs: {},
  models: {},
  nodeExecutions: {},
  providers: {},
  workflows: {},
}));
vi.mock("./model-call-live-session", () => ({
  applyDelta: vi.fn(),
  broadcast: vi.fn(),
  buildSnapshotEvent: vi.fn(),
  createSession: vi.fn(),
  disposeSessionLater: vi.fn(),
  flushNow: vi.fn(),
  markDone: vi.fn(),
  scheduleFlush: vi.fn(),
  setModelStatus: vi.fn(),
}));
vi.mock("./model-call-output", () => ({
  buildModelCallOutputData: vi.fn(),
  buildSelectedModelOutputData: vi.fn(),
  getModelCallManualFeedback: vi.fn(),
}));
vi.mock("./strategies", () => ({ getStrategy: vi.fn() }));

import type { ModelCallConfig } from "@intelliflow/shared";
import {
  appendTransientPromptToResolvedPrompt,
  validateModelOutput,
  validateSelectedModelCallOutputData,
} from "./model-call.service";
import { resolveRef } from "./variable-resolution";

const config: ModelCallConfig = {
  type: "model_call",
  displayName: "终稿委员会",
  modelIds: ["model-a", "model-b"],
  promptTemplate: "prompt",
  inputRefs: [],
  outputFormat: "markdown",
  namedOutputs: [
    {
      id: "slides_final",
      name: "最终幻灯片",
      format: "json",
      jsonSchema: {
        type: "object",
        properties: {
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                layout: { const: "title" },
                title: { type: "string" },
              },
              required: ["layout", "title"],
              additionalProperties: false,
            },
          },
        },
        required: ["slides"],
        additionalProperties: false,
      },
    },
    {
      id: "qa_report",
      name: "终稿质检报告",
      format: "markdown",
    },
  ],
};

function buildNamedOutputContent(slidesFinal: string) {
  return [
    "===OUTPUT:slides_final===",
    slidesFinal,
    "===END:slides_final===",
    "===OUTPUT:qa_report===",
    "# PASS",
    "===END:qa_report===",
  ].join("\n");
}

describe("validateModelOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid JSON named outputs with schema", () => {
    const content = buildNamedOutputContent(
      JSON.stringify({ slides: [{ layout: "title", title: "封面" }] }),
    );

    expect(validateModelOutput(content, config)).toEqual({ status: "completed" });
  });

  it("rejects missing named output artifacts with delimiter hint", () => {
    const content = ["===OUTPUT:qa_report===", "# PASS", "===END:qa_report==="].join("\n");

    const result = validateModelOutput(content, config);
    expect(result.status).toBe("format_error");
    expect(result.errors?.[0]).toContain("===OUTPUT:slides_final===");
    expect(result.errors?.[0]).toContain("===END:slides_final===");
  });

  it("rejects invalid JSON named output content", () => {
    const result = validateModelOutput(buildNamedOutputContent("{oops"), config);

    expect(result.status).toBe("format_error");
    expect(result.errors?.join("\n")).toContain("命名产物 slides_final JSON 语法错误");
  });

  it("rejects raw JSON without delimiters even for a single named output", () => {
    const singleJsonConfig: ModelCallConfig = {
      type: "model_call",
      displayName: "结构整合会",
      modelIds: ["model-a"],
      promptTemplate: "prompt",
      inputRefs: [],
      outputFormat: "json",
      namedOutputs: [{ id: "slide_outline", name: "逐页大纲", format: "json" }],
    };

    // Model outputs raw JSON without ===OUTPUT:slide_outline=== delimiters
    const rawJson = JSON.stringify({ slides: [{ page_no: 1 }] });
    const result = validateModelOutput(rawJson, singleJsonConfig);

    expect(result.status).toBe("format_error");
    expect(result.errors?.[0]).toContain("===OUTPUT:slide_outline===");
  });

  it("rejects raw text without delimiters for markdown named outputs", () => {
    const markdownOnlyConfig: ModelCallConfig = {
      type: "model_call",
      displayName: "文稿生成",
      modelIds: ["model-a"],
      promptTemplate: "prompt",
      inputRefs: [],
      outputFormat: "markdown",
      namedOutputs: [
        { id: "summary", name: "摘要", format: "markdown" },
        { id: "body", name: "正文", format: "markdown" },
      ],
    };

    // Model outputs plain markdown without any delimiters
    const result = validateModelOutput("# 这是一段没有分隔符的输出", markdownOnlyConfig);

    expect(result.status).toBe("format_error");
    expect(result.errors).toHaveLength(2);
    expect(result.errors?.[0]).toContain("===OUTPUT:summary===");
    expect(result.errors?.[1]).toContain("===OUTPUT:body===");
  });

  it("accepts properly delimited markdown named outputs", () => {
    const markdownOnlyConfig: ModelCallConfig = {
      type: "model_call",
      displayName: "文稿生成",
      modelIds: ["model-a"],
      promptTemplate: "prompt",
      inputRefs: [],
      outputFormat: "markdown",
      namedOutputs: [
        { id: "summary", name: "摘要", format: "markdown" },
        { id: "body", name: "正文", format: "markdown" },
      ],
    };

    const content = [
      "===OUTPUT:summary===",
      "# 摘要内容",
      "===END:summary===",
      "===OUTPUT:body===",
      "# 正文内容",
      "===END:body===",
    ].join("\n");

    expect(validateModelOutput(content, markdownOnlyConfig)).toEqual({ status: "completed" });
  });
});

describe("validateSelectedModelCallOutputData", () => {
  it("rejects invalid edited JSON artifacts before advance", () => {
    const result = validateSelectedModelCallOutputData(
      {
        selectedContent: "{}",
        namedOutputs: {
          slides_final: { content: '{"slides": [{"layout": "content"}]}' },
        },
      },
      config,
      "model-a",
    );

    expect(result.status).toBe("format_error");
    expect(result.errors?.join("\n")).toContain("命名产物 slides_final");
  });

  it("requires explicit user selection when enableUserSelectionOutput is true", () => {
    const result = validateSelectedModelCallOutputData(
      {
        namedOutputs: {
          slides_final: {
            content: JSON.stringify({ slides: [{ layout: "title", title: "封面" }] }),
          },
        },
      },
      {
        ...config,
        enableUserSelectionOutput: true,
      },
      null,
    );

    expect(result.status).toBe("format_error");
    expect(result.errors).toContain("请至少选择一个模型输出后再继续。");
  });

  it("does not block advance when legacy manual feedback exists", () => {
    const result = validateSelectedModelCallOutputData(
      {
        selectedContent: "{}",
        namedOutputs: {
          slides_final: {
            content: JSON.stringify({ slides: [{ layout: "title", title: "封面" }] }),
          },
          qa_report: {
            content: "# PASS",
          },
        },
        manualFeedback: {
          content: "请补充第 2 页的风险说明。",
          updatedAt: "2026-04-14T10:00:00.000Z",
          appliedAt: null,
        },
      },
      config,
      "model-a",
    );

    expect(result.status).toBe("completed");
  });
});

describe("appendTransientPromptToResolvedPrompt", () => {
  it("appends one-off retry requirements without affecting empty prompts", () => {
    expect(appendTransientPromptToResolvedPrompt("base prompt", "")).toBe("base prompt");
    expect(appendTransientPromptToResolvedPrompt("base prompt", "补充风险说明")).toContain(
      "补充风险说明",
    );
  });
});

describe("resolveRef", () => {
  it("reads manual feedback from model_call outputItems for downstream prompts", () => {
    const value = resolveRef(
      {
        nodeId: "node-model-call",
        outputId: "manual_feedback",
      },
      [
        {
          nodeId: "node-model-call",
          outputData: {
            outputItems: {
              manual_feedback: {
                content: "请把摘要部分压缩到 3 点。",
              },
            },
          },
        },
      ],
    );

    expect(value).toBe("请把摘要部分压缩到 3 点。");
  });
});
