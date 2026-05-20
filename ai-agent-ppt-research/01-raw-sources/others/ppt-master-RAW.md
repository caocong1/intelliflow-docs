# PPT Master — Raw Source Capture

Source repository: https://github.com/hugohe3/ppt-master
Author: Hugo He (CPA / CPV / Consulting Engineer)
License: MIT
Stars: ~18.9k, Forks: ~1.8k. 5 releases, latest v2.7.0 (May 2026), 623 commits.
Languages: Python 91.2% / HTML 4.4% / JavaScript 3.5% / CSS 0.9%.

Distribution channels: GitHub clone, ZIP download, `npx skills add hugohe3/ppt-master`, Claude Code marketplace `/plugin install ppt-master`.

---

## 1. Core thesis (verbatim)

> "Drop in a PDF, DOCX, URL, or Markdown — get back a **natively editable PowerPoint** with real shapes, real text boxes, and real charts. Not images. Click anything and edit it."

> "**PPT Master is a harness, not a complete agent.** `harness + model = agent` — the tool owns the workflow; the model sets the ceiling. To form a genuinely high-quality agent, use **Claude with a large context window (~1M tokens) + AI image generation (`gpt-image-2`)**. Other models can run the pipeline but cannot reach the same quality ceiling."

Four categories of AI presentation tools (PPT Master only does the last one):

| Category | Output | Editable element-by-element in PowerPoint? |
|---|---|:---:|
| Template fill-in | PPTX built from a fixed template | Partially — limited by the template |
| Image-based | One large image per slide, packed into PPTX | NO — each slide is a picture |
| HTML presentation | Web-based deck | NO — not a PPTX |
| **Native editable (PPT Master)** | **Real DrawingML shapes, text boxes, charts** | YES — click any element to edit |

---

## 2. Skill operating model

PPT Master operates as a **workflow skill** loaded inside agent harnesses:
- IDE-native agents: Cursor, VS Code (Copilot), Codebuddy IDE, Windsurf, Void, Zed
- IDE plugins / extensions: Claude Code (VS Code / JetBrains), Cline, Continue, Roo Code, GitHub Copilot
- CLI agents: Claude Code CLI, Codex CLI, Aider, Gemini CLI

The repo ships `skills/ppt-master/SKILL.md` as the authoritative workflow definition.

---

## 3. Repo structure (verbatim)

```
ppt-master/
├── skills/ppt-master/
│   ├── SKILL.md
│   ├── scripts/
│   │   ├── source_to_md/{pdf_to_md.py, doc_to_md.py, excel_to_md.py, ppt_to_md.py, web_to_md.py}
│   │   ├── project_manager.py
│   │   ├── analyze_images.py
│   │   ├── image_gen.py
│   │   ├── image_search.py
│   │   ├── svg_quality_checker.py
│   │   ├── total_md_split.py
│   │   ├── finalize_svg.py
│   │   ├── svg_to_pptx.py
│   │   ├── update_spec.py
│   │   ├── svg_editor/server.py (live preview at :5050)
│   │   ├── animation_config.py
│   │   └── update_repo.py
│   ├── references/
│   │   ├── strategist.md
│   │   ├── executor-base.md
│   │   ├── executor-general.md
│   │   ├── executor-consultant.md
│   │   ├── executor-consultant-top.md
│   │   ├── shared-standards.md
│   │   ├── canvas-formats.md
│   │   ├── animations.md
│   │   ├── image-base.md
│   │   ├── image-generator.md
│   │   ├── image-searcher.md
│   │   └── image-layout-patterns.md
│   ├── templates/
│   │   ├── layouts/layouts_index.json
│   │   ├── brands/brands_index.json
│   │   ├── charts/charts_index.json
│   │   ├── icons/<library>/
│   │   ├── design_spec_reference.md
│   │   └── spec_lock_reference.md
│   └── workflows/
│       ├── topic-research.md
│       ├── create-template.md
│       ├── create-brand.md
│       ├── resume-execute.md
│       ├── verify-charts.md
│       ├── customize-animations.md
│       ├── live-preview.md
│       └── generate-audio.md
├── projects/                  # user workspace
├── examples/                  # 17 sample projects, 229 pages
├── docs/{faq, templates-guide, audio-narration, technical-design, windows-installation}.md
├── .claude-plugin/marketplace.json
├── requirements.txt
└── index.html / viewer.html
```

---

## 4. Pipeline overview (verbatim from `technical-design.md`)

```
User Input (PDF/DOCX/XLSX/URL/Markdown)
    ↓
[Source Content Conversion] → source_to_md/*.py
    ↓
[Create Project] → project_manager.py init <project_name> --format <format>
    ↓
[Template (optional)] — default: skip, proceed with free design
    ↓
[Strategist] - Eight Confirmations & Design Specifications → design_spec.md + spec_lock.md
    ↓
[Image Acquisition] (when any row needs AI generation or web search)
    ↓
[Executor]
    ├── Visual construction: generate all SVG pages → svg_output/
    ├── [Quality Check] svg_quality_checker.py (mandatory — must pass with 0 errors)
    └── Notes generation: complete speaker notes → notes/total.md
    ↓
[Chart calibration (optional)] → verify-charts workflow
    ↓
[Post-processing] → total_md_split.py → finalize_svg.py → svg_to_pptx.py
    ↓
Output:
    exports/presentation_<timestamp>.pptx          ← Native shapes (DrawingML)
    exports/presentation_<timestamp>_svg.pptx      ← SVG snapshot (opt-in)
    backup/<timestamp>/svg_output/                 ← Archived SVG source
```

---

## 5. The three roles

> "PPT Master uses **role switching within one main agent** rather than parallel sub-agents."

| Role | Mode | Primary deliverable |
|------|------|---------------------|
| **Strategist** | "negotiate with user" — open-ended, conversational, willing to back up | `design_spec.md` (human narrative) + `spec_lock.md` (machine contract) |
| **Executor** | "produce strict XML" — no improvisation, no missing attributes | SVG pages in `svg_output/` + speaker notes |
| **Image_Generator** | Manifest-driven | `image_prompts.json` + generated images |

Role switching protocol: before any switch, "MUST first read" the corresponding reference file. The agent emits:
```markdown
## [Role Switch: <Role Name>]
Reading role definition: references/<filename>.md
Current task: <brief description>
```

---

## 6. SKILL.md — 9 mandatory execution rules (verbatim)

> **This workflow is a strict serial pipeline. The following rules have the highest priority — violating any one of them constitutes execution failure:**

1. **SERIAL EXECUTION** — Steps MUST be executed in order; output of each step is input for the next.
2. **BLOCKING = HARD STOP** — Steps marked BLOCKING require a full stop; AI MUST wait for explicit user response.
3. **NO CROSS-PHASE BUNDLING** — Forbidden. The Eight Confirmations in Step 4 are BLOCKING.
4. **GATE BEFORE ENTRY** — Each Step has prerequisites; MUST be verified before starting.
5. **NO SPECULATIVE EXECUTION** — "Pre-preparing" content for subsequent Steps is FORBIDDEN.
6. **NO SUB-AGENT SVG GENERATION** — Step 6 SVG generation must stay in current main agent.
7. **SEQUENTIAL PAGE GENERATION ONLY** — SVG pages MUST be generated sequentially page by page in one continuous pass. Batched groups (e.g., 5 pages at a time) are FORBIDDEN.
8. **SPEC_LOCK RE-READ PER PAGE** — Before generating each SVG page, MUST `read_file <project_path>/spec_lock.md`. Colors / fonts / icons / images MUST come from this file — no memory values, no on-the-fly invention.
9. **SVG MUST BE HAND-WRITTEN, NOT SCRIPT-GENERATED** — Every SVG page is written by the main agent directly, one page at a time. Writing Python / Node / shell scripts that batch-emit SVG files is FORBIDDEN — "the script-generation path was tried on a feature branch and abandoned: cross-page visual consistency depends on per-page authoring with full upstream context, which a generator script cannot reproduce."

---

## 7. Eight Confirmations (Strategist's BLOCKING gate)

The single blocking decision point in the pipeline:

| # | Confirmation |
|---|---|
| a | Canvas format |
| b | Page count range |
| c | Target audience (Key Information) |
| d | Style objective (Communication Mode A/B/C + Visual style descriptor) |
| e | Color scheme |
| f | Icon usage approach |
| g | Typography plan |
| h | Image usage approach |

### Style modes (d):
| Mode | Core Focus | Audience | Tagline |
|------|-----------|---------|---------|
| **A) General Versatile** | Visual impact first | Public / clients / trainees | "Catch the eye at a glance" |
| **B) General Consulting** | Data clarity first | Teams / management | "Let data speak" |
| **C) Top Consulting** | Logical persuasion first | Executives / board | "Lead with conclusions" |

### Color rules (e):
- 60-30-10 (primary / secondary / accent)
- Text contrast ratio >= 4.5:1
- No more than 4 colors per page
- Hard rule: user/template colors are truth; never auto-adjust them.

### Industry palette quick-reference (verbatim):
| Industry | Primary HEX | Characteristics |
|----------|------------|-----------------|
| Finance / Business | `#003366` Navy Blue | Stable, trustworthy |
| Technology / Internet | `#1565C0` Bright Blue | Innovative, energetic |
| Healthcare / Health | `#00796B` Teal Green | Professional, reassuring |
| Government / Public Sector | `#C41E3A` Red | Authoritative, dignified |

### Icon library rule (f):
- "**One presentation = one stylistic library** for generic icons (home, chart, users, etc.). Mixing `chunk-filled` / `tabler-filled` / `tabler-outline` / `phosphor-duotone` is FORBIDDEN."
- 4 stylistic libraries:
  - `chunk-filled` — fill, sharp right angles, architectural
  - `tabler-filled` — fill, bezier curves, organic
  - `tabler-outline` — stroke, airy, screen-only
  - `phosphor-duotone` — main shape + 20% opacity backplate
- Brand-logo exception: `simple-icons` only for real brand marks.
- Stroke weight lock for stroke libraries: deck-wide value from `{1.5, 2, 3}`, default 2.

### Typography rule (g):
- PPT-safe font discipline (HARD rule): every stack MUST end with a pre-installed font (CJK: Microsoft YaHei / SimHei / SimSun / FangSong / KaiTi; Latin sans: Arial / Calibri / Segoe UI; Latin serif: Times New Roman / Georgia / Cambria; Mono: Consolas; Display: Impact / Arial Black).
- Stack length ≤4 fonts; lead with Windows-preinstalled.
- Forbidden similar-but-not-identical pairings (across roles): Microsoft YaHei ↔ PingFang SC ↔ Heiti SC; Arial ↔ Helvetica Neue ↔ Segoe UI; etc.
- Propose 2 combinations to user: one concord (safe), one contrast (with tension).

### Three-dimensional AI image lock (h) — visual cohesion mechanism:
Strategist locks three orthogonal dimensions for AI-generated images:
1. **`rendering`** — visual style family (vector-illustration / editorial / 3d-isometric / sketch-notes / …)
2. **`palette`** — how the deck's HEX values are *used* (proportion + role + temperament)
3. **`type`** — per-image internal composition (background / hero / framework / comparison / …)

Items 1-2 are deck-wide and written into `spec_lock.md`. Image_Generator assembles every per-image prompt from the locked rendering + palette + per-image type. "Without this, every image gets its own style drift and the deck reads as a stack of unrelated illustrations."

Strategist surfaces ≥3 candidate `rendering × palette` combinations to the user during Eight Confirmations.

---

## 8. spec_lock.md — anti-drift execution contract

Two Strategist artifacts:
- `design_spec.md` — human narrative, the *why* (audience, style objective, color rationale, page outline). 11-section structure (I Project Info → II Canvas → III Visual Theme → IV Typography → V Layout → VI Icon → VII Visualization → VIII Image → IX Outline → X Speaker Notes → XI Tech Constraints).
- `spec_lock.md` — machine contract, the *what* (HEX colors, exact font family string, icon library, image resource list with status).

> "spec_lock.md is the **anti-drift mechanism** — the SKILL.md mandates `read_file <project>/spec_lock.md` before every page, so values stay verbatim across 20+ slides."

`update_spec.py` propagates color/typography changes:
- Scope: `colors.*` (HEX, case-insensitive) and `typography.font_family` (attribute-scoped) only
- "Other fields (font sizes, icons, images, canvas) are intentionally **not supported** because their replacements would need attribute-scoped or semantic awareness whose risk/benefit doesn't justify bulk propagation."
- Tool refuses to back up: relies on git for revert.

---

## 9. Why SVG (verbatim from technical-design.md)

> "SVG sits at the center of this pipeline. The choice was made by elimination."

| Alternative | Why rejected |
|-------------|-------------|
| **Direct DrawingML** | Extremely verbose XML; AI has far less training data; unreliable, undebuggable. |
| **HTML/CSS** | Document model vs canvas model — HTML is content-flow, PPT is absolute-positioned. Structural mismatch. `<table>` has no natural mapping to independent shapes. |
| **WMF/EMF** | Microsoft's own format, would minimize conversion loss, but AI has essentially no training data — dead on arrival. |
| **SVG as embedded images** | Destroys editability — shapes become pixels. |

**Why SVG wins:**
> "SVG shares the same world view as DrawingML: both are absolute-coordinate 2D vector graphics formats built around the same concepts."

| SVG | DrawingML |
|-----|-----------|
| `<path d="...">` | `<a:custGeom>` |
| `<rect rx="...">` | `<a:prstGeom prst="roundRect">` |
| `<circle>` / `<ellipse>` | `<a:prstGeom prst="ellipse">` |
| `transform="translate/scale/rotate"` | `<a:xfrm>` |
| `linearGradient` / `radialGradient` | `<a:gradFill>` |
| `fill-opacity` / `stroke-opacity` | `<a:alpha>` |

> "SVG is the only format that simultaneously satisfies every role: **AI can reliably generate it, humans can preview and debug it in any browser, and scripts can precisely convert it** — all before a single line of DrawingML is written."

ViewBox is in **pixels**, not absolute units, because pixel space makes layout reasoning unambiguous for the AI Executor. Conversion to PowerPoint's EMU happens once at export.

---

## 10. SVG → DrawingML conversion internals

Three-stage post-processing:

**Step 7.1** — `total_md_split.py`: split speaker notes
**Step 7.2** — `finalize_svg.py`: SVG post-processing
- `embed_icons.py` — expand `<use data-icon="...">` (DrawingML doesn't recognize it; without expansion every icon silently drops)
- `flatten_tspan.py` — flatten dy-stacked `<tspan>`s (DrawingML text runs cannot reposition mid-paragraph; would otherwise collapse to one baseline)
- `align_embed_images.py` — image cropping & embedding
- `svg_rect_to_path.py` — round rect to path

**Step 7.3** — `svg_to_pptx.py`: per-element dispatch translator
- Reads `svg_output/` directly (no disk hop)
- Calls `svg_finalize` modules in memory for native pptx
- "Each shape kind gets its own narrow translator, which keeps each translator simple enough to debug and unit-test in isolation."

Office compatibility mode on by default: PowerPoint <2019 can't render SVG natively, so a per-slide PNG fallback is embedded alongside native shapes.

---

## 11. Banned SVG features (empirical blacklist, not derived from spec)

Banned: `<mask>`, `<style>`, `class=`, `@font-face`, `<foreignObject>`, `<symbol>` + `<use>` (except icons), `<textPath>`, `<animate>*`, `<script>`, `<iframe>`.

Conditional allowances: `marker-start` / `marker-end`, image-only `clip-path`.

XML well-formedness traps:
- "typography must use raw Unicode (`—`, `→`, `©`, NBSP) since HTML named entities (`&mdash;`) are XML-illegal in SVG"
- reserved XML chars (`& < >`) must be entity-escaped or `R&D` will abort the export.

> "The blacklist runs before post-processing. `svg_quality_checker.py` enforces it on `svg_output/`; post-processing rewrites SVG and would mask source-level violations."

---

## 12. Animation model (verbatim from `references/animations.md`)

**Defaults:**
| Layer | Default | Why |
|---|---|---|
| Page transition | `fade`, 0.4s | Calm baseline that suits most decks |
| Per-element animation | `mixed` effect + `after-previous` trigger, 0.4s duration + 0.5s stagger | Groups cascade in automatically on slide entry — zero interaction |

**Anchor logic — top-level `<g id="...">`:**
> "Per-element animations are anchored on **top-level `<g id="...">` content groups** in the SVG (e.g. `<g id="cover-title">`, `<g id="card-1">`). One group = one click reveal."

> "Aim for **3–8 content groups per slide**. This is also the granularity PowerPoint uses for group-select / group-move, so it improves editing ergonomics regardless of animation."

**Chrome auto-skip:** groups named `background` / `bg` / `header` / `footer` / `decoration` / `watermark` / `pagenumber` / `chrome` are excluded from the cascade and appear together with the slide.

22 single effects: appear, fade, fly, cut, zoom, wipe, split, blinds, checkerboard, dissolve, random_bars, peek, wheel, box, circle, diamond, plus, strips, wedge, stretch, expand, swivel.
2 auto-vary modes: `mixed` (deterministic) and `random` (samples from pool).

**Why object-level animation uses a sidecar (`animations.json`), not SVG attributes:** "SVG remains the static visual source of truth. Custom PPTX animation is export policy."

---

## 13. Image-text layout vocabulary

`references/image-layout-patterns.md` splits 72 numbered techniques into two layers:

- **Primary Structures** — container layouts / image-as-canvas + native overlay / multi-image compositions. The page's bones.
- **Modifier Layers** — non-rectangular clips / overlays & masks / texture / special techniques. Finish.

> "The AI failure mode this catalog fights isn't *over-combining*, it's *under-using*: defaulting every image page to bare `#2 left-third` or `#48 side-by-side` with no Modifier on top, producing visually flat, 'AI-default' layouts."

Composition is declared *before* SVG generation in `§VIII Image Resource List` (column `Layout pattern`) accepts `#<id> + #<id> ...` expressions — Primary id plus optional Modifier ids. Audited by `svg_quality_checker`.

---

## 14. Live preview workflow

> "Live Preview & Visual Edits — during generation, a browser preview at `http://localhost:5050` opens automatically. Click any element, write what to change, hit **Submit annotations**, then return to the chat and say 'apply my annotations' — the AI rewrites the SVG and re-exports the PPTX."

Built on PR #85 by @WodenJay. Architectural note from PR: "Originally PPT Master was chat-only by design, but enough users asked for visual editing that we folded it in."

---

## 15. Quality Gate

`svg_quality_checker.py` enforces:
- Banned SVG features
- viewBox mismatch
- spec_lock drift (color/font values must match)
- Low-res image, non-PPT-safe font tail (warnings)

> "Severity model: errors block, warnings don't, and there is intentionally no auto-fix. Errors require the Executor to re-author the offending page in context — a banned `<style>` element isn't a mechanical patch, because the Executor used it for a reason."

Chart pages: separate `verify-charts` workflow runs after SVG generation. "AI models routinely introduce 10–50 px errors when mapping data to pixel positions."

---

## 16. Image acquisition

Two paths:
- **AI generation** (`image_gen.py`) — multi-provider: OpenAI (`gpt-image-2` recommended), Gemini, others. `IMAGE_BACKEND` + provider-specific `*_API_KEY`.
- **Web search** (`image_search.py`) — Pexels, Pixabay, Openverse, Wikimedia Commons. License filter defaults permissive (CC BY / CC BY-SA with inline credit); `--strict-no-attribution` is escape hatch.

Quality hierarchy: user assets > AI generation > web search with keys > zero-config search.

Provider-specific keys, **not** generic `IMAGE_API_KEY`: "Forcing per-provider keys makes 'which backend am I using' a config-readable fact, not an inference."

---

## 17. Canvas formats

`ppt169` (default), `ppt43`, `xhs` (Xiaohongshu, vertical), `story`, `wechat`, plus 10+ formats. Format-specific safe zones in `references/canvas-formats.md`.

---

## 18. Output artifacts (4 in default-flow mode)

| Artifact | Workflow it serves |
|----------|---------------------|
| `svg_output/` | Source of truth, manual editing, `update_spec.py`, `svg_quality_checker.py` |
| `svg_final/` | IDE inline preview, browser open of single page |
| `exports/<name>_<ts>.pptx` (native) | Primary deliverable — editable in PowerPoint |
| `exports/<name>_<ts>_svg.pptx` (preview, `--svg-snapshot`) | Cross-platform single-file distribution |
| `backup/<ts>/svg_output/` | Re-export from frozen SVG without re-running LLM |

---

## 19. Templates system (opt-in)

> "Templates are **opt-in, not default**. The default Strategist flow is free design — AI invents the visual system from the source content alone."

Three template indices:
- `layouts_index.json` — page layout templates
- `brands_index.json` — brand identity presets (color / typography / logo / voice)
- `charts_index.json` — visualization templates

Layout vs brand: layout is structurally a page roster + canvas + grid; brand is just the identity preset minus the roster (`design_spec.md` declares `kind: brand`). When both supplied, Step 3 **fuses them into a single `design_spec.md`** with field-level precedence:
- Color, typography font family, logo, voice & tone, icon style → brand
- Canvas, page roster, signature visual elements, font-size hierarchy, spacing/grid, SVG technical constraints → layout

`/create-template` workflow extracts theme colors, fonts, master/layout structure, reusable images straight from OOXML of any existing PPTX.

> "Templates are floors that easily become ceilings: they lock the deck into the template's visual idioms regardless of how the content actually wants to be presented."

---

## 20. Design philosophy (verbatim)

> "The generated PPTX is a **design draft**, not a finished product. Think of it like an architect's rendering: the AI handles visual design, layout, and content structure — delivering a high-quality starting point. For truly polished results, **expect to do your own finishing work** in PowerPoint."

> "**A tool's ceiling is your ceiling.** PPT Master amplifies the skills you already have — if you have a strong sense of design and content, it helps you execute faster. If you don't know what a great presentation looks like, the tool won't know either."

---

## 21. Examples library

17 sample projects, 229 pages, all generated with Claude Opus 4.7 + `gpt-image-2`:
- Editorial Magazine (Pritzker 2026 architecture)
- Data Journalism (Bloomberg-style dark dashboard, Global AI Capital)
- Swiss Grid (strict modular grid, red-accent)
- Glassmorphism SaaS (translucent layers, gradient depth)
- Memphis Pop (bold primaries, geometric patterns)
- Risograph Zine (duotone print, bookstore-culture feel)



## APPENDIX — Full SKILL.md + references verbatim

The following sections capture verbatim, unmodified SKILL.md and reference files fetched from the PPT Master GitHub repo (`hugohe3/ppt-master`, main branch) on 2026-05-20. Each is wrapped in a code fence as raw markdown.

Source URLs (all HTTP 200):
- https://raw.githubusercontent.com/hugohe3/ppt-master/main/skills/ppt-master/SKILL.md (37771 bytes)
- https://raw.githubusercontent.com/hugohe3/ppt-master/main/skills/ppt-master/references/strategist.md (51131 bytes)
- https://raw.githubusercontent.com/hugohe3/ppt-master/main/skills/ppt-master/references/executor-base.md (31209 bytes)
- https://raw.githubusercontent.com/hugohe3/ppt-master/main/skills/ppt-master/references/shared-standards.md (35097 bytes)
- https://raw.githubusercontent.com/hugohe3/ppt-master/main/skills/ppt-master/references/image-layout-patterns.md (21642 bytes)

### B1. SKILL.md (verbatim)

```markdown
---
name: ppt-master
description: >
  AI-driven multi-format SVG content generation system. Converts source documents
  (PDF/DOCX/URL/Markdown) into high-quality SVG pages and exports to PPTX through
  multi-role collaboration. Use when user asks to "create PPT", "make presentation",
  "生成PPT", "做PPT", "制作演示文稿", or mentions "ppt-master".
---

# PPT Master Skill

> AI-driven multi-format SVG content generation system. Converts source documents into high-quality SVG pages through multi-role collaboration and exports to PPTX.

**Core Pipeline**: `Source Document → Create Project → [Template] → Strategist → [Image_Generator] → Executor Live Preview → Quality Check → Post-processing → Export`

> [!CAUTION]
> ## 🚨 Global Execution Discipline (MANDATORY)
>
> **This workflow is a strict serial pipeline. The following rules have the highest priority — violating any one of them constitutes execution failure:**
>
> 1. **SERIAL EXECUTION** — Steps MUST be executed in order; the output of each step is the input for the next. Non-BLOCKING adjacent steps may proceed continuously once prerequisites are met, without waiting for the user to say "continue"
> 2. **BLOCKING = HARD STOP** — Steps marked ⛔ BLOCKING require a full stop; the AI MUST wait for an explicit user response before proceeding and MUST NOT make any decisions on behalf of the user
> 3. **NO CROSS-PHASE BUNDLING** — Cross-phase bundling is FORBIDDEN. (Note: the Eight Confirmations in Step 4 are ⛔ BLOCKING — the AI MUST present recommendations and wait for explicit user confirmation before proceeding. Once the user confirms, all subsequent non-BLOCKING steps — design spec output, SVG generation, speaker notes, and post-processing — may proceed automatically without further user confirmation)
> 4. **GATE BEFORE ENTRY** — Each Step has prerequisites (🚧 GATE) listed at the top; these MUST be verified before starting that Step
> 5. **NO SPECULATIVE EXECUTION** — "Pre-preparing" content for subsequent Steps is FORBIDDEN (e.g., writing SVG code during the Strategist phase)
> 6. **NO SUB-AGENT SVG GENERATION** — Executor Step 6 SVG generation is context-dependent and MUST be completed by the current main agent end-to-end. Delegating page SVG generation to sub-agents is FORBIDDEN
> 7. **SEQUENTIAL PAGE GENERATION ONLY** — In Executor Step 6, after the global design context is confirmed, SVG pages MUST be generated sequentially page by page in one continuous pass. Grouped page batches (for example, 5 pages at a time) are FORBIDDEN
> 8. **SPEC_LOCK RE-READ PER PAGE** — Before generating each SVG page, Executor MUST `read_file <project_path>/spec_lock.md`. All colors / fonts / icons / images MUST come from this file — no values from memory or invented on the fly. Executor MUST also look up the current page's `page_rhythm` (`anchor` / `dense` / `breathing`), `page_layouts` (which template SVG to inherit, if any), and `page_charts` (which chart template to adapt, if any). Empty / absent entries are intentional Strategist signals — see executor-base.md §2.1. This rule exists to resist context-compression drift on long decks and to break the uniform "every page is a card grid" default
> 9. **SVG MUST BE HAND-WRITTEN, NOT SCRIPT-GENERATED** — Every SVG page is written by the main agent directly, one page at a time (see rules 6 and 7). Writing or running a Python / Node / shell script that produces the SVG files in batch — looping over pages, templating from data, or emitting them via a generator — is FORBIDDEN, including under "save tokens", "quick draft", or "user is in a hurry" pretexts. The script-generation path was tried on a feature branch and abandoned: cross-page visual consistency depends on per-page authoring with full upstream context, which a generator script cannot reproduce

> [!IMPORTANT]
> ## 🌐 Language & Communication Rule
>
> - **Response language**: match the user's input and source materials. Explicit user override (e.g., "请用英文回答") takes precedence.
> - **Template format**: `design_spec.md` MUST follow its original English template structure (section headings, field names) regardless of conversation language. Content values may be in the user's language.

> [!IMPORTANT]
> ## 🔌 Compatibility With Generic Coding Skills
>
> - `ppt-master` is a repository-specific workflow, not a general application scaffold
> - Do NOT create `.worktrees/`, `tests/`, branch workflows, or generic engineering structure by default
> - On conflict with a generic coding skill, follow this skill unless the user explicitly says otherwise

## Main Pipeline Scripts

| Script | Purpose |
|--------|---------|
| `${SKILL_DIR}/scripts/source_to_md/pdf_to_md.py` | PDF to Markdown |
| `${SKILL_DIR}/scripts/source_to_md/doc_to_md.py` | Documents to Markdown — native Python for DOCX/HTML/EPUB/IPYNB, pandoc fallback for legacy formats (.doc/.odt/.rtf/.tex/.rst/.org/.typ) |
| `${SKILL_DIR}/scripts/source_to_md/excel_to_md.py` | Excel workbooks to Markdown — supports .xlsx/.xlsm; legacy .xls should be resaved as .xlsx |
| `${SKILL_DIR}/scripts/source_to_md/ppt_to_md.py` | PowerPoint to Markdown |
| `${SKILL_DIR}/scripts/source_to_md/web_to_md.py` | Web page to Markdown (supports WeChat via `curl_cffi`) |
| `${SKILL_DIR}/scripts/project_manager.py` | Project init / validate / manage |
| `${SKILL_DIR}/scripts/analyze_images.py` | Image analysis |
| `${SKILL_DIR}/scripts/image_gen.py` | AI image generation (multi-provider) |
| `${SKILL_DIR}/scripts/svg_quality_checker.py` | SVG quality check |
| `${SKILL_DIR}/scripts/total_md_split.py` | Speaker notes splitting |
| `${SKILL_DIR}/scripts/finalize_svg.py` | SVG post-processing (unified entry) |
| `${SKILL_DIR}/scripts/svg_to_pptx.py` | Export to PPTX |
| `${SKILL_DIR}/scripts/update_spec.py` | Propagate a `spec_lock.md` color / font_family change across all generated SVGs |

For complete tool documentation, see `${SKILL_DIR}/scripts/README.md`.

## Template Index

| Index | Path | Purpose |
|-------|------|---------|
| Layout templates | `${SKILL_DIR}/templates/layouts/layouts_index.json` | Query available page layout templates |
| Brand presets | `${SKILL_DIR}/templates/brands/brands_index.json` | Query available brand identity presets (color / typography / logo / voice) |
| Visualization templates | `${SKILL_DIR}/templates/charts/charts_index.json` | Query available visualization SVG templates (charts, infographics, diagrams, frameworks) |
| Icon library | `${SKILL_DIR}/templates/icons/` | See `${SKILL_DIR}/templates/icons/README.md`; search icons on demand with `ls templates/icons/<library>/ \| grep <keyword>` |

## Standalone Workflows

| Workflow | Path | Purpose |
|----------|------|---------|
| `topic-research` | `workflows/topic-research.md` | Pre-pipeline — gather web sources when the user supplies only a topic with no source files |
| `create-template` | `workflows/create-template.md` | Standalone layout template creation workflow |
| `create-brand` | `workflows/create-brand.md` | Standalone brand-only template creation (identity preset; no SVG page roster) |
| `resume-execute` | `workflows/resume-execute.md` | Phase B entry — resume execution in a fresh chat after Phase A (Step 1–5) completed in another session (split mode) |
| `verify-charts` | `workflows/verify-charts.md` | Chart coordinate calibration — run after SVG generation if the deck contains data charts |
| `customize-animations` | `workflows/customize-animations.md` | Object-level PPTX animation customization — run only when the user explicitly asks to tune animation order/effects/timing |
| `live-preview` | `workflows/live-preview.md` | Browser-based live preview — auto-started during generation and re-enterable any time the user mentions "live preview", "preview", "看效果", or wants to click/select a slide element |
| `visual-review` | `workflows/visual-review.md` | Per-page rubric-based visual self-check — run only when the user explicitly asks for a visual re-pass on the generated SVGs (between Executor and post-processing). Opt-in only; never invoked by the main pipeline. |

---

## Workflow

### Step 1: Source Content Processing

🚧 **GATE**: User has provided source material (PDF / DOCX / EPUB / URL / Markdown file / text description / conversation content — any form is acceptable).

> **No source content?** When the user supplies only a topic name or requirements without any file or substantive description, run the [`topic-research`](workflows/topic-research.md) workflow first, then return here with its products as input.

When the user provides non-Markdown content, convert immediately:

| User Provides | Command |
|---------------|---------|
| PDF file | `python3 ${SKILL_DIR}/scripts/source_to_md/pdf_to_md.py <file>` |
| DOCX / Word / Office document | `python3 ${SKILL_DIR}/scripts/source_to_md/doc_to_md.py <file>` |
| XLSX / XLSM / Excel workbook | `python3 ${SKILL_DIR}/scripts/source_to_md/excel_to_md.py <file>` |
| CSV / TSV | Read directly as plain-text table source |
| PPTX / PowerPoint deck | `python3 ${SKILL_DIR}/scripts/source_to_md/ppt_to_md.py <file>` |
| EPUB / HTML / LaTeX / RST / other | `python3 ${SKILL_DIR}/scripts/source_to_md/doc_to_md.py <file>` |
| Web link | `python3 ${SKILL_DIR}/scripts/source_to_md/web_to_md.py <URL>` |
| WeChat / high-security site | `python3 ${SKILL_DIR}/scripts/source_to_md/web_to_md.py <URL>` (requires `curl_cffi`, included in `requirements.txt`) |
| Markdown | Read directly |

> **Office vector assets (EMF/WMF) from DOCX/PPTX sources**:
> `doc_to_md.py` / `ppt_to_md.py` extract embedded Office vector images (.emf/.wmf)
> alongside bitmap images. After `import-sources`, these land in `images/`
> together with `image_manifest.json` and are first-class assets in §VIII Image Resource List.
>
> **Do NOT convert EMF/WMF to PNG.** The PPT Master pipeline preserves them as external
> references (`finalize_svg.py` skips them) and `svg_to_pptx.py` embeds them as
> PPTX-native media via `image/x-emf` / `image/x-wmf` MIME — PowerPoint renders them at full vector fidelity.
> Converting via LibreOffice/Inkscape introduces CJK font substitution drift and
> rasterization loss; the original EMF/WMF is always higher fidelity than the converted PNG.
>
> Browser-based live preview cannot render EMF (will show blank) — this is expected;
> the PPTX output is the source of truth.

**✅ Checkpoint — Confirm source content is ready, proceed to Step 2.**

---

### Step 2: Project Initialization

🚧 **GATE**: Step 1 complete; source content is ready (Markdown file, user-provided text, or requirements described in conversation are all valid).

```bash
python3 ${SKILL_DIR}/scripts/project_manager.py init <project_name> --format <format>
```

Format options: `ppt169` (default), `ppt43`, `xhs`, `story`, etc. For the full format list, see `references/canvas-formats.md`.

Import source content (choose based on the situation):

| Situation | Action |
|-----------|--------|
| Has source files (PDF/MD/etc.) | `python3 ${SKILL_DIR}/scripts/project_manager.py import-sources <project_path> <source_files...> --move` |
| User provided text directly in conversation | No import needed — content is already in conversation context; subsequent steps can reference it directly |

> ⚠️ **MUST use `--move`** (not copy): all source files — Step 1's generated Markdown, original PDFs / MDs / images — go into `sources/` via `import-sources --move`. After execution they no longer exist at the original location. Intermediate artifacts (e.g., `_files/`) are handled automatically.

**✅ Checkpoint — Confirm project structure created successfully, `sources/` contains all source files, converted materials are ready. Proceed to Step 3.**

---

### Step 3: Template Option

🚧 **GATE**: Step 2 complete; project directory structure is ready.

**Default — free design.** Proceed directly to Step 4. Do NOT query `layouts_index.json` unless triggered. Do NOT ask the user. Do NOT proactively suggest, hint at, or fuzzy-match any template based on content, slug-like words, or vague style descriptions.

**Template flow triggers ONLY on an explicit template directory path** supplied by the user in their initial message. The trigger rule is mechanical, not interpretive:

| User input contains | Step 3 action |
|---|---|
| An explicit path to a template directory (e.g. `skills/ppt-master/templates/layouts/academic_defense/`, `projects/foo/template/`, or any other absolute / relative path that resolves to a directory containing `design_spec.md` and one or more page SVGs) | Copy that directory's SVGs + `design_spec.md` + assets into the project, advance |
| Anything else — including bare template names ("用 academic_defense 模板"), style descriptions ("麦肯锡风格" / "Google style"), brand mentions ("招商银行风格"), vague intent ("想用个模板"), or silence | Skip Step 3, free design |

There is no slug matching, no name lookup, no fuzzy resolution. A template name without a path does not trigger — the user must give a path the AI can `cd` into.

The path may live anywhere — `skills/ppt-master/templates/layouts/<name>/` (the built-in library), `projects/<other_project>/template/` (reusing a previous project's templates), or any other location. Location is irrelevant; what matters is that the user named the path.

```bash
TEMPLATE_DIR=<user-supplied path>
cp ${TEMPLATE_DIR}/*.svg <project_path>/templates/
cp ${TEMPLATE_DIR}/design_spec.md <project_path>/templates/
cp ${TEMPLATE_DIR}/*.png <project_path>/images/ 2>/dev/null || true
cp ${TEMPLATE_DIR}/*.jpg <project_path>/images/ 2>/dev/null || true
```

> Style descriptions ("麦肯锡风格" / "Keynote 风" / "极简风" / etc.) never trigger Step 3. They flow naturally into Strategist's Eight Confirmations as part of the user's input — Strategist uses them as a style brief when proposing color / typography / tone in confirmations e and g.

> Bare template names ("academic_defense", "招商银行") do NOT trigger Step 3 even if a folder by that name exists in the library. The user must give a path. AI must not "helpfully" resolve a name to a path.

> "What templates exist?" is out-of-band Q&A — answer by listing entries from `layouts_index.json` together with their paths. Listing alone does not advance the pipeline; the user still has to send a path to trigger the Step 3 copy.

> To create a new template, read `workflows/create-template.md`.

**Brand triggering follows the same explicit-path rule as layout templates.** A brand is structurally a layout template minus its SVG page roster — its `design_spec.md` declares `kind: brand` in YAML frontmatter and lives under `templates/brands/<id>/`. `brands_index.json` is discovery-only, same as `layouts_index.json` — listing brands never triggers Step 3.

| User input contains | Step 3 brand action |
|---|---|
| An explicit path to a brand directory (e.g. `skills/ppt-master/templates/brands/acme/`, or any path that resolves to a directory whose `design_spec.md` declares `kind: brand`) | Copy `design_spec.md` + logo files + any present asset subdirectories into `<project_path>/templates/` |
| Bare brand names ("use acme brand", "用 acme 品牌"), brand mentions without a path, or silence | Skip — same mechanical rule as layout templates: bare names never trigger |

```bash
BRAND_DIR=<user-supplied brand path>
cp ${BRAND_DIR}/design_spec.md <project_path>/templates/
cp ${BRAND_DIR}/*.svg <project_path>/templates/ 2>/dev/null || true     # brand logo SVG files
cp ${BRAND_DIR}/*.png <project_path>/templates/ 2>/dev/null || true     # brand logo raster files
[ -d ${BRAND_DIR}/images ] && cp -r ${BRAND_DIR}/images <project_path>/templates/
[ -d ${BRAND_DIR}/illustrations ] && cp -r ${BRAND_DIR}/illustrations <project_path>/templates/
[ -d ${BRAND_DIR}/icons ] && cp -r ${BRAND_DIR}/icons <project_path>/templates/
```

> Brand and layout outputs share `<project_path>/templates/` because they are the same kind of artifact — a reference bundle that Strategist treats as truth. Downstream code never needs to distinguish them.

> "What brands exist?" is out-of-band Q&A — answer by listing entries from `brands_index.json` together with their paths. Listing alone does not advance the pipeline; the user still has to send a path to trigger the Step 3 copy.

> To create a new brand, read `workflows/create-brand.md`.

#### Brand + layout combined input

A brand path and a layout template path may both be supplied in the same message. When both are present, Step 3 **fuses them into a single `design_spec.md`** inside `<project_path>/templates/` instead of leaving two specs side by side. Field-level precedence is fixed (no per-deck prompting):

| Field group | Source |
|---|---|
| Color (primary / secondary / accents / text / bg) | **brand** |
| Typography (font family) | **brand** |
| Logo | **brand** (if absent, fall back to layout's logo) |
| Voice & tone | **brand** |
| Icon style preference | **brand** |
| Canvas (size / viewBox / margins) | **layout** |
| Page roster + signature visual elements (top bar / underline / decorative motifs) | **layout** |
| Font-size hierarchy (H1 / H2 / body / data / label) | **layout** |
| Spacing, grid, layout patterns | **layout** |
| SVG technical constraints | **layout** |
| Placeholder set | **layout** |

Action: AI reads `${LAYOUT_DIR}/design_spec.md` and `${BRAND_DIR}/design_spec.md`, composes one fused `design_spec.md` using the table above, writes it to `<project_path>/templates/design_spec.md`. SVG page files come from `${LAYOUT_DIR}`; brand logos and asset subdirectories from `${BRAND_DIR}`. The fused spec carries a one-line `> Fused from: layout=<layout_id>, brand=<brand_id>` provenance note under its H1.

**Conflict gates** — clarify with the user only in these two cases:

1. **Brand has no logo, layout has one.** Ask: "your brand has no bundled logo; use the layout's logo, or leave the deck logo-less?"
2. **Layout is itself a branded template (e.g. `招商银行`, `重庆大学`, `中汽研_*`, `中国电建_*`) and the supplied brand is different.** Ask: "this layout carries `<layout's own brand>` identity, which conflicts with the `<supplied brand>` you provided — confirm you want brand identity from `<supplied brand>` and only the page structure from `<layout>`?"

If neither gate trips, fusion proceeds silently and Step 3 advances.

**✅ Checkpoint — Default path proceeds to Step 4 without user interaction. If the user's input contains an explicit template directory path and/or an explicit brand directory path, those directories are copied (or fused) into `<project_path>/templates/` before advancing.**

---

### Step 4: Strategist Phase (MANDATORY — cannot be skipped)

🚧 **GATE**: Step 3 complete; default free-design path taken, or (if triggered) template files copied into the project.

First, read the role definition:
```
Read references/strategist.md
```

> ⚠️ **Mandatory gate**: before writing `design_spec.md`, Strategist MUST `read_file templates/design_spec_reference.md` and follow its full I–XI section structure. See `strategist.md` Section 1.

**Eight Confirmations** (full template: `templates/design_spec_reference.md`):

⛔ **BLOCKING**: present the Eight Confirmations as a single bundled recommendation set and **wait for explicit user confirmation or modification** before outputting Design Specification & Content Outline. This is the single core confirmation point — once confirmed, all subsequent steps proceed automatically.

1. Canvas format
2. Page count range
3. Target audience
4. Style objective
5. Color scheme
6. Icon usage approach
7. Typography plan
8. Image usage approach

**Mandatory — split-mode note** (not a ninth confirmation): after listing the eight confirmation details, you MUST append exactly one short line (rendered in the user's language, prefixed with 💡) about generation mode. Pick the variant by qualitative read of Phase A signals — recommended page count, source-material bulk, whether `topic-research` ran with substantial web-fetch accumulation:

| Signal read | Line content |
|---|---|
| Heavy (long page count / bulky sources / heavy web-fetch accumulation) | State estimated page count and large source size; recommend switching to [split mode](workflows/resume-execute.md) after Step 5 — stop this chat, open a fresh window and input `继续生成 projects/<project_name>` to enter Phase B (SVG generation + export); no response or "continue" = default continuous mode. |
| Normal (default) | State scale is moderate, default continuous mode generates in one go; if mid-way window switch is desired, input `继续生成 projects/<project_name>` after Step 5 to switch to [split mode](workflows/resume-execute.md). |

This line is required output every run — the user must always see the mode choice exists. Whether to act on it is the user's call.

If the user provided images, run analysis **before outputting the design spec**:
```bash
python3 ${SKILL_DIR}/scripts/analyze_images.py <project_path>/images
```

> ⚠️ **Image handling**: NEVER directly read / open / view image files (`.jpg`, `.png`, etc.). All image info comes from `analyze_images.py` output or the Design Spec's Image Resource List.

**Output**:
- `<project_path>/design_spec.md` — human-readable design narrative
- `<project_path>/spec_lock.md` — machine-readable execution contract (skeleton: `templates/spec_lock_reference.md`); Executor re-reads before every page

**✅ Checkpoint — Phase deliverables complete, auto-proceed to next step**:
```markdown
## ✅ Strategist Phase Complete
- [x] Eight Confirmations completed (user confirmed)
- [x] Split-mode note appended below the eight items (heavy or normal variant)
- [x] Design Specification & Content Outline generated
- [x] Execution lock (spec_lock.md) generated
- [ ] **Next**: Auto-proceed to [Image_Generator / Executor] phase
```

---

### Step 5: Image Acquisition Phase (Conditional)

🚧 **GATE**: Step 4 complete; Design Specification & Content Outline generated and user confirmed.

> **Trigger**: At least one row in the resource list has `Acquire Via: ai` and/or `Acquire Via: web`. If every row is `user` or `placeholder`, skip to Step 6.

**Always load the common framework**:

```
Read references/image-base.md
```

Then **lazy-load the path-specific reference** for each row that actually needs it:

| Acquire Via | Load reference (only if any such row exists) | Run |
|---|---|---|
| `ai` | `references/image-generator.md` | `python3 ${SKILL_DIR}/scripts/image_gen.py --manifest <project_path>/images/image_prompts.json` |
| `web` | `references/image-searcher.md` | `python3 ${SKILL_DIR}/scripts/image_search.py ...` |
| `user` / `placeholder` | (skip) | (skip) |

A deck with only `ai` rows never loads `image-searcher.md`; a deck with only `web` rows never loads `image-generator.md`. A mixed deck loads both, processes each row through its own path, and writes both `image_prompts.json` and `image_sources.json`.

> ⚠️ **In-pipeline ai path MUST use manifest mode** — even when only 1 ai row exists. Write `images/image_prompts.json` first, then run `image_gen.py --manifest`, then `image_gen.py --render-md` to produce the `image_prompts.md` sidecar. The positional form (`image_gen.py "prompt" ...`) is reserved for **out-of-pipeline one-off testing / single-image fixups** — it skips manifest + sidecar, leaving no audit trail.

Workflow:

1. Extract all rows with `Status: Pending` and `Acquire Via ∈ {ai, web}` from the design spec
2. Generate prompts (ai rows) and/or run search (web rows) per [image-base.md](references/image-base.md) §2 dispatch table
3. Verify every row reaches a terminal status: `Generated` (ai success), `Sourced` (web success), or `Needs-Manual`

**✅ Checkpoint — Confirm acquisition attempted for every row**:
```markdown
## ✅ Image Acquisition Phase Complete
- [x] image_prompts.json created (when any ai rows processed)
- [x] image_prompts.md sidecar rendered (when any ai rows processed)
- [x] image_sources.json created (when any web rows processed)
- [x] Each row: status is `Generated` / `Sourced` / `Needs-Manual` (no `Pending` remaining)
```

**Default — auto-proceed to Step 6.** Only when the user's Step 4 response explicitly opted into split mode (in reply to the optional hint), output the Phase A hand-off below and stop this conversation:

  ```markdown
  ## ✅ Phase A Complete
  - [x] Spec: `design_spec.md`, `spec_lock.md`
  - [x] Resources: `sources/`, `images/`, `templates/`
  - [ ] **Next**: open a fresh chat window and input `继续生成 projects/<project_name>` to enter Phase B via the [`resume-execute`](workflows/resume-execute.md) workflow.
  ```

> On acquisition failure, do NOT halt — follow the Failure Handling rule in [image-base.md](references/image-base.md) §5: retry once, then mark the row `Needs-Manual`, report to user, and continue to the checkpoint above.

---

### Step 6: Executor Phase

🚧 **GATE**: Step 4 (and Step 5 if triggered) complete; all prerequisite deliverables are ready.

Read the role definition based on the selected style:
```
Read references/executor-base.md          # REQUIRED: common guidelines
Read references/shared-standards.md       # REQUIRED: SVG/PPT technical constraints
Read references/executor-general.md       # General flexible style
Read references/executor-consultant.md    # Consulting style
Read references/executor-consultant-top.md # Top consulting style (MBB level)
```

> Only read executor-base + shared-standards + one style file.

**Design Parameter Confirmation (Mandatory)**: before the first SVG, output key design parameters from the spec (canvas dimensions, color scheme, font plan, body font size). See executor-base.md §2.

**Live Preview Auto-Startup (Mandatory)**: before the first SVG, automatically start the browser editor in live mode and keep it running continuously through Executor + Step 7 export:
```bash
python3 ${SKILL_DIR}/scripts/svg_editor/server.py <project_path> --live
```
- Start it immediately when Executor begins; `svg_output/` may be empty. Editor opens at `http://localhost:5050`; port conflict → `--port <other>` and report the actual URL.
- Run it as a long-running side process/session; do not wait for it to exit before generating SVG pages. Do not wait for user confirmation after startup.
- **Service must keep running** until one of: (a) the user clicks **Exit preview** in the browser, or (b) the user explicitly asks in chat to stop it. Generation continues even if the user closes the editor.
- **Do NOT read or apply submitted annotations during generation.** Users may annotate at any time, but Executor proceeds without touching them. The window to apply annotations opens only after Step 7 completes — see [`workflows/live-preview.md`](workflows/live-preview.md).
- UI button semantics and editor details: see [`workflows/live-preview.md`](workflows/live-preview.md) Notes.

**Pre-generation Batch Read (Mandatory)**: before the first SVG, batch-read every distinct layout SVG referenced in `spec_lock.page_layouts` and every distinct chart SVG referenced in `spec_lock.page_charts` (plus any §VII backup charts). One read per file, up front — do not re-read these during page generation. See executor-base.md §1.0.

**Per-page spec_lock re-read (Mandatory)**: before **each** SVG page, `read_file <project_path>/spec_lock.md` and use only its colors / fonts / icons / images, plus the per-page `page_rhythm` / `page_layouts` / `page_charts` lookups (resolves to template SVGs already loaded in the batch read above). Resists context-compression drift on long decks. See executor-base.md §2.1.

> ⚠️ **Main-agent only**: SVG generation MUST stay in the current main agent — page design depends on full upstream context. Do NOT delegate to sub-agents.
> ⚠️ **Generation rhythm**: generate pages sequentially, one at a time, in the same continuous context. Do NOT batch (e.g., 5 per group).

**Visual Construction Phase**: generate SVG pages sequentially, one at a time, in one continuous pass → `<project_path>/svg_output/`

**Quality Check Gate (Mandatory)** — after all SVGs, BEFORE annotation handling and speaker notes:
```bash
python3 ${SKILL_DIR}/scripts/svg_quality_checker.py <project_path>
```
- Any `error` (banned SVG features, viewBox mismatch, spec_lock drift, etc.) MUST be fixed before proceeding — return to Visual Construction, regenerate that page, re-run check.
- `warning` entries (low-res image, non-PPT-safe font tail, etc.): fix when straightforward, otherwise acknowledge and release.
- Run against `svg_output/` (not after `finalize_svg.py` — finalize rewrites SVG and masks violations).

**Logic Construction Phase**: generate speaker notes → `<project_path>/notes/total.md`

**✅ Checkpoint — Confirm all SVGs and notes are fully generated and quality-checked. Proceed directly to Step 7 post-processing**:
```markdown
## ✅ Executor Phase Complete
- [x] Live preview started and kept available at the reported URL
- [x] All SVGs generated to svg_output/
- [x] svg_quality_checker.py passed (0 errors)
- [x] Speaker notes generated at notes/total.md
```

> **Chart pages?** If this deck contains data charts (bar / line / pie / radar / etc.), run the standalone [`verify-charts`](workflows/verify-charts.md) workflow before Step 7 to calibrate coordinates. AI models routinely introduce 10–50 px errors when mapping data to pixel positions; verify-charts eliminates that class of error. Skip if no chart pages.

> **Visual self-check (opt-in)?** If the user explicitly asked for a per-page visual re-pass on the SVGs ("跑一下视觉自检 / 视觉回看", "visual review", "check pages visually", etc.), run the standalone [`visual-review`](workflows/visual-review.md) workflow before Step 7. Do NOT run it by default and do NOT recommend it based on inferred model capability or deck size — trigger is user request only.

---

### Step 7: Post-processing & Export

🚧 **GATE**: Step 6 complete; all SVGs generated to `svg_output/`; speaker notes `notes/total.md` generated.

🚧 **Image readiness GATE** (when Step 5 left ai rows in `Needs-Manual`): every expected file must exist at `project/images/<filename>` before running 7.1.

> If files are missing: PAUSE, list the missing filenames, point the user to `images/image_prompts.md` (each `### Image N:` block is paste-ready for ChatGPT / Gemini / Midjourney; auto-generated from `image_prompts.json`) and the required placement `project/images/<filename>`. Resume Step 7.1 only after all expected files are in place. `finalize_svg.py` and `svg_to_pptx.py` do not detect missing files at this layer — proceeding with gaps produces a deck with broken image references.

> ⚠️ Run the three sub-steps **one at a time** — each must complete successfully before the next.
> ❌ **NEVER** combine them into a single code block or shell invocation.

Canonical three-command pipeline (mirrors `references/shared-standards.md` §5):

**Step 7.1** — Split speaker notes:
```bash
python3 ${SKILL_DIR}/scripts/total_md_split.py <project_path>
```

**Step 7.2** — SVG post-processing (icon embedding / image crop & embed / text flattening / rounded rect to path):
```bash
python3 ${SKILL_DIR}/scripts/finalize_svg.py <project_path>
```

**Step 7.3** — Export PPTX (embeds speaker notes by default):
```bash
python3 ${SKILL_DIR}/scripts/svg_to_pptx.py <project_path>
# Output (default-flow mode):
#   exports/<project_name>_<timestamp>.pptx           ← native pptx (canonical output, reads svg_output/)
#   backup/<timestamp>/svg_output/                    ← Executor SVG source backup (always written)
#
# Add --svg-snapshot to additionally emit the SVG-image preview pptx alongside the native pptx:
#   exports/<project_name>_<timestamp>_svg.pptx      ← SVG preview pptx (reads svg_final/)
```

> The native pptx consumes `svg_output/` directly so the converter can preserve
> high-fidelity primitives (icon `<use>` placeholders, image `preserveAspectRatio`
> → `srcRect`, rounded rect `rx/ry` → `prstGeom roundRect`). The `svg_output/`
> snapshot in `backup/<timestamp>/` is always written so the project can be
> re-exported from frozen SVG sources without re-running the LLM. The SVG-rendered
> preview pptx is opt-in via `--svg-snapshot` — live preview already provides the
> SVG visual reference, so it's only needed when you want a self-contained file
> to share. Pass `-s output` or `-s final` to force a single source if you need it.

> **Paragraph editability vs line fidelity** — by default every dy-stacked line is
> its own PowerPoint text frame, preserving exact SVG layout. Add `--merge-paragraphs`
> only when the user explicitly asks for an editable / wrap-friendly export (e.g.
> "I want to edit the abstract as one block", "make text boxes resizable / reflow"):
> mergeable paragraph blocks collapse into one editable text frame with multiple
> `<a:p>`, at the cost of PowerPoint re-wrapping inside each box. Default off keeps
> pixel-fidelity; turn it on per the user's request, not on your own judgement.

**Optional animation flags** (the defaults already enable rich entrance animations — adjust only when the user asks for something different):
- `-t <effect>` — page transition. Default `fade`. Options: `fade` / `push` / `wipe` / `split` / `strips` / `cover` / `random` / `none`.
- `-a <effect>` — per-element entrance animation. Default `mixed` (auto-vary across the deck). Pass `none` to disable, or pick a specific effect like `fade`. Requires top-level `<g id="...">` groups (already required by Executor).
- `--animation-trigger {on-click,with-previous,after-previous}` — Start mode (matches PowerPoint's animation-pane Start dropdown). Default `after-previous` (click-free cascade; pace via `--animation-stagger`). Use `on-click` for presenter-paced reveals, or `with-previous` for all-at-once.
- `--animation-config <path>` — optional object-level sidecar. Default: `<project_path>/animations.json` when present.
- `--auto-advance <seconds>` — kiosk-style auto-play.

**Optional custom animations** (only when the user asks to tune animation order/effects/timing for specific objects):

Run the standalone [`customize-animations`](workflows/customize-animations.md) workflow. Default export already has global entrance animation; do not create `animations.json` unless object-level customization was requested.

**Optional recorded narration** (only when the user asks for narrated/video export):

Run the standalone [`generate-audio`](workflows/generate-audio.md) workflow. The AI picks a narration backend (`edge` by default, or a configured cloud provider such as ElevenLabs / MiniMax / Qwen / CosyVoice for high-quality or cloned voices), asks the user once (backend + voice + rate/settings + embed-or-not, all with recommended values), then executes `notes_to_audio.py` and (if chosen) re-exports the PPTX with `--recorded-narration audio`.

Do NOT call `notes_to_audio.py` directly without going through the workflow — `--voice` / `--voice-id` is required and the workflow produces the locale/provider-aware recommendation that makes the choice meaningful.

Full effect list, anchor logic, and limits: [`references/animations.md`](references/animations.md).

> ❌ **NEVER** substitute `cp` for `finalize_svg.py` — finalize performs multiple critical processing steps
> ❌ **NEVER** force `-s output` for the legacy/preview pptx (PowerPoint's internal SVG parser drops icons and rounded corners). The default auto-split already gives native the high-fidelity source it needs without touching legacy.
> ❌ **NEVER** use `--only` (it suppresses one of the two output files)

> **Post-export annotation window**: the preview service from Step 6 typically remains running after export. If the user submitted annotations in the browser (during Executor or after export) and now asks to apply them — they may quote the browser prompt (`Annotations saved. ... apply my annotations`), say "apply my annotations" / "应用注解" / equivalent — run [`live-preview`](workflows/live-preview.md) Step 2 to apply and re-export. Annotations submitted during generation are also handled here, not earlier.

> **Preview not running?** Any time the user mentions "live preview", "preview", "看效果", or wants to select/click a slide element and the service is not running, run [`live-preview`](workflows/live-preview.md) Step 1 to start it. If the service is already running, just point them at the URL — do not restart.

---

## Role Switching Protocol

Before switching roles, **MUST first read** the corresponding reference file. Output marker:

```markdown
## [Role Switch: <Role Name>]
📖 Reading role definition: references/<filename>.md
📋 Current task: <brief description>
```

---

## Reference Resources

| Resource | Path |
|----------|------|
| Shared technical constraints | `references/shared-standards.md` |
| Canvas format specification | `references/canvas-formats.md` |
| Image-text layout patterns (Primary structures + Modifier layers — combine freely) | `references/image-layout-patterns.md` |
| Image layout sizing (math for side-by-side container dimensions) | `references/image-layout-spec.md` |
| SVG image embedding | `references/svg-image-embedding.md` |
| Icon library | `templates/icons/README.md` |

---

## Notes

- Local preview: `python3 -m http.server -d <project_path>/svg_final 8000`
- **Troubleshooting**: on generation issues (layout overflow, export errors, blank images, etc.), check `docs/faq.md` for known solutions

```

### B2. references/strategist.md (verbatim)

```markdown
# Role: Strategist

## Core Mission

As a top-tier AI presentation strategist, receive source documents, perform content analysis and design planning, and output the **Design Specification & Content Outline** (hereafter `design_spec`).

## Pipeline Context

| Previous Step | Current | Next Step |
|--------------|---------|-----------|
| Project creation + Template option confirmed | **Strategist**: Eight Confirmations + Design Spec | Image_Generator or Executor |

---

## Canvas Format Quick Reference

> See [`canvas-formats.md`](canvas-formats.md) for the full format table (presentations / social / marketing) and the format-selection decision tree.

---

## 1. Eight Confirmations Process

🚧 **GATE — Mandatory read first**: `read_file templates/design_spec_reference.md` before any analysis or writing. The design_spec.md output MUST follow that template's 11-section structure exactly. After writing, self-check each section is present: I Project Info → II Canvas → III Visual Theme → IV Typography → V Layout → VI Icon → VII Visualization → VIII Image → IX Outline → X Speaker Notes → XI Tech Constraints.

⛔ **BLOCKING**: After the read, present professional recommendations for the eight items below as a bundled package and wait for explicit user confirmation.

> **Execution discipline**: This is the last BLOCKING checkpoint in the pipeline. After confirmation, complete the Design Spec and proceed to image generation / SVG / post-processing without further pauses.

### a. Canvas Format Confirmation

Recommend format based on scenario (see [`canvas-formats.md`](canvas-formats.md)).

### b. Page Count Confirmation

Provide specific page count recommendation based on source document content volume.

### c. Key Information Confirmation

Confirm target audience, usage occasion, and core message; provide initial assessment based on document nature.

### d. Style Objective Confirmation

Two layers. Output: `d. Style: <Mode> + <Visual style descriptor>`.

#### Layer 1 — Communication mode

| Mode | Core Focus | Target Audience | One-line Description |
|-------|-----------|----------------|---------------------|
| **A) General Versatile** | Visual impact first | Public / clients / trainees | "Catch the eye at a glance" |
| **B) General Consulting** | Data clarity first | Teams / management | "Let data speak" |
| **C) Top Consulting** | Logical persuasion first | Executives / board | "Lead with conclusions" |

Mode selection decision tree:

```
Content characteristics?
  ├── Heavy imagery / promotional ──→ A) General Versatile
  ├── Data analysis / progress report ──→ B) General Consulting
  └── Strategic decisions / persuading executives ──→ C) Top Consulting

Audience?
  ├── Public / clients / trainees ────→ A) General Versatile
  ├── Teams / management ────────────→ B) General Consulting
  └── Executives / board / investors → C) Top Consulting
```

#### Layer 2 — Visual style

Anchors the downstream confirmations e (Color), f (Icon), g (Typography), h (Image).

**Source**:
- User named a style → record verbatim as a short descriptor (normalize multilingual phrasings to a single canonical form)
- No user description → propose a default that fits the content (e.g., warm cultural tones for heritage content; clean minimalism for tech briefings; high-contrast editorial for magazine essays). Present as a recommendation; the user may override

**Common descriptors** (free-form, combinable, not enums):

| Axis | Examples |
|---|---|
| Aesthetic | minimalist / information-dense / Keynote / editorial / hand-drawn |
| Scenario | business consulting / academic defense / government briefing / product launch / education / pitch deck |
| Visual character | dark tech / pixel retro / neo-Chinese / Scandinavian / Memphis / cyberpunk / vaporwave |

Accept user combinations and one-off coinages ("Scandinavian + slight industrial"). The list is for recall, not constraint.

> **Template vs descriptor**: a style mention may sound like a template name ("academic style" vs the `academic_defense/` template directory). Step 3 only triggers on an explicit template directory path supplied by the user — bare names and style words never copy templates. If a template was triggered upstream, its files are already in `<project_path>/templates/`. Layer 2 only handles descriptors that did NOT come with a template path.

**Downstream effect**: e / f / g / h values realize the Layer 2 descriptor on top of the Layer 1 mode. Example: "A) Versatile + neo-Chinese" → e leans cinnabar / ink / rice-paper; g pairs serif (KaiTi-class) with sans body; f minimal line icons; h restrained traditional imagery with negative space.

### e. Color Scheme Recommendation

**Hard rule**: User / template colors are truth. If the user has specified colors (HEX, brand colors, or natural-language directives like "use blue as primary"), or a template was loaded at Step 3 via an explicit path (`<project_path>/templates/design_spec.md`), lock those directly and skip the recommendation table. Do not adjust them to fit any palette or industry default. Only when no color signal exists from user or template do you proactively propose a scheme below.

> Step 3 already collapses brand and layout inputs into one fused `design_spec.md`; this layer reads from that single source and does not need to re-resolve brand vs layout precedence.

Proactively provide a color scheme (HEX values) based on content characteristics and industry.

**Industry color quick reference** (full 14-industry list in `scripts/config.py` under `INDUSTRY_COLORS`):

| Industry | Primary Color | Characteristics |
|----------|--------------|-----------------|
| Finance / Business | `#003366` Navy Blue | Stable, trustworthy |
| Technology / Internet | `#1565C0` Bright Blue | Innovative, energetic |
| Healthcare / Health | `#00796B` Teal Green | Professional, reassuring |
| Government / Public Sector | `#C41E3A` Red | Authoritative, dignified |

**Color rules**: 60-30-10 rule (primary 60%, secondary 30%, accent 10%); text contrast ratio >= 4.5:1; no more than 4 colors per page.

### f. Icon Usage Confirmation

| Option | Approach | Suitable Scenarios |
|--------|----------|-------------------|
| **A** | Emoji | Casual, playful, social media |
| **B** | AI-generated | Custom style needed |
| **C** | Built-in icon library | Professional scenarios (recommended) |
| **D** | Custom icons | Has brand assets |

The built-in icon library contains multiple stylistic libraries plus a brand-logo library:

See [`../templates/icons/README.md`](../templates/icons/README.md) for the current library inventory, counts, prefixes, and SVG placeholder details.

> **Mandatory rules when choosing C**:
>
> **At the eight-confirmation stage — decide the library only. Do NOT run `ls | grep` yet.**
>
> 1. **Pick exactly one stylistic library** — read the source material, then choose the library whose visual character best serves the deck:
>    - **`chunk-filled`** — fill, straight-line geometry (M/L/H/V/Z only); sharp right angles; heavy, solid, architectural
>    - **`tabler-filled`** — fill, bezier curves and arcs (C/A); smooth, rounded, organic; medium weight, approachable
>    - **`tabler-outline`** — stroke (line art); airy, refined, lightweight; best for screen-only (thin strokes may be hard to read in print)
>    - **`phosphor-duotone`** — duotone; main shape + 20% opacity backplate; medium weight, layered, contemporary
>    - ⚠️ **One presentation = one stylistic library** for generic icons (home, chart, users, etc.). Mixing `chunk-filled` / `tabler-filled` / `tabler-outline` / `phosphor-duotone` is FORBIDDEN. If the chosen library lacks an exact icon, find the closest alternative **within that same library**.
>    - **Brand-logo exception**: `simple-icons` is NOT a stylistic library. Add it to the deck's icon inventory **only when** the deck genuinely contains real company / product / service brand marks (customer logos, tech-stack icons, social handles). Never substitute it for a missing generic icon.
> 2. **Stroke weight lock (stroke-style libraries only)** — for stroke-based libraries (currently `tabler-outline`), pick one deck-wide value from `{1.5, 2, 3}` (default `2`). For heavier presence, switch library instead of going above `3`.
>
> **After all eight confirmations are approved — when writing `design_spec.md` §VI / `spec_lock.md`**, then materialize the icon inventory:
>
> 3. Enumerate the concepts the deck actually needs (home, chart, users, …) based on the confirmed outline.
> 4. Search for each concept's filename in the chosen library: `ls skills/ppt-master/templates/icons/<chosen-library>/ | grep <keyword>`
> 5. Use the verified filename (without `.svg`) as the icon name; always include the library prefix (e.g., `chunk-filled/home`).
> 6. List the final icon inventory and chosen library in `design_spec.md` §VI; record the same in `spec_lock.md icons` (including `stroke_width` for stroke-style libraries). Executor may only use icons from this list.
>
> **Do NOT preload any index file** — when the inventory step arrives, use `ls | grep` to search on demand with zero token cost.

### g. Typography Plan Confirmation (Font + Size)

#### Font Combinations

> Same-deck fonts must form **contrast** (different family, weight, or proportion) or **concord** (one family throughout). "Similar but not identical" pairings *across roles* are forbidden — see blacklist below. *Within one stack*, pairing a Windows font with a macOS counterpart (e.g. `Microsoft YaHei` + `PingFang SC`) is encouraged as a browser-preview nicety; converter writes only the first into PPTX.

> **⚠️ PPT-safe font discipline (HARD rule).** PPTX has no runtime fallback — missing fonts substitute to Calibri. Every stack MUST end with a pre-installed font:
> - CJK → `"Microsoft YaHei"` / `SimHei` / `SimSun` / `FangSong` / `KaiTi`
> - Latin sans → `Arial` / `Calibri` / `Segoe UI` / `Verdana` / `Trebuchet MS`
> - Latin serif → `"Times New Roman"` / `Georgia` / `Cambria` / `Palatino` / `Garamond`
> - Mono → `Consolas` / `"Courier New"`
> - Display → `Impact` / `"Arial Black"`
>
> Stacks led by non-pre-installed fonts (Inter / HarmonyOS Sans / Source Han / brand typefaces like McKinsey Bower) are only acceptable when the Design Spec notes "requires install or PPTX embed".

**Forbidden — similar-but-not-identical pairings across roles** (do not split title vs body across these; within one stack as cross-platform fallback they remain encouraged):

- `Microsoft YaHei` ↔ `PingFang SC` ↔ `Heiti SC`
- `SimSun` ↔ `Songti SC` ↔ `STSong`
- `Arial` ↔ `Helvetica Neue` ↔ `Segoe UI`
- `"Times New Roman"` ↔ `Times`
- `Georgia` ↔ `Cambria`

**Mandatory**: propose **two** combinations to the user — one concord (safe), one contrast (with tension). Do not default to "title = body, same font" without explicit user request.

> **Template precedence**: when a template was loaded at Step 3 via an explicit path and declares `title` / `body` font stacks in `<project_path>/templates/design_spec.md §III Typography` / §IV (or whichever heading the fused spec uses), lock those directly and skip the two-combination presentation. Same precedence as e. — user override > template values.

**Cross-platform pre-installed reference**:

| Category | Safe families |
|----------|--------------|
| CJK sans | Microsoft YaHei, SimHei, PingFang SC, Heiti SC |
| CJK serif | SimSun, FangSong, KaiTi, Songti SC |
| Latin sans | Arial, Calibri, Segoe UI, Verdana, Trebuchet MS, Helvetica Neue |
| Latin serif | Times New Roman, Georgia, Cambria, Palatino, Garamond, Book Antiqua |
| Mono | Consolas, Courier New |
| Display | Impact, Arial Black |

**Seed combinations** (all PPT-safe; first column names the contrast axis, not a scenario):

| Contrast axis | Title stack | Body stack | Code stack |
|---|---|---|---|
| Serif × sans | `Georgia, KaiTi, serif` | `"Microsoft YaHei", "PingFang SC", sans-serif` | — |
| Kai × hei | `KaiTi, Georgia, serif` | `"Microsoft YaHei", "PingFang SC", sans-serif` | — |
| Fangsong × hei | `FangSong, "Times New Roman", serif` | `SimHei, "Microsoft YaHei", sans-serif` | — |
| Double serif | `Palatino, FangSong, serif` | `Cambria, SimSun, serif` | — |
| Same family, weight contrast (900 / 300) | `"Microsoft YaHei", "PingFang SC", sans-serif` | same | — |
| Display × neutral | `Impact, "Arial Black", SimHei, sans-serif` | `Arial, "Microsoft YaHei", sans-serif` | — |
| Cool serif (academic) | `Cambria, SimSun, serif` | `"Times New Roman", SimSun, serif` | — |
| Hei × song (政务) | `SimHei, "Microsoft YaHei", sans-serif` | `SimSun, serif` | — |
| Tech / developer | `Arial, "Microsoft YaHei", sans-serif` | same | `Consolas, "Courier New", monospace` |
| Concord (default fallback) | `"Microsoft YaHei", "PingFang SC", sans-serif` | same | — |

> **Stack length discipline (soft rule).** ≤4 fonts per stack. Lead with Windows-preinstalled fonts (Microsoft YaHei / SimSun / Arial / Georgia / Consolas); keep at most **one** macOS-exclusive family (typically `"PingFang SC"`). Converter only picks the first Latin and first CJK font ([`drawingml_utils.py parse_font_family`](../scripts/svg_to_pptx/drawingml_utils.py)); macOS→Windows fallback is auto-mapped via `FONT_FALLBACK_WIN`.

> **Non-pre-installed directions** (require install or PPTX embed; note the constraint in Design Spec):
> - **Retro / pixel** — Press Start 2P / VT323 / Silkscreen
> - **Rounded friendly** — Nunito / Quicksand / M PLUS Rounded / OPPO Sans (closest safe substitute: `Trebuchet MS` / `Verdana`)
> - **Modern web sans** — Inter / HarmonyOS Sans / Source Han Sans / Noto Sans
> - **Brand-specific** — McKinsey Bower, corporate VI typefaces

#### Font Size Ramp (all sizes in px)

> **Ramp, not a fixed menu.** All sizes derive from the `body` baseline as a ratio. `spec_lock.md typography` declares `body` plus the slots this deck uses (`title` / `subtitle` / `annotation` by default; add `cover_title` / `hero_number` / `chart_annotation` as needed). Executor may pick any intermediate px within a role's ratio band.

Baseline choice follows **content density**, not style. Common: `18px` (dense) / `24px` (relaxed). Other integers are fine — `16px` for chart-heavy, `20-22px` for medium, `28-32px` for poster/cover.

| Common recommendation | Points per Page | Body Baseline | Suitable Scenarios |
|----------------|----------------|---------------|-------------------|
| Relaxed | 3-5 items | 24px | Keynote-style, training materials |
| Dense | 6+ items | 18px | Data reports, consulting analysis |

| Level | Ratio to body | 24px baseline | 18px baseline |
|-------|---------------|---------------|---------------|
| Cover title (hero headline) | 2.5-5x | 60-120px | 45-90px |
| Chapter / section opener | 2-2.5x | 48-60px | 36-45px |
| Page title | 1.5-2x | 36-48px | 27-36px |
| Hero number (consulting KPIs) | 1.5-2x | 36-48px | 27-36px |
| Subtitle | 1.2-1.5x | 29-36px | 22-27px |
| **Body** | **1x** | **24px** | **18px** |
| Annotation / caption | 0.7-0.85x | 17-20px | 13-15px |
| Page number / footnote | 0.5-0.65x | 12-16px | 9-12px |

> Two baseline columns are illustrative only — for any other baseline (16/20/22/28/32…), multiply the row's ratio. Checker reads live `body` from `spec_lock.md`. Executor may pick any px within a role's band without pre-declaring; values outside **every** band require lock extension first.

### h. Image Usage Confirmation

| Option | Approach | Suitable Scenarios |
|--------|----------|-------------------|
| **A** | No images | Data reports, process documentation |
| **B** | User-provided | Has existing image assets |
| **C** | AI-generated | Custom illustrations, backgrounds needed |
| **D** | Web-sourced | Real-world reference imagery, editorial support, stock-style needs (no API key required for default providers) |
| **E** | Placeholders | Images to be added later |

**When recommending C** — surface its three implementation modes so the user knows "no API key" is a supported state:

| Mode | Trigger | Mechanism |
|---|---|---|
| **Path A** | `IMAGE_BACKEND` configured (default) | `image_gen.py` runs in Step 5 |
| **Path B** | `IMAGE_BACKEND` not configured AND host has a native image tool (Codex / Antigravity / Claude Code / similar) — auto-selected, no user prompting needed | Host-native generation |
| **Offline Manual** | `IMAGE_BACKEND` not configured AND host has no native image tool | Prompts written to `images/image_prompts.json`; user generates externally and places files in `project/images/` |

Selection is automatic in Step 5 (A → B → Manual). Detailed contract: [`image-generator.md`](./image-generator.md) §3.2.

Selections may be mixed at the row level — e.g. a deck can use C for hero illustrations while sourcing D for supporting team photos.

#### h.5 AI Image Strategy — lock rendering + palette (only when C is selected)

When the deck includes any `ai` rows, Strategist locks a **deck-wide rendering** and **deck-wide palette** here. These two values are written into `design_spec.md §III` and `spec_lock.md colors` / `images` sections, then consumed by Image_Generator. Every AI image in the deck shares them — this is what makes multiple AI images feel like one deck.

🚧 **GATE — before recommending values**: `read_file references/image-renderings/_index.md` and `read_file references/image-palettes/_index.md`. They contain the catalog, auto-selection tables, and a rendering × palette compatibility matrix.

#### Three-candidate presentation (default path)

**Hard rule**: Unless the user has already named a specific rendering or palette (chat or template), present **≥3 distinct rendering × palette combinations** and let the user pick. Never auto-lock a single combination silently.

**Per-candidate schema** (exactly 4 lines, no extras):

```
[Plan A] <temperament label> — <rendering> × <palette>
  Visual: <shape / line / material / light, 1-2 phrases>
  Color: <secondary HEX (ratio) + primary HEX (ratio) + accent HEX (ratio); HEX values from e.>
  Mood: <2-3 traits>; like <real-world analogy: company / publication / event>
```

After the candidates, append one line:

```
> Reference images: see references/ai-image-comparison/ for matching PNGs by name.
```

**Hard rules for candidate construction**:

| Rule | Behavior |
|---|---|
| Filter by e.'s HEX | Only include palettes whose temperament can carry the user's HEX. Vivid red → exclude `cool-corporate` / `mono-ink`; include `vivid-launch` / `warm-earth` / `editorial-classic`. |
| HEX values in `Color` line MUST be e.'s real values | Palette contributes only the 60-30-10 ratio + role assignment. Never substitute the palette's typical HEX. |
| Span a personality spectrum | Typically: one conservative-default (industry norm), one shifted-tone (same fit, 1-2 ticks different), one bold-contrast (more expressive, may challenge default). No near-duplicates. |
| `Mood` line MUST include a real-world analogy | Company / publication / event the user can picture. Adjective stacks alone are forbidden. |
| Adapt labels to chat language | Schema is English by default. Chinese chat → render as 「方案 A / 视觉 / 色彩 / 情绪」. Structure stays the same; only the labels translate. |
| Skip presentation when user has specified | User-named rendering or palette (chat / brand / template) bypasses the candidate flow — lock directly per the truth-precedence rule. |

**Forbidden — padding with conflicts**: if e.'s HEX cannot find ≥3 compatible palettes, present the smaller set (2 candidates) and state "your color is unusual — only N palettes can carry it without conflict." Never fill remaining slots with known-conflicting options.

**Worked example** (e. = `#1E3A5F` navy + `#F8F9FA` off-white + `#D4AF37` gold; d. = consulting; chat in English):

```
[Plan A] Restrained Professional — vector-illustration × cool-corporate
  Visual: flat vector, solid color blocks, no gradients or shadows
  Color: off-white #F8F9FA (60-70%) + deep navy #1E3A5F main (25-30%) + gold #D4AF37 accent (<5%)
  Mood: steady, trustworthy, restrained gravitas; like a McKinsey consulting report

[Plan B] Editorial Depth — editorial × editorial-classic
  Visual: magazine layout, 8% paper texture, column-based partitioning
  Color: off-white #F8F9FA paper (55%) + deep navy #1E3A5F column (30%) + gold #D4AF37 rule line (10-14%)
  Mood: refined, considered, paced; like an Economist feature spread

[Plan C] Future Energy — 3d-isometric × tech-neon
  Visual: isometric 3D, soft shading, 8% glow halos around bright elements
  Color: off-white #F8F9FA digital field (50%) + deep navy #1E3A5F main (35%) + gold #D4AF37 emphasis (10-15%)
  Mood: forward, energetic, futuristic; like an Apple or Stripe product keynote

> Reference images: see references/ai-image-comparison/ for matching PNGs by name.
```

After the user picks a candidate (or supplies a custom variant), proceed to "Recording the lock" below.

---

#### Catalog reference (for candidate construction)

The tables below are source data Strategist reads when constructing the three candidates above. They are no longer the final output by themselves.

**Rendering recommendation** (soft — user may override with any other rendering from the catalog):

| `d. Style` signal | Recommended rendering | Alternates |
|---|---|---|
| Top Consulting / strategic / MBB | `editorial` or `vector-illustration` | `blueprint`, `minimalist-swiss` |
| General Consulting / corporate report / 学术答辩 | `vector-illustration` | `flat`, `editorial` |
| High-end consulting / luxury / 高端 / design-firm | `minimalist-swiss` | `editorial`, `vector-illustration` |
| Tech / SaaS / AI / 架构 | `3d-isometric`, `blueprint`, `digital-dashboard` | `flat` |
| Modern SaaS / fintech / health-tech / premium app | `glassmorphism` | `digital-dashboard`, `flat` |
| Product launch / brand / marketing | `flat`, `3d-isometric`, `corporate-photo` | `vector-illustration` |
| Education / training / 教学 / 培训 | `sketch-notes` | `vector-illustration`, `paper-cut` |
| Children / storybook / 儿童 / 治愈 | `fantasy-animation` | `paper-cut`, `watercolor`, `sketch-notes` |
| Cultural / folk / festival / 文化 / 节日 | `paper-cut` | `vintage-poster`, `screen-print` |
| Methodology / Before-After / 方法论 / manifesto | `ink-notes` | `editorial` |
| Government / formal / 政务 | `editorial` or `corporate-photo` | `vector-illustration` |
| Finance / journalism / 财经 | `editorial`, `digital-dashboard` | `vector-illustration` |
| Personal story / 个人成长 / lifestyle | `watercolor`, `warm-scene` | `corporate-photo`, `paper-cut` |
| Cultural / media / opinion / cinematic | `screen-print`, `vintage-poster` | `editorial`, `warm-scene` |
| Brand heritage / hospitality / 老字号 / 周年 | `vintage-poster` | `screen-print`, `editorial` |
| Gaming / retro / 复古 / 像素 | `pixel-art` | `vintage-poster` |
| Environment / wellness / 环保 | `nature` | `watercolor`, `paper-cut` |
| Classroom / blackboard / 课堂 | `chalkboard` | `sketch-notes` |
| Team / company / product photo | `corporate-photo` | — |

**Palette recommendation** (soft — user may override):

| Content vibe / industry | Recommended palette | Alternates |
|---|---|---|
| Consulting / finance / B2B / corporate / 学术答辩 | `cool-corporate` | `editorial-classic`, `frost-ice` |
| Tech / SaaS / AI | `tech-neon` | `cool-corporate`, `dark-cinematic` |
| Modern SaaS / fintech / health-tech | `frost-ice` | `cool-corporate`, `tech-neon` |
| Health / medical / beauty / skincare | `frost-ice` | `nature-organic`, `earthy-dusty` |
| Education / training | `macaron` | `warm-earth` |
| Methodology / Before-After | `mono-ink` | `editorial-classic` |
| Personal / lifestyle / brand story | `warm-earth` | `nature-organic`, `earthy-dusty` |
| Interior / wellness / mindfulness / slow living | `earthy-dusty` | `warm-earth`, `nature-organic` |
| Product launch / marketing | `vivid-launch` | `tech-neon`, `sunset-gradient` |
| Creative agency / travel / music / lifestyle | `sunset-gradient` | `vivid-launch`, `warm-earth` |
| Luxury / fashion / jewelry / premium / heritage | `jewel-tone` | `dark-cinematic`, `editorial-classic` |
| Children / storybook | `macaron` | `warm-earth` |
| Premium / film / entertainment | `dark-cinematic` | `jewel-tone`, `duotone` |
| Cultural / media / cover-art | `duotone` | `editorial-classic` |
| Environment / wellness | `nature-organic` | `warm-earth`, `earthy-dusty` |
| Finance / journalism | `editorial-classic` | `cool-corporate` |

After auto-selecting, cross-check `image-palettes/_index.md` compatibility matrix — if rendering × palette is `✗`, swap to the alternate palette.

**d-e-f-g linkage sanity check** (do this after picking rendering + palette):

| Linkage | What to verify |
|---|---|
| **d. Style ↔ rendering** | Rendering family should match the Style descriptor's temperament (corporate ≠ sketch-notes; tech ≠ watercolor). Already enforced by the recommendation table above. |
| **e. Color HEX ↔ palette** | HEX is truth — palette is just the "how to use these HEX" rulebook for AI images (saturation / contrast / 60-30-10 / material). Mismatch → **always swap palette to fit the HEX, never adjust the HEX to fit a palette**. E.g. user gives a vivid red but you auto-picked cool-corporate — switch to vivid-launch or warm-earth, do not propose dimming the red. |
| **f. Icon library ↔ rendering** | `tabler-outline` pairs well with all renderings (most versatile). `chunk-filled` / `tabler-filled` pair better with `vector-illustration` / `flat` / `editorial`. `phosphor-duotone` pairs with `flat` / `digital-dashboard`. Mismatch is not fatal but worth flagging. |
| **g. Typography ↔ rendering** | Serif title → pairs well with `editorial`, `corporate-photo`, `screen-print`. Hand-lettered direction → already implied by `sketch-notes` / `ink-notes` (the rendering carries the lettering, no separate font requirement). Display font → `vivid-launch` / `screen-print`. Mismatch is rarely fatal; note in conversation if it feels off. |

**Recording the lock** — after picking, write to:

- `design_spec.md §III Visual Theme` — add two lines under the color table:
  ```
  - **Image Rendering**: vector-illustration
  - **Image Palette**: cool-corporate
  ```
- `spec_lock.md colors` section — add two extra rows at the bottom:
  ```
  - image_rendering: vector-illustration
  - image_palette: cool-corporate
  ```

Image_Generator reads these two fields and applies them deck-wide. If both are absent (legacy decks), Image_Generator falls back to inferring them from `d. Style` and `e. Color` — quality is acceptable but not optimal. Always lock both when C is selected.

#### hero_page suggestion (same confirmation turn)

After the user picks a candidate, scan the outline and surface any pages where the image makes more sense as the page's main voice than as a local block. Present them as a short list and let the user confirm, edit, or skip. Result is recorded as `page_role: hero_page` on the matching `ai` rows. Density is judgment-based — no fixed quota.

**When selection includes B**, you must run `python3 scripts/analyze_images.py <project_path>/images` before outputting the spec, and integrate scan results into the image resource list.

**When B / C / D / E is selected**, add an image resource list to the spec:

| Column | Description |
|--------|-------------|
| Filename | e.g., `cover_bg.png` |
| Dimensions | e.g., `1280x720` |
| Ratio | e.g., `1.78` |
| Layout suggestion | e.g., `Wide landscape (suitable for full-screen/illustration)` |
| **Layout pattern** | **MANDATORY** — one or more `#<id> <name>` joined by ` + ` from `image-layout-patterns.md`. Combine a Primary id with optional Modifier ids when the page needs it (e.g. `#48 side-by-side comparison + #21 rounded rectangle crop + #29 two-stop scrim`). A single Primary is fine when the page calls for it. See the GATE earlier in this section. Empty cells or invented ids are invalid. |
| Purpose | e.g., `Cover background` |
| Type | Narrative shorthand: Background / Photography / Illustration / Diagram / Decorative pattern. (The internal-composition type used by Image_Generator — one of `background / hero / typography / infographic / flowchart / framework / comparison / timeline / scene` — is inferred from `Purpose` per [`image-type-templates/_index.md`](./image-type-templates/_index.md); no need to label every row.) |
| **Acquire Via** | `ai` / `web` / `user` / `placeholder` — drives Step 5 dispatch |
| Status | Initial status must be `Pending`, `Existing`, or `Placeholder`; see [`svg-image-embedding.md`](svg-image-embedding.md) for the full status enum |
| **Reference** | Free-form **intent description** (NOT a search query); feeds Image_Generator (ai) or Image_Searcher (web) |
| `text_policy` (optional, `ai` rows only) | `none` (no text in image) or `embedded` (text is part of the artwork). Leave blank when Image_Generator should decide per row. Long body / data / lists stay in SVG. |
| `page_role` (optional, `ai` rows only) | `local` (image is a region block on an SVG page) or `hero_page` (image is the page's main voice). Leave blank when Image_Generator should decide per row. |

**No-crop flag (exception only)**: most images are croppable — Executor defaults to `preserveAspectRatio="xMidYMid slice"`. When an image must NOT lose pixels (data screenshots, charts, certificates, contracts, dense diagrams), append `no-crop` to its `spec_lock.md images` entry. Executor will then size the container to the native ratio and use `meet`. Don't tag the rest.

**Reference field**: Write visual intent, not provider mechanics.

| ✅ Intent description | ❌ Avoid |
|---|---|
| "Diverse engineering team collaborating around a laptop, modern office, natural light" | "team laptop office" |
| "Abstract atmospheric backdrop for academic-defense cover, calm center for text overlay, hint of campus skyline" | "use openverse, search 'office'" |
| "Sunlit forest path in autumn" | "team photo" |

**Per-row Reference grammar**:

| Acquire Via | Reference pattern |
|---|---|
| `ai` | **Subject + intent + composition** only. Do NOT repeat style words ("flat design", "modern", "vector") or HEX values — both are already locked deck-wide by h.5 (rendering + palette) and `design_spec §III` (colors). Image_Generator's prompt assembler injects them automatically. |
| `web` | Concrete subject/place/object first, then 1-3 quality descriptors |

**Allowed web quality descriptors**:

| Descriptor | Use |
|---|---|
| `professional editorial photography` | Stock-style photography |
| `clean composition` | Covers, section dividers, image-text layouts |
| `natural light` | People, workplace, travel, lifestyle scenes |
| `high-resolution` | Large visual areas |

**Forbidden — web negative prompts**: `not tourist snapshot`, `no phone photo`, `avoid amateur style`.

| Mode | Good Reference |
|---|---|
| `web` | "Diverse team collaborating at a modern office desk, professional editorial photography, natural light, laptop visible" |
| `ai` | "Atmospheric backdrop suggesting digital innovation; calm central area reserved for slide title overlay; light geometric anchor at one edge" |
| `ai` | "Four-stage value chain from raw input to R&D output; icons should suggest tax-form → cost-reduction → equipment-upgrade → innovation; no text labels (SVG overlays them)" |

**Image type descriptions**:

| Type | Suitable Scenarios |
|------|-------------------|
| Background | Full-page backgrounds for covers/chapter pages; reserve text area |
| Photography | Real scenes, people, products, architecture |
| Illustration | Flat design, vector style, concept diagrams |
| Diagram | Flowcharts, architecture diagrams, concept relationship maps |
| Decorative pattern | Partial decoration, textures, borders, divider elements |

🚧 **GATE — before writing §VIII Image Resource List**: when image approach is B/C/D/E (anything other than A "no images"), this is a three-layer hard requirement, not a suggestion:

1. **Read** — `read_file references/image-layout-patterns.md`. The file enumerates 72 numbered techniques split into **Part 1 — Primary Structures** (#1–#19 container layouts, #38–#46 image-as-canvas + native overlay, #47–#56 multi-image) and **Part 2 — Modifier Layers** (#20–#26 non-rectangular crops, #27–#37 overlays & masks, #57–#61 texture, #62–#72 special). The four `Image narrative intent` values below cover only broad categories.
2. **Produce** — every row in §VIII Image Resource List MUST fill the `Layout pattern` column with one or more `#<id> <name>` joined by ` + ` drawn verbatim from this file (Primary + optional Modifiers). Rows with empty `Layout pattern` or with an id that does not exist in the file are invalid.
3. **Image-as-canvas coverage** — for any deck with ≥4 image-bearing pages, at least one page MUST use a `#38–#46` pattern (image-as-canvas + native overlay) unless every image is a pure cover / chapter divider / atmosphere backdrop. This family is the most-skipped one and is usually the right answer for content-rich pages with photographs. If the deck legitimately has no opportunity for it, state the reason in §VIII directly under the table.

**Skip-detection signal for self-audit**: if you notice that every page's `Layout pattern` column resolves to #2/#3 (left-third or right-third), #5/#6 (top-bottom band), or generic side-by-side, you have not actually consulted the file — re-read and reconsider. The default left/right and top/bottom split bias is the failure mode this gate exists to break.

**Image narrative intent** (decide *before* the ratio table — determines whether the image lives in a container at all):

| Intent | Form | When to use |
|--------|------|-------------|
| **Hero / full-bleed** | Image fills canvas/dominant zone; title floats over with gradient or opacity overlay | Covers, chapter dividers, `breathing` pages — image *is* the message |
| **Atmosphere / background** | Image as low-contrast backdrop (reduced opacity or dark overlay); text reads on top | Section backgrounds, mood-setting — image sets tone, text carries info |
| **Side-by-side** | Image and text as adjacent coequal blocks — ratio table below governs container sizing | Most content pages — image and text read together |
| **Accent / inline** | Small image beside related text, not a container; no ratio matching | Supporting visuals, spot illustrations |

> Intent follows narrative purpose, not image ratio. Don't default every image page to side-by-side.

**Side-by-side ratio alignment** (consult only when the chosen intent is *side-by-side*; detailed calculation rules in `references/image-layout-spec.md`):

| Image Ratio | Recommended Container Layout |
|-------------|-----------------------------|
| > 2.0 (ultra-wide) | Top-bottom split, top full-width |
| 1.5-2.0 (wide) | Top-bottom split |
| 1.2-1.5 (standard landscape) | Left-right split |
| 0.8-1.2 (square) | Left-right split |
| < 0.8 (portrait) | Left-right split, image on left |

Side-by-side only: container ratio must match image ratio. Hero / atmosphere / accent intents ignore ratio alignment.

> **Portrait canvases** (Xiaohongshu, Story): Layout rules differ — top-bottom is preferred for most ratios since left-right columns become too narrow. See "Portrait Canvas Override" in `references/image-layout-spec.md`.

> **Multi-image slides**: When multiple images appear on one page, use the grid formulas in the "Multi-Image Layout" section of `references/image-layout-spec.md`.

> **Pipeline handoff**: When C) AI generation is selected, Image_Generator consumes `Pending` rows and updates them to `Generated` or `Needs-Manual` before Executor proceeds. Status names are defined in [`svg-image-embedding.md`](svg-image-embedding.md).

### Template Match — Visualization + Structural Patterns (Non-blocking — Strategist recommends, no user confirmation needed)

The catalog covers **both data charts and structural information designs**. A "match" is not limited to numeric pages — any page whose content shape matches a `Pick for ...` clause is a candidate:

- **Data-type pages**: comparisons, trends, proportions, KPIs, financials, rankings, distributions, conversion funnels
- **Structural-type pages**: team rosters, agendas, principles & values, methodology phases, customer journey, capability maps, OKR cascades, roadmaps, strategic frameworks (SWOT / BCG / PEST / Porter's Five Forces / Value Chain — matched via `quadrant_text_bullets`, `quadrant_bubble_scatter`, `vertical_pillars`, `hub_inward_arrows`, `chevron_chain_with_tail` respectively)

The most common Strategist failure mode is missing the structural half — treating "chart" as "numeric chart only" and leaving team / agenda / principles / journey pages as text-only when a template would fit. Read the catalog with both lenses.

> **Reading is mandatory; the catalog is a starting point, not a copy target.**
> - Fully read `templates/charts/charts_index.json` **before drafting the Eight Confirmations** — the read happens up front, not when you sit down to write Section VII. The file contains `meta` + `charts.<key>.summary` only; each `summary` is a selection rule (`"Pick for … Skip if …"`), not a description. There is **no category, quickLookup, or keyword index** — selection is done by semantically matching each page's content shape against all 71 summaries in one pass.
> - Not every page needs a chart. When a page's information structure matches a catalog entry, **use that template as a structural starting point** — keep the visualization type and core layout logic, then adapt composition, density, color, decoration, and accompanying elements to fit this deck's content and visual tone. Free adjustment is encouraged; what is forbidden is (a) generating without reading the catalog, and (b) blind verbatim mimicry that ignores the page's actual content weight.
>
> **Workflow**:
> 1. Read all 71 summaries; for each page, identify the Pick clause that matches the page's content shape AND does not match any Skip clause.
> 2. Prefer specificity (`vertical_list` over generic `numbered_steps`).
> 3. One primary visualization per page; a supporting layout may accompany it.
> 4. List selections in Design Spec section VII; section IX only notes the visualization type name per page.
>
> **Source vocabulary mismatch** — the catalog is in English. When source content uses Chinese / industry jargon ("中台", "架构图", "述职", "管道", "前后端"), translate the intent first, then match against summaries. The catalog deliberately keeps no keyword index — full-read forces semantic matching rather than lexical grep.
>
> **Read-audit (mandatory, section VII format)** — single combined table; `summary-quote` column is the anti-fabrication audit, `path` + `usage` serve Executor lookup. Format defined in [`templates/design_spec_reference.md`](../templates/design_spec_reference.md) §VII:
> ```
> Catalog read: 71 templates
>
> | Page | Template      | Path                              | Summary-quote (verbatim) | Usage |
> | ---- | ------------- | --------------------------------- | ------------------------ | ----- |
> | P03  | bar_chart     | templates/charts/bar_chart.svg    | "<verbatim first sentence>" | <intent> |
> | P07  | line_chart    | templates/charts/line_chart.svg   | "<verbatim first sentence>" | <intent> |
> | P11  | pie_chart     | templates/charts/pie_chart.svg    | "<verbatim first sentence>" | <intent> |
>
> Runners-up considered (3 entries minimum, drawn from real second-best matches):
> - <key_A> | rejected for P03: <reason citing this deck's specifics>
> - <key_B> | rejected for P07: <reason>
> - <key_C> | rejected for P11: <reason>
> ```
> The `summary-quote` must be copy-pasted from `charts_index.json` — paraphrasing or summarizing breaks the audit. Every template name listed (selected or rejected) must `grep` cleanly inside `charts_index.json` (so misspelled or invented keys fail). If fewer than 3 visualization pages exist, list what exists and note "fewer than 3 viz pages"; runners-up still required for each page that does exist.
>
> **Fallback when no template fits**:
> 1. Re-read the full summary list with the page's intent re-stated in plain language — "non-obvious" matches often surface on the second pass (e.g. "causal chain" → `process_flow` or `sankey_chart`).
> 2. If still no fit: data-driven content → table layout; conceptual/illustrative → "AI-generated image" (Image_Generator handles); structural → "custom layout".
> 3. Mark the page `no-template-match` in section VII with the fallback chosen and why. Do NOT silently substitute a close-but-wrong chart.

### Speaker Notes Requirements (Default — no discussion needed)

- File naming: Recommended to match SVG names (`01_cover.svg` → `notes/01_cover.md`), also compatible with `notes/slide01.md`
- Fill in the Design Spec: total presentation duration, notes style (formal / conversational / interactive), presentation purpose (inform / persuade / inspire / instruct / report)
- Split note files must NOT contain `#` heading lines (`notes/total.md` master document MUST use `#` heading lines)

---

## 2. Executor Style Details (Reference for Confirmation Item #4)

### A) General Versatile — Executor_General

- **Capabilities**: full-width images + gradient overlays; free creative layouts; variants (image-text / minimalist / creative)
- **Scenarios**: promotions, product launches, training, brand campaigns
- **Avoid**: rigid/formal tone, dense data tables

### B) General Consulting — Executor_Consultant

- **Capabilities**: KPI dashboards (4-card, big numbers + trend arrows); chart combinations (bar/line/pie/funnel); status color grading (R/Y/G)
- **Scenarios**: progress reports, financial analysis, government reports, proposals
- **Avoid**: flashy decoration, image-dominated slides

### C) Top Consulting — Executor_Consultant_Top

| Rule | Detail |
|------|--------|
| Data contextualization | Every data point gets a comparison ("grew 63% — industry avg 12%") |
| SCQA framework | Situation → Complication → Question → Answer |
| Pyramid principle | Conclusion first; core insight in title |
| Strategic coloring | Color serves information, not decoration |
| Chart vs Table | Trends → charts; precise values → tables |

- **Page elements**: gradient top bar + dark takeaway box, confidential marking + footer, MECE / driver tree / waterfall
- **Scenarios**: strategic decisions, deep analysis, MBB-level deliverables
- **Avoid**: isolated data, subjective statements, decoration

---

## 3. Color Knowledge Base

### Consulting Style Colors

| Brand | HEX |
|-------|-----|
| Deloitte Blue | `#0076A8` |
| McKinsey Blue | `#005587` |
| BCG Dark Blue | `#003F6C` |
| PwC Orange | `#D04A02` |
| EY Yellow | `#FFE600` |

### General Versatile Colors

| Style | HEX |
|-------|-----|
| Tech Blue | `#2196F3` |
| Vibrant Orange | `#FF9800` |
| Growth Green | `#4CAF50` |
| Professional Purple | `#9C27B0` |
| Alert Red | `#F44336` |

### Data Visualization Colors

- Positive trend (green): `#2E7D32` → `#4CAF50` → `#81C784`
- Warning trend (yellow): `#F57C00` → `#FFA726` → `#FFD54F`
- Negative trend (red): `#C62828` → `#EF5350` → `#E57373`

---

## 4. Layout Pattern Library

> **Principle — proportion follows information weight, not preset ratios.** Combine patterns, break the grid for `breathing` pages, or propose new patterns. Defaulting every page to symmetric grid produces the "AI-generated" look.

| Pattern | Suitable Scenarios | PPT 16:9 Reference Dimensions |
|--------|-------------------|-------------------------------|
| Single column centered | Covers, conclusions, key points | Content width 800-1000px, horizontally centered |
| Symmetric split (5:5) | Comparisons where two sides carry equal weight | Column ratio 1:1, gap 40-60px |
| Asymmetric split (3:7 / 2:8) | One side dominates — chart vs. takeaway, image vs. caption | Heavier side 840-1024px, lighter side 256-440px |
| Three-column | Parallel points, process steps | Column ratio 1:1:1, gap 30-40px |
| Four-quadrant / matrix | Two-axis classification, strategic quadrants | Quadrant 560x250px, gap 20-30px |
| Top-bottom split | Ultra-wide images + text, processes, timelines | Image full-width, text area >= 150px height |
| Z-pattern / waterfall | Storytelling, case studies — blocks alternate left/right | Guide eye in Z; 3-5 alternating blocks |
| Center-radiating | Core concept + surrounding nodes | Center element 200-300px, 4-6 satellite nodes |
| Full-bleed + floating text | `breathing` / feature pages | Image fills 1280x720, text floats over opacity overlay |
| Figure-text overlap | Hero moments — headline over/against image edge | Text partially overlaps image, not beside it |
| Negative-space-driven | Single element in 40-60% whitespace | One idea, weight through emptiness |

**PPT 16:9 (1280x720) key dimensions**: Safe area 1200x640 (40px margins); Title area 1200x100; Content area 1200x500; Footer area 1200x40.

---

## 5. Template Flexibility Principle

Templates are starting points. The Strategist may adjust based on content and audience:

1. Font size ratios — reference values, adjustable
2. Color schemes — customize per brand/content
3. Layout patterns — combine, nest, or break (§4 lists 11 patterns as reference, not exhaustive)
4. 12-chapter framework — expand or reduce
5. Spacing / border radius — Executor adjusts per content density and `page_rhythm`

---

## 6. Workflow & Deliverables

### 6.1 Content Planning Strategy

| Style | Content Outline | Speaker Notes |
|-------|----------------|---------------|
| A) General Versatile | Per-page core theme from source doc | Concise script |
| B) General Consulting | Structured sections, data-driven insights | Professional terms, conclusion-first |
| C) Top Consulting | SCQA + pyramid principle | Highly condensed, conclusion-driven |

### 6.2 Outline Output Specification (Must include 11 chapters)

| Chapter | Content Requirements |
|---------|---------------------|
| I. Project Information | Project name, canvas format, page count, style, audience, scenario, date |
| II. Canvas Specification | Format, dimensions, viewBox, margins, content area |
| III. Visual Theme | Style description, light/dark theme, tone, color scheme (with HEX table), gradient scheme |
| IV. Typography System | Font plan (per-role families — title / body / emphasis / code), font size hierarchy |
| V. Layout Principles | Page structure (header/content/footer zones), layout pattern library (combine/break as content demands), spacing spec |
| VI. Icon Usage Spec | Source description, placeholder syntax, recommended icon list |
| VII. Visualization Reference List | Visualization type, reference template path, used-in pages, purpose |
| VIII. Image Resource List | Filename, dimensions, ratio, purpose, status, generation description |
| IX. Content Outline | Grouped by chapter; each page includes layout, title, content points, visualization type (if applicable) |
| X. Speaker Notes Requirements | File naming rules, content structure description |
| XI. Technical Constraints Reminder | SVG generation rules, PPT compatibility rules |

**Generation steps**:
1. Read reference template: `templates/design_spec_reference.md`
2. Generate complete spec from scratch based on analysis
3. Save to: `projects/<project_name>.../design_spec.md`
4. **Generate execution lock**: read `templates/spec_lock_reference.md` and produce `projects/<project_name>.../spec_lock.md` — a distilled, machine-readable short form of the color / typography / icon / image / **page_rhythm** / **page_layouts** / **page_charts** decisions above. This file is what the Executor re-reads before every page (see [executor-base.md](executor-base.md) §2.1). The values in `spec_lock.md` MUST exactly match the decisions recorded in `design_spec.md`; if they ever diverge, `spec_lock.md` wins and `design_spec.md` should be treated as historical narrative.
   - **page_rhythm is mandatory**: Based on the page list in §IX Content Outline, assign each page one of `anchor` / `dense` / `breathing` (see `spec_lock_reference.md` for the full vocabulary). This is what breaks the uniform "every page is a card grid" feel — without it the Executor defaults all pages to `dense`.
   - **Rhythm follows narrative, not quota**: `breathing` pages mark natural pauses — chapter transitions, standalone emphasis (hero quote / big number), SCQA bridges. Dense decks may legitimately be all `dense`. **Do NOT invent filler pages** ("Thank you", empty dividers) to pad rhythm — every `breathing` page must say something independent.
   - **page_layouts (write only when a template is in use)**: For each page that inherits a template SVG, add `P<NN>: <svg_basename>` (e.g., `P04: 03a_content_image_text`). Pages designed freely get **no entry** — Executor reads the absence as "free design, no inheritance". If zero pages use a template, omit the section entirely.
   - **page_charts (write only for chart pages that match a catalog template)**: For each page in `design_spec.md §VII` whose `reference template path` points to `templates/charts/<name>.svg`, add `P<NN>: <chart_name>`. Pages with `no-template-match` in §VII MUST NOT appear here (Executor would look for a non-existent reference). If the deck has no data-visualization pages, omit the section.
   - **Hard rule**: Use both `page_layouts` and `page_charts` for the same page only when the layout template is a compatible shell for the chart. Do not pair chart pages with conflicting page layouts (e.g., `waterfall_chart` + timeline layout, KPI cards + circle-diagram layout). If no compatible layout exists, omit the page from `page_layouts`.

---

## 7. Project Folder

Project folder must exist before Strategist runs. If not, execute:

```bash
python3 scripts/project_manager.py init <project_name> --format <canvas_format>
```

Save outputs to `projects/<project_name>_<format>_<YYYYMMDD>/design_spec.md`.

---

## 8. Complete Design Spec and Prompt Next Steps

After writing `design_spec.md` and `spec_lock.md`, output the next-step prompt below. This is a handoff instruction, not part of `design_spec.md`. Pick the variant by whether Step 3 copied a template into `<project_path>/templates/`.

### Template mode (template applied in Step 3)

```
✅ Design spec complete. Template ready.
Next step:
- Images include AI generation → Invoke Image_Generator
- Otherwise → Invoke Executor
```

### Free design (default, no template)

```
✅ Design spec complete.
Next step:
- Images include AI generation → Invoke Image_Generator
- Otherwise → Invoke Executor (free design for every page)
```

```

### B3. references/executor-base.md (verbatim)

```markdown
# Executor Common Guidelines

> Style-specific content is in the corresponding `executor-{style}.md`. Technical constraints are in shared-standards.md.

---

## 1. Template Adherence Rules

### 1.0 Pre-generation Batch Read

**Hard rule**: Before the first SVG page, batch-read every template SVG this deck will reference. Read once up front, never re-read during generation.

| Source list | Read path |
|---|---|
| Chosen template's `design_spec.md` (read frontmatter to detect `replication_mode`) | `templates/<chosen_template>/design_spec.md` |
| Every distinct `<basename>` in `spec_lock.md page_layouts` | `templates/<chosen_template>/<basename>.svg` |
| Every distinct chart name in `spec_lock.md page_charts` | `templates/charts/<chart_name>.svg` |
| Chart types in `design_spec.md §VII` not covered above | `templates/charts/<chart_name>.svg` |

**Forbidden — re-reading during generation**:
- Layout SVG already loaded in this batch
- Chart SVG already loaded in this batch

`spec_lock.md` is the only file re-read per page (§2.1).

**Exception**: user mid-deck adds pages or swaps templates introducing a basename/chart absent from the original batch → read the new file once, continue.

> Note: batched prefix reads stay in the cached prompt prefix; per-page `spec_lock.md` re-reads append below and benefit from that cache. Scattered on-demand reads of layout/chart SVGs would invalidate downstream cache and sit in the compression-vulnerable mid-context region.

Resolve the per-page template SVG via `spec_lock.md page_layouts` (authoritative). The legacy page-type table below is a **last-resort fallback** for legacy decks where `page_layouts` is missing.

**Resolution order (per page):**

1. **Mirror-mode template** (template's `design_spec.md` frontmatter has `replication_mode: mirror`) → see §1.1 below. The page is consumed as a **visual reference**, not as a placeholder shell.
2. `spec_lock.md page_layouts` has `P<NN>: <basename>` for this page → inherit the structure of `templates/<chosen_template>/<basename>.svg` (already in context from §1.0).
3. `page_layouts` exists but **no entry** for this page → **free design**, no template inheritance.
4. `page_layouts` section absent (legacy deck) **and** `templates/` directory exists → fall back to the page-type table below, matching by SVG filename keyword (cover/chapter/content/ending/toc). Read the matched file at first use if §1.0 batch did not cover it.
5. No template at all → free design.

> Note: `page_layouts` disambiguates the multiple content variants modern templates ship (e.g., `graduation_defense` has 8); the legacy table cannot.

### 1.1 Mirror-mode templates — reference-style consumption

When the project's chosen template is a `mirror` template (`design_spec.md` frontmatter declares `replication_mode: mirror`), Executor switches to a **reference-style** consumption path that bypasses placeholder substitution:

1. **Per-page reference selection** — Strategist selects one mirror page per project page via `spec_lock.md page_layouts` (e.g., `P04: 015_content`). The basename is the mirror filename without extension; Strategist made this choice by reading `design_spec.md §V Page Roster` descriptions, not by guessing.
2. **Copy, don't fill** — open the referenced mirror SVG (already in context from §1.0). **Copy it as the starting point for the project page**, then edit text elements in place to express the project's content for `P<NN>`. Preserve every non-text element verbatim: backgrounds, decorative shapes, sprite-cropped images, charts, icon usage, color values, font families, geometry, sprite `<svg viewBox>` wrappers, `<image>` references.
3. **What you may edit** — the visible text content of `<text>` / `<tspan>` elements that express slide-specific content (title, body, captions, KPI labels, dates, page numbers). Replace the source deck's example text with the project's text for this page from `design_spec.md §IX` and `notes/<NN>_*.md`.
4. **What you must not touch** — element positions, sizes, fonts, colors, fills, strokes, gradients, image hrefs, `<g>` grouping, sprite-sheet `<svg viewBox>` wrappers, decorative `<rect>` / `<path>` / `<circle>` / `<polygon>` shapes, `<use data-icon="...">` markers, embedded chart data structures. Mirror's value is preserving the source deck's visual identity — any geometric / decorative drift defeats the purpose.
5. **Content fit** — the mirror page was chosen by Strategist because its layout matches the content slot. If the project's content for `P<NN>` legitimately needs more / fewer items than the mirror page provides (e.g. mirror shows 3 KPI cards, project has 4 metrics), keep the mirror page's visual rhythm and either drop one metric to fit or split across two pages — do **not** restructure the mirror page's grid. If neither works, surface a `warning: P<NN> content does not fit mirror reference <basename>; suggest different reference page` and proceed with the closest-fit edit.
6. **No `{{}}` substitution** — mirror SVGs do not contain placeholder markers. Do not search for `{{TITLE}}` / `{{CONTENT_AREA}}` etc.; do not invent placeholders. The whole mirror contract is "verbatim source + in-place text edit".
7. **Output filename** — follow the standard project SVG naming convention (`<NN>_<page_name>.svg` where `<NN>` matches the project page index, not the mirror source index). The mirror filename is the *reference*, not the *output*.

**Detecting mirror mode**: read the chosen template's `design_spec.md` frontmatter once during §1.0 batch read. If `replication_mode: mirror`, every page that hits `page_layouts` follows §1.1 above; pages without a `page_layouts` entry still fall through to free design (resolution rule 3 above).

**Mirror + chart pages**: chart structures inside a mirror SVG are already drawn (axis, series, labels). Treat them as visual references — replace the data labels and series text content to match the project's chart spec, but do not redraw the chart from a `templates/charts/<name>.svg` baseline. A mirror template's `page_charts` entries are normally absent for this reason.

**Legacy fallback table** (used only when `page_layouts` is absent):

| Page Type | Corresponding Template | Adherence Rules |
|-----------|----------------------|-----------------|
| Cover | `01_cover.svg` | Inherit background, decorative elements, layout structure; replace placeholder content |
| Chapter | `02_chapter.svg` | Inherit numbering style, title position, decorative elements |
| Content | `03_content.svg` | Inherit header/footer styles; **content area may be freely laid out** |
| Ending | `04_ending.svg` | Inherit background, thank-you message position, contact info layout |
| TOC | `02_toc.svg` | **Optional**: Inherit TOC title, list styles |

### Page-Template Mapping Declaration (Required Output)

Before generating each page, output which template is used:

```
📝 **Template mapping**: `templates/<chosen_template>/03a_content_image_text.svg` (or "None (free design)")
🎯 **Adherence rules / layout strategy**: [specific description]
```

- **Content pages**: template defines only header/footer; content area is free
- **No template**: generate entirely per the Design Spec

---

## 2. Design Parameter Confirmation (Mandatory Step)

Before the first SVG page, output a confirmation listing: canvas dimensions, body font size, color scheme (primary/secondary/accent HEX), font plan. Prevents spec/execution drift.

### 2.1 Per-page spec_lock re-read (Mandatory)

> Long decks drift off the declared palette/icons mid-deck due to context compression. `spec_lock.md` is the canonical execution reference — re-read it per page to bypass model memory.

**Hard rule**: Before generating **each** SVG page, `read_file <project_path>/spec_lock.md`. Use only values from this file, not from memory. If context was auto-compacted, also `read_file <project_path>/design_spec.md` for the current page's §IX brief.

**If `spec_lock.md` is missing**: emit `warning: spec_lock.md missing — generating without execution lock` once, then proceed using `design_spec.md` values. Expected only for legacy projects; new projects MUST have it (see [strategist.md](strategist.md) §6 step 4).

**Forbidden — values outside the lock**:

- Colors (fill / stroke / stop-color) MUST come from `colors`
- Icons MUST come from `icons.inventory`; library MUST equal `icons.library`
- Font family from `typography`: use role override (`title_family` / `body_family` / `emphasis_family` / `code_family`) if declared, else fall back to `font_family`
- Font sizes follow a **ramp anchored on `typography.body`**, not a closed menu. Use the declared slots when they fit. Intermediate sizes (e.g., 40px hero number, 13px annotation) are allowed if the ratio to `body` falls within the role's band (see `design_spec.md §IV ramp table`). Sizes outside every band require extending the lock first.
- Images MUST reference files listed under `images`; no invented filenames

If a page needs a value not in `spec_lock.md`, surface it — do not silently invent one.

**Per-page layout rhythm — `page_rhythm` section**:

Before drawing each page, look up its entry in `page_rhythm` (key format `P<NN>` matching the page index in §IX of `design_spec.md`) and apply the corresponding layout discipline:

| Tag | Layout discipline |
|-----|-------------------|
| `anchor` | Structural page (cover / chapter / TOC / ending). Follow the matching template verbatim. |
| `dense` | Information-heavy. Card grids, multi-column layouts, KPI dashboards, tables, and charts are all permitted. This is the baseline behavior. |
| `breathing` | Low-density impact page. Avoid **multi-card grid layouts** — do not organize content as multiple parallel rounded containers (3-card row, 4-card KPI grid, 2×2 matrix rendered as cards). Use naked text blocks, dividers, whitespace, or full-bleed imagery as the content structure. Single rounded visual elements (hero image corners, callouts, tags, one emphasis block) are fine — the rule is about grid structure, not about the `rx` attribute. Proportions follow information weight (not a preset ratio). Typical forms: hero quote, single large number with one-line interpretation, full-bleed image with floating caption, section transition. |

> Without rhythm variation, every page defaults to card grids (the "AI-generated" look). `page_rhythm` is the only narrative lever that survives context compression.

**Missing `page_rhythm` section** → emit `warning: spec_lock.md missing page_rhythm — defaulting all pages to dense` once, fall back to `dense` for all pages.

**Tag not found for current page** → fall back to `dense` silently. Do not invent a tag.

**Per-page template lookup — `page_layouts` section**:

Before drawing each page, look up its entry in `page_layouts` to decide which basename to inherit (the SVG itself was loaded in §1.0):

- Entry present (e.g., `P04: 03a_content_image_text`) → inherit the corresponding SVG already in context. The basename **must match** an actual file in the chosen template directory; if it doesn't, emit `warning: page_layouts P<NN> references missing file <basename>.svg — falling back to free design` and proceed.
- No entry for this page → free design, no inheritance. **Not an error** — Strategist intentionally left this page free.
- Whole section absent → see §1 fallback (legacy page-type matching).

Do **not** invent a layout entry, and do **not** assume a template just because `templates/` exists — if `page_layouts` is present but silent for this page, that silence is the instruction.

**Per-page chart reference — `page_charts` section**:

Before drawing each page, look up its entry in `page_charts` to decide which chart structure applies (the SVG itself was loaded in §1.0):

- Entry present (e.g., `P09: timeline_horizontal`) → adapt the corresponding chart SVG already in context. Apply project colors/typography/density; do not copy verbatim. Cross-reference `templates/charts/charts_index.json` for the chart's purpose summary if needed.
- No entry for this page → either no chart on this page, or a chart that didn't match any catalog template (Strategist's `no-template-match` fallback). Design the visualization from scratch using `design_spec.md §VII` for guidance.
- Whole section absent → no chart pages in this deck.

---

## 3. Execution Guidelines

- **Proximity**: group related elements with tight spacing; separate unrelated groups
- **Spec adherence**: follow color, layout, canvas format, and typography in the spec
- **Template structure**: if templates exist, inherit the visual framework
- **Main-agent ownership**: SVG generation must run in the main agent (not sub-agents) — pages share upstream context for cross-page visual continuity
- **Generation rhythm**: lock global design context first, then generate pages sequentially in one continuous context. No batched groups (e.g., 5 at a time).
- **Phased batch generation** (recommended):
  1. **Visual Construction Phase**: generate all SVG pages sequentially for visual consistency. Use layout judgment for chart marks during the draft. **MUST embed plot-area markers** per §3.1 below on every chart page — coordinate calibration is a post-generation step (see [`workflows/verify-charts.md`](../workflows/verify-charts.md)) that depends on these markers.
  2. **Quality Check Gate**: run `python3 scripts/svg_quality_checker.py <project_path>` on `svg_output/`. Any `error` (banned features, viewBox mismatch, spec_lock drift, non-PPT-safe font, etc.) MUST be fixed on the offending page before proceeding — regenerate and re-check. Address `warning`s when straightforward. Do NOT defer to after `finalize_svg.py` — finalize rewrites SVG and masks some violations.
  3. **Logic Construction Phase**: after SVGs pass the quality check, batch-generate speaker notes for narrative continuity.

### 3.1 Chart Plot-Area Marker (MANDATORY on every chart page)

> The [`verify-charts`](../workflows/verify-charts.md) workflow enumerates chart pages from `design_spec.md §VII`, then reads each page's plot-area marker to feed `svg_position_calculator.py`. Missing marker → verify-charts has to re-derive the plot area from axis lines, paying the cost on every run.

Every SVG page that contains a data visualization chart MUST include a plot-area marker inside `<g id="chartArea">`, placed **after axis lines** and **before the first data element** (bar, line, area, point).

**Rectangular plot area** (bar / horizontal_bar / grouped_bar / stacked_bar / line / area / stacked_area / scatter / waterfall / pareto / butterfly):

```xml
<!-- chart-plot-area: x_min,y_min,x_max,y_max -->
```

**Radial charts** (pie / donut / radar):

```xml
<!-- chart-plot-area: pie | center: cx,cy | radius: r -->
<!-- chart-plot-area: donut | center: cx,cy | outer-radius: r1 | inner-radius: r2 -->
<!-- chart-plot-area: radar | center: cx,cy | radius: r -->
```

**How to determine coordinate values**:

| Value | Derivation |
|-------|------------|
| `x_min` | X coordinate of the Y-axis line (leftmost data boundary) |
| `y_min` | Y coordinate of the topmost grid line (highest data boundary) |
| `x_max` | X coordinate of the rightmost axis endpoint or grid line |
| `y_max` | Y coordinate of the X-axis baseline |
| `cx, cy` | Center point of pie/donut/radar (accounting for `transform="translate()"`) |
| `r` | Outer radius of the chart |

**Per-page verification** — after writing each chart SVG, confirm the marker exists:

```bash
grep "chart-plot-area" <project_path>/svg_output/<current_page>.svg
```

> All chart templates in `templates/charts/` include this marker as a reference. If you are drawing a chart and the marker is absent, you have a bug.
- **Technical specs**: see [shared-standards.md](shared-standards.md) for SVG/PPT constraints
- **Card containers — use the documented patterns**: when a content page needs section cards (4 quadrants, parallel aspects, capability blocks, info cards), use the patterns codified in [`templates/charts/CHART_STYLE_GUIDE.md`](../templates/charts/CHART_STYLE_GUIDE.md) §11 — half-rounded section tab (§11.1), nested card border without stroke (§11.2), card-grid skeletons (§11.3), diagonal dashed connector for cross-quadrant relationships (§11.5), ground-anchor ellipse as a non-filter depth marker (§11.6), bidirectional interaction arrows for paired protocols (§11.7). Do not reinvent the "tinted full-rounded rect + white cover-rect to hide the bottom corners" hack; it survives in older templates but breaks SVG→PPTX color editing. Reference templates: [`labeled_card.svg`](../templates/charts/labeled_card.svg), [`quadrant_text_bullets.svg`](../templates/charts/quadrant_text_bullets.svg), [`kpi_cards.svg`](../templates/charts/kpi_cards.svg), [`matrix_2x2.svg`](../templates/charts/matrix_2x2.svg), [`team_roster.svg`](../templates/charts/team_roster.svg), [`client_server_flow.svg`](../templates/charts/client_server_flow.svg).
- **Semantic shapes over preset stacks**: when a slide needs to express "ascending / converging / breaking through / stacking" — i.e., a relationship that goes beyond a generic arrow — prefer a single custom `<polygon>` or `<path>` that encodes the semantics geometrically, rather than stacking multiple preset arrows. A converging-tip path or a podium polygon reads faster than three arrows pointing at a label. Examples of this technique appear in many imported corporate decks; see `projects/01_template_import/svg_output/slide_01.svg` shape-158 for a reference (gradient-filled inward-pointing arrow). Do not codify these as templates — they are page-specific; the rule is just "consider polygon before stacking presets."
- **Visual depth — through restraint**: layered depth comes from rhythm (flat vs lifted, dense vs spacious), not from shadows everywhere. Apply shadow to at most 2-3 genuinely floating elements per page (cards on photos, primary CTA, overlays); keep peer-grid cards, dividers, body containers flat. Reach for typography weight, spacing, accent bars, subtle tints **before** shadow. Full rules in shared-standards.md §6.

### SVG File Naming Convention

Format: `<NN>_<page_name>.svg` (two-digit number from 01; name matches the deck's language and the page title in the Design Spec).

Examples: `01_封面.svg` / `02_目录.svg` / `03_核心优势.svg`; `01_cover.svg` / `02_agenda.svg` / `03_key_benefits.svg`.

---

## 4. Icon Usage

Strategist chooses the library and inventory; Executor only implements. Library details and one-library rule: [`../templates/icons/README.md`](../templates/icons/README.md). This section defines placeholder syntax.

**Built-in icons — Placeholder method (recommended)**:

```xml
<!-- chunk-filled (straight-line geometry, sharp corners, structured) -->
<use data-icon="chunk-filled/home" x="100" y="200" width="48" height="48" fill="#005587"/>

<!-- tabler-filled (bezier-curve forms, smooth & rounded contours) -->
<use data-icon="tabler-filled/home" x="100" y="200" width="48" height="48" fill="#005587"/>

<!-- tabler-outline (light, line-art style — screen-only decks) -->
<use data-icon="tabler-outline/home" x="100" y="200" width="48" height="48" fill="#005587"/>

<!-- phosphor-duotone (single color + 20% backplate — soft depth without solid weight) -->
<use data-icon="phosphor-duotone/house" x="100" y="200" width="48" height="48" fill="#005587"/>

<!-- simple-icons (brand logos — used alongside the deck's primary library, only for real company/product marks) -->
<use data-icon="simple-icons/github" x="100" y="200" width="48" height="48" fill="#181717"/>

<!-- tabler-outline with thin / bold stroke (stroke-style libraries only) -->
<use data-icon="tabler-outline/home" x="100" y="200" width="48" height="48" fill="#005587" stroke-width="1.5"/>
<use data-icon="tabler-outline/home" x="100" y="200" width="48" height="48" fill="#005587" stroke-width="3"/>
```

> ⚠️ **Color**: ALWAYS use `fill="#HEX"` on `<use data-icon="...">`. NEVER use `stroke` or `fill="none"`, even for stroke-style libraries.
>
> **stroke-width** (stroke-style libraries only, currently `tabler-outline`): allowed values `{1.5, 2, 3}`. If `spec_lock.md icons.stroke_width` is declared, all placeholders MUST use that value deck-wide. Default `2` if absent (legacy). Ignored on non-stroke libraries.
>
> Icons are auto-embedded by `finalize_svg.py` — no need to run `embed_icons.py` manually.

**Searching for icons** — use terminal, zero token cost:
```bash
ls skills/ppt-master/templates/icons/chunk-filled/ | grep home
ls skills/ppt-master/templates/icons/tabler-filled/ | grep home
ls skills/ppt-master/templates/icons/tabler-outline/ | grep chart
ls skills/ppt-master/templates/icons/phosphor-duotone/ | grep house
ls skills/ppt-master/templates/icons/simple-icons/ | grep github
```

**Abstract concept → icon name** (names for `chunk-filled`; tabler libraries use their own equivalents — verify with `ls | grep`):

| Concept | chunk-filled | tabler-filled / tabler-outline |
|---------|-------|-------------------------------|
| Growth / Increase | `arrow-trend-up` | same |
| Decline / Decrease | `arrow-trend-down` | same |
| Success / Complete | `circle-checkmark` | `circle-check` |
| Warning / Risk | `triangle-exclamation` | `alert-triangle` |
| Innovation / Idea | `lightbulb` | `bulb` |
| Strategy / Goal | `target` | same |
| Efficiency / Speed | `bolt` | same |
| Collaboration / Team | `users` | same |
| Settings / Config | `cog` | `settings` |
| Security / Trust | `shield` | same |
| Money / Finance | `dollar` | `currency-dollar` |
| Time / Deadline | `clock` | same |
| Location / Region | `map-pin` | same |
| Communication | `comment` | `message` |
| Analysis / Data | `chart-bar` | same |
| Process / Flow | `arrows-rotate-clockwise` | `refresh` |
| Global / World | `globe` | `world` |
| Excellence / Award | `star` | same |
| Expand / Scale | `maximize` | same |
| Problem / Issue | `bug` | same |

> For self-evident names (home, user, file, search, arrow, etc.) — just `grep chunk-filled/` directly without consulting the table.

> ⚠️ **Icon validation**: only use icons from the Design Spec's approved inventory. Verify each via `ls | grep` before use. Mixing libraries within one deck is FORBIDDEN.

---

## 5. Visualization Reference

Chart SVGs referenced in **VII. Visualization Reference List** are loaded once via the §1.0 batch read. This section governs adaptation only.

**Hard rule**: adapt the loaded chart SVG; do not improvise from memory and do not replicate verbatim. Apply project colors, typography, content; preserve visualization type.

**Adaptation rules**:
- **Preserve**: visualization type (bar/line/pie/timeline/process/framework…) as specified
- **Adapt**: data, labels, colors (project scheme), dimensions
- **Freely adjust**: composition, axis ranges, grid, legend, spacing, decoration — as long as the chart stays accurate and readable
- **Forbidden**: changing visualization type without spec justification; omitting data points or structural elements from the outline

> Templates: `templates/charts/` (70 types). Index: `templates/charts/charts_index.json`

### 5.1 Chart Coordinate Calibration

Coordinate calibration runs as a **standalone post-generation workflow**, not inside the executor pipeline. After SVG generation completes, if the deck contains data charts, run [`workflows/verify-charts.md`](../workflows/verify-charts.md) before post-processing.

The executor's only obligation here is upstream: embed the `<!-- chart-plot-area ... -->` marker on every chart page during initial draft (§3.1). Verify-charts enumerates chart pages from `design_spec.md §VII` (authoritative deck plan) and uses the marker to feed `svg_position_calculator.py`.

> Do NOT run `svg_position_calculator.py` during the initial draft. The calculator calibrates already-generated SVGs against their declared plot areas; running it before the SVG exists has nothing to compare against.

---

## 6. Image Handling

Handle images by their status in the Design Spec's Image Resource List. Status enum and lifecycle: [`svg-image-embedding.md`](svg-image-embedding.md).

| Status | Source | Handling |
|--------|--------|----------|
| **Existing** | User-provided | Reference images directly from `../images/` directory |
| **Generated** | Generated by Image_Generator | Reference images directly from `../images/` directory |
| **Sourced** | Web-acquired by Image_Searcher | Reference from `../images/`. **Read [`image_sources.json`](image-searcher.md) to decide attribution** — see §6.1 below. |
| **Needs-Manual** | Acquisition failed and file is absent | Use dashed border placeholder unless the expected file exists |
| **Placeholder** | Not yet prepared | Use dashed border placeholder |

**Reference syntax**: see [`svg-image-embedding.md`](svg-image-embedding.md).

**Placeholder**: Dashed border `<rect stroke-dasharray="8,4" .../>` + description text

**`no-crop` images**: when a `spec_lock.md images` entry ends with ` | no-crop`, size the container to the image's native ratio (from `analyze_images.py` or file dims) and use `preserveAspectRatio="xMidYMid meet"`. Untagged entries are croppable — default to `slice`.

### 6.1 Inline Attribution for Sourced Images (web path)

Whenever the slide uses an image with `Status: Sourced`, look up the corresponding entry in `project/images/image_sources.json` and act on `license_tier`:

| `license_tier` | Action on this slide |
|---|---|
| `no-attribution` | Embed the `<image>` element only. **No credit element needed.** |
| `attribution-required` | Embed the `<image>` element **plus** a small inline `<text>` credit element per the visual spec in [image-searcher.md §7](./image-searcher.md). |

The credit text is **not** rendered by post-processing or export — it must be present in the SVG you produce. The shape of the credit element (size, position, color, multi-image source line, hero gradient overlay) is specified in [image-searcher.md §7](./image-searcher.md). Do not invent a different style.

Use `attribution_text` from the manifest entry as the **starting point**, then compress for the small-text constraint (drop URL, drop filename, keep "via Provider / License"). For CC0/PD images that landed in the `attribution-required` tier only because of upstream metadata quirks (rare), credits are still safe to render.

`svg_quality_checker.py` treats missing CC BY / CC BY-SA inline attribution as an **error**. Fix the offending SVG before post-processing.

**The manifest is the single source of truth for credits.** Do not duplicate license info into speaker notes or any other artifact.

---

## 7. Font Usage

Source of truth: `spec_lock.md typography`. Use `font_family` as default; override per role with `title_family` / `body_family` / `emphasis_family` / `code_family` if declared.

If `spec_lock.md` is absent, consult [`strategist.md`](strategist.md) §g — do not invent a stack.

**Hard rule**: every SVG `font-family` stack MUST end with a pre-installed family (Microsoft YaHei / SimHei / SimSun / Arial / Calibri / Segoe UI / Times New Roman / Georgia / Consolas / Courier New / Impact / Arial Black). PPTX has no runtime fallback — missing fonts degrade to Calibri.

---

## 8. Speaker Notes Generation Framework

### Task 1. Generate Complete Speaker Notes Document

After all SVG pages are finalized, enter Logic Construction Phase and write the full notes to `notes/total.md`. Batch-writing (not per-page) lets transitions plan coherently.

**Pure spoken narration**: notes are read aloud verbatim by `notes_to_audio.py` (TTS). Write only what should be spoken. No visible markers, no labeled meta-lines, no enumerated key-point lists, no duration annotations — anything you write outside the heading will be vocalized.

**Per-page structure**: `# <number>_<page_title>` heading (the `#` heading line is the only thing stripped before TTS), pages separated by `---`. Body is 2–5 natural sentences carrying the page's core message. Page-to-page transitions live inside the opening sentence as natural prose ("接下来……" / "Having framed X, let's turn to Y") — no bracketed `[过渡]` / `[Transition]` tags.

**Concrete examples** — same shape applies to any language; just write naturally in that language.

中文 deck：

```
# 02_市场格局

在明确了行业背景之后，我们来看具体的市场格局。当前线上零售集中度持续上升，前三大平台合计份额已经达到百分之六十八，腰部玩家正在被快速挤压，留给新进入者的窗口期不超过十八个月。这意味着我们的策略必须聚焦，而不是铺开。
```

英文 deck：

```
# 02_market_landscape

Having framed the industry backdrop, let's look at the actual market landscape. Online retail concentration keeps rising — the top three platforms now hold sixty-eight percent of combined share, mid-tier players are being squeezed fast, and the window for new entrants is under eighteen months. This means our strategy has to focus, not spread.
```

> 日本語 / 한국어 / 其他语言：照搬同样的结构，用对应语言自然书写即可。

**Number readability**: TTS reads digits and symbols literally. Prefer fully-spelled forms in the language being spoken when literal pronunciation would be awkward (e.g. Chinese "百分之六十八" reads better than "68%"; "1-2分钟" reads as "一减二分钟"). Plain integers and percentages in English are fine as-is.

**Common mistakes to avoid**:
- Leaving any bracketed stage marker (`[过渡]` / `[Transition]` / `[Pause]` / `[Data]` / `[Scan Room]` / `[Interactive]` / `[Benchmark]` etc.) in the text — they will be read aloud literally.
- Adding `要点：① …` / `Key points: (1) …` / `时长：2分钟` / `Duration: 2 minutes` / `Flex: …` lines — TTS will speak "要点 一 …".
- Mixing languages within one deck's notes.

### Task 2. Split Into Per-Page Note Files

Auto-split `notes/total.md` into per-page files in `notes/`.

**Naming**: match SVG names (`01_cover.svg` → `notes/01_cover.md`); `slide01.md` also supported (legacy).

---

## 9. Next Steps After Completion

> **Auto-continuation**: After Visual Construction Phase (all SVG pages) and Logic Construction Phase (all notes) are complete, the Executor proceeds directly to the post-processing pipeline.

**Post-processing & Export** (same canonical pipeline as [shared-standards.md §5](shared-standards.md)):

```bash
# 1. Split speaker notes
python3 scripts/total_md_split.py <project_path>

# 2. SVG post-processing (auto-embed icons, images, etc.)
python3 scripts/finalize_svg.py <project_path>

# 3. Export PPTX
python3 scripts/svg_to_pptx.py <project_path>
# Output (default-flow mode):
#   exports/<project_name>_<timestamp>.pptx           ← native pptx (canonical output)
#   backup/<timestamp>/svg_output/                    ← Executor SVG source backup (always written)
#
# Add --svg-snapshot to additionally emit:
#   exports/<project_name>_<timestamp>_svg.pptx      ← SVG snapshot pptx (sibling of native pptx)
```

```

### B4. references/shared-standards.md (verbatim)

```markdown
# Shared Technical Standards

Common technical constraints for PPT Master, eliminating cross-role file duplication.

---

## 1. SVG Banned Features Blacklist

The following are **forbidden** in generated SVGs — PPT export breaks otherwise:

### 1.0 Text characters: must be well-formed XML

SVG is strict XML. Two rules for all text and attribute values:

| Character category | Required form | Forbidden form |
|---|---|---|
| Typography & symbols (em dash, en dash, ©, ®, →, ·, NBSP, full-width punctuation, emoji…) | **Raw Unicode characters** — write `—` `–` `©` `®` `→` directly | HTML named entities — `&mdash;` `&ndash;` `&copy;` `&reg;` `&rarr;` `&middot;` `&nbsp;` `&hellip;` `&bull;` etc. |
| XML reserved characters (`&`, `<`, `>`, `"`, `'`) | **XML entities only** — `&amp;` `&lt;` `&gt;` `&quot;` `&apos;` (e.g. `R&amp;D`, `error &lt; 5%`) | Bare `&` `<` `>` (e.g. `R&D`, `error < 5%`) |

One offending character invalidates the file and aborts export. Numeric refs (`&#160;` / `&#xa0;`) are XML-legal but discouraged.

**Structural blacklist** (in addition to the character rules above):

| Banned Feature | Description |
|----------------|-------------|
| `mask` | Masks |
| `<style>` | Embedded stylesheets |
| `class` | CSS selector attributes (`id` inside `<defs>` is a legitimate reference and is NOT banned) |
| External CSS | External stylesheet links |
| `<foreignObject>` | Embedded external content |
| `<symbol>` + `<use>` | Symbol reference reuse |
| `textPath` | Text along a path |
| `@font-face` | Custom font declarations |
| `<animate*>` / `<set>` | SVG animations |
| `<script>` / event attributes | Scripts and interactivity |
| `<iframe>` | Embedded frames |

> **`marker-start` / `marker-end` is conditionally allowed** — see §1.1 for constraints. The converter maps qualifying markers to native DrawingML `<a:headEnd>` / `<a:tailEnd>`.
>
> **`clipPath` on `<image>` is conditionally allowed** — see §1.2 for constraints. The converter maps qualifying clip shapes to native DrawingML picture geometry (`<a:prstGeom>` or `<a:custGeom>`).
>
> **Replacing `<mask>` effects** — DrawingML has no per-pixel alpha. Route by effect:
> - Image gradient overlay (vignette/fade/tint) → stacked `<rect>` with `<linearGradient>`/`<radialGradient>` (§6 Image Overlay)
> - Non-rectangular image crop (circle/rounded/hexagon) → `clipPath` on `<image>` (§1.2)
> - Inner glow / soft-edge → `<filter>` with `<feGaussianBlur>` (§6 Glow)
> - Drop shadow → filter shadow or layered rect (§6 Shadow)
>
> Pixel-level alpha effects (text-knockout image fills, arbitrary alpha composites) have no PPT path — bake into the source image at Image_Generator stage.

---

### 1.1 Line-end Markers (Conditionally Allowed)

`marker-start` and `marker-end` on `<line>` and `<path>` elements are allowed **only** when the referenced `<marker>` satisfies all of the following:

| Requirement | Reason |
|-------------|--------|
| Marker `<marker>` element defined inside `<defs>` | Converter looks up marker defs via id index |
| `orient="auto"` | DrawingML arrow auto-rotates along the line tangent; other orient values will not round-trip |
| Marker shape is **one of**: closed 3-vertex path/polygon (triangle), closed 4-vertex path/polygon (diamond), `<circle>` / `<ellipse>` (oval) | These three map cleanly to DrawingML `type="triangle" / "diamond" / "oval"`. Any other shape is silently dropped with a warning. |
| Marker child's `fill` **matches** the parent line's `stroke` color | In DrawingML the arrow head inherits the line color — a mismatched marker fill will look wrong on export. |
| `markerWidth` / `markerHeight` roughly in `3–15` range | Mapped to `sm` (<6) / `med` (6–12) / `lg` (>12) size buckets. |

**Use boundary**:

- `marker-start` / `marker-end`: only for connector arrows where the line is primary
- For block / chunky / solid arrows (arrow body is the visual object), use standalone closed `<path>` / `<polygon>`; see `templates/charts/chevron_process.svg` or `templates/charts/process_flow.svg`

**Supported DrawingML mapping**:

| SVG Marker Shape | DrawingML Output |
|------------------|------------------|
| `<path d="M0,0 L10,5 L0,10 Z"/>` (triangle) | `<a:tailEnd type="triangle" w="med" len="med"/>` |
| `<polygon points="0,0 10,5 0,10"/>` | `<a:tailEnd type="triangle" w="med" len="med"/>` |
| 4-vertex closed path/polygon | `<a:tailEnd type="diamond" .../>` |
| `<circle cx="5" cy="5" r="4"/>` | `<a:tailEnd type="oval" .../>` |

**Recommended template** — a standard arrow-head definition ready to reuse:

```xml
<defs>
  <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="9" refY="5"
          orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L10,5 L0,10 Z" fill="#1976D2"/>
  </marker>
</defs>
<line x1="100" y1="200" x2="400" y2="200" stroke="#1976D2" stroke-width="3"
      marker-end="url(#arrowHead)"/>
```

> ⚠️ Unclassifiable marker shapes (curved paths, multi-segment, >4 vertices) are silently dropped — line renders without arrow. Use a manual `<polygon>` for exotic shapes.

---

### 1.2 Image Clipping (Conditionally Allowed)

`clip-path` on `<image>` elements is allowed when the referenced `<clipPath>` satisfies the following:

| Requirement | Reason |
|-------------|--------|
| `<clipPath>` element defined inside `<defs>` | Converter looks up clip defs via id index |
| Contains a **single** shape child | First child is used; multiple children are not composited |
| Shape is one of: `<circle>`, `<ellipse>`, `<rect>` (with rx/ry), `<path>`, `<polygon>` | These map to DrawingML geometry (preset or custom) |
| Used **only on `<image>` elements** | Non-image elements with clip-path are **forbidden** |

**Use boundary**:

- Only on `<image>` for non-rectangular crops (circular avatars, rounded frames, hexagons)
- NOT on shapes (`<rect>`/`<circle>`/`<path>`/`<g>`/`<text>`) — draw the target shape directly. A rect clipped to a circle is just a circle.
- PowerPoint's SVG renderer doesn't handle `clipPath`; only the Native PPTX converter does.

**Supported DrawingML mapping**:

| SVG Clip Shape | DrawingML Output | Use Case |
|----------------|------------------|----------|
| `<circle>` / `<ellipse>` | `<a:prstGeom prst="ellipse"/>` | Circular avatar, oval frame |
| `<rect rx="..."/>` | `<a:prstGeom prst="roundRect"/>` with adj value | Rounded rectangle photo frame |
| `<path>` / `<polygon>` | `<a:custGeom>` with path commands | Hexagon, diamond, custom shape |

**Recommended template** — circular image clip:

```xml
<defs>
  <clipPath id="avatarClip">
    <circle cx="200" cy="200" r="100"/>
  </clipPath>
</defs>
<image href="../images/photo.jpg" x="100" y="100" width="200" height="200"
       clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>
```

**Rounded rectangle clip** — for card-style image frames:

```xml
<defs>
  <clipPath id="cardClip">
    <rect x="60" y="120" width="400" height="250" rx="16"/>
  </clipPath>
</defs>
<image href="../images/banner.jpg" x="60" y="120" width="400" height="250"
       clip-path="url(#cardClip)" preserveAspectRatio="xMidYMid slice"/>
```

> ⚠️ `clip-path` on non-image elements is FORBIDDEN — quality checker errors out. Draw target geometry directly.

---

## 2. PPT Compatibility Alternatives

| Banned Syntax | Correct Alternative |
|---------------|---------------------|
| `fill="rgba(255,255,255,0.1)"` | `fill="#FFFFFF" fill-opacity="0.1"` |
| `<g opacity="0.2">...</g>` | Set `fill-opacity` / `stroke-opacity` on each child element individually |
| `<image opacity="0.3"/>` | Overlay a `<rect fill="background-color" opacity="0.7"/>` mask layer after the image |

**Mnemonic**: PPT does not recognize rgba, group opacity, or image opacity.

> Arrows: prefer `marker-end` for connector lines (§1.1) — converter produces native auto-rotating arrow heads. For block/chunky arrows, use standalone closed shapes; see `templates/charts/chevron_process.svg` and `templates/charts/process_flow.svg`.

---

## 3. Canvas Format Quick Reference

> See [`canvas-formats.md`](canvas-formats.md) for the full format table (presentations / social / marketing) and the format-selection decision tree.

---

## 4. Basic SVG Rules

- **viewBox** must match the canvas dimensions (`width`/`height` must match `viewBox`)
- **Background**: Use `<rect>` to define the page background color
- **`<tspan>`** has two purposes: (1) manual line breaks (use `dy` or explicit `y`); (2) inline run formatting on the same line (color/weight/size). `<foreignObject>` is FORBIDDEN. See "Single logical line" rule below.
- **Fonts**: every `font-family` stack MUST end with a pre-installed family (Microsoft YaHei / SimSun / Arial / Times New Roman / Consolas …); `@font-face` is FORBIDDEN. Full rule: [`strategist.md §g`](strategist.md).
- **Styles**: inline only (`fill=""`, `font-size=""`); `<style>`/`class` FORBIDDEN (`id` inside `<defs>` is fine)
- **Colors**: HEX only; transparency via `fill-opacity`/`stroke-opacity`
- **Images**: `<image href="../images/xxx.png" preserveAspectRatio="xMidYMid slice"/>`
- **Icons**: `<use data-icon="<library>/<name>" x="" y="" width="48" height="48" fill="#HEX"/>` (auto-embedded post-processing). Always include library prefix. One stylistic library per deck (`chunk-filled`/`tabler-filled`/`tabler-outline`/`phosphor-duotone`); `simple-icons` only for real brand marks. See [`../templates/icons/README.md`](../templates/icons/README.md).

### Inline Text Runs (Single Logical Line = Single `<text>`)

One logical line — even with mixed colors/weights/sizes — MUST be one `<text>` with inline `<tspan>` children. Never use multiple adjacent `<text>` elements. The converter maps each `<tspan>` to a `<a:r>` run within the same PPT text frame, keeping the line as one editable shape.

✅ **DO** — one `<text>` → one text frame with three runs:

```xml
<text x="100" y="200" font-size="24" fill="#333333">
  实现<tspan fill="#1A73E8" font-weight="bold">10倍</tspan>效率提升
</text>
```

❌ **DON'T** — three side-by-side `<text>` elements become three separate text frames in PPT (breaks edit-as-one-line, risks alignment drift, makes spacing fragile):

```xml
<text x="100" y="200" font-size="24" fill="#333333">实现</text>
<text x="160" y="200" font-size="24" fill="#1A73E8" font-weight="bold">10倍</text>
<text x="240" y="200" font-size="24" fill="#333333">效率提升</text>
```

**⚠️ Inline tspans must NOT carry `x`/`y`/`dy`** — those mark a new line, and `flatten_tspan` will split into a separate text frame. `dx` is safe (kerning, stays inline). Only set `x`/`y`/`dy` on tspans that genuinely start a new line.

**Multi-line `<text>` with per-line emphasis works**: an outer line-break tspan (with `x` + `dy` or `y`) MAY contain nested inline tspans for color/weight/size — converter walks nested tspans and emits one run per styled segment:

```xml
<text x="80" y="190" font-size="18" fill="#333333">
  <tspan x="80" dy="0">完成率<tspan fill="#4CAF50" font-weight="bold">98%</tspan>超预期</tspan>
  <tspan x="80" dy="35">成本降低<tspan fill="#F44336" font-weight="bold">¥120万</tspan></tspan>
</text>
```

❌ **DON'T** — same-line column jump via `<tspan x="...">`:

```xml
<text x="100" y="200" font-size="18" fill="#333333">
  <tspan x="100">左列</tspan><tspan x="600" font-weight="bold">右列</tspan>
</text>
```

`x` on a tspan starts a new line, splitting into two independent text frames. For two-column layouts, write two `<text>` elements.

**Default — lift key information.** Uniform-styled paragraphs read as walls of text. Wrap these in `<tspan fill="..." font-weight="bold">`:

- **Numerical results** — percentages, multipliers (`10x`), absolute amounts (`¥120万`)
- **Contrasts** — gain/loss, before/after, target/actual
- **One or two load-bearing nouns per sentence** — the term that carries the insight

Do NOT highlight: connectives, common verbs, every noun, decorative adjectives, structural text (footer/axis/legend/page number/labels).

Color: use the deck's primary brand color for emphasis. Reserve green/red for actual positive/negative semantics.

❌ **DON'T** — uniform-styled paragraph buries the insight:

```xml
<text x="80" y="200" font-size="20" fill="#333333">
  2024年公司营收同比增长35%达到12亿元创历史新高
</text>
```

✅ **DO** — same line, key data lifted:

```xml
<text x="80" y="200" font-size="20" fill="#333333">
  2024年公司营收同比<tspan fill="#1A73E8" font-weight="bold">增长35%</tspan>达到<tspan fill="#1A73E8" font-weight="bold">12亿元</tspan>创历史新高
</text>
```

### Element Grouping (Mandatory)

Wrap logically related elements in top-level `<g id="...">` groups. Produces PowerPoint groups in PPTX, making slides easier to select/move/edit and providing stable anchors for optional per-element entrance animation.

> ⚠️ Only `<g opacity="...">` is banned (§2). Plain `<g>` for grouping is required.

**Animation-ready rule**: direct children of `<svg>` should be semantic groups, not raw drawing atoms. Aim for **3–8 top-level content `<g id>` groups per slide** (the 3–8 budget excludes page chrome — see below); each content group becomes one entrance step under the chosen `--animation-trigger` mode (one click in `on-click`, one cascade slot in `after-previous`, parallel in `with-previous`).

**Chrome groups are excluded automatically.** The exporter treats top-level groups whose id contains chrome tokens as page chrome and skips them in the animation sequence — they appear together with the slide. Tokens (matched against id after splitting on `-` / `_`): `background`, `bg`, `decoration` / `decorations` / `decor`, `header`, `footer`, `chrome`, `watermark`, `pagenumber` / `pagenum` / `page-number`. So `<g id="bg-texture">`, `<g id="cover-footer">`, `<g id="p03-header">`, `<g id="bottom-decor">` all skip animation while keeping their `<g>` wrapper for editing/grouping. Use these naming conventions for chrome — do **not** strip the `<g>` wrapper.

**What to group**:

| Grouping Unit | Contains |
|---------------|----------|
| Card / panel | Background rect + (optional shadow only if the card floats over a photo/colored panel — see §6) + icon + title + body text |
| Process step | Number circle + icon + label + description |
| List item | Bullet / number + icon + title + description |
| Icon-text combo | Icon element + adjacent label |
| Page header | Title + subtitle + accent decoration |
| Page footer | Page number + branding |
| Decorative cluster | Related decorative shapes (rings, orbs, dots) |

**Do not**:

- Put the whole slide into one giant `<g>`; that leaves only one animation step.
- Leave many top-level `<rect>` / `<text>` / `<path>` elements ungrouped; fallback animation is capped at 8 primitives and dense flat pages may skip animation.
- Split every icon, text line, or decorative mark into separate top-level groups; that creates too many click steps.
- Use anonymous top-level groups. Every top-level semantic group needs a descriptive `id`.

**Example**:

```xml
<g id="card-benefits-1">
  <!-- This card floats over a colored panel — shadow is appropriate. On a flat white canvas, omit the filter. -->
  <rect x="60" y="115" width="565" height="260" rx="20" fill="#FFFFFF" filter="url(#shadow)"/>
  <use data-icon="chunk-filled/bolt" x="108" y="163" width="44" height="44" fill="#0071E3"/>
  <text x="105" y="270" font-size="56" font-weight="bold" fill="#0071E3">10×</text>
  <text x="250" y="270" font-size="30" font-weight="bold" fill="#1D1D1F">Faster</text>
  <text x="105" y="310" font-size="18" fill="#6E6E73">Reduce production time from days to hours.</text>
</g>
```

**Naming**: descriptive `id` on top-level `<g>` is **required** (e.g., `card-1`, `step-discover`, `header`, `footer`). Each top-level `<g id>` becomes one anchor for per-element entrance animation in PPTX export; without it, the exporter falls back to at most 8 top-level primitives or skips animation on dense pages.

---

## 5. Post-processing Pipeline (3 Steps)

Must be executed in order — skipping or adding extra flags is FORBIDDEN:

```bash
# 1. Split speaker notes into per-page note files
python3 scripts/total_md_split.py <project_path>

# 2. SVG post-processing (icon embedding, image crop/embed, text flattening, rounded rect to path)
python3 scripts/finalize_svg.py <project_path>

# 3. Export PPTX (from svg_final/, embeds speaker notes by default)
python3 scripts/svg_to_pptx.py <project_path>
# Output (default-flow mode):
#   exports/<project_name>_<timestamp>.pptx           ← native pptx (canonical output)
#   backup/<timestamp>/svg_output/                    ← Executor SVG source backup (always written)
#
# Add --svg-snapshot to additionally emit:
#   exports/<project_name>_<timestamp>_svg.pptx      ← SVG snapshot pptx (sibling of native pptx)
```

**Optional animation flags** (only when the user asks):
- `-t <effect>` — page transition (`fade` / `push` / `wipe` / `split` / `strips` / `cover` / `random` / `none`; default `fade`)
- `-a <effect>` — per-element entrance animation (`fade` / `mixed` / `random` / one of 22 named effects / `none`; default `mixed`). Anchors on top-level `<g id="...">` groups.
- `--animation-trigger {on-click,with-previous,after-previous}` — Start mode matching PowerPoint's animation-pane Start dropdown. Default `after-previous` (cascade on slide entry; pace via `--animation-stagger <seconds>`); `on-click` advances per click; `with-previous` plays all groups together.
- `--animation-config <path>` — optional object-level animation sidecar. Default: `<project>/animations.json` when present.
- `--auto-advance <seconds>` — kiosk-style auto-play

**Optional recorded narration** (only when the user asks for narrated/video export):

```bash
python3 scripts/notes_to_audio.py <project_path> --voice zh-CN-XiaoxiaoNeural
python3 scripts/svg_to_pptx.py <project_path> --recorded-narration audio
```

- `notes_to_audio.py` reads split `notes/*.md` files and writes one audio file per slide to `audio/`. Default `edge` output is MP3; configured cloud providers may output MP3 or WAV depending on provider settings.
- `--recorded-narration audio` prepares PowerPoint's recorded timings and narrations: every slide needs matching `m4a` / `mp3` / `wav` audio, every duration must be readable by `ffprobe`, and `on-click` object animation is rejected.
- `--recorded-narration audio` embeds matching audio, keeps speaker notes, and sets slide timings from audio duration.
- `--narration-audio-dir audio` is the lower-level embedding path for partial audio coverage; it does not prepare a complete recorded-timings export.
- Long-audio import and automatic long-audio splitting are not supported.

Full reference: [`animations.md`](animations.md).

**Prohibited**:
- NEVER use `cp` as a substitute for `finalize_svg.py`
- NEVER force `-s output` for the legacy/preview pptx (PowerPoint's internal SVG parser drops icons and rounded corners). Default auto-split already gives native the high-fidelity source it needs without affecting legacy.
- NEVER use `--only` (it suppresses one of the two output files)

> Source-directory split: by default `svg_to_pptx.py` reads `svg_output/` for the native pptx (preserves icon `<use>`, image `preserveAspectRatio` → `srcRect`, rounded rect `rx/ry` → `prstGeom roundRect`) and `svg_final/` for the legacy/preview pptx (PowerPoint's internal SVG parser needs the flattened form). Pass `-s output` or `-s final` only when you specifically want both products to read from a single source.

**Re-run rule**: Any change to `svg_output/` after post-processing requires re-running Steps 2-3. Step 1 only re-runs if `notes/total.md` changed.

---

## 6. Shadow & Overlay Techniques

> `<mask>` elements and `<image opacity="...">` are banned. Always use stacked `<rect>` or gradient overlays instead (see §2).

### Shadow

> **Shadow is restraint, not default.** The "designed" feel comes from absence, not abundance.

#### When to use

Only when the element genuinely floats above another layer:
- Card / quote bubble / annotation on a photo or colored panel
- Single primary CTA or "recommended" item picked out from peers
- Overlay layer (callout, tooltip, modal emphasis)
- Floating image card on a textured background

#### When NOT to use

- Background panels / dividers / decorative bars — they are the floor
- Equal peer cards in a 2/3/4-up grid — keep all flat
- Containers with visible border, gradient fill, or strong tint — redundant
- Body-text paragraph containers — disrupts scan rhythm
- Decorative lines / dividers / icons — they are symbols, not objects
- Pages with only one content container — no second layer to lift above
- Dark backgrounds — black shadows vanish; use 1px low-opacity white stroke or outer glow

**Per-page budget**: ≤2-3 shadowed elements. If you reach for a 4th, drop one first.

#### Single light source per page

All `feOffset` on a page must share the same `dx`/`dy` direction. Default: `dx="0"`, `dy="4"`-`dy="8"` (light from upper front).

#### Restraint over visibility

Standard: "the shadow is felt, not seen." If noticed, it's too strong.
- Resting cards: `flood-opacity` 0.06-0.12
- Raised elements (CTA, overlay): max `flood-opacity` 0.20
- Above 0.20 = Office 2007 hard-shadow look
- Color: near-black at low opacity, or a darker tint of background. Brand-color shadow only on accent elements sharing that hue.

#### Two-tier elevation maximum

A page may have at most two non-floor tiers.

| Tier | When | dy | stdDeviation | flood-opacity |
|------|------|----|--------------|---------------|
| Floor (no shadow) | Backgrounds, peer-grid cards, dividers, body-text containers | — | — | — |
| Resting | Cards on photos/panels, secondary callouts | 2-4 | 4-8 | 0.06-0.10 |
| Raised | Primary CTA, focused/recommended card, overlay | 6-10 | 10-16 | 0.12-0.20 |

#### Don't stack visual-weight tools

Pick **one** per container: shadow, border, gradient fill, or strong tint. Stacking = instant template look.

---

#### Filter Soft Shadow — Recommended

Best for: cards, floating panels, elevated elements. The `svg_to_pptx` converter automatically converts `feGaussianBlur` + `feOffset` into native PPTX `<a:outerShdw>`.

```xml
<defs>
  <filter id="softShadow" x="-15%" y="-15%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="12"/>
    <feOffset dx="0" dy="6" result="offsetBlur"/>
    <feFlood flood-color="#000000" flood-opacity="0.10" result="shadowColor"/>
    <feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadow"/>
    <feMerge>
      <feMergeNode in="shadow"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<rect x="60" y="60" width="400" height="240" rx="12" fill="#FFFFFF" filter="url(#softShadow)"/>
```

Recommended parameters (see "Two-tier elevation maximum" above for tier guidance):
```
stdDeviation:   4–16       (resting cards: 4–8;  raised elements: 10–16)
flood-opacity:  0.06–0.12  (resting cards — default)
                0.12–0.20  (raised elements only — primary CTA, overlay)
                NEVER     > 0.20  (Office 2007 hard-shadow look)
dy:             2–10       (resting: 2–4;  raised: 6–10)
dx:             0–2        (must match every other shadow on the page — single light source)
```

#### Colored Shadow

Best for: accent buttons, brand-colored cards. Use the element's own color family instead of black.

```xml
<filter id="colorShadow" x="-15%" y="-15%" width="140%" height="140%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
  <feOffset dx="0" dy="6" result="offsetBlur"/>
  <feFlood flood-color="#1A73E8" flood-opacity="0.20" result="shadowColor"/>
  <feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadow"/>
  <feMerge>
    <feMergeNode in="shadow"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

Replace `flood-color` with the element's brand color. Keep `flood-opacity` 0.12-0.20. Reserve for the single primary CTA per page — using on every button defeats the cue.

#### Glow Effect

Best for: title highlights, key metrics, hero text. The converter automatically converts `feGaussianBlur` without `feOffset` into native PPTX `<a:glow>`.

```xml
<defs>
  <filter id="titleGlow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
    <feFlood flood-color="#1A73E8" flood-opacity="0.45" result="glowColor"/>
    <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
    <feMerge>
      <feMergeNode in="glow"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<text x="640" y="360" text-anchor="middle" font-size="48" fill="#1A73E8" filter="url(#titleGlow)">Key Insight</text>
```

Recommended parameters:
```
stdDeviation:   4–8      (smaller = subtle, larger = prominent)
flood-color:    brand color or accent color (NOT black)
flood-opacity:  0.35–0.55  (stronger than shadow for visibility)
```

**vs shadow**: no `<feOffset>` (or dx=0/dy=0). The converter uses this to distinguish glow from shadow.

#### Layered Rect Shadow — High-Compatibility Fallback

Best for: maximum compatibility with older PowerPoint versions. Stack 2–3 semi-transparent rectangles behind the main card:

```xml
<!-- Shadow layers (back to front, largest offset first) -->
<rect x="68" y="72" width="400" height="240" rx="16" fill="#000000" fill-opacity="0.03"/>
<rect x="65" y="69" width="400" height="240" rx="14" fill="#000000" fill-opacity="0.05"/>
<rect x="62" y="66" width="400" height="240" rx="12" fill="#1A73E8" fill-opacity="0.04"/>
<!-- Main card -->
<rect x="60" y="60" width="400" height="240" rx="12" fill="#FFFFFF"/>
```

### Image Overlay

#### Linear Gradient Overlay — Most Common

Best for: image+text pages. Gradient direction should match text position (text on left → gradient darkens toward left).

```xml
<image href="..." x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice"/>
<defs>
  <linearGradient id="imgOverlay" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#1A1A2E" stop-opacity="0.85"/>
    <stop offset="55%"  stop-color="#1A1A2E" stop-opacity="0.30"/>
    <stop offset="100%" stop-color="#1A1A2E" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="1280" height="720" fill="url(#imgOverlay)"/>
```

#### Bottom Gradient Bar

Best for: cover slides and full-image pages with bottom title.

```xml
<defs>
  <linearGradient id="bottomBar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.72"/>
  </linearGradient>
</defs>
<rect x="0" y="380" width="1280" height="340" fill="url(#bottomBar)"/>
```

#### Radial Gradient Overlay — Vignette Effect

Best for: full-screen atmosphere slides; draws attention to the center.

```xml
<defs>
  <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
    <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
  </radialGradient>
</defs>
<rect x="0" y="0" width="1280" height="720" fill="url(#vignette)"/>
```

#### Brand Color Overlay

Best for: slides needing strong visual brand identity.

```xml
<defs>
  <linearGradient id="brandOverlay" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#005587" stop-opacity="0.80"/>
    <stop offset="100%" stop-color="#005587" stop-opacity="0.10"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="1280" height="720" fill="url(#brandOverlay)"/>
```

### Quick-Reference Table

| Scenario | Recommended Technique | Avoid |
|----------|-----------------------|-------|
| Card / panel shadow (only when floating over photo/colored panel) | Filter soft shadow (`flood-opacity` 0.06–0.12, single light source) | Hard black shadow, full-page abundance |
| Equal peer cards in a grid | All flat (no shadow) | Lifting every card uniformly |
| Page-section background panel | Flat fill, no shadow | Treating panels as floating cards |
| Accent / CTA button (one per page) | Colored shadow (same hue family, `flood-opacity` 0.12–0.20) | Generic gray shadow, applying to every button |
| Title / metric highlight | Glow filter (brand color, no offset) | Overuse on body text |
| Text over image | Linear gradient overlay (direction matches text side) | Uniform flat opacity over whole image |
| Cover / full-image slide | Bottom gradient bar + brand color | Solid black overlay |
| Atmosphere / hero slide | Radial vignette | Unprocessed raw image |
| Max PPT compatibility needed | Layered rect shadow | Filter-based shadow |

---

## 7. Stroke, Text & Shape Effects

### stroke-dasharray — Dashed / Dotted Lines

Converts to native PPTX `<a:prstDash>`. Use preset patterns for best results:

| SVG Value | PPTX Preset | Best For |
|-----------|-------------|----------|
| `4,4` | Dash | General dashed lines, separators |
| `2,2` | Dot (sysDot) | Subtle dotted borders, placeholder outlines |
| `8,4` | Long dash | Timeline connectors, flow arrows |
| `8,4,2,4` | Long dash-dot | Technical drawings, dimension lines |

```xml
<rect x="60" y="60" width="400" height="240" rx="12"
  fill="none" stroke="#999999" stroke-width="2" stroke-dasharray="4,4"/>

<line x1="100" y1="360" x2="1180" y2="360"
  stroke="#CCCCCC" stroke-width="1" stroke-dasharray="2,2"/>
```

### stroke-linejoin

Controls how line segments join at corners. Supported values convert to native PPTX line join types:

| SVG Value | PPTX Equivalent | Best For |
|-----------|-----------------|----------|
| `round` | Round join | Smooth polyline charts, organic shapes |
| `bevel` | Bevel join | Technical diagrams |
| `miter` | Miter join (default) | Sharp-cornered rectangles, arrows |

```xml
<polyline points="100,200 200,100 300,200" fill="none"
  stroke="#1A73E8" stroke-width="3" stroke-linejoin="round"/>
```

### text-decoration

Supported text decorations convert to native PPTX text formatting:

| SVG Value | PPTX Equivalent | Best For |
|-----------|-----------------|----------|
| `underline` | Single underline | Emphasis, links, key terms |
| `line-through` | Strikethrough | Removed items, before/after comparisons |

```xml
<text x="100" y="200" font-size="20" fill="#333333" text-decoration="underline">Important Term</text>

<!-- Per-tspan decoration -->
<text x="100" y="240" font-size="18" fill="#333333">
  Regular text <tspan text-decoration="line-through" fill="#999999">old value</tspan> new value
</text>
```

### Gradient Fill — linearGradient & radialGradient

Gradients defined in `<defs>` and referenced via `fill="url(#id)"` convert to native PPTX `<a:gradFill>`. Use them as shape fills (not just overlays) for polished surfaces.

**Linear gradient** — best for buttons, header bars, background panels:

```xml
<defs>
  <linearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#1A73E8"/>
    <stop offset="100%" stop-color="#0D47A1"/>
  </linearGradient>
</defs>
<rect x="540" y="600" width="200" height="48" rx="24" fill="url(#btnGrad)"/>
```

**Radial gradient** — best for spotlight backgrounds, circular accents:

```xml
<defs>
  <radialGradient id="spotBg" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="#1A73E8" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="#1A73E8" stop-opacity="0"/>
  </radialGradient>
</defs>
<circle cx="640" cy="360" r="300" fill="url(#spotBg)"/>
```

### transform: rotate — Element Rotation

Rotation converts to native PPTX `<a:xfrm rot="...">`. Supported on all element types: `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`, `polyline`, `image`, and `text`.

```xml
<!-- Rotated decorative element -->
<rect x="100" y="100" width="60" height="60" fill="#1A73E8" fill-opacity="0.1"
  transform="rotate(45, 130, 130)"/>

<!-- Rotated text label -->
<text x="50" y="400" font-size="14" fill="#999999"
  transform="rotate(-90, 50, 400)">Y-Axis Label</text>
```

**Syntax**: `rotate(angle)` or `rotate(angle, cx, cy)` where `cx,cy` is the rotation center. Positive angles rotate clockwise.

### Arc Paths — Donut / Pie Charts

Calculate arc endpoint coordinates precisely with trigonometry. Never estimate — small errors produce wildly wrong shapes.

**Calculation formula** (center `cx,cy`, radius `r`, angle `θ` in degrees):
```
x = cx + r × cos(θ × π / 180)
y = cy + r × sin(θ × π / 180)
```

**Key rules**:
1. Start at **-90°** (12 o'clock position) and go clockwise
2. Each sector spans `percentage × 360°`
3. Use **large-arc flag = 1** when the sector is > 180°, **0** otherwise
4. sweep-direction = 1 (clockwise) for outer arc, 0 (counter-clockwise) for inner arc returning
5. **Always verify** that the sum of all sector angles equals 360° and that the last sector's end point matches the first sector's start point

**Example — 75% donut sector** (center 400,400, outer r=180, inner r=100):
```
Start angle: -90°    → outer(400, 220), inner(400, 300)
End angle: -90+270=180° → outer(220, 400), inner(300, 400)
Large-arc flag: 1 (270° > 180°)

<path d="M 400,220 A 180,180 0 1,1 220,400 L 300,400 A 100,100 0 1,0 400,300 Z"/>
```

### Polygon Arrows on Diagonal Lines

> For connector lines prefer `marker-end`/`marker-start` (§1.1). For chunky/wide solid/non-connector arrows, use standalone polygon or path.

Horizontal/vertical lines can use simple point offsets for `<polygon>` arrowheads. Diagonal lines need triangle vertices rotated to match line direction.

**Method** — calculate triangle points using the line's direction vector:

```
Given line from (x1,y1) to (x2,y2):
1. Direction vector: dx = x2-x1, dy = y2-y1
2. Normalize: len = √(dx²+dy²), ux = dx/len, uy = dy/len
3. Perpendicular: px = -uy, py = ux
4. Arrow tip = (x2, y2)
5. Back point 1 = (x2 - ux×12 + px×5,  y2 - uy×12 + py×5)
6. Back point 2 = (x2 - ux×12 - px×5,  y2 - uy×12 - py×5)
```

**Example — diagonal line** from (260,310) to (370,430):
```
dx=110, dy=120, len≈162.8, ux=0.676, uy=0.737
px=-0.737, py=0.676
Tip: (370, 430)
Back1: (370-8.1-3.7, 430-8.8+3.4) = (358.2, 424.6)
Back2: (370-8.1+3.7, 430-8.8-3.4) = (365.6, 417.8)

<polygon points="370,430 365.6,417.8 358.2,424.6" fill="#C8A96E"/>
```

⚠️ Never use a fixed downward/rightward triangle on a diagonal line — arrow will point wrong.

---

## 8. Project Directory Structure

```
project/
├── svg_output/    # Raw SVGs (Executor output, contains placeholders)
├── svg_final/     # Post-processed final SVGs (finalize_svg.py output)
├── images/        # Image assets (user-provided + AI-generated)
├── notes/         # Speaker notes (.md files matching SVG names)
│   └── total.md   # Complete speaker notes document (before splitting)
├── templates/     # Project templates (if any)
└── *.pptx         # Exported PPT file
```

```

### B5. references/image-layout-patterns.md (verbatim)

```markdown
# Image-Text Layout Patterns

A vocabulary registry of ways images can be placed on a slide. The point of this file is to **expand the mental list of options** so that when you reach for an image layout, you do not default to the same three patterns (left/right, top/bottom, full-bleed cover).

Every entry has a name plus a short technical hint. Common techniques get a single line. Less obvious or easily forgotten techniques get a short paragraph — not a full tutorial, but enough that a model unfamiliar with the project can implement it without guessing. This is a registry, not a teaching document; no use-case prescriptions, no decision tables.

> **Numbers are stable identifiers, not sequence.** The file is split into **Part 1 — Primary Structures** (#1–#19, #38–#56) and **Part 2 — Modifier Layers** (#20–#37, #57–#72). Numbers jump within each Part because Primary structures were grouped first; existing references to `#38`, `#48`, etc. anywhere in the project still resolve correctly.

---

## Core Principle — Two Layers

Almost every pattern below is an instance of one underlying split:

> **The image carries atmosphere, world-building, emotional weight. Native SVG shapes carry information, data, editable text.**

This is the single most underused move in image-heavy decks. The default reflex is to place image and text in adjacent rectangles. The far more powerful move — especially for content-rich pages — is to let the image **be the canvas** (often full-bleed) and draw native vector elements (annotation cards, flow nodes, KPI tiles, leader lines, network diagrams, dashboards) directly on top.

Anything that must be editable, numerically accurate, contain Chinese, or be styled to the deck's exact palette belongs in the SVG layer regardless of what the image looks like underneath.

---

# Part 1 — Primary Structures

Pick one or more of these as the page's bones. Cross-primary combinations are encouraged (see Composition Guidance).

## Container Layouts (where the image sits)

1. **Full-bleed background with floating title** — `<image x=0 y=0 width=1280 height=720 preserveAspectRatio="xMidYMid slice"/>` + scrim `<rect>` for legibility + overlay `<text>`.

2. **Left-third image + right text body** — `<image x=0 y=0 width=~427 height=720>` on the left; text area in the remaining width; optional right-edge gradient fade for smooth transition.

3. **Right-third image + left text body** — mirror of #2.

4. **Right image bleeding off the canvas edge** — `<image>` width extended past viewBox; text on left with a rightward gradient fade so the image emerges from the text area without a visible boundary.

5. **Top-band image + bottom multi-column text** — `<image x=0 y=0 width=1280 height=~340>` at the top + bottom-fade gradient + 2–3 evenly spaced text columns below.

6. **Bottom-band image + top title + middle text** — mirror of #5 with the image at the bottom and a top-fade gradient.

7. **Top-and-bottom symmetric split** — image occupies 50% (top or bottom) with a divider line or thin gradient band separating the halves.

8. **Z-pattern serpentine** — three rows, image on the left in rows 1 and 3, on the right in row 2 (or alternating). Each row roughly 1/3 canvas height; visual flow zigzags down the page.

9. **3×3 grid with central image** — nine cells; center cell holds the image, the other 8 hold text blocks, color swatches, or small data widgets.

10. **Centered image with radial callouts pointing outward** — image (often circular via `clipPath`) at canvas center; multiple `<line>` leader lines + small `<circle>` endpoints + offset text labels in surrounding space.

11. **Diagonal split with directional gradient (not hard polygon cut)** — full-bleed `<image>` (do NOT hard-clip) + overlay `<rect fill="url(#grad)">` whose `<linearGradient>` axis runs along the desired diagonal + a `<line>` on the diagonal to make the divider visible. The gradient does the "splitting" softly; hard polygon clipping produces ugly stair-step edges on text panels.

12. **Faded image as backdrop with oversized overlay text** — `<image>` + heavy semi-transparent `<rect fill="bg-color" fill-opacity="0.5–0.7">` over it + huge `<text>` (80–120px) on top. Image becomes texture; text is the subject.

13. **Narrow vertical image strip + giant horizontal title** — `<image x=0 y=0 width=200–280 height=720>` + thick divider `<rect>` + large `<text>` (60–90px) in the remaining width.

14. **Horizontal banner strip cutting through mid-section** — `<image y=middle width=1280 height=200–280>` with edge fades; text blocks above and below the band.

15. **Multi-image montage with bold text spanning across** — multiple `<image>` tiled with 2–4px gaps + large `<text>` (60–100px) in a darkened band spanning the full montage. The band uses `<rect fill-opacity="0.5–0.7">` to keep text legible across all underlying images.

16. **Negative-space dominant — small image, mostly whitespace** — image and text together occupy less than 40% of the canvas; rest is empty.

17. **Picture-in-picture inset** — large `<image>` background + small `<image>` overlaid inside it with a `<rect>` frame.

18. **Image as full-height sidebar column** — narrow `<image x=0 y=0 width=~200–280 height=720>`; rest of canvas is content area.

19. **Image floating in whitespace with thin frame and caption** — `<image>` + thin `<rect fill="none" stroke="…">` frame around it + `<text>` caption below.

## Image-as-Canvas + Native Overlay (the most underused family)

This is the family that opens up the largest design space and the one AI is most likely to skip. The shared pattern: image fills the slide (or a large region), native SVG elements are layered on top to carry the actual information. None of the overlay elements need to be generated by the image model — they are vector primitives you draw yourself.

38. **Background image + annotation cards with bezier leader lines** — full-bleed `<image>` + 2–4 small info cards (`<rect rx>` + icon + title + one-line text) placed in the image's calm regions. From each card, draw a bezier `<path>` ending in a `marker-end` arrow that points to the specific object in the image being annotated. Card text and leader lines are editable; image is the scene.

39. **Background image + flow nodes drawn over the scene** — the image is a real or rendered scene (workshop, control room, landscape). On top, draw a dashed `<path>` route that traces a workflow through the scene, with numbered `<circle>` nodes at each stop. Each node = number + icon + label. The flow is fully editable; the image is atmosphere.

40. **Background image + floating KPI metric cards** — full-bleed image (often an operations photo) + dark scrim + multiple `<rect>` cards in negative-space regions. Each card = icon + small label + large metric number. Image gives context; cards give the data.

41. **Background image + measurement lines and module tags (engineering overlay)** — used on technical / blueprint / cross-section images. Draw measurement lines with end-caps (`<line>` + perpendicular ticks) spanning a feature, with a centered label box reading dimensions or part names. Add tagged callouts with `<rect>` + monospace text. Reads as engineering drawing markup.

42. **Background image + glassmorphism UI panels** — image is the visual world; on top, draw UI elements (semi-transparent panels, progress arcs, status badges, indicators). Panels use `fill-opacity="0.6–0.8"` + thin light-color strokes; arcs via `<path d="…A…">`. Looks like a live dashboard floating above the scene.

43. **Background image + native data chart on top** — AI image generation cannot produce accurate data charts. Solution: use an AI-generated dashboard image as **visual reference only** (clearly labeled as such in a caption), and draw the actual chart with native SVG primitives (`<line>` axes, `<path>` series, `<circle>` data points) directly on or next to it. Required marker if exporting: `<!-- chart-plot-area: x_min,y_min,x_max,y_max -->` inside the chart group.

44. **Background image + native network/architecture diagram** — same logic as #43 but for structural diagrams. Image provides atmosphere or visual anchor; the actual nodes, connections, and labels are SVG circles, lines, icons, and text — all editable.

45. **Background image + numbered hotspots with sidebar legend** — small numbered `<circle>` markers placed on the image at points of interest. A sidebar (left or right) lists "1. … 2. … 3. …" with corresponding descriptions.

46. **Background image + bordered "lens" rectangle highlighting a sub-region** — full-bleed image + a bordered `<rect fill="none" stroke="accent" stroke-width="3"/>` framing a sub-region + caption nearby. Frame draws the eye to one detail without occluding the surrounding context.

## Multi-Image Compositions

47. **Small multiples — 3–6 same-kind images in an evenly spaced row** — each in identical container, each with identical caption block underneath (title + one-line description). This is **not** a generic grid: the identical framing is itself the message — readers compare across panels because the structure is the same. Useful for style comparisons, time-series snapshots, product variations.

48. **Side-by-side comparison (before/after, A/B, then/now)** — two `<image>` of equal size in 50/50 split with thin divider `<line>` and "before" / "after" labels.

49. **Asymmetric collage** — one large `<image>` + 2–3 smaller `<image>` arranged around it; sizes vary, gaps consistent.

50. **Tiled grid (2×2, 2×3, 3×3) with equal cells** — `cell_size = (canvas - total_gap) / cols`; consistent `gap=2–20px`.

51. **Mosaic** — irregular tile sizes packed together with or without thin gaps; each image clipped to its tile's rect.

52. **Image strip / filmstrip** — horizontal sequence of `<image>` elements with thin gaps; same height, varying widths allowed.

53. **Vertical image stack** — column of `<image>` aligned by width, shared annotations on one side.

54. **Overlapping image stack** — `<image>` elements with overlapping `x/y` positions; each subsequent one in front (z-order by document order); often combined with slight rotation for layered photo-print look.

55. **Diptych split — two images abutting at 50/50** — vertical or horizontal split with optional thin divider `<line>`.

56. **Image triptych** — three independent `<image>` side-by-side, equal widths or 2:1:2 etc. (distinct from #26 baked-in triptych, where the three scenes are inside one image file).

---

# Part 2 — Modifier Layers

Stack any of these freely on top of a Primary structure. Multiple Modifiers per page is the expected case, not the exception.

## Non-rectangular Image Shapes

20. **Circular crop** — `<clipPath><circle cx cy r/></clipPath>` referenced by `<image clip-path="url(#id)"/>`.

21. **Rounded rectangle crop** — `<clipPath><rect rx ry/></clipPath>`; the `rx` value controls roundness.

22. **Ellipse / oval crop** — `<clipPath><ellipse cx cy rx ry/></clipPath>`.

23. **Hexagonal / polygonal crop** — `<clipPath><polygon points="x1,y1 x2,y2 …"/></clipPath>`; remember to keep all vertices inside the image's display rectangle.

24. **Custom path crop (blob, arrow, leaf, silhouette)** — `<clipPath><path d="…"/></clipPath>`; allows any curved or organic shape. PowerPoint export translates this to `custGeom` and survives roundtrip.

25. **Layered paper-cut stack** — multiple image or shape layers each with `clipPath` + a small `<feDropShadow>` offset to fake physical layering depth. Each layer casts a shadow onto the next, producing real-looking craft depth.

26. **Triptych baked into a single wide image** — one wide `<image width=1160 height=334>` whose internal composition already contains 2–3 scenes. Generate the triptych as one image (not three separate calls) when scene-to-scene consistency matters — the model preserves character identity, lighting continuity, and color grading far more reliably when panels are produced together.

## Overlay & Masking Treatments

27. **Linear gradient mask for text legibility** — `<linearGradient>` in `<defs>` (set `x1/y1/x2/y2` for direction) + overlay `<rect fill="url(#grad)">`. Most common is top-to-bottom darkening on full-bleed cover images.

28. **Radial gradient vignette** — `<radialGradient cx cy r>` with dark outer stops; overlay `<rect>`. Focuses attention by darkening the periphery.

29. **Two-stop scrim — opaque on text side, transparent on focal side** — `<linearGradient>` with one stop at `stop-opacity="0.9"` and another at `stop-opacity="0"`. Use when text sits on one side and the image's subject on the other.

30. **Flat semi-transparent rectangle overlay** — `<rect fill="#000" fill-opacity="0.4"/>` over the image. Uniform darkening/lightening; simplest scrim.

31. **Color-tinted overlay** — `<rect fill="#brandColor" fill-opacity="0.15–0.25"/>`. Pushes a foreign-looking image toward the deck's palette without regenerating it.

32. **Multi-stop scrim with hue shift** — three-or-more-stop `<linearGradient>` where stops are different colors (e.g. dark navy → transparent → warm orange). This re-grades the image's color world without regenerating — particularly useful when an AI image came back with the right composition but wrong color temperature.

33. **Spotlight mask — clear region surrounded by darkness** — cover the canvas with `<rect>` filled by a `<radialGradient>` whose inner stop is fully transparent and outer stop is opaque dark. Reads as a flashlight beam on the focal area. Use sparingly — it kills everything outside the spotlight.

34. **Gaussian-blur backdrop** — `<filter><feGaussianBlur stdDeviation="8–15"/></filter>` applied to the background image, with sharp content layered on top unblurred. Reads as depth-of-field. Be aware that filters have inconsistent PPT export support — if fidelity matters, bake the blur into the source image instead.

35. **Duotone treatment** — two-color mapping of a photograph (e.g. deep navy shadows + warm cream highlights). Most reliable when baked into the source image at generation time. Runtime SVG duotone via `<feColorMatrix>` + `<feComponentTransfer>` is possible but the filter chain is fragile through PPT export — only attempt if you control the renderer.

36. **Drop shadow under image panel** — `<filter><feDropShadow dx dy stdDeviation flood-color flood-opacity/></filter>` applied to the image's container `<rect>` (or to the `<image>` itself). Standard depth lift.

37. **Inner / outer glow on overlay shape** — `<filter><feGaussianBlur/><feMerge/></filter>` on a shape, or simply a slightly larger blurred `<rect>` underneath the target.

## Image as Texture / Atmosphere

57. **Full-bleed image with extreme low opacity as texture wash** — full-bleed `<image>` + overlay `<rect fill="bg-color" fill-opacity="0.7–0.85"/>` so the image only barely shows through.

58. **Image fragment as decorative corner element** — small `<image>` (often with `clipPath`) placed in one corner; not the focus, just visual seasoning.

59. **Image as horizontal divider band** — narrow `<image height=80–150>` placed between two text sections instead of a `<line>` divider.

60. **Image as ambient noise** — visible but low contrast; mood-setting only, not informational.

61. **Image as watermark behind body content** — large `<image>` at very low opacity behind body text. Use either a pre-baked low-alpha image or a high-opacity overlay `<rect>` to suppress visibility.

## Special Techniques

62. **Same image, two references — full view + zoom-callout** — reference the same image file twice in two `<image>` elements: one shows the full scene at normal size; the second uses `clipPath` (circle or rectangle) plus a larger display size to "zoom into" a sub-region. Connect them with a bezier `<path>` ending in `marker-end`; ring the zoom with a `<circle stroke>` so it reads as a magnifying lens. No special asset needed — the zoom effect comes from same-source-different-display.

63. **Transparent PNG sticker / cutout** — an RGBA PNG (with alpha channel) placed via standard `<image>` — no `clipPath` required, the transparency lives in the file itself. Useful for subjects that should not appear inside a rectangular frame (people cutouts, product shots, decorative motifs floating over backgrounds). Producing transparent PNGs is **not** a standard ppt-master pipeline step — three paths: (a) AI backend that supports transparent output natively, (b) generate a chroma-key (solid green background) image then strip the green with a separate tool, (c) user-supplied transparent asset. SVG-side usage is trivial; asset preparation is the work.

64. **Image with embedded text rendered by the AI** — text becomes part of the artwork: decorative lettering, designed title, hand-lettered keyword. Prompt with explicit text content. Reliable only for **short English**. Chinese characters, long phrases, and digits regularly come back malformed and cannot be edited. Anything that must be correct or editable goes in the SVG `<text>` layer.

65. **Image with NO text — labels added as native SVG** — generate the image with explicit "no text, no letters, no numbers, no signs" instruction (`text_policy: none`), then place all labels as `<text>` overlays. Default safe path for any deck with Chinese, data, or editable copy.

66. **Image fading into the solid background** — soften the image's edge into the deck's background color via a `<linearGradient>` overlay whose end-stop matches the background hex exactly. The image's rectangular boundary disappears, producing seamless integration.

67. **Image with knock-out / cut-out shape** — overlay a shape filled with the background color or another image, creating the impression of a hole punched through the underlying image.

68. **Text-as-mask over image** — letterforms revealing image through them. SVG-level `<mask>` is forbidden in this project (PPT export breaks). The only reliable way: bake this effect into the image at generation time by prompting for "large lettering revealing the underlying scene through letterforms." Treat as a pre-rendered artistic choice, not a runtime effect.

69. **Image rotated at a slight angle for editorial feel** — `transform="rotate(angle cx cy)"` on the `<image>` or its container `<g>`; 2–6 degrees typical. Adds dynamism without breaking layout.

70. **Image with thin colored matte frame** — `<rect fill="none" stroke="#color" stroke-width="2–6"/>` over or around the image edge. Single rule, single color.

71. **Image with multiple stacked frames for "photo print" aesthetic** — nested `<rect>` outlines or `<rect>` containers of slightly different sizes giving a "framed photograph" look.

72. **Image-to-image transition / merge** — two `<image>` elements with overlapping regions, one or both with gradient masks (from group C) creating a soft blend between them.

---

## Composition Guidance

A page is built by layering. Pick one or more **Primary Structures** (Part 1) as the page's bones, then add any number of **Modifier Layers** (Part 2) for finish. Both stack — the question on each page is "is the next layer still earning its place", not "have I exceeded a quota".

**Cross-primary combinations are encouraged.** A side-by-side comparison (#48) where each side is annotated with bezier-leader cards (#38) is one page, not a violation. A 3×3 grid (#9) whose center cell is upgraded to an image-as-canvas with KPI overlay (#40) reads as one composition. The old reflex "one primary per page" tends to under-use the catalog — combine when the page asks for it.

**Modifier stacking pattern that works in practice** — observed on real content pages combining one Primary with four Modifiers:

- one Primary from Part 1 (e.g. #48 side-by-side comparison)
- `#21` rounded-rectangle clipPath on the image (rx=6 or circle)
- `#27` top-edge linearGradient in the deck's accent color, opacity 0.55 → 0
- `#66` bottom-edge linearGradient fading to background color, opacity 0 → 0.95
- small color-block badge + reversed-out label replacing any opaque color bar that would otherwise sit over the image

Combine freely. The "AI-default" failure mode is the opposite: defaulting to bare #2 / #3 (left/right split) with no Modifier at all.

**Skip-detection signal** — if every page's `Layout pattern` column resolves to bare #2 / #3 / #5 / #6 with no Modifier ids, the catalog was not consulted. Re-read and reconsider.

## Hard Constraints

- Long body copy, data points, numeric labels, and Chinese text always go in the SVG layer — never baked into the image.
- `<clipPath>` on `<image>` and transparency encoding (`fill-opacity` / `stop-opacity`, never `rgba()`) — authoritative form in [`shared-standards.md`](shared-standards.md) §1.2 and §2; do not restate or relax here.
- No `<mask>`, no `<feComposite>` for alpha compositing. Alpha-effect routing (gradient overlays, clipPath crops, filter shadows, baked-in source image) is the table in [`shared-standards.md`](shared-standards.md) §1.0.
- `<feDropShadow>` / `<feGaussianBlur>` are accepted but PPT export is inconsistent — bake into the source image when fidelity is critical.

---

For sizing math (calculating container dimensions from image aspect ratio when using side-by-side intent), see [`image-layout-spec.md`](image-layout-spec.md). This file is the design vocabulary; that file is the dimension calculator.

```
