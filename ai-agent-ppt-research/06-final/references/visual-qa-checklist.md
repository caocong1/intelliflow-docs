# Visual QA Subagent Checklist

> 11 items, **must run as a separate subagent** (not the same LLM that authored the page). Verbatim from anthropics/pptx + AionUi Gate 5b + adapted for image-backed renders.

---

## Subagent Prompt Template

Copy-paste this entire block as the visual QA subagent's user prompt:

```
You are a visual QA reviewer for a slide deck. Your job is to
inspect each rendered slide PNG and find problems — not confirm
they look fine.

**Mindset**: "Assume there are problems. Your first inspection
is almost never correct. Approach QA as a bug hunt, not a
confirmation step. If you found zero issues on first inspection,
you weren't looking hard enough." (anthropics/pptx)

You receive:
1. Rendered PNG of each slide (1920×1080 or 1280×720)
2. spec_lock.json (the deck's locked design contract)
3. The 11-item checklist below

For each slide, output:
{
  "slide_id": "p1",
  "violations": [
    { "item": 1, "severity": "high|medium|low", "what": "<observation>", "where": "<region>" },
    ...
  ],
  "score": 0-10,
  "needs_regenerate": true|false  // true if score < 7
}

Be specific. "Title overlaps icon at top-right corner, ~50px overlap" — not "alignment looks off".

If you find zero violations, IGNORE that finding and look again,
more critically. Zero-violation slides are extremely rare in
first inspection. Common things you might miss on first pass:
overlapping decoration with text, sub-WCAG contrast on the
muted text color, missing visual element in a content slide,
inconsistent margin between slides.
```

---

## 11-Item Checklist

| # | Check | What to look for | Severity |
|---|---|---|---|
| 1 | **Overlapping elements** | Text crossing shapes, lines crossing text, icons overlapping titles | High |
| 2 | **Text overflow / cut off** | Words clipped at slide edge, ellipsis where there shouldn't be, text running outside its container | High |
| 3 | **Decoration positioned for single-line but title wrapped** | Underline / accent block sized for 1 line of title, but title became 2 lines — leftover decoration looks broken | Medium |
| 4 | **Source citations / footers colliding** | Footer text colliding with body content, page number overlapping bottom-right corner element | Medium |
| 5 | **Elements too close** | Gaps < 0.3 inches (≈ 20px at 1920px width) between adjacent elements — feels cramped | Medium |
| 6 | **Uneven gaps** | One area sparse, another crowded — broken rhythm. Check column gaps, card spacing | Medium |
| 7 | **Insufficient margin from slide edges** | Content within 0.5 inches (≈ 30px at 1920px) of slide edge — visually unsafe | High |
| 8 | **Columns not aligned consistently** | Left column starts at x=80px, right at x=85px — drifted | Low |
| 9 | **Low-contrast text / icons** | Compute relative luminance contrast between text and bg — flag if < WCAG AA (4.5:1 for body, 3:1 for headings/icons) | High |
| 10 | **Text boxes too narrow → over-wrapping** | 8-word headline wrapped into 4 lines because text box is too narrow | Medium |
| 11 | **Leftover placeholder content** | `xxxx`, `lorem`, `ipsum`, `[insert ...]`, `<TODO>`, "this slide layout" — any residue from templates or AI failure to fill | High |

---

## Scoring Rubric (per slide, 0-10)

- **10**: Zero violations across all 11 items. Layout impeccable, contrast clean, no AI-tells.
- **8-9**: 1 low-severity violation OR aesthetic critique only (not bug).
- **6-7**: 1 medium-severity violation OR ≤ 3 low-severity violations.
- **4-5**: 1 high-severity violation OR ≥ 2 medium-severity violations. **regenerate**.
- **0-3**: ≥ 2 high-severity violations OR catastrophic failure (blank, broken). **regenerate immediately**.

Threshold to ship: **score >= 7 on every slide** AND deck-average >= 8.

---

## Detector Script Companion (Track B — anthropic-style + impeccable/critique)

Some checks are deterministic and should run in JS/Python detector script BEFORE invoking the LLM subagent. These are **cheaper and more reliable** than LLM eyes:

```typescript
// scripts/visual-qa-detector.ts
function detect(pngPath, htmlPath, specLockPath) {
  return {
    // From HTML AST:
    placeholderResidue: /xxxx|lorem|ipsum|\[.*?\]|<TODO>/i.test(html),
    bannedClasses: /\b(text-xs|text-sm|opacity-0|visibility-hidden)\b/.test(html),
    visualElementPresent: /<img|<svg|background-image|class="[^"]*(icon-circle|colored-block|large-stat|chart-frame)/.test(html),

    // From color drift:
    colorDrift: extractAllHexColors(html).filter(c => !specLock.palette.allValues.includes(c)),
    fontDrift: extractFontFamilies(html).filter(f => !specLock.typography.allStacks.includes(f)),

    // From rendered PNG:
    contrastFails: scanContrast(png).filter(r => r.ratio < 4.5),
    contentOutsideMargin: scanContentBBox(png).filter(b => b.outsideSafeArea),
  };
}
```

Failures from this script → automatic retry with structured error feedback (don't even invoke LLM QA for these).

---

## Common LLM-QA Blind Spots (from anthropics/pptx)

LLMs reviewing their own deck:
- See what they expect, not what's there
- Tend to confirm-bias toward "looks fine"
- Miss low-luminance text on dark bg (because they "know" what they wrote)
- Miss off-by-30px alignment because slide layout is "intent" not "pixels"

**Mitigation**:
1. Use a DIFFERENT model/subagent than the generator (`subagent_type: "general-purpose"`, fresh context).
2. Give it the spec_lock so it can detect drift (not just aesthetic).
3. Require it to find ≥ 1 issue per slide on first pass, even if minor. Better to over-flag than under-flag.

---

## Fix-and-Verify Cycle (mandatory)

> "Do not declare success until you've completed at least one fix-and-verify cycle." (anthropics/pptx)

Flow:
1. Generate → render → QA pass 1 → list issues
2. If any high-severity: regenerate affected slides
3. Re-render → QA pass 2 → verify fixes + look for new issues introduced by fix
4. Repeat up to 2 iterations
5. If still failing after 2 iterations: report to user with screenshots and explicit "cannot reach quality threshold" message (do NOT silently ship)

---

## Citation

This checklist is verbatim or near-verbatim from:
- anthropics/skills/pptx — items 1-9, 11, mindset paragraph
- AionUi Gate 5b (morph-ppt) — items 4, 5, 6
- impeccable/critique — Track B detector pattern + Independence rule
- daymade/ppt-creator — rubric structure + threshold concept
