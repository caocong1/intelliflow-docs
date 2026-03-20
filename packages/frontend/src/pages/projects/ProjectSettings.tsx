import { A, useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { useAuth } from "../../contexts/auth";
import { showToast } from "../../components/ui/Toast";

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

type MemberItem = {
  id: string;
  projectId: string;
  userId: string;
  role: "owner" | "participant";
  joinedAt: string;
  displayName: string;
  username: string;
};

export default function ProjectSettings() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = createSignal<ProjectDetail | null>(null);
  const [members, setMembers] = createSignal<MemberItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);

  // Edit form
  const [editName, setEditName] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");
  const [editDepartment, setEditDepartment] = createSignal("");

  // Invite modal
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [inviteUsername, setInviteUsername] = createSignal("");
  const [inviting, setInviting] = createSignal(false);

  // Confirm delete
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  // Recycle bin
  type DeletedDocItem = {
    id: string;
    title: string;
    creatorName: string;
    deletedAt: string | null;
  };
  const [deletedDocs, setDeletedDocs] = createSignal<DeletedDocItem[]>([]);
  const [deletedLoading, setDeletedLoading] = createSignal(false);

  async function fetchProject() {
    try {
      const { data, error } = await api.api.projects({ id: params.id }).get();
      if (error) {
        navigate(`/projects/${params.id}`, { replace: true });
        return;
      }
      const proj = data as unknown as ProjectDetail;
      // Check ownership
      if (proj.userRole !== "owner") {
        navigate(`/projects/${params.id}`, { replace: true });
        return;
      }
      setProject(proj);
      setEditName(proj.name);
      setEditDescription(proj.description ?? "");
      setEditDepartment(proj.department ?? "");
    } catch {
      showToast("网络错误", "error");
    }
  }

  async function fetchMembers() {
    try {
      const { data, error } = await api.api.projects({ id: params.id }).members.get();
      if (error) return;
      setMembers(data as unknown as MemberItem[]);
    } catch {
      // ignore
    }
  }

  async function fetchDeletedDocs() {
    setDeletedLoading(true);
    try {
      const { data, error } = await api.api.documents.deleted.get({
        query: { projectId: params.id, page: "1", pageSize: "100" },
      });
      if (error) return;
      const result = data as unknown as { data: DeletedDocItem[] };
      setDeletedDocs(result.data);
    } catch {
      // ignore
    } finally {
      setDeletedLoading(false);
    }
  }

  async function handleRestore(docId: string) {
    try {
      const { error } = await api.api.documents({ id: docId }).restore.post();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "恢复失败", "error");
        return;
      }
      showToast("文档已恢复", "success");
      fetchDeletedDocs();
    } catch {
      showToast("网络错误", "error");
    }
  }

  async function handlePermanentDelete(docId: string, title: string) {
    if (!confirm(`确定要彻底删除文档「${title}」吗？此操作不可恢复。`)) return;
    try {
      const { error } = await api.api.documents({ id: docId }).permanent.delete();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "删除失败", "error");
        return;
      }
      showToast("文档已彻底删除", "success");
      fetchDeletedDocs();
    } catch {
      showToast("网络错误", "error");
    }
  }

  async function init() {
    setLoading(true);
    await fetchProject();
    await fetchMembers();
    await fetchDeletedDocs();
    setLoading(false);
  }

  onMount(init);

  async function handleSaveInfo() {
    if (!editName().trim()) {
      showToast("项目名称不能为空", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await api.api.projects({ id: params.id }).patch({
        name: editName(),
        description: editDescription() || undefined,
        department: editDepartment() || undefined,
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "保存失败", "error");
        return;
      }
      showToast("项目信息已更新", "success");
      await fetchProject();
    } catch {
      showToast("网络错误", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite() {
    if (!inviteUsername().trim()) {
      showToast("请输入用户名", "error");
      return;
    }
    setInviting(true);
    try {
      // First find user by username - use the users list endpoint to search
      // Since we don't have a search-by-username endpoint, we pass the username
      // and let the backend handle it. For v1, the addMember API takes userId,
      // so we need to look up the user first.
      // We'll use a simple approach: call the users list and find by username.
      const { data: usersData, error: usersError } = await api.api.users.get({
        query: { page: "1", pageSize: "1000" },
      });
      if (usersError) {
        showToast("无法获取用户列表", "error");
        return;
      }
      const usersList = (usersData as unknown as { data: { id: string; username: string; displayName: string }[] }).data;
      const foundUser = usersList.find((u) => u.username === inviteUsername().trim());
      if (!foundUser) {
        showToast("未找到该用户名", "error");
        return;
      }

      const { error } = await api.api.projects({ id: params.id }).members.post({
        userId: foundUser.id,
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "邀请失败", "error");
        return;
      }
      showToast(`已邀请 ${foundUser.displayName} 加入项目`, "success");
      setShowInviteModal(false);
      setInviteUsername("");
      await fetchMembers();
    } catch {
      showToast("网络错误", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(member: MemberItem) {
    if (!confirm(`确定要移除成员「${member.displayName}」吗？`)) return;
    try {
      const { error } = await api.api
        .projects({ id: params.id })
        .members({ userId: member.userId })
        .delete();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "移除失败", "error");
        return;
      }
      showToast("已移除成员", "success");
      await fetchMembers();
    } catch {
      showToast("网络错误", "error");
    }
  }

  async function handleChangeRole(member: MemberItem) {
    const newRole = member.role === "owner" ? "participant" : "owner";
    try {
      const { error } = await api.api
        .projects({ id: params.id })
        .members({ userId: member.userId })
        .role.patch({ role: newRole });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "更改角色失败", "error");
        return;
      }
      showToast(`已将 ${member.displayName} 设为${newRole === "owner" ? "负责人" : "参与者"}`, "success");
      await fetchMembers();
    } catch {
      showToast("网络错误", "error");
    }
  }

  async function handleDeleteProject() {
    setDeleting(true);
    try {
      const { error } = await api.api.projects({ id: params.id }).delete();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "删除失败", "error");
        return;
      }
      showToast("项目已删除", "success");
      navigate("/projects", { replace: true });
    } catch {
      showToast("网络错误", "error");
    } finally {
      setDeleting(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
  const cancelBtnClass =
    "px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const primaryBtnClass =
    "px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";

  return (
    <div class="p-6">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20">
          <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={project() && !loading()}>
        {/* Breadcrumb */}
        <div class="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <A href="/projects" class="hover:text-indigo-600 cursor-pointer transition-colors">
            项目列表
          </A>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>分隔</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <A href={`/projects/${params.id}`} class="hover:text-indigo-600 cursor-pointer transition-colors">
            {project()!.name}
          </A>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>分隔</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="text-slate-700 font-medium">设置</span>
        </div>

        <h1 class="text-xl font-bold text-indigo-950 mb-6">项目设置</h1>

        {/* Section: 基本信息 */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">基本信息</h2>
          <div class="space-y-4 max-w-lg">
            <div>
              <label for="edit-name" class={labelClass}>项目名称</label>
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
              <label for="edit-description" class={labelClass}>描述</label>
              <textarea
                id="edit-description"
                value={editDescription()}
                onInput={(e) => setEditDescription(e.currentTarget.value)}
                class={`${inputClass} resize-none`}
                rows={3}
              />
            </div>
            <div>
              <label for="edit-department" class={labelClass}>所属部门</label>
              <input
                id="edit-department"
                type="text"
                value={editDepartment()}
                onInput={(e) => setEditDepartment(e.currentTarget.value)}
                class={inputClass}
              />
            </div>
            <div class="pt-2">
              <button
                type="button"
                onClick={handleSaveInfo}
                disabled={saving()}
                class={primaryBtnClass}
              >
                {saving() ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>

        {/* Section: 成员管理 */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-slate-900">成员管理</h2>
            <button
              type="button"
              onClick={() => {
                setInviteUsername("");
                setShowInviteModal(true);
              }}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>邀请</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              邀请成员
            </button>
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">显示名称</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">用户名</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">角色</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-slate-100">
                <For each={members()}>
                  {(member) => (
                    <tr class="transition-colors hover:bg-indigo-50/50">
                      <td class="px-4 py-3 text-sm text-slate-700 font-medium">{member.displayName}</td>
                      <td class="px-4 py-3 text-sm text-slate-500">{member.username}</td>
                      <td class="px-4 py-3 text-sm">
                        <Badge
                          label={member.role === "owner" ? "负责人" : "参与者"}
                          variant={member.role === "owner" ? "info" : "success"}
                        />
                      </td>
                      <td class="px-4 py-3 text-sm">
                        <Show when={member.userId !== auth.user()?.id}>
                          <div class="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleChangeRole(member)}
                              class="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors focus:outline-none"
                            >
                              {member.role === "owner" ? "设为参与者" : "设为负责人"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              class="text-sm text-red-600 hover:text-red-800 cursor-pointer transition-colors focus:outline-none"
                            >
                              移除
                            </button>
                          </div>
                        </Show>
                        <Show when={member.userId === auth.user()?.id}>
                          <span class="text-xs text-slate-400">当前用户</span>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={members().length === 0}>
                  <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-400">暂无成员</td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: 回收站 */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h2 class="text-base font-semibold text-slate-900 mb-4">回收站</h2>

          <Show when={deletedLoading()}>
            <div class="flex items-center justify-center py-8">
              <div class="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!deletedLoading()}>
            <Show when={deletedDocs().length === 0}>
              <p class="text-sm text-slate-400 text-center py-6">回收站为空</p>
            </Show>

            <Show when={deletedDocs().length > 0}>
              <div class="overflow-x-auto rounded-lg border border-slate-200">
                <table class="min-w-full divide-y divide-slate-200">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">标题</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">创建人</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">删除时间</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-slate-100">
                    <For each={deletedDocs()}>
                      {(doc) => (
                        <tr class="transition-colors hover:bg-indigo-50/50">
                          <td class="px-4 py-3 text-sm text-slate-700 font-medium">{doc.title}</td>
                          <td class="px-4 py-3 text-sm text-slate-500">{doc.creatorName}</td>
                          <td class="px-4 py-3 text-sm text-slate-400">
                            {doc.deletedAt ? new Date(doc.deletedAt).toLocaleDateString("zh-CN") : "-"}
                          </td>
                          <td class="px-4 py-3 text-sm">
                            <div class="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleRestore(doc.id)}
                                class="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors focus:outline-none"
                              >
                                恢复
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePermanentDelete(doc.id, doc.title)}
                                class="text-sm text-red-600 hover:text-red-800 cursor-pointer transition-colors focus:outline-none"
                              >
                                彻底删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </div>

        {/* Danger zone: 删除项目 */}
        <div class="border border-red-200 rounded-xl p-5">
          <h2 class="text-base font-semibold text-red-700 mb-2">危险操作</h2>
          <p class="text-sm text-slate-500 mb-4">删除项目后，项目及其所有数据将被标记为已删除。</p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            删除项目
          </button>
        </div>
      </Show>

      {/* Invite Modal */}
      <Modal isOpen={showInviteModal()} onClose={() => setShowInviteModal(false)} title="邀请成员">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleInvite();
          }}
          class="space-y-4"
        >
          <div>
            <label for="invite-username" class={labelClass}>用户名</label>
            <input
              id="invite-username"
              type="text"
              value={inviteUsername()}
              onInput={(e) => setInviteUsername(e.currentTarget.value)}
              class={inputClass}
              placeholder="请输入要邀请的用户名"
              required
            />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowInviteModal(false)} class={cancelBtnClass}>
              取消
            </button>
            <button type="submit" disabled={inviting()} class={primaryBtnClass}>
              {inviting() ? "邀请中..." : "邀请"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={showDeleteConfirm()} onClose={() => setShowDeleteConfirm(false)} title="确认删除项目">
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            确定要删除项目「{project()?.name}」吗？此操作将软删除项目及其相关数据。
          </p>
          <div class="flex justify-end gap-3">
            <button type="button" onClick={() => setShowDeleteConfirm(false)} class={cancelBtnClass}>
              取消
            </button>
            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={deleting()}
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {deleting() ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
