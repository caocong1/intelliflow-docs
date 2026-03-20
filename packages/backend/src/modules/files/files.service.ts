import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "./data/workspaces";

export async function createDocumentWorkspace(documentId: string): Promise<void> {
  await mkdir(join(WORKSPACE_ROOT, "uploads", documentId), { recursive: true });
  await mkdir(join(WORKSPACE_ROOT, "exports", documentId), { recursive: true });
  await mkdir(join(WORKSPACE_ROOT, ".mappings", documentId), { recursive: true });
}

export function getUploadPath(documentId: string): string {
  return join(WORKSPACE_ROOT, "uploads", documentId);
}

export function getExportPath(documentId: string): string {
  return join(WORKSPACE_ROOT, "exports", documentId);
}
