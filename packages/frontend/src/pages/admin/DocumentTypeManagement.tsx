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
        showToast("Failed to load document types", "error");
        return;
      }
      const result = data as unknown as { data: DocumentType[]; total: number };
      setDocTypes(result.data);
      setTotal(result.total);
    } catch {
      showToast("Network error loading document types", "error");
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
      errors.name = "Name is required (max 100 characters)";
    }
    if (!createCode().trim() || !/^[a-zA-Z0-9_-]+$/.test(createCode())) {
      errors.code = "Code is required (alphanumeric, hyphens, underscores only)";
    }
    if (createDescription().length > 500) {
      errors.description = "Description must be 500 characters or less";
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
        showToast(errData?.error ?? "Failed to create document type", "error");
        return;
      }
      showToast("Document type created", "success");
      setShowCreateModal(false);
      resetCreateForm();
      await fetchDocTypes();
    } catch {
      showToast("Network error", "error");
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
        showToast(errData?.error ?? "Failed to update document type", "error");
        return;
      }
      showToast("Document type updated", "success");
      setEditingDocType(null);
      await fetchDocTypes();
    } catch {
      showToast("Network error", "error");
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
        showToast(errData?.error ?? "Failed to toggle status", "error");
        return;
      }
      showToast(
        action.docType.isActive ? "Document type disabled" : "Document type enabled",
        "success",
      );
      setConfirmAction(null);
      await fetchDocTypes();
    } catch {
      showToast("Network error", "error");
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
        const msg = errData?.error ?? "Failed to delete document type";
        showToast(
          msg.includes("associated")
            ? "Cannot delete: document type has associated documents"
            : msg,
          "error",
        );
        return;
      }
      showToast("Document type deleted", "success");
      setConfirmAction(null);
      await fetchDocTypes();
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

  const columns: Column<DocumentType>[] = [
    { key: "name", header: "Name", render: (dt) => <span class="font-medium">{dt.name}</span> },
    {
      key: "code",
      header: "Code",
      render: (dt) => <code class="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{dt.code}</code>,
    },
    {
      key: "description",
      header: "Description",
      render: (dt) => (
        <span class="text-gray-500 truncate max-w-xs inline-block">{dt.description ?? "-"}</span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (dt) => (
        <Badge
          label={dt.isActive ? "Active" : "Disabled"}
          variant={dt.isActive ? "success" : "error"}
        />
      ),
    },
    { key: "createdAt", header: "Created", render: (dt) => <>{formatDate(dt.createdAt)}</> },
    {
      key: "actions",
      header: "Actions",
      render: (dt) => (
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openEditModal(dt)}
            class="text-sm text-blue-600 hover:text-blue-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ docType: dt, action: "toggle" })}
            class={`text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 ${
              dt.isActive
                ? "text-red-600 hover:text-red-800"
                : "text-green-600 hover:text-green-800"
            }`}
          >
            {dt.isActive ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction({ docType: dt, action: "delete" })}
            class="text-sm text-red-600 hover:text-red-800 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Document Type Management</h1>
        <div class="flex items-center gap-4">
          <div class="w-64">
            <SearchInput
              value={search()}
              onChange={handleSearchChange}
              placeholder="Search by name or code..."
            />
          </div>
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Document Type
          </button>
        </div>
      </div>

      <Table
        columns={columns}
        data={docTypes()}
        loading={loading()}
        emptyMessage="No document types found"
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
        title="Create Document Type"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          class="space-y-4"
        >
          <div>
            <label for="create-name" class="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="create-name"
              type="text"
              value={createName()}
              onInput={(e) => setCreateName(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {createErrors().name && <p class="mt-1 text-xs text-red-600">{createErrors().name}</p>}
          </div>
          <div>
            <label for="create-code" class="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <input
              id="create-code"
              type="text"
              value={createCode()}
              onInput={(e) => setCreateCode(e.currentTarget.value)}
              placeholder="e.g. meeting-notes"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {createErrors().code && <p class="mt-1 text-xs text-red-600">{createErrors().code}</p>}
          </div>
          <div>
            <label for="create-description" class="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="create-description"
              value={createDescription()}
              onInput={(e) => setCreateDescription(e.currentTarget.value)}
              rows={3}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            {createErrors().description && (
              <p class="mt-1 text-xs text-red-600">{createErrors().description}</p>
            )}
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
      <Modal
        isOpen={!!editingDocType()}
        onClose={() => setEditingDocType(null)}
        title="Edit Document Type"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEdit();
          }}
          class="space-y-4"
        >
          <div>
            <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName()}
              onInput={(e) => setEditName(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label for="edit-code" class="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <input
              id="edit-code"
              type="text"
              value={editCode()}
              onInput={(e) => setEditCode(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label for="edit-description" class="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="edit-description"
              value={editDescription()}
              onInput={(e) => setEditDescription(e.currentTarget.value)}
              rows={3}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingDocType(null)}
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

      {/* Confirm Action Dialog */}
      <Modal
        isOpen={!!confirmAction()}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction()?.action === "delete"
            ? "Confirm Delete"
            : confirmAction()?.docType.isActive
              ? "Confirm Disable"
              : "Confirm Enable"
        }
      >
        <div class="space-y-4">
          <p class="text-sm text-gray-600">
            {confirmAction()?.action === "delete"
              ? `Are you sure you want to delete "${confirmAction()?.docType.name}"? This action cannot be undone.`
              : confirmAction()?.docType.isActive
                ? `Are you sure you want to disable "${confirmAction()?.docType.name}"?`
                : `Are you sure you want to enable "${confirmAction()?.docType.name}"?`}
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
              onClick={() => {
                if (confirmAction()?.action === "delete") handleDelete();
                else handleToggleStatus();
              }}
              disabled={submitting()}
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {submitting()
                ? "Processing..."
                : confirmAction()?.action === "delete"
                  ? "Delete"
                  : confirmAction()?.docType.isActive
                    ? "Disable"
                    : "Enable"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
