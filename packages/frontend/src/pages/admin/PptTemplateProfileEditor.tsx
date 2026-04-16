import { useNavigate, useParams } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createResource, createSignal } from "solid-js";
import { showToast } from "../../components/ui/Toast";
import {
  getTemplate,
  getTemplateProfile,
  reRecognizeTemplate,
  updateTemplateProfile,
  type PptTemplate,
  type PptTemplateProfile,
  type PptTemplateProfileSlide,
  type PptTemplateSemanticRole,
  type PptTemplateSlot,
  type PptTemplateSlotBindingKey,
} from "../../lib/api/ppt-templates";

const SEMANTIC_ROLE_LABELS: Record<PptTemplateSemanticRole, string> = {
  cover: "封面",
  toc: "目录",
  section_break: "过渡页",
  bullet_list: "正文列表",
  comparison: "对比页",
  timeline: "时间轴",
  table: "表格页",
  image_focus: "图片页",
  summary: "总结页",
  qna: "答疑页",
  closing: "结尾页",
};

const SLOT_BINDING_LABELS: Record<PptTemplateSlotBindingKey, string> = {
  titleSlot: "标题",
  subtitleSlot: "副标题",
  bodySlot: "正文",
  leftSlot: "左栏",
  rightSlot: "右栏",
  tableSlot: "表格",
  imageSlot: "图片",
  captionSlot: "图注",
  notesSlot: "备注",
  footerSlot: "页脚",
  pageNumSlot: "页码",
};

const EDITABLE_SLOT_FIELDS: PptTemplateSlotBindingKey[] = [
  "titleSlot",
  "subtitleSlot",
  "bodySlot",
  "leftSlot",
  "rightSlot",
  "tableSlot",
  "imageSlot",
  "captionSlot",
];

const SLIDE_CANVAS_EMU = {
  "16:9": { width: 12192000, height: 6858000 },
  "4:3": { width: 9144000, height: 6858000 },
} as const;

type PreviewBox = {
  key: PptTemplateSlotBindingKey;
  slot: PptTemplateSlot;
  label: string;
  text: string;
  tone: string;
};

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function roleTone(role: PptTemplateProfileSlide["semanticRole"]): string {
  switch (role) {
    case "cover":
      return "from-[#1d4ed8] via-[#3b82f6] to-[#93c5fd]";
    case "toc":
      return "from-[#0f766e] via-[#14b8a6] to-[#99f6e4]";
    case "section_break":
      return "from-[#7c3aed] via-[#8b5cf6] to-[#c4b5fd]";
    case "comparison":
      return "from-[#be185d] via-[#ec4899] to-[#fbcfe8]";
    case "timeline":
      return "from-[#b45309] via-[#f59e0b] to-[#fde68a]";
    case "table":
      return "from-[#0f766e] via-[#0d9488] to-[#5eead4]";
    case "image_focus":
      return "from-[#0f172a] via-[#334155] to-[#94a3b8]";
    case "summary":
      return "from-[#166534] via-[#22c55e] to-[#bbf7d0]";
    case "qna":
      return "from-[#7c2d12] via-[#ea580c] to-[#fdba74]";
    case "closing":
      return "from-[#111827] via-[#374151] to-[#9ca3af]";
    case "bullet_list":
    default:
      return "from-[#1e293b] via-[#475569] to-[#cbd5e1]";
  }
}

function slotTone(key: PptTemplateSlotBindingKey): string {
  switch (key) {
    case "titleSlot":
      return "border-blue-400/70 bg-blue-50/80 text-blue-800";
    case "subtitleSlot":
      return "border-sky-400/70 bg-sky-50/80 text-sky-800";
    case "bodySlot":
      return "border-slate-400/70 bg-white/85 text-slate-800";
    case "leftSlot":
    case "rightSlot":
      return "border-violet-400/70 bg-violet-50/80 text-violet-800";
    case "tableSlot":
      return "border-emerald-400/70 bg-emerald-50/80 text-emerald-800";
    case "imageSlot":
      return "border-amber-400/70 bg-amber-50/80 text-amber-800";
    case "captionSlot":
      return "border-pink-400/70 bg-pink-50/80 text-pink-800";
    default:
      return "border-slate-300/70 bg-white/80 text-slate-700";
  }
}

function buildSampleText(slide: PptTemplateProfileSlide, key: PptTemplateSlotBindingKey): string {
  const samples = slide.sampleTextSummary;
  switch (key) {
    case "titleSlot":
      return samples[0] ?? "标题";
    case "subtitleSlot":
      return samples[1] ?? "副标题";
    case "bodySlot":
      return samples[1] ?? samples[0] ?? "正文内容";
    case "leftSlot":
      return samples[1] ?? "左栏内容";
    case "rightSlot":
      return samples[2] ?? "右栏内容";
    case "tableSlot":
      return "表格数据";
    case "imageSlot":
      return "图片区域";
    case "captionSlot":
      return samples.at(-1) ?? "图注";
    default:
      return SLOT_BINDING_LABELS[key];
  }
}

function resolveSlot(
  slide: PptTemplateProfileSlide,
  key: PptTemplateSlotBindingKey,
): PptTemplateSlot | undefined {
  const override = slide.slotOverrides?.[key];
  if (override === "__NONE__") return undefined;
  if (override && slide[override]) {
    return slide[override];
  }
  return slide[key];
}

function buildPreviewBoxes(slide: PptTemplateProfileSlide): PreviewBox[] {
  return EDITABLE_SLOT_FIELDS
    .map((key) => {
      const slot = resolveSlot(slide, key);
      if (!slot) return null;
      return {
        key,
        slot,
        label: SLOT_BINDING_LABELS[key],
        text: buildSampleText(slide, key),
        tone: slotTone(key),
      } satisfies PreviewBox;
    })
    .filter((item): item is PreviewBox => Boolean(item));
}

function boxStyle(
  slot: PptTemplateSlot,
  aspectRatio: string | undefined,
): Record<string, string> {
  const canvas =
    aspectRatio === "4:3" ? SLIDE_CANVAS_EMU["4:3"] : SLIDE_CANVAS_EMU["16:9"];
  return {
    left: `${(slot.position.x / canvas.width) * 100}%`,
    top: `${(slot.position.y / canvas.height) * 100}%`,
    width: `${(slot.position.cx / canvas.width) * 100}%`,
    height: `${(slot.position.cy / canvas.height) * 100}%`,
  };
}

function TemplateSlidePreview(props: {
  template?: PptTemplate | null;
  slide: PptTemplateProfileSlide;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const boxes = createMemo(() => buildPreviewBoxes(props.slide));
  const aspectRatio = () => (props.template?.aspectRatio === "4:3" ? "4 / 3" : "16 / 9");

  return (
    <button
      type="button"
      onClick={props.onClick}
      class={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all ${
        props.selected
          ? "border-indigo-500 shadow-[0_12px_30px_rgba(79,70,229,0.18)]"
          : "border-slate-200 hover:border-indigo-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
      }`}
    >
      <div class={`relative bg-gradient-to-br ${roleTone(props.slide.semanticRole)}`} style={{ "aspect-ratio": aspectRatio() }}>
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
        <div class="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-white/88 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm">
            第 {props.slide.slideNumber} 页
          </span>
          <Show when={props.slide.semanticRole}>
            <span class="rounded-full bg-slate-900/75 px-2 py-0.5 text-[11px] font-medium text-white">
              {props.slide.semanticRole ? SEMANTIC_ROLE_LABELS[props.slide.semanticRole] : "未分类"}
            </span>
          </Show>
        </div>
        <For each={boxes()}>
          {(box) => (
            <div
              class={`absolute z-[1] overflow-hidden rounded-xl border px-2 py-1 shadow-sm backdrop-blur-[1px] ${box.tone}`}
              style={boxStyle(box.slot, props.template?.aspectRatio)}
            >
              <p class="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {box.label}
              </p>
              <p class={`${props.compact ? "line-clamp-2 text-[10px]" : "line-clamp-3 text-[11px]"} leading-4`}>
                {box.text}
              </p>
            </div>
          )}
        </For>
      </div>
      <div class="border-t border-slate-200 bg-white px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900">{props.slide.layoutName}</p>
            <p class="mt-1 text-xs text-slate-500">
              自动识别 {confidenceLabel(props.slide.semanticRoleConfidence)} · 密度 {props.slide.contentDensity}
            </p>
          </div>
          <span
            class={`rounded-full px-2 py-1 text-[11px] font-medium ${
              props.slide.autoUse ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {props.slide.autoUse ? "参与匹配" : "已停用"}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function PptTemplateProfileEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saving, setSaving] = createSignal(false);
  const [reRecognizing, setReRecognizing] = createSignal(false);
  const [selectedSlideNumber, setSelectedSlideNumber] = createSignal<number | null>(null);

  const [template] = createResource(() => params.id, getTemplate);
  const [profile, { mutate, refetch }] = createResource(() => params.id, getTemplateProfile);

  createEffect(() => {
    const slides = profile()?.slides;
    if (!slides || slides.length === 0) return;
    const selected = selectedSlideNumber();
    if (!selected || !slides.some((slide) => slide.slideNumber === selected)) {
      setSelectedSlideNumber(slides[0].slideNumber);
    }
  });

  const selectedSlide = createMemo(() =>
    profile()?.slides.find((slide) => slide.slideNumber === selectedSlideNumber()) ?? null,
  );

  const semanticRoleOptions = Object.entries(SEMANTIC_ROLE_LABELS) as Array<
    [PptTemplateSemanticRole, string]
  >;

  function updateSelectedSlide(
    updater: (slide: PptTemplateProfileSlide) => PptTemplateProfileSlide,
  ) {
    const current = profile();
    const selected = selectedSlide();
    if (!current || !selected) return;

    mutate({
      ...current,
      slides: current.slides.map((slide) =>
        slide.slideNumber === selected.slideNumber ? updater(slide) : slide,
      ),
    });
  }

  function setSemanticRole(roleValue: string) {
    updateSelectedSlide((slide) => ({
      ...slide,
      semanticRole: (roleValue || null) as PptTemplateSemanticRole | null,
      semanticRoleSource: roleValue ? "manual" : "auto",
      semanticRoleConfidence: roleValue ? 0.99 : slide.semanticRoleConfidence,
    }));
  }

  function setAutoUse(checked: boolean) {
    updateSelectedSlide((slide) => ({
      ...slide,
      autoUse: checked,
    }));
  }

  function setSlotOverride(slotKey: PptTemplateSlotBindingKey, value: string) {
    updateSelectedSlide((slide) => {
      const overrides = { ...(slide.slotOverrides ?? {}) };
      if (!value || value === slotKey) {
        delete overrides[slotKey];
      } else {
        overrides[slotKey] = value as PptTemplateSlotBindingKey | "__NONE__";
      }
      return {
        ...slide,
        slotOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      };
    });
  }

  async function handleSave() {
    const current = profile();
    if (!current) return;
    setSaving(true);
    try {
      const saved = await updateTemplateProfile(params.id, current);
      mutate(saved);
      showToast("模板画像已保存", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "保存模板画像失败";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReRecognize() {
    setReRecognizing(true);
    try {
      await reRecognizeTemplate(params.id);
      await refetch();
      showToast("模板画像已重新识别", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "模板重识别失败";
      showToast(msg, "error");
    } finally {
      setReRecognizing(false);
    }
  }

  return (
    <div class="min-h-full bg-[#f8fafc] p-6">
      <div class="mx-auto max-w-[1600px]">
        <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin/internal/ppt-templates")}
              class="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
            >
              <span aria-hidden="true">←</span>
              返回模板列表
            </button>
            <Show when={template()} fallback={<div class="text-sm text-slate-400">正在加载模板...</div>}>
              {(tpl) => (
                <>
                  <h1 class="text-2xl font-bold text-slate-950">
                    模板画像编辑（Legacy / Internal）
                  </h1>
                  <p class="mt-1 text-sm text-slate-500">
                    {tpl().name} · {tpl().aspectRatio} · {tpl().type === "native_pptx" ? "原生模板" : "代码主题"}
                  </p>
                </>
              )}
            </Show>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleReRecognize()}
              disabled={reRecognizing()}
              class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reRecognizing() ? "重识别中..." : "重新识别模板"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving() || !profile()}
              class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving() ? "保存中..." : "保存画像"}
            </button>
          </div>
        </div>

        <div class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          此页仅用于维护历史模板画像。普通用户的 PPT 导出主流程已切换到内置 style-pack 风格系统，
          不再依赖这里的模板编辑结果。
        </div>

        <Show when={profile.loading}>
          <div class="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            正在加载模板画像...
          </div>
        </Show>

        <Show when={profile.error}>
          {(error) => (
            <div class="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600 shadow-sm">
              {error().message}
            </div>
          )}
        </Show>

        <Show when={profile()}>
          {(loadedProfile) => (
            <div class="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <aside class="space-y-4">
                <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p class="text-sm font-semibold text-slate-900">模板总览</p>
                  <div class="mt-3 grid grid-cols-2 gap-3">
                    <div class="rounded-xl bg-slate-50 px-3 py-3">
                      <p class="text-[11px] uppercase tracking-wide text-slate-500">总页数</p>
                      <p class="mt-1 text-lg font-semibold text-slate-900">
                        {loadedProfile().summary.slideCount}
                      </p>
                    </div>
                    <div class="rounded-xl bg-slate-50 px-3 py-3">
                      <p class="text-[11px] uppercase tracking-wide text-slate-500">参与匹配</p>
                      <p class="mt-1 text-lg font-semibold text-slate-900">
                        {loadedProfile().summary.editableSlideCount}
                      </p>
                    </div>
                  </div>
                </div>
                <div class="space-y-4">
                  <For each={loadedProfile().slides}>
                    {(slide) => (
                      <TemplateSlidePreview
                        template={template() ?? undefined}
                        slide={slide}
                        compact
                        selected={selectedSlideNumber() === slide.slideNumber}
                        onClick={() => setSelectedSlideNumber(slide.slideNumber)}
                      />
                    )}
                  </For>
                </div>
              </aside>

              <section class="space-y-6">
                <Show when={selectedSlide()} fallback={<div class="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">请选择左侧页面。</div>}>
                  {(slide) => (
                    <>
                      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                              Slide {slide().slideNumber}
                            </p>
                            <h2 class="mt-1 text-xl font-semibold text-slate-950">{slide().layoutName}</h2>
                            <p class="mt-1 text-sm text-slate-500">
                              自动识别：{slide().semanticRole ? SEMANTIC_ROLE_LABELS[slide().semanticRole] : "未分类"}
                              {" · "}
                              置信度 {confidenceLabel(slide().semanticRoleConfidence)}
                              {" · "}
                              密度 {slide().contentDensity}
                            </p>
                          </div>
                          <span class={`rounded-full px-3 py-1 text-xs font-medium ${slide().autoUse ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {slide().autoUse ? "参与自动匹配" : "已排除自动匹配"}
                          </span>
                        </div>

                        <TemplateSlidePreview
                          template={template() ?? undefined}
                          slide={slide()}
                        />
                      </div>

                      <div class="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
                        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h3 class="text-base font-semibold text-slate-950">样本文字与槽位</h3>
                          <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                            <Show
                              when={slide().sampleTextSummary.length > 0}
                              fallback={<span>当前未提取到样本文字。</span>}
                            >
                              {slide().sampleTextSummary.join(" / ")}
                            </Show>
                          </div>
                          <div class="mt-5 grid gap-3 md:grid-cols-2">
                            <For each={EDITABLE_SLOT_FIELDS.filter((key) => Boolean(slide()[key]))}>
                              {(key) => (
                                <div class="rounded-xl border border-slate-200 px-4 py-3">
                                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {SLOT_BINDING_LABELS[key]}
                                  </p>
                                  <p class="mt-1 text-sm text-slate-800">
                                    {buildSampleText(slide(), key)}
                                  </p>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>

                        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h3 class="text-base font-semibold text-slate-950">编辑设置</h3>
                          <div class="mt-5 space-y-5">
                            <div>
                              <label class="mb-2 block text-sm font-medium text-slate-700">
                                页语义
                              </label>
                              <select
                                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                value={slide().semanticRole ?? ""}
                                onChange={(e) => setSemanticRole(e.currentTarget.value)}
                              >
                                <option value="">跟随自动识别</option>
                                <For each={semanticRoleOptions}>
                                  {([value, label]) => <option value={value}>{label}</option>}
                                </For>
                              </select>
                            </div>

                            <label class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div>
                                <p class="text-sm font-medium text-slate-800">参与自动匹配</p>
                                <p class="mt-1 text-xs text-slate-500">
                                  关闭后，这页只保留参考，不参与自动模板分配。
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={slide().autoUse}
                                onChange={(e) => setAutoUse(e.currentTarget.checked)}
                              />
                            </label>

                            <div>
                              <p class="mb-2 text-sm font-medium text-slate-700">槽位映射</p>
                              <div class="space-y-3">
                                <For each={EDITABLE_SLOT_FIELDS}>
                                  {(slotKey) => (
                                    <div>
                                      <label class="mb-1 block text-xs font-medium text-slate-500">
                                        {SLOT_BINDING_LABELS[slotKey]}
                                      </label>
                                      <select
                                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                        value={slide().slotOverrides?.[slotKey] ?? slotKey}
                                        onChange={(e) => setSlotOverride(slotKey, e.currentTarget.value)}
                                      >
                                        <option value={slotKey}>保持默认</option>
                                        <option value="__NONE__">禁用此槽位</option>
                                        <For each={EDITABLE_SLOT_FIELDS.filter((candidate) => Boolean(slide()[candidate]))}>
                                          {(candidate) => (
                                            <Show when={candidate !== slotKey}>
                                              <option value={candidate}>{SLOT_BINDING_LABELS[candidate]}</option>
                                            </Show>
                                          )}
                                        </For>
                                      </select>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </Show>
              </section>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
