import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { documents, nodeExecutions, workflows } from "../../db/schema";
import { getUploadPath, insertDocumentFile } from "../files/files.service";
import type { FormFieldDef, WorkflowNodeDef } from "@intelliflow/shared";
import { AppError } from "../../common/errors";

// ─── File parsing ────────────────────────────────────────────────────────────

/**
 * Extract text content from an uploaded file based on its MIME type.
 * v1 supports: plain text, PDF (pdf-parse), DOCX (mammoth).
 * Images and audio/video return placeholder strings.
 */
export async function parseUploadedFile(filePath: string, mimeType: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  // Plain text / markdown
  if (ext === ".txt" || ext === ".md" || mimeType === "text/plain" || mimeType === "text/markdown") {
    const buf = await readFile(filePath, "utf-8");
    return buf;
  }

  // PDF
  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const dataBuffer = await readFile(filePath);
      const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    } catch {
      return `[PDF解析失败: ${filePath}]`;
    }
  }

  // DOCX
  if (
    ext === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch {
      return `[Word文档解析失败: ${filePath}]`;
    }
  }

  // Images — OCR deferred
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || mimeType.startsWith("image/")) {
    const filename = filePath.split("/").pop() ?? filePath;
    return `[图片文件: ${filename}]`;
  }

  // Audio / Video — transcription deferred
  if (
    ext === ".mp3" ||
    ext === ".mp4" ||
    ext === ".wav" ||
    ext === ".webm" ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/")
  ) {
    const filename = filePath.split("/").pop() ?? filePath;
    return `[音视频文件: ${filename}]`;
  }

  // Unknown type — read as text fallback
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    const filename = filePath.split("/").pop() ?? filePath;
    return `[不支持的文件类型: ${filename}]`;
  }
}

// ─── File upload handler ─────────────────────────────────────────────────────

export interface UploadResult {
  fileId: string;
  originalName: string;
  parsedText: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Handle a single file upload for input transform node:
 * 1. Save file to disk under the node execution directory
 * 2. Index in DB via insertDocumentFile
 * 3. Parse text content
 * 4. Return file metadata + parsed text
 */
export async function handleFileUpload(
  documentId: string,
  nodeExecutionId: string,
  file: File,
  userId: string,
): Promise<UploadResult> {
  // Create upload directory for this node execution
  const uploadDir = join(getUploadPath(documentId), nodeExecutionId);
  await mkdir(uploadDir, { recursive: true });

  // Write file to disk
  const filePath = join(uploadDir, file.name);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  // Index in DB
  const record = await insertDocumentFile({
    documentId,
    category: "upload",
    originalName: file.name,
    storagePath: filePath,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    createdBy: userId,
  });

  // Parse text content
  const parsedText = await parseUploadedFile(filePath, file.type || "application/octet-stream");

  return {
    fileId: record.id,
    originalName: file.name,
    parsedText,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

// ─── Field validation ────────────────────────────────────────────────────────

/**
 * Validate a field value against its type definition.
 * Returns an error message string or null if valid.
 */
function validateFieldValue(field: FormFieldDef, value: string | undefined): string | null {
  const v = value ?? "";

  if (field.required && (!v || v.trim() === "")) {
    return `${field.label}: 字段必填`;
  }

  // Skip further validation if value is empty and not required
  if (!v) return null;

  switch (field.type) {
    case "number":
      if (Number.isNaN(Number(v))) return `${field.label}: 数字格式不合法`;
      break;
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${field.label}: 日期格式不合法`;
      break;
    case "datetime":
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v))
        return `${field.label}: 日期时间格式不合法`;
      break;
    case "select":
      if (field.options && !field.options.includes(v)) return `${field.label}: 选项值不合法`;
      break;
    case "multiselect": {
      if (field.options) {
        const values = v.split(",").map((s) => s.trim());
        for (const sv of values) {
          if (!field.options.includes(sv)) return `${field.label}: 选项值不合法 (${sv})`;
        }
      }
      break;
    }
  }

  return null;
}

// ─── Confirm input transform ─────────────────────────────────────────────────

export interface ConfirmInputTransformParams {
  documentId: string;
  nodeExecutionId: string;
  formData: Record<string, string>;
  fileOutputs: Array<{ fileId: string; name: string; parsedText: string }>;
  userId: string;
}

/**
 * Confirm the input transform node:
 * 1. Merge form fields + file parsed texts into outputData
 * 2. Write combined text to step directory output.txt
 * 3. Update nodeExecution with inputData and outputData
 */
export async function confirmInputTransform(params: ConfirmInputTransformParams) {
  const { documentId, nodeExecutionId, formData, fileOutputs, userId } = params;

  // Load workflow node config to access formFields with machineKey
  const [nodeExec] = await db
    .select({ nodeId: nodeExecutions.nodeId })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  let formFields: FormFieldDef[] = [];
  if (nodeExec) {
    const [doc] = await db
      .select({ nodes: workflows.nodes })
      .from(documents)
      .innerJoin(workflows, eq(documents.workflowId, workflows.id))
      .where(eq(documents.id, documentId))
      .limit(1);

    if (doc) {
      const wfNodes = doc.nodes as WorkflowNodeDef[];
      const nodeDef = wfNodes.find((n) => n.id === nodeExec.nodeId);
      const cfg = nodeDef?.config;
      formFields = cfg && "formFields" in cfg ? (cfg as { formFields: FormFieldDef[] }).formFields : [];
    }
  }

  // Validate field values against their type definitions
  const errors: string[] = [];
  for (const field of formFields) {
    if (field.type === "file") continue; // files validated separately
    const err = validateFieldValue(field, formData[field.id]);
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    throw new AppError(`表单验证失败: ${errors.join("; ")}`, 400);
  }

  // Build fieldsByKey dual-view map (machineKey -> value)
  const fieldsByKey: Record<string, string> = {};
  for (const field of formFields) {
    if (field.machineKey && formData[field.id] !== undefined) {
      fieldsByKey[field.machineKey] = formData[field.id];
    }
  }

  // Build combined text for downstream nodes (must be computed before outputData)
  const textParts: string[] = [];
  for (const [key, value] of Object.entries(formData)) {
    if (value) textParts.push(`[${key}]\n${value}`);
  }
  for (const file of fileOutputs) {
    if (file.parsedText) textParts.push(`[${file.name}]\n${file.parsedText}`);
  }
  const combinedText = textParts.join("\n\n---\n\n");

  // Build output data structure
  const outputData = {
    fields: formData,
    fieldsByKey,
    files: fileOutputs.map((f) => ({
      fileId: f.fileId,
      name: f.name,
      parsedText: f.parsedText,
    })),
    text: combinedText,
    confirmedAt: new Date().toISOString(),
  };

  // Write combined output to step directory
  const outputDir = join(getUploadPath(documentId), nodeExecutionId);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "output.txt"), combinedText, "utf-8");

  // Update node execution record
  const now = new Date();
  const inputData = { formData, fileIds: fileOutputs.map((f) => f.fileId) };

  const [updated] = await db
    .update(nodeExecutions)
    .set({
      inputData,
      outputData,
      updatedAt: now,
    })
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .returning();

  return updated;
}
