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
        showToast("Failed to load users", "error");
        return;
      }
      const result = data as unknown as { data: User[]; total: number };
      setUsers(result.data);
      setTotal(result.total);
    } catch {
      showToast("Network error loading users", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchUsers);

  function validateCreateForm(): boolean {
    const errors: FormErrors = {};
    if (createUsername().length < 3 || createUsername().length > 50) {
      errors.username = "Username must be 3-50 characters";
    }
    if (createPassword().length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    if (!createDisplayName().trim()) {
      errors.displayName = "Display name is required";
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
        showToast(errData?.error ?? "Failed to create user", "error");
        return;
      }
      showToast("User created", "success");
      setShowCreateModal(false);
      resetCreateForm();
      await fetchUsers();
    } catch {
      showToast("Network error", "error");
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
        showToast(errData?.error ?? "Failed to update user", "error");
        return;
      }
      showToast("User updated", "success");
      setEditingUser(null);
      await fetchUsers();
    } catch {
      showToast("Network error", "error");
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
        showToast(errData?.error ?? "Failed to toggle user status", "error");
        return;
      }
      showToast(action.user.isActive ? "User disabled" : "User enabled", "success");
      setConfirmAction(null);
      await fetchUsers();
    } catch {
      showToast("Network error", "error");
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

  const columns: Column<User>[] = [
    {
      key: "username",
      header: "Username",
      render: (u) => <span class="font-medium">{u.username}</span>,
    },
    { key: "displayName", header: "Display Name", render: (u) => <>{u.displayName}</> },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge
          label={u.role === "admin" ? "Admin" : "User"}
          variant={u.role === "admin" ? "info" : "success"}
        />
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (u) => (
        <Badge
          label={u.isActive ? "Active" : "Disabled"}
          variant={u.isActive ? "success" : "error"}
        />
      ),
    },
    { key: "createdAt", header: "Created", render: (u) => <>{formatDate(u.createdAt)}</> },
    {
      key: "actions",
      header: "Actions",
      render: (u) => (
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEditModal(u)}
            class="text-sm text-blue-600 hover:text-blue-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ user: u, action: "toggle" })}
            class={`text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 ${
              u.isActive ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"
            }`}
          >
            {u.isActive ? "Disable" : "Enable"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          type="button"
          onClick={() => {
            resetCreateForm();
            setShowCreateModal(true);
          }}
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create User
        </button>
      </div>

      <Table columns={columns} data={users()} loading={loading()} emptyMessage="No users found" />

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
        title="Create User"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="create-username" class="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="create-username"
              type="text"
              value={createUsername()}
              onInput={(e) => setCreateUsername(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {createErrors().username && (
              <p class="mt-1 text-xs text-red-600">{createErrors().username}</p>
            )}
          </div>
          <div>
            <label for="create-password" class="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="create-password"
              type="password"
              value={createPassword()}
              onInput={(e) => setCreatePassword(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {createErrors().password && (
              <p class="mt-1 text-xs text-red-600">{createErrors().password}</p>
            )}
          </div>
          <div>
            <label for="create-displayname" class="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              id="create-displayname"
              type="text"
              value={createDisplayName()}
              onInput={(e) => setCreateDisplayName(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {createErrors().displayName && (
              <p class="mt-1 text-xs text-red-600">{createErrors().displayName}</p>
            )}
          </div>
          <div>
            <label for="create-role" class="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="create-role"
              value={createRole()}
              onChange={(e) => setCreateRole(e.currentTarget.value as "admin" | "user")}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting()}
              class="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {submitting() ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingUser()} onClose={() => setEditingUser(null)} title="Edit User">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEdit();
          }}
          class="space-y-4"
        >
          <div>
            <label for="edit-displayname" class="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              id="edit-displayname"
              type="text"
              value={editDisplayName()}
              onInput={(e) => setEditDisplayName(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label for="edit-role" class="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="edit-role"
              value={editRole()}
              onChange={(e) => setEditRole(e.currentTarget.value as "admin" | "user")}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting()}
              class="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {submitting() ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Toggle Status Dialog */}
      <Modal
        isOpen={!!confirmAction()}
        onClose={() => setConfirmAction(null)}
        title={confirmAction()?.user.isActive ? "Confirm Disable User" : "Confirm Enable User"}
      >
        <div class="space-y-4">
          <p class="text-sm text-gray-600">
            {confirmAction()?.user.isActive
              ? `Are you sure you want to disable user "${confirmAction()?.user.displayName}"? They will immediately lose access.`
              : `Are you sure you want to enable user "${confirmAction()?.user.displayName}"?`}
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={submitting()}
              class={`px-4 py-2 text-sm text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                confirmAction()?.user.isActive
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
              }`}
            >
              {submitting()
                ? "Processing..."
                : confirmAction()?.user.isActive
                  ? "Disable"
                  : "Enable"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
