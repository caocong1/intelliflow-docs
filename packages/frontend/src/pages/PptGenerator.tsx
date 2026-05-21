import type { Component } from "solid-js";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { showToast } from "../components/ui/Toast";
import {
  type PptAgentJob,
  createPptAgentJob,
  downloadPptAgentJob,
  getPptAgentJob,
  listPptAgentJobs,
} from "../lib/api/ppt-agent";
import { downloadBlobResponse } from "../lib/download";

const SAMPLE_PROMPT =
  "请生成一套面向集团管理层的正式汇报PPT，主题为 AI 驱动的企业知识中台建设方案与落地路线图。受众 CEO、CIO、业务负责人、信息化负责人和财务负责人；目标是在立项会上争取预算和试点授权；12页；中文；正式商务、咨询公司风，但不要蓝白灰模板堆叠；必须包含封面、目录、现状痛点、战略价值、总体架构、核心能力、数据治理与安全、试点场景、实施路线图、投入产出、风险与治理、总结页；每页保留 speaker notes。";

const stageLabels: Record<string, string> = {
  queued: "排队中",
  design_director: "方案设计",
  design_critic: "方案评审",
  visual_generator: "视觉生成",
  renderer: "PPT 渲染",
  qa: "质量检查",
  completed: "已完成",
  failed: "失败",
};

const PptGenerator: Component = () => {
  const [prompt, setPrompt] = createSignal(SAMPLE_PROMPT);
  const [slideCount, setSlideCount] = createSignal(12);
  const [style, setStyle] = createSignal("auto");
  const [jobs, setJobs] = createSignal<PptAgentJob[]>([]);
  const [currentJob, setCurrentJob] = createSignal<PptAgentJob | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [downloadingId, setDownloadingId] = createSignal<string | null>(null);
  let pollTimer: number | undefined;

  const activeJob = createMemo(() => {
    const job = currentJob();
    return job && (job.status === "queued" || job.status === "running") ? job : null;
  });

  const orderedJobs = createMemo(() => jobs());

  onMount(() => {
    void loadJobs();
  });

  onCleanup(() => {
    if (pollTimer) window.clearInterval(pollTimer);
  });

  async function loadJobs() {
    setLoading(true);
    try {
      const nextJobs = await listPptAgentJobs();
      setJobs(nextJobs);
      const selected = currentJob();
      let nextCurrent: PptAgentJob | null;
      if (selected) {
        nextCurrent = nextJobs.find((job) => job.id === selected.id) ?? selected;
      } else {
        nextCurrent = nextJobs[0] ?? null;
      }
      setCurrentJob(nextCurrent);
      if (nextCurrent && (nextCurrent.status === "queued" || nextCurrent.status === "running")) {
        startPolling(nextCurrent.id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加载 PPT 任务失败", "error");
    } finally {
      setLoading(false);
    }
  }

  function startPolling(jobId: string) {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => {
      void refreshJob(jobId);
    }, 2200);
  }

  async function refreshJob(jobId: string) {
    try {
      const job = await getPptAgentJob(jobId);
      setCurrentJob(job);
      setJobs((items) => {
        const index = items.findIndex((item) => item.id === job.id);
        if (index < 0) return [job, ...items];
        const next = items.slice();
        next[index] = job;
        return next;
      });
      if (job.status === "completed" || job.status === "failed") {
        if (pollTimer) window.clearInterval(pollTimer);
        pollTimer = undefined;
        showToast(
          job.status === "completed" ? "PPT 生成完成" : "PPT 生成失败",
          job.status === "completed" ? "success" : "error",
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "刷新任务失败", "error");
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!prompt().trim()) {
      showToast("请输入详细提示词", "error");
      return;
    }

    setSubmitting(true);
    try {
      const job = await createPptAgentJob({
        prompt: prompt().trim(),
        slideCount: slideCount(),
        style: style(),
      });
      setCurrentJob(job);
      setJobs((items) => [job, ...items.filter((item) => item.id !== job.id)]);
      startPolling(job.id);
      showToast("PPT 生成任务已创建", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "创建任务失败", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(job: PptAgentJob) {
    setDownloadingId(job.id);
    try {
      const res = await downloadPptAgentJob(job.id);
      await downloadBlobResponse(res, job.resultFilename ?? "presentation.pptx");
      showToast("下载已开始", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "下载失败", "error");
    } finally {
      setDownloadingId(null);
    }
  }

  function selectJob(job: PptAgentJob) {
    setCurrentJob(job);
    if (job.status === "queued" || job.status === "running") {
      startPolling(job.id);
    }
  }

  return (
    <div class="min-h-full bg-[#f7f3ea] text-stone-950">
      <div class="mx-auto max-w-7xl px-6 py-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-normal text-stone-950">PPT生成</h1>
            <p class="mt-1 text-sm text-stone-600">
              MiniMax-M2.7-highspeed · PptxGenJS · Speaker notes
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadJobs()}
            class="rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading()}
          >
            {loading() ? "刷新中" : "刷新"}
          </button>
        </div>

        <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <form
            onSubmit={handleSubmit}
            class="rounded-lg border border-stone-200 bg-[#fffdf8] p-5 shadow-sm"
          >
            <label for="ppt-prompt" class="block text-sm font-semibold text-stone-900">
              详细提示词
            </label>
            <textarea
              id="ppt-prompt"
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              class="mt-2 min-h-[280px] w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
              placeholder="输入主题、受众、页数、必须包含的页面、风格、语言和备注要求"
            />

            <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[160px_220px_1fr]">
              <div>
                <label for="ppt-slide-count" class="block text-sm font-semibold text-stone-900">
                  页数
                </label>
                <input
                  id="ppt-slide-count"
                  type="number"
                  min="1"
                  max="30"
                  value={slideCount()}
                  onInput={(e) => setSlideCount(Number(e.currentTarget.value) || 12)}
                  class="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
                />
              </div>
              <div>
                <label for="ppt-style" class="block text-sm font-semibold text-stone-900">
                  风格
                </label>
                <select
                  id="ppt-style"
                  value={style()}
                  onChange={(e) => setStyle(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
                >
                  <option value="auto">auto</option>
                  <option value="formal consulting">正式咨询</option>
                  <option value="executive briefing">管理层汇报</option>
                  <option value="operations dashboard">运营工作台</option>
                  <option value="warm strategy">暖色战略</option>
                </select>
              </div>
              <div class="flex items-end justify-end">
                <button
                  type="submit"
                  disabled={submitting() || Boolean(activeJob())}
                  class="w-full rounded-md bg-[#6f3f25] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5f341e] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {submitting() ? "创建中" : activeJob() ? "任务进行中" : "生成 PPT"}
                </button>
              </div>
            </div>
          </form>

          <section class="rounded-lg border border-stone-200 bg-[#fffdf8] p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-stone-950">当前任务</h2>
              <Show when={currentJob()}>
                {(job) => (
                  <span class={statusClass(job().status)}>
                    {job().status === "running"
                      ? (stageLabels[job().stage ?? "running"] ?? "运行中")
                      : statusText(job().status)}
                  </span>
                )}
              </Show>
            </div>

            <Show
              when={currentJob()}
              fallback={
                <div class="mt-8 rounded-md border border-dashed border-stone-300 p-6 text-sm text-stone-500">
                  暂无任务
                </div>
              }
            >
              {(job) => (
                <div class="mt-4 space-y-4">
                  <div>
                    <div class="mb-1 flex items-center justify-between text-xs text-stone-600">
                      <span>{stageLabels[job().stage ?? "queued"] ?? job().stage ?? "排队中"}</span>
                      <span>{job().progress ?? 0}%</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-stone-200">
                      <div
                        class="h-full rounded-full bg-[#a65f32] transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, job().progress ?? 0))}%` }}
                      />
                    </div>
                  </div>

                  <div class="rounded-md bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-700">
                    <div class="font-medium text-stone-900">
                      {job().resultFilename ?? "presentation.pptx"}
                    </div>
                    <div>{new Date(job().createdAt).toLocaleString()}</div>
                  </div>

                  <Show when={job().errorMessage}>
                    <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {job().errorMessage}
                    </div>
                  </Show>

                  <Show when={job().warnings?.length}>
                    <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <div class="mb-1 text-xs font-semibold text-amber-900">Warnings</div>
                      <ul class="space-y-1 text-xs leading-5 text-amber-800">
                        <For each={job().warnings.slice(0, 6)}>
                          {(warning) => <li>{warning}</li>}
                        </For>
                      </ul>
                    </div>
                  </Show>

                  <button
                    type="button"
                    disabled={job().status !== "completed" || downloadingId() === job().id}
                    onClick={() => void handleDownload(job())}
                    class="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {downloadingId() === job().id ? "下载中" : "下载 PPTX"}
                  </button>
                </div>
              )}
            </Show>
          </section>
        </div>

        <section class="mt-5 rounded-lg border border-stone-200 bg-[#fffdf8] p-5 shadow-sm">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-base font-semibold text-stone-950">历史任务</h2>
            <span class="text-xs text-stone-500">{orderedJobs().length} 条</span>
          </div>
          <div class="overflow-hidden rounded-md border border-stone-200">
            <For
              each={orderedJobs()}
              fallback={
                <div class="px-4 py-8 text-center text-sm text-stone-500">暂无历史任务</div>
              }
            >
              {(job) => (
                <div
                  class={`flex w-full items-center justify-between gap-4 border-b border-stone-200 px-4 py-3 last:border-b-0 ${
                    currentJob()?.id === job.id ? "bg-[#f5ead8]" : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectJob(job)}
                    class="min-w-0 flex-1 text-left"
                  >
                    <div class="truncate text-sm font-medium text-stone-900">
                      {job.resultFilename ?? "presentation.pptx"}
                    </div>
                    <div class="mt-1 truncate text-xs text-stone-500">
                      {new Date(job.createdAt).toLocaleString()} ·{" "}
                      {stageLabels[job.stage ?? "queued"] ?? job.stage}
                    </div>
                  </button>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class={statusClass(job.status)}>{statusText(job.status)}</span>
                    <Show when={job.status === "completed"}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownload(job);
                        }}
                        class="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-800 hover:bg-stone-100"
                      >
                        下载
                      </button>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </div>
    </div>
  );
};

function statusText(status: PptAgentJob["status"]): string {
  if (status === "queued") return "排队";
  if (status === "running") return "运行";
  if (status === "completed") return "完成";
  return "失败";
}

function statusClass(status: PptAgentJob["status"]): string {
  const base = "rounded-full px-2.5 py-1 text-xs font-semibold";
  if (status === "completed") return `${base} bg-emerald-100 text-emerald-700`;
  if (status === "failed") return `${base} bg-red-100 text-red-700`;
  if (status === "running") return `${base} bg-amber-100 text-amber-800`;
  return `${base} bg-stone-100 text-stone-700`;
}

export default PptGenerator;
