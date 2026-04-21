/**
 * Markdown → html_fidelity_deck/v1 adapter.
 *
 * Phase 4 of the html-line consolidation plan. Lets callers feed raw
 * markdown (or any prose outline) to the HTML-fidelity pipeline without
 * having to pre-structure it as html_fidelity_deck/v1 JSON.
 *
 * Implementation strategy: a single LLM call that uses the
 * `outline-to-deck.prompt.md` system instruction to compose the deck.
 * The rule-based path (markdownToSlides → templateByArchetype mapping)
 * is left for a future phase — the LLM path is good enough for now and
 * reuses prompt coverage we already validated.
 *
 * The adapter is NOT wired into export.service's dispatch yet; that
 * happens in Phase 5 when we flip the default renderer.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callClaude, extractJson } from "../../scripts/ppt-mvp/ai-pipeline/claude-client";
import { ensureLiveClaudeEnvFromDb } from "../../scripts/ppt-mvp/ai-pipeline/live-config";
import {
  parseHtmlFidelityDeckContent,
  type HtmlFidelityDeck,
} from "./html-editable-adapter";

const MODULE_DIR = typeof __dirname !== "undefined"
  ? __dirname
  : resolve(fileURLToPath(import.meta.url), "..");

const DEFAULT_TEMPLATE_ID = "622eee2ab7e6e";

function resolvePromptPath(templateId: string): string {
  return resolve(
    MODULE_DIR,
    "../../../../../docs/design/ppt-mvp/html-styles",
    templateId,
    "outline-to-deck.prompt.md",
  );
}

export type MarkdownToDeckArgs = {
  markdown: string;
  templateId?: string;
  /** Override the prompt file path (advanced / tests). */
  promptPath?: string;
  /** Override for the live LLM model. Defaults to whatever ensureLiveClaudeEnvFromDb picks. */
  preferredModelId?: string | null;
  /** Deterministic tests: if set, use this string as the LLM response instead of calling live. */
  mockResponse?: string;
  /** Max response tokens; bigger decks may need more. */
  maxTokens?: number;
};

/**
 * Compose an HTML-fidelity deck from a markdown / outline string.
 *
 * Throws if the LLM output fails to parse as `html_fidelity_deck/v1`.
 * Callers should pair this with `renderHtmlFidelityDeckToBuffer` to
 * turn the result into an editable .pptx buffer.
 */
export async function markdownToHtmlFidelityDeck(
  args: MarkdownToDeckArgs,
): Promise<HtmlFidelityDeck> {
  const templateId = args.templateId ?? DEFAULT_TEMPLATE_ID;
  const promptPath = args.promptPath ?? resolvePromptPath(templateId);
  const systemPrompt = readFileSync(promptPath, "utf8");
  const isLive = args.mockResponse === undefined;

  if (isLive) {
    await ensureLiveClaudeEnvFromDb({ preferredModelId: args.preferredModelId ?? null });
  }

  const response = await callClaude({
    prompt: `${systemPrompt}\n\n---\n\n## 现在请处理以下大纲\n\n${args.markdown}`,
    maxTokens: args.maxTokens ?? 3000,
    temperature: 0.3,
    mockResponse: args.mockResponse,
    mock: !isLive,
  });

  const parsed = extractJson(response.content);
  const deck = parseHtmlFidelityDeckContent(parsed);
  if (!deck) {
    throw new Error(
      `markdownToHtmlFidelityDeck: LLM output did not parse as html_fidelity_deck/v1. ` +
        `Raw: ${response.content.slice(0, 500)}`,
    );
  }
  if (deck.templateId !== templateId) {
    // Keep the adapter honest — the LLM occasionally echoes back a
    // different templateId. We force the caller-requested one so the
    // downstream renderer resolves the right HTML files.
    deck.templateId = templateId;
  }
  return deck;
}
