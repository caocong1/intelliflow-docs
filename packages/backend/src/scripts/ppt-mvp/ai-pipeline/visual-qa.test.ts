import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildSpecLockFromGenes } from "./spec-lock";
import type { RenderedPage, SpecLock, StyleGenes, TemplateGenes } from "./types";
import { runVisualQa } from "./visual-qa";

function makeGenes(): TemplateGenes {
  return {
    version: "template_genes/v1",
    source: { kind: "brief", brief: { version: "visual_brief/v1" } as never },
    summary: "QA fixture",
    designTokens: {
      colors: {
        primary: "#0E8B5A",
        secondary: "#0A6B45",
        accents: ["#DCEFE5"],
        neutral: ["#FAFAF7", "#0F1B17", "#6B7570"],
        bg: "#FAFAF7",
        surface: "#FFFFFF",
        text: "#0F1B17",
        textMuted: "#6B7570",
      },
      fonts: {
        titleLatin: "Source Han Serif SC",
        titleEa: "Source Han Serif SC",
        bodyLatin: "PingFang SC",
        bodyEa: "PingFang SC",
        mono: "JetBrains Mono",
      },
      rhythm: {
        density: "medium",
        pagePadding: { x: 88, y: 64 },
        preferredLayoutGrammar: "asymmetric_editorial",
      },
    },
  };
}

const FAKE_STYLE_GENES: StyleGenes = {
  version: "style_genes/v1",
  colorDna: "",
  typographyDna: "",
  shapeDna: "",
  rhythmDna: "",
};

describe("runVisualQa — detector (Track B)", () => {
  let sessionDir: string;
  let specLock: SpecLock;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), "qa-test-"));
    specLock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  async function writePage(pageId: string, html: string): Promise<RenderedPage> {
    const path = join(sessionDir, `${pageId}.html`);
    await writeFile(path, html);
    return {
      pageId,
      pageType: "cover",
      htmlPath: path,
      speakerNote: "",
      retryCount: 0,
    };
  }

  test("detects HEX colour drift relative to spec_lock palette", async () => {
    const page = await writePage(
      "p1",
      '<div style="background:#0E8B5A; border:1px solid #FF00FF">x</div>',
    );
    const result = await runVisualQa([page], specLock, { detectorOnly: true });
    expect(result.detector.colorDrift.map((d) => d.foundHex)).toEqual(["#FF00FF"]);
    expect(result.passed).toBe(true); // detector-only path without subagent flips passed=true even with drift (no high severity)
  });

  test("detects font-family drift", async () => {
    const page = await writePage(
      "p1",
      '<style>.a { font-family: "Comic Sans MS", sans-serif; }</style><div class="a">x</div>',
    );
    const result = await runVisualQa([page], specLock, { detectorOnly: true });
    const drift = result.detector.fontDrift.map((d) => d.foundFamily);
    expect(drift).toContain("Comic Sans MS");
  });

  test("detects banned features (tailwind text-xs, opacity:0, iframe, vw font)", async () => {
    const page = await writePage(
      "banned",
      [
        '<div class="text-xs">tiny</div>',
        '<div style="opacity: 0;">x</div>',
        "<iframe></iframe>",
        '<div style="font-size: 5vw;">x</div>',
      ].join(""),
    );
    const result = await runVisualQa([page], specLock, { detectorOnly: true });
    const patterns = result.detector.bannedFeatures.map((b) => b.pattern);
    expect(patterns.length).toBeGreaterThanOrEqual(4);
    expect(result.needsRegenerate).toContain("banned");
    expect(result.passed).toBe(false);
  });

  test("detects placeholder residue (lorem / xxxx / [insert ...])", async () => {
    const page = await writePage("p1", "<p>lorem ipsum dolor</p><p>xxxx</p><p>[INSERT title here]</p>");
    const result = await runVisualQa([page], specLock, { detectorOnly: true });
    expect(result.detector.placeholderResidue.length).toBeGreaterThanOrEqual(2);
    expect(result.needsRegenerate).toContain("p1");
    expect(result.passed).toBe(false);
  });

  test("skips fallback pages from detector scan", async () => {
    const path = join(sessionDir, "p1.html");
    await writeFile(path, '<p>lorem ipsum — placeholder fallback content</p>');
    const result = await runVisualQa(
      [
        {
          pageId: "p1",
          pageType: "cover",
          htmlPath: path,
          speakerNote: "",
          retryCount: 2,
          fallback: true,
        },
      ],
      specLock,
      { detectorOnly: true },
    );
    expect(result.detector.placeholderResidue.length).toBe(0);
  });
});

describe("runVisualQa — subagent (Track A)", () => {
  let sessionDir: string;
  let specLock: SpecLock;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), "qa-subagent-test-"));
    specLock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  test("incorporates mocked subagent JSON into result", async () => {
    const path = join(sessionDir, "p1.html");
    await writeFile(path, "<div>clean slide content</div>");
    const page: RenderedPage = {
      pageId: "p1",
      pageType: "cover",
      htmlPath: path,
      speakerNote: "",
      retryCount: 0,
    };

    const mockResp = `\`\`\`json
{
  "scores": {
    "goal_clarity": 8, "story_structure": 8, "slide_assertions": 7,
    "evidence_quality": 8, "chart_fit": 9, "visual_and_accessibility": 9,
    "coherence_and_transitions": 8, "speakability": 8,
    "deliverables_complete": 7, "robustness": 6
  },
  "total": 78,
  "passed": true,
  "weakestDimensions": ["robustness", "slide_assertions", "deliverables_complete"],
  "violations": []
}
\`\`\``;
    const result = await runVisualQa([page], specLock, {
      mockProvider: (key) => (key === "qa:subagent" ? mockResp : undefined),
      forceMock: true,
    });
    expect(result.subagent?.total).toBe(78);
    expect(result.subagent?.passed).toBe(true);
    expect(result.subagent?.weakestDimensions).toContain("robustness");
    expect(result.passed).toBe(true);
  });

  test("marks all non-fallback pages for regen when subagent fails the deck", async () => {
    const a = join(sessionDir, "a.html");
    const b = join(sessionDir, "b.html");
    await writeFile(a, "<div>page A</div>");
    await writeFile(b, "<div>page B</div>");
    const pages: RenderedPage[] = [
      { pageId: "a", pageType: "cover", htmlPath: a, speakerNote: "", retryCount: 0 },
      { pageId: "b", pageType: "toc", htmlPath: b, speakerNote: "", retryCount: 0, fallback: true },
    ];

    const mockResp = `\`\`\`json
{
  "scores": {
    "goal_clarity": 5, "story_structure": 5, "slide_assertions": 5,
    "evidence_quality": 5, "chart_fit": 5, "visual_and_accessibility": 4,
    "coherence_and_transitions": 4, "speakability": 5,
    "deliverables_complete": 5, "robustness": 5
  },
  "total": 48,
  "passed": false,
  "weakestDimensions": ["visual_and_accessibility", "coherence_and_transitions"],
  "violations": []
}
\`\`\``;
    const result = await runVisualQa(pages, specLock, {
      mockProvider: (key) => (key === "qa:subagent" ? mockResp : undefined),
      forceMock: true,
    });
    expect(result.subagent?.passed).toBe(false);
    expect(result.needsRegenerate).toEqual(["a"]); // 'b' is fallback so excluded
    expect(result.passed).toBe(false);
  });

  test("falls back gracefully when subagent response is unparseable", async () => {
    const path = join(sessionDir, "p1.html");
    await writeFile(path, "<div>x</div>");
    const result = await runVisualQa(
      [{ pageId: "p1", pageType: "cover", htmlPath: path, speakerNote: "", retryCount: 0 }],
      specLock,
      {
        mockProvider: (key) => (key === "qa:subagent" ? "not valid json at all" : undefined),
        forceMock: true,
      },
    );
    expect(result.subagent).toBeNull();
    // Without subagent, detector with empty findings => passed = true
    expect(result.passed).toBe(true);
  });
});
