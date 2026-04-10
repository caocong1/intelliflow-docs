import { createSignal, onMount } from "solid-js";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import Table, { type Column } from "../../components/ui/Table";
import { showToast } from "../../components/ui/Toast";

type User = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormErrors = {
  username?: string;
  password?: string;
  displayName?: string;
};

export default function UserManagement() {
  const [users, setUsers] = createSignal<User[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [loading, setLoading] = createSignal(true);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [editingUser, setEditingUser] = createSignal<User | null>(null);
  const [confirmAction, setConfirmAction] = createSignal<{
    user: User;
    action: "toggle";
  } | null>(null);
  const [resetPwUser, setResetPwUser] = createSignal<User | null>(null);
  const [resetPwValue, setResetPwValue] = createSignal("");
  const [resetPwError, setResetPwError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  // Create form
  const [createUsername, setCreateUsername] = createSignal("");
  const [createPassword, setCreatePassword] = createSignal("");
  const [createDisplayName, setCreateDisplayName] = createSignal("");
  const [createRole, setCreateRole] = createSignal<"admin" | "user">("user");
  const [createErrors, setCreateErrors] = createSignal<FormErrors>({});

  // Edit form
  const [editDisplayName, setEditDisplayName] = createSignal("");
  const [editRole, setEditRole] = createSignal<"admin" | "user">("user");

  const pageSize = 20;

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data, error } = await api.api.users.get({
        query: { page: String(page()), pageSize: String(pageSize) },
      });
      if (error) {
        showToast("加载用户列表失败", "error");
        return;
      }
      const result = data as unknown as { data: User[]; total: number };
      setUsers(result.data);
      setTotal(result.total);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchUsers);

  function validateCreateForm(): boolean {
    const errors: FormErrors = {};
    if (createUsername().length < 3 || createUsername().length > 50) {
      errors.username = "用户名长度需在 3-50 个字符之间";
    }
    if (createPassword().length < 6) {
      errors.password = "密码长度至少 6 个字符";
    }
    if (!createDisplayName().trim()) {
      errors.displayName = "显示名称不能为空";
    }
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreate() {
    if (!validateCreateForm()) return;
    setSubmitting(true);
    try {
      const { error } = await api.api.users.post({
        username: createUsername(),
        password: createPassword(),
        displayName: createDisplayName(),
        role: createRole(),
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "创建用户失败", "error");
        return;
      }
      showToast("用户创建成功", "success");
      setShowCreateModal(false);
      resetCreateForm();
      await fetchUsers();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setCreateUsername("");
    setCreatePassword("");
    setCreateDisplayName("");
    setCreateRole("user");
    setCreateErrors({});
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role);
  }

  async function handleEdit() {
    const user = editingUser();
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await api.api.users({ id: user.id }).patch({
        displayName: editDisplayName(),
        role: editRole(),
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "更新用户失败", "error");
        return;
      }
      showToast("用户更新成功", "success");
      setEditingUser(null);
      await fetchUsers();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus() {
    const action = confirmAction();
    if (!action) return;
    setSubmitting(true);
    try {
      const { error } = await api.api.users({ id: action.user.id }).status.patch();
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "操作失败", "error");
        return;
      }
      showToast(action.user.isActive ? "用户已停用" : "用户已启用", "success");
      setConfirmAction(null);
      await fetchUsers();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    const user = resetPwUser();
    if (!user) return;
    if (resetPwValue().length < 6) {
      setResetPwError("密码长度至少 6 个字符");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await api.api.users({ id: user.id }).password.patch({
        password: resetPwValue(),
      });
      if (error) {
        const errData = error.value as { error?: string } | undefined;
        showToast(errData?.error ?? "重置密码失败", "error");
        return;
      }
      showToast("密码已重置", "success");
      setResetPwUser(null);
      setResetPwValue("");
      setResetPwError("");
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

  const columns: Column<User>[] = [
    {
      key: "username",
      header: "用户名",
      render: (u) => <span class="font-medium text-slate-900">{u.username}</span>,
    },
    { key: "displayName", header: "显示名称", render: (u) => <>{u.displayName}</> },
    {
      key: "role",
      header: "角色",
      render: (u) => (
        <Badge
          label={u.role === "admin" ? "管理员" : "普通用户"}
          variant={u.role === "admin" ? "info" : "success"}
        />
      ),
    },
    {
      key: "isActive",
      header: "状态",
      render: (u) => (
        <Badge
          label={u.isActive ? "正常" : "已停用"}
          variant={u.isActive ? "success" : "error"}
        />
      ),
    },
    { key: "createdAt", header: "创建时间", render: (u) => <>{formatDate(u.createdAt)}</> },
    {
      key: "actions",
      header: "操作",
      render: (u) => (
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditModal(u)}
            class="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => {
              setResetPwUser(u);
              setResetPwValue("");
              setResetPwError("");
            }}
            class="text-sm text-amber-600 hover:text-amber-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
          >
            重置密码
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ user: u, action: "toggle" })}
            class={`text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 ${
              u.isActive ? "text-red-600 hover:text-red-800" : "text-emerald-600 hover:text-emerald-800"
            }`}
          >
            {u.isActive ? "停用" : "启用"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-indigo-950">用户管理</h1>
          <p class="text-sm text-slate-400 mt-0.5">管理平台账户与权限</p>
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
          新建用户
        </button>
      </div>

      <Table columns={columns} data={users()} loading={loading()} emptyMessage="暂无用户数据" />

      <Pagination
        page={page()}
        pageSize={pageSize}
        total={total()}
        onPageChange={(p) => {
          setPage(p);
          fetchUsers();
        }}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
        title="新建用户"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="create-username" class={labelClass}>
              用户名
            </label>
            <input
              id="create-username"
              type="text"
              value={createUsername()}
              onInput={(e) => setCreateUsername(e.currentTarget.value)}
              class={inputClass}
              placeholder="3-50 个字符"
              required
            />
            {createErrors().username && (
              <p class="mt-1 text-xs text-red-600">{createErrors().username}</p>
            )}
          </div>
          <div>
            <label for="create-password" class={labelClass}>
              密码
            </label>
            <input
              id="create-password"
              type="password"
              value={createPassword()}
              onInput={(e) => setCreatePassword(e.currentTarget.value)}
              class={inputClass}
              placeholder="至少 6 个字符"
              required
            />
            {createErrors().password && (
              <p class="mt-1 text-xs text-red-600">{createErrors().password}</p>
            )}
          </div>
          <div>
            <label for="create-displayname" class={labelClass}>
              显示名称
            </label>
            <input
              id="create-displayname"
              type="text"
              value={createDisplayName()}
              onInput={(e) => setCreateDisplayName(e.currentTarget.value)}
              class={inputClass}
              required
            />
            {createErrors().displayName && (
              <p class="mt-1 text-xs text-red-600">{createErrors().displayName}</p>
            )}
          </div>
          <div>
            <label for="create-role" class={labelClass}>
              角色
            </label>
            <select
              id="create-role"
              value={createRole()}
              onChange={(e) => setCreateRole(e.currentTarget.value as "admin" | "user")}
              class={inputClass}
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
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
      <Modal isOpen={!!editingUser()} onClose={() => setEditingUser(null)} title="编辑用户">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEdit();
          }}
          class="space-y-4"
        >
          <div>
            <label for="edit-displayname" class={labelClass}>
              显示名称
            </label>
            <input
              id="edit-displayname"
              type="text"
              value={editDisplayName()}
              onInput={(e) => setEditDisplayName(e.currentTarget.value)}
              class={inputClass}
              required
            />
          </div>
          <div>
            <label for="edit-role" class={labelClass}>
              角色
            </label>
            <select
              id="edit-role"
              value={editRole()}
              onChange={(e) => setEditRole(e.currentTarget.value as "admin" | "user")}
              class={inputClass}
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
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

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPwUser()}
        onClose={() => setResetPwUser(null)}
        title={`重置密码 — ${resetPwUser()?.displayName ?? ""}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleResetPassword();
          }}
          class="space-y-4"
        >
          <div>
            <label for="reset-password" class={labelClass}>
              新密码
            </label>
            <input
              id="reset-password"
              type="password"
              value={resetPwValue()}
              onInput={(e) => {
                setResetPwValue(e.currentTarget.value);
                setResetPwError("");
              }}
              class={inputClass}
              placeholder="至少 6 个字符"
              required
            />
            {resetPwError() && (
              <p class="mt-1 text-xs text-red-600">{resetPwError()}</p>
            )}
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResetPwUser(null)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting()}
              class={primaryBtnClass}
            >
              {submitting() ? "重置中..." : "确认重置"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Toggle Status Dialog */}
      <Modal
        isOpen={!!confirmAction()}
        onClose={() => setConfirmAction(null)}
        title={confirmAction()?.user.isActive ? "确认停用用户" : "确认启用用户"}
      >
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            {confirmAction()?.user.isActive
              ? `确定要停用用户「${confirmAction()?.user.displayName}」吗？停用后该用户将立即无法登录。`
              : `确定要启用用户「${confirmAction()?.user.displayName}」吗？`}
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
              onClick={handleToggleStatus}
              disabled={submitting()}
              class={`px-4 py-2 text-sm text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                confirmAction()?.user.isActive
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
              }`}
            >
              {submitting()
                ? "处理中..."
                : confirmAction()?.user.isActive
                  ? "确认停用"
                  : "确认启用"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
