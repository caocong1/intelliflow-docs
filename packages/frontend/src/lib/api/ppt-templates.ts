export type PptTemplateType = "code_theme" | "native_pptx";

export type PptTemplate = {
  id: string;
  name: string;
  description: string | null;
  type: PptTemplateType;
  aspectRatio: string;
  themeConfig: unknown | null;
  templateFilePath: string | null;
  availableLayouts: string[] | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PptTemplatePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PptTemplateListResponse = {
  data: PptTemplate[];
  pagination: PptTemplatePagination;
};

export type PptTemplateUploadResponse = {
  template: PptTemplate;
  validation: {
    layouts: Record<string, string[]>;
    allPlaceholders: string[];
    warnings: string[];
  };
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/ppt-templates${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `API error: ${res.status}`), {
      status: res.status,
      body,
    });
  }
  return res.json();
}

export function listTemplates(
  page = 1,
  limit = 20,
  type?: PptTemplateType,
  options?: { includeInactive?: boolean },
): Promise<PptTemplateListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set("type", type);
  if (options?.includeInactive) params.set("includeInactive", "true");
  return apiFetch(`?${params}`);
}

export function getTemplate(id: string): Promise<PptTemplate> {
  return apiFetch(`/${id}`);
}

export function createTheme(body: {
  name: string;
  description?: string;
  aspectRatio?: string;
  themeConfig: unknown;
}): Promise<PptTemplate> {
  return apiFetch("/create-theme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateTemplate(
  id: string,
  body: {
    name?: string;
    description?: string;
    aspectRatio?: string;
    themeConfig?: unknown;
    isActive?: boolean;
  },
): Promise<PptTemplate> {
  return apiFetch(`/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteTemplate(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/${id}`, { method: "DELETE" });
}

export async function uploadTemplate(
  file: File,
  name: string,
  description?: string,
): Promise<PptTemplateUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  if (description) form.append("description", description);
  return apiFetch("/upload", { method: "POST", body: form });
}

export function setDefaultTemplate(id: string): Promise<PptTemplate> {
  return apiFetch(`/${id}/set-default`, { method: "POST" });
}
