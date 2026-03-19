import { For, Show, createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import SearchInput from "../../components/ui/SearchInput";
import Table, { type Column } from "../../components/ui/Table";
import { showToast } from "../../components/ui/Toast";

type WorkflowStatus = "draft" | "active" | "disabled";

type WorkflowListItem = {
  id: string;
  documentTypeId: string;
  documentTypeName: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  isDefault: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

type DocumentType = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export default function WorkflowManagement() {
  const navigate = useNavigate();

  const [workflows, setWorkflows] = createSignal<WorkflowListItem[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [search, setSearch] = createSignal("");
  const [filterDocTypeId, setFilterDocTypeId] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [docTypes, setDocTypes] = createSignal<DocumentType[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [copyingWorkflow, setCopyingWorkflow] = createSignal<WorkflowListItem | null>(null);
  const [confirmAction, setConfirmAction] = createSignal<{
    workflow: WorkflowListItem;
    action: "delete" | "enable" | "disable" | "set-default";
  } | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  // Create form
  const [createDocTypeId, setCreateDocTypeId] = createSignal("");
  const [createName, setCreateName] = createSignal("");
  const [createDescription, setCreateDescription] = createSignal("");
  const [createErrors, setCreateErrors] = createSignal<Record<string, string>>({});

  // Copy form
  const [copyName, setCopyName] = createSignal("");
  const [copyTargetDocTypeId, setCopyTargetDocTypeId] = createSignal("");

  const pageSize = 10;

  async function fetchDocTypes() {
    try {
      const { data, error } = await api.api["document-types"].get({
        query: { page: "1", pageSize: "100" },
      });
      if (error) return;
      const result = data as unknown as { data: DocumentType[]; total: number };
      setDocTypes(result.data.filter((dt) => dt.isActive));
    } catch {
      // non-critical; filter dropdown will be empty
    }
  }

  async function fetchWorkflows() {
    setLoading(true);
    try {
      const query: Record<string, string> = {
        page: String(page()),
        pageSize: String(pageSize),
      };
      if (search()) query.search = search();
      if (filterDocTypeId()) query.documentTypeId = filterDocTypeId();

      const { data, error } = await api.api.workflows.get({ query });
      if (error) {
        showToast("加载流程列表失败", "error");
        return;
      }
      const result = data as unknown as { data: WorkflowListItem[]; total: number };
      setWorkflows(result.data);
      setTotal(result.total);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    fetchDocTypes();
    fetchWorkflows();
  });

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    fetchWorkflows();
  }

  function handleDocTypeFilterChange(value: string) {
    setFilterDocTypeId(value);
    setPage(1);
    fetchWorkflows();
  }

  function validateCreateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!createDocTypeId()) {
      errors.documentTypeId = "请选择文档类型";
    }
    if (!createName().trim()) {
      errors.name = "流程名称不能为空";
    } else if (createName().length > 100) {
      errors.name = "流程名称不能超过 100 个字符";
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
      const body: { documentTypeId: string; name: string; description?: string } = {
        documentTypeId: createDocTypeId(),
        name: createName(),
      };
      if (createDescription().trim()) {
        body.description = createDescription();
      }
      const { error } = await api.api.workflows.post(body);
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "创建流程失败", "error");
        return;
      }
      showToast("流程创建成功", "success");
      setShowCreateModal(false);
      resetCreateForm();
      await fetchWorkflows();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setCreateDocTypeId("");
    setCreateName("");
    setCreateDescription("");
    setCreateErrors({});
  }

  function openCopyModal(workflow: WorkflowListItem) {
    setCopyingWorkflow(workflow);
    setCopyName(`副本 - ${workflow.name}`);
    setCopyTargetDocTypeId(workflow.documentTypeId);
  }

  async function handleCopy() {
    const workflow = copyingWorkflow();
    if (!workflow) return;
    if (!copyName().trim()) {
      showToast("请输入流程名称", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body: { name: string; targetDocumentTypeId?: string } = {
        name: copyName(),
      };
      if (copyTargetDocTypeId() && copyTargetDocTypeId() !== workflow.documentTypeId) {
        body.targetDocumentTypeId = copyTargetDocTypeId();
      }
      const { error } = await api.api.workflows({ id: workflow.id }).copy.post(body);
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "复制流程失败", "error");
        return;
      }
      showToast("流程复制成功", "success");
      setCopyingWorkflow(null);
      await fetchWorkflows();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmAction() {
    const action = confirmAction();
    if (!action) return;
    setSubmitting(true);
    try {
      if (action.action === "delete") {
        const { error } = await api.api.workflows({ id: action.workflow.id }).delete();
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "删除流程失败", "error");
          return;
        }
        showToast("流程已删除", "success");
      } else if (action.action === "enable" || action.action === "disable") {
        const newStatus = action.action === "enable" ? "active" : "disabled";
        const { error } = await api.api.workflows({ id: action.workflow.id }).status.patch({
          status: newStatus,
        });
        if (error) {
          const errData = error.value as { error?: string; message?: string } | undefined;
          showToast(
            errData?.error ?? errData?.message ?? (action.action === "enable" ? "启用失败" : "停用失败"),
            "error",
          );
          return;
        }
        showToast(action.action === "enable" ? "流程已启用" : "流程已停用", "success");
      } else if (action.action === "set-default") {
        const { error } = await api.api.workflows({ id: action.workflow.id })["set-default"].patch();
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "设为默认失败", "error");
          return;
        }
        showToast("已设为默认流程", "success");
      }
      setConfirmAction(null);
      await fetchWorkflows();
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

  function statusBadge(status: WorkflowStatus) {
    if (status === "active") return <Badge label="启用" variant="success" />;
    if (status === "disabled") return <Badge label="停用" variant="error" />;
    return <Badge label="草稿" variant="warning" />;
  }

  const inputClass =
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
  const cancelBtnClass =
    "px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const primaryBtnClass =
    "px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";

  const columns: Column<WorkflowListItem>[] = [
    {
      key: "name",
      header: "流程名称",
      render: (wf) => (
        <div>
          <span class="font-medium text-slate-900">{wf.name}</span>
          <Show when={wf.description}>
            <p class="text-xs text-slate-400 truncate max-w-xs mt-0.5">{wf.description}</p>
          </Show>
        </div>
      ),
    },
    {
      key: "documentTypeName",
      header: "文档类型",
      render: (wf) => (
        <span class="text-sm text-slate-600">{wf.documentTypeName}</span>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (wf) => statusBadge(wf.status),
    },
    {
      key: "isDefault",
      header: "默认",
      render: (wf) => (
        <Show when={wf.isDefault}>
          <Badge label="默认" variant="info" />
        </Show>
      ),
    },
    {
      key: "nodeCount",
      header: "节点数",
      render: (wf) => (
        <span class="text-sm text-slate-500">{wf.nodeCount}</span>
      ),
    },
    {
      key: "createdAt",
      header: "创建时间",
      render: (wf) => <>{formatDate(wf.createdAt)}</>,
    },
    {
      key: "actions",
      header: "操作",
      render: (wf) => (
        <div class="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(`/admin/workflows/${wf.id}/edit`)}
            class="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
          >
            编辑
          </button>
          <Show when={wf.status !== "active"}>
            <button
              type="button"
              onClick={() => setConfirmAction({ workflow: wf, action: "enable" })}
              class="text-sm text-emerald-600 hover:text-emerald-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-1"
            >
              启用
            </button>
          </Show>
          <Show when={wf.status === "active"}>
            <button
              type="button"
              onClick={() => setConfirmAction({ workflow: wf, action: "disable" })}
              class="text-sm text-amber-600 hover:text-amber-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-1"
            >
              停用
            </button>
          </Show>
          <Show when={wf.status === "active" && !wf.isDefault}>
            <button
              type="button"
              onClick={() => setConfirmAction({ workflow: wf, action: "set-default" })}
              class="text-sm text-slate-600 hover:text-slate-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 rounded px-1"
            >
              设为默认
            </button>
          </Show>
          <button
            type="button"
            onClick={() => openCopyModal(wf)}
            class="text-sm text-slate-600 hover:text-slate-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 rounded px-1"
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ workflow: wf, action: "delete" })}
            class="text-sm text-red-500 hover:text-red-700 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  function confirmTitle() {
    const action = confirmAction();
    if (!action) return "";
    if (action.action === "delete") return "确认删除";
    if (action.action === "enable") return "确认启用";
    if (action.action === "disable") return "确认停用";
    return "确认设为默认";
  }

  function confirmMessage() {
    const action = confirmAction();
    if (!action) return "";
    if (action.action === "delete")
      return `确定要删除流程「${action.workflow.name}」吗？此操作不可撤销。`;
    if (action.action === "enable")
      return `确定要启用流程「${action.workflow.name}」吗？`;
    if (action.action === "disable")
      return `确定要停用流程「${action.workflow.name}」吗？`;
    return `确定要将「${action.workflow.name}」设为该文档类型的默认流程吗？`;
  }

  function confirmBtnClass() {
    const action = confirmAction();
    if (!action) return primaryBtnClass;
    if (action.action === "delete")
      return "px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2";
    if (action.action === "enable")
      return "px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2";
    return primaryBtnClass;
  }

  function confirmBtnLabel() {
    const action = confirmAction();
    if (!action) return "";
    if (submitting()) return "处理中...";
    if (action.action === "delete") return "确认删除";
    if (action.action === "enable") return "确认启用";
    if (action.action === "disable") return "确认停用";
    return "确认设为默认";
  }

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-indigo-950">流程管理</h1>
          <p class="text-sm text-slate-400 mt-0.5">管理文档生成流程编排</p>
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
          新建流程
        </button>
      </div>

      {/* Filters */}
      <div class="flex items-center gap-3 mb-4">
        <select
          value={filterDocTypeId()}
          onChange={(e) => handleDocTypeFilterChange(e.currentTarget.value)}
          class="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors bg-white"
        >
          <option value="">全部文档类型</option>
          <For each={docTypes()}>
            {(dt) => <option value={dt.id}>{dt.name}</option>}
          </For>
        </select>
        <div class="w-64">
          <SearchInput
            value={search()}
            onChange={handleSearchChange}
            placeholder="按流程名称搜索..."
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={workflows()}
        loading={loading()}
        emptyMessage="暂无流程数据"
      />

      <Pagination
        page={page()}
        pageSize={pageSize}
        total={total()}
        onPageChange={(p) => {
          setPage(p);
          fetchWorkflows();
        }}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
        title="新建流程"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="create-doc-type" class={labelClass}>
              文档类型
            </label>
            <select
              id="create-doc-type"
              value={createDocTypeId()}
              onChange={(e) => setCreateDocTypeId(e.currentTarget.value)}
              class={inputClass}
              required
            >
              <option value="">请选择文档类型</option>
              <For each={docTypes()}>
                {(dt) => <option value={dt.id}>{dt.name}</option>}
              </For>
            </select>
            {createErrors().documentTypeId && (
              <p class="mt-1 text-xs text-red-600">{createErrors().documentTypeId}</p>
            )}
          </div>
          <div>
            <label for="create-name" class={labelClass}>
              流程名称
            </label>
            <input
              id="create-name"
              type="text"
              value={createName()}
              onInput={(e) => setCreateName(e.currentTarget.value)}
              placeholder="例如：标准合同审查流程"
              class={inputClass}
              required
            />
            {createErrors().name && (
              <p class="mt-1 text-xs text-red-600">{createErrors().name}</p>
            )}
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

      {/* Copy Modal */}
      <Modal
        isOpen={!!copyingWorkflow()}
        onClose={() => setCopyingWorkflow(null)}
        title="复制流程"
      >
        <div class="space-y-4">
          <div>
            <label for="copy-name" class={labelClass}>
              新流程名称
            </label>
            <input
              id="copy-name"
              type="text"
              value={copyName()}
              onInput={(e) => setCopyName(e.currentTarget.value)}
              class={inputClass}
            />
          </div>
          <div>
            <label for="copy-doc-type" class={labelClass}>
              目标文档类型
            </label>
            <select
              id="copy-doc-type"
              value={copyTargetDocTypeId()}
              onChange={(e) => setCopyTargetDocTypeId(e.currentTarget.value)}
              class={inputClass}
            >
              <For each={docTypes()}>
                {(dt) => <option value={dt.id}>{dt.name}</option>}
              </For>
            </select>
            <p class="mt-1 text-xs text-slate-400">
              可选择不同文档类型实现跨类型复制
            </p>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCopyingWorkflow(null)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={submitting()}
              class={primaryBtnClass}
            >
              {submitting() ? "复制中..." : "确认复制"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Action Dialog */}
      <Modal
        isOpen={!!confirmAction()}
        onClose={() => setConfirmAction(null)}
        title={confirmTitle()}
      >
        <div class="space-y-4">
          <p class="text-sm text-slate-600">{confirmMessage()}</p>
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
              onClick={handleConfirmAction}
              disabled={submitting()}
              class={confirmBtnClass()}
            >
              {confirmBtnLabel()}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
