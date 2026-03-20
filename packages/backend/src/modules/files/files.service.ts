import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { documentFiles } from "../../db/schema";

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

export async function insertDocumentFile(params: {
  documentId: string;
  category: string;
  originalName: string;
  storagePath: string;
  mimeType?: string;
  fileSize?: number;
  createdBy: string;
}) {
  const [record] = await db
    .insert(documentFiles)
    .values({
      documentId: params.documentId,
      category: params.category,
      originalName: params.originalName,
      storagePath: params.storagePath,
      mimeType: params.mimeType ?? null,
      fileSize: params.fileSize ?? null,
      createdBy: params.createdBy,
    })
    .returning();
  return record;
}

export async function listDocumentFiles(documentId: string) {
  return db
    .select()
    .from(documentFiles)
    .where(eq(documentFiles.documentId, documentId))
    .orderBy(desc(documentFiles.createdAt));
}
