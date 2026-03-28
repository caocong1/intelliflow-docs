import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  ShadingType,
  WidthType,
  TableLayoutType,
  VerticalAlign,
} from "docx";
import PDFDocument from "pdfkit";
import { db } from "../../db";
import { documents, nodeExecutions, workflows } from "../../db/schema";
import { getExportPath, insertDocumentFile } from "../files/files.service";
import { resolveRef } from "./model-call.service";
import type { ExportConfig, VariableRef, WorkflowNodeDef } from "@intelliflow/shared";

// ─── Node config loader ─────────────────────────────────────────────────────

/**
 * Load ExportConfig from the workflow definition stored in the database.
 */
async function loadNodeConfig(documentId: string, nodeExecutionId: string): Promise<ExportConfig | null> {
  // Get the current execution's nodeId
  const [exec] = await db
    .select({ nodeId: nodeExecutions.nodeId })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) return null;

  // Get workflow definition via document -> workflow join
  const [doc] = await db
    .select({ nodes: workflows.nodes })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return null;

  const nodes = doc.nodes as WorkflowNodeDef[];
  const nodeDef = nodes.find((n) => n.id === exec.nodeId);
  if (!nodeDef || nodeDef.config.type !== "export") return null;

  return nodeDef.config as ExportConfig;
}

// ─── Content resolution ──────────────────────────────────────────────────────

/**
 * Resolve export content from upstream node outputs.
 * When contentMapping is provided and non-empty, resolves each ref via resolveRef()
 * and joins with double newline. Falls back to upstream-scan logic when empty.
 */
async function resolveContent(
  documentId: string,
  nodeExecutionId: string,
  contentMapping?: VariableRef[],
): Promise<string> {
  // Get all executions for this document to find upstream content
  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId));

  const currentExec = executions.find((e) => e.id === nodeExecutionId);
  if (!currentExec) throw new Error("Node execution not found");

  // ContentMapping priority path: resolve each ref via resolveRef() and join
  if (contentMapping && contentMapping.length > 0) {
    const nodeExecMap = executions.map((e) => ({
      nodeId: e.nodeId,
      outputData: e.outputData as Record<string, unknown> | null,
    }));

    const parts: string[] = [];
    for (const ref of contentMapping) {
      const value = resolveRef(ref, nodeExecMap);
      if (value !== undefined) {
        parts.push(value);
      } else {
        console.warn(`[export] contentMapping: failed to resolve ref ${ref.nodeId}.${ref.outputId}, skipping`);
      }
    }

    if (parts.length > 0) {
      return parts.join("\n\n");
    }
    // If all refs failed, fall through to upstream-scan logic
  }

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

    // Check for restoredText (restore node output key)
    if (output.restoredText && typeof output.restoredText === "string") {
      return output.restoredText;
    }

    // Check for content field
    if (output.content && typeof output.content === "string") {
      return output.content;
    }

    // Check models Record structure (Phase 12+ format)
    if (output.models && typeof output.models === "object" && !Array.isArray(output.models)) {
      const modelsMap = output.models as Record<string, { content: string; status: string }>;
      const selectedKey = exec.selectedOutputKey;
      if (selectedKey && modelsMap[selectedKey]?.content) {
        return modelsMap[selectedKey].content;
      }
      // Fallback: first completed model
      const first = Object.values(modelsMap).find((m) => m.status === "completed" && m.content);
      if (first?.content) return first.content;
    }

    // Check model outputs array (legacy format, keep as fallback)
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

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
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

function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } {
  // Filter out separator row and empty lines
  const nonSeparator = lines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()));
  if (nonSeparator.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseRow = (line: string): string[] =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i !== 0 && i !== arr.length - 1);

  return {
    headers: parseRow(nonSeparator[0]),
    rows: nonSeparator.slice(1).map(parseRow),
  };
}

function createWordTable(headers: string[], rows: string[][]): Table {
  const colCount = headers.length || 1;
  const colWidth = Math.floor(9000 / colCount);

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "999999",
  };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        children: [new Paragraph({ children: parseInlineFormatting(h) })],
        borders,
        shading: { type: ShadingType.SOLID, color: "E8E8E8" },
        width: { size: colWidth, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
      }),
    ),
  });

  const dataRows = rows.map((row, rowIdx) =>
    new TableRow({
      children: row.map((cell) =>
        new TableCell({
          children: [new Paragraph({ children: parseInlineFormatting(cell) })],
          borders,
          shading:
            rowIdx % 2 === 1
              ? { type: ShadingType.SOLID, color: "F5F5F5" }
              : undefined,
          width: { size: colWidth, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
        }),
      ),
    }),
  );

  return new Table({
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

function createCodeBlock(lines: string[]): Paragraph[] {
  return lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({ text: line, font: { name: "Courier New" }, size: 18 }),
        ],
        shading: { type: ShadingType.SOLID, color: "F3F4F6" },
      }),
  );
}

type Element = Paragraph | Table;

// State machine for parsing markdown into docx elements
function parseMarkdownToElements(content: string): Element[] {
  const lines = content.split("\n");
  const elements: Element[] = [];

  // NORMAL=0, IN_TABLE=1, IN_CODE_BLOCK=2
  let state = 0;
  const tableLines: string[] = [];
  const codeLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length > 0) {
      const { headers, rows } = parseMarkdownTable(tableLines);
      if (headers.length > 0) {
        elements.push(createWordTable(headers, rows));
      } else {
        // Fallback: treat as plain paragraphs
        for (const line of tableLines) {
          const runs = parseInlineFormatting(line);
          elements.push(new Paragraph({ children: runs }));
        }
      }
      tableLines.length = 0;
    }
  };

  const flushCodeBlock = () => {
    if (codeLines.length > 0) {
      const paragraphs = createCodeBlock(codeLines);
      elements.push(...paragraphs);
      codeLines.length = 0;
    }
  };

  const processNormalLine = (line: string) => {
    // Check for ordered list
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      const indent = orderedMatch[1].length;
      let level = 0;
      if (indent >= 2 && indent <= 4) level = 1;
      else if (indent >= 5) level = 2;

      elements.push(
        new Paragraph({
          children: [new TextRun({ text: orderedMatch[3] })],
          numbering: { reference: "ordered-list", level },
        }),
      );
      return;
    }

    // Check for nested unordered list (indented - or *)
    const nestedBulletMatch = line.match(/^(\s+)[-*]\s+(.+)/);
    if (nestedBulletMatch) {
      const indent = nestedBulletMatch[1].length;
      let level = 0;
      if (indent >= 2 && indent <= 4) level = 1;
      else if (indent >= 5) level = 2;

      elements.push(
        new Paragraph({
          children: [new TextRun({ text: nestedBulletMatch[2] })],
          bullet: { level },
        }),
      );
      return;
    }

    // Check for top-level unordered list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(2) })],
          bullet: { level: 0 },
        }),
      );
      return;
    }

    // Headings
    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: h1Match[1], bold: true, size: 32 })],
          heading: HeadingLevel.HEADING_1,
        }),
      );
    } else if (h2Match) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: h2Match[1], bold: true, size: 28 })],
          heading: HeadingLevel.HEADING_2,
        }),
      );
    } else if (h3Match) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: h3Match[1], bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_3,
        }),
      );
    } else if (line.trim() === "") {
      elements.push(new Paragraph({ children: [] }));
    } else {
      const runs = parseInlineFormatting(line);
      elements.push(new Paragraph({ children: runs }));
    }
  };

  for (const line of lines) {
    if (state === 0) {
      // NORMAL state
      if (line.trim().startsWith("```")) {
        // Start code block
        flushCodeBlock();
        state = 2;
      } else if (line.trim().startsWith("|")) {
        // Start table
        flushTable();
        tableLines.push(line);
        state = 1;
      } else {
        processNormalLine(line);
      }
    } else if (state === 1) {
      // IN_TABLE state
      if (line.trim().startsWith("|")) {
        tableLines.push(line);
      } else {
        // End table, back to normal
        flushTable();
        state = 0;
        processNormalLine(line);
      }
    } else if (state === 2) {
      // IN_CODE_BLOCK state
      if (line.trim().startsWith("```")) {
        flushCodeBlock();
        state = 0;
      } else {
        codeLines.push(line);
      }
    }
  }

  // Flush any remaining blocks
  flushTable();
  flushCodeBlock();

  return elements;
}

async function generateWordBuffer(content: string): Promise<Buffer> {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: "decimal",
              text: "%1.%2.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
            {
              level: 2,
              format: "decimal",
              text: "%1.%2.%3.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 2160, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: parseMarkdownToElements(content),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ─── PDF helpers ───────────────────────────────────────────────────────────────

function drawPdfTable(
  doc: typeof PDFDocument.prototype,
  headers: string[],
  rows: string[][],
  startX: number,
) {
  const margin = 50;
  const pageWidth = doc.page.width - margin * 2;
  const colWidth = pageWidth / headers.length;
  const rowHeight = 25;
  let y = doc.y;

  const drawRow = (cells: string[], isHeader: boolean, rowIdx: number) => {
    // Page overflow check
    if (y + rowHeight > doc.page.height - margin) {
      doc.addPage();
      y = doc.y;
    }

    cells.forEach((cell, i) => {
      const x = startX + i * colWidth;
      const clean = cell.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");

      // Background fill
      if (isHeader) {
        doc.rect(x, y, colWidth, rowHeight).fillAndStroke("#E8E8E8", "#999999");
      } else if (rowIdx % 2 === 1) {
        doc.rect(x, y, colWidth, rowHeight).fillAndStroke("#F5F5F5", "#999999");
      } else {
        doc.rect(x, y, colWidth, rowHeight).stroke("#999999");
      }

      // Text
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .fillColor("#333333")
        .text(clean.trim(), x + 4, y + 6, { width: colWidth - 8, height: rowHeight - 8, align: "left" });
    });

    y += rowHeight;
  };

  drawRow(headers, true, -1);
  rows.forEach((row, idx) => drawRow(row, false, idx));
  doc.y = y + 10;
  doc.fillColor("#000000");
}

async function generatePdfBuffer(content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lines = content.split("\n");
    const margin = 50;
    const startX = margin;

    // PDF state machine: NORMAL=0, IN_TABLE=1, IN_CODE_BLOCK=2
    let state = 0;
    const tableLines: string[] = [];
    const codeLines: string[] = [];
    let codeStartY = doc.y;

    const flushPdfTable = () => {
      if (tableLines.length > 0) {
        const { headers, rows } = parseMarkdownTable(tableLines);
        if (headers.length > 0) {
          drawPdfTable(doc, headers, rows, startX);
        } else {
          for (const line of tableLines) {
            const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
            doc.fontSize(12).font("Helvetica").text(clean.trim(), startX, doc.y, {
              width: doc.page.width - margin * 2,
            });
            doc.moveDown(0.3);
          }
        }
        tableLines.length = 0;
      }
    };

    const flushPdfCodeBlock = () => {
      if (codeLines.length > 0) {
        const lineHeight = 16;
        const blockHeight = codeLines.length * lineHeight + 10;
        const pageWidth = doc.page.width - margin * 2;
        const blockY = codeStartY;

        // Page overflow check
        if (blockY + blockHeight > doc.page.height - margin) {
          doc.addPage();
        }

        // Gray background rect
        doc.rect(startX, blockY, pageWidth, blockHeight).fill("#F3F4F6");
        doc.stroke("#F3F4F6");

        // Code lines
        codeLines.forEach((line, idx) => {
          doc
            .font("Courier")
            .fontSize(10)
            .fillColor("#333333")
            .text(line, startX + 4, blockY + 4 + idx * lineHeight, { width: pageWidth - 8 });
        });

        doc.fillColor("#000000");
        doc.y = blockY + blockHeight + 8;
        codeLines.length = 0;
      }
    };

    const processPdfNormalLine = (line: string) => {
      // Ordered list
      const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
      if (orderedMatch) {
        const indent = orderedMatch[1].length;
        let level = 0;
        if (indent >= 2 && indent <= 4) level = 1;
        else if (indent >= 5) level = 2;

        const indentPx = 20 + level * 20;
        const clean = orderedMatch[3].replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc.fontSize(12).font("Helvetica").text(`${orderedMatch[2]}. ${clean}`, startX + indentPx, doc.y, {
          width: doc.page.width - margin * 2 - indentPx,
        });
        doc.moveDown(0.3);
        return;
      }

      // Nested unordered list (indented)
      const nestedBulletMatch = line.match(/^(\s+)[-*]\s+(.+)/);
      if (nestedBulletMatch) {
        const indent = nestedBulletMatch[1].length;
        let level = 0;
        if (indent >= 2 && indent <= 4) level = 1;
        else if (indent >= 5) level = 2;

        const indentPx = 20 + level * 20;
        const clean = nestedBulletMatch[2].replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(`  ${"\u2022".repeat(level + 1)} ${clean}`, startX + indentPx, doc.y, {
            width: doc.page.width - margin * 2 - indentPx,
          });
        doc.moveDown(0.3);
        return;
      }

      // Top-level unordered list
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const clean = line.slice(2).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc.fontSize(12).font("Helvetica").text(`  \u2022 ${clean}`, startX, doc.y, {
          width: doc.page.width - margin * 2,
        });
        doc.moveDown(0.3);
        return;
      }

      // Headings
      const h1Match = line.match(/^# (.+)/);
      const h2Match = line.match(/^## (.+)/);
      const h3Match = line.match(/^### (.+)/);

      if (h1Match) {
        doc.fontSize(22).font("Helvetica-Bold").text(h1Match[1], startX, doc.y, {
          width: doc.page.width - margin * 2,
        });
        doc.moveDown(0.5);
      } else if (h2Match) {
        doc.fontSize(18).font("Helvetica-Bold").text(h2Match[1], startX, doc.y, {
          width: doc.page.width - margin * 2,
        });
        doc.moveDown(0.3);
      } else if (h3Match) {
        doc.fontSize(14).font("Helvetica-Bold").text(h3Match[1], startX, doc.y, {
          width: doc.page.width - margin * 2,
        });
        doc.moveDown(0.2);
      } else if (line.trim() === "") {
        doc.moveDown(0.5);
      } else {
        const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc.fontSize(12).font("Helvetica").text(clean, startX, doc.y, {
          width: doc.page.width - margin * 2,
        });
        doc.moveDown(0.3);
      }
    };

    for (const line of lines) {
      if (state === 0) {
        // NORMAL state
        if (line.trim().startsWith("```")) {
          flushPdfCodeBlock();
          codeStartY = doc.y;
          state = 2;
        } else if (line.trim().startsWith("|")) {
          flushPdfTable();
          tableLines.push(line);
          state = 1;
        } else {
          processPdfNormalLine(line);
        }
      } else if (state === 1) {
        // IN_TABLE state
        if (line.trim().startsWith("|")) {
          tableLines.push(line);
        } else {
          flushPdfTable();
          state = 0;
          processPdfNormalLine(line);
        }
      } else if (state === 2) {
        // IN_CODE_BLOCK state
        if (line.trim().startsWith("```")) {
          flushPdfCodeBlock();
          state = 0;
        } else {
          codeLines.push(line);
        }
      }
    }

    // Flush remaining blocks
    flushPdfTable();
    flushPdfCodeBlock();

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
  // Load export config for contentMapping
  const config = await loadNodeConfig(documentId, nodeExecutionId);
  const content = await resolveContent(documentId, nodeExecutionId, config?.contentMapping);

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
  const config = await loadNodeConfig(documentId, nodeExecutionId);
  const content = await resolveContent(documentId, nodeExecutionId, config?.contentMapping);

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
