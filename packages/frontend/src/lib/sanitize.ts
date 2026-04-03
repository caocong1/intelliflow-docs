/**
 * @fileoverview XSS defense: sanitization utility using DOMPurify.
 * Sanitize untrusted HTML by removing dangerous tags (script, iframe, etc.),
 * attributes (onerror, onclick, javascript: href), and SVG/MathML content.
 * Uses a conservative allowlist of markdown-friendly tags and safe attributes.
 * @module lib/sanitize
 */

import DOMPurify from "dompurify";

// DOMPurify is a factory — call it to get an instance with sanitize(), setConfig(), etc.
const purify = DOMPurify();

/**
 * Conservative allowlist of markdown-friendly HTML tags.
 * Covers all tags used in render-markdown.tsx, InlineEditor.tsx,
 * PromptEditor.tsx (via buildEditorHTML), and ExportExecutor.tsx.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "span", "div",
  "blockquote", "hr",
];

/**
 * Conservative allowlist of safe attributes.
 * Covers all attributes used in render-markdown.tsx (inlineFormat class),
 * PromptEditor.tsx (data-var, title, class), and other components.
 */
const ALLOWED_ATTR = [
  "href", "title", "class", "data-var",
];

// Configure DOMPurify with the conservative allowlist once at module load.
// RETURN_TRUSTED_TYPE: false returns plain strings (not TrustedHTML),
// compatible with SolidJS innerHTML prop.
purify.setConfig({
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
});

/**
 * Sanitize untrusted HTML by stripping dangerous tags, attributes, and protocols.
 *
 * @param html - Raw HTML string potentially containing XSS payloads
 * @returns Sanitized HTML string safe for innerHTML injection
 *
 * @example
 * // Strips script tags, event handlers, and javascript: URLs
 * sanitize('<script>alert(1)</script>')  // returns ''
 * sanitize('<p>Hello <strong>world</strong></p>')  // returns unchanged
 * sanitize('<span data-var="node1.output">text</span>')  // preserves data-var
 * sanitize('<a href="javascript:alert(1)">click</a>')  // strips href value
 */
export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, { RETURN_TRUSTED_TYPE: false });
}
