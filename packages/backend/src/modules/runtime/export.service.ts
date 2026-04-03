import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { sanitizeFilename, assertWithinRoot } from "../../common/sanitize";
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
import { getTemplate as getPptTemplate } from "../ppt-templates/ppt-templates.service";
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

/** Strip markdown inline formatting markers for plain-text contexts (PDF, PPTX) */
function stripMarkdownInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
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
          children: parseInlineFormatting(orderedMatch[3]),
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
          children: parseInlineFormatting(nestedBulletMatch[2]),
          bullet: { level },
        }),
      );
      return;
    }

    // Check for top-level unordered list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(line.slice(2)),
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

// ─── PPT helpers ────────────────────────────────────────────────────────────

import PptxGenJS from "pptxgenjs";
import { validateSlidePresentation } from "./slide-schema";

// Slide schema types
interface TitleSlide {
  layout: "title";
  title: string;
  subtitle?: string;
  notes?: string;
}
interface ContentSlide {
  layout: "content";
  title: string;
  bullets: string[];
  notes?: string;
}
interface TwoColumnSlide {
  layout: "two_column";
  title: string;
  left: { title?: string; bullets: string[] };
  right: { title?: string; bullets: string[] };
  notes?: string;
}
interface TableSlide {
  layout: "table";
  title: string;
  headers: string[];
  rows: string[][];
  notes?: string;
}
interface ImageSlide {
  layout: "image";
  title: string;
  imageRef?: string;
  caption?: string;
  notes?: string;
}
interface BlankSlide {
  layout: "blank";
  notes?: string;
}

type Slide = TitleSlide | ContentSlide | TwoColumnSlide | TableSlide | ImageSlide | BlankSlide;

interface SlidePresentation {
  metadata?: { aspectRatio?: "16:9" | "4:3"; language?: string };
  slides: Slide[];
}

// Theme defaults
const PPT_THEME = {
  colors: {
    primary: "1E40AF",
    secondary: "3B82F6",
    text: "1F2937",
    textLight: "6B7280",
    background: "FFFFFF",
    tableHeader: "E8E8E8",
    tableStripe: "F5F5F5",
  },
  fonts: {
    title: { face: "Microsoft YaHei", size: 28, bold: true as const },
    subtitle: { face: "Microsoft YaHei", size: 18, bold: false as const },
    body: { face: "Microsoft YaHei", size: 14, bold: false as const },
    caption: { face: "Microsoft YaHei", size: 10, bold: false as const },
    code: { face: "Courier New", size: 10, bold: false as const },
  },
};

type PptTheme = typeof PPT_THEME;

/** Build an effective theme by merging a template's themeConfig over defaults */
function buildThemeFromConfig(themeConfig: Record<string, unknown>): PptTheme {
  const theme = structuredClone(PPT_THEME);

  if (themeConfig.colors && typeof themeConfig.colors === "object") {
    const colors = themeConfig.colors as Record<string, string>;
    for (const key of Object.keys(theme.colors) as (keyof typeof theme.colors)[]) {
      if (colors[key]) {
        theme.colors[key] = colors[key].replace(/^#/, "");
      }
    }
  }

  if (themeConfig.fonts && typeof themeConfig.fonts === "object") {
    const fonts = themeConfig.fonts as Record<string, { face?: string; size?: number }>;
    for (const key of Object.keys(theme.fonts) as (keyof typeof theme.fonts)[]) {
      if (fonts[key]?.face) theme.fonts[key].face = fonts[key].face!;
      if (fonts[key]?.size) theme.fonts[key].size = fonts[key].size!;
    }
  }

  return theme;
}

const MAX_TITLE_CHARS = 60;
const MAX_BULLETS_PER_SLIDE = 8;
const MAX_BULLET_CHARS = 120;
const MAX_TABLE_COLS = 6;
const MAX_TABLE_ROWS = 8;
const MAX_CELL_CHARS = 50;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Path B: Convert Markdown text to Slide array */
export function markdownToSlides(content: string): Slide[] {
  const lines = content.split("\n");
  const slides: Slide[] = [];
  let currentTitle = "";
  let currentBullets: string[] = [];
  let inTable = false;
  const tableLines: string[] = [];
  let inCodeBlock = false;
  const codeLines: string[] = [];

  const flushContent = () => {
    if (currentBullets.length === 0) return;
    // Split into pages if too many bullets
    while (currentBullets.length > 0) {
      const batch = currentBullets.splice(0, MAX_BULLETS_PER_SLIDE);
      const title = slides.some(
        (s) => s.layout === "content" && s.title === currentTitle,
      )
        ? `${truncate(currentTitle, MAX_TITLE_CHARS - 4)} (续)`
        : truncate(currentTitle, MAX_TITLE_CHARS);
      slides.push({
        layout: "content",
        title,
        bullets: batch.map((b) => truncate(b, MAX_BULLET_CHARS)),
      });
    }
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    const { headers, rows } = parseMarkdownTable(tableLines);
    if (headers.length === 0) {
      // Not a valid table, treat as text
      for (const line of tableLines) {
        currentBullets.push(line.replace(/\|/g, "").trim());
      }
      tableLines.length = 0;
      return;
    }

    // Split by columns if too wide
    for (let colStart = 0; colStart < headers.length; colStart += MAX_TABLE_COLS) {
      const colEnd = Math.min(colStart + MAX_TABLE_COLS, headers.length);
      const slicedHeaders = headers.slice(colStart, colEnd).map((h) => truncate(h, MAX_CELL_CHARS));
      const allRows = rows.map((r) =>
        r.slice(colStart, colEnd).map((c) => truncate(c, MAX_CELL_CHARS)),
      );
      // Split by rows if too many
      for (let rowStart = 0; rowStart < allRows.length; rowStart += MAX_TABLE_ROWS) {
        const rowEnd = Math.min(rowStart + MAX_TABLE_ROWS, allRows.length);
        slides.push({
          layout: "table",
          title: truncate(currentTitle || "数据表", MAX_TITLE_CHARS),
          headers: slicedHeaders,
          rows: allRows.slice(rowStart, rowEnd),
        });
      }
    }
    tableLines.length = 0;
  };

  const flushCodeBlock = () => {
    if (codeLines.length === 0) return;
    // Code blocks become content slides with monospace bullets (max 15 lines)
    const maxCodeLines = 15;
    for (let i = 0; i < codeLines.length; i += maxCodeLines) {
      const batch = codeLines.slice(i, i + maxCodeLines);
      slides.push({
        layout: "content",
        title: truncate(currentTitle || "代码", MAX_TITLE_CHARS),
        bullets: batch.map((l) => truncate(l, MAX_BULLET_CHARS)),
      });
    }
    codeLines.length = 0;
  };

  for (const line of lines) {
    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushContent();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table detection
    if (line.trim().startsWith("|")) {
      if (!inTable) {
        flushContent();
        inTable = true;
      }
      tableLines.push(line);
      continue;
    }
    if (inTable) {
      flushTable();
      inTable = false;
    }

    // H1 → Title slide
    const h1Match = line.match(/^# (.+)/);
    if (h1Match) {
      flushContent();
      slides.push({
        layout: "title",
        title: truncate(h1Match[1].trim(), MAX_TITLE_CHARS),
      });
      continue;
    }

    // H2 → New content slide page
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      flushContent();
      currentTitle = h2Match[1].trim();
      continue;
    }

    // H3 → Bold bullet
    const h3Match = line.match(/^### (.+)/);
    if (h3Match) {
      currentBullets.push(`**${h3Match[1].trim()}**`);
      continue;
    }

    // --- → Force page break
    if (/^---+$/.test(line.trim())) {
      flushContent();
      continue;
    }

    // Bullet lists
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch) {
      currentBullets.push(bulletMatch[1].trim());
      continue;
    }

    // Ordered lists
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (orderedMatch) {
      currentBullets.push(orderedMatch[1].trim());
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s*(.+)/);
    if (quoteMatch) {
      currentBullets.push(`"${quoteMatch[1].trim()}"`);
      continue;
    }

    // Non-empty paragraph → bullet
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      currentBullets.push(trimmed);
    }
  }

  // Flush remaining
  if (inCodeBlock) flushCodeBlock();
  if (inTable) flushTable();
  flushContent();

  // If no title slide and we have content, prepend one
  if (slides.length > 0 && slides[0].layout !== "title") {
    slides.unshift({ layout: "title", title: "演示文稿" });
  }

  // If empty, create a minimal presentation
  if (slides.length === 0) {
    slides.push({ layout: "title", title: "空白演示文稿" });
  }

  return slides;
}

/** Path A: Try to parse structured slide JSON with ajv schema validation gate */
export function tryParseSlideJson(content: string): SlidePresentation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.slides) || obj.slides.length === 0) return null;

  // Schema validation gate: reject half-valid JSON to avoid render-time crashes
  const result = validateSlidePresentation(parsed);
  if (!result.valid) {
    console.warn(
      "Slide JSON schema validation failed, falling back to Path B (Markdown):",
      result.errors,
    );
    return null;
  }

  return parsed as SlidePresentation;
}

/** Render Slide array to PPTX buffer using PptxGenJS */
async function renderSlidesToPptx(slides: Slide[], theme: PptTheme = PPT_THEME): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches (16:9)

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();

    switch (slide.layout) {
      case "title": {
        pptSlide.background = { color: theme.colors.primary };
        pptSlide.addText(truncate(slide.title, MAX_TITLE_CHARS), {
          x: 0.75,
          y: 2.0,
          w: 11.8,
          h: 1.5,
          fontSize: theme.fonts.title.size,
          fontFace: theme.fonts.title.face,
          bold: true,
          color: "FFFFFF",
          align: "center",
          valign: "middle",
        });
        if (slide.subtitle) {
          pptSlide.addText(truncate(slide.subtitle, 120), {
            x: 0.75,
            y: 3.8,
            w: 11.8,
            h: 1.0,
            fontSize: theme.fonts.subtitle.size,
            fontFace: theme.fonts.subtitle.face,
            color: "CBD5E1",
            align: "center",
            valign: "middle",
          });
        }
        break;
      }

      case "content": {
        pptSlide.addText(truncate(slide.title, MAX_TITLE_CHARS), {
          x: 0.75,
          y: 0.4,
          w: 11.8,
          h: 0.8,
          fontSize: 24,
          fontFace: theme.fonts.title.face,
          bold: true,
          color: theme.colors.text,
        });
        const bulletRows = slide.bullets.map((b) => {
          const isBold = b.startsWith("**") && b.endsWith("**");
          const text = isBold ? b.slice(2, -2) : stripMarkdownInline(b);
          return {
            text: truncate(text, MAX_BULLET_CHARS),
            options: {
              fontSize: theme.fonts.body.size,
              fontFace: theme.fonts.body.face,
              color: theme.colors.text,
              bold: isBold,
              bullet: true as const,
              paraSpaceAfter: 6,
            },
          };
        });
        pptSlide.addText(bulletRows, {
          x: 0.75,
          y: 1.4,
          w: 11.8,
          h: 5.5,
          valign: "top",
          autoFit: true,
        });
        break;
      }

      case "two_column": {
        pptSlide.addText(truncate(slide.title, MAX_TITLE_CHARS), {
          x: 0.75,
          y: 0.4,
          w: 11.8,
          h: 0.8,
          fontSize: 24,
          fontFace: theme.fonts.title.face,
          bold: true,
          color: theme.colors.text,
        });
        // Left column
        const leftTitle = slide.left.title ? `${stripMarkdownInline(slide.left.title)}\n` : "";
        const leftBullets = slide.left.bullets.map((b) => `• ${truncate(stripMarkdownInline(b), 80)}`).join("\n");
        pptSlide.addText(leftTitle + leftBullets, {
          x: 0.75,
          y: 1.5,
          w: 5.5,
          h: 5.0,
          fontSize: theme.fonts.body.size,
          fontFace: theme.fonts.body.face,
          color: theme.colors.text,
          valign: "top",
          autoFit: true,
        });
        // Right column
        const rightTitle = slide.right.title ? `${stripMarkdownInline(slide.right.title)}\n` : "";
        const rightBullets = slide.right.bullets.map((b) => `• ${truncate(stripMarkdownInline(b), 80)}`).join("\n");
        pptSlide.addText(rightTitle + rightBullets, {
          x: 6.75,
          y: 1.5,
          w: 5.5,
          h: 5.0,
          fontSize: theme.fonts.body.size,
          fontFace: theme.fonts.body.face,
          color: theme.colors.text,
          valign: "top",
          autoFit: true,
        });
        break;
      }

      case "table": {
        pptSlide.addText(truncate(slide.title, MAX_TITLE_CHARS), {
          x: 0.75,
          y: 0.4,
          w: 11.8,
          h: 0.8,
          fontSize: 24,
          fontFace: theme.fonts.title.face,
          bold: true,
          color: theme.colors.text,
        });
        const colW = 11.0 / Math.max(slide.headers.length, 1);
        const headerRow = slide.headers.map((h) => ({
          text: truncate(stripMarkdownInline(h), MAX_CELL_CHARS),
          options: {
            bold: true as const,
            fontSize: 11,
            fontFace: theme.fonts.body.face,
            fill: { color: theme.colors.tableHeader },
            color: theme.colors.text,
            align: "left" as const,
            valign: "middle" as const,
          },
        }));
        const dataRows = slide.rows.map((row, rowIdx) =>
          row.map((cell) => ({
            text: truncate(stripMarkdownInline(cell), MAX_CELL_CHARS),
            options: {
              fontSize: 10,
              fontFace: theme.fonts.body.face,
              fill: rowIdx % 2 === 1 ? { color: theme.colors.tableStripe } : undefined,
              color: theme.colors.text,
              align: "left" as const,
              valign: "middle" as const,
            },
          })),
        );
        pptSlide.addTable([headerRow, ...dataRows], {
          x: 0.75,
          y: 1.5,
          colW,
          border: { type: "solid", pt: 0.5, color: "CCCCCC" },
          autoPage: true,
          autoPageRepeatHeader: true,
        });
        break;
      }

      case "image": {
        pptSlide.addText(truncate(slide.title, MAX_TITLE_CHARS), {
          x: 0.75,
          y: 0.4,
          w: 11.8,
          h: 0.8,
          fontSize: 24,
          fontFace: theme.fonts.title.face,
          bold: true,
          color: theme.colors.text,
        });
        // Placeholder for image
        pptSlide.addShape("rect" as PptxGenJS.ShapeType, {
          x: 2.0,
          y: 1.5,
          w: 9.0,
          h: 5.0,
          fill: { color: "F3F4F6" },
          line: { color: "D1D5DB", width: 1 },
        });
        pptSlide.addText(slide.caption || "[图片]", {
          x: 2.0,
          y: 3.5,
          w: 9.0,
          h: 1.0,
          fontSize: theme.fonts.caption.size,
          fontFace: theme.fonts.caption.face,
          color: theme.colors.textLight,
          align: "center",
          valign: "middle",
        });
        break;
      }

      case "blank":
      default:
        // Empty slide
        break;
    }

    // Add notes if present
    if ("notes" in slide && slide.notes) {
      pptSlide.addNotes(slide.notes.slice(0, 500));
    }
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as ArrayBuffer);
}

/** Generate PPT buffer from content, optionally applying a PPT template */
async function generatePptBuffer(content: string, templateId?: string | null): Promise<Buffer> {
  // Try to load a PPT template if specified
  if (templateId) {
    try {
      const template = await getPptTemplate(templateId);

      if (template.type === "native_pptx" && template.templateFilePath) {
        // native_pptx: use pptx-automizer to load template and replace placeholders
        const { default: AutomizerCls, modify: mod } = await import("pptx-automizer");
        const templateBuffer = await readFile(template.templateFilePath);
        const automizer = new AutomizerCls({ templateDir: "", outputDir: "" });
        automizer.loadRoot(templateBuffer);

        const structured = tryParseSlideJson(content);
        const slides = structured ? structured.slides : markdownToSlides(content);

        // For each slide, copy template slide 1 and replace {{TITLE}}/{{BODY}} placeholders
        for (const slide of slides) {
          const title = "title" in slide ? slide.title : "";
          let body = "";
          if (slide.layout === "content") {
            body = slide.bullets.join("\n");
          } else if (slide.layout === "two_column") {
            body = [...slide.left.bullets, ...slide.right.bullets].join("\n");
          } else if (slide.layout === "table") {
            body = [slide.headers.join(" | "), ...slide.rows.map((r) => r.join(" | "))].join("\n");
          } else if (slide.layout === "title") {
            body = ("subtitle" in slide && slide.subtitle) || "";
          }

          const replaceTitle = mod.replaceText({ replace: "TITLE", by: { text: title } });
          const replaceBody = mod.replaceText({ replace: "BODY", by: { text: body } });

          automizer.addSlide("root", 1, (slideMod) => {
            slideMod.modifyElement("{{TITLE}}", replaceTitle);
            slideMod.modifyElement("{{BODY}}", replaceBody);
          });
        }

        // Write to a temp file and read back as buffer
        const tmpPath = join(getExportPath("_tmp"), `automizer-${Date.now()}.pptx`);
        await mkdir(join(getExportPath("_tmp")), { recursive: true });
        await automizer.write(tmpPath);
        const output = await readFile(tmpPath);
        // Clean up temp file (best-effort)
        import("node:fs/promises").then((fs) => fs.unlink(tmpPath).catch(() => {}));
        return output;
      }

      if (template.type === "code_theme" && template.themeConfig) {
        // code_theme: merge themeConfig colors/fonts over PPT_THEME defaults
        const theme = buildThemeFromConfig(template.themeConfig as Record<string, unknown>);
        const structured = tryParseSlideJson(content);
        const slides = structured ? structured.slides : markdownToSlides(content);
        return renderSlidesToPptx(slides, theme);
      }
    } catch (err) {
      console.warn(
        `[export] Failed to load PPT template ${templateId}, falling back to default theme:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Default: no template or fallback after load failure
  const structured = tryParseSlideJson(content);
  const slides = structured ? structured.slides : markdownToSlides(content);
  return renderSlidesToPptx(slides);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateExport(
  documentId: string,
  nodeExecutionId: string,
  format: "word" | "pdf" | "markdown" | "pptx",
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
    case "pptx": {
      const pptxTemplateId = config?.templateBindings?.pptx ?? config?.templateId ?? null;
      buffer = await generatePptBuffer(content, pptxTemplateId);
      mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      break;
    }
  }

  // Ensure export directory exists
  const exportDir = getExportPath(documentId);
  await mkdir(exportDir, { recursive: true });

  // Save file — sanitize to prevent path traversal in filename
  const safeFilename = sanitizeFilename(filename);
  const storagePath = join(exportDir, safeFilename);
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

  // assertWithinRoot prevents serving files outside export directory
  const validatedPath = assertWithinRoot(getExportPath(documentId), storagePath);

  try {
    const buffer = await readFile(validatedPath);

    let mimeType = "application/octet-stream";
    if (format === "word") {
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (format === "pdf") {
      mimeType = "application/pdf";
    } else if (format === "markdown") {
      mimeType = "text/markdown";
    } else if (format === "pptx") {
      mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }

    return { buffer, filename, mimeType };
  } catch {
    return null;
  }
}
