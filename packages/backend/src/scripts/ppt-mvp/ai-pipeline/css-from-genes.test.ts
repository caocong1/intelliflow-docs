import { describe, expect, test } from "vitest";
import { generateDesignSystemCss } from "./css-from-genes";
import type { TemplateGenes } from "./types";

function makeGenes(overrides: Partial<TemplateGenes["designTokens"]> = {}): TemplateGenes {
  return {
    version: "template_genes/v1",
    source: { kind: "brief", brief: { version: "visual_brief/v1" } as never },
    summary: "Test fixture",
    designTokens: {
      colors: {
        primary: "#0E8B5A",
        secondary: "#0A6B45",
        accents: ["#DCEFE5", "#C56B2C"],
        neutral: ["#FAFAF7", "#F1F5F2", "#0F1B17", "#6B7570"],
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
      ...overrides,
    },
  };
}

describe("generateDesignSystemCss", () => {
  test("substitutes color tokens into the :root block", () => {
    const css = generateDesignSystemCss(makeGenes());
    expect(css).toContain("--primary: #0E8B5A");
    expect(css).toContain("--secondary: #0A6B45");
    expect(css).toContain("--accent-1: #DCEFE5");
    expect(css).toContain("--accent-2: #C56B2C");
    expect(css).toContain("--bg-page: #FAFAF7");
    expect(css).toContain("--ink-display: #0F1B17");
    expect(css).toContain("--ink-mute: #6B7570");
  });

  test("includes both EA and Latin fonts in font-family declarations", () => {
    const css = generateDesignSystemCss(makeGenes());
    expect(css).toContain('"Source Han Serif SC"');
    expect(css).toContain('"PingFang SC"');
    expect(css).toContain('"JetBrains Mono"');
  });

  test("includes rhythm padding values from genes", () => {
    const css = generateDesignSystemCss(makeGenes());
    expect(css).toContain("--pad-page-x: 88px");
    expect(css).toContain("--pad-page-y: 64px");
  });

  test("emits .slide rule with 1920x1080 dimensions", () => {
    const css = generateDesignSystemCss(makeGenes());
    expect(css).toMatch(/\.slide\s*\{[^}]*width:\s*1920px/s);
    expect(css).toMatch(/\.slide\s*\{[^}]*height:\s*1080px/s);
  });

  test("changes when colors change (regression for caching bugs)", () => {
    const cssA = generateDesignSystemCss(makeGenes());
    const cssB = generateDesignSystemCss(
      makeGenes({
        colors: {
          primary: "#2A5BAA",
          secondary: "#91CF50",
          accents: ["#16A1C8"],
          neutral: ["#FFFFFF", "#F4F6FA", "#0F1B33", "#5C6373"],
          bg: "#FFFFFF",
          surface: "#F4F6FA",
          text: "#0F1B33",
          textMuted: "#5C6373",
        },
      }),
    );
    expect(cssA).not.toBe(cssB);
    expect(cssB).toContain("--primary: #2A5BAA");
    expect(cssB).toContain("--bg-page: #FFFFFF");
  });

  test("annotates source kind in the header comment", () => {
    const fromBrief = generateDesignSystemCss(makeGenes());
    expect(fromBrief).toContain("Source: visual brief");

    const fromIngest = generateDesignSystemCss({
      ...makeGenes(),
      source: { kind: "ingested_template", templateJsonPath: "/some/path.json" },
    });
    expect(fromIngest).toContain("ingested template");
    expect(fromIngest).toContain("/some/path.json");
  });
});
