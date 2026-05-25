import type { Component } from "solid-js";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { showToast } from "../components/ui/Toast";
import { listActiveModelOptions } from "../lib/api/models-catalog";
import {
  type PptAgentJob,
  type PptGenerationMode,
  createPptAgentJob,
  deletePptAgentJob,
  downloadPptAgentJob,
  getPptAgentJob,
  listPptAgentJobs,
} from "../lib/api/ppt-agent";
import { getPptAgentConfig } from "../lib/api/ppt-agent-config";
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

const generationModeOptions: Array<{ value: PptGenerationMode; label: string }> = [
  { value: "auto_dynamic", label: "自动排版" },
  { value: "template_locked", label: "模板锁定" },
  { value: "template_stylized", label: "模板风格化" },
  { value: "svg_native", label: "原生矢量" },
];

type ModelOption = {
  modelId: string;
  displayName: string;
  providerName?: string | null;
};

const PptGenerator: Component = () => {
  const [prompt, setPrompt] = createSignal(SAMPLE_PROMPT);
  const [slideCount, setSlideCount] = createSignal(12);
  const [style, setStyle] = createSignal("auto");
  const [generationMode, setGenerationMode] = createSignal<PptGenerationMode>("svg_native");
  const [textModel, setTextModel] = createSignal("");
  const [imageModel, setImageModel] = createSignal("");
  const [imageEnabled, setImageEnabled] = createSignal(true);
  const [modelOptions, setModelOptions] = createSignal<ModelOption[]>([]);
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
  const groupedModelOptions = createMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    for (const item of modelOptions()) {
      const label = item.providerName?.trim() || "未标记 Provider";
      const bucket = groups.get(label);
      if (bucket) bucket.push(item);
      else groups.set(label, [item]);
    }
    return Array.from(groups.entries()).map(([providerName, items]) => ({ providerName, items }));
  });

  onMount(() => {
    void loadJobs();
    void loadModelBindingConfig();
    void loadModelOptions();
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

  async function loadModelBindingConfig() {
    try {
      const config = await getPptAgentConfig();
      setTextModel(config.textModel);
      setImageModel(config.imageModel);
    } catch {
      // config endpoint is admin-only; keep manual fallback inputs for non-admin users
    }
  }

  async function loadModelOptions() {
    try {
      const models = await listActiveModelOptions();
      setModelOptions(
        models.map((m) => ({
          modelId: m.modelId,
          displayName: m.displayName,
          providerName: m.providerName,
        })),
      );
    } catch {
      // silently fallback to manual input
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
        generationMode: generationMode(),
        styleProfile: style(),
        textModel: textModel().trim() || undefined,
        imageModel: imageModel().trim() || undefined,
        imageEnabled: imageEnabled(),
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

  async function handleDelete(job: PptAgentJob, e: Event) {
    e.stopPropagation();
    if (job.status === "queued" || job.status === "running") {
      showToast("任务进行中，无法删除", "error");
      return;
    }
    try {
      await deletePptAgentJob(job.id);
      if (pollTimer && currentJob()?.id === job.id) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
      const remaining = jobs().filter((item) => item.id !== job.id);
      setJobs(remaining);
      if (currentJob()?.id === job.id) {
        setCurrentJob(remaining[0] ?? null);
      }
      showToast("任务已删除", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败", "error");
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
              默认 svg_native（ppt-master） · Deck/图片模型可分开绑定
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

            <div class="mt-4">
              <div class="block text-sm font-semibold text-stone-900">生成模式</div>
              <div class="mt-2 grid grid-cols-3 overflow-hidden rounded-md border border-stone-300 bg-white">
                <For each={generationModeOptions}>
                  {(option) => (
                    <button
                      type="button"
                      onClick={() => setGenerationMode(option.value)}
                      class={`border-r border-stone-300 px-3 py-2 text-sm font-medium last:border-r-0 ${
                        generationMode() === option.value
                          ? "bg-[#6f3f25] text-white"
                          : "bg-white text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

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

            <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label for="ppt-text-model" class="block text-sm font-semibold text-stone-900">
                  Deck 生成模型
                </label>
                <select
                  value={textModel()}
                  onChange={(e) => setTextModel(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
                >
                  <option value="">使用配置页默认 textModel</option>
                  <For each={groupedModelOptions()}>
                    {(group) => (
                      <optgroup label={group.providerName}>
                        <For each={group.items}>
                          {(item) => (
                            <option value={item.modelId}>
                              {item.displayName} ({item.modelId})
                            </option>
                          )}
                        </For>
                      </optgroup>
                    )}
                  </For>
                </select>
                <input
                  id="ppt-text-model"
                  value={textModel()}
                  onInput={(e) => setTextModel(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
                  placeholder="也可手动输入 modelId"
                />
              </div>
              <div>
                <label for="ppt-image-model" class="block text-sm font-semibold text-stone-900">
                  图片生成模型
                </label>
                <select
                  value={imageModel()}
                  onChange={(e) => setImageModel(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
                >
                  <option value="">使用配置页默认 imageModel</option>
                  <For each={groupedModelOptions()}>
                    {(group) => (
                      <optgroup label={group.providerName}>
                        <For each={group.items}>
                          {(item) => (
                            <option value={item.modelId}>
                              {item.displayName} ({item.modelId})
                            </option>
                          )}
                        </For>
                      </optgroup>
                    )}
                  </For>
                </select>
                <input
                  id="ppt-image-model"
                  value={imageModel()}
                  onInput={(e) => setImageModel(e.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15"
                  placeholder="也可手动输入 modelId"
                />
              </div>
            </div>
            <label class="mt-3 inline-flex items-center gap-2 text-sm text-stone-800">
              <input
                type="checkbox"
                checked={imageEnabled()}
                onChange={(e) => setImageEnabled(e.currentTarget.checked)}
              />
              启用图片生成（关闭后使用本地 fallback 视觉）
            </label>
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

                  <Show when={job().status === "completed" || job().status === "failed"}>
                    <button
                      type="button"
                      onClick={(e) => void handleDelete(job(), e)}
                      class="w-full rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      删除任务
                    </button>
                  </Show>
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
                    <Show when={job.status === "completed" || job.status === "failed"}>
                      <button
                        type="button"
                        onClick={(e) => void handleDelete(job, e)}
                        class="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        删除
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
