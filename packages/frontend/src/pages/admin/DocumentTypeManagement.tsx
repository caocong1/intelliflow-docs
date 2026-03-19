import { createSignal, onMount } from "solid-js";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import SearchInput from "../../components/ui/SearchInput";
import Table, { type Column } from "../../components/ui/Table";
import { showToast } from "../../components/ui/Toast";

type DocumentType = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function DocumentTypeManagement() {
  const [docTypes, setDocTypes] = createSignal<DocumentType[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [search, setSearch] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [editingDocType, setEditingDocType] = createSignal<DocumentType | null>(null);
  const [confirmAction, setConfirmAction] = createSignal<{
    docType: DocumentType;
    action: "toggle" | "delete";
  } | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  // Create form
  const [createName, setCreateName] = createSignal("");
  const [createCode, setCreateCode] = createSignal("");
  const [createDescription, setCreateDescription] = createSignal("");
  const [createErrors, setCreateErrors] = createSignal<Record<string, string>>({});

  // Edit form
  const [editName, setEditName] = createSignal("");
  const [editCode, setEditCode] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");

  const pageSize = 20;

  async function fetchDocTypes() {
    setLoading(true);
    try {
      const query: Record<string, string> = {
        page: String(page()),
        pageSize: String(pageSize),
      };
      if (search()) {
        query.search = search();
      }
      const { data, error } = await api.api["document-types"].get({ query });
      if (error) {
        showToast("加载文档类型失败", "error");
        return;
      }
      const result = data as unknown as { data: DocumentType[]; total: number };
      setDocTypes(result.data);
      setTotal(result.total);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchDocTypes);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    fetchDocTypes();
  }

  function validateCreateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!createName().trim() || createName().length > 100) {
      errors.name = "名称不能为空（最多 100 个字符）";
    }
    if (!createCode().trim() || !/^[a-zA-Z0-9_-]+$/.test(createCode())) {
      errors.code = "标识符只能包含字母、数字、连字符和下划线";
    }
    if (createDescription().length > 500) {
      errors.description = "描述不能超过 500 个字符";
    }
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreate() {
    if (!validateCreateForm()) return;
    setSubmitting(true);
    try {
      const body: { name: string; code: string; description?: string } = {
        name: createName(),
        code: createCode(),
      };
      if (createDescription().trim()) {
        body.description = createDescription();
      }
      const { error } = await api.api["document-types"].post(body);
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "创建文档类型失败", "error");
        return;
      }
      showToast("文档类型创建成功", "success");
      setShowCreateModal(false);
      resetCreateForm();
      await fetchDocTypes();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setCreateName("");
    setCreateCode("");
    setCreateDescription("");
    setCreateErrors({});
  }

  function openEditModal(dt: DocumentType) {
    setEditingDocType(dt);
    setEditName(dt.name);
    setEditCode(dt.code);
    setEditDescription(dt.description ?? "");
  }

  async function handleEdit() {
    const dt = editingDocType();
    if (!dt) return;
    setSubmitting(true);
    try {
      const body: { name?: string; code?: string; description?: string } = {};
      if (editName() !== dt.name) body.name = editName();
      if (editCode() !== dt.code) body.code = editCode();
      if ((editDescription() || "") !== (dt.description || ""))
        body.description = editDescription();

      const { error } = await api.api["document-types"]({ id: dt.id }).patch(body);
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "更新文档类型失败", "error");
        return;
      }
      showToast("文档类型更新成功", "success");
      setEditingDocType(null);
      await fetchDocTypes();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus() {
    const action = confirmAction();
    if (!action || action.action !== "toggle") return;
    setSubmitting(true);
    try {
      const { error } = await api.api["document-types"]({ id: action.docType.id }).status.patch();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "操作失败", "error");
        return;
      }
      showToast(
        action.docType.isActive ? "文档类型已停用" : "文档类型已启用",
        "success",
      );
      setConfirmAction(null);
      await fetchDocTypes();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const action = confirmAction();
    if (!action || action.action !== "delete") return;
    setSubmitting(true);
    try {
      const { error } = await api.api["document-types"]({ id: action.docType.id }).delete();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        const msg = errData?.error ?? "删除文档类型失败";
        showToast(
          msg.includes("associated")
            ? "无法删除：该文档类型存在关联文档"
            : msg,
          "error",
        );
        return;
      }
      showToast("文档类型已删除", "success");
      setConfirmAction(null);
      await fetchDocTypes();
    } catch {
      showToast("网络错误，请稍后重试", "error");
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

  const columns: Column<DocumentType>[] = [
    {
      key: "name",
      header: "名称",
      render: (dt) => <span class="font-medium text-slate-900">{dt.name}</span>,
    },
    {
      key: "code",
      header: "标识符",
      render: (dt) => (
        <code class="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
          {dt.code}
        </code>
      ),
    },
    {
      key: "description",
      header: "描述",
      render: (dt) => (
        <span class="text-slate-400 truncate max-w-xs inline-block">{dt.description ?? "—"}</span>
      ),
    },
    {
      key: "isActive",
      header: "状态",
      render: (dt) => (
        <Badge
          label={dt.isActive ? "正常" : "已停用"}
          variant={dt.isActive ? "success" : "error"}
        />
      ),
    },
    { key: "createdAt", header: "创建时间", render: (dt) => <>{formatDate(dt.createdAt)}</> },
    {
      key: "actions",
      header: "操作",
      render: (dt) => (
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditModal(dt)}
            class="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ docType: dt, action: "toggle" })}
            class={`text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 ${
              dt.isActive
                ? "text-red-600 hover:text-red-800"
                : "text-emerald-600 hover:text-emerald-800"
            }`}
          >
            {dt.isActive ? "停用" : "启用"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ docType: dt, action: "delete" })}
            class="text-sm text-red-500 hover:text-red-700 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-indigo-950">文档类型管理</h1>
          <p class="text-sm text-slate-400 mt-0.5">管理平台支持的文档类型</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-64">
            <SearchInput
              value={search()}
              onChange={handleSearchChange}
              placeholder="按名称或标识符搜索..."
            />
          </div>
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>新建</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            新建文档类型
          </button>
        </div>
      </div>

      <Table
        columns={columns}
        data={docTypes()}
        loading={loading()}
        emptyMessage="暂无文档类型数据"
      />

      <Pagination
        page={page()}
        pageSize={pageSize}
        total={total()}
        onPageChange={(p) => {
          setPage(p);
          fetchDocTypes();
        }}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
        title="新建文档类型"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="create-name" class={labelClass}>
              名称
            </label>
            <input
              id="create-name"
              type="text"
              value={createName()}
              onInput={(e) => setCreateName(e.currentTarget.value)}
              class={inputClass}
              required
            />
            {createErrors().name && <p class="mt-1 text-xs text-red-600">{createErrors().name}</p>}
          </div>
          <div>
            <label for="create-code" class={labelClass}>
              标识符
            </label>
            <input
              id="create-code"
              type="text"
              value={createCode()}
              onInput={(e) => setCreateCode(e.currentTarget.value)}
              placeholder="例如：meeting-notes"
              class={inputClass}
              required
            />
            {createErrors().code && <p class="mt-1 text-xs text-red-600">{createErrors().code}</p>}
          </div>
          <div>
            <label for="create-description" class={labelClass}>
              描述（可选）
            </label>
            <textarea
              id="create-description"
              value={createDescription()}
              onInput={(e) => setCreateDescription(e.currentTarget.value)}
              rows={3}
              class={`${inputClass} resize-none`}
            />
            {createErrors().description && (
              <p class="mt-1 text-xs text-red-600">{createErrors().description}</p>
            )}
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting()}
              class={primaryBtnClass}
            >
              {submitting() ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingDocType()}
        onClose={() => setEditingDocType(null)}
        title="编辑文档类型"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEdit();
          }}
          class="space-y-4"
        >
          <div>
            <label for="edit-name" class={labelClass}>
              名称
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName()}
              onInput={(e) => setEditName(e.currentTarget.value)}
              class={inputClass}
              required
            />
          </div>
          <div>
            <label for="edit-code" class={labelClass}>
              标识符
            </label>
            <input
              id="edit-code"
              type="text"
              value={editCode()}
              onInput={(e) => setEditCode(e.currentTarget.value)}
              class={inputClass}
              required
            />
          </div>
          <div>
            <label for="edit-description" class={labelClass}>
              描述
            </label>
            <textarea
              id="edit-description"
              value={editDescription()}
              onInput={(e) => setEditDescription(e.currentTarget.value)}
              rows={3}
              class={`${inputClass} resize-none`}
            />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingDocType(null)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting()}
              class={primaryBtnClass}
            >
              {submitting() ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Action Dialog */}
      <Modal
        isOpen={!!confirmAction()}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction()?.action === "delete"
            ? "确认删除"
            : confirmAction()?.docType.isActive
              ? "确认停用"
              : "确认启用"
        }
      >
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            {confirmAction()?.action === "delete"
              ? `确定要删除「${confirmAction()?.docType.name}」吗？此操作不可撤销。`
              : confirmAction()?.docType.isActive
                ? `确定要停用「${confirmAction()?.docType.name}」吗？`
                : `确定要启用「${confirmAction()?.docType.name}」吗？`}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmAction()?.action === "delete") handleDelete();
                else handleToggleStatus();
              }}
              disabled={submitting()}
              class={`px-4 py-2 text-sm text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                confirmAction()?.action === "delete" || confirmAction()?.docType.isActive
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
              }`}
            >
              {submitting()
                ? "处理中..."
                : confirmAction()?.action === "delete"
                  ? "确认删除"
                  : confirmAction()?.docType.isActive
                    ? "确认停用"
                    : "确认启用"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
