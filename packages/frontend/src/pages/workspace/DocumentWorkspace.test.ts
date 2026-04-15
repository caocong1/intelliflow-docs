/**
 * @vitest-environment jsdom
 */
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => ({
  A: (props: { children?: unknown }) => props.children ?? null,
  useParams: () => ({ documentId: "doc-1" }),
}));

vi.mock("../../api/client", () => ({
  advanceNode: vi.fn(),
  api: {},
  getRuntimeState: vi.fn(),
  initRuntime: vi.fn(),
  rollbackNode: vi.fn(),
  skipNode: vi.fn(),
  startBackgroundExecution: vi.fn(),
}));

vi.mock("../../lib/api/user-activity", () => ({
  checkFavorites: vi.fn(),
  recordAccess: vi.fn(),
  toggleFavorite: vi.fn(),
}));

vi.mock("../../components/ui/Toast", () => ({
  showToast: vi.fn(),
}));

import { getRuntimeState, initRuntime } from "../../api/client";
import { checkFavorites, recordAccess, toggleFavorite } from "../../lib/api/user-activity";
import DocumentWorkspace from "./DocumentWorkspace";

const runtimeState = {
  backgroundTaskActive: false,
  currentNodeIndex: 0,
  documentTitle: "无线网络建设全解析",
  projectId: "project-1",
  workflowName: "通用 PPT 生成与质检 Agent 流程",
  nodes: [
    {
      id: "node-exec-1",
      nodeId: "workflow-node-1",
      nodeLabel: "需求解构委员会",
      nodeType: "model_call",
      status: "completed",
      stepOrder: 0,
      startedAt: "2026-04-15T10:00:00.000Z",
      completedAt: "2026-04-15T10:03:23.000Z",
      outputData: {
        models: {
          kimi: {
            content: "# 需求简报\n\n这是输出内容。",
            modelId: "kimi",
            modelDisplayName: "Kimi K2.5",
            status: "completed",
          },
        },
        selectedContent: "# 需求简报\n\n这是输出内容。",
      },
    },
    {
      id: "node-exec-2",
      nodeId: "workflow-node-2",
      nodeLabel: "文件导出",
      nodeType: "export",
      status: "completed",
      stepOrder: 1,
      startedAt: "2026-04-15T10:03:23.000Z",
      completedAt: "2026-04-15T10:04:00.000Z",
      outputData: {
        exportResults: [],
      },
    },
  ],
  workflowNodes: [
    {
      id: "workflow-node-1",
      config: {
        type: "model_call",
        modelIds: ["kimi"],
      },
    },
    {
      id: "workflow-node-2",
      config: {
        type: "export",
        formats: [],
        contentMapping: [],
      },
    },
  ],
} as const;

const failedRuntimeState = {
  backgroundTaskActive: false,
  currentNodeIndex: 1,
  documentTitle: "无线网络建设全解析",
  projectId: "project-1",
  workflowName: "通用 PPT 生成与质检 Agent 流程",
  nodes: [
    {
      id: "node-exec-1",
      nodeId: "workflow-node-1",
      nodeLabel: "策略委员会",
      nodeType: "model_call",
      status: "completed",
      stepOrder: 0,
      startedAt: "2026-04-15T10:00:00.000Z",
      completedAt: "2026-04-15T10:03:23.000Z",
      outputData: {
        models: {
          kimi: {
            content: "# 策略简报\n\n这是已完成输出。",
            modelId: "kimi",
            modelDisplayName: "Kimi K2.5",
            status: "completed",
          },
        },
        selectedContent: "# 策略简报\n\n这是已完成输出。",
      },
    },
    {
      id: "node-exec-2",
      nodeId: "workflow-node-2",
      nodeLabel: "叙事架构委员会",
      nodeType: "model_call",
      status: "failed",
      stepOrder: 1,
      startedAt: "2026-04-15T10:03:23.000Z",
      completedAt: "2026-04-15T10:04:30.000Z",
      errorMessage: "timeout",
      outputData: {
        models: {
          deepseek: {
            content: "",
            modelId: "deepseek",
            modelDisplayName: "DeepSeek V3.2",
            status: "failed",
            errorMessage: "timeout",
          },
        },
      },
    },
  ],
  workflowNodes: [
    {
      id: "workflow-node-1",
      config: {
        type: "model_call",
        modelIds: ["kimi"],
      },
    },
    {
      id: "workflow-node-2",
      config: {
        type: "model_call",
        modelIds: ["deepseek"],
      },
    },
  ],
} as const;

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe("DocumentWorkspace history actions", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    vi.mocked(initRuntime).mockResolvedValue(runtimeState as never);
    vi.mocked(getRuntimeState).mockResolvedValue(runtimeState as never);
    vi.mocked(checkFavorites).mockResolvedValue([]);
    vi.mocked(recordAccess).mockResolvedValue(undefined);
    vi.mocked(toggleFavorite).mockResolvedValue({ favorited: false });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ data: [] }),
      })),
    );
  });

  afterEach(() => {
    container?.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows inline fullscreen and sidebar re-execute when viewing a completed model step", async () => {
    const dispose = render(() => createComponent(DocumentWorkspace, {}), container);

    await flush();

    const historyStepButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("需求解构委员会"),
    );

    expect(historyStepButton).toBeDefined();
    historyStepButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await flush();

    expect(container.textContent).toContain("模型响应预览");
    expect(container.textContent).toContain("全屏查看");
    expect(container.textContent).not.toContain("复制");
    expect(container.textContent).toContain("重新执行当前步骤");

    const reexecuteButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("重新执行当前步骤"),
    );

    expect(reexecuteButton).toBeDefined();
    reexecuteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await flush();

    expect(container.textContent).toContain("确认重新执行");

    dispose();
  });

  it("allows navigating to a failed model step from the sidebar and exposes retry actions", async () => {
    vi.mocked(initRuntime).mockResolvedValue(failedRuntimeState as never);
    vi.mocked(getRuntimeState).mockResolvedValue(failedRuntimeState as never);

    const dispose = render(() => createComponent(DocumentWorkspace, {}), container);

    await flush();

    expect(container.textContent).toContain("文档生成失败");

    const failedStepButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("叙事架构委员会"),
    );

    expect(failedStepButton).toBeDefined();
    failedStepButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await flush();

    expect(container.textContent).toContain("失败节点: 叙事架构委员会");
    expect(container.textContent).toContain("DeepSeek V3.2");
    expect(container.textContent).toContain("网络超时，请重试");
    expect(container.textContent).toContain("重新生成");

    dispose();
  });
});
