import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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
import { resolveRef } from "./variable-resolution";
import {
  getDefaultTemplate,
  getTemplate as getPptTemplate,
} from "../ppt-templates/ppt-templates.service";
import {
  buildNativeTemplateProfile,
  extractNativeTemplateProfile,
  mergeNativeTemplateProfiles,
  type NativeTemplateProfile,
} from "../ppt-templates/native-template-profile";
import type { ExportConfig, VariableRef, WorkflowNodeDef } from "@intelliflow/shared";
import { composeDeckWithAi } from "./ppt-export-ai.service";
import {
  assignTemplateSequence,
  buildDeckCompositionSummary,
  buildDeckCompositionWarnings,
  normalizeSlidesForDeck,
  type DeckAssignment,
  type DeckCompositionSummary,
  type DeckSource,
} from "./ppt-deck-composition";
import type { SlideSemanticRole } from "../../../../shared/src/slide-types";

// ─── Node config loader ─────────────────────────────────────────────────────

/**
 * Load ExportConfig from the workflow definition stored in the database.
 */
async function loadNodeConfig(
  documentId: string,
  nodeExecutionId: string,
): Promise<ExportConfig | null> {
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
        console.warn(
          `[export] contentMapping: failed to resolve ref ${ref.nodeId}.${ref.outputId}, skipping`,
        );
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
    children: headers.map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: parseInlineFormatting(h) })],
          borders,
          shading: { type: ShadingType.SOLID, color: "E8E8E8" },
          width: { size: colWidth, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
        }),
    ),
  });

  const dataRows = rows.map(
    (row, rowIdx) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: parseInlineFormatting(cell) })],
              borders,
              shading: rowIdx % 2 === 1 ? { type: ShadingType.SOLID, color: "F5F5F5" } : undefined,
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
        children: [new TextRun({ text: line, font: { name: "Courier New" }, size: 18 })],
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
        .text(clean.trim(), x + 4, y + 6, {
          width: colWidth - 8,
          height: rowHeight - 8,
          align: "left",
        });
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
            doc
              .fontSize(12)
              .font("Helvetica")
              .text(clean.trim(), startX, doc.y, {
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
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(`${orderedMatch[2]}. ${clean}`, startX + indentPx, doc.y, {
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
        const clean = nestedBulletMatch[2]
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1");
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
        const clean = line
          .slice(2)
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1");
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(`  \u2022 ${clean}`, startX, doc.y, {
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
        doc
          .fontSize(22)
          .font("Helvetica-Bold")
          .text(h1Match[1], startX, doc.y, {
            width: doc.page.width - margin * 2,
          });
        doc.moveDown(0.5);
      } else if (h2Match) {
        doc
          .fontSize(18)
          .font("Helvetica-Bold")
          .text(h2Match[1], startX, doc.y, {
            width: doc.page.width - margin * 2,
          });
        doc.moveDown(0.3);
      } else if (h3Match) {
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(h3Match[1], startX, doc.y, {
            width: doc.page.width - margin * 2,
          });
        doc.moveDown(0.2);
      } else if (line.trim() === "") {
        doc.moveDown(0.5);
      } else {
        const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(clean, startX, doc.y, {
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
interface SlideCommonFields {
  semanticRole?: SlideSemanticRole;
  sectionKey?: string;
  visualIntent?: string;
  notes?: string;
}

interface TitleSlide extends SlideCommonFields {
  layout: "title";
  title: string;
  subtitle?: string;
}
interface ContentSlide extends SlideCommonFields {
  layout: "content";
  title: string;
  bullets: string[];
}
interface TwoColumnSlide extends SlideCommonFields {
  layout: "two_column";
  title: string;
  left: { title?: string; bullets: string[] };
  right: { title?: string; bullets: string[] };
}
interface TableSlide extends SlideCommonFields {
  layout: "table";
  title: string;
  headers: string[];
  rows: string[][];
}
interface ImageSlide extends SlideCommonFields {
  layout: "image";
  title: string;
  imageRef?: string;
  caption?: string;
}
interface BlankSlide extends SlideCommonFields {
  layout: "blank";
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
      const fontFace = fonts[key]?.face;
      const fontSize = fonts[key]?.size;
      if (fontFace) theme.fonts[key].face = fontFace;
      if (fontSize) theme.fonts[key].size = fontSize;
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
const EMU_PER_INCH = 914400;

const TEMPLATE_SLOT_KEYS = [
  "TITLE",
  "SUBTITLE",
  "BODY",
  "LEFT",
  "RIGHT",
  "TABLE",
  "IMAGE",
  "CAPTION",
  "NOTES",
  "FOOTER",
  "PAGE_NUM",
] as const;

type TemplateSlotTag = (typeof TEMPLATE_SLOT_KEYS)[number];
type TemplateSelector = string | { creationId?: string; name: string; nameIdx?: number };
type TemplatePosition = { x: number; y: number; cx: number; cy: number };

type TemplateTextParagraph = {
  paragraph: {
    level?: number;
    bullet?: boolean;
    alignment?: "l" | "ctr" | "r" | "just";
    lineSpacing?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    indent?: number;
    marginLeft?: number;
  };
  textRuns: Array<{
    text: string;
    style?: {
      isBold?: boolean;
    };
  }>;
};

type PptCanvas = {
  background?: { color: string };
  addText: (...args: unknown[]) => void;
  addTable: (...args: unknown[]) => void;
  addShape: (...args: unknown[]) => void;
  addImage: (...args: unknown[]) => void;
  addNotes?: (notes: string) => void;
};

type TemplateSlideController = {
  modifyElement: (selector: TemplateSelector, callback: unknown) => void;
  removeElement: (selector: TemplateSelector) => void;
  generate: (callback: (pptSlide: PptCanvas) => void, objectName?: string) => void;
};

type TemplateModifyHelpers = {
  replaceText: (replace: { replace: string; by: { text: string } }) => unknown;
  setText: (text: string) => unknown;
  setMultiText: (paragraphs: TemplateTextParagraph[]) => unknown;
  setTable?: (data: {
    header?: { values: Array<string | number> };
    body: Array<{ label?: string; values: Array<string | number> }>;
  }) => unknown;
};

interface NativeTemplateSlot {
  selector: TemplateSelector;
  position: TemplatePosition;
  explicitTag?: TemplateSlotTag;
  visualType?: string;
  source?: "explicit" | "slide" | "layout" | "sample";
}

interface NativeTemplateSlide {
  slideId: number;
  slideNumber: number;
  layoutName: string;
  hasFullBleedImage: boolean;
  selectors: TemplateSelector[];
  semanticRole?: SlideSemanticRole | null;
  contentDensity?: "sparse" | "medium" | "dense";
  autoUse?: boolean;
  slotOverrides?: Partial<
    Record<
      | "titleSlot"
      | "subtitleSlot"
      | "bodySlot"
      | "leftSlot"
      | "rightSlot"
      | "tableSlot"
      | "imageSlot"
      | "captionSlot"
      | "notesSlot"
      | "footerSlot"
      | "pageNumSlot",
      string
    >
  >;
  titleSlot?: NativeTemplateSlot;
  subtitleSlot?: NativeTemplateSlot;
  bodySlot?: NativeTemplateSlot;
  leftSlot?: NativeTemplateSlot;
  rightSlot?: NativeTemplateSlot;
  tableSlot?: NativeTemplateSlot;
  imageSlot?: NativeTemplateSlot;
  captionSlot?: NativeTemplateSlot;
  notesSlot?: NativeTemplateSlot;
  footerSlot?: NativeTemplateSlot;
  pageNumSlot?: NativeTemplateSlot;
}

type NativeTemplateElement = {
  creationId?: string;
  name: string;
  nameIdx?: number;
  position: TemplatePosition;
  type?: string;
  hasTextBody: boolean;
  getText: () => string[];
  getPlaceholderInfo?: () => { type?: string };
  visualType: string;
};

type NativeTemplateLayoutPlaceholder = {
  type: string;
  idx: number;
  position?: TemplatePosition;
};

type NativeTemplateInfo = {
  name: string;
  slides: Array<{
    id: number;
    number: number;
    info?: {
      layoutName?: string;
      layoutPlaceholders?: NativeTemplateLayoutPlaceholder[];
    };
    elements: NativeTemplateElement[];
  }>;
};

const IMAGE_VISUAL_TYPES = new Set([
  "picture",
  "svgImage",
  "imageFilledShape",
  "bitmap",
  "pictogram",
  "3dModel",
]);

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function selectorKey(selector: TemplateSelector): string {
  if (typeof selector === "string") return selector;
  return selector.creationId ?? `${selector.name}:${selector.nameIdx ?? 0}`;
}

function buildTemplateSelector(element: {
  creationId?: string;
  name: string;
  nameIdx?: number;
}): TemplateSelector {
  if (element.creationId) {
    return {
      creationId: element.creationId,
      name: element.name,
      nameIdx: element.nameIdx,
    };
  }
  if (element.nameIdx && element.nameIdx > 0) {
    return { name: element.name, nameIdx: element.nameIdx };
  }
  return element.name;
}

function uniqueSlots(slots: NativeTemplateSlot[]): NativeTemplateSlot[] {
  const seen = new Set<string>();
  const unique: NativeTemplateSlot[] = [];
  for (const slot of slots) {
    const key = selectorKey(slot.selector);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(slot);
  }
  return unique;
}

function normalizeSlots(slots?: NativeTemplateSlot[]): NativeTemplateSlot[] {
  return uniqueSlots(slots ?? []);
}

function sortSlotsByPosition(slots: NativeTemplateSlot[]): NativeTemplateSlot[] {
  return [...slots].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    return a.position.x - b.position.x;
  });
}

function isTemplateTag(value: string): value is TemplateSlotTag {
  return (TEMPLATE_SLOT_KEYS as readonly string[]).includes(value);
}

function extractTemplateTags(texts: string[]): TemplateSlotTag[] {
  const tags: TemplateSlotTag[] = [];
  for (const text of texts) {
    const matches = text.matchAll(/\{\{([A-Z_]+)\}\}/g);
    for (const match of matches) {
      if (match[1] && isTemplateTag(match[1])) {
        tags.push(match[1]);
      }
    }
  }
  return tags;
}

function emuToInches(value: number): number {
  return value / EMU_PER_INCH;
}

function positionToBox(position: TemplatePosition): { x: number; y: number; w: number; h: number } {
  return {
    x: emuToInches(position.x),
    y: emuToInches(position.y),
    w: emuToInches(position.cx),
    h: emuToInches(position.cy),
  };
}

function resolveLocalImagePath(imageRef?: string): string | null {
  if (!imageRef) return null;
  const normalized = imageRef.startsWith("file://") ? imageRef.slice(7) : imageRef;
  if (existsSync(normalized)) return normalized;

  const cwdPath = join(process.cwd(), normalized);
  if (existsSync(cwdPath)) return cwdPath;

  return null;
}

function buildBulletParagraphs(items: string[]): TemplateTextParagraph[] {
  return items.map((item) => {
    const isBold = item.startsWith("**") && item.endsWith("**");
    const cleanText = truncate(
      stripMarkdownInline(isBold ? item.slice(2, -2) : item),
      MAX_BULLET_CHARS,
    );

    return {
      paragraph: {
        bullet: true,
        level: 0,
        alignment: "l",
        spaceAfter: 1200,
      },
      textRuns: [
        {
          text: cleanText,
          style: isBold ? { isBold: true } : undefined,
        },
      ],
    };
  });
}

function buildPlainParagraphs(lines: string[]): TemplateTextParagraph[] {
  return lines.map((line) => ({
    paragraph: {
      alignment: "l",
      spaceAfter: 800,
    },
    textRuns: [{ text: line }],
  }));
}

function normalizeTemplateText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function textMatchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const SAMPLE_TITLE_PATTERNS = [
  /输入标题文字/i,
  /过渡页标题/i,
  /thankyou/i,
  /谢谢观看/i,
  /thanks/i,
] as const;

const SAMPLE_BODY_PATTERNS = [
  /您的内容打在这里/i,
  /只保留文字/i,
  /复制您的文本/i,
  /输入正文/i,
  /输入内容/i,
] as const;

const SAMPLE_SUBTITLE_PATTERNS = [
  /20xx/i,
  /theme/i,
  /businesspowerpoint/i,
  /standardtemplate/i,
  /20\d{2}/i,
] as const;

function deriveSlotsFromSampleTexts(
  elements: NativeTemplateElement[],
): Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> {
  const derived: Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> = {};

  for (const element of elements) {
    if (!element.hasTextBody) continue;
    const texts = element.getText();
    const joined = normalizeTemplateText(texts.join(" "));
    if (!joined) continue;

    let mappedTag: TemplateSlotTag | null = null;
    if (textMatchesAny(joined, [...SAMPLE_TITLE_PATTERNS])) {
      mappedTag = "TITLE";
    } else if (textMatchesAny(joined, [...SAMPLE_BODY_PATTERNS])) {
      mappedTag = "BODY";
    } else if (textMatchesAny(joined, [...SAMPLE_SUBTITLE_PATTERNS])) {
      mappedTag = "SUBTITLE";
    }

    if (!mappedTag) continue;

    if (!derived[mappedTag]) {
      derived[mappedTag] = [];
    }
    derived[mappedTag]?.push({
      selector: buildTemplateSelector(element),
      position: element.position,
      visualType: element.visualType,
      source: "sample",
    });
  }

  return derived;
}

function hasFullBleedImage(elements: NativeTemplateElement[]): boolean {
  return elements.some((element) => {
    if (!IMAGE_VISUAL_TYPES.has(element.visualType)) return false;
    return element.position.x <= EMU_PER_INCH * 0.1 && element.position.y <= EMU_PER_INCH * 0.1;
  });
}

function toTemplateSlotTagFromPlaceholderType(
  placeholderType: string,
): TemplateSlotTag | null {
  switch (placeholderType) {
    case "title":
    case "ctrTitle":
      return "TITLE";
    case "subTitle":
      return "SUBTITLE";
    case "body":
      return "BODY";
    case "ftr":
      return "FOOTER";
    case "sldNum":
      return "PAGE_NUM";
    case "tbl":
      return "TABLE";
    case "pic":
      return "IMAGE";
    default:
      return null;
  }
}

function getElementBoundingBox(position?: TemplatePosition | null) {
  if (!position) return null;
  return {
    left: position.x,
    right: position.x + position.cx,
    top: position.y,
    bottom: position.y + position.cy,
    centerX: position.x + position.cx / 2,
    centerY: position.y + position.cy / 2,
    area: Math.max(position.cx, 1) * Math.max(position.cy, 1),
  };
}

function computeBoxOverlapScore(
  placeholderPosition?: TemplatePosition | null,
  elementPosition?: TemplatePosition | null,
) {
  const placeholderBox = getElementBoundingBox(placeholderPosition);
  const elementBox = getElementBoundingBox(elementPosition);
  if (!placeholderBox || !elementBox) return -Infinity;

  const intersectionWidth = Math.max(
    0,
    Math.min(placeholderBox.right, elementBox.right) -
      Math.max(placeholderBox.left, elementBox.left),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(placeholderBox.bottom, elementBox.bottom) -
      Math.max(placeholderBox.top, elementBox.top),
  );
  const intersectionArea = intersectionWidth * intersectionHeight;
  const overlapRatio = intersectionArea / Math.max(placeholderBox.area, elementBox.area, 1);
  const centerDistance = Math.hypot(
    placeholderBox.centerX - elementBox.centerX,
    placeholderBox.centerY - elementBox.centerY,
  );
  const distancePenalty =
    centerDistance / Math.max(placeholderPosition?.cx ?? 1, placeholderPosition?.cy ?? 1, 1);

  return overlapRatio * 100 - distancePenalty * 10;
}

function getPlaceholderTypeMatchBonus(
  placeholderType: string,
  element: NativeTemplateElement,
) {
  switch (placeholderType) {
    case "title":
    case "ctrTitle":
    case "subTitle":
    case "body":
    case "ftr":
    case "sldNum":
      return element.hasTextBody ? 40 : -60;
    case "pic":
      return IMAGE_VISUAL_TYPES.has(element.visualType) ? 50 : -30;
    case "tbl":
      return element.visualType === "table" ? 55 : element.hasTextBody ? 15 : -30;
    default:
      return element.hasTextBody ? 10 : 0;
  }
}

function deriveSlotsFromLayoutPlaceholders(
  layoutPlaceholders: NativeTemplateLayoutPlaceholder[] | undefined,
  elements: NativeTemplateElement[],
): Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> {
  if (!layoutPlaceholders || layoutPlaceholders.length === 0) return {};

  const usedSelectors = new Set<string>();
  const derived: Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> = {};
  const placeholders = [...layoutPlaceholders].sort((a, b) => {
    const ay = a.position?.y ?? 0;
    const by = b.position?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.position?.x ?? 0) - (b.position?.x ?? 0);
  });

  for (const placeholder of placeholders) {
    const mappedTag = toTemplateSlotTagFromPlaceholderType(placeholder.type);
    if (!mappedTag || !placeholder.position) continue;

    let bestElement: NativeTemplateElement | null = null;
    let bestScore = -Infinity;

    for (const element of elements) {
      const selector = buildTemplateSelector(element);
      const selectorId = selectorKey(selector);
      if (usedSelectors.has(selectorId)) continue;

      const score =
        getPlaceholderTypeMatchBonus(placeholder.type, element) +
        computeBoxOverlapScore(placeholder.position, element.position);
      if (score > bestScore) {
        bestScore = score;
        bestElement = element;
      }
    }

    if (!bestElement || bestScore < 10) continue;

    const selector = buildTemplateSelector(bestElement);
    usedSelectors.add(selectorKey(selector));

    if (!derived[mappedTag]) {
      derived[mappedTag] = [];
    }
    derived[mappedTag]?.push({
      selector,
      position: bestElement.position,
      visualType: bestElement.visualType,
      source: "layout",
    });
  }

  const bodySlots = sortSlotsByPosition(derived.BODY ?? []);
  if (bodySlots.length >= 2) {
    derived.LEFT = [
      { ...bodySlots[0] },
    ];
    derived.RIGHT = [
      { ...bodySlots[1] },
    ];
  }

  return derived;
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
      const title = slides.some((s) => s.layout === "content" && s.title === currentTitle)
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

function pickFirstSlot(...slotGroups: Array<NativeTemplateSlot[] | undefined>): NativeTemplateSlot | undefined {
  for (const group of slotGroups) {
    if (group && group.length > 0) return group[0];
  }
  return undefined;
}

function buildNativeTemplateSlides(templateInfos: NativeTemplateInfo[]): NativeTemplateSlide[] {
  const templateInfo = templateInfos.find((info) => info.name === "__native_template__") ?? templateInfos.at(-1);
  if (!templateInfo) return [];

  return templateInfo.slides.map((slide) => {
    const taggedSlots: Partial<Record<TemplateSlotTag, NativeTemplateSlot[]>> = {};
    const titleFallback: NativeTemplateSlot[] = [];
    const subtitleFallback: NativeTemplateSlot[] = [];
    const bodyFallback: NativeTemplateSlot[] = [];
    const footerFallback: NativeTemplateSlot[] = [];
    const pageNumFallback: NativeTemplateSlot[] = [];
    const tableAnchors: NativeTemplateSlot[] = [];
    const imageAnchors: NativeTemplateSlot[] = [];
    const selectors: TemplateSelector[] = [];
    const layoutDerivedSlots = deriveSlotsFromLayoutPlaceholders(
      slide.info?.layoutPlaceholders,
      slide.elements,
    );
    const sampleDerivedSlots = deriveSlotsFromSampleTexts(slide.elements);

    for (const element of slide.elements) {
      const selector = buildTemplateSelector(element);
      const position = element.position;
      const slot: NativeTemplateSlot = {
        selector,
        position,
        visualType: element.visualType,
        source: "slide",
      };
      selectors.push(selector);

      if (element.hasTextBody) {
        const tags = extractTemplateTags(element.getText());
        for (const tag of tags) {
          if (!taggedSlots[tag]) {
            taggedSlots[tag] = [];
          }
          taggedSlots[tag]?.push({ ...slot, explicitTag: tag, source: "explicit" });
        }
      }

      let placeholderType: string | undefined;
      try {
        placeholderType = element.getPlaceholderInfo?.()?.type;
      } catch {
        placeholderType = undefined;
      }

      switch (placeholderType) {
        case "title":
        case "ctrTitle":
          titleFallback.push(slot);
          break;
        case "subTitle":
          subtitleFallback.push(slot);
          break;
        case "body":
          bodyFallback.push(slot);
          break;
        case "ftr":
          footerFallback.push(slot);
          break;
        case "sldNum":
          pageNumFallback.push(slot);
          break;
        case "tbl":
          tableAnchors.push(slot);
          break;
        case "pic":
          imageAnchors.push(slot);
          break;
      }

      if (element.visualType === "table") {
        tableAnchors.push(slot);
      }
      if (IMAGE_VISUAL_TYPES.has(element.visualType)) {
        imageAnchors.push(slot);
      }
    }

    const sortedBodySlots = sortSlotsByPosition(
      uniqueSlots([
        ...bodyFallback,
        ...(layoutDerivedSlots.BODY ?? []),
        ...(sampleDerivedSlots.BODY ?? []),
      ]),
    );
    const titleSlot = pickFirstSlot(
      normalizeSlots(taggedSlots.TITLE),
      normalizeSlots(sampleDerivedSlots.TITLE),
      normalizeSlots(titleFallback),
      normalizeSlots(layoutDerivedSlots.TITLE),
    );
    const subtitleSlot = pickFirstSlot(
      normalizeSlots(taggedSlots.SUBTITLE),
      normalizeSlots(sampleDerivedSlots.SUBTITLE),
      normalizeSlots(subtitleFallback),
      normalizeSlots(layoutDerivedSlots.SUBTITLE),
      sortedBodySlots,
    );
    const bodySlot = pickFirstSlot(normalizeSlots(taggedSlots.BODY), sortedBodySlots);
    const leftSlot = pickFirstSlot(
      normalizeSlots(taggedSlots.LEFT),
      normalizeSlots(layoutDerivedSlots.LEFT),
      sortedBodySlots,
    );
    const rightSlot = pickFirstSlot(
      normalizeSlots(taggedSlots.RIGHT),
      normalizeSlots(layoutDerivedSlots.RIGHT),
      sortSlotsByPosition(
        sortedBodySlots.filter((slot) => selectorKey(slot.selector) !== selectorKey(leftSlot?.selector ?? "")),
      ),
    );
    const tableSlot = pickFirstSlot(
      normalizeSlots(taggedSlots.TABLE),
      normalizeSlots(layoutDerivedSlots.TABLE),
      normalizeSlots(tableAnchors),
      bodySlot ? [bodySlot] : undefined,
    );
    const imageSlot = pickFirstSlot(
      normalizeSlots(taggedSlots.IMAGE),
      normalizeSlots(layoutDerivedSlots.IMAGE),
      normalizeSlots(imageAnchors),
      bodySlot ? [bodySlot] : undefined,
    );

    return {
      slideId: slide.id as number,
      slideNumber: slide.number as number,
      layoutName: slide.info?.layoutName ?? `Slide ${slide.number}`,
      hasFullBleedImage: hasFullBleedImage(slide.elements),
      selectors: uniqueSlots(selectors.map((selector) => ({
        selector,
        position: { x: 0, y: 0, cx: 0, cy: 0 },
      }))).map((slot) => slot.selector),
      titleSlot,
      subtitleSlot,
      bodySlot,
      leftSlot,
      rightSlot,
      tableSlot,
      imageSlot,
      captionSlot: pickFirstSlot(normalizeSlots(taggedSlots.CAPTION)),
      notesSlot: pickFirstSlot(normalizeSlots(taggedSlots.NOTES)),
      footerSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.FOOTER),
        normalizeSlots(layoutDerivedSlots.FOOTER),
        normalizeSlots(footerFallback),
      ),
      pageNumSlot: pickFirstSlot(
        normalizeSlots(taggedSlots.PAGE_NUM),
        normalizeSlots(layoutDerivedSlots.PAGE_NUM),
        normalizeSlots(pageNumFallback),
      ),
    };
  });
}

function layoutNameBonus(layoutName: string, layout: Slide["layout"]): number {
  const name = layoutName.toLowerCase();
  switch (layout) {
    case "title":
      return name.includes("title") || name.includes("cover") ? 6 : 0;
    case "content":
      return name.includes("content") || name.includes("body") ? 6 : 0;
    case "two_column":
      return name.includes("two") || name.includes("column") || name.includes("compare") ? 6 : 0;
    case "table":
      return name.includes("table") || name.includes("data") ? 6 : 0;
    case "image":
      return name.includes("image") || name.includes("photo") || name.includes("picture") ? 6 : 0;
    case "blank":
      return name.includes("blank") ? 6 : 0;
  }
}

function scoreNativeTemplateSlide(templateSlide: NativeTemplateSlide, slide: Slide): number {
  let score = layoutNameBonus(templateSlide.layoutName, slide.layout);

  switch (slide.layout) {
    case "title":
      if (!templateSlide.titleSlot) return 0;
      score += 40;
      if (templateSlide.subtitleSlot) score += 10;
      if (templateSlide.hasFullBleedImage) score += 25;
      return score;
    case "content":
      if (!templateSlide.titleSlot || !templateSlide.bodySlot) return 0;
      score += 60;
      if (templateSlide.bodySlot.explicitTag === "BODY") score += 15;
      if (templateSlide.hasFullBleedImage) score += 8;
      return score;
    case "two_column":
      if (!templateSlide.titleSlot) return 0;
      if (
        templateSlide.leftSlot &&
        templateSlide.rightSlot &&
        selectorKey(templateSlide.leftSlot.selector) !== selectorKey(templateSlide.rightSlot.selector)
      ) {
        score += 80;
        if (templateSlide.leftSlot.explicitTag === "LEFT") score += 10;
        if (templateSlide.rightSlot.explicitTag === "RIGHT") score += 10;
        return score;
      }
      if (templateSlide.bodySlot) {
        score += 38;
        return score;
      }
      return 0;
    case "table":
      if (!templateSlide.titleSlot) return 0;
      if (templateSlide.tableSlot) {
        score += 70;
        if (templateSlide.tableSlot.explicitTag === "TABLE") score += 15;
        return score;
      }
      if (templateSlide.bodySlot) {
        score += 34;
        return score;
      }
      return 0;
    case "image":
      if (!templateSlide.titleSlot) return 0;
      if (templateSlide.imageSlot) {
        score += 70;
        if (templateSlide.imageSlot.explicitTag === "IMAGE") score += 15;
        if (templateSlide.hasFullBleedImage) score += 10;
        return score;
      }
      if (templateSlide.bodySlot) {
        score += 30;
        if (templateSlide.hasFullBleedImage) score += 10;
        return score;
      }
      return 0;
    case "blank":
      score += 10;
      if (
        !templateSlide.bodySlot &&
        !templateSlide.leftSlot &&
        !templateSlide.rightSlot &&
        !templateSlide.tableSlot &&
        !templateSlide.imageSlot
      ) {
        score += 20;
      }
      return score;
  }
}

function matchNativeTemplateSlide(
  slide: Slide,
  templateSlides: NativeTemplateSlide[],
): NativeTemplateSlide | null {
  const ranked = templateSlides
    .map((templateSlide) => ({
      templateSlide,
      score: scoreNativeTemplateSlide(templateSlide, slide),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.templateSlide.slideNumber - b.templateSlide.slideNumber);

  return ranked[0]?.templateSlide ?? null;
}

function pickFallbackTemplateSlide(templateSlides: NativeTemplateSlide[]): NativeTemplateSlide | null {
  const candidates = templateSlides.filter((slide) => slide.autoUse !== false);
  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((a, b) => {
    const blankA = layoutNameBonus(a.layoutName, "blank");
    const blankB = layoutNameBonus(b.layoutName, "blank");
    if (blankA !== blankB) return blankB - blankA;
    return a.selectors.length - b.selectors.length || a.slideNumber - b.slideNumber;
  });

  return ranked[0] ?? null;
}

function resolveTemplateSlot(
  templateSlide: NativeTemplateSlide,
  slotName:
    | "titleSlot"
    | "subtitleSlot"
    | "bodySlot"
    | "leftSlot"
    | "rightSlot"
    | "tableSlot"
    | "imageSlot"
    | "captionSlot"
    | "notesSlot"
    | "footerSlot"
    | "pageNumSlot",
): NativeTemplateSlot | undefined {
  const override = templateSlide.slotOverrides?.[slotName];
  if (override === "__NONE__") return undefined;
  if (override && override in templateSlide) {
    return templateSlide[override as keyof NativeTemplateSlide] as NativeTemplateSlot | undefined;
  }
  return templateSlide[slotName];
}

function setTemplateText(
  targetSlide: TemplateSlideController,
  modify: TemplateModifyHelpers,
  slot: NativeTemplateSlot | undefined,
  value: string,
) {
  if (!slot) return;
  if (slot.explicitTag && slot.source === "explicit") {
    targetSlide.modifyElement(
      slot.selector,
      modify.replaceText({
        replace: slot.explicitTag,
        by: { text: value },
      }),
    );
    return;
  }
  targetSlide.modifyElement(slot.selector, modify.setText(value));
}

function setTemplateParagraphs(
  targetSlide: TemplateSlideController,
  modify: TemplateModifyHelpers,
  slot: NativeTemplateSlot | undefined,
  paragraphs: TemplateTextParagraph[],
) {
  if (!slot) return;
  if (paragraphs.length === 0) {
    setTemplateText(targetSlide, modify, slot, "");
    return;
  }
  targetSlide.modifyElement(slot.selector, modify.setMultiText(paragraphs));
}

function buildTableParagraphs(slide: TableSlide): TemplateTextParagraph[] {
  const lines = [
    slide.headers.map((header) => truncate(stripMarkdownInline(header), MAX_CELL_CHARS)).join(" | "),
    ...slide.rows.map((row) =>
      row.map((cell) => truncate(stripMarkdownInline(cell), MAX_CELL_CHARS)).join(" | "),
    ),
  ];
  return buildPlainParagraphs(lines);
}

function buildImageParagraphs(slide: ImageSlide): TemplateTextParagraph[] {
  const lines = [
    slide.caption ? truncate(stripMarkdownInline(slide.caption), 100) : "[图片]",
    slide.imageRef ? `图片来源: ${slide.imageRef}` : "图片将在此区域呈现",
  ];
  return buildPlainParagraphs(lines);
}

function addTableToPptSlide(
  pptSlide: PptCanvas,
  slide: TableSlide,
  theme: PptTheme,
  box?: { x: number; y: number; w: number; h: number },
) {
  const width = box?.w ?? 11.0;
  const colW = width / Math.max(slide.headers.length, 1);
  const headerRow = slide.headers.map((header) => ({
    text: truncate(stripMarkdownInline(header), MAX_CELL_CHARS),
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
    x: box?.x ?? 0.75,
    y: box?.y ?? 1.5,
    colW,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

function addImageToPptSlide(
  pptSlide: PptCanvas,
  slide: ImageSlide,
  theme: PptTheme,
  box?: { x: number; y: number; w: number; h: number },
  captionInSlot = false,
) {
  const imageBox = box ?? { x: 2.0, y: 1.5, w: 9.0, h: 5.0 };
  const imagePath = resolveLocalImagePath(slide.imageRef);

  if (imagePath) {
    pptSlide.addImage({
      path: imagePath,
      x: imageBox.x,
      y: imageBox.y,
      w: imageBox.w,
      h: imageBox.h,
    });
    if (!captionInSlot && slide.caption) {
      pptSlide.addText(truncate(slide.caption, 100), {
        x: imageBox.x,
        y: imageBox.y + imageBox.h - 0.5,
        w: imageBox.w,
        h: 0.4,
        fontSize: theme.fonts.caption.size,
        fontFace: theme.fonts.caption.face,
        color: theme.colors.textLight,
        align: "center",
        valign: "middle",
      });
    }
    return;
  }

  pptSlide.addShape("rect" as PptxGenJS.ShapeType, {
    x: imageBox.x,
    y: imageBox.y,
    w: imageBox.w,
    h: imageBox.h,
    fill: { color: "F3F4F6" },
    line: { color: "D1D5DB", width: 1 },
  });

  if (!captionInSlot) {
    pptSlide.addText(slide.caption || "[图片]", {
      x: imageBox.x,
      y: imageBox.y + imageBox.h / 2 - 0.4,
      w: imageBox.w,
      h: 0.8,
      fontSize: theme.fonts.caption.size,
      fontFace: theme.fonts.caption.face,
      color: theme.colors.textLight,
      align: "center",
      valign: "middle",
    });
  }
}

function renderSlideWithTheme(pptSlide: PptCanvas, slide: Slide, theme: PptTheme = PPT_THEME) {
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
      const bulletRows = slide.bullets.map((bullet) => {
        const isBold = bullet.startsWith("**") && bullet.endsWith("**");
        const text = isBold ? bullet.slice(2, -2) : stripMarkdownInline(bullet);
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

      const leftTitle = slide.left.title ? `${stripMarkdownInline(slide.left.title)}\n` : "";
      const leftBullets = slide.left.bullets
        .map((bullet) => `• ${truncate(stripMarkdownInline(bullet), 80)}`)
        .join("\n");
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

      const rightTitle = slide.right.title ? `${stripMarkdownInline(slide.right.title)}\n` : "";
      const rightBullets = slide.right.bullets
        .map((bullet) => `• ${truncate(stripMarkdownInline(bullet), 80)}`)
        .join("\n");
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
      addTableToPptSlide(pptSlide, slide, theme);
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
      addImageToPptSlide(pptSlide, slide, theme);
      break;
    }
    case "blank":
    default:
      break;
  }
}

function addNotesToPptSlide(pptSlide: PptCanvas, slide: Slide) {
  if ("notes" in slide && slide.notes && typeof pptSlide.addNotes === "function") {
    pptSlide.addNotes(slide.notes.slice(0, 500));
  }
}

function renderSlideWithNativeTemplate(
  targetSlide: TemplateSlideController,
  slide: Slide,
  templateSlide: NativeTemplateSlide,
  modify: TemplateModifyHelpers,
  theme: PptTheme,
  pageNumber: number,
) {
  const titleSlot = resolveTemplateSlot(templateSlide, "titleSlot");
  const subtitleSlot = resolveTemplateSlot(templateSlide, "subtitleSlot");
  const bodySlot = resolveTemplateSlot(templateSlide, "bodySlot");
  const leftSlot = resolveTemplateSlot(templateSlide, "leftSlot");
  const rightSlot = resolveTemplateSlot(templateSlide, "rightSlot");
  const tableSlot = resolveTemplateSlot(templateSlide, "tableSlot");
  const imageSlot = resolveTemplateSlot(templateSlide, "imageSlot");
  const captionSlot = resolveTemplateSlot(templateSlide, "captionSlot");
  const notesSlot = resolveTemplateSlot(templateSlide, "notesSlot");
  const footerSlot = resolveTemplateSlot(templateSlide, "footerSlot");
  const pageNumSlot = resolveTemplateSlot(templateSlide, "pageNumSlot");

  setTemplateText(targetSlide, modify, titleSlot, "title" in slide ? truncate(slide.title, MAX_TITLE_CHARS) : "");
  setTemplateText(targetSlide, modify, notesSlot, slide.notes?.slice(0, 500) ?? "");
  setTemplateText(targetSlide, modify, footerSlot, "");
  setTemplateText(targetSlide, modify, pageNumSlot, String(pageNumber));

  switch (slide.layout) {
    case "title":
      setTemplateText(targetSlide, modify, subtitleSlot, slide.subtitle ? truncate(slide.subtitle, 120) : "");
      break;
    case "content":
      setTemplateParagraphs(targetSlide, modify, bodySlot, buildBulletParagraphs(slide.bullets));
      setTemplateText(targetSlide, modify, subtitleSlot, "");
      break;
    case "two_column": {
      if (!leftSlot || !rightSlot) {
        const fallbackParagraphs = [
          ...(slide.left.title
            ? buildPlainParagraphs([truncate(stripMarkdownInline(slide.left.title), 80)])
            : []),
          ...buildBulletParagraphs(slide.left.bullets),
          ...(slide.right.title
            ? buildPlainParagraphs([truncate(stripMarkdownInline(slide.right.title), 80)])
            : []),
          ...buildBulletParagraphs(slide.right.bullets),
        ];
        setTemplateParagraphs(
          targetSlide,
          modify,
          bodySlot ?? subtitleSlot,
          fallbackParagraphs,
        );
        break;
      }

      const leftParagraphs = [
        ...(slide.left.title ? buildPlainParagraphs([truncate(stripMarkdownInline(slide.left.title), 80)]) : []),
        ...buildBulletParagraphs(slide.left.bullets),
      ];
      const rightParagraphs = [
        ...(slide.right.title ? buildPlainParagraphs([truncate(stripMarkdownInline(slide.right.title), 80)]) : []),
        ...buildBulletParagraphs(slide.right.bullets),
      ];
      setTemplateParagraphs(targetSlide, modify, leftSlot, leftParagraphs);
      setTemplateParagraphs(targetSlide, modify, rightSlot, rightParagraphs);
      break;
    }
    case "table":
      if (!tableSlot && bodySlot) {
        setTemplateParagraphs(targetSlide, modify, bodySlot, buildTableParagraphs(slide));
        break;
      }
      if (tableSlot) {
        const tableBox = positionToBox(tableSlot.position);
        if (
          tableSlot.visualType === "table" &&
          typeof modify.setTable === "function"
        ) {
          targetSlide.modifyElement(
            tableSlot.selector,
            modify.setTable({
              header: {
                values: slide.headers.map((header) =>
                  truncate(stripMarkdownInline(header), MAX_CELL_CHARS),
                ),
              },
              body: slide.rows.map((row, rowIdx) => ({
                label: `row-${rowIdx + 1}`,
                values: row.map((cell) => truncate(stripMarkdownInline(cell), MAX_CELL_CHARS)),
              })),
            }),
          );
        } else {
          setTemplateText(targetSlide, modify, tableSlot, "");
          targetSlide.generate((pptSlide) => {
            addTableToPptSlide(pptSlide, slide, theme, tableBox);
          }, `native-table-${pageNumber}`);
        }
      }
      break;
    case "image":
      if (!imageSlot && bodySlot) {
        setTemplateParagraphs(targetSlide, modify, bodySlot, buildImageParagraphs(slide));
        setTemplateText(
          targetSlide,
          modify,
          captionSlot,
          slide.caption ? truncate(slide.caption, 100) : "",
        );
        break;
      }
      if (imageSlot) {
        const imageBox = positionToBox(imageSlot.position);
        if (imageSlot.visualType !== "picture") {
          setTemplateText(targetSlide, modify, imageSlot, "");
        }
        targetSlide.generate((pptSlide) => {
          addImageToPptSlide(
            pptSlide,
            slide,
            theme,
            imageBox,
            Boolean(captionSlot),
          );
        }, `native-image-${pageNumber}`);
      }
      setTemplateText(targetSlide, modify, captionSlot, slide.caption ? truncate(slide.caption, 100) : "");
      break;
    case "blank":
    default:
      break;
  }
}

function renderSlideOnFallbackCanvas(
  targetSlide: TemplateSlideController,
  slide: Slide,
  canvasSlide: NativeTemplateSlide,
  theme: PptTheme,
  pageNumber: number,
) {
  for (const selector of canvasSlide.selectors) {
    targetSlide.removeElement(selector);
  }

  targetSlide.generate((pptSlide) => {
    renderSlideWithTheme(pptSlide, slide, theme);
    addNotesToPptSlide(pptSlide, slide);
  }, `native-fallback-${pageNumber}`);
}

/** Render Slide array to PPTX buffer using PptxGenJS */
async function renderSlidesToPptx(slides: Slide[], theme: PptTheme = PPT_THEME): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  for (const slide of slides) {
    const pptSlide = pptx.addSlide() as unknown as PptCanvas;
    renderSlideWithTheme(pptSlide, slide, theme);
    addNotesToPptSlide(pptSlide, slide);
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as ArrayBuffer);
}

async function renderSlidesWithNativeTemplate(
  assignments: DeckAssignment[],
  templateBuffer: Buffer,
  theme: PptTheme = PPT_THEME,
  storedProfile?: NativeTemplateProfile | null,
): Promise<Buffer> {
  const { default: AutomizerCls, modify } = await import("pptx-automizer");
  const useCreationIds = Boolean(
    storedProfile?.slides.some((slide) => slide.slideId !== slide.slideNumber),
  );
  const automizer = new AutomizerCls({
    templateDir: "",
    outputDir: "",
    removeExistingSlides: true,
    useCreationIds,
  });

  automizer.loadRoot(templateBuffer).load(templateBuffer, "__native_template__");
  const templateInfos = await automizer.setCreationIds();
  const liveProfile = buildNativeTemplateProfile(templateInfos as never);
  const templateProfile = mergeNativeTemplateProfiles(
    liveProfile.slides.length > 0 ? liveProfile : storedProfile ?? liveProfile,
    storedProfile,
  );
  const templateSlides = templateProfile.slides as unknown as NativeTemplateSlide[];
  const fallbackCanvas = pickFallbackTemplateSlide(templateSlides);

  if (templateSlides.length === 0 || !fallbackCanvas) {
    throw new Error("PPT 模板中没有可用的幻灯片布局");
  }

  assignments.forEach((assignment) => {
    const matchedTemplateSlide = assignment.templateSlide as unknown as NativeTemplateSlide | null;
    const sourceSlide = matchedTemplateSlide ?? fallbackCanvas;

    automizer.addSlide(
      "__native_template__",
      useCreationIds ? sourceSlide.slideId : sourceSlide.slideNumber,
      (targetSlide) => {
      const templateTargetSlide = targetSlide as unknown as TemplateSlideController;
      if (!matchedTemplateSlide) {
        console.warn(
          `[export] PPT template missing layout for page ${assignment.pageNumber}, falling back to generated slide`,
        );
        renderSlideOnFallbackCanvas(
          templateTargetSlide,
          assignment.slide,
          sourceSlide,
          theme,
          assignment.pageNumber,
        );
        return;
      }

      try {
        renderSlideWithNativeTemplate(
          templateTargetSlide,
          assignment.slide,
          matchedTemplateSlide,
          modify,
          theme,
          assignment.pageNumber,
        );
      } catch (err) {
        console.warn(
          `[export] Failed to render native PPT template slide "${matchedTemplateSlide.layoutName}", falling back to generated slide:`,
          err instanceof Error ? err.message : err,
        );
        renderSlideOnFallbackCanvas(
          templateTargetSlide,
          assignment.slide,
          sourceSlide,
          theme,
          assignment.pageNumber,
        );
      }
      },
    );
  });

  const zip = await automizer.getJSZip();
  const output = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(output);
}

async function resolvePptTemplate(templateId?: string | null) {
  if (templateId) {
    try {
      return await getPptTemplate(templateId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "TEMPLATE_NOT_FOUND") {
        throw new Error("所选 PPT 模板不存在，请刷新模板列表后重新选择");
      }
      throw err;
    }
  }

  const defaultTemplate = await getDefaultTemplate();
  if (!defaultTemplate?.id) {
    return null;
  }

  try {
    return await getPptTemplate(defaultTemplate.id);
  } catch (err) {
    console.warn(
      `[export] Failed to resolve default PPT template ${defaultTemplate.id}:`,
      err instanceof Error ? err.message : err,
    );
  }

  return null;
}

type PptBufferResult = {
  buffer: Buffer;
  renderMode: string;
  warnings: string[];
  compositionSummary: DeckCompositionSummary;
  templateId: string | null;
};

type PptCompositionResult = {
  slides: Slide[];
  source: DeckSource;
  warnings: string[];
};

async function buildDeckComposition(
  content: string,
  templateProfile: NativeTemplateProfile | null,
  documentId: string,
  nodeExecutionId: string,
  userId: string,
): Promise<PptCompositionResult> {
  const structured = tryParseSlideJson(content);
  if (structured) {
    return {
      slides: normalizeSlidesForDeck(structured.slides as Slide[]),
      source: "structured",
      warnings: [],
    };
  }

  const aiResult = await composeDeckWithAi({
    content,
    templateProfile,
    documentId,
    nodeExecutionId,
    userId,
  });

  if (aiResult.presentation) {
    return {
      slides: normalizeSlidesForDeck(aiResult.presentation.slides as Slide[]),
      source: "ai",
      warnings: aiResult.warning ? [aiResult.warning] : [],
    };
  }

  return {
    slides: normalizeSlidesForDeck(markdownToSlides(content)),
    source: "markdown",
    warnings: aiResult.warning ? [aiResult.warning] : [],
  };
}

/** Generate PPT buffer from content, optionally applying a PPT template */
async function generatePptBuffer(params: {
  content: string;
  templateId?: string | null;
  documentId: string;
  nodeExecutionId: string;
  userId: string;
}): Promise<PptBufferResult> {
  const template = await resolvePptTemplate(params.templateId);
  const templateProfile = extractNativeTemplateProfile(template?.themeConfig);
  const composition = await buildDeckComposition(
    params.content,
    templateProfile,
    params.documentId,
    params.nodeExecutionId,
    params.userId,
  );

  if (template) {
    try {
      if (template.type === "native_pptx" && template.templateFilePath) {
        const templateBuffer = await readFile(template.templateFilePath);
        const assignments = assignTemplateSequence(
          composition.slides,
          (templateProfile?.slides ?? []) as NativeTemplateProfile["slides"],
        );
        const buffer = await renderSlidesWithNativeTemplate(
          assignments,
          templateBuffer,
          PPT_THEME,
          templateProfile,
        );
        const compositionSummary = buildDeckCompositionSummary({
          source: composition.source,
          slides: composition.slides,
          assignments,
        });
        const warnings = [
          ...composition.warnings,
          ...buildDeckCompositionWarnings({
            source: composition.source,
            usedAi: composition.source === "ai",
            aiFailed: composition.source === "markdown",
            assignments,
          }),
        ];
        return {
          buffer,
          renderMode: `native_template_${composition.source}`,
          warnings: [...new Set(warnings)],
          compositionSummary,
          templateId: template.id,
        };
      }

      if (template.type === "code_theme" && template.themeConfig) {
        const theme = buildThemeFromConfig(template.themeConfig as Record<string, unknown>);
        const buffer = await renderSlidesToPptx(composition.slides, theme);
        return {
          buffer,
          renderMode: `code_theme_${composition.source}`,
          warnings: [...new Set(composition.warnings)],
          compositionSummary: buildDeckCompositionSummary({
            source: composition.source,
            slides: composition.slides,
          }),
          templateId: template.id,
        };
      }
    } catch (err) {
      console.warn(
        `[export] Failed to apply PPT template ${template.id}, falling back to default theme:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    buffer: await renderSlidesToPptx(composition.slides),
    renderMode: `default_theme_${composition.source}`,
    warnings: [...new Set(composition.warnings)],
    compositionSummary: buildDeckCompositionSummary({
      source: composition.source,
      slides: composition.slides,
    }),
    templateId: template?.id ?? null,
  };
}

export const __pptExportTestUtils = {
  renderSlidesWithNativeTemplate,
};

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateExport(
  documentId: string,
  nodeExecutionId: string,
  format: "word" | "pdf" | "markdown" | "pptx",
  filename: string,
  userId: string,
  templateIdOverride?: string | null,
): Promise<{
  filename: string;
  storagePath: string;
  fileSize: number;
  format: string;
  templateId?: string | null;
  renderMode?: string;
  warnings?: string[];
  compositionSummary?: DeckCompositionSummary;
}> {
  // Load export config for contentMapping
  const config = await loadNodeConfig(documentId, nodeExecutionId);
  const content = await resolveContent(documentId, nodeExecutionId, config?.contentMapping);

  // Generate file buffer
  let buffer: Buffer;
  let mimeType: string;
  let appliedTemplateId: string | null = null;
  let renderMode: string | undefined;
  let warnings: string[] | undefined;
  let compositionSummary: DeckCompositionSummary | undefined;

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
      const pptxTemplateId =
        templateIdOverride !== undefined
          ? templateIdOverride
          : config?.templateBindings?.pptx ?? config?.templateId ?? null;
      const pptResult = await generatePptBuffer({
        content,
        templateId: pptxTemplateId,
        documentId,
        nodeExecutionId,
        userId,
      });
      appliedTemplateId = pptResult.templateId ?? pptxTemplateId ?? null;
      buffer = pptResult.buffer;
      renderMode = pptResult.renderMode;
      warnings = pptResult.warnings;
      compositionSummary = pptResult.compositionSummary;
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
      outputData: {
        format,
        filename,
        storagePath,
        fileSize,
        ...(format === "pptx"
          ? {
              templateId: appliedTemplateId,
              renderMode,
              warnings,
              compositionSummary,
            }
          : {}),
      },
      updatedAt: now,
    })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return {
    filename,
    storagePath,
    fileSize,
    format,
    ...(format === "pptx"
      ? {
          templateId: appliedTemplateId,
          renderMode,
          warnings,
          compositionSummary,
        }
      : {}),
  };
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
