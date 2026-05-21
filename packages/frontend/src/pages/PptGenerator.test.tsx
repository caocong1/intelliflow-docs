/**
 * @vitest-environment jsdom
 */
import { createComponent } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPptAgentJob: vi.fn(),
  downloadBlobResponse: vi.fn(),
  downloadPptAgentJob: vi.fn(),
  getPptAgentJob: vi.fn(),
  listPptAgentJobs: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../lib/api/ppt-agent", () => ({
  createPptAgentJob: mocks.createPptAgentJob,
  downloadPptAgentJob: mocks.downloadPptAgentJob,
  getPptAgentJob: mocks.getPptAgentJob,
  listPptAgentJobs: mocks.listPptAgentJobs,
}));

vi.mock("../lib/download", () => ({
  downloadBlobResponse: mocks.downloadBlobResponse,
}));

vi.mock("../components/ui/Toast", () => ({
  showToast: mocks.showToast,
}));

import PptGenerator from "./PptGenerator";

const queuedJob = {
  id: "job-1",
  userId: "user-1",
  prompt: "prompt",
  status: "running",
  progress: 35,
  stage: "visual_generator",
  errorMessage: null,
  resultFilename: null,
  warnings: [],
  createdAt: "2026-05-20T10:00:00.000Z",
  updatedAt: "2026-05-20T10:00:00.000Z",
  completedAt: null,
} as const;

const completedJob = {
  ...queuedJob,
  status: "completed",
  progress: 100,
  stage: "completed",
  resultFilename: "knowledge-hub.pptx",
  warnings: ["OfficeCLI 未安装，已跳过 validate/view issues 质检。"],
  completedAt: "2026-05-20T10:02:00.000Z",
} as const;

const failedJob = {
  ...queuedJob,
  status: "failed",
  progress: 100,
  stage: "failed",
  errorMessage: "MINIMAX_API_KEY 环境变量未配置，无法启动 PPT 生成任务。",
  completedAt: "2026-05-20T10:02:00.000Z",
} as const;

describe("PptGenerator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.createPptAgentJob.mockReset().mockResolvedValue(queuedJob);
    mocks.downloadBlobResponse.mockReset().mockResolvedValue("knowledge-hub.pptx");
    mocks.downloadPptAgentJob
      .mockReset()
      .mockResolvedValue(new Response(new Blob(["pptx"]), { status: 200 }));
    mocks.getPptAgentJob.mockReset().mockResolvedValue(completedJob);
    mocks.listPptAgentJobs.mockReset().mockResolvedValue([]);
    mocks.showToast.mockReset();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("enters /ppt-generator page surface and completes create, poll, download flow", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(() => createComponent(PptGenerator, {}), container);

    await flush();
    expect(container.textContent).toContain("PPT生成");
    expect(container.textContent).toContain("详细提示词");

    const submit = buttonByText(container, "生成 PPT");
    submit.click();
    await flush();

    expect(mocks.createPptAgentJob).toHaveBeenCalledWith(
      expect.objectContaining({ slideCount: 12, style: "auto" }),
    );

    await vi.advanceTimersByTimeAsync(2300);
    await flush();
    expect(mocks.getPptAgentJob).toHaveBeenCalledWith("job-1");
    expect(container.textContent).toContain("knowledge-hub.pptx");

    buttonByText(container, "下载 PPTX").click();
    await flush();

    expect(mocks.downloadPptAgentJob).toHaveBeenCalledWith("job-1");
    expect(mocks.downloadBlobResponse).toHaveBeenCalled();
    dispose();
  });

  it("shows failed job errors after polling", async () => {
    mocks.getPptAgentJob.mockResolvedValue(failedJob);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(() => createComponent(PptGenerator, {}), container);

    await flush();
    buttonByText(container, "生成 PPT").click();
    await flush();
    await vi.advanceTimersByTimeAsync(2300);
    await flush();

    expect(container.textContent).toContain("MINIMAX_API_KEY 环境变量未配置");
    expect(container.textContent).toContain("失败");
    dispose();
  });
});

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll("button"));
  const button = buttons.find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`button not found: ${text}`);
  return button;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}
