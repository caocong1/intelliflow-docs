import { describe, expect, test } from "vitest";
import {
  buildSpecLockFromGenes,
  renderSpecLockAnchor,
  validateSpecLock,
} from "./spec-lock";
import type { StyleGenes, TemplateGenes } from "./types";

function makeGenes(): TemplateGenes {
  return {
    version: "template_genes/v1",
    source: { kind: "brief", brief: { version: "visual_brief/v1" } as never },
    summary: "Test fixture for spec_lock",
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
    },
  };
}

const FAKE_STYLE_GENES: StyleGenes = {
  version: "style_genes/v1",
  colorDna: "test",
  typographyDna: "test",
  shapeDna: "test",
  rhythmDna: "test",
};

describe("buildSpecLockFromGenes", () => {
  test("derives palette.allValues as union of distinct hex values", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    expect(lock.palette.allValues).toContain("#0E8B5A");
    expect(lock.palette.allValues).toContain("#FAFAF7");
    // FAFAF7 appears twice (neutrals + bg) — must be deduplicated
    expect(lock.palette.allValues.filter((v) => v === "#FAFAF7").length).toBe(1);
  });

  test("appends Microsoft YaHei to font stacks when missing", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    expect(lock.typography.titleStack).toContain('"Microsoft YaHei"');
    expect(lock.typography.bodyStack).toContain('"Microsoft YaHei"');
    expect(lock.typography.monoStack).toContain('"Microsoft YaHei"');
  });

  test("typography satisfies H1 (title >= 2x body) and H2 (body >= 16) by default", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    expect(lock.typography.titleSize).toBeGreaterThanOrEqual(lock.typography.bodySize * 2);
    expect(lock.typography.bodySize).toBeGreaterThanOrEqual(16);
  });

  test("defaults icon library to tabler-outline when brief absent", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    expect(lock.iconLibrary).toBe("tabler-outline");
    expect(lock.iconStrokeWidth).toBe(2);
  });

  test("brief overrides icon library and image lock when provided", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES, {
      version: "visual_brief/v1",
      deckTone: "tone",
      colorMode: "light",
      imageLanguage: "il",
      iconLanguage: "il",
      shapeLanguage: "sl",
      density: "medium",
      avoid: [],
      iconLibrary: "phosphor-duotone",
      iconStrokeWidth: 3,
      imageRendering: "3d-isometric",
      imagePalette: { dominantUsage: 0.7, supportingUsage: 0.2, accentUsage: 0.1 },
      imageTypes: { hero: "hero", background: "background" },
    });
    expect(lock.iconLibrary).toBe("phosphor-duotone");
    expect(lock.iconStrokeWidth).toBe(3);
    expect(lock.imageLock.rendering).toBe("3d-isometric");
    expect(lock.imageLock.palette.dominantUsage).toBe(0.7);
    expect(lock.imageLock.types.hero).toBe("hero");
  });

  test("image lock palette defaults sum to 1.0", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    const sum =
      lock.imageLock.palette.dominantUsage +
      lock.imageLock.palette.supportingUsage +
      lock.imageLock.palette.accentUsage;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });
});

describe("validateSpecLock", () => {
  test("passes on a builder-produced lock", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    expect(validateSpecLock(lock)).toEqual([]);
  });

  test("rejects invalid HEX values", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    lock.palette.primary = "0E8B5A"; // missing '#'
    const errors = validateSpecLock(lock);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("0E8B5A"))).toBe(true);
  });

  test("rejects when title < 2x body (H1)", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    lock.typography.titleSize = 30;
    lock.typography.bodySize = 20; // 30 < 40
    const errors = validateSpecLock(lock);
    expect(errors.some((e) => e.includes("H1"))).toBe(true);
  });

  test("rejects when body < 16pt (H2)", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    lock.typography.bodySize = 14;
    const errors = validateSpecLock(lock);
    expect(errors.some((e) => e.includes("H2"))).toBe(true);
  });

  test("rejects a font stack missing Windows-preinstalled fallback", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    lock.typography.titleStack = '"PingFang SC", "Helvetica Neue", -apple-system, serif';
    const errors = validateSpecLock(lock);
    expect(errors.some((e) => e.includes("titleStack"))).toBe(true);
  });

  test("rejects image-lock palette usages that don't sum to ~1.0", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    lock.imageLock.palette = {
      dominantUsage: 0.3,
      supportingUsage: 0.3,
      accentUsage: 0.3,
    };
    const errors = validateSpecLock(lock);
    expect(errors.some((e) => e.includes("imageLock.palette"))).toBe(true);
  });
});

describe("renderSpecLockAnchor", () => {
  test("renders a markdown block with palette HEX values", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES);
    const md = renderSpecLockAnchor(lock);
    expect(md).toContain("## Locked Design Contract");
    expect(md).toContain("#0E8B5A");
    expect(md).toContain("#0A6B45");
    expect(md).toContain("font-stack");
    expect(md).toContain("Icon library");
    expect(md).toContain("Hard constraints");
    expect(md).toContain("RE-ANCHOR");
  });

  test("includes per-slot image types when brief supplies them", () => {
    const lock = buildSpecLockFromGenes(makeGenes(), FAKE_STYLE_GENES, {
      version: "visual_brief/v1",
      deckTone: "t",
      colorMode: "c",
      imageLanguage: "i",
      iconLanguage: "i",
      shapeLanguage: "s",
      density: "low",
      avoid: [],
      imageTypes: { hero: "hero", framework: "framework" },
    });
    const md = renderSpecLockAnchor(lock);
    expect(md).toContain("hero → hero");
    expect(md).toContain("framework → framework");
  });
});
