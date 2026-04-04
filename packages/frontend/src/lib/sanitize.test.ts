/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize.js";

describe("sanitizeHtml", () => {
  // Suite 1: Dangerous tags (script, iframe, etc.) are removed
  describe("removes dangerous tags", () => {
    it("removes script tags entirely", () => {
      expect(sanitizeHtml('<script>alert(1)</script>')).toBe("");
      expect(sanitizeHtml('<p>Hello</p><script>evil()</script>')).toBe("<p>Hello</p>");
    });

    it("removes iframe tags", () => {
      expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).toBe("");
    });

    it("removes object and embed tags", () => {
      expect(sanitizeHtml('<object data="evil.swf"></object>')).toBe("");
      expect(sanitizeHtml('<embed src="evil.pdf">')).toBe("");
    });

    it("removes svg with script inside", () => {
      const input = '<svg><script>alert(1)</script></svg>';
      expect(sanitizeHtml(input)).not.toContain("script");
    });
  });

  // Suite 2: Dangerous attributes (onerror, onclick, javascript:) are stripped
  describe("strips dangerous attributes", () => {
    it("removes onerror attributes from img tags", () => {
      // img is not in ALLOWED_TAGS (conservative markdown allowlist), so it's stripped entirely
      expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe("");
    });

    it("removes onclick attributes", () => {
      expect(sanitizeHtml('<div onclick="evil()">click</div>')).toBe("<div>click</div>");
    });

    it("removes onload attributes", () => {
      // body is not in ALLOWED_TAGS (conservative markdown allowlist), content is stripped
      expect(sanitizeHtml('<body onload="evil()">text</body>')).toBe("text");
    });

    it("strips javascript: href values from anchors", () => {
      expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe("<a>click</a>");
    });

    it("allows safe href values", () => {
      expect(sanitizeHtml('<a href="https://example.com">link</a>')).toBe('<a href="https://example.com">link</a>');
    });
  });

  // Suite 3: Safe HTML tags are preserved
  describe("preserves safe HTML tags", () => {
    it("preserves paragraph and inline formatting tags", () => {
      expect(sanitizeHtml("<p>Hello <strong>world</strong></p>")).toBe("<p>Hello <strong>world</strong></p>");
      expect(sanitizeHtml("<p>text <em>italic</em> here</p>")).toBe("<p>text <em>italic</em> here</p>");
      expect(sanitizeHtml("<p>code: <code>console.log()</code></p>")).toBe("<p>code: <code>console.log()</code></p>");
    });

    it("preserves heading tags", () => {
      expect(sanitizeHtml("<h1>Title</h1>")).toBe("<h1>Title</h1>");
      expect(sanitizeHtml("<h2>Section</h2>")).toBe("<h2>Section</h2>");
    });

    it("preserves list tags", () => {
      expect(sanitizeHtml("<ul><li>item 1</li><li>item 2</li></ul>")).toContain("<li>item 1</li>");
    });

    it("preserves blockquote", () => {
      expect(sanitizeHtml("<blockquote>quoted text</blockquote>")).toBe("<blockquote>quoted text</blockquote>");
    });

    it("preserves pre tags for code blocks", () => {
      expect(sanitizeHtml("<pre>const x = 1;</pre>")).toBe("<pre>const x = 1;</pre>");
    });

    it("preserves span with class attribute", () => {
      expect(sanitizeHtml('<span class="inline-code">text</span>')).toBe('<span class="inline-code">text</span>');
    });
  });
});
