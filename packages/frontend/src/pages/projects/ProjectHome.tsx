import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { api } from "../../api/client";
import { useAuth } from "../../contexts/auth";
import { showToast } from "../../components/ui/Toast";
import Badge from "../../components/ui/Badge";
import FavoriteButton from "../../components/favorites/FavoriteButton";
import { checkFavorites, recordAccess } from "../../lib/api/user-activity";
import Modal from "../../components/ui/Modal";
import VisibilityBadge from "../../components/documents/VisibilityBadge";
import MemberSelectModal from "../../components/documents/MemberSelectModal";
import WorkflowPreview from "../../components/workspace/WorkflowPreview";
import type { WorkflowNodeDef } from "@intelliflow/shared";

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  createdBy: string;
  memberCount: number;
  userRole: "owner" | "participant" | null;
  createdAt: string;
  updatedAt: string;
};

type DocumentItem = {
  id: string;
  projectId: string;
  workflowId: string;
  title: string;
  description: string | null;
  status: "draft" | "in_progress" | "completed" | "failed";
  visibility: "self" | "project" | "specific";
  createdBy: string;
  creatorName: string;
  createdAt: string;
  /** Progress fields for in_progress documents */
  progressStep?: number;
  totalSteps?: number;
  currentNodeLabel?: string;
  hasFailedNode?: boolean;
  isGenerating?: boolean;
};

type DocumentTypeItem = {
  id: string;
  name: string;
  code: string;
};

type WorkflowItem = {
  id: string;
  documentTypeId: string;
  name: string;
  status: string;
};

const statusMap: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "info"; spinning?: boolean }
> = {
  draft: { label: "草稿", variant: "info" },
  in_progress: { label: "进行中", variant: "info" },
  generating: { label: "生成中", variant: "warning", spinning: true },
  completed: { label: "已完成", variant: "success" },
  failed: { label: "生成失败", variant: "error" },
};

/** Polling interval for document list (seconds) */
const LIST_POLL_INTERVAL = 10;

export default function ProjectHome() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = createSignal<ProjectDetail | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [notFound, setNotFound] = createSignal(false);

  // Document list state
  const [docs, setDocs] = createSignal<DocumentItem[]>([]);
  const [docsTotal, setDocsTotal] = createSignal(0);
  const [docsPage, setDocsPage] = createSignal(1);
  const [docsLoading, setDocsLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const PAGE_SIZE = 20;

  // Create document modal
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
  const [newDocTypeId, setNewDocTypeId] = createSignal("");
  const [newWorkflowId, setNewWorkflowId] = createSignal("");
  const [docTypes, setDocTypes] = createSignal<DocumentTypeItem[]>([]);
  const [workflows, setWorkflows] = createSignal<WorkflowItem[]>([]);
  const [creating, setCreating] = createSignal(false);
  const [previewNodes, setPreviewNodes] = createSignal<WorkflowNodeDef[]>([]);
  const [previewDescription, setPreviewDescription] = createSignal<string | undefined>();
  const [previewLoading, setPreviewLoading] = createSignal(false);

  // Visibility modal
  const [showVisModal, setShowVisModal] = createSignal(false);
  const [visDocId, setVisDocId] = createSignal("");
  const [visValue, setVisValue] = createSignal<"self" | "project" | "specific">("project");
  const [showMemberSelect, setShowMemberSelect] = createSignal(false);
  const [visMemberIds, setVisMemberIds] = createSignal<string[]>([]);

  // Action menu
  const [activeMenu, setActiveMenu] = createSignal<string | null>(null);

  // Document list polling state
  const [hasActiveGenerations, setHasActiveGenerations] = createSignal(false);
  const [listCountdown, setListCountdown] = createSignal(LIST_POLL_INTERVAL);

  // Polling timer: only runs when there are active generations
  let listPollTimer: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    if (hasActiveGenerations()) {
      listPollTimer = setInterval(() => {
        setListCountdown((prev) => {
          if (prev <= 1) {
            fetchDocs();
            return LIST_POLL_INTERVAL;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (listPollTimer) {
        clearInterval(listPollTimer);
        listPollTimer = undefined;
      }
    }
  });

  onCleanup(() => {
    if (listPollTimer) clearInterval(listPollTimer);
  });

  /** Manual refresh — immediately refetch and reset countdown */
  function handleManualListRefresh() {
    fetchDocs();
    setListCountdown(LIST_POLL_INTERVAL);
  }

  async function fetchProject() {
    setLoading(true);
    try {
      const { data, error } = await api.api.projects({ id: params.id }).get();
      if (error) {
        setNotFound(true);
        return;
      }
      setProject(data as unknown as ProjectDetail);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchDocs() {
    setDocsLoading(true);
    try {
      const { data, error } = await api.api.documents.get({
        query: {
          projectId: params.id,
          page: String(docsPage()),
          pageSize: String(PAGE_SIZE),
          search: searchQuery() || undefined,
          status: statusFilter() || undefined,
        },
      });
      if (error) return;
      const result = data as unknown as { data: DocumentItem[]; total: number };
      setDocs(result.data);
      setDocsTotal(result.total);

      // Check for active generations to control polling
      const hasActive = result.data.some((d) => d.isGenerating && !d.hasFailedNode);
      setHasActiveGenerations(hasActive);
      if (hasActive) {
        setListCountdown(LIST_POLL_INTERVAL);
      }
    } catch {
      showToast("加载文档列表失败", "error");
    } finally {
      setDocsLoading(false);
    }
  }

  async function fetchDocTypes() {
    try {
      const { data, error } = await api.api["document-types"].get({
        query: { page: "1", pageSize: "100" },
      });
      if (error) return;
      const result = data as unknown as { data: DocumentTypeItem[] };
      setDocTypes(result.data.filter((dt: DocumentTypeItem & { isActive?: boolean }) => (dt as DocumentTypeItem & { isActive?: boolean }).isActive !== false));
    } catch {
      // ignore
    }
  }

  async function fetchWorkflows(documentTypeId: string) {
    try {
      const { data, error } = await api.api.workflows.get({
        query: { page: "1", pageSize: "100", documentTypeId },
      });
      if (error) return;
      const result = data as unknown as { data: WorkflowItem[] };
      setWorkflows(result.data.filter((w) => w.status === "active"));
    } catch {
      // ignore
    }
  }

  async function fetchWorkflowDetail(workflowId: string) {
    setPreviewLoading(true);
    try {
      const { data, error } = await api.api.workflows({ id: workflowId }).get();
      if (error) return;
      const wf = data as unknown as {
        nodes: WorkflowNodeDef[];
        edges: { source: string; target: string }[];
        description: string | null;
      };
      setPreviewNodes(topoSortNodes(wf.nodes ?? [], wf.edges ?? []));
      setPreviewDescription(wf.description ?? undefined);
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  }

  /** Topologically sort nodes by edges so preview shows execution order */
  function topoSortNodes(
    nodes: WorkflowNodeDef[],
    edges: { source: string; target: string }[],
  ): WorkflowNodeDef[] {
    if (nodes.length === 0) return nodes;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of nodes) {
      inDegree.set(n.id, 0);
      adj.set(n.id, []);
    }
    for (const e of edges) {
      adj.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
    const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
    const sorted: WorkflowNodeDef[] = [];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      const node = nodeMap.get(id);
      if (node) sorted.push(node);
      for (const next of adj.get(id) ?? []) {
        const deg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }
    // Append any remaining nodes not in edges
    if (sorted.length < nodes.length) {
      const sortedIds = new Set(sorted.map((n) => n.id));
      for (const n of nodes) {
        if (!sortedIds.has(n.id)) sorted.push(n);
      }
    }
    return sorted;
  }

  // Favorite state for this project
  const [projectFavorited, setProjectFavorited] = createSignal(false);

  onMount(async () => {
    await fetchProject();
    if (!notFound()) {
      await fetchDocs();

      // Record recent access (fire-and-forget)
      if (params.id) {
        recordAccess("project", params.id).catch(() => {});
      }

      // Check favorite status for this project
      if (params.id) {
        checkFavorites([{ targetType: "project", targetId: params.id }])
          .then((favKeys) => {
            setProjectFavorited(favKeys.includes(`project:${params.id}`));
          })
          .catch(() => {});
      }
    }
  });

  const isOwner = () => project()?.userRole === "owner";
  const totalPages = () => Math.ceil(docsTotal() / PAGE_SIZE);

  function handleSearch() {
    setDocsPage(1);
    fetchDocs();
  }

  function handleStatusChange(status: string) {
    setStatusFilter(status);
    setDocsPage(1);
    fetchDocs();
  }

  function handlePageChange(page: number) {
    setDocsPage(page);
    fetchDocs();
  }

  function openCreateModal() {
    setNewTitle("");
    setNewDescription("");
    setNewDocTypeId("");
    setNewWorkflowId("");
    setWorkflows([]);
    setPreviewNodes([]);
    setPreviewDescription(undefined);
    fetchDocTypes();
    setShowCreateModal(true);
  }

  function handleDocTypeChange(docTypeId: string) {
    setNewDocTypeId(docTypeId);
    setNewWorkflowId("");
    setPreviewNodes([]);
    setPreviewDescription(undefined);
    if (docTypeId) {
      fetchWorkflows(docTypeId);
    } else {
      setWorkflows([]);
    }
  }

  function handleWorkflowChange(workflowId: string) {
    setNewWorkflowId(workflowId);
    if (workflowId) {
      fetchWorkflowDetail(workflowId);
    } else {
      setPreviewNodes([]);
      setPreviewDescription(undefined);
    }
  }

  async function handleCreate() {
    if (!newTitle().trim()) {
      showToast("请输入文档标题", "error");
      return;
    }
    if (!newWorkflowId()) {
      showToast("请选择工作流", "error");
      return;
    }
    setCreating(true);
    try {
      const { error } = await api.api.documents.post({
        projectId: params.id,
        workflowId: newWorkflowId(),
        title: newTitle(),
        description: newDescription() || undefined,
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "创建失败", "error");
        return;
      }
      showToast("文档已创建", "success");
      setShowCreateModal(false);
      fetchDocs();
    } catch {
      showToast("网络错误", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("确定要删除此文档吗？文档将移入回收站。")) return;
    try {
      const { error } = await api.api.documents({ id: docId }).delete();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "删除失败", "error");
        return;
      }
      showToast("文档已移入回收站", "success");
      fetchDocs();
    } catch {
      showToast("网络错误", "error");
    }
    setActiveMenu(null);
  }

  function openVisibilityEdit(doc: DocumentItem) {
    setVisDocId(doc.id);
    setVisValue(doc.visibility);
    setVisMemberIds([]);
    setShowVisModal(true);
    setActiveMenu(null);
  }

  async function handleVisibilityChange() {
    if (visValue() === "specific") {
      // Open member select modal
      setShowVisModal(false);
      setShowMemberSelect(true);
      return;
    }
    await saveVisibility(visValue(), []);
  }

  async function saveVisibility(visibility: "self" | "project" | "specific", memberIds: string[]) {
    try {
      const { error } = await api.api.documents({ id: visDocId() }).visibility.patch({
        visibility,
        memberIds: visibility === "specific" ? memberIds : undefined,
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "更新可见性失败", "error");
        return;
      }
      showToast("可见性已更新", "success");
      setShowVisModal(false);
      setShowMemberSelect(false);
      fetchDocs();
    } catch {
      showToast("网络错误", "error");
    }
  }

  function handleMemberSelectConfirm(selectedIds: string[]) {
    setVisMemberIds(selectedIds);
    saveVisibility("specific", selectedIds);
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
  const primaryBtnClass =
    "px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";
  const cancelBtnClass =
    "px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div class="p-6">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20">
          <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={notFound() && !loading()}>
        <div class="text-center py-20">
          <p class="text-slate-500 text-sm">项目不存在或已被删除</p>
          <A href="/projects" class="text-sm text-indigo-600 hover:text-indigo-800 mt-2 inline-block cursor-pointer">
            返回项目列表
          </A>
        </div>
      </Show>

      <Show when={project() && !loading()}>
        {/* Breadcrumb */}
        <div class="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <A href="/projects" class="hover:text-indigo-600 cursor-pointer transition-colors">
            项目列表
          </A>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>分隔</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="text-slate-700 font-medium">{project()!.name}</span>
        </div>

        {/* Project info bar */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold text-indigo-950">{project()!.name}</h1>
                <FavoriteButton
                  targetType="project"
                  targetId={params.id}
                  initialFavorited={projectFavorited()}
                />
              </div>
              <Show when={project()!.description}>
                <p class="text-sm text-slate-500 mt-1">{project()!.description}</p>
              </Show>
              <div class="flex items-center gap-4 mt-3 text-sm text-slate-400">
                <Show when={project()!.department}>
                  <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <title>部门</title>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {project()!.department}
                  </span>
                </Show>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <title>成员</title>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {project()!.memberCount} 名成员
                </span>
              </div>
            </div>

            <Show when={isOwner()}>
              <A
                href={`/projects/${params.id}/settings`}
                class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="项目设置"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>设置</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </A>
            </Show>
          </div>
        </div>

        {/* Document list section */}
        <div class="bg-white border border-slate-200 rounded-xl">
          {/* Toolbar */}
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 flex-1">
              {/* Search */}
              <div class="relative flex-1 max-w-xs">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>搜索</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="搜索文档标题..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter()}
                onChange={(e) => handleStatusChange(e.currentTarget.value)}
                class="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors cursor-pointer bg-white"
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="failed">生成失败</option>
              </select>
            </div>

            <div class="flex items-center gap-3">
              {/* Polling countdown + manual refresh */}
              <Show when={hasActiveGenerations()}>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
                  <svg
                    class="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {listCountdown()}秒后自动刷新
                  <button
                    type="button"
                    class="ml-0.5 p-0.5 rounded hover:bg-amber-100 transition-colors cursor-pointer border-0 bg-transparent text-amber-700"
                    onClick={handleManualListRefresh}
                    title="立即刷新"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </span>
              </Show>

              {/* Create button */}
              <button
                type="button"
                onClick={openCreateModal}
                class="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>新建</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                新建文档
              </button>
            </div>
          </div>

          {/* Table */}
          <Show when={docsLoading()}>
            <div class="flex items-center justify-center py-16">
              <div class="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!docsLoading()}>
            <Show when={docs().length === 0}>
              <div class="text-center py-16">
                <svg class="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>文档</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-sm text-slate-400">
                  {searchQuery() || statusFilter() ? "没有匹配的文档" : "暂无文档，点击上方按钮创建"}
                </p>
              </div>
            </Show>

            <Show when={docs().length > 0}>
              <div>
                <table class="min-w-full divide-y divide-slate-200">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-5 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">标题</th>
                      <th class="px-5 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">状态</th>
                      <th class="px-5 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">可见性</th>
                      <th class="px-5 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">创建人</th>
                      <th class="px-5 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">创建时间</th>
                      <th class="px-5 py-3 text-right text-xs font-semibold text-indigo-900 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-slate-100">
                    <For each={docs()}>
                      {(doc) => {
                        const effectiveStatus = () =>
                          doc.hasFailedNode ? "failed"
                          : doc.isGenerating ? "generating"
                          : doc.status;
                        const st = () => statusMap[effectiveStatus()] ?? statusMap.draft;
                        const canEdit = () => doc.createdBy === auth.user()?.id;
                        const canDelete = () => doc.createdBy === auth.user()?.id || isOwner();

                        return (
                          <tr
                            class="transition-colors hover:bg-indigo-50/50 cursor-pointer"
                            onClick={() => navigate(`/documents/${doc.id}`)}
                          >
                            <td class="px-5 py-3 text-sm max-w-xs">
                              <div class="font-medium text-slate-900 truncate">{doc.title}</div>
                              <Show when={(effectiveStatus() === "generating" || effectiveStatus() === "in_progress") && doc.totalSteps && doc.totalSteps > 0}>
                                <div class="mt-1.5 space-y-1">
                                  <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      class="h-full bg-indigo-500 rounded-full transition-all"
                                      style={{ width: `${Math.round(((doc.progressStep ?? 0) / (doc.totalSteps ?? 1)) * 100)}%` }}
                                    />
                                  </div>
                                  <p class="text-xs text-slate-400">
                                    步骤: {(doc.progressStep ?? 0) + (doc.currentNodeLabel ? 1 : 0)}/{doc.totalSteps}
                                    <Show when={doc.currentNodeLabel}>
                                      {" "}&middot; {doc.currentNodeLabel}
                                    </Show>
                                  </p>
                                </div>
                              </Show>
                            </td>
                            <td class="px-5 py-3 text-sm">
                              <span class="inline-flex items-center gap-1">
                                <Show when={st().spinning}>
                                  <svg
                                    class="w-3 h-3 animate-spin"
                                    style={{ color: "#d97706" }}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                </Show>
                                <Badge label={st().label} variant={st().variant} />
                              </span>
                            </td>
                            <td class="px-5 py-3 text-sm">
                              <VisibilityBadge visibility={doc.visibility} />
                            </td>
                            <td class="px-5 py-3 text-sm text-slate-500">{doc.creatorName}</td>
                            <td class="px-5 py-3 text-sm text-slate-400">{formatDate(doc.createdAt)}</td>
                            <td class="px-5 py-3 text-sm text-right">
                              <div class="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setActiveMenu(activeMenu() === doc.id ? null : doc.id)}
                                  class="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer focus:outline-none"
                                >
                                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <title>操作</title>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>
                                <Show when={activeMenu() === doc.id}>
                                  <div class="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                                    <Show when={canEdit()}>
                                      <button
                                        type="button"
                                        onClick={() => openVisibilityEdit(doc)}
                                        class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                                      >
                                        编辑可见性
                                      </button>
                                    </Show>
                                    <Show when={canDelete()}>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(doc.id)}
                                        class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                      >
                                        删除
                                      </button>
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Show when={totalPages() > 1}>
                <div class="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <span class="text-sm text-slate-500">共 {docsTotal()} 条</span>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={docsPage() <= 1}
                      onClick={() => handlePageChange(docsPage() - 1)}
                      class="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      上一页
                    </button>
                    <span class="px-3 py-1 text-sm text-slate-600">
                      {docsPage()} / {totalPages()}
                    </span>
                    <button
                      type="button"
                      disabled={docsPage() >= totalPages()}
                      onClick={() => handlePageChange(docsPage() + 1)}
                      class="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </Show>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Create Document Modal */}
      <Modal isOpen={showCreateModal()} onClose={() => setShowCreateModal(false)} title="新建文档">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="doc-title" class={labelClass}>文档标题</label>
            <input
              id="doc-title"
              type="text"
              value={newTitle()}
              onInput={(e) => setNewTitle(e.currentTarget.value)}
              class={inputClass}
              placeholder="请输入文档标题"
              required
            />
          </div>
          <div>
            <label for="doc-description" class={labelClass}>描述</label>
            <textarea
              id="doc-description"
              value={newDescription()}
              onInput={(e) => setNewDescription(e.currentTarget.value)}
              class={`${inputClass} resize-none`}
              rows={3}
              placeholder="可选"
            />
          </div>
          <div>
            <label for="doc-type" class={labelClass}>文档类型</label>
            <select
              id="doc-type"
              value={newDocTypeId()}
              onChange={(e) => handleDocTypeChange(e.currentTarget.value)}
              class={`${inputClass} cursor-pointer bg-white`}
              required
            >
              <option value="">请选择文档类型</option>
              <For each={docTypes()}>
                {(dt) => <option value={dt.id}>{dt.name}</option>}
              </For>
            </select>
          </div>
          <div>
            <label for="doc-workflow" class={labelClass}>工作流</label>
            <select
              id="doc-workflow"
              value={newWorkflowId()}
              onChange={(e) => handleWorkflowChange(e.currentTarget.value)}
              class={`${inputClass} cursor-pointer bg-white`}
              disabled={!newDocTypeId()}
              required
            >
              <option value="">{newDocTypeId() ? "请选择工作流" : "请先选择文档类型"}</option>
              <For each={workflows()}>
                {(w) => <option value={w.id}>{w.name}</option>}
              </For>
            </select>
          </div>

          {/* Workflow preview */}
          <Show when={previewLoading()}>
            <div class="flex items-center justify-center py-4">
              <div class="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          </Show>
          <Show when={!previewLoading() && previewNodes().length > 0}>
            <WorkflowPreview nodes={previewNodes()} description={previewDescription()} />
          </Show>
          <Show when={!previewLoading() && newDocTypeId() && !newWorkflowId()}>
            <p class="text-xs text-slate-400 text-center py-3">请选择工作流以查看流程预览</p>
          </Show>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} class={cancelBtnClass}>
              取消
            </button>
            <button type="submit" disabled={creating()} class={primaryBtnClass}>
              {creating() ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Visibility Edit Modal */}
      <Modal isOpen={showVisModal()} onClose={() => setShowVisModal(false)} title="编辑可见性">
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-50/50 transition-colors cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={visValue() === "project"}
                onChange={() => setVisValue("project")}
                class="w-4 h-4 text-indigo-600 cursor-pointer"
              />
              <div>
                <span class="text-sm font-medium text-slate-700">项目成员</span>
                <p class="text-xs text-slate-400">项目内所有成员可见</p>
              </div>
            </label>
            <label class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-50/50 transition-colors cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={visValue() === "specific"}
                onChange={() => setVisValue("specific")}
                class="w-4 h-4 text-indigo-600 cursor-pointer"
              />
              <div>
                <span class="text-sm font-medium text-slate-700">指定成员</span>
                <p class="text-xs text-slate-400">仅选定的成员可见</p>
              </div>
            </label>
            <label class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-50/50 transition-colors cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={visValue() === "self"}
                onChange={() => setVisValue("self")}
                class="w-4 h-4 text-indigo-600 cursor-pointer"
              />
              <div>
                <span class="text-sm font-medium text-slate-700">仅自己</span>
                <p class="text-xs text-slate-400">只有创建者可见</p>
              </div>
            </label>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowVisModal(false)} class={cancelBtnClass}>
              取消
            </button>
            <button type="button" onClick={handleVisibilityChange} class={primaryBtnClass}>
              确认
            </button>
          </div>
        </div>
      </Modal>

      {/* Member Select Modal for "specific" visibility */}
      <MemberSelectModal
        isOpen={showMemberSelect()}
        onClose={() => setShowMemberSelect(false)}
        projectId={params.id}
        currentMemberIds={visMemberIds()}
        onConfirm={handleMemberSelectConfirm}
      />
    </div>
  );
}
