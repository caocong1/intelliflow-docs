/**
 * rewrite-with-llm.ts
 *
 * When a fill-plan assignment exceeds its slot's maxWidthUnits / maxLines,
 * the preserve builder calls into this module to ask an LLM to shorten
 * the content while preserving meaning and tone. Returns the rewritten
 * value or paragraphs, which the caller then re-validates.
 *
 * Reuses `ai-pipeline/claude-client.ts` (OpenAI-compatible under the hood
 * via 火山方舟 / Anthropic endpoints — see claude-client.ts header).
 *
 * TODO(Phase 2): add font-size shrink fallback. When rewrite fails to
 * fit after N retries, reduce font size down to per-slot minFontPt
 * before giving up.
 */
import { callClaude, extractJson } from "../ai-pipeline/claude-client";
import { widthUnits } from "./text-width";

export type RewriteInput = {
  slotId: string;
  slotType: string;
  maxWidthUnits: number;
  maxLines: number;
  originalValue?: string;
  originalParagraphs?: Array<{ text: string; bold?: boolean; [k: string]: unknown }>;
};

export type RewriteOutput = {
  value?: string;
  paragraphs?: Array<{ text: string }>;
};

function describeWidth(str: string): string {
  return `${str} (widthUnits=${widthUnits(str)})`;
}

function buildPrompt(input: RewriteInput): string {
  const orig = input.originalValue
    ? describeWidth(input.originalValue)
    : (input.originalParagraphs ?? [])
        .map((p, i) => `  [${i + 1}] ${describeWidth(p.text)}`)
        .join("\n");

  const outputSpec =
    input.maxLines === 1
      ? `{"value": "<shortened string>"}`
      : `{"paragraphs": [{"text": "<line 1>"}, ...up to ${input.maxLines} entries]}`;

  return [
    "你是一个中文内容压缩助手。把下面这段 PPT 槽位文本改写得更短，以适配模板的宽度/行数限制，同时保留核心意思和语气。",
    "",
    `槽位类型: ${input.slotType} (slotId=${input.slotId})`,
    `硬约束:`,
    `  - maxWidthUnits = ${input.maxWidthUnits} (CJK 字符算 2 单位, ASCII 字符算 1 单位, 每行长度不得超过)`,
    `  - maxLines = ${input.maxLines}`,
    "",
    "原文:",
    input.originalValue ? `  ${orig}` : orig,
    "",
    "请重写，确保：",
    "1. 每行 widthUnits 不超过 maxWidthUnits",
    "2. 总行数不超过 maxLines",
    "3. 信息密度尽量高，删除修饰、保留主干",
    "4. 语言与原文一致（原文中文则输出中文，原文英文则输出英文）",
    "",
    `只输出 JSON，格式: ${outputSpec}`,
  ].join("\n");
}

export async function rewriteToFit(
  input: RewriteInput,
  opts: { mockResponse?: string; mock?: boolean } = {},
): Promise<RewriteOutput> {
  const prompt = buildPrompt(input);
  const { content } = await callClaude({
    prompt,
    maxTokens: 400,
    temperature: 0.2,
    mockResponse: opts.mockResponse,
    mock: opts.mock,
  });
  const parsed = extractJson<RewriteOutput>(content);
  if (
    (parsed.value === undefined || parsed.value === null) &&
    (!parsed.paragraphs || parsed.paragraphs.length === 0)
  ) {
    throw new Error(
      `LLM rewrite for slot "${input.slotId}" returned neither value nor paragraphs: ${content.slice(0, 200)}`,
    );
  }
  return parsed;
}
