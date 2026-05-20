import { describe, it, expect } from "vitest";
import { sanitizeFilename, assertWithinRoot } from "./sanitize.js";

describe("sanitizeFilename", () => {
  // Suite 1: Path traversal and null byte neutralization
  describe("neutralizes path traversal strings", () => {
    it("strips forward-slash path separators", () => {
      expect(sanitizeFilename("../etc/passwd")).toBe("etcpasswd");
      expect(sanitizeFilename("foo/bar/baz.txt")).toBe("foobarbaz.txt");
    });

    it("strips backslash path separators", () => {
      expect(sanitizeFilename("..\\etc\\passwd")).toBe("etcpasswd");
      expect(sanitizeFilename("foo\\bar\\baz.txt")).toBe("foobarbaz.txt");
    });

    it("strips null bytes", () => {
      expect(sanitizeFilename("file\x00name.txt")).toBe("filename.txt");
      expect(sanitizeFilename("\x00.txt")).toBe("txt");
      expect(sanitizeFilename("\x00\x00")).toBe("uploaded_file");
    });

    it("strips leading dots (prevents hidden files)", () => {
      expect(sanitizeFilename(".bashrc")).toBe("bashrc");
      expect(sanitizeFilename("...secret")).toBe("secret");
      expect(sanitizeFilename(".")).toBe("uploaded_file");
    });
  });

  // Suite 2: Normal filenames pass through
  describe("passes normal filenames through", () => {
    it("returns simple filenames unchanged (dots preserved)", () => {
      expect(sanitizeFilename("report.pdf")).toBe("report.pdf");
      expect(sanitizeFilename("document.docx")).toBe("document.docx");
    });

    it("replaces whitespace with underscores (dots preserved)", () => {
      expect(sanitizeFilename("my report.pdf")).toBe("my_report.pdf");
      expect(sanitizeFilename("  spaced out.txt")).toBe("_spaced_out.txt");
    });

    it("strips trailing dots", () => {
      expect(sanitizeFilename("file..")).toBe("file");
      expect(sanitizeFilename("...")).toBe("uploaded_file");
    });

    it("returns 'uploaded_file' for empty/whitespace input", () => {
      expect(sanitizeFilename("")).toBe("uploaded_file");
      expect(sanitizeFilename("   ")).toBe("uploaded_file");
    });
  });
});

describe("assertWithinRoot", () => {
  // Suite 3: assertWithinRoot throws on escape attempts
  describe("throws AppError on escape attempts", () => {
    it("throws on relative parent traversal (..)", () => {
      expect(() => assertWithinRoot("/data/exports", "../secrets/file")).toThrow();
    });

    it("throws on absolute path escape", () => {
      expect(() => assertWithinRoot("/data/exports", "/etc/passwd")).toThrow();
    });

    it("allows paths within root", () => {
      const result = assertWithinRoot("/data/exports", "doc.pdf");
      expect(result).toMatch(/\/data\/exports\/doc\.pdf$/);
    });

    it("allows absolute paths within root", () => {
      const result = assertWithinRoot("/data/exports", "/data/exports/doc.pdf");
      expect(result).toBe("/data/exports/doc.pdf");
    });

    it("allows persisted storage paths when root is relative", () => {
      const result = assertWithinRoot(
        "./data/workspaces/exports/doc-1",
        "data/workspaces/exports/doc-1/deck.pptx",
      );
      expect(result).toMatch(/\/data\/workspaces\/exports\/doc-1\/deck\.pptx$/);
    });
  });
});
