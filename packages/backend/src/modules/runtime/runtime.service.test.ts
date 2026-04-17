import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectLimitMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
  const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
  const selectMock = vi.fn(() => ({ from: selectFromMock }));

  const updateWhereMock = vi.fn();
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  const getModelCallConfigMock = vi.fn();
  const validateSelectedModelCallOutputDataMock = vi.fn();

  return {
    selectLimitMock,
    selectWhereMock,
    selectFromMock,
    selectMock,
    updateWhereMock,
    updateSetMock,
    updateMock,
    getModelCallConfigMock,
    validateSelectedModelCallOutputDataMock,
  };
});

vi.mock("../../db", () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
  },
}));

vi.mock("../../db/schema", () => ({
  backgroundTasks: {},
  documents: {},
  nodeExecutions: {
    id: "id",
    nodeType: "node_type",
    selectedOutputKey: "selected_output_key",
    outputData: "output_data",
    updatedAt: "updated_at",
  },
  workflows: {},
}));

vi.mock("../versions/versions.service", () => ({
  createVersionSnapshot: vi.fn(),
}));

vi.mock("./conditions.service", () => ({
  evaluateExecutionRule: vi.fn(),
}));

vi.mock("./model-call.service", () => ({
  getModelCallConfig: mocks.getModelCallConfigMock,
  validateSelectedModelCallOutputData: mocks.validateSelectedModelCallOutputDataMock,
}));

vi.mock("./skip-output.service", () => ({
  buildSkippedNodeOutputData: vi.fn(),
}));

import { saveNodeDraft } from "./runtime.service";

describe("saveNodeDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectLimitMock.mockResolvedValue([
      {
        nodeType: "model_call",
        selectedOutputKey: "model-a",
      },
    ]);
    mocks.updateWhereMock.mockResolvedValue(undefined);
    mocks.getModelCallConfigMock.mockResolvedValue({ type: "model_call" });
    mocks.validateSelectedModelCallOutputDataMock.mockReturnValue({ status: "completed" });
  });

  it("rejects invalid model-call draft artifacts before persisting", async () => {
    mocks.validateSelectedModelCallOutputDataMock.mockReturnValue({
      status: "format_error",
      errors: ["命名产物 slides_final JSON 语法错误: Unterminated string"],
    });

    await expect(
      saveNodeDraft("doc-1", "node-1", {
        namedOutputs: {
          slides_final: { content: '{"broken"' },
        },
      }),
    ).rejects.toThrow("命名产物 slides_final JSON 语法错误: Unterminated string");

    expect(mocks.validateSelectedModelCallOutputDataMock).toHaveBeenCalledWith(
      {
        namedOutputs: {
          slides_final: { content: '{"broken"' },
        },
      },
      { type: "model_call" },
      "model-a",
      { requireSelection: false },
    );
    expect(mocks.updateMock).not.toHaveBeenCalled();
  });

  it("persists non-model-call drafts without model validation", async () => {
    mocks.selectLimitMock.mockResolvedValue([
      {
        nodeType: "input_transform",
        selectedOutputKey: null,
      },
    ]);

    await saveNodeDraft("doc-1", "node-1", { text: "draft" });

    expect(mocks.getModelCallConfigMock).not.toHaveBeenCalled();
    expect(mocks.validateSelectedModelCallOutputDataMock).not.toHaveBeenCalled();
    expect(mocks.updateMock).toHaveBeenCalledTimes(1);
  });
});
