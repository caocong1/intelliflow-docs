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
  getModelCallManualFeedbackValidationError: vi.fn((outputData: Record<string, unknown> | null) => {
    const feedback = outputData?.manualFeedback as
      | { content?: string; updatedAt?: string | null; appliedAt?: string | null }
      | undefined;
    if (!feedback?.content?.trim()) return null;
    if (!feedback.updatedAt || feedback.appliedAt !== feedback.updatedAt) {
      return "已填写人工意见，请先按意见重生成当前节点后再继续。";
    }
    return null;
  }),
}));
vi.mock("./strategies", () => ({ getStrategy: vi.fn() }));

import type { ModelCallConfig } from "@intelliflow/shared";
import {
  resolveRef,
  validateModelOutput,
  validateSelectedModelCallOutputData,
} from "./model-call.service";

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

  it("rejects missing JSON named output artifacts", () => {
    const content = ["===OUTPUT:qa_report===", "# PASS", "===END:qa_report==="].join("\n");

    const result = validateModelOutput(content, config);
    expect(result.status).toBe("format_error");
    expect(result.errors).toContain("命名产物 slides_final 缺失或为空");
  });

  it("rejects invalid JSON named output content", () => {
    const result = validateModelOutput(buildNamedOutputContent("{oops"), config);

    expect(result.status).toBe("format_error");
    expect(result.errors?.join("\n")).toContain("命名产物 slides_final JSON 语法错误");
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

  it("requires manual feedback to be applied before advance", () => {
    const result = validateSelectedModelCallOutputData(
      {
        selectedContent: "{}",
        namedOutputs: {
          slides_final: {
            content: JSON.stringify({ slides: [{ layout: "title", title: "封面" }] }),
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

    expect(result.status).toBe("format_error");
    expect(result.errors).toContain("已填写人工意见，请先按意见重生成当前节点后再继续。");
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
