import { useNavigate } from "@solidjs/router";
import { For, Show, createSignal, onMount } from "solid-js";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import Table, { type Column } from "../../components/ui/Table";
import { showToast } from "../../components/ui/Toast";
import {
  type PptTemplate,
  type PptTemplateSemanticRole,
  type PptTemplateType,
  createTheme,
  deleteTemplate,
  listTemplates,
  reRecognizeTemplate,
  setDefaultTemplate,
  updateTemplate,
  uploadTemplate,
} from "../../lib/api/ppt-templates";

type ConfirmAction = {
  template: PptTemplate;
  action: "toggle" | "delete" | "setDefault";
};

const TYPE_LABELS: Record<PptTemplateType, string> = {
  code_theme: "代码主题",
  native_pptx: "原生模板",
};

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

function getNativeTemplateRecognitionSummary(template: PptTemplate): string | null {
  if (template.type !== "native_pptx" || !template.themeConfig || typeof template.themeConfig !== "object") {
    return null;
  }

  const profile = template.themeConfig as {
    kind?: string;
    summary?: {
      recognizedRoleCounts?: Record<string, number>;
      semanticRoleCounts?: Record<string, number>;
    };
  };
  if (profile.kind !== "native_template_profile_v1" && profile.kind !== "native_template_profile_v2") {
    return null;
  }

  const counts = profile.summary?.recognizedRoleCounts ?? {};
  const semanticCounts = profile.summary?.semanticRoleCounts ?? {};
  const parts = [
    semanticCounts.cover ? `封面 ${semanticCounts.cover}` : counts.title ? `封面 ${counts.title}` : null,
    semanticCounts.bullet_list ? `正文 ${semanticCounts.bullet_list}` : counts.content ? `正文 ${counts.content}` : null,
    semanticCounts.comparison ? `对比 ${semanticCounts.comparison}` : counts.two_column ? `双栏 ${counts.two_column}` : null,
    semanticCounts.image_focus ? `图片 ${semanticCounts.image_focus}` : counts.image ? `图片 ${counts.image}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "已生成模板画像";
}

export default function PptTemplateManagement() {
  const navigate = useNavigate();
  const [templates, setTemplates] = createSignal<PptTemplate[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [loading, setLoading] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);

  // Create theme modal
  const [showThemeModal, setShowThemeModal] = createSignal(false);
  const [themeName, setThemeName] = createSignal("");
  const [themeDesc, setThemeDesc] = createSignal("");
  const [themeRatio, setThemeRatio] = createSignal("16:9");
  const [themeConfigJson, setThemeConfigJson] = createSignal("{}");

  // Upload modal
  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [uploadFile, setUploadFile] = createSignal<File | null>(null);
  const [uploadName, setUploadName] = createSignal("");
  const [uploadDesc, setUploadDesc] = createSignal("");

  // Edit modal
  const [editingTemplate, setEditingTemplate] = createSignal<PptTemplate | null>(null);
  const [editName, setEditName] = createSignal("");
  const [editDesc, setEditDesc] = createSignal("");
  const [editRatio, setEditRatio] = createSignal("16:9");
  const [editThemeJson, setEditThemeJson] = createSignal("{}");

  // Confirm
  const [confirmAction, setConfirmAction] = createSignal<ConfirmAction | null>(null);

  const pageSize = 20;

  async function fetchTemplates(nextPage = page()) {
    setLoading(true);
    try {
      const res = await listTemplates(nextPage, pageSize, undefined, {
        includeInactive: true,
      });
      setTemplates(res.data);
      setTotal(res.pagination.total);
      setPage(res.pagination.page);
    } catch {
      showToast("加载模板列表失败", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchTemplates);

  // --- Create theme ---
  function openThemeModal() {
    setThemeName("");
    setThemeDesc("");
    setThemeRatio("16:9");
    setThemeConfigJson("{}");
    setShowThemeModal(true);
  }

  async function handleCreateTheme() {
    if (!themeName().trim()) {
      showToast("请输入模板名称", "error");
      return;
    }
    let config: unknown;
    try {
      config = JSON.parse(themeConfigJson());
    } catch {
      showToast("主题配置 JSON 格式错误", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createTheme({
        name: themeName(),
        description: themeDesc() || undefined,
        aspectRatio: themeRatio(),
        themeConfig: config,
      });
      showToast("代码主题创建成功", "success");
      setShowThemeModal(false);
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "创建失败";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Upload ---
  function openUploadModal() {
    setUploadFile(null);
    setUploadName("");
    setUploadDesc("");
    setShowUploadModal(true);
  }

  async function handleUpload() {
    const file = uploadFile();
    if (!file) {
      showToast("请选择 .pptx 文件", "error");
      return;
    }
    if (!uploadName().trim()) {
      showToast("请输入模板名称", "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await uploadTemplate(file, uploadName(), uploadDesc() || undefined);
      showToast("模板上传成功", "success");
      if (result.validation.warnings.length > 0) {
        showToast(`模板已上传，但有 ${result.validation.warnings.length} 条校验警告`, "error");
      }
      setShowUploadModal(false);
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Edit ---
  function openEditModal(t: PptTemplate) {
    setEditingTemplate(t);
    setEditName(t.name);
    setEditDesc(t.description ?? "");
    setEditRatio(t.aspectRatio ?? "16:9");
    setEditThemeJson(t.themeConfig ? JSON.stringify(t.themeConfig, null, 2) : "{}");
  }

  async function handleEdit() {
    const t = editingTemplate();
    if (!t) return;
    if (!editName().trim()) {
      showToast("请输入模板名称", "error");
      return;
    }
    const body: Record<string, unknown> = {};
    if (editName() !== t.name) body.name = editName();
    if ((editDesc() || "") !== (t.description || "")) body.description = editDesc();
    if (editRatio() !== t.aspectRatio) body.aspectRatio = editRatio();
    if (t.type === "code_theme") {
      try {
        body.themeConfig = JSON.parse(editThemeJson());
      } catch {
        showToast("主题配置 JSON 格式错误", "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      await updateTemplate(t.id, body);
      showToast("模板更新成功", "success");
      setEditingTemplate(null);
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "更新失败";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Confirm actions ---
  async function handleConfirm() {
    const action = confirmAction();
    if (!action) return;
    setSubmitting(true);
    try {
      if (action.action === "toggle") {
        await updateTemplate(action.template.id, { isActive: !action.template.isActive });
        showToast(action.template.isActive ? "模板已停用" : "模板已启用", "success");
      } else if (action.action === "delete") {
        await deleteTemplate(action.template.id);
        showToast("模板已删除", "success");
      } else if (action.action === "setDefault") {
        await setDefaultTemplate(action.template.id);
        showToast("已设为默认模板", "success");
      }
      setConfirmAction(null);
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReRecognize(template: PptTemplate) {
    setSubmitting(true);
    try {
      const result = await reRecognizeTemplate(template.id);
      const roleSummary =
        result.validation.profileSummary
          ? Object.entries(result.validation.profileSummary.recognizedRoleCounts)
              .map(([role, count]) => `${role}:${count}`)
              .join(" / ")
          : "";
      showToast(roleSummary ? `模板识别完成，${roleSummary}` : "模板识别完成", "success");
      if (result.validation.warnings.length > 0) {
        showToast(`识别存在 ${result.validation.warnings.length} 条警告`, "error");
      }
      await fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "模板识别失败";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
  const cancelBtnClass =
    "px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const primaryBtnClass =
    "px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";
  const actionBtnClass =
    "text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1";

  const columns: Column<PptTemplate>[] = [
    {
      key: "name",
      header: "名称",
      render: (t) => (
        <div>
          <span class="font-medium text-slate-900">{t.name}</span>
          <Show when={getNativeTemplateRecognitionSummary(t)}>
            {(summary) => <p class="text-xs text-slate-500 mt-1">{summary()}</p>}
          </Show>
        </div>
      ),
    },
    {
      key: "type",
      header: "类型",
      render: (t) => (
        <Badge
          label={TYPE_LABELS[t.type]}
          variant={t.type === "code_theme" ? "info" : "warning"}
        />
      ),
    },
    {
      key: "aspectRatio",
      header: "比例",
      render: (t) => (
        <code class="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
          {t.aspectRatio ?? "16:9"}
        </code>
      ),
    },
    {
      key: "isActive",
      header: "状态",
      render: (t) => (
        <Badge label={t.isActive ? "正常" : "已停用"} variant={t.isActive ? "success" : "error"} />
      ),
    },
    {
      key: "isDefault",
      header: "默认",
      render: (t) => (
        <Show when={t.isDefault}>
          <Badge label="默认" variant="info" />
        </Show>
      ),
    },
    {
      key: "createdAt",
      header: "创建时间",
      render: (t) => <>{formatDate(t.createdAt)}</>,
    },
    {
      key: "actions",
      header: "操作",
      render: (t) => (
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditModal(t)}
            class={`${actionBtnClass} text-indigo-600 hover:text-indigo-800`}
          >
            编辑
          </button>
          <Show when={t.type === "native_pptx"}>
            <button
              type="button"
              onClick={() => navigate(`/admin/internal/ppt-templates/${t.id}/profile`)}
              class={`${actionBtnClass} text-violet-600 hover:text-violet-800`}
            >
              画像编辑
            </button>
            <button
              type="button"
              onClick={() => void handleReRecognize(t)}
              class={`${actionBtnClass} text-sky-600 hover:text-sky-800`}
            >
              重识别
            </button>
          </Show>
          <button
            type="button"
            onClick={() => setConfirmAction({ template: t, action: "toggle" })}
            class={`${actionBtnClass} ${
              t.isActive
                ? "text-red-600 hover:text-red-800"
                : "text-emerald-600 hover:text-emerald-800"
            }`}
          >
            {t.isActive ? "停用" : "启用"}
          </button>
          <Show when={!t.isDefault && t.isActive}>
            <button
              type="button"
              onClick={() => setConfirmAction({ template: t, action: "setDefault" })}
              class={`${actionBtnClass} text-amber-600 hover:text-amber-800`}
            >
              设为默认
            </button>
          </Show>
          <button
            type="button"
            onClick={() => setConfirmAction({ template: t, action: "delete" })}
            class={`${actionBtnClass} text-red-500 hover:text-red-700`}
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  const confirmMessages: Record<string, (t: PptTemplate) => string> = {
    toggle: (t) => `确定${t.isActive ? "停用" : "启用"}模板「${t.name}」？`,
    delete: (t) => `确定删除模板「${t.name}」？此操作不可撤销。`,
    setDefault: (t) => `确定将「${t.name}」设为默认模板？`,
  };
  const confirmMessage = () => {
    const action = confirmAction();
    return action ? confirmMessages[action.action](action.template) : "";
  };

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-indigo-950">PPT 模板管理（Legacy / Internal）</h1>
          <p class="text-sm text-slate-400 mt-0.5">仅用于维护历史模板数据，不属于普通用户 PPT 导出主流程</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={openUploadModal}
            class="inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>上传</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            上传原生模板
          </button>
          <button
            type="button"
            onClick={openThemeModal}
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>新建</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            新建代码主题
          </button>
        </div>
      </div>

      <div class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        普通用户的 PPT 导出已切换到内置 style-pack 风格系统。此页保留给管理员处理历史模板资产与画像数据。
      </div>

      <Table columns={columns} data={templates()} loading={loading()} emptyMessage="暂无 PPT 模板" />

      <Pagination
        page={page()}
        pageSize={pageSize}
        total={total()}
        onPageChange={(p) => {
          void fetchTemplates(p);
        }}
      />

      {/* Create Theme Modal */}
      <Modal isOpen={showThemeModal()} onClose={() => setShowThemeModal(false)} title="新建代码主题">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTheme(); }} class="space-y-4">
          <div>
            <label for="theme-name" class={labelClass}>名称</label>
            <input id="theme-name" type="text" class={inputClass} value={themeName()} onInput={(e) => setThemeName(e.currentTarget.value)} placeholder="输入主题名称" />
          </div>
          <div>
            <label for="theme-desc" class={labelClass}>描述</label>
            <input id="theme-desc" type="text" class={inputClass} value={themeDesc()} onInput={(e) => setThemeDesc(e.currentTarget.value)} placeholder="可选描述" />
          </div>
          <div>
            <label for="theme-ratio" class={labelClass}>比例</label>
            <select id="theme-ratio" class={inputClass} value={themeRatio()} onChange={(e) => setThemeRatio(e.currentTarget.value)}>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
            </select>
          </div>
          <div>
            <label for="theme-config" class={labelClass}>主题配置 (JSON)</label>
            <textarea
              id="theme-config"
              class={`${inputClass} font-mono text-xs`}
              rows={8}
              value={themeConfigJson()}
              onInput={(e) => setThemeConfigJson(e.currentTarget.value)}
            />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class={cancelBtnClass} onClick={() => setShowThemeModal(false)}>取消</button>
            <button type="submit" class={primaryBtnClass} disabled={submitting()}>{submitting() ? "创建中..." : "创建"}</button>
          </div>
        </form>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal()} onClose={() => setShowUploadModal(false)} title="上传原生模板">
        <form onSubmit={(e) => { e.preventDefault(); handleUpload(); }} class="space-y-4">
          <div>
            <label for="upload-file" class={labelClass}>选择文件 (.pptx)</label>
            <input
              id="upload-file"
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              class={inputClass}
              onChange={(e) => setUploadFile(e.currentTarget.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label for="upload-name" class={labelClass}>名称</label>
            <input id="upload-name" type="text" class={inputClass} value={uploadName()} onInput={(e) => setUploadName(e.currentTarget.value)} placeholder="输入模板名称" />
          </div>
          <div>
            <label for="upload-desc" class={labelClass}>描述</label>
            <input id="upload-desc" type="text" class={inputClass} value={uploadDesc()} onInput={(e) => setUploadDesc(e.currentTarget.value)} placeholder="可选描述" />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class={cancelBtnClass} onClick={() => setShowUploadModal(false)}>取消</button>
            <button type="submit" class={primaryBtnClass} disabled={submitting()}>{submitting() ? "上传中..." : "上传"}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingTemplate()} onClose={() => setEditingTemplate(null)} title="编辑模板">
        <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} class="space-y-4">
          <div>
            <label for="edit-name" class={labelClass}>名称</label>
            <input id="edit-name" type="text" class={inputClass} value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
          </div>
          <div>
            <label for="edit-desc" class={labelClass}>描述</label>
            <input id="edit-desc" type="text" class={inputClass} value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} />
          </div>
          <div>
            <label for="edit-ratio" class={labelClass}>比例</label>
            <select id="edit-ratio" class={inputClass} value={editRatio()} onChange={(e) => setEditRatio(e.currentTarget.value)}>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
            </select>
          </div>
          <Show when={editingTemplate()?.type === "code_theme"}>
            <div>
              <label for="edit-theme" class={labelClass}>主题配置 (JSON)</label>
              <textarea
                id="edit-theme"
                class={`${inputClass} font-mono text-xs`}
                rows={8}
                value={editThemeJson()}
                onInput={(e) => setEditThemeJson(e.currentTarget.value)}
              />
            </div>
          </Show>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class={cancelBtnClass} onClick={() => setEditingTemplate(null)}>取消</button>
            <button type="submit" class={primaryBtnClass} disabled={submitting()}>{submitting() ? "保存中..." : "保存"}</button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modal */}
      <Modal isOpen={!!confirmAction()} onClose={() => setConfirmAction(null)} title="确认操作">
        <div class="space-y-4">
          <p class="text-sm text-slate-700">{confirmMessage()}</p>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class={cancelBtnClass} onClick={() => setConfirmAction(null)}>取消</button>
            <button
              type="button"
              class={
                confirmAction()?.action === "delete"
                  ? "px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  : primaryBtnClass
              }
              disabled={submitting()}
              onClick={handleConfirm}
            >
              {submitting() ? "处理中..." : "确定"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
