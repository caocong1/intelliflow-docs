export type PptAgentJobStatus = "queued" | "running" | "completed" | "failed";

export type PptGenerationMode =
  | "auto_dynamic"
  | "template_locked"
  | "template_stylized"
  | "svg_native";

export type PptAgentJob = {
  id: string;
  userId: string;
  prompt: string;
  status: PptAgentJobStatus;
  progress: number | null;
  stage: string | null;
  errorMessage: string | null;
  resultFilename: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type CreatePptAgentJobInput = {
  prompt: string;
  slideCount: number;
  style: string;
  generationMode?: PptGenerationMode;
  styleProfile?: string;
  textModel?: string;
  imageModel?: string;
  imageEnabled?: boolean;
};

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJsonError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `请求失败：${res.status}`;
  } catch {
    return `请求失败：${res.status}`;
  }
}

export async function createPptAgentJob(input: CreatePptAgentJobInput): Promise<PptAgentJob> {
  const res = await fetch("/api/ppt-agent/jobs", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
  return res.json();
}

export async function listPptAgentJobs(): Promise<PptAgentJob[]> {
  const res = await fetch("/api/ppt-agent/jobs", {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
  const data = (await res.json()) as { jobs: PptAgentJob[] };
  return data.jobs;
}

export async function getPptAgentJob(id: string): Promise<PptAgentJob> {
  const res = await fetch(`/api/ppt-agent/jobs/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
  return res.json();
}

export async function downloadPptAgentJob(id: string): Promise<Response> {
  const res = await fetch(`/api/ppt-agent/jobs/${encodeURIComponent(id)}/download`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
  return res;
}

export async function deletePptAgentJob(id: string): Promise<void> {
  const res = await fetch(`/api/ppt-agent/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseJsonError(res));
}
