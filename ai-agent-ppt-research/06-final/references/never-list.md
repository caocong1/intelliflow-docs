# NEVER-list — Anti-Patterns to Avoid

> Verbatim or near-verbatim from anthropics/skills/pptx, iOfficeAI/AionUi officecli-pptx, design-taste-frontend, oh-my-ppt CANVAS_CONSTRAINTS. **Every Layer 4 prompt MUST quote this list.**

---

## Visual / Aesthetic

1. **NEVER use accent lines under titles** — chief AI-generation tell. anthropics/pptx: "these are a hallmark of AI-generated slides."
2. **NEVER default to blue** — LILA BAN: also forbid purple-to-blue AI gradients (design-taste-frontend). If unsure of color, use one of the 10 curated palettes verbatim.
3. **NEVER center body text** — only headlines / hero text get center alignment.
4. **NEVER create text-only content slides** — every content slide needs at least one non-text visual (icon-in-circle / colored-block / large-stat / chart / shape composition / hero image / diagram). Exceptions: section-break, closing, quote slides.
5. **NEVER use 4+ colors in body content** — color economy: 1 primary (60-70%) + 1 secondary (20-30%) + 1 accent (10%).
6. **NEVER use hero photo + white-text overlay** — generic AI aesthetic. If hero image needed, use editorial composition (asymmetric, text bites into image edge, not floating overlay).
7. **NEVER include emoji as decoration** — use Unicode geometric shapes / icon library glyphs instead.
8. **NEVER mix icon libraries within a deck** — pick one of `tabler-outline | tabler-filled | chunk-filled | phosphor-duotone` and lock it. Brand-logo exception via `simple-icons` only for real brand marks.
9. **NEVER use generic 4×2 card walls for TOC** — use hierarchy: 1 featured wide card + 2 medium + 5 compact (anthropics + AionUi).
10. **NEVER use rainbow gradients** — anthropics/pptx explicit ban.

## Typography

11. **NEVER use font sizes < 16pt** for body text. Chart axis labels ≤ 12pt, sublabels ≤ 14pt (≤ 5 words max), footnotes only.
12. **NEVER use font sizes 6xl/7xl/8xl in HTML templates** — h1 must be text-4xl or text-5xl (oh-my-ppt rule).
13. **NEVER use vw / vh font units** — they break PPT export. Use px or rem only.
14. **NEVER omit Windows-preinstalled fallback** in font stacks. Every stack MUST end with one of: Microsoft YaHei / SimHei / SimSun / Arial / Calibri / Segoe UI / Times New Roman / Consolas.
15. **NEVER use 'Helvetica Neue' / 'PingFang SC' as the only font** — these are Mac-only and break on Windows. Always pair with Microsoft YaHei as fallback.

## Layout

16. **NEVER repeat the same layoutArchetype on consecutive slides** — Variance Mandate (high-end-visual-design).
17. **NEVER fill every pixel** — macro padding py-24 ~ py-40; ≥ 40% whitespace baseline.
18. **NEVER use opacity:0 or visibility:hidden as initial state** — breaks PNG snapshot capture. Use PPT.animate target instead.
19. **NEVER use display:none in slide content** — same reason.
20. **NEVER use iframe in slide HTML**.
21. **NEVER nest more than 4 levels deep in slide HTML** — oh-my-ppt rule, prevents tag-closure failures.

## Color / Contrast

22. **NEVER use mid-gray or muted colors as body text on dark backgrounds** — when slide background luminance < 30%, body text MUST be white or near-white (luminance > 80%). H6 rule.
23. **NEVER violate WCAG AA contrast** — text vs background ≥ 4.5:1; UI elements ≥ 3:1.
24. **NEVER auto-adjust user-provided / template-locked colors** — PPT Master: "user/template colors are truth."

## Structure / Process

25. **NEVER omit the spec_lock anchor at the start of Layer 4 prompts** — each page must re-anchor on spec_lock.json values, no memory or invention.
26. **NEVER fall back to placeholder slide without explicit failure logging** — raise an error to user instead. Silent placeholders mask quality issues.
27. **NEVER batch-generate SVG/HTML via script** — PPT Master rule #9: "cross-page visual consistency depends on per-page authoring with full upstream context, which a generator script cannot reproduce."
28. **NEVER skip the visual QA loop** — anthropics/pptx: "Do not declare success until you've completed at least one fix-and-verify cycle."

## OOXML / Export

29. **NEVER use '#' prefix with hex colors in pptxgenjs** — corrupts file.
30. **NEVER use 8-character hex for opacity in pptxgenjs** — use opacity option separately.
31. **NEVER reuse the same options object across multiple pptxgenjs calls** — it mutates in-place (e.g., shadow EMU conversion), corrupts second shape.
32. **NEVER use `xml.etree.ElementTree` for PPTX XML** — corrupts namespaces. Use `defusedxml.minidom`.

---

## How to use this list

In the Layer 4 system prompt, include verbatim:

```
## NEVER-list (any violation = retry)
{paste this file's items #1-#32 here}

These bans take precedence over visual ambition. If a user
requirement conflicts with this list, surface the conflict and
ask, do NOT silently override.
```

In the visual QA subagent prompt, include items 1-15 as a check:

```
Inspect each rendered slide for violations of the NEVER-list
(items 1-15 — visual/typography). List any violations with
slide-N: <item-#>: <what you observed>. Be ruthless.
```
