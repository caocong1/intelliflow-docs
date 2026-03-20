import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import PDFDocument from "pdfkit";
import { db } from "../../db";
import { nodeExecutions } from "../../db/schema";
import { getExportPath, insertDocumentFile } from "../files/files.service";

// ─── Content resolution ──────────────────────────────────────────────────────

/**
 * Resolve export content from upstream node outputs.
 * Looks at the node execution's inputData or the previous node's outputData.
 */
async function resolveContent(
  documentId: string,
  nodeExecutionId: string,
): Promise<string> {
  // Get all executions for this document to find upstream content
  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId));

  const currentExec = executions.find((e) => e.id === nodeExecutionId);
  if (!currentExec) throw new Error("Node execution not found");

  // Check if inputData has content already set
  const inputData = currentExec.inputData as Record<string, unknown> | null;
  if (inputData?.content && typeof inputData.content === "string") {
    return inputData.content;
  }

  // Collect content from completed upstream nodes (prefer model_call or restore outputs)
  const completed = executions
    .filter((e) => e.status === "completed" && e.stepOrder < currentExec.stepOrder)
    .sort((a, b) => b.stepOrder - a.stepOrder);

  for (const exec of completed) {
    const output = exec.outputData as Record<string, unknown> | null;
    if (!output) continue;

    // Check for selectedContent (from model_call with selection)
    if (output.selectedContent && typeof output.selectedContent === "string") {
      return output.selectedContent;
    }

    // Check for restoredContent (from restore node)
    if (output.restoredContent && typeof output.restoredContent === "string") {
      return output.restoredContent;
    }

    // Check for content field
    if (output.content && typeof output.content === "string") {
      return output.content;
    }

    // Check model outputs array (model_call node)
    if (Array.isArray(output.modelOutputs)) {
      const selected = output.selectedOutputKey as string | undefined;
      const modelOutputs = output.modelOutputs as Array<{
        modelId: string;
        content: string;
        status: string;
      }>;

      if (selected) {
        const match = modelOutputs.find((m) => m.modelId === selected);
        if (match?.content) return match.content;
      }

      // Fallback to first completed model output
      const first = modelOutputs.find((m) => m.status === "completed" && m.content);
      if (first?.content) return first.content;
    }
  }

  return "No content available for export.";
}

// ─── Format generators ───────────────────────────────────────────────────────

function parseMarkdownToParagraphs(content: string): Paragraph[] {
  const lines = content.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    // Headings
    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: h1Match[1], bold: true, size: 32 })],
          heading: HeadingLevel.HEADING_1,
        }),
      );
    } else if (h2Match) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: h2Match[1], bold: true, size: 28 })],
          heading: HeadingLevel.HEADING_2,
        }),
      );
    } else if (h3Match) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: h3Match[1], bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_3,
        }),
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      // Bullet list
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(2) })],
          bullet: { level: 0 },
        }),
      );
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ children: [] }));
    } else {
      // Parse inline bold/italic
      const runs = parseInlineFormatting(line);
      paragraphs.push(new Paragraph({ children: runs }));
    }
  }

  return paragraphs;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Simple regex for **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match: RegExpExecArray | null;

  while (true) {
    match = regex.exec(text);
    if (!match) break;
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], italics: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4] }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }

  return runs;
}

async function generateWordBuffer(content: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: parseMarkdownToParagraphs(content),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

async function generatePdfBuffer(content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lines = content.split("\n");

    for (const line of lines) {
      const h1Match = line.match(/^# (.+)/);
      const h2Match = line.match(/^## (.+)/);
      const h3Match = line.match(/^### (.+)/);

      if (h1Match) {
        doc.fontSize(22).font("Helvetica-Bold").text(h1Match[1], { align: "left" });
        doc.moveDown(0.5);
      } else if (h2Match) {
        doc.fontSize(18).font("Helvetica-Bold").text(h2Match[1], { align: "left" });
        doc.moveDown(0.3);
      } else if (h3Match) {
        doc.fontSize(14).font("Helvetica-Bold").text(h3Match[1], { align: "left" });
        doc.moveDown(0.2);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        doc.fontSize(12).font("Helvetica").text(`  \u2022 ${line.slice(2)}`, { align: "left" });
      } else if (line.trim() === "") {
        doc.moveDown(0.5);
      } else {
        // Strip markdown bold/italic for PDF (simple approach)
        const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc.fontSize(12).font("Helvetica").text(clean, { align: "left" });
      }
    }

    doc.end();
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateExport(
  documentId: string,
  nodeExecutionId: string,
  format: "word" | "pdf" | "markdown",
  filename: string,
  userId: string,
): Promise<{ filename: string; storagePath: string; fileSize: number; format: string }> {
  // Resolve content from upstream nodes
  const content = await resolveContent(documentId, nodeExecutionId);

  // Generate file buffer
  let buffer: Buffer;
  let mimeType: string;

  switch (format) {
    case "word": {
      buffer = await generateWordBuffer(content);
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      break;
    }
    case "pdf": {
      buffer = await generatePdfBuffer(content);
      mimeType = "application/pdf";
      break;
    }
    case "markdown": {
      buffer = Buffer.from(content, "utf-8");
      mimeType = "text/markdown";
      break;
    }
  }

  // Ensure export directory exists
  const exportDir = getExportPath(documentId);
  await mkdir(exportDir, { recursive: true });

  // Save file
  const storagePath = join(exportDir, filename);
  await writeFile(storagePath, buffer);

  const fileSize = buffer.length;

  // Index in DB
  await insertDocumentFile({
    documentId,
    category: "export",
    originalName: filename,
    storagePath,
    mimeType,
    fileSize,
    createdBy: userId,
  });

  // Update node execution outputData
  const now = new Date();
  await db
    .update(nodeExecutions)
    .set({
      outputData: { format, filename, storagePath, fileSize },
      updatedAt: now,
    })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return { filename, storagePath, fileSize, format };
}

export async function getExportPreview(
  documentId: string,
  nodeExecutionId: string,
): Promise<{ content: string; defaultFilename: string }> {
  const content = await resolveContent(documentId, nodeExecutionId);

  // Generate default filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultFilename = `document_${dateStr}`;

  return { content, defaultFilename };
}

export async function downloadExport(
  documentId: string,
  nodeExecutionId: string,
): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
  // Get the node execution to find file info
  const [exec] = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) return null;

  const output = exec.outputData as Record<string, unknown> | null;
  if (!output?.storagePath || !output?.filename) return null;

  const storagePath = output.storagePath as string;
  const filename = output.filename as string;
  const format = output.format as string;

  try {
    const buffer = await readFile(storagePath);

    let mimeType = "application/octet-stream";
    if (format === "word") {
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (format === "pdf") {
      mimeType = "application/pdf";
    } else if (format === "markdown") {
      mimeType = "text/markdown";
    }

    return { buffer, filename, mimeType };
  } catch {
    return null;
  }
}
