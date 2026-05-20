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

