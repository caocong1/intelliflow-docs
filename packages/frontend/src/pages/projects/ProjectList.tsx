import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, onMount } from "solid-js";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import FavoriteButton from "../../components/favorites/FavoriteButton";
import { checkFavorites } from "../../lib/api/user-activity";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import SearchInput from "../../components/ui/SearchInput";
import Table, { type Column } from "../../components/ui/Table";
import { showToast } from "../../components/ui/Toast";

type ProjectItem = {
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

type TabKey = "created" | "joined" | "all";

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = createSignal<ProjectItem[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [loading, setLoading] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<TabKey>("created");
  const [search, setSearch] = createSignal("");
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);

  // Create form
  const [createName, setCreateName] = createSignal("");
  const [createDescription, setCreateDescription] = createSignal("");
  const [createDepartment, setCreateDepartment] = createSignal("");

  const pageSize = 20;

  // Favorite state: set of favorited project IDs
  const [favoritedIds, setFavoritedIds] = createSignal<Set<string>>(new Set());

  async function fetchProjects() {
    setLoading(true);
    try {
      const { data, error } = await api.api.projects.get({
        query: {
          page: String(page()),
          pageSize: String(pageSize),
          tab: activeTab(),
          search: search() || undefined,
        },
      });
      if (error) {
        showToast("加载项目列表失败", "error");
        return;
      }
      const result = data as unknown as { data: ProjectItem[]; total: number };
      setProjects(result.data);
      setTotal(result.total);

      // Batch-check favorites for loaded projects
      if (result.data.length > 0) {
        checkFavorites(
          result.data.map((p) => ({ targetType: "project", targetId: p.id })),
        )
          .then((favKeys) => {
            const ids = new Set(
              favKeys.map((k) => k.replace("project:", "")),
            );
            setFavoritedIds(ids);
          })
          .catch(() => {
            // Non-critical — don't block project list
          });
      }
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchProjects);

  createEffect(() => {
    // Re-fetch when tab or search changes
    activeTab();
    search();
    setPage(1);
    fetchProjects();
  });

  function handleTabChange(tab: TabKey) {
    if (tab === activeTab()) return;
    setActiveTab(tab);
  }

  async function handleCreate() {
    if (!createName().trim()) {
      showToast("项目名称不能为空", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await api.api.projects.post({
        name: createName(),
        description: createDescription() || undefined,
        department: createDepartment() || undefined,
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "创建项目失败", "error");
        return;
      }
      showToast("项目创建成功", "success");
      setShowCreateModal(false);
      resetCreateForm();
      await fetchProjects();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setCreateName("");
    setCreateDescription("");
    setCreateDepartment("");
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "created", label: "我创建的" },
    { key: "joined", label: "我参与的" },
    { key: "all", label: "全部项目" },
  ];

  const inputClass =
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
  const cancelBtnClass =
    "px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const primaryBtnClass =
    "px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";

  const columns: Column<ProjectItem>[] = [
    {
      key: "name",
      header: "项目名称",
      render: (p) => (
        <div class="flex items-center gap-2">
          <FavoriteButton
            targetType="project"
            targetId={p.id}
            initialFavorited={favoritedIds().has(p.id)}
          />
          <button
            type="button"
            onClick={() => navigate(`/projects/${p.id}`)}
            class="font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors focus:outline-none"
          >
            {p.name}
          </button>
        </div>
      ),
    },
    {
      key: "description",
      header: "描述",
      render: (p) => (
        <span class="text-slate-500 truncate max-w-xs inline-block">
          {p.description || "-"}
        </span>
      ),
    },
    {
      key: "userRole",
      header: "角色",
      render: (p) =>
        p.userRole ? (
          <Badge
            label={p.userRole === "owner" ? "负责人" : "参与者"}
            variant={p.userRole === "owner" ? "info" : "success"}
          />
        ) : (
          <span class="text-slate-300">-</span>
        ),
    },
    {
      key: "memberCount",
      header: "成员数",
      render: (p) => <>{p.memberCount}</>,
    },
    {
      key: "createdAt",
      header: "创建时间",
      render: (p) => <>{formatDate(p.createdAt)}</>,
    },
  ];

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-indigo-950">项目列表</h1>
          <p class="text-sm text-slate-400 mt-0.5">管理和浏览项目</p>
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
          新建项目
        </button>
      </div>

      {/* Tabs */}
      <div class="flex items-center gap-6 mb-4 border-b border-slate-200">
        <For each={tabs}>
          {(tab) => (
            <button
              type="button"
              onClick={() => handleTabChange(tab.key)}
              class={`pb-2.5 text-sm font-medium transition-colors cursor-pointer focus:outline-none ${
                activeTab() === tab.key
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          )}
        </For>
        <div class="flex-1" />
        <div class="w-64 pb-2">
          <SearchInput value={search()} onChange={setSearch} placeholder="搜索项目名称..." />
        </div>
      </div>

      <Table columns={columns} data={projects()} loading={loading()} emptyMessage="暂无项目" />

      <Pagination
        page={page()}
        pageSize={pageSize}
        total={total()}
        onPageChange={(p) => {
          setPage(p);
          fetchProjects();
        }}
      />

      {/* Create Modal */}
      <Modal isOpen={showCreateModal()} onClose={() => setShowCreateModal(false)} title="新建项目">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="create-name" class={labelClass}>
              项目名称
            </label>
            <input
              id="create-name"
              type="text"
              value={createName()}
              onInput={(e) => setCreateName(e.currentTarget.value)}
              class={inputClass}
              placeholder="请输入项目名称"
              required
            />
          </div>
          <div>
            <label for="create-description" class={labelClass}>
              描述
            </label>
            <textarea
              id="create-description"
              value={createDescription()}
              onInput={(e) => setCreateDescription(e.currentTarget.value)}
              class={`${inputClass} resize-none`}
              rows={3}
              placeholder="可选"
            />
          </div>
          <div>
            <label for="create-department" class={labelClass}>
              所属部门
            </label>
            <input
              id="create-department"
              type="text"
              value={createDepartment()}
              onInput={(e) => setCreateDepartment(e.currentTarget.value)}
              class={inputClass}
              placeholder="可选"
            />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} class={cancelBtnClass}>
              取消
            </button>
            <button type="submit" disabled={submitting()} class={primaryBtnClass}>
              {submitting() ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
