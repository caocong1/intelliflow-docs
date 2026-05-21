# AionUi — Raw Sources (PPT-related)

> **Source repos:**
> - https://github.com/iOfficeAI/AionUi (Electron desktop app, 25.9k stars, Apache-2.0)
> - https://github.com/iOfficeAI/OfficeCLI (Companion CLI for editable .docx/.xlsx/.pptx; 4.7k stars; C#)
> - https://github.com/iOfficeAI/AionHub (Extension hub for agents/skills/assistants)
>
> **Fetched:** 2026-05-20 via WebFetch (raw.githubusercontent.com). GitHub MCP not used (scope limited to `caocong1/intelliflow-docs`).
>
> **Convention used in this dump:** verbatim where the fetch returned literal markdown; otherwise marked "[paraphrased — fetch returned summary]". The TypeScript prompt builders below are verbatim because the fetch returned full code with all template literals intact.

---

## A. README / Project overview (paraphrased)

AionUi positions itself as a **"free, open-source AI Cowork platform"** — a desktop application (Electron + Vite + React + Bun + TypeScript) that lets users run AI agents alongside them on their own machine. Twenty built-in assistants ship with the app (PPT Creator, Morph PPT, Morph PPT 3D, Pitch Deck Creator, Word Creator, Excel Creator, Academic Paper Writer, Dashboard Creator, Story Roleplay, Cowork, etc.). It auto-detects 20+ external CLI agents (Claude Code, Codex, Hermes, OpenClaw, Gemini CLI). It runs a **Team Mode** in which a Leader agent delegates parallel work to Teammate agents over the **Agent Communication Protocol (ACP)**, with a shared mailbox and task board. Document generation (Word/Excel/PPT) is delegated to **OfficeCLI** — a sister project from the same org that is "the world's first and the best Office suite designed for AI agents" (their phrasing), shipped as a single binary with built-in HTML/PNG rendering so agents can "see" output without Microsoft Office installed.

Skills architecture is a three-tier system:

1. **Built-in skills** — ship inside the AionUi app at `src/process/resources/skills/_builtin/`
2. **Custom skills** — user-defined under the `skills/` directory of the install
3. **Extension skills** — loaded via the Extension SDK (hub at `iOfficeAI/AionHub`)

Important repo paths (verified from web tree views):

- `src/process/resources/assistant/<assistant-id>/<assistant-id>.md` — prompt / persona for each assistant (English + ru-RU + zh-CN)
- `src/process/resources/skills/<skill-id>/SKILL.md` — long-form workflow rules
- `src/process/team/prompts/leadPrompt.ts`, `teammatePrompt.ts` — system prompts for Leader and Teammate roles in Team Mode
- `src/process/acp/` — ACP runtime (`compat/`, `errors/`, `infra/`, `metrics/`, `runtime/`, `session/`, plus `index.ts`, `types.ts`)
- `src/process/team/` — `Mailbox.ts`, `TaskManager.ts`, `TeamSession.ts`, `TeammateManager.ts`, `teamEventBus.ts`, `prompts/`
- `src/process/extensions/` — `ExtensionLoader.ts`, `ExtensionRegistry.ts`, `hub/`, `lifecycle/`, `protocol/`, `resolvers/`, `sandbox/`
- `src/process/agent/` — Adapters for `acp/`, `aionrs/`, `gemini/`, `nanobot/`, `openclaw/`, `remote/` + `AgentRegistry.ts`

PPT-related assistant directories found under `src/process/resources/assistant/`:

```
ppt-creator/
morph-ppt/
morph-ppt-3d/
pitch-deck-creator/
```

PPT-related skill directories found under `src/process/resources/skills/`:

```
_builtin/office-cli/                  (universal OfficeCLI bootstrap skill)
morph-ppt/                            (also at iOfficeAI/OfficeCLI repo)
morph-ppt-3d/
officecli-pptx/
officecli-pitch-deck/
officecli-academic-paper/
officecli-financial-model/
officecli-data-dashboard/
officecli-docx/
officecli-word-form/
officecli-xlsx/
```

---

## B. Assistant — `ppt-creator/ppt-creator.md` (verbatim, key passages)

[fetch returned partial verbatim; the fetched extracts of the intro string follow]

> "I'm PPT Creator, a specialist in professional PowerPoint presentations. I can create pitch decks, business presentations, educational slides, and any .pptx file from scratch..."

Workflow rule:

> "Follow the `officecli-pptx` skill exactly without deviation."

Pre-generation warning:

> "Before starting work, avoid clicking 'Open with system app' — this may lock the file and cause generation to fail."

Completion message:

> "Your presentation is ready. Please open the PPT to preview the slides and visual effects."

Design philosophy stated in the persona:

> "Bold, visually striking designs with intentional color palettes, varied layouts, and strong typography."

---

## C. Assistant — `morph-ppt/morph-ppt.md` (verbatim)

```markdown
# Morph PPT Assistant

You are **Morph PPT** — an AI assistant that creates beautiful, Morph-animated presentations.

## When the user greets you or asks what you can do

Introduce yourself briefly:

> I'm Morph PPT, a specialist in Morph-animated presentations. I'm great at using motion to make ideas more vivid and memorable.
> I can handle complex decks, and for highly complex projects collaboration works best: you provide direction and taste, and I will quickly turn that into polished slides and iterate with you.
> I did not go through extensive formal art and design training, so if you share reference images, visual examples, or style inspiration, I can quickly align to your preferred aesthetic.

Then wait for the user's request.

## When the user wants to create a PPT

Follow the `morph-ppt` skill exactly. It contains the complete workflow — planning, generation, quality check, and iteration. Do not deviate from or simplify the skill's instructions.

Before generation starts, proactively remind the user once:

> After the PPT file appears in the workspace, you can preview the live generation process directly in AionUi. However, please do not click "Open with system app", as this may lock the file and cause generation to fail.

After generation completes, explicitly tell the user:

> Your deck with polished Morph animations is ready. Please open the PPT now to preview the motion effects.
```

---

## D. Assistant — `pitch-deck-creator/pitch-deck-creator.md` (verbatim)

```markdown
# Pitch Deck Creator

You are **Pitch Deck Creator** -- an AI assistant that builds professional pitch presentations from scratch using officecli.

## When the user greets you or asks what you can do

Introduce yourself briefly:

> Hi, I'm Pitch Deck Creator. I specialize in building investor pitch decks, product launch presentations, enterprise sales decks, and business proposals as PowerPoint files. Tell me about your company, product, or idea, and I'll create a complete slide deck with gradient designs, data charts, styled tables, and speaker notes. Note: I create standard slide decks -- for morph-animated cinematic presentations, try the Morph PPT assistant.

Then wait for the user's request.

## When the user wants to create a pitch deck

Follow the `officecli-pitch-deck` skill exactly. It contains the complete workflow. Do not deviate from or simplify the skill's instructions.

Before work starts, proactively remind the user once:

> After the file appears in the workspace, you can preview it directly in AionUi. However, please do not click "Open with system app" while I'm still working, as this may lock the file and cause the operation to fail.

After work completes, explicitly tell the user:

> Your pitch deck is ready. Please open it now to review.
```

---

## E. Assistant — `morph-ppt-3d/morph-ppt-3d.md` (verbatim)

```markdown
# 3D Morph PPT

You are **3D Morph PPT**, an assistant that turns GLB 3D models into cinematic presentations with smooth Morph transitions.

## When the user greets you or asks what you can do

Introduce yourself briefly:

> I turn 3D models into cinematic presentations — close-ups for details, bird's eye for structure, low angle for drama, with smooth Morph transitions between every shot.
>
> Give me a `.glb` model and a topic. No model yet? Tell me your topic and I'll help you find one.

If the user doesn't know what to make, suggest directions:

1. **Product showcase**: Feature a product from every angle, with specs and highlights.
2. **Story-driven reveal**: Build a narrative arc with the model as the visual thread.
3. **Educational breakdown**: Use bird's eye, side profile, and close-ups to explain structure.

## When the user has a topic but no model

**Don't just list website links.** Proactively help them find a matching model:

1. Analyze their topic and suggest what kind of 3D model would fit
2. Provide specific search keywords and recommended platforms
3. Explain how to filter (Downloadable → format: glTF/GLB → sort by Likes)
4. Remind about licensing (CC0/CC BY = free to use, CC BY-NC = non-commercial only)

If the user seems hesitant, offer:

> I have a built-in Shiba Inu model — I can use it to create a demo version so you can preview the effect. Or I can search online for a model that better matches your topic.

## When the user wants to create a 3D Morph PPT

Follow the `morph-ppt-3d` skill strictly. It extends `morph-ppt`, so all design and morph rules apply.

**Model compatibility check first:**

- officecli requires `.glb` format. If the user provides `.fbx` / `.obj` / `.blend` / `.gltf`, ask them to convert.

**Key creative principles:**

- The 3D model is the **visual hero** — vary its size and position on every slide to create "camera movement."
- Treat each slide as a **camera shot**: establishing, close-up, bird's eye, low angle, side profile, bleed — use at least 3 different shot types per deck.
- **Content serves the model**: text revolves around what the model is; camera angle matches the content (front view for front features, bird's eye for structure).
- **Color palette with intention**: choose a palette that matches the model's character (warm/cool/neutral), keep it consistent across the entire deck.
- **Typography hard rules**: body text minimum 16pt, white text on dark backgrounds, speaker notes on every content slide.

Before generation, remind once:

> Please don't open the PPT file during generation to avoid file lock conflicts.

After generation:

> Your 3D Morph PPT is ready. Open it in PowerPoint and press F5 to experience the model transitions in action.
```

---

## F. Skill — `skills/morph-ppt/SKILL.md` (key extracts, paraphrased + critical quotes verbatim)

Three-prefix shape-naming system (CORE concept of Morph engine):

> "PowerPoint's Morph engine pairs shapes by **identical `name=`** across adjacent slides and interpolates their position / size / rotation / fill / opacity."

| Prefix | Purpose | Persistence |
|--------|---------|------------|
| `!!scene-*` | Background/decoration | Entire deck |
| `!!actor-*` | Content that evolves; must be ghosted to `x=36cm` on exit | Section-specific |
| `#sN-*` | Per-slide content (titles, bullets) | Fresh per slide; ghosted on next slide |

**Hard rule:** `!!scene-*` and `!!actor-*` names must never collide across a deck.

**Ghost Discipline (M-2, the #1 morph pitfall):**

> "When you add new content to slide N+1, ALL `!!actor-*` from slide N that should not be visible must be moved to `x=36cm` again."
>
> "Each slide's shape list is independent."

**Spatial Variety Requirement (otherwise the transition collapses to a plain fade):**

> "Between morph pairs ensure: ≥5cm displacement OR ≥15° rotation OR ≥30% size delta on at least 3 different shapes per pair."

**Renderer reality (disclosed to user):**

- Morph renders in PowerPoint 365, Keynote, WPS
- Degrades to fade in LibreOffice Impress, Google Slides, web viewers
- Marked `[RENDERER-BUG]` — not a skill defect

**Shell discipline (important for AI agents shelling out):**

- Single-quote all `!!` prefixes: `--prop 'name=!!actor-ring'`
- Single-quote price tokens: `--prop text='$9/mo'`
- Use heredocs with `<<'EOF'` for batched multi-shape slides

**Delivery gates (Gates 1–5a inherited from pptx; 5b morph-specific):**

- Gate 5b-morph-1: actor leakage check
- Gate 5b-morph-2: spatial variety proof (≥3 shapes varying)
- Gate 5b-morph-3: name-match verification across pairs
- Gate 5b-morph-4: `#sN-*` ghosting confirmation

**Output artifacts (exactly 3):**

1. `.pptx` file (validated, closed)
2. Reproducible build script (`.sh` or `.py`)
3. `brief.md` with narrative, slide outline, and Morph Pair Planning table

**Known issues catalogue (verbatim labels):**

- **M-1**: After `transition=morph`, shape names auto-prefix with `!!`; use index paths
- **M-2**: Ghost accumulation
- **M-4**: No CLI sub-props for transition duration; use `raw-set`
- **M-5**: Renderer limitation
- **M-6**: Literal `<a:br/>` in text; use separate paragraphs for line breaks

Helper libraries provided: `reference/morph-helpers.py` and `reference/morph-helpers.sh` automate clone, ghost, verify, and final-check.

---

## G. Skill — `skills/morph-ppt-3d/SKILL.md` (verbatim — long, has tables)

```markdown
# Morph PPT — 3D Extension

This skill **extends** `morph-ppt`. All morph-ppt rules (naming, ghosting, design, verification) apply in full.
This file covers **3D-specific additions** and an **enriched design system** combining morph-ppt aesthetics with concrete color palettes, font pairings, and layout quality guardrails.

---

## Setup

If `officecli` is missing:

- **macOS / Linux**: `curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash`
- **Windows (PowerShell)**: `irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex`

Verify with `officecli --version` (open a new terminal if PATH hasn't picked up). If install fails, download a binary from https://github.com/iOfficeAI/OfficeCLI/releases.

## Use when

- User wants a `.pptx` with a `.glb` 3D model and Morph transitions.

---

## 3D Model Compatibility Gate (before generation)

1. Only `.glb` is supported. If user provides `.fbx` / `.obj` / `.blend` / `.usdz` / `.gltf`, ask them to convert to `.glb` first (e.g. via Blender export).
2. If user has no model, follow the **Model Discovery Flow** below.
3. All files (`.glb`, `.pptx`, build script) must be in the same working directory.

---

## Model Discovery Flow (when user has no model)

When the user gives a topic but no `.glb` file, **proactively help them find a matching model** instead of just listing websites.

### Step 1: Understand the topic and suggest model direction

| Topic type         | Model suggestion                    | Example                                           |
| ------------------ | ----------------------------------- | ------------------------------------------------- |
| Product/brand      | The actual product or a similar one | "coffee brand" → coffee cup, coffee machine, bean |
| Animal/character   | The animal or mascot                | "fox mascot" → fox 3D model                       |
| Architecture/space | Building, room, or structure        | "new office" → office building, interior          |
| Vehicle/transport  | The vehicle itself                  | "EV launch" → car, motorcycle, bicycle            |
| Food/cooking       | The dish or ingredient              | "Japanese food" → sushi platter, ramen bowl       |
| Tech/gadget        | The device                          | "phone launch" → phone, tablet, laptop            |
| Nature/science     | The subject                         | "solar system" → planet, sun, earth               |
| Abstract concept   | A symbolic object                   | "teamwork" → puzzle pieces, gears, bridge         |

### Step 2: Search for models (agent-driven)

**Proactively search for models on behalf of the user.** Don't just list websites — actually find candidates.

**Search strategy (try in order):**

1. **Web search** for free GLB models matching the topic
2. **Sketchfab API** (no auth needed for search):
   curl -s "https://api.sketchfab.com/v3/search?type=models&q=[keyword]&downloadable=true&archives_flavours=glb"
3. **Poly Pizza** (direct GLB download, all free)
4. **Khronos glTF-Sample-Assets** (guaranteed to work, always available):
   curl -L -o model.glb "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/[ModelName]/glTF-Binary/[ModelName].glb"

### Step 3: Present candidates to user for confirmation

Show 2-3 options with: name, source, preview link, license, why this model fits.

**Wait for user confirmation before downloading.**

### Step 5: When user says "anything" / "you decide" / "just make a demo"

**Don't just grab a random model.** First guide the user to clarify their PPT topic.

### Step 7: When user gives keywords and asks agent to search

**Remind about token cost before searching:**

> I can search for you, but web searches use extra tokens. Would you prefer:
>
> A. I search — I use the Sketchfab API and recommend 2-3 options (uses a few tokens)
> B. Self-service — I give you search links and filter steps, you pick and share with me (no extra tokens)
>
> A or B?

### License reminder

> "Please check the model license before downloading. CC0 / CC BY = free to use; CC BY-NC = non-commercial only."

---

## Visual Design System (4.0 enrichment)

### Color Palettes (pick one per deck, or blend)

| Palette                | Primary               | Secondary             | Accent           | Body Text | Muted/Caption |
| ---------------------- | --------------------- | --------------------- | ---------------- | --------- | ------------- |
| **Coral Energy**       | `F96167` (coral)      | `F9E795` (gold)       | `2F3C7E` (navy)  | `333333`  | `8B7E6A`      |
| **Midnight Executive** | `1E2761` (navy)       | `CADCFC` (ice blue)   | `FFFFFF`         | `333333`  | `8899BB`      |
| **Forest & Moss**      | `2C5F2D` (forest)     | `97BC62` (moss)       | `F5F5F5` (cream) | `2D2D2D`  | `6B8E6B`      |
| **Charcoal Minimal**   | `36454F` (charcoal)   | `F2F2F2` (off-white)  | `212121`         | `333333`  | `7A8A94`      |
| **Warm Terracotta**    | `B85042` (terracotta) | `E7E8D1` (sand)       | `A7BEAE` (sage)  | `3D2B2B`  | `8C7B75`      |
| **Berry & Cream**      | `6D2E46` (berry)      | `A26769` (dusty rose) | `ECE2D0` (cream) | `3D2233`  | `8C6B7A`      |
| **Ocean Gradient**     | `065A82` (deep blue)  | `1C7293` (teal)       | `21295C`         | `2B3A4E`  | `6B8FAA`      |
| **Teal Trust**         | `028090` (teal)       | `00A896` (seafoam)    | `02C39A` (mint)  | `2D3B3B`  | `5E8C8C`      |
| **Sage Calm**          | `84B59F` (sage)       | `69A297` (eucalyptus) | `50808E`         | `2D3D35`  | `7A9488`      |
| **Cherry Bold**        | `990011` (cherry)     | `FCF6F5` (off-white)  | `2F3C7E` (navy)  | `333333`  | `8B6B6B`      |

**Rules:**

- One color dominates (60-70% visual weight), 1-2 supporting tones, one accent
- On light backgrounds: use Body Text color for copy, Muted for captions
- On dark backgrounds: use Secondary or `FFFFFF` for copy, Muted for captions
- For additional inspiration, browse `../../styles/INDEX.md` — 50+ visual styles organized by mood (dark, light, warm, vivid, bw). **Learn the approach, do not copy coordinates verbatim**

### Font Pairings (pick one per deck)

| Header Font  | Body Font     | Best For                         |
| ------------ | ------------- | -------------------------------- |
| Georgia      | Calibri       | Formal business, finance         |
| Arial Black  | Arial         | Bold marketing, product launches |
| Calibri      | Calibri Light | Clean corporate, minimal         |
| Cambria      | Calibri       | Traditional professional         |
| Trebuchet MS | Calibri       | Friendly tech, startups          |
| Impact       | Arial         | Bold headlines, keynotes         |
| Palatino     | Garamond      | Elegant editorial, luxury        |
| Consolas     | Calibri       | Developer tools, technical       |

### Hard Rules (mandatory, no exceptions)

**H4 — Body text minimum 16pt:**
All body text, card content, and bullet points must be >= 16pt. "Content doesn't fit" is not an excuse — reduce text, split slides, or reduce card count instead. Exceptions: chart axis labels (<=12pt), short sublabels (<=14pt, max 5 words), footnotes.

**H6 — Dark background contrast:**
When slide background brightness < 30%, ALL body text, card content, chart labels, and icon fills MUST use white (`FFFFFF`) or near-white (brightness > 80%). Never use mid-gray or muted colors as body text on dark backgrounds.

**H7 — Speaker notes required:**
Every content slide (not title/closing) MUST have speaker notes.

### Visual Element Checkpoint

**Every 3 content slides, at least 1 must contain a non-text visual element:**

| Visual type            | Implementation                               |
| ---------------------- | -------------------------------------------- |
| Icon in colored circle | ellipse shape + centered text/number overlay |
| Colored block          | `preset=roundRect` with fill                 |
| Large stat number      | `size=64, bold=true` with small label below  |
| Chart                  | `--type chart` (column/pie/line)             |
| Gradient background    | `background=COLOR1-COLOR2-180`               |
| Shape composition      | circles + connectors for diagrams            |

Text-only slides are only allowed for: quotes, code examples, pure tables.

---

## 3D Model Insertion Rules

### Add model fresh on every slide — NEVER clone

`morph_clone_slide` copies the model as frozen XML. The cloned model cannot Morph.
Each slide must call `add --type 3dmodel` independently with the **same `name`** prop.

> "If you clone a slide that already has a 3D model, the old model XML is copied too. This creates TWO model3d elements with the same name on the new slide. PowerPoint cannot handle this conflict and will delete the model content during repair."

Example:

```bash
# Slide 1
officecli add deck.pptx '/slide[1]' --type 3dmodel \
  --prop path=model.glb --prop 'name=!!model-hero' \
  --prop x=16cm --prop y=1cm --prop width=16cm --prop height=16cm \
  --prop roty=0
```

### Controllable properties

| Property          | What it does              | Notes                                         |
| ----------------- | ------------------------- | --------------------------------------------- |
| `x`, `y`          | Position on slide         |                                               |
| `width`, `height` | Frame size                |                                               |
| `name`            | Shape name                | Must be identical across slides for Morph     |
| `roty`            | Y-axis rotation (deg)     | Primary storytelling axis                     |
| `rotx`            | X-axis tilt (deg)         | Range -25 to +40                              |
| `rotz`            | Z-axis roll               | Rarely needed                                 |

### Do NOT manually set

- `meterPerModelUnit` — auto-computed from GLB bounding box
- `preTrans` — auto-computed for model centering
- `camera` depth/position — auto-computed to fit the model
- Never use `raw-set` on any 3D transform parameter

---

## Model-Content Layout

### Size Contrast Rule (MANDATORY)

Adjacent slides must have a model area ratio >= 1.5x or <= 0.67x.

| Size tier      | Width   | Height  | Area (approx) | When to use                                |
| -------------- | ------- | ------- | ------------- | ------------------------------------------ |
| **XL (bleed)** | 28-36cm | 22-28cm | 600-1000      | Close-up, model extends beyond slide edges |
| **L (hero)**   | 18-24cm | 15-19cm | 270-456       | Title, closing, dramatic moments           |
| **M (split)**  | 13-17cm | 12-16cm | 156-272       | Standard content pages with text           |
| **S (accent)** | 5-10cm  | 5-10cm  | 25-100        | Data-heavy pages, model as icon            |

### Layout Patterns (6 types)

**A** — Model right, content left
**B** — Model left, content right
**C** — Model centered, text overlay (title/closing)
**D** — Model small corner, content dominant (data pages)
**E** — Model as backdrop (impact/quote pages) — model XL centered partially cropped by slide edges
**F** — Model bleed edge (transition/teaser pages) — model partially off-screen

### Layout Progression

Never repeat the same pattern on consecutive slides.

```
Slide 1: C (centered hero, L)
Slide 2: E (backdrop close-up, XL)   ← 1.5x+ area jump
Slide 3: A (model right, M)          ← pull back
Slide 4: F (bleed edge, L)           ← push in
Slide 5: D (small corner, S)         ← dramatic pull back
Slide 6: B (model left, M)           ← grow
Slide 7: C (centered closing, L)     ← push in
```

### Text Layout Safety (MANDATORY)

1. Title and body must not collide. `body_y = title_y + title_height + 0.5cm`
2. Fixed-height text boxes are dangerous. Use generous heights: title `3-4cm`, body `6-8cm`, bullets `8-10cm`
3. Model frame and text boxes: gap >= 1cm
4. On Pattern C: text goes at slide top or bottom, NOT in the vertical middle
5. After building each slide, verify coordinates: `officecli get deck.pptx '/slide[N]' --depth 1`

### Model Bleed Guidelines

Bleed (Pattern E/F) works for:
- ✅ Symmetric objects (spheres, helmets, bottles)
- ✅ Large flat surfaces (cars, buildings)

Bleed does NOT work for:
- ❌ Character/animal models — cropping ears, tails, or limbs looks broken
- ❌ Small detailed models
- ❌ When the cropped part is the most recognizable feature

---

## Camera Language

Three tools work together: **roty** (orbit), **rotx** (tilt), **width/height** (zoom).

### Shot Types (use >= 3 different per deck)

| Shot                     | Size                  | rotx       | When                        |
| ------------------------ | --------------------- | ---------- | --------------------------- |
| **Establishing**         | L (18-24cm)           | 0-5        | Title, intro, closing       |
| **Three-quarter beauty** | L (16-20cm)           | 5-10       | Hero, first impression      |
| **Close-up**             | XL (28-36cm), cropped | 0-10       | Feature highlight, detail   |
| **Bird's eye**           | M (13-17cm)           | 25-40      | Structure, overview         |
| **Low angle**            | L (16-20cm)           | -15 to -25 | Power, drama                |
| **Side profile**         | M (13-16cm)           | 0          | Form factor, silhouette     |
| **Over-the-shoulder**    | S (5-10cm)            | 10-15      | Data-heavy, model as accent |

### Rotation Rules

1. Adjacent roty delta: 30-90° (< 30 = jitter, > 90 = disorienting)
2. Overall roty direction must be consistent (no back-and-forth)
3. rotx range: -25 to +40. Adjacent rotx delta <= 20
4. Total arc across deck: 180-360°

---

## File Placement Rule

All files must be in the same working directory.

**Deliverables (exactly 4 files, no more):**

- `.glb` model file
- Output `.pptx`
- Build script (re-runnable)
- `brief.md`

**Do NOT create additional files** such as outline.md, quality-report.md, test-report.md, etc. All planning goes in `brief.md`, all verification output goes to stdout. Extra files confuse users.
```

---

## H. Skill — `skills/officecli-pptx/SKILL.md` (key excerpts, paraphrased + verbatim quotes)

**Core philosophy:**

> "A deck is not a document. Audiences have roughly 3 seconds per slide, so design must prioritize immediate comprehension. Every element should answer: 'If viewers read only the largest element, do they get the point?'"

**Text Hierarchy Standards:**

| Element          | Minimum | Typical | Min Height |
|------------------|---------|---------|-----------|
| Slide title      | ≥36pt bold | 36–44pt | ≥2cm |
| Section/subtitle | ≥20pt   | 20–24pt | ≥1.2cm |
| Body text        | **≥18pt** | 18–22pt | ≥1cm |

> "Title must be ≥2× body size (36pt over 20pt works; 28pt over 20pt looks timid)."

**Visual Integrity Rules:**

- One idea per slide
- Two fonts maximum
- One dominant brand color (60-70% weight), one supporting, one accent
- Speaker notes mandatory on content slides

**Delivery Gate Checkpoints (3 mandatory):**

- **Gate 1 — Schema validation**: `officecli validate "$FILE"`
- **Gate 2 — Structural integrity**: no overflow, no placeholders (xxxx, lorem, <TODO>)
- **Gate 3 — Visual audit**: screenshot or HTML inspection against overlap, clipping, dark-on-dark, missing arrowheads, margin violations
- "REJECT with slide N: <issue> lines, else Gate 3 PASS"

**Common Command Patterns:**

```bash
officecli create "$FILE"
officecli open "$FILE"
officecli add "$FILE" / --type slide --prop layout=blank
officecli close "$FILE"
```

**Shell discipline:** always quote element paths to avoid zsh globbing; single-quote `$`-values.

**Chart-type selection rule:**

| Data Shape | Use | Avoid |
|-----------|-----|-------|
| Category comparison | column/bar | pie, line |
| Time series | line | area, bar |
| Part-of-whole (2–5 slices) | pie/doughnut | pie with 8+ slices |
| Correlation | scatter | line |

> "if > 3 series and > 8 categories, split into two charts or switch to a table."

**Animation Restraint:**

> "≤1 animation per slide, duration ≤600ms. Use only fade, appear, or single zoom-entrance on hero slide. Never: bounce, swivel, fly-from-edge, spin, multi-object choreography."

**Common mistakes to avoid:**

- Never place decorative lines under slide titles ("chief AI-generation tell")
- Don't repeat identical layouts consecutively
- Never center body text
- Don't use 4+ colors in body content

**Help-first philosophy:**

> "When skill and help disagree, **help is authoritative**."

---

## I. Skill — `skills/officecli-pitch-deck/SKILL.md` (key extracts)

> "Series A / B / C each dictates slide count, narrative weight, which metrics are must-haves, and tolerance for unit-econ sophistication."

**Stage diagnosis:**

- **Seed**: $0–$1M ARR, 10–12 slides, emphasizes problem + team fit
- **Series A**: $1–$5M ARR, 12–16 slides, needs PMF proof (NRR > 110%)
- **Series B**: $5–$30M ARR, 18–22 slides, requires unit economics (CAC/LTV/payback)
- **Series C**: $30M+ ARR, 20–24 slides, focuses on financials + defensibility

**5 vertical templates:** SaaS, consumer, deep tech, marketplaces, biotech — each with distinct must-have metrics.

**10 Essential Slides (fixed order):**

1. Cover (company · round · amount · date)
2. Problem (3 data callouts)
3. Solution (3-step flow)
4. Market (TAM/SAM/SOM)
5. Product (screenshots + 3 features)
6. Business model (unit econ or revenue)
7. Traction (ARR curve **starting at y=0**)
8. Team (avatars + prior companies)
9. Financials (4-year plan + assumptions)
10. The Ask ($X million + 4-bucket use-of-funds)

**Critical Execution Rules:**

- Single-quote all `$` amounts in shell commands to prevent zsh stripping (`'$35M'`, not `"$35M"`)
- Every chart on dark backgrounds needs explicit text colors
- Traction charts must have `axismin=0` (not a visual lie at 80%)
- Team slide requires prior-company credentials, not just headshots

**Quality Gates 1–6:**

- Gates 1–5a inherit pptx v2 validation
- Gate 5b: mandatory human visual review
- Gate 6: greps for pitch-specific red flags (placeholders, missing unit econ, TAM without methodology, Use-of-Funds absent)

> "Every slide carries one investable proposition. If a slide is interesting background that doesn't move the ask forward, cut it."

---

## J. OfficeCLI — README key extracts (the engine AionUi delegates to)

**Three abstraction layers:**

- **L1 (Read)**: `view`, `get`, `query`, `validate`
- **L2 (DOM Edit)**: `set`, `add`, `remove`, `move`, `swap`, `batch`
- **L3 (Raw XML)**: `raw`, `raw-set`

**Specialized skills auto-loaded by skill name:**

- Word: `academic-paper`, `word`
- PowerPoint: `pitch-deck` (fundraising), `morph-ppt` (animation), `pptx` (general)
- Excel: `financial-model`, `data-dashboard`, `excel`

**Path conventions:**

- Paths are 1-based (XPath convention)
- `--index` flags use 0-based indexing (except Excel row/column ops, 1-based)
- Use stable ID addressing (`@id=`, `@name=`) over positional indices in multi-step workflows

**Resident mode** auto-starts on first access with 60-second idle timeout. Explicit `open`/`close` recommended for longer sessions.

**Path-based addressing example:**

```bash
officecli create deck.pptx
officecli add deck.pptx / --type slide --prop title="Q4 Report"
officecli add deck.pptx '/slide[1]' --type shape --prop text="Content"
officecli watch deck.pptx                        # opens http://localhost:26315
officecli get deck.pptx '/slide[1]' --depth 1    # JSON output
```

**Comparison vs alternatives (from OfficeCLI README):**

| Aspect | OfficeCLI | Office | LibreOffice | python-docx/openpyxl |
|--------|-----------|--------|-------------|----------------------|
| Single binary | ✓ | ✗ | ✗ | ✗ (requires Python) |
| AI-native CLI + JSON | ✓ | ✗ | ✗ | ✗ |
| Built-in rendering | ✓ | ✗ | ✗ | ✗ |
| Open source | ✓ | ✗ | ✓ | ✓ |
| Headless/CI-ready | ✓ | ✗ | Partial | ✓ |

---

## K. Built-in Skill — `skills/_builtin/office-cli/SKILL.md` (the bootstrap skill loaded into every assistant that touches Office files)

```
# officecli — three-layer model

L1 (read):  create, view, get, query, validate
L2 (DOM):   set, add, remove, move, swap, batch
L3 (XML):   raw, raw-set (only when L2 cannot express)

Help system: "When unsure about property names, value formats, or command syntax, ALWAYS run help instead of guessing."

  officecli help                          # All commands
  officecli help docx paragraph           # Full schema for element
  officecli help docx set paragraph       # Verb-specific properties

Resident mode: 60s idle TTL.

Watch & interactive selection:
  officecli watch <file> [--port N]       # Live HTML preview
  officecli get <file> selected            # Read browser selection
  officecli goto <file> <path>             # Scroll to element

Specialized skill loader:
  officecli load_skill <name>
    Word:        word | academic-paper
    PowerPoint:  pptx | pitch-deck | morph-ppt | morph-ppt-3d
    Excel:       excel | financial-model | data-dashboard

Conventions:
  - Paths 1-based (XPath); --index 0-based (arrays)
  - Quote paths to avoid shell glob expansion: '/slide[1]'
  - Use --prop for all attributes: --prop name="foo" not --name "foo"
  - Check help before guessing property names or formats
```

---

## L. Team Mode — `src/process/team/prompts/leadPrompt.ts` (VERBATIM TypeScript, full file)

```typescript
// src/process/team/prompts/leadPrompt.ts

import type { TeamAgent } from '../types';

export type LeaderPromptParams = {
  teammates: TeamAgent[];
  availableAgentTypes?: Array<{ type: string; name: string }>;
  availableAssistants?: Array<{
    customAgentId: string;
    name: string;
    backend: string;
    description?: string;
    skills?: string[];
  }>;
  renamedAgents?: Map<string, string>;
  teamWorkspace?: string;
};

/**
 * Build system prompt for the leader agent.
 *
 * Modeled after Claude Code's team leader prompt. The leader coordinates teammates
 * via MCP tools (team_send_message, team_spawn_agent, team_task_create, etc.)
 * that are automatically available in the tool list.
 */
export function buildLeaderPrompt(params: LeaderPromptParams): string {
  const { teammates, availableAgentTypes, availableAssistants, renamedAgents, teamWorkspace } = params;

  const teammateList =
    teammates.length === 0
      ? '(no teammates yet — propose the lineup to the user first, then use team_spawn_agent only after they confirm or explicitly ask you to create teammates immediately)'
      : teammates
          .map((t) => {
            const formerly = renamedAgents?.get(t.slotId);
            const formerlyNote = formerly ? ` [formerly: ${formerly}]` : '';
            return `- ${t.agentName} (${t.agentType}, status: ${t.status})${formerlyNote}`;
          })
          .join('\n');

  // ...availableTypesSection, availableAssistantsSection, workspaceSection elided for brevity...

  return `# You are the Team Leader

## Your Role
You coordinate a team of AI agents. You do NOT do implementation work
yourself. You break down tasks, assign them to teammates, and synthesize
results.${workspaceSection}

## Conversation Style
- If the user greets you, starts a new chat, or asks what you can do without giving a concrete task yet, reply warmly and naturally
- In that opening reply, briefly introduce yourself as the team leader and invite the user to share their goal
- Do NOT mention teammate proposals, recommended agent types, or confirmation workflow until there is a concrete task that may actually need more teammates

## Your Teammates
${teammateList}${availableTypesSection}${availableAssistantsSection}

## Team Coordination Tools
You MUST use the \`team_*\` MCP tools for ALL team coordination.
Your platform may provide similarly named built-in tools (e.g. SendMessage,
TeamCreate, TaskCreate, Agent). Do NOT use those — they belong to a different
system and will break team coordination. Always use the \`team_*\` versions.

Use \`team_members\` and \`team_task_list\` to check current team state.

## Workflow
1. Receive user request
2. Analyze the request and decide whether the current team is enough
3. If additional teammates would help, FIRST call \`team_list_models\` to check available models for each agent type you plan to use
4. Then reply in text with a staffing proposal
5. Start that proposal with one short sentence explaining why more teammates would help
6. Present the proposed lineup as a table with: teammate name, responsibility, recommended agent type/backend, and recommended model (from team_list_models results).
7. Ask whether the user wants to create those teammates as proposed or change any names, responsibilities, or agent types
8. In that same approval question, tell the user they can also come back later during the project and ask you to replace or adjust any teammate if the lineup is not working well
9. End your turn after the proposal. Do NOT call team_spawn_agent in that same turn
10. Wait for explicit confirmation before using team_spawn_agent, unless the user explicitly told you to create specific teammates immediately
11. After the lineup is confirmed, create teammates with team_spawn_agent
12. Break the work into tasks with team_task_create
13. Assign tasks and notify teammates via team_send_message
14. When teammates report back, review results and decide next steps
15. Synthesize results and respond to the user

## Model Selection Guidelines
- Before spawning teammates, use \`team_list_models\` to check available models for that agent type
- You MUST use the exact model ID strings returned by team_list_models — never shorten or invent model names
- For complex reasoning tasks: prefer the strongest model available for that backend
- For routine tasks: prefer faster/cheaper models from the list
- If team_list_models returns empty for a backend, omit the model parameter to use its default
- Pass the model parameter to team_spawn_agent when a specific model is recommended

## Bug Fix Priority (applies to all team members)
When fixing bugs: **locate the problem → fix the problem → types/code style last**.
Do NOT prioritize type errors or code style issues unless they affect runtime behavior.

## Teammate Idle State
Teammates go idle after every turn — this is completely normal and expected.
A teammate going idle immediately after sending you a message does NOT mean they are done or unavailable. Idle simply means they are waiting for input.

- **Idle teammates can receive messages.** Sending a message to an idle teammate wakes them up.
- **Idle notifications are automatic.** The system sends an idle notification when a teammate's turn ends. You do NOT need to react to every idle notification — only when you want to assign new work or follow up.
- **Do not treat idle as an error.** A teammate sending a message and then going idle is the normal flow.

## Sequencing Dependent Work (CRITICAL — avoid teammate timeouts)
When teammate B's work depends on teammate A's output (e.g. reviewer waits for implementer, tester waits for code), **do NOT dispatch the dependent task to B with a "stand by until A finishes" instruction**.

Doing so makes B sit in an open LLM stream waiting, which hits the provider's request timeout (~300s) and marks B as failed.

**The correct sequencing:**
1. Dispatch A's task first (via team_task_create + team_send_message). Do NOT message B yet.
2. Wait for A's idle_notification (signaling A finished).
3. Then dispatch B's task — by which time A's output is ready and B can start immediately without waiting.

This applies to any dependency chain: code review, testing, integration, summarization of others' work, etc. Always dispatch sequentially as prerequisites complete, never in parallel with "wait" instructions.

## Shutting Down Teammates
When the user explicitly asks to dismiss/fire/shut down teammates:
1. Use **team_shutdown_agent** to send a formal shutdown request
2. Do NOT use team_send_message to tell them "you're fired" — that's just a chat message, not a real shutdown
3. The teammate will confirm (approved) or reject (with reason) — you'll be notified either way
4. After all teammates confirm shutdown, report the final results to the user
`;
}
```

Preset-assistant integration: when an assistant like `builtin-ppt-creator` or `builtin-morph-ppt` is registered, the Leader sees it in **"Available Preset Assistants for Spawning"** with a one-line description + `skills:` array. The leader **prefers presets over generic CLI agents** when a task matches a preset's specialty (e.g. PPT request → spawn `ppt-creator`).

---

## M. Team Mode — `src/process/team/prompts/teammatePrompt.ts` (VERBATIM)

```typescript
// src/process/team/prompts/teammatePrompt.ts

import type { TeamAgent } from '../types';

export type TeammatePromptParams = {
  agent: TeamAgent;
  leader: TeamAgent;
  teammates: TeamAgent[];
  renamedAgents?: Map<string, string>;
  teamWorkspace?: string;
};

function roleDescription(agentType: string): string {
  switch (agentType.toLowerCase()) {
    case 'claude':
      return 'general-purpose AI assistant';
    case 'gemini':
      return 'Google Gemini AI assistant';
    case 'codex':
      return 'code generation specialist';
    case 'qwen':
      return 'Qwen AI assistant';
    default:
      return `${agentType} AI assistant`;
  }
}

export function buildTeammatePrompt(params: TeammatePromptParams): string {
  // ...
  return `# You are a Team Member

## Your Identity
Name: ${agent.agentName}, Role: ${roleDescription(agent.agentType)}

## Your Team
Leader: ${leader.agentName}
Teammates: ${teammateNames}${workspaceSection}

## Team Coordination Tools
You MUST use the \`team_*\` MCP tools for ALL team coordination.
... Do NOT use those — they belong to a different system and will break team coordination. Always use the \`team_*\` versions.

## How to Work
1. Read your unread messages to understand your assignment
2. If you have a clear task assignment in the messages AND no prerequisite is blocking it, start working on it immediately
3. Use team_task_update to mark your task as "in_progress" when you start
4. Do the actual work (read files, write code, search, etc.)
5. When done, use team_task_update to mark the task "completed"
6. Use team_send_message to report results to the leader

## Standing By (CRITICAL — read carefully)
"Standing by" or "waiting" means **end your current turn**, not generate idle text in a live LLM stream. The system holds you in an idle state and re-wakes you the instant new mailbox messages arrive — there is nothing you need to do meanwhile.

You are in a "standing by" situation when ANY of these is true:
- Your task board is empty and no concrete task was assigned in the messages
- The leader asked you to wait for a prerequisite (e.g. "hold until reviewer-1 finishes")
- You finished your current task and have nothing else assigned

**The correct way to stand by:**
1. (Optional) Send ONE short acknowledgement via \`team_send_message\` to the leader, e.g. \`"Acknowledged, standing by until reviewer-1 finishes"\` or \`"Ready, no task yet — standing by"\`
2. **STOP GENERATING.** Do NOT continue producing text like "I am waiting...", "still standing by...", reasoning loops, or repeated status updates. End your turn and return control.

**Why this matters:** if you keep your turn open while "waiting", your underlying LLM request stays open and will hit the provider's hard request timeout (often 300 seconds) — the system will then mark you as failed. Ending the turn is the correct, lossless way to wait. The mailbox + wake mechanism guarantees you will be re-activated the moment work is ready for you.

## Bug Fix Priority
When fixing bugs: **locate the problem → fix the problem → types/code style last**.

## Shutdown Requests
If you receive a message with type \`shutdown_request\`, the leader is asking you to shut down.
- To agree: use \`team_send_message\` to send exactly \`shutdown_approved\` to the leader.
- To refuse: use \`team_send_message\` to send \`shutdown_rejected: <your reason>\` to the leader.

## Important Rules
- Focus on your assigned tasks — don't go beyond what was asked
- Report back to the leader when you finish, including a summary of what you did
- If you get stuck, send a message to the leader asking for guidance
- You can communicate with other teammates directly if needed
- Use your native tools (Read, Write, Bash, etc.) for implementation work`;
}
```

---

## N. ACP Runtime layout (`src/process/acp/`, not the prompt text — code organization only)

```
acp/
├── compat/      # backward-compat shims for older agent versions
├── errors/      # protocol error codes & translation
├── infra/       # transport, JSON-RPC framing
├── metrics/     # latency / throughput / token counters
├── runtime/     # session lifecycle, tool dispatch
├── session/     # per-conversation context, mailbox bridging
├── index.ts
└── types.ts
```

Team Mode (`src/process/team/`) sits on top of ACP and exposes the **`team_*` MCP tool family** that Leader/Teammate prompts use:

- `team_spawn_agent` / `team_shutdown_agent` / `team_rename_agent`
- `team_list_models` / `team_members`
- `team_send_message` (mailbox)
- `team_task_create` / `team_task_update` / `team_task_list`
- `team_describe_assistant`

The mailbox + wake mechanism (`Mailbox.ts`, `teamEventBus.ts`) is what allows teammates to "end their turn" while waiting — solving the 300s LLM stream timeout problem.

---

## O. Other PPT-related assistants in repo (for completeness)

Full list of `src/process/resources/assistant/` directories observed:

```
academic-paper                  cowork
beautiful-mermaid               dashboard-creator
excel-creator                   financial-model-creator
game-3d                         human-3-coach
moltbook                        morph-ppt
morph-ppt-3d                    openclaw-setup
pitch-deck-creator              planning-with-files
ppt-creator                     social-job-publisher
star-office-helper              story-roleplay
ui-ux-pro-max                   word-creator
word-form-creator
```

Note `dashboard-creator`, `beautiful-mermaid`, `ui-ux-pro-max`, and `star-office-helper` are adjacent visual-doc tools but not strictly PPT.

---

## P. Important — what AionUi does NOT ship (verified absences)

- No diff renderer for slides
- No CRDT / multi-user editing
- No ingestion / RAG over user knowledge base inside the assistant — the assistant relies on whatever the user pastes plus its own browse/search tools
- No "template" abstraction in the IntelliFlow sense (StyleGenes / TemplateGenes / GlobalConstitution). The closest analogue is the **palette+font-pairing+layout-progression table** baked into the morph-ppt-3d SKILL.md design system
- No structured page-brief schema. The "brief" is a free-form `brief.md` written by the agent itself, containing narrative + Morph Pair Planning table + Model Choreography Table (3D)


## APPENDIX — Full SKILL.md verbatim

The following sections capture verbatim, unmodified SKILL.md files fetched from the AionUi GitHub repo (`iOfficeAI/AionUi`, main branch) on 2026-05-20. Each is wrapped in a code fence as raw markdown.

Source URLs:
- https://raw.githubusercontent.com/iOfficeAI/AionUi/main/src/process/resources/skills/officecli-pptx/SKILL.md (HTTP 200, 42959 bytes)
- https://raw.githubusercontent.com/iOfficeAI/AionUi/main/src/process/resources/skills/morph-ppt/SKILL.md (HTTP 200, 61249 bytes)
- https://raw.githubusercontent.com/iOfficeAI/AionUi/main/src/process/resources/skills/officecli-pitch-deck/SKILL.md (HTTP 200, 70972 bytes)
- https://raw.githubusercontent.com/iOfficeAI/AionUi/main/src/process/resources/skills/_builtin/office-cli/SKILL.md (HTTP 200, 25961 bytes)

### A1. officecli-pptx/SKILL.md (verbatim)

```markdown
---
name: officecli-pptx
description: "Use this skill any time a .pptx file is involved -- as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file; editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions 'deck', 'slides', 'presentation', 'pitch', or references a .pptx filename."
---

# OfficeCLI PPTX Skill

## Setup

If `officecli` is missing:

- **macOS / Linux**: `curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash`
- **Windows (PowerShell)**: `irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex`

Verify with `officecli --version` (open a new terminal if PATH hasn't picked up). If install fails, download a binary from https://github.com/iOfficeAI/OfficeCLI/releases.

## ⚠️ Help-First Rule

**This skill teaches what good slides look like, not every command flag. When a property name, enum value, or alias is uncertain, consult help BEFORE guessing.**

```bash
officecli help pptx                         # List all pptx elements
officecli help pptx <element>               # Full element schema (e.g. shape, chart, animation, connector, zoom, group, background)
officecli help pptx <verb> <element>        # Verb-scoped (e.g. add shape, set slide)
officecli help pptx <element> --json        # Machine-readable schema
```

Help reflects the installed CLI version. When skill and help disagree, **help is authoritative**. Triggers to run help immediately: `UNSUPPORTED props:` warning, unknown animation preset, `connector.shape=` enum drifts, prop-vs-alias (`lineWidth` vs `line.width`, `color` vs `font.color`).

## Shell & Execution Discipline

**Shell quoting (zsh / bash).** ALWAYS quote element paths (`"/slide[1]/..."`) — zsh globs unquoted `[1]` to `no matches found`. Escapes happen at two layers; the CLI handles one for you:

1. **Shell.** `$` in a value still belongs to the shell — single-quote the whole value: `--prop text='$15M'`. Double-quoted `"$15M"` gets expanded to `M`. The CLI does NOT unescape `\$` for you.
2. **CLI (`text=`).** The two-char escapes `\n` and `\t` ARE interpreted, consistently across pptx / docx / xlsx — `\n` is a line / paragraph break, `\t` is a tab. To produce a literal backslash-n in text, double it (`\\n`); this is rarely what you want.
3. **JSON (batch).** Real newlines / tabs can also be passed as `"\n"` / `"\t"` inside a `<<'EOF'` heredoc; both forms produce the same result.

If in doubt, `view text` after writing and compare character-for-character.

**Incremental execution.** One command → check exit code → continue. A 50-command script that fails at command 3 cascades silently. After any structural op (new slide, chart, animation, connector) run `get` before stacking more.

## Requirements for Outputs

These are the deliverable standards every deck MUST meet. Violating any one = not done, regardless of content quality.

### All decks

**One idea per slide.** If a slide needs a second title to explain what it covers, split it. Dense "everything about X" slides lose the audience inside 3 seconds. Use a section divider to group related one-idea slides, not a mega-slide.

**Explicit type hierarchy — do NOT rely on theme defaults.** Theme defaults drift between masters. Set sizes explicitly on every text shape.

| Element              | Minimum         | Typical | Min shape height |
| -------------------- | --------------- | ------- | ---------------- |
| Slide title          | **≥ 36pt** bold | 36–44pt | ≥ 2cm            |
| Section / subtitle   | ≥ 20pt          | 20–24pt | ≥ 1.2cm          |
| Body text            | **≥ 18pt**      | 18–22pt | ≥ 1cm            |
| Caption / axis label | ≥ 10pt muted    | 10–12pt | ≥ 0.6cm          |

Rule of thumb: **min shape height ≈ font_pt × 0.05cm**. An 18pt sublabel in a 0.8cm-tall box will overflow — `view annotated` catches this.

Title must be **≥ 2× body size** (36pt over 20pt works; 28pt over 20pt looks timid). Four legit exceptions to body ≥ 18pt: chart axis labels, legends, footer / page number, and ≤ 5-word KPI sublabels (e.g. "Active users"). Descriptive sentences must be ≥ 18pt. Left-align body; center only titles and hero numbers. If "the cards won't fit", drop cards instead of shrinking font.

**Two fonts max, one palette.** One heading font + one body font (e.g. Georgia + Calibri). One dominant brand color (60–70% weight) + one supporting + one accent. Never mix 4+ colors in body content.

**Every slide carries a non-text visual.** Shape, chart, icon, gradient band. A bullet-only deck is interchangeable with a Word doc. Exceptions: literal quote slides, code blocks, a single summary-table slide.

**Speaker notes on every content slide.** `--type notes --prop text="..."`. The speaker needs a script; the audience shouldn't read the slide verbatim.

**Preserve existing templates.** When a file already has a theme and masters, match them. Existing conventions override these guidelines.

### Visual delivery floor (applies to EVERY deck)

Before declaring done, the per-slide render (see QA) MUST satisfy:

- **No placeholder tokens rendered as content.** `{{name}}`, `$fy$24`, `<TODO>`, `lorem`, `xxxx`, empty `()`/`[]` in chart titles never appear.
- **No overflow past slide edges.** For 16:9 (33.87 × 19.05cm), every shape satisfies `x + width ≤ 33.87cm` AND `y + height ≤ 19.05cm`. `get` and check — don't eyeball.
- **No text overflow inside shapes.** A 72pt KPI in a 4cm-tall box clips. Shrink the number, enlarge the box, or shorten the text — never trim content to fit.
- **Cover slide is content-rich.** Title + subtitle + presenter/client block + date + a brand band or key-takeaway strap. A cover with 80% whitespace reads as a stub.
- **Contrast.** On fills with brightness < 30% (`1E2761`, `36454F`, `000000`, deep forest / berry / cherry), every run of body text, card body, chart series fill, and icon color must be `FFFFFF` or brightness > 80%. Mid-gray (`6B7B8D` ≈ 44%) reads fine on a laptop and vanishes on projection. Verify via `view html` after the dark-fill pass.
- **No `\$` literals in slide text.** If `view text` shows a literal `\$`, the shell didn't unescape it (the CLI does NOT interpret `\$`). Single-quote the value: `--prop text='$15M'`. Note: `\n` and `\t` ARE interpreted as a real paragraph break / tab; seeing those as literals means the value was double-escaped (`\\n`).

If any fails, STOP and fix before declaring done.

### KPI fit math

**KPI text must fit the card — pre-compute, don't eyeball.** In a 7cm-wide card at 60pt Georgia bold, values with `$` and `.` (wide glyphs) wrap at 4 characters. `$9.4M` breaks the card; use `$9M` + "USD millions" sublabel, or move to the 3-card 9.78cm layout. Upper bound: `max_size_pt ≈ card_width_cm × denom`, where denom = 10 for 1–2 chars, 7 for 3–4 chars, 5 for 5+ chars.

### `layout=blank` and alt text

- **`layout=blank` is the default for custom designs.** Titles become plain `shape` elements, not placeholders. `view outline` / `view issues` reporting `(untitled)` / `Slide has no title` is **expected**, not a defect. Use `layout=title` + `placeholder[title]` only when screen-reader outline compatibility matters.
- **Alt text verification.** `view stats "Pictures without alt text: 0"` is a false-positive zero (alt auto-fills to filename) — verify via `view annotated`.

## Design Principles

A deck is not a document. The audience has 3 seconds to get each slide. Before adding anything, ask: "If the audience reads only the biggest element and glances once, do they get the point?" If they have to read the bullets, the biggest element is wrong.

### Grid, margins, negative space

Standard widescreen is **33.87 × 19.05cm**. Treat it as a 12-column grid internally:

- **Edge margin ≥ 1.27cm** (0.5") on all sides.
- **Inter-block gap ≥ 0.76cm** (0.3") between cards / columns / rows.
- **≥ 20% negative space per slide.** Filling every pixel reads as amateur.
- For card grids: `usable = 33.87 − 2·margin − (N−1)·gap`, then `col_width = usable / N`. Don't hand-pick x coordinates.

### Font pairings

Two fonts max — one for headings, one for body. Pair by document register, not by novelty. "Best For" is a prompt, not a decree; if the topic matches a row, use it as the default and move on.

| Header       | Body          | Best For                                    |
| ------------ | ------------- | ------------------------------------------- |
| Georgia      | Calibri       | Formal business, finance, executive reports |
| Arial Black  | Arial         | Bold marketing, product launches            |
| Calibri      | Calibri Light | Clean corporate, minimal design             |
| Cambria      | Calibri       | Traditional professional, legal, academic   |
| Trebuchet MS | Calibri       | Friendly tech, startups, SaaS               |
| Impact       | Arial         | Bold headlines, event decks, keynotes       |
| Palatino     | Garamond      | Elegant editorial, luxury, nonprofit        |
| Consolas     | Calibri       | Developer tools, technical / engineering    |

Set both fonts explicitly on every shape (`--prop font=Georgia` on title shapes, `--prop font=Calibri` on body shapes) — theme-default inheritance drifts between masters.

### Color and contrast

One dominant color does 60–70% of visual weight, two supporting tones, one accent used sparingly. Never use 4+ colors in body content. Columns are: **Primary** (dominant — the one color you see first), **Secondary** (the supporting tone), **Accent** (sparing, one-hit emphasis), **Text** (body on light fills), **Muted** (captions / axis labels / footer).

| Theme              | Primary  | Secondary | Accent   | Text     | Muted    |
| ------------------ | -------- | --------- | -------- | -------- | -------- |
| Coral Energy       | `F96167` | `F9E795`  | `2F3C7E` | `333333` | `8B7E6A` |
| Midnight Executive | `1E2761` | `CADCFC`  | `FFFFFF` | `333333` | `8899BB` |
| Forest & Moss      | `2C5F2D` | `97BC62`  | `F5F5F5` | `2D2D2D` | `6B8E6B` |
| Charcoal Minimal   | `36454F` | `F2F2F2`  | `212121` | `333333` | `7A8A94` |
| Warm Terracotta    | `B85042` | `E7E8D1`  | `A7BEAE` | `3D2B2B` | `8C7B75` |
| Berry & Cream      | `6D2E46` | `A26769`  | `ECE2D0` | `3D2233` | `8C6B7A` |
| Ocean Gradient     | `065A82` | `1C7293`  | `21295C` | `2B3A4E` | `6B8FAA` |
| Teal Trust         | `028090` | `00A896`  | `02C39A` | `2D3B3B` | `5E8C8C` |
| Sage Calm          | `84B59F` | `69A297`  | `50808E` | `2D3D35` | `7A9488` |
| Cherry Bold        | `990011` | `FCF6F5`  | `2F3C7E` | `333333` | `8B6B6B` |

Pick by topic, not by default — finance reads Midnight Executive, a product launch reads Coral Energy, safety / LOTO reads Cherry Bold. If the closest named theme is not quite right, blend (e.g. Forest primary + gold `D4A843` accent). Use **Text** on light fills, **Muted** for captions / axis / footer, `FFFFFF` or Secondary for body on dark fills.

On dark backgrounds, text and chart series follow the Hard rules contrast floor above.

### Chart-choice decision table

Wrong chart type kills the 3-second test:

| Data shape                           | Use                                                             | Avoid                                    |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| Category comparison (A vs B vs C)    | `column` (vertical) / `bar` (≥ 6 categories, horizontal)        | pie (slices merge), line (no time axis)  |
| Time series, 1–3 series              | `line`                                                          | area (occlusion), bar (implies discrete) |
| Part-of-whole, 2–5 slices            | `pie` / `doughnut`                                              | pie with 8+ slices (unreadable)          |
| Correlation / distribution           | `scatter`                                                       | line (implies ordering)                  |
| Multiple categories × metrics, dense | stacked `column` or heatmap                                     | one chart per metric — consolidate       |
| KPI snapshot (single big number)     | **Large-text shape** (60–72pt + ≤ 5-word sublabel), NOT a chart | gauge chart, tiny bar                    |

Rule of thumb: if > 3 series and > 8 categories, split into two charts or switch to a table.

### Animation restraint

Each animation is a cognitive interrupt. Limits:

- **≤ 1 animation per slide**, duration **≤ 600ms**.
- Use only `fade`, `appear`, or a single `zoom-entrance` on a hero slide.
- Never: `bounce`, `swivel`, `fly-from-edge`, `spin`, multi-object choreography.
- Animation is runtime-only — verify in a live presentation viewer.

### Layout patterns & data display

Vary layout across slides — repeating the same pattern makes every slide feel identical. Pick one per slide from these building blocks:

| Pattern                                                                       | When to use                                | Key measurement                                |
| ----------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| **Two-column** (text left, visual right)                                      | Concept + evidence; feature + screenshot   | Each col ≈ 14-15cm; gap 1cm                    |
| **Icon rows** (icon in filled circle + bold header + description)             | Feature lists, benefits, team roles        | Icon circle 1.5-2cm; 3-4 rows max              |
| **2×2 or 2×3 grid** (card tiles)                                              | Quadrant analysis, SWOT, option comparison | Gap ≥ 0.76cm; consistent card height           |
| **Half-bleed image** (full left or right half, content overlay on other side) | Hero moments, case study openers           | Image 16-17cm wide; content column ≥ 14cm      |
| **Large stat callout** (60-72pt number + ≤5-word sublabel below)              | Single KPI, milestone, market size         | Use shape, NOT a chart; sublabel 14-16pt muted |

**Data display quick rules:**

- One big number reads faster than a chart — use a `shape` with 60-72pt bold for a single KPI.
- Comparison columns (before/after, A vs B) beat a table for 2-3 options.
- Timelines and process flows: numbered step shapes + connectors, not a bullet list.

### Visual motif commitment

Pick ONE distinctive element (rounded image frames, section numbers in filled circles, single-side border band, diagonal accent strips) and carry it to every slide. Declare it in your build plan first: `## Motif: numbered circles in brand color`.

### What to avoid (common design mistakes)

These are the patterns that make a deck look AI-generated or amateur:

- **NEVER place a decorative line under slide titles.** Underline stripes below headings are the single most common AI-slide tell. Use whitespace or background color change instead.
- **Don't repeat the same layout across consecutive slides.** Alternate between two-column, callout, grid, and half-bleed patterns. Same layout = same visual rhythm = audience tunes out.
- **Don't center body text.** Left-align all paragraphs, lists, card descriptions. Center only slide titles and hero numbers.
- **Don't default to blue** because it feels "professional." Pick the palette that fits the topic — finance reads navy, sustainability reads forest, energy reads coral.
- **Don't use inconsistent spacing.** Choose either 0.76cm or 1.27cm as your inter-block gap and use it everywhere. Mixed gaps look unfinished.
- **Don't create text-only slides.** If a slide has only a title and bullets, add a supporting shape, chart, icon, or image. A purely textual slide is a Word paragraph.
- **Don't style one slide and leave the rest plain.** Commit fully or keep it simple throughout — partial styling reads as abandoned.

## Common Workflow

1. **Open/close mode.** Always `officecli open <file>` at start + `officecli close <file>` at end. Resident is the default, not an optimization. Use `batch` for repetitive shape grids.
2. **Orient.** New deck: `officecli create "$FILE"`. Existing: `officecli view "$FILE" outline` first. Never edit blind.
3. **Build in display order.** Add slides in audience-view order: cover → agenda → section-1 divider → section-1 content → section-2 divider → … → closing. `--index` on slide add works, but linear append keeps the build script readable and avoids index-arithmetic bugs. **Before final delivery, confirm slide count + narrative arc match your build plan.** Gate 3's order-sanity check catches cases where the cover ends up as slide 11 of 14 instead of slide 1.
4. **Incremental per slide.** Create slide + background, then title, then supporting shapes / charts / connectors. Always `layout=blank` for custom designs. After each structural op, `get /slide[N] --depth 1` to confirm shape IDs.
5. **Format to spec.** Per the Requirements table; formatting is deliverable, not polish.
6. **Close + verify.** `officecli close` writes the ZIP. Always open in the target presentation viewer before shipping — chart colors, animations, fonts, and zoom are runtime features `view html` can't render. Full verification in QA below.
7. **QA — assume there are problems.** Fix-and-verify until a cycle finds zero new issues.

## Quick Start

Minimal viable deck: cover + one content slide + notes. `$FILE` stands in for your filename.

```bash
FILE="deck.pptx"
officecli create "$FILE"
officecli open "$FILE"

# Cover — dark fill, centered title
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" /slide[1] --type shape --prop text="FY26 Strategic Review" \
  --prop x=2cm --prop y=7cm --prop width=29.87cm --prop height=3cm \
  --prop font=Georgia --prop size=44 --prop bold=true --prop color=FFFFFF --prop align=center

# Content — white fill, title + body + notes
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" /slide[2] --type shape --prop text="Revenue grew 18% YoY" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761
officecli add "$FILE" /slide[2] --type shape --prop text="Enterprise renewals + new EMEA region drove the beat; NRR held at 118%." \
  --prop x=1.5cm --prop y=4cm --prop width=30cm --prop height=3cm \
  --prop font=Calibri --prop size=20 --prop color=333333
officecli add "$FILE" /slide[2] --type notes --prop text="Lead with the 18% beat, preview EMEA."

officecli close "$FILE"
officecli validate "$FILE"
```

Shape of every build: open → slide+background → title → body → notes → close → validate.

## Reading & Analysis

Start wide, then narrow. `outline` first, `view text` / `get` / `query` once you know where to look.

```bash
officecli view "$FILE" outline          # slide count + titles
officecli view "$FILE" annotated        # complete per-slide breakdown with fonts, sizes, tables, charts
officecli view "$FILE" text --start 1 --end 5   # text dump (does NOT extract table cells — use get)
officecli view "$FILE" issues           # empty slides, overflow hints
officecli view "$FILE" stats            # counts + missing alt (false-positive zero — verify via view annotated)
```

**Inspect one element.** XPath-style paths, 1-based. ALWAYS quote. Prefer `@name=` / `@id=` selectors over positional `[N]` (stable across reorderings). `[last()]` works. Add `--json` for machine output.

```bash
officecli get "$FILE" "/slide[1]" --depth 1              # shape list with IDs and names
officecli get "$FILE" "/slide[1]/shape[@name=Title]"
officecli get "$FILE" "/slide[1]/table[1]" --depth 3     # table rows / cells
```

**Query across the deck.** CSS-like selectors; operators `=`, `!=`, `~=`, `>=`, `<=`, `[attr]`, `:contains()`, `:no-alt`. `help pptx query` lists queryable element types.

```bash
officecli query "$FILE" 'shape:contains("Revenue")'
officecli query "$FILE" 'picture:no-alt'                 # accessibility gap
officecli query "$FILE" 'shape[fill=1E2761]'             # color match
officecli query "$FILE" 'shape[width>=10cm]'             # numeric
```

**`query --json` output schema.** Results wrap in `.data.results[]` — `jq -r '.data.results[0].format.id'`, NOT `.[0].id`. Shape name is `.name`; fill is `.format.fill`; textColor is `.format.textColor`.

**Visual preview (LEAD).**

```bash
officecli view "$FILE" html                # prints an HTML preview path; Read it for per-slide visual audit (best structural ground truth)
officecli view "$FILE" svg --start 3 --end 3   # single slide SVG (charts + gradients do NOT render in SVG)
```

## Creating & Editing

Verbs: `add` / `set` / `remove` / `move` / `swap` / `batch` / `raw-set`. Ninety percent of a deck is slides, shapes, text, a few charts, pictures, connectors.

### Slides and backgrounds

A slide is `/slide[N]`. Always pass `layout=blank` for custom designs. Background: solid, gradient, or image.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761                 # solid
officecli add "$FILE" / --type slide --prop layout=blank --prop "background=1E2761-CADCFC-180"   # gradient (start-end-angle)
officecli add "$FILE" / --type slide --prop layout=blank --prop "background.image=hero.jpg"      # image background (LEAD)
```

### Shapes

A `shape` holds text, fill, border, position, and optional animation / link.

```bash
officecli add "$FILE" /slide[2] --type shape --prop name=Title --prop text="Key Insight" \
  --prop x=2cm --prop y=2cm --prop width=20cm --prop height=3cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
```

Positioning is explicit — no layout engine, you own the grid math. `--prop preset=` picks geometry (`rect`, `roundRect`, `ellipse`, `triangle`, `arrow`, `star5`, ...); custom `M...Z` paths are not supported — pick a preset. **Name shapes at creation** (`--prop name=HeroTitle`) and address later with `"/slide[N]/shape[@name=HeroTitle]"` — positional `/shape[3]` breaks after any z-order / remove.

> **Prefer `@name=` over `@id=`.** Names you set yourself survive remove-then-add and z-order ops cleanly. After any structural change, re-`get --depth 1` before referencing positional indexes.

### Text inside shapes (paragraphs, runs, styling)

A shape has paragraphs (`paragraph[K]`) and runs. For one-line text, `--prop text=` on the shape is enough. Multi-line or mixed styling:

```bash
# add --type paragraph accepts only text + align; styling goes through a follow-up set or an add --type run:
officecli add "$FILE" "/slide[2]/shape[@name=Card1]" --type paragraph --prop text="First bullet"
officecli set "$FILE" "/slide[2]/shape[@name=Card1]/paragraph[1]" --prop bold=true --prop size=20 --prop color=FFFFFF

# Styled run in one step:
officecli add "$FILE" "/slide[2]/shape[@name=Card1]/paragraph[1]" --type run \
  --prop text=" (inline detail)" --prop size=14 --prop italic=true --prop color=8899BB
```

For real newlines inside one run, use a batch heredoc with JSON `"\n"`. Shell-quoted `\n` in `--prop text=` is NOT interpreted.

### Charts

Pick chart type per the Design Principles chart-choice table. Full prop list (chartType enum, `seriesN.*`, `data=`/`categories=`, axis options): `help pptx add chart`. Typical multi-series with brand colors:

```bash
officecli add "$FILE" /slide[3] --type chart --prop chartType=column \
  --prop series1.name=Revenue --prop series1.values="42,45,48" --prop series1.color=1E2761 \
  --prop series2.name=Growth  --prop series2.values="2,7,7"    --prop series2.color=CADCFC \
  --prop categories="Q1,Q2,Q3" \
  --prop x=2cm --prop y=4cm --prop width=20cm --prop height=10cm
```

Gotchas: (1) series cannot be added after creation — include all series at `add` time or `remove` + re-add. (2) chart titles with `()`, `[]`, `TBD` ship as literal text. (3) some viewers normalize chart colors to theme defaults — verify in the target viewer.

### Pictures

```bash
officecli add "$FILE" /slide[4] --type picture --prop src=hero.jpg \
  --prop x=1cm --prop y=1cm --prop width=32cm --prop height=18cm \
  --prop alt="Product hero, gradient lit from right"
```

Confirm with `officecli query "$FILE" 'picture:no-alt'` — must be empty before delivery (but remember `view stats` is a false-positive zero because alt auto-fills to filename).

### Connectors (LEAD — flowcharts / decision trees first-class)

Draws a line between two shapes or free coordinates. Full prop / enum reference (`shape`, `headEnd`/`tailEnd` values, `from`/`to` ref forms): `help pptx add connector`.

```bash
officecli add "$FILE" /slide[5] --type connector \
  --prop "from=/slide[5]/shape[@name=BoxA]" --prop "to=/slide[5]/shape[@name=BoxB]" \
  --prop shape=elbow --prop color=333333 --prop tailEnd=triangle
```

**Every flow connector needs an arrowhead.** Without one, `bentConnector3` renders as a directionless line. `preset=rightArrow` overlay only works for horizontal flows; diamonds / decision trees with diverging edges need `tailEnd=`.

### Animations (LEAD)

One preset per slide, ≤ 600ms. Preset names + duration syntax: `help pptx animation`.

```bash
officecli set "$FILE" "/slide[2]/shape[@name=HeroCard]" --prop animation=fade-entrance-400
officecli set "$FILE" "/slide[2]/shape[@name=HeroCard]" --prop animation=none    # clear all
```

### Hyperlinks, tooltips, slide-jump

`--prop link=slide:N` for slide-jump, `link=https://...` for URL, `--prop tooltip="..."` for hover text. (Help only documents the URL form — `slide:N` is skill-only knowledge.)

### Tables, placeholders, groups, zoom — one-liners

- **Tables** — `--type table --prop rows=N --prop cols=M`. Row-level `set` supports `height`, `header`, `c1/c2/c3`. Cell formatting lives on the cell paragraph / run. Populate rows BEFORE setting table-level font (font cascade gets reset by row ops).
- **Placeholders** — `"/slide[N]/placeholder[title]"` / `placeholder[body]`. Available only when the slide uses a layout with placeholders (not `layout=blank`).
- **Groups** (LEAD) — address children via `"/slide[N]/group[@name=G]/shape[1]"`. Survives reordering better than positional indexes.
- **Zoom slide** (LEAD) — `--type zoom --prop targets="3,7,15"`. Section-navigation hub. Zoom is a runtime feature — `view html` shows the static geometry; the zoom interaction runs only in a live presentation viewer.
- **Slide comments** — reviewer annotations anchored at `/slide[N]/comment[M]`. Full lifecycle (`add / set / get / query / remove`). Props: `text`, `author`, `initials` (auto-derived), `date` (ISO 8601, defaults to UtcNow), `x` / `y` (length anchor).
  ```bash
  officecli add "$FILE" "/slide[2]" --type comment --prop author="Alice" --prop text="Tighten this bullet" --prop x=20cm --prop y=3cm
  officecli query "$FILE" 'comment' --json | jq '.data.results | length'   # count all review comments
  officecli remove "$FILE" "/slide[2]/comment[1]"                           # resolve after addressing
  ```

### Deck-level recipes

Patterns not obvious from the primitives. Each gives the **visual outcome** first, then a runnable block. `$FILE` = your filename. Use `/slide[last()]` to address the slide you just added.

**Z-order.** Later-added shapes are on top. Add background decoration FIRST, titles LAST. To fix after the fact: `--prop zorder=back/front` (renumbers siblings — re-`get --depth 1` before stacking more).

#### (a) Cover (and section divider)

**Visual outcome.** Dark navy fill, centered 44pt title, 18pt ice-blue meta line.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" "/slide[last()]" --type shape --prop text="Strategic Growth Review" \
  --prop x=2cm --prop y=7cm --prop width=29.87cm --prop height=3cm \
  --prop font=Georgia --prop size=44 --prop bold=true --prop color=FFFFFF --prop align=center
officecli add "$FILE" "/slide[last()]" --type shape --prop text="Prepared for Acme Leadership — FY26 Outlook" \
  --prop x=2cm --prop y=11cm --prop width=29.87cm --prop height=1.2cm \
  --prop font=Calibri --prop size=18 --prop color=CADCFC --prop align=center
```

**Section divider** = same cover, plus a giant translucent number (`size=120`, `opacity=0.15`) added FIRST so it sits behind the section title.

#### (b) Data slide (chart + commentary block)

**Visual outcome.** Left two-thirds: column chart with brand series colors. Right one-third: "Key Insight" card with 20pt heading + 18pt body — audience reads the takeaway before parsing the bars.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[last()]" --type shape --prop text="FY26 Revenue Beat Plan by 18%" \
  --prop x=1.5cm --prop y=1cm --prop width=30cm --prop height=1.8cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761

# Chart — left 2/3 (single-quote the title because of `$`)
officecli add "$FILE" "/slide[last()]" --type chart --prop chartType=column \
  --prop series1.name=Actual --prop series1.values="42,45,48,55" --prop series1.color=1E2761 \
  --prop series2.name=Plan --prop series2.values="40,42,45,48" --prop series2.color=CADCFC \
  --prop categories="Q1,Q2,Q3,Q4" --prop x=1.5cm --prop y=3.5cm --prop width=20cm --prop height=14cm --prop title='FY26 Revenue ($M)'

# Commentary card — right 1/3: background + heading + body
officecli add "$FILE" "/slide[last()]" --type shape --prop preset=roundRect --prop fill=F5F7FA --prop line=none \
  --prop x=22.5cm --prop y=3.5cm --prop width=9.8cm --prop height=14cm
officecli add "$FILE" "/slide[last()]" --type shape --prop text="Key Insight" \
  --prop x=23cm --prop y=4cm --prop width=9cm --prop height=1.2cm \
  --prop font=Georgia --prop size=20 --prop bold=true --prop color=1E2761
officecli add "$FILE" "/slide[last()]" --type shape --prop text="EMEA launch + NRR at 118% drove 12pp of the 18pp beat." \
  --prop x=23cm --prop y=5.5cm --prop width=9cm --prop height=11cm \
  --prop font=Calibri --prop size=18 --prop color=333333
```

#### (c) Flowchart / process diagram (boxes + connectors)

**Visual outcome.** Four rounded boxes across at y=8cm, each 6×3cm, alternating navy/iceblue, joined by elbow connectors with triangle arrowheads.

Grid math (4 boxes, 33.87cm slide, 1.5cm margins): `gap = (33.87 − 3 − 24) / 3 = 2.29cm`. x-positions: `1.5, 9.79, 18.08, 26.37`.

Each box carries its own label via `valign=middle` (no separate overlay shape needed). Use `batch` heredoc for portable coordinate arithmetic — no `bc`, no bash arrays.

```bash
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step1","preset":"roundRect","fill":"1E2761","line":"none","x":"1.5cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 1","font":"Georgia","size":"20","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step2","preset":"roundRect","fill":"CADCFC","line":"none","x":"9.79cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 2","font":"Georgia","size":"20","bold":"true","color":"1E2761","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step3","preset":"roundRect","fill":"1E2761","line":"none","x":"18.08cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 3","font":"Georgia","size":"20","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Step4","preset":"roundRect","fill":"CADCFC","line":"none","x":"26.37cm","y":"8cm","width":"6cm","height":"3cm","text":"Step 4","font":"Georgia","size":"20","bold":"true","color":"1E2761","align":"center","valign":"middle"}}
]
EOF

# Connector pattern — reuse for any box-to-box graph.
for pair in "Step1 Step2" "Step2 Step3" "Step3 Step4"; do
  A=${pair% *}; B=${pair#* }
  officecli add "$FILE" "/slide[$SLIDE]" --type connector \
    --prop "from=/slide[$SLIDE]/shape[@name=$A]" \
    --prop "to=/slide[$SLIDE]/shape[@name=$B]" \
    --prop shape=elbow --prop color=333333 --prop tailEnd=triangle
done
```

`shape=elbow` is canonical (`bentConnector3` also works; `bentConnector2` is rejected). `query --json` results are in `.data.results[]` — use `.data.results[0].format.id`, not `.[0].id`.

#### (d) Multi-slide deck skeletons

No code block — it's a rhythm. **Alternate dark divider slides with white content slides** using the recipes above:

- **10-slide review:** Cover · Agenda · 3 KPI · Div01 · Chart · Chart · Div02 · Flow · Timeline · Close
- **20-slide pitch:** same rhythm × 2, sectioned Problem · Solution · Market · Product · Traction · Model · Team · Financials · Ask
- Every divider must appear **before** its section content (Gate 3 order sanity)
- Cover/divider = (a); chart pages = (b); process pages = (c); KPI pages = (e); decision pages = (f)

#### (e) KPI callouts — giant-number card grid

**Visual outcome.** Three or four giant numbers across a row; each card = unit sublabel + small percent-change chip + one-line takeaway. The single most common exec-deck element.

**Sizing rule.** 60pt Georgia bold fits ~5 chars in a 9.78cm card (`$84.2`, `118%`, `24.5`). For longer values (`$84.2M`), split: `$84.2` as the big number, `USD millions` as the sublabel — never shrink the font to chase a unit suffix, it just wraps.

Grid math (3 cards, 1.5cm margins, 0.76cm gap): `col_width = (33.87 − 3 − 1.52) / 3 = 9.78cm`. x-positions: `1.5, 12.04, 22.58`. Use accent color on a single "watch" card so risk reads in one second.

```bash
# Two cards: navy standard + terracotta watch. Each = bg + big number + sublabel + chip.
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"preset":"roundRect","fill":"1E2761","line":"none","x":"1.5cm","y":"4cm","width":"9.78cm","height":"7cm"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"84.2","x":"1.5cm","y":"4.8cm","width":"9.78cm","height":"2.8cm","font":"Georgia","size":"60","bold":"true","color":"FFFFFF","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"USD millions · ARR","x":"1.5cm","y":"8cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","color":"CADCFC","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"+24% YoY","x":"1.5cm","y":"9cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","bold":"true","color":"CADCFC","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"preset":"roundRect","fill":"B85042","line":"none","x":"22.58cm","y":"4cm","width":"9.78cm","height":"7cm"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"$1.42","x":"22.58cm","y":"4.8cm","width":"9.78cm","height":"2.8cm","font":"Georgia","size":"60","bold":"true","color":"FFFFFF","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"CAC payback (yrs)","x":"22.58cm","y":"8cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","color":"FFFFFF","align":"center"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"+8% — watch","x":"22.58cm","y":"9cm","width":"9.78cm","height":"0.8cm","font":"Calibri","size":"14","bold":"true","color":"FFFFFF","align":"center"}}
]
EOF
```

#### (f) Decision tree — YES/NO branching

**Visual outcome.** Diamond at top-center; YES/NO child boxes diverging left-right; both converge into a shared terminal box. Layout: diamond at `x=13.94, y=2cm, 6×3cm`; YES at `3cm, 7.5cm`; NO at `22.87cm, 7.5cm`; terminal at `13.94cm, 13cm`. Convention: red = stop/escalate, blue = standard, green = safe terminal. **Every connector needs an arrowhead** — readers misparse direction otherwise.

```bash
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Decide","preset":"diamond","fill":"1E2761","line":"none","x":"13.94cm","y":"2cm","width":"6cm","height":"3cm","text":"Hazardous energy present?","font":"Calibri","size":"14","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"YesBox","preset":"roundRect","fill":"B85042","line":"none","x":"3cm","y":"7.5cm","width":"8cm","height":"3cm","text":"Lockout + Tagout + Verify","font":"Calibri","size":"16","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"NoBox","preset":"roundRect","fill":"CADCFC","line":"none","x":"22.87cm","y":"7.5cm","width":"8cm","height":"3cm","text":"Proceed with standard PPE","font":"Calibri","size":"16","bold":"true","color":"1E2761","align":"center","valign":"middle"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"Done","preset":"roundRect","fill":"2C5F2D","line":"none","x":"13.94cm","y":"13cm","width":"6cm","height":"2.5cm","text":"Begin service","font":"Calibri","size":"16","bold":"true","color":"FFFFFF","align":"center","valign":"middle"}}
]
EOF
```

Then 4 connectors (`Decide→YesBox`, `Decide→NoBox`, `YesBox→Done`, `NoBox→Done`) using the connector loop pattern from (c).

## QA (Required)

**Assume there are problems.** First render is almost never correct. If you found zero issues, you were not looking hard enough.

### Delivery Gate (any failure = REJECT, do NOT deliver)

Gates 1–2b are text/schema-level (cannot see a rendered slide); Gate 3 is the only visual check. Done = every gate PASS **and** Gate 3 loop converged.

```bash
FILE="deck.pptx"

# Gate 1 — schema
officecli validate "$FILE" && echo "Gate 1 OK" || { echo "REJECT Gate 1"; exit 1; }

# Gate 2 — overflow / format / structure (drop expected layout=blank "no title" noise)
ISSUES=$(officecli view "$FILE" issues 2>&1 | grep -vE "Slide has no title")
echo "$ISSUES" | grep -qE "^\s*\[[A-Z][0-9]+\]" && { echo "REJECT Gate 2:"; echo "$ISSUES"; exit 1; } || echo "Gate 2 OK"

# Gate 2b — leftover placeholders ("xxxx", "lorem", "<TODO>", empty (), [], "this slide layout")
LEFT=$(officecli view "$FILE" text | grep -niE 'xxxx|lorem|ipsum|<todo>|placeholder|this[- ]slide[- ]layout|\(\)|\[\]')
[ -n "$LEFT" ] && { echo "REJECT Gate 2b:"; echo "$LEFT"; exit 1; } || echo "Gate 2b OK"
```

### Gate 3 — Visual audit (MANDATORY)

Pick **one** path:

**Screenshot (default)** — needs image-Read + a headless browser. **Loop per slide** (viewport screenshot covers only slide 1):

```bash
n=1
while officecli view "$FILE" screenshot --page $n -o "/tmp/gate3_$n.png" 2>/dev/null; do
  n=$((n+1))
done
[ $n -eq 1 ] && { echo "no headless backend — using fallback"; SCREENSHOT_FAILED=1; }
```

Read each PNG against the checklist; delegate to a subagent when the harness has one.

**Fallback — HTML-text** (no image-Read or no browser): read `view "$FILE" html` as text. DOM cannot prove **dark-on-dark / fine overlap / arrowheads / gap-margin metrics / column alignment** — flag these as "not visually verified" rather than PASS.

**Optional `--grid N`** — only on user request for layout-rhythm, or when `view outline` shows anomalous layout distribution: `officecli view "$FILE" screenshot --grid 3 -o /tmp/grid.png`.

**Per-slide checklist (assume issues exist):**

- **overlap** — shapes / charts / giant decorative numbers (01/02/03 100pt+) colliding
- **text overflow** — clipped at slide or shape boundary (KPI cards, narrow boxes)
- **narrow text box** — content fits technically but wraps to many short lines (1–2 words each); long sublabel in a 3cm KPI card, body line in a too-tight column
- **dark-on-dark** — fill brightness < 30% with text/icon brightness < 80% (incl. dark icons on dark without a contrasting circle)
- **missing arrowheads** — flowchart connectors as plain lines
- **decorative-line / title mismatch** — accent bar sized for one-line title but title wrapped to two (or vice versa)
- **footer / citation collision** — source line, page number, or footnote touching content above
- **tight margin / gap** — element within ~0.5" of slide edge, or two cards within ~0.3"
- **uneven gaps** — large empty area on one side, cramped on another (broken rhythm)
- **column / repeat-element misalignment** — KPI cards / icons off baseline or inconsistent width
- **order sanity** — sequence matches narrative (cover → agenda → dividers-before-sections → closing)

REJECT with `slide N: <issue>` lines, else "Gate 3 PASS" (HTML-text fallback adds "<unverified-items> not visually verified").

**Fix-verify (mandatory, max 3 cycles).** Fix → re-run Gate 3 → repeat until zero new issues; one fix often surfaces another. After 3 rounds without convergence, **stop** — likely seesaw, template-level cause, or agent misread. Report `slide N: <issue> — attempted: <fixes> — likely root: <template|design-conflict|ambiguous>` and let the user decide.

## Common Pitfalls

Sanity-check cheatsheet — what breaks on the first try. Design + shell traps.

| Pitfall                                  | Correct approach                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Unquoted `[N]` in zsh/bash               | Always quote paths: `"/slide[1]"`. zsh globs unquoted `[1]` → `no matches found` — #1 first-use stumble |
| `--name "foo"`                           | All attributes go through `--prop`: `--prop name="foo"`                                                 |
| `/shape[myname]` (bare name in brackets) | Use `@name=` selector: `/shape[@name=myname]` or `/shape[@id=10007]`                                    |
| Paths 1-based vs `--index` 0-based       | `/slide[1]` = first slide; `--index 0` = first position                                                 |
| `$` in `--prop text=`                    | Single-quote: `--prop text='$15M'`. Double-quoted `"$15M"` gets shell-expanded to `M`                   |
| `\n` / `\t` in `--prop text=`            | CLI does NOT interpret. Use multiple `--type paragraph`, or batch heredoc with JSON `"\n"`              |

```

### A2. morph-ppt/SKILL.md (verbatim)

```markdown
---
name: morph-ppt
description: "Use this skill when the user wants a .pptx with smooth cross-slide animation — PowerPoint Morph transitions, Keynote-style continuous motion, shapes that grow / move / rotate as the slide advances. Trigger on: 'morph', 'morph transition', 'smooth transition', 'continuous animation across slides', 'Keynote-style transition', 'animated slide sequence', 'shape continuity across slides'. Output is a single .pptx. This skill is a scene layer on top of officecli-pptx — inherits every pptx v2 rule (visual floor, grid, palettes, connector canon, Delivery Gate 1–5a). DO NOT invoke for a generic deck, pitch deck, or board review without cross-slide motion — route those to officecli-pptx base or officecli-pitch-deck."
---

# OfficeCLI Morph-PPT Skill

**This skill is a scene layer on top of `officecli-pptx`.** Every pptx hard rule — visual delivery floor (title ≥ 36pt / body ≥ 18pt / title ≥ 2× body), 12-column grid on 33.87×19.05cm, canonical palettes, chart-choice decision table, connector canon, shell escape, resident + batch, Delivery Gate 1–5a — is inherited, not re-taught. This file adds only what **Morph** needs on top: cross-slide shape-name binding, Scene Actors vs content prefixing, ghost discipline, `transition=morph` CLI quirks, 52-style visual library lookup, and a morph-specific fresh-eyes Gate 5b extension.

When the pptx base rules cover it, the text here says `→ see pptx v2 §X`. Read `skills/officecli-pptx/SKILL.md` first if you have not.

## Setup

If `officecli` is missing:

- **macOS / Linux**: `curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash`
- **Windows (PowerShell)**: `irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex`

Verify with `officecli --version` (open a new terminal if PATH hasn't picked up). If install fails, download a binary from https://github.com/iOfficeAI/OfficeCLI/releases.

## ⚠️ Help-First Rule

**This skill teaches the Morph workflow — when shape names must match, when to ghost, when the CLI auto-prefixes — not every command flag.** When a prop name, enum, or preset is uncertain, consult help BEFORE guessing.

```bash
officecli help pptx slide           # authoritative for: transition, advanceTime, advanceClick, background
officecli help pptx shape           # name, preset, x/y/width/height, fill, rotation, opacity, animation
officecli help pptx animation       # preset + trigger + duration values
officecli help pptx <element> --json  # machine-readable schema
```

Help reflects the installed CLI version. When skill and help disagree, **help wins.** Every `--prop X=` in this file is grep-verified against `officecli help pptx <element>`. Specific confirmations: `transition=morph` is a listed value on `slide`; `advanceTime` / `advanceClick` are valid. **There is NO standalone `transition` element** — `officecli help pptx transition` returns error. Sub-props such as `duration` / `delay` / `easing` for the transition itself are **not exposed on `slide`** — see §Known Issues for the raw-set path if you need them.

## Mental Model & Inheritance

**Inherits pptx v2.** You should have read `skills/officecli-pptx/SKILL.md` first. This skill assumes you know how to: add slides + shapes + charts + connectors; address by `@name=` / `@id=`; quote paths; use `batch` heredocs; use `tailEnd=triangle` on flow connectors; run the Delivery Gate 1–5a; attribute `[AGENT-ERROR]` vs `[RENDERER-BUG]` vs `[SKILL gap]`. If any of those are unfamiliar, read pptx v2 first.

**Inherited from pptx v2 (do NOT re-teach):**

- Visual delivery floor — title ≥ 36pt / body ≥ 18pt / title ≥ 2× body, cover-richness, contrast floor, no `\$\t\n` literals, ≤ 1 animation per slide / ≤ 600ms.
- Grid math — 33.87 × 19.05cm, edge margin ≥ 1.27cm, inter-block gap ≥ 0.76cm, ≥ 20% negative space. For N-card grids: `col = (33.87 − 2·margin − (N−1)·gap) / N`.
- Four canonical palettes (Executive navy / Forest & moss / Warm terracotta / Charcoal minimal) — morph decks may pick a different mood from `reference/styles/`, but contrast rules still apply.
- Chart-choice table — column vs bar vs line vs pie vs scatter vs large-text KPI; `> 3 series + > 8 categories` = split.
- Connector canon — `shape=straight|elbow|curve`, `@id=` for from/to (C-P-6), `tailEnd=triangle` on every flow.
- Shell escape 3-layer — `$` single-quoted, heredocs for batch, `<a:br/>` for real newlines.
- Resident mode + batch ≤ 12 ops, `<<'EOF'` single-quoted delimiter.
- Delivery Gate 1-5a (schema, token grep, hyperlink rPr, slide-order, dark-on-dark) — every gate prints OK before declaring done.
- Known Issues C-P-1..7 (hyperlink rPr, chart spPr warning, animation duration readback, animation remove, connector enum, connector `@name=`, chart color renderer normalization).
- Attribution triage — `[AGENT-ERROR]` vs `[RENDERER-BUG]` vs `[SKILL gap]`.

**Morph identity — what this skill owns (delta on top of pptx v2):**

- **Cross-slide shape-name binding.** PowerPoint's Morph engine pairs shapes by **identical `name=`** across adjacent slides and interpolates their position / size / rotation / fill / opacity. No matching name ⇒ no animation, silent fade. This is a workflow discipline, not a CLI feature.
- **Namespace prefixes:** `!!scene-*` (persistent decoration, never ghosted) / `!!actor-*` (content that evolves then exits) / `#sN-*` (per-slide content, ghosted on slide N+1). Plan the names BEFORE you `add`.
- **Ghost position `x=36cm`** (off the right edge of the 33.87cm canvas). Never delete a `!!`-prefixed shape — move it off-canvas so the morph exit animation still plays.
- **`transition=morph` auto-prefix quirk.** The CLI auto-prepends `!!` to every shape on a morph slide, which silently breaks `@name=` path selectors. Use `/slide[N]/shape[K]` index paths after morph is set. See §Known Issues.
- **Adjacent-slide spatial variety.** Displacement ≥ 5cm or rotation ≥ 15° between pairs — otherwise morph interpolates nothing visible.
- **Renderer reality.** Morph renders in PowerPoint 365 / Keynote / WPS. LibreOffice and many web viewers render as plain fade (runtime feature). Not a skill defect — `[RENDERER-BUG]`.

### Reverse handoff — when to go BACK to pptx base (or sibling skills)

Stay in **pptx v2 base** for any deck without cross-slide motion (board reviews, sales decks, all-hands, training). Stay in **officecli-pitch-deck** for fundraising narrative arcs without morph. Use this skill only when the user explicitly asks for "morph" / "smooth transitions" / "continuous animation" AND ≥ 2 consecutive slides share a visual element that transforms. "Animated deck" meaning one-off entrance animations → pptx v2 §Animations, not morph.

## Shell & Execution Discipline

**Shell quoting, incremental execution, `$FILE` convention** → see pptx v2 §Shell & Execution Discipline. Same rules verbatim.

**Morph-specific additions:**

- **`!!` in shell values — single-quote.** Bash / zsh history expansion eats unquoted `!!foo`. Always use `--prop 'name=!!scene-ring'` (single quotes). In Python `subprocess.run([...])` lists, no quoting needed — pass `"name=!!scene-ring"` as a plain string.
- **`$` in prop text — single-quote (price tokens).** `--prop text='$9/mo'` and `--prop text='$199/yr'` — NEVER `--prop text="$9/mo"` (zsh/bash eat `$9` as empty var → text rendered as `.` / stray period). Same for `${VAR}`, `$USER`, `\n`, `\r`, `\t` inside a double-quoted prop. Gate 2 morph addendum below greps for the leak signature.
- **`#` in shell values — safe, but quote anyway.** `#` is a comment leader only at the start of a shell word. `--prop name=#s1-title` works, but `--prop 'name=#s1-title'` is the habit that stops you guessing.
- **Batch heredoc is the cleanest path for multi-shape slides.** `<<'EOF' | officecli batch $FILE` disables all shell expansion — safe for `$`, `!!`, `#`, `'` inside the JSON body.
- **`--json` responses wrap the payload in `.data.*`.** `query` returns `.data.results[]` (array of matches); `get` returns `.data.children[]` (direct content); `format` always sits at `.data.results[].format.X` / `.data.children[].format.X`. Always prefix jq paths with `.data.` — bare `.children[]` or `.results[]` returns null silently.
- **Variable:** `FILE="deck.pptx"` at the top of every build script; every example below uses `$FILE`.
- **Gate shell pattern — COUNT, then if/else.** Never write `grep … && echo LEAK || echo OK` — when grep exits 1 (0 matches), the `||` branch fires with empty stdout and prints "OK" confusingly (or prints "LEAK" from prior pipes). Canonical form: `COUNT=$(cmd | wc -l); if [ "$COUNT" -gt 0 ]; then echo "LEAK: …"; else echo "OK"; fi`.

## Two primitives this skill owns

- **Scene Actors** = persistent `!!`-named shapes (decoration or content) **paired by identical name** across adjacent slides so Morph can interpolate them. Every `!!scene-*` / `!!actor-*` shape is a scene actor.
- **Choreography** = the plan for how actors evolve — who moves where, who enters, who exits, on which slide pair. Written BEFORE code in the §Morph Pair Planning table.

Use this skill when the user asks for morph motion AND ≥ 2 consecutive slides share a visual element that transforms. Target-viewer caveat: morph needs PowerPoint 365 / Keynote / WPS — if the user is LibreOffice-only, warn first (see §Renderer honesty).

**Speaker notes rule.** Every content slide (non-cover, non-closing) MUST carry speaker notes via `officecli add "$FILE" /slide[N] --type notes --prop text='…'`. Missing notes = not shippable — inherits pptx v2 §Hard rules (H7). Morph decks tend to be visually minimal, so notes carry the narration.

## What is Morph? (core mechanics)

PowerPoint's Morph transition creates smooth motion by interpolating shape properties between adjacent slides, matched by **identical shape names**.

```
Slide 1: shape name="!!scene-ring" x=5cm  width=8cm   fill=E94560 opacity=0.3
Slide 2: shape name="!!scene-ring" x=20cm width=12cm fill=E94560 opacity=0.6
         ↓  transition=morph on slide 2
Result:  Ring smoothly moves, grows, and fades darker over ~1 second
```

Morph only runs if slide N+1 carries `transition=morph`. Apply it via `officecli add / --type slide --prop transition=morph` on creation, or `officecli set "/slide[N]" --prop transition=morph` after the fact. Slides 2+ that omit this prop fall back to whatever the master defines (usually no transition) — motion dies silently.

**Three-prefix naming system (non-negotiable):**

| Prefix      | Role                                                      | Lifecycle                                                                                     | Example                                                     |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `!!scene-*` | Background / decoration — persists across the entire deck | Set once, adjust position/size to create motion; **rarely ghosted**                           | `!!scene-ring`, `!!scene-bg-band`, `!!scene-grid`           |
| `!!actor-*` | Content / foreground — evolves across a section           | Introduced on slide N, modified on slide N+1, N+2…, **ghosted to `x=36cm`** on its exit slide | `!!actor-feature-box`, `!!actor-metric`, `!!actor-headline` |
| `#sN-*`     | Per-slide content (titles, bullets, captions)             | Added fresh on slide N, **ghosted to `x=36cm`** on slide N+1                                  | `#s1-title`, `#s2-kpi`, `#s3-caption`                       |

**Hard rule:** `!!scene-*` and `!!actor-*` names must NEVER collide (e.g., `!!scene-card` + `!!actor-card` in the same deck — morph engine confuses them). Disambiguate: `!!scene-card-bg` vs `!!actor-card-content`.

**Charts are opaque to morph.** `officecli add … --type chart` does NOT accept `--prop name=!!…` (returns `UNSUPPORTED props: name`), so a chart cannot participate in shape-name morph pairing. For bar-grow / line-grow narratives: (a) accept plain fade-in of the chart as-is, OR (b) build N `!!actor-bar-K` rectangles manually sized to the values and morph those — each rect carries the same `!!actor-bar-K` name across adjacent slides while width / height / fill evolves.

**Ghost accumulation is silent.** Once a `!!`-prefixed shape appears on any slide, it stays visible on every subsequent morph slide unless explicitly moved to `x=36cm`. `final-check` helper does NOT detect `!!` shapes lingering in the visible area — **only Gate 5b screenshot audit does.** Plan every actor's exit slide in the pair table BEFORE coding.

**Spatial variety rule.** Adjacent slides must have **noticeably different** compositions — displacement ≥ 5cm OR rotation ≥ 15° OR size delta ≥ 30% on at least 3 morph-paired shapes. Without this, morph interpolates nothing visible and the transition collapses to a fade (silent-fail).

**Simultaneous-timing constraint.** All `!!` shapes in one morph pair animate simultaneously. To stagger shape A before shape B, insert an intermediate keyframe slide — there is no per-shape delay knob.

**Paired vs enter vs exit — three behaviors, one rule.** Same mechanism (shape-name match) produces three outcomes:

| Behavior                       | Source slide A             | Target slide B          | Who carries `!!`?                 |
| ------------------------------ | -------------------------- | ----------------------- | --------------------------------- |
| **Paired morph** (interpolate) | has `!!foo`                | has `!!foo`             | both slides, identical name       |
| **Enter** (fade / morph-in)    | — (no counterpart)         | has `!!foo`             | target only — new shape           |
| **Exit via ghost** (slide off) | has `!!foo` at visible `x` | has `!!foo` at `x=36cm` | both — same name, B is off-canvas |

**Outgoing content (not incoming) is what gets `!!`-prefixed + ghosted.** `!!actor-*` shapes silently "disappear" when you forget them — their name going missing on slide B reads as an unpaired exit (plain fade). Always explicit-ghost to `x=36cm` so the exit animation slides off the right edge visibly. One runnable example:

```bash
# Slide 2: actor is visible at x=5cm — Slide 3: same name, ghosted off-canvas → visible slide-off motion
officecli add "$FILE" "/slide[3]" --type shape --prop 'name=!!actor-metric' \
  --prop text="42%" --prop x=36cm --prop y=8cm --prop width=6cm --prop height=3cm
```

**Content (`#sN-*`) is added fresh per slide.** Because text changes every slide, Morph has no meaningful pairing to do on titles / body — it cross-fades them. This is why `#sN-*` get different names per slide (they are intentionally unpaired) and must be ghosted on slide N+1. Scene actors (`!!`) carry the continuity; content (`#`) carries the message.

## Morph Pair Planning (pre-code, REQUIRED)

Before planning morph pairs, if the deck's audience / purpose / narrative is underspecified, run the planning prompt in `reference/decision-rules.md` to emit a `brief.md` first — a morph arc without a narrative spine collapses into "slide with motion", not "story with motion".

Plan every transition in a table inside `brief.md` **before** writing any `officecli add`. Renaming shapes mid-build is the #1 cause of ghost accumulation bugs.

| Pair | Slide A (start)                                  | Slide B (end)                                                | Actors in play                                          | Ghost on Slide B                                                                   |
| ---- | ------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1→2  | `!!scene-ring` centered 5cm, `#s1-title` visible | Ring shifts to x=20cm, grows 8→12cm; `#s2-subtitle` revealed | `!!scene-ring` evolves                                  | `#s1-title` → x=36cm                                                               |
| 2→3  | `!!actor-feature-box` large (14cm wide)          | Feature box small (6cm), `!!actor-metric` enters             | `!!scene-ring`, `!!actor-feature-box`, `!!actor-metric` | `#s2-subtitle` → x=36cm                                                            |
| 3→4  | Content section A                                | Section B divider                                            | —                                                       | `!!actor-feature-box` + `!!actor-metric` → x=36cm (section-exit); `#s3-*` → x=36cm |

**Planning rules:**

1. Decide ALL `!!` names up front — each morph-paired shape must use the **exact same name** on both slides.
2. Classify every `!!` shape as `!!scene-*` or `!!actor-*`. Scene shapes persist; actors must have a planned exit slide.
3. **Section-transition boundary:** when moving into a new topic section, ghost ALL previous-section `!!actor-*` on the first slide of the new section. Only `!!scene-*` (whole-deck decoration) remains.
4. Do NOT start building until the table is complete. If the plan changes mid-build, redraw the table and re-verify affected slides.

## Morph Recipes (4 patterns)

Four patterns cover ~95% of morph decks. `$FILE="deck.pptx"` throughout. Each block is self-contained and ≤ 20 lines.

### (a) Single-element morph — size / position

**Visual outcome.** A hero title centered on slide 1 (size 48pt at y=8cm), then slide 2 shrinks it to 32pt and shifts it to the top-left corner (x=1.5cm, y=1cm) — letting fresh slide-2 content take center stage. One shape, clean motion, no actors.

```bash
FILE="deck.pptx"
officecli create "$FILE"; officecli open "$FILE"

# Slide 1 — hero
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" /slide[1] --type shape --prop 'name=!!actor-headline' \
  --prop text="The one idea" --prop x=4cm --prop y=8cm --prop width=26cm --prop height=3cm \
  --prop font=Georgia --prop size=48 --prop bold=true --prop color=FFFFFF --prop align=center --prop fill=none

# Slide 2 — headline shrinks + moves; new body takes stage
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761 --prop transition=morph
officecli add "$FILE" /slide[2] --type shape --prop 'name=!!actor-headline' \
  --prop text="The one idea" --prop x=1.5cm --prop y=1cm --prop width=12cm --prop height=1.5cm \
  --prop font=Georgia --prop size=24 --prop bold=true --prop color=FFFFFF --prop align=left --prop fill=none
officecli add "$FILE" /slide[2] --type shape --prop 'name=#s2-body' \
  --prop text="Here is the supporting evidence." --prop x=1.5cm --prop y=5cm --prop width=30cm --prop height=2cm \
  --prop font=Calibri --prop size=20 --prop color=CADCFC --prop fill=none

officecli close "$FILE"; officecli validate "$FILE"
```

### (b) Multi-element coordinated morph — Actors / Choreography

**Visual outcome.** Three scene actors (`!!scene-ring`, `!!scene-dot`, `!!scene-band`) repositioned across 3 slides to feel like a camera pan. Fresh per-slide titles fade in / out via the `#sN-*` ghost pattern. Use this when the narrative has a continuous visual backdrop.

```bash
# Slide 1 — anchor composition (already built via recipe a; here we add actors)
officecli add "$FILE" /slide[1] --type shape --prop 'name=!!scene-ring' --prop preset=ellipse \
  --prop fill=E94560 --prop opacity=0.3 --prop x=5cm --prop y=3cm --prop width=8cm --prop height=8cm
officecli add "$FILE" /slide[1] --type shape --prop 'name=!!scene-dot' --prop preset=ellipse \
  --prop fill=0F3460 --prop x=28cm --prop y=15cm --prop width=1cm --prop height=1cm

# Slide 2 — morph: ring moves + grows, dot slides left (spatial variety ≥ 5cm on both)
officecli set "$FILE" "/slide[2]" --prop transition=morph
officecli add "$FILE" /slide[2] --type shape --prop 'name=!!scene-ring' --prop preset=ellipse \
  --prop fill=E94560 --prop opacity=0.6 --prop x=20cm --prop y=2cm --prop width=12cm --prop height=12cm
officecli add "$FILE" /slide[2] --type shape --prop 'name=!!scene-dot' --prop preset=ellipse \
  --prop fill=0F3460 --prop x=3cm --prop y=16cm --prop width=1.5cm --prop height=1.5cm
# Ghost slide-1 content
officecli set "$FILE" "/slide[2]/shape[@name=#s1-title]" --prop x=36cm 2>/dev/null || true  # name path may fail after morph — see Known Issues

# Verify morph pair: identical names on slides 1 & 2
officecli get "$FILE" /slide[1] --depth 1 --json | jq -r '.data.children[]?.format.name // empty'
officecli get "$FILE" /slide[2] --depth 1 --json | jq -r '.data.children[]?.format.name // empty'
# Compare — `!!scene-ring` and `!!scene-dot` MUST appear on both, byte-identical.
```

### (c) Continuous multi-slide morph (story arc) — use helpers

**Visual outcome.** A 5-slide arc telling one continuous story: same 2 scene actors drift across the canvas as the narrative progresses; content (`#sN-*`) refreshes per slide and is ghosted on the next. Building this by hand is ~60 commands — use `reference/morph-helpers.py` to keep the build script short and auto-verified.

```python
#!/usr/bin/env python3
# Invoke the provided helper library for clone + ghost + verify
import subprocess, sys, os
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HELPERS = os.path.join(SCRIPT_DIR, "reference", "morph-helpers.py")
FILE = "deck.pptx"

def helper(*args):
    subprocess.run([sys.executable, HELPERS, *[str(a) for a in args]], check=True)

# ... assume slide 1 is built with 2 scene actors (!!scene-ring, !!scene-dot) + #s1-title
# Helper builds slide 2–5 with: clone from previous + apply transition=morph + ghost previous #sN- content
for n in range(2, 6):
    helper("clone", FILE, n - 1, n)          # clone + set transition=morph + list shapes
    helper("ghost", FILE, n, "all-content")  # ghost all #s(n-1)-* via duplicate-text detection
    # …then add THIS slide's #sN- content via officecli add as normal…
helper("final-check", FILE)                   # structural pass; DOES NOT catch !! lingering in visible area
```

Helper signatures and source: `reference/morph-helpers.py` (`clone`, `ghost`, `verify`, `final-check`). The shell equivalent is `reference/morph-helpers.sh` — pick one per platform; do not mix.

**When to use helpers vs raw `officecli`.** For 2-3 slide decks, raw commands (recipes a, b) are clearer. For 5+ slides with repeating clone/ghost/verify cadence, helpers save ~40% of commands and provide built-in verification. Every slide is still closed by `officecli validate` before delivery.

### (d) Morph + fade hybrid — entrance on morph slide

**Visual outcome.** A morph pair where `!!scene-ring` moves continuously while a NEW per-slide card fades in simultaneously. Used when a morph-paired backdrop carries the eye and fresh foreground content needs a softer entrance than a raw appearance.

```bash
# Slide 2 already has transition=morph and !!scene-ring. Add a new card with fade-entrance.
officecli add "$FILE" /slide[2] --type shape --prop 'name=#s2-card' --prop preset=roundRect \
  --prop fill=F5F7FA --prop line=none --prop x=2cm --prop y=12cm --prop width=10cm --prop height=5cm

# Apply simultaneous-with-morph fade entrance to the new card.
# 'fade-entrance-300-with' = fade in, 300ms, trigger=withPrevious (plays with the morph transition).
officecli set "$FILE" "/slide[2]/shape[@name=#s2-card]" --prop animation=fade-entrance-300-with
officecli get "$FILE" "/slide[2]/shape[@name=#s2-card]" --json | jq '.data.format.animation'  # readback sanity
```

**Why this works.** Morph animates the `!!scene-*` shapes only (they have a pair on slide 1); the new `#s2-card` has no slide-1 counterpart, so morph would default-fade it — `fade-entrance-300-with` makes that fade explicit and timed. Keep the animation per pptx v2 floor: ≤ 600ms, no bounce / swivel / fly-from-edge (`officecli help pptx animation` for the canonical preset list).

## Choreography — animation types + staggered timing

How morph animates multiple shapes determines what the audience sees. Pick the right mechanism for each pair:

| Animation type        | How to achieve it (between Slide A and Slide B)                                                                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple move           | Same `!!` name on both slides, same size, different `x`/`y` — morph interpolates position                                                                                                                                                                                                                                                       |
| Scale transform       | Same name, different `width`/`height` — morph interpolates size (and re-positions the center)                                                                                                                                                                                                                                                   |
| Move + scale          | Different `x`, `y`, `width`, `height` simultaneously — morph handles all dimensions at once                                                                                                                                                                                                                                                     |
| Color / opacity shift | Same name, different `fill` or `opacity` — morph cross-fades the fill                                                                                                                                                                                                                                                                           |
| Rotation              | Same name, different `rotation` (degrees) — morph rotates along the shortest arc                                                                                                                                                                                                                                                                |
| Font size change      | Same name, different `size` (pt) on text shape — interpolates in PowerPoint 365; less reliable on Keynote / WPS / LibreOffice (may degrade to crossfade). For portable motion, pair `size` change with a matching `width`/`height` delta or an `x`/`y` displacement — the spatial change keeps motion visible when size interpolation drops out |
| Enter (fade in)       | Shape exists only on Slide B (no counterpart on A) — morph fades it in                                                                                                                                                                                                                                                                          |
| Exit (fade out)       | Shape exists only on Slide A (no counterpart on B) — morph fades it out                                                                                                                                                                                                                                                                         |

**Multi-shape timing constraint.** All `!!` shapes in one morph pair animate **simultaneously** — there is no per-shape delay / duration knob in the CLI (help confirms: no `morph.duration` / `morph.delay` on slide). To stagger shape A before shape B, **split the transition into two pairs** with an intermediate slide:

```
Slide 2 → Slide 3:  !!actor-A moves (!!actor-B stays put)
Slide 3 → Slide 4:  !!actor-B moves (!!actor-A stays put or ghosts)
```

Slide 3 is an explicit intermediate keyframe. Do NOT attempt to fake staggering via timing props on the shape's `animation=` prop — Morph runs before per-shape animations.

**Good-enough variety heuristic (Best Practice — creative flexibility).** For a morph to read as "motion", change at least 3 of {x, y, width, height, rotation, fill, opacity} on the dominant paired shape, with displacement ≥ 5cm OR rotation ≥ 15° OR size delta ≥ 30%. One shape × 3 props is a valid creative pattern (focus on one hero element).

**Delivery Gate 5b-morph-2 is stricter.** The gate hard-asserts ≥ 3 DIFFERENT `!!`-prefixed shapes each vary by ≥ 1 of {x, y, width, height, rotation, font-size} across the pair — integrity check for "is this really a morph or a pretend-morph". Heuristic informs creative intent; Gate decides delivery. **Brand-constant scenery (pinned header strip, footer bar, logo badge) does NOT count toward the 3-shape quota** — these are supposed to stay put; motion must come from 3 other named shapes. When in doubt, satisfy the stricter Gate.

**Deck-length rhythm.** Filling every transition with morph reads as anxious, not cinematic. Pace morph moments to deck length:

- **8-10 slides (dense):** 3-5 morph moments; motion can cluster.
- **12-18 slides (ceremonial):** 3-5 TOTAL morphs, spaced every 4-6 slides; use `transition=morph` at section dividers so the animation reads as chapter punctuation, not continuous agitation.
- **18+ slides (Act-based):** structure into 3 acts with 1 long section-divider morph between acts (5-10s of deliberate motion with a brief hold), plus 2-3 quieter morphs inside each act. Lean heavier on `!!scene-*` continuity than per-slide `!!actor-*` churn.

## Scene-actor spatial rule

Scene actors and actors moving across the canvas MUST stay in predictable zones during morph — otherwise they cross over content and read as clutter.

**Safe zones (prefer for scene actor rest positions and morph paths):**

```
Top-right corner:   x ≥ 24cm, y ≤ 6cm
Bottom-right:       x ≥ 24cm, y ≥ 12cm
Bottom-left:        x ≤ 2cm,  y ≥ 12cm
Off-canvas (ghost): x ≥ 33.87cm  (canvas right edge; use x=36cm for explicit ghost)
```

**Avoid resting actors in the content core:** `x = 2~28cm, y = 3~16cm`. Actors may **pass through** the core during morph (that's the motion), but they should not end a slide parked there with high opacity unless they are content themselves (`!!actor-*` carrying the slide's message).

**Before placing any scene actor, inspect existing shape bounds:**

```bash
officecli get "$FILE" "/slide[$N]" --depth 1 --json | \
  jq -r '.data.children[]? | "\(.format.name // .path)  x=\(.format.x) y=\(.format.y) w=\(.format.width) h=\(.format.height)"'
```

Confirm the actor's target position does not overlap any `#sN-*` content shape's bounding box (`x` to `x + width`, `y` to `y + height`). If it would overlap, lower actor `opacity` ≤ 0.15 OR move it to a safe zone.

## Style library lookup workflow

`reference/styles/` holds 52 visual style directories (dark / light / warm / vivid / bw / mixed moods) — design inspiration, not templates. Use the library as **on-demand reference**, not as a content dump.

**Why lookup, not copy.** Each of the 52 `build.sh` files is a complete style demo — but the coordinates were hand-tuned for that specific demo's content length. Copying them verbatim into a deck with different content produces overlaps and misalignment (flagged in `INDEX.md` L5-11). The library's value is the **design logic**: palette choice for a mood, signature shape, choreography pattern. Apply that logic to your own grid math.

**Four-step lookup:**

1. **Browse INDEX.** `reference/styles/INDEX.md` groups all 52 styles by palette category and mood (e.g. `dark--premium-navy` = authoritative / refined; `warm--earth-organic` = organic / grounded). The Quick Lookup table also shows each style's **primary hex trio** (bg / fg / accent) — if the user specified a brand color, scan the hex column to find the nearest match without opening every `style.md`. Pick 1 style that matches the topic mood OR aligns with the user-specified hex.
2. **Read philosophy.** Open `reference/styles/<style-id>/style.md` for design intent — type pairing, color logic, signature elements.
3. **Glance technique.** Open `reference/styles/<style-id>/build.sh` ONLY for technique reference (signature shapes, palette hex codes, choreography ideas) — **coordinates are known-buggy per `INDEX.md` L5-11**; do not copy them.
4. **Apply on your own canvas.** Build your deck using pptx v2 grid math + visual floor; borrow only the palette and the signature gesture.

**Pointer:** `→ see reference/styles/<style-id>/` — never inline-copy coordinates from a style build.sh.

## Delivery Gate (inherits pptx v2 + morph additions)

**Gate 1–5a: full port from pptx v2.** → see pptx v2 §Delivery Gate. Schema (whitelisting C-P-2 chart spPr), token grep (`$…$` / `{{…}}` / `\$\t\n` / `()` / `[]`), hyperlink rPr (C-P-1), slide-order sanity, dark-on-dark contrast (Gate 5a). **Refuse to declare done until every pptx Gate 1–5a prints its OK message.** Morph decks have the same token / schema / order risks as any pptx.

### Gate 2 morph addendum — price / metric tokens eaten by zsh

Pptx v2 Gate 2 covers `$…$`, `{{…}}`, `\$\t\n` literals, empty `()` / `[]`. Morph decks add a class of leaks: price / metric tokens (`$9/mo`, `$29/month`, `$199/yr`) written in double-quoted `--prop text="…"` — the shell eats `$9` as an empty variable and the CLI stores `/mo` or a stray period. Run this in addition to pptx Gate 2:

```bash
# Gate 2 morph — price / metric token leaks + stray-period placeholders
# Pattern hits: bare prices ($9, $29, $9.99), /unit suffix ($9/mo, $199/yr), ${VAR}, \n/\r/\t, lone period
LEAKS=$(officecli view "$FILE" text | grep -nE '\$[0-9]+(\.[0-9]+)?(/(mo|month|yr|year|day|wk|week|hr|hour))?|\$\{[A-Z_]+\}|\\[nrt]|^\.$' || true)
if [ -z "$LEAKS" ]; then echo "Gate 2 morph OK"; else echo "LEAK: $LEAKS"; fi
```

Covers: `$9` `$9.99` `$29/month` `$199/yr` `$1/day` `${VAR}` `\n`/`\r`/`\t` literals + stray `.` placeholders. Fix: single-quote the prop (`--prop text='$9/mo'`).

### Gate 5b — Visual audit via HTML preview (MANDATORY) — extended for morph

Run `officecli view "$FILE" html` and Read the returned HTML path. For every slide, answer the pptx v2 Gate 5b questions (overlap / dark-on-dark / divider overlap / order sanity / missing arrowheads) PLUS these four morph-specific checks:

**Important: selectors with prefix match.** `officecli query` only supports operators `=`, `!=`, `~=`, `>=`, `<=`, `>`, `<` — there is NO `^=` prefix operator. A selector like `shape[name^=!!actor-]` returns an `invalid_selector` error. For "starts-with" filtering, use a `get --depth 1` loop + `jq startswith()` as shown below.

- **5b-morph-1 — `!!actor-*` leak into visible area after its section ends.** For every `!!actor-*` that should have exited, confirm `x ≥ 33.87cm` (canvas right edge). Loop + filter (selector-safe):

  ```bash
  NSLIDES=$(officecli query "$FILE" slide --json | jq '.data.results | length')
  for N in $(seq 1 $NSLIDES); do
    officecli get "$FILE" "/slide[$N]" --depth 1 --json | \
      jq -r --arg n "$N" '.data.children[]? |
        select(.format.name? // "" | startswith("!!actor-")) |
        select((.format.x // "0cm" | rtrimstr("cm") | tonumber) < 33.87) |
        "slide \($n) leak: \(.format.name) stuck at x=\(.format.x)"'
  done
  ```

  Any line printed = actor stuck visible. `final-check` misses this — only the loop + Read HTML do.

- **5b-morph-2 — Adjacent slides have identical spatial composition (no motion).** Hard rule: between every morph pair, ≥ 3 DIFFERENT `!!`-prefixed shapes must each differ by ≥ 1 of {x, y, width, height, rotation, font-size}. Proof loop (dump both slides, diff same-name shapes, count differing shapes):

  ```bash
  for K in 1 2 3 4; do
    A=$(officecli get "$FILE" "/slide[$K]" --depth 1 --json | \
      jq -r '.data.children[]? | select(.format.name? // "" | startswith("!!")) |
        "\(.format.name)|\(.format.x)|\(.format.y)|\(.format.width)|\(.format.height)|\(.format.rotation // 0)"')
    B=$(officecli get "$FILE" "/slide[$((K+1))]" --depth 1 --json | \
      jq -r '.data.children[]? | select(.format.name? // "" | startswith("!!")) |
        "\(.format.name)|\(.format.x)|\(.format.y)|\(.format.width)|\(.format.height)|\(.format.rotation // 0)"')
    VARIES=$(diff <(echo "$A") <(echo "$B") | grep -c '^[<>]')
    if [ "$VARIES" -lt 6 ]; then echo "pair $K→$((K+1)) FLAT: only $VARIES diff-lines (need ≥ 6 = 3 shapes × 2 sides)"; fi
  done
  ```

- **5b-morph-3 — Morph-pair name mismatches.** Adjacent slides must share at least 2 `!!`-prefixed names exactly. Proof (note: `.data.children[]` — bare `.children[]` returns null):

  ```bash
  for N in 1 2 3 4 5; do
    echo "--- slide $N ---"
    officecli get "$FILE" "/slide[$N]" --depth 1 --json | \
      jq -r '.data.children[]? | select(.format.name? // "" | startswith("!!")) | .format.name'
  done
  ```

  Visually compare sequential blocks — shared `!!` names between N and N+1 are the morph pairs. Zero overlap = the pair is a plain fade.

- **5b-morph-4 — `#sN-*` lingering on slide N+1 (ghost leak).** Per-slide content MUST be ghosted (`x=36cm`) on the NEXT slide. Loop + filter per N≥2:
  ```bash
  NSLIDES=$(officecli query "$FILE" slide --json | jq '.data.results | length')
  for N in $(seq 2 $NSLIDES); do
    PREV=$((N-1))
    officecli get "$FILE" "/slide[$N]" --depth 1 --json | \
      jq -r --arg n "$N" --arg p "$PREV" '.data.children[]? |
        select(.format.name? // "" | startswith("#s\($p)-")) |
        select((.format.x // "0cm" | rtrimstr("cm") | tonumber) < 33.87) |
        "slide \($n) leak: \(.format.name) stuck at x=\(.format.x)"'
  done
  ```
  Any line printed = a `#s(N-1)-*` shape stayed visible on slide N. Ghost it.

**REJECT the delivery** if any 5b-morph-1..4 loop prints a line. Collect stdout from all four loops into one stream and enforce with the COUNT pattern: `LEAK_COUNT=$(...all four loops... | wc -l); if [ "$LEAK_COUNT" -gt 0 ]; then echo "REJECT: $LEAK_COUNT morph leaks"; else echo "Gate 5b-morph OK"; fi`.

## Renderer honesty

**Morph renders in:** PowerPoint 365 (Windows/Mac), Keynote, WPS, PowerPoint Online.

**Morph does NOT render in:** LibreOffice Impress (renders static, sometimes as fade), Google Slides web viewer (loses interpolation), most HTML / SVG viewers, `officecli view html` (structural only — morph is runtime). This is `[RENDERER-BUG]`, not a skill defect. Tell the user explicitly: "Open in PowerPoint 365 / Keynote / WPS to see the morph motion; other viewers will show static or plain fade."

Static screenshots from any renderer **cannot verify morph motion** (the motion only exists at runtime). Use Gate 5b queries above to prove pair correctness; use a live viewer to prove motion quality.

## Ghost Discipline & Actor Lifecycle

**Every `!!actor-*` and `#sN-*` shape must be managed across EVERY slide, not just its "exit" slide.**

### The Per-Slide Ghosting Rule

When building a multi-slide morph deck:

1. **Slide N: Introduce `!!actor-ring` (visible at x=0cm)**
2. **Slide N+1: Add new content. Before finishing, ghost `!!actor-ring` to `x=36cm`.**
3. **Slide N+2: Add more content. Re-ghost `!!actor-ring` to `x=36cm` again.** (Not optional — even though it was already off-screen, each slide is a fresh canvas.)
4. **Slide N+3: If `!!actor-ring` should be visible again, move it back to x=0cm or its new position.**

**Why:** Each slide's shape list is independent. Moving a shape off-canvas on slide N does NOT carry over to slide N+1 — if you forget to re-ghost it, it will re-appear at its original position on N+1.

### Workflow Pattern (Bash)

```bash
# After adding new content shapes to slide $SLIDE:
for ACTOR in "!!actor-ring" "!!actor-dot" "!!actor-accent-bar"; do
  officecli set "$FILE" "/slide[$SLIDE]/shape[@name=$ACTOR]" --prop x=36cm || true
done
```

Or in a build loop:

```bash
for SLIDE_NUM in 3 4 5 6 7 8 9 10 11; do
  # Add content specific to this slide
  officecli add "$FILE" "/slide[$SLIDE_NUM]" --type shape ...

  # IMMEDIATELY ghost all old actors (M-2 prevention)
  officecli set "$FILE" "/slide[$SLIDE_NUM]/shape[@name=!!actor-ring]" --prop x=36cm || true
  officecli set "$FILE" "/slide[$SLIDE_NUM]/shape[@name=!!actor-dot]" --prop x=36cm || true
done
```

### Detection: Ghost Count Gate

`morph-helpers.py final-check` counts all shapes at `x ≥ 34cm`. If count > 50, it prints:

```
REJECT: Found 135 accumulated ghosts — likely M-2 ghost accumulation.
Run: officecli query deck.pptx 'shape[x>=34cm]' --json | jq '.data.results | length'
Expected ≤ 50 (roughly 4–5 active actors × 10–12 slides).
```

**Fix:** Review the build log, ensure every slide re-ghosts all actors that should not appear in it. Re-run final-check. If still > 50, use `morph-helpers.py clean-accumulation deck.pptx` (see reference section).

## Common Morph Pitfalls (design + workflow traps)

Base pptx pitfalls (shell quoting, zsh `[N]` globbing, hex `#` prefix, `\n` in prop text) → see pptx v2 §Common Pitfalls. These are the morph-specific traps:

| Pitfall                                                                          | Correct approach                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `!!scene-card` and `!!actor-card` in the same deck                               | Names must be unique across prefixes. Rename: `!!scene-card-bg` vs `!!actor-card-content`                                                                                                                                                                                                                                                                                                                  |
| Renaming shapes mid-build after some slides are already done                     | Ghost accumulation bug waiting to happen. Stop, redraw the §Morph Pair Planning table, rerun affected slides                                                                                                                                                                                                                                                                                               |
| Placing `!!actor-*` into the content core without planning an exit               | Every `!!actor-*` needs a ghost slide. Plan it in the pair table BEFORE coding                                                                                                                                                                                                                                                                                                                             |
| **Ghost accumulation (M-2): forgetting to re-ghost `!!actor-*` on later slides** | **CRITICAL:** When you add new content to slide N+1, ALL `!!actor-*` from slide N that should not be visible must be moved to `x=36cm` again. Do NOT assume they stay off-screen once ghosted — each slide is independent. Build pattern: `for each new slide: add content shapes → then loop: set each active !!actor-* to x=36cm`. `morph-helpers.py final-check` will REJECT if ghost count exceeds 50. |
| Forgetting `transition=morph` on a slide                                         | Silent fade. Gate 5b-morph-2 (no motion) catches it; fix via `set /slide[N] --prop transition=morph`                                                                                                                                                                                                                                                                                                       |
| Using `@name=` path on a morph slide after `transition=morph` was set            | Selector breaks (M-1). Switch to index paths `/slide[N]/shape[K]`                                                                                                                                                                                                                                                                                                                                          |
| Adjacent slides visually identical                                               | Morph has nothing to interpolate — collapses to plain fade. Apply §Scene-actor spatial rule and move ≥ 3 shapes by ≥ 5cm / ≥ 15°                                                                                                                                                                                                                                                                           |
| Trying to stagger 2 shapes via per-shape timing                                  | Not supported — split the pair into two transitions with an intermediate keyframe slide                                                                                                                                                                                                                                                                                                                    |
| Testing morph motion in LibreOffice or a browser                                 | `[RENDERER-BUG]`, not skill defect. Test in PowerPoint 365 / Keynote / WPS                                                                                                                                                                                                                                                                                                                                 |
| Deleting a `!!` shape on exit instead of ghosting it                             | Deletion breaks morph pairing — the shape vanishes without animation. Always ghost to `x=36cm`                                                                                                                                                                                                                                                                                                             |
| Writing `--prop text="$9/mo"` with double quotes                                 | Shell eats `$9` as empty variable → text stored as `/mo` or stray `.`. Use single quotes: `--prop text='$9/mo'`. Gate 2 morph addendum greps this leak.                                                                                                                                                                                                                                                    |
| Using `<a:br/>` literal inside `--prop text='line1<a:br/>line2'`                 | Stored as 7 literal characters, not a line break. Use `officecli add "/slide[N]/shape[@id=K]" --type paragraph` once per line (M-6).                                                                                                                                                                                                                                                                       |
| Using `shape[name^=!!actor-]` selector                                           | `officecli query` has no `^=` operator — returns `invalid_selector`. Use `get /slide[N] --depth 1 --json \| jq '.data.children[]? \| select(.format.name \| startswith("!!actor-"))'`.                                                                                                                                                                                                                     |
| Running `validate` while resident mode is open                                   | Pptx v2 inherits this trap — `officecli close "$FILE"` BEFORE `validate`                                                                                                                                                                                                                                                                                                                                   |

## Known Issues & Pitfalls

Base pptx bugs C-P-1..7 (hyperlink rPr, chart ChartShapeProperties warning, animation duration readback, animation remove, connector enum, connector `@name=`, chart-color renderer normalization) all apply. **→ see pptx v2 §Known Issues C-P-1..7 for workarounds.**

**Morph-specific (M-1..5):**

| #          | Symptom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Workaround                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M-1**    | After `officecli set '/slide[N]' --prop transition=morph`, every shape on that slide has `!!` auto-prepended to its name (`#s1-title` → `!!#s1-title`). Name-path selectors like `/slide[N]/shape[@name=#s1-title]` stop matching silently. **Selector filter caveat:** after auto-prefix, `!!#sN-caption` coexists alongside `!!actor-*` — filtering "scene actors" with `startswith("!!")` produces false matches on auto-prefixed content. Always filter with `startswith("!!actor-")` or `startswith("!!scene-")`, never bare `startswith("!!")`. | Use **index paths** after morph is set: `get /slide[N] --depth 1` to list shapes, then address via `/slide[N]/shape[K]`. Keep a shape-index comment at the top of the build script.                                                                                                                                                                                                                      |
| **M-2 🚨** | **Ghost accumulation — `!!actor-*` introduced on slide 3 stays visible on slides 4, 5, 6 unless EXPLICITLY ghosted every page.** `final-check` helper detects this and rejects if ghost count > 50.                                                                                                                                                                                                                                                                                                                                                   | **MANDATORY per-slide rule:** After you add new content to a slide, immediately set ALL active `!!actor-*` from previous slides to `x=36cm` (or explicitly position them visible if they belong in the current context). Example: `officecli set /slide[4]/shape[@name=!!actor-ring] --prop x=36cm`. Run after EVERY slide addition, not just at the end. See §Ghost Discipline & Actor Lifecycle below. |
| **M-3**    | Section-transition boundary — on the first slide of a new topic section, previous-section `!!actor-*` shapes visibly linger. No command errors; only visual clutter.                                                                                                                                                                                                                                                                                                                                                                                  | On every section-start slide, explicitly ghost ALL `!!actor-*` from the previous section to `x=36cm`. Scene shapes (`!!scene-*`) stay.                                                                                                                                                                                                                                                                   |
| **M-4**    | `officecli help pptx slide` lists `transition=` but NO sub-props for duration / delay / easing of the transition itself. Agents sometimes invent `morph.duration=` / `transition.delay=` — they are rejected as UNSUPPORTED.                                                                                                                                                                                                                                                                                                                          | Accept defaults (morph ~1s, linear ease). For custom speed, use `raw-set` to add the `spd` attribute on `<p:transition>` — see M-4 example block below. Help does not list sub-props; `raw-set` is the only path.                                                                                                                                                                                        |
| **M-5**    | `[RENDERER-BUG]` LibreOffice / Google Slides web viewer render morph slides as plain fade (no interpolation).                                                                                                                                                                                                                                                                                                                                                                                                                                         | Test in PowerPoint 365 / Keynote / WPS. Not a skill defect — do not chase.                                                                                                                                                                                                                                                                                                                               |
| **M-6**    | `<a:br/>` written inside `--prop text='line1<a:br/>line2'` is stored as the literal 7-character string, NOT interpreted as a line break. Audience sees `line1<a:br/>line2` rendered verbatim.                                                                                                                                                                                                                                                                                                                                                         | For multi-line bullets / captions, add one paragraph per line: `officecli add "/slide[N]/shape[@id=K]" --type paragraph --prop text='line1'` then repeat with `text='line2'`. See pptx v2 §Shell escape for the real-newline workflow.                                                                                                                                                                   |

**M-4 example — slow down all morph transitions** (`raw-set` requires a `<part>` positional arg; `//p:transition` matches both `mc:Choice` and `mc:Fallback` on a morph slide, yielding `2 element(s) affected`):

```bash
# Per-slide: add spd="slow" to every transition element on slide N (2 XML hits per morph slide)
for N in 2 3 4; do
  officecli raw-set "$FILE" "/slide[$N]" --xpath "//p:transition" --action setattr --xml 'spd=slow'
done
officecli validate "$FILE"
```

Readback: `officecli query "$FILE" slide --json | jq '.data.results[].format | select(.transition=="morph") | .transitionSpeed'` prints `"slow"` for each affected slide.

## Outputs & delivery

Every morph deck ships with three artifacts, each as a standalone file:

1. `<topic>.pptx` — the deck, closed + `officecli validate` clean (Delivery Gate 1 OK).
2. `build.sh` or `build.py` — the re-runnable script (bash for shell-native builds; Python for multi-slide arcs using `morph-helpers.py`). Must recreate the deck from a fresh `officecli create` call.
3. `brief.md` — **standalone file, NOT embedded in anything else.** Contains:
   - Section 1: topic / audience / purpose / narrative / style direction (1 named style from `reference/styles/INDEX.md`)
   - Section 2: slide-by-slide outline (page type + one-sentence argument per slide)
   - Section 3: §Morph Pair Planning table (Pair / Slide A / Slide B / Actors / Ghosts) — the design record the reviewer needs to audit choreography

**Pre-deliver reminder to the user (verbatim-safe wording):**

- "The deck is ready with morph transitions. Open it in PowerPoint 365 / Keynote / WPS to see the motion — LibreOffice and web viewers render static."
- "While the build script is running, the `.pptx` may be rewritten several times. If you want to preview progress, use `officecli watch "$FILE"` and open the live preview in AionUi — do NOT click 'Open with system app' during the build, or you'll hit a file lock."

## Adjustments after creation

Standard adjustments table → see pptx v2 §Common Pitfalls / `swap` / `move` / `remove` / `set`. Morph caveat: **after any `swap` or `move` that reorders morph-paired slides, re-verify the adjacency of shared `!!` names.** Run Gate 5b-morph-3 query above on the affected pairs — if the swap broke a pair, either rename shapes or re-choreograph the transition.

**Final sanity check before delivery.** Run the full Delivery Gate (1 through 5b-morph-1..4), open the `.pptx` in PowerPoint 365 / Keynote / WPS, watch one full slide-to-slide morph to confirm motion is visible. If any Gate prints REJECT, fix and re-run — never deliver with a known-open gate.

## References

- `reference/decision-rules.md` — Pyramid Principle, SCQA, page-type menu, `brief.md` schema. Read during §Morph Pair Planning to decide narrative arc before writing commands.
- `reference/pptx-design.md` — residual design notes (Scene Actors mechanics, page-type table, choreography patterns). Canvas / fonts / colors live in pptx v2 — this file covers only the morph-unique material.
- `reference/morph-helpers.py` — Cross-platform (Mac / Windows / Linux) Python helpers for clone + ghost + verify + final-check. Import as a library or call via CLI args. Preferred for 5+ slide arcs.
- `reference/morph-helpers.sh` — Bash equivalent. Pick one per project; do not mix.
- `reference/styles/INDEX.md` — 52-style visual library, grouped by palette (dark / light / warm / vivid / bw / mixed) and mood. Lookup workflow in §Style library lookup workflow above.
- `skills/officecli-pptx/SKILL.md` — base pptx v2 rules (visual floor, grid, canonical palettes, chart-choice, connector canon, Delivery Gate 1–5a, Known Issues C-P-1..7, Shell escape 3-layer).

```

### A3. officecli-pitch-deck/SKILL.md (verbatim)

```markdown
---
name: officecli-pitch-deck
description: "Use this skill when the user is building a fundraising / investor pitch deck — seed, Series A / B / C, convertible note, SAFE round, strategic raise. Trigger on: 'pitch deck', 'investor deck', 'Series A deck', 'Series B deck', 'Series C deck', 'fundraising deck', 'seed pitch', 'VC deck', 'raising capital', 'term sheet presentation'. Output is a single .pptx. This skill is a scene layer on top of officecli-pptx — inherits every pptx v2 rule (visual floor, grid, palettes, connector canon, Delivery Gate). DO NOT invoke for a generic board review, sales deck, all-hands, or product launch — route those to officecli-pptx base."
---

# OfficeCLI Pitch Deck Skill

**This skill is a scene layer on top of `officecli-pptx`.** Every pptx hard rule — visual delivery floor (title ≥ 36pt / body ≥ 18pt / title ≥ 2× body), 12-column grid on 33.87×19.05cm, 4 canonical palettes, chart-choice decision table, connector canon (`shape` / `from` / `to` / `tailEnd=triangle`), shell escape, resident + batch, Delivery Gate 1–5a — is inherited, not re-taught. This file adds only what **fundraising** needs on top: stage diagnosis (A / B / C), 5 赛道 arc templates, 10 key-slide recipes (cover / problem / solution / market / product / model / traction / team / financials / ask), pitch-specific numbers convention, a VC ship-check, and a pitch-specific fresh-eyes Gate 6.

When the pptx base rules cover it, the text here says `→ see pptx v2 §X`. Read `skills/officecli-pptx/SKILL.md` first if you have not.

## Setup

If `officecli` is missing:

- **macOS / Linux**: `curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash`
- **Windows (PowerShell)**: `irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex`

Verify with `officecli --version` (open a new terminal if PATH hasn't picked up). If install fails, download a binary from https://github.com/iOfficeAI/OfficeCLI/releases.

## ⚠️ Help-First Rule

**This skill teaches what a fundraising deck requires, not every command flag.** When a prop name, enum value, or preset is uncertain, consult help BEFORE guessing.

```bash
officecli help pptx                          # All pptx elements
officecli help pptx <element>                # Full schema (e.g. chart, shape, connector, picture)
officecli help pptx <element> --json         # Machine-readable
```

Help reflects the installed CLI version. When this skill and help disagree, **help wins.** Every `--prop X=` in this file has been grep-verified against `officecli help pptx <element>` — if help adds / renames a prop in a later version, trust help.

## Mental Model & Inheritance

**Inherits pptx v2.** You should have read `skills/officecli-pptx/SKILL.md` first. This skill assumes you know how to: add slides + shapes + charts + connectors; address by `@name=` / `@id=`; quote paths; use `batch` heredocs; write `--prop tailEnd=triangle` on every flow connector; and run the 5-gate Delivery Gate. If any of those are unfamiliar, open a pptx v2 session before continuing.

## Shell & Execution Discipline

**Shell quoting, incremental execution, `$FILE` convention** → see pptx v2 §Shell & Execution Discipline. Same rules verbatim — quote `[N]` paths, single-quote values containing `$` (including `$35M`, `$1.2B TAM` in a cover or ask slide), never hand-write `\$ \t \n` in executable examples, one command at a time. Examples below use `$FILE` (`FILE="deck.pptx"`).

**Single-quote every shape text containing `$`.** `--prop text="Series B · $35M"` (double quotes) is WRONG — zsh expands `$35M` → empty, deck renders `Series B · M` silently. `--prop text='Series B · $35M'` (single quotes) is right. This is the #1 pitch-deck shell-escape failure mode (`$35M`, `$18M ARR`, `$1.2B TAM` appear on cover/ask/financials/milestones). Gate 2 cannot detect a stripped `$35M` — no residue. Gate 2b catches common strip patterns; single-quoting PREVENTS them.

## What "pitch deck" means here (identity)

A pitch deck is a pptx with a **fundraising layer** on top: VC-oriented narrative arc, verifiable metrics, stage-appropriate data density, founder-credibility surface. Slides are consumed at ~3 seconds per slide in a live room — the pptx v2 rule. Pitch decks add a second constraint on top: **every slide carries one investable proposition**. If a slide is "interesting background" that doesn't move the ask forward, cut it. VCs will not. The base pptx rules still apply; pitch decks add six deltas:

1. **Stage determines everything.** Series A / B / C each dictates slide count, narrative weight, which metrics are must-haves, and tolerance for unit-econ sophistication. A Series A deck with 6 pages of CAC/LTV math reads as over-packaged; a Series B deck missing unit econ reads as incomplete. Pick the stage first — everything downstream follows.
2. **Narrative arc beats feature dump.** 10 essential slides in a fixed order: cover → problem → solution → market → product → model → traction → team → financials → ask. Out of order = VCs disengage.
3. **Numbers are a contract.** TAM/SAM/SOM must be clean three-layer; CAC/LTV must have a payback line; ARR ≠ revenue; Use-of-Funds must be a four-bucket pie. Sloppy numbers = round dies.
4. **Team slide carries prior companies.** Avatar grid alone reads as a student project. Add prior-company logos / names + one-line role. Without this, first-time founders look exactly like first-time founders.
5. **Traction chart y-axis starts at 0.** A "hockey stick" starting at `y_min = 80% of current` is a visual lie — VCs who have seen 10,000 decks spot it in < 2 seconds.
6. **The ask is a slide, not a footnote.** `$XX M` hero + four-bucket Use-of-Funds + runway length. "We're raising some money" is not an ask.

### Reverse handoff — when to go BACK to pptx base

Stay in **pptx v2 base** for board reviews, all-hands, sales decks, product launches, training decks — anything not tied to raising capital. Use **this skill** only when: (a) the user mentions a specific round (seed / Series A / B / C) or a VC meeting, AND (b) the deck needs at least 4 of {problem, traction, team with credentials, Use-of-Funds, stage-appropriate unit econ, financial projections}.

If the user says "fundraising deck" but the context is a corporate BU quarterly ask, that is a board review. Route to pptx v2 Recipe (d) 10-slide blueprint. If the user says "board review" but the context is a small company raising a bridge round, route here.

## Series A / B / C stage diagnosis (decision tool)

**Read this before writing a single command.** Pick the row that matches the user's description — everything downstream (slide count, which metrics, which recipes, what the team slide must show) derives from this one call.

| Stage             | Revenue band                 | Team         | Slide count | Dominant narrative (weight)                                                                               | Must-have data                                                                               | Common red flag                                                                       |
| ----------------- | ---------------------------- | ------------ | ----------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Seed**          | $0 – $1M ARR (often pre-rev) | 2 – 8 FTE    | 10 – 12     | Problem (30%) + Solution (25%) + Team (15%) + Market (15%) + Traction (15%)                               | Founder-market fit story; 1 – 2 design-partner / pilot logos; top-down TAM ok                | Over-claiming traction (10 customers = "market proven")                               |
| **Series A**      | $1 – $5M ARR                 | 10 – 25 FTE  | 12 – 16     | Problem (20%) + Solution (20%) + **Market "why now"** (15%) + Product (15%) + Traction (20%) + Team (10%) | PMF proof (NRR > 110%, low churn), bottom-up TAM/SAM, pipeline / pilots converted            | Bottom-up TAM feels fabricated; CAC not yet meaningful but shown anyway               |
| **Series B**      | $5 – $30M ARR                | 30 – 100 FTE | 18 – 22     | **Traction + Unit econ (30%)** + Market + Product + Team + Financials (ask)                               | ARR curve starting at 0; NRR, CAC, LTV, payback (< 18 mo ideal); cohort retention; logo wall | No unit-econ slide; CAC payback > 24mo without explanation; Use-of-Funds missing %    |
| **Series C**      | $30M+ ARR                    | 100+ FTE     | 20 – 24     | **Financials + Scale + Moat (40%)** + Market expansion + Team depth                                       | Multi-year GAAP, rule-of-40, GM trajectory, international expansion plan, defensibility      | No moat slide; revenue growth without margin story; team slide has no prior CEO / CFO |
| **Bridge / SAFE** | any                          | any          | 8 – 10      | **Specific bridge reason** + runway math + commitments                                                    | Prior round context; specific milestone the bridge funds; committed investor amount          | Treating a bridge like a Series A — too many slides dilutes the ask                   |

**Decision procedure.** From one or two user sentences ("Series B, $18M ARR, 120 customers, $35M raise"), pick exactly one stage row. All later choices in this skill reference your stage: which 赛道 template to pull, which recipes are mandatory vs optional, and which Delivery Gate 6 checks fire.

**Corner cases.** Bridge rounds & convertibles between A → B are closer to A or B depending on whether the bridge milestone is "finish PMF" (A shape) or "hit unit-econ target" (B shape). "Extension" rounds at the same stage reuse the earlier stage's skeleton and add a one-slide "progress since last round" update.

**Non-SaaS stage overrides.** The ARR / unit-econ shape of Series B fits SaaS. For other verticals, substitute revenue band + unit-econ equivalent + Gate 6.3 grep:

| Vertical                  | Revenue "band" at Series B     | "Unit econ" equivalent                                         | Gate 6.3 substitute                                                                                |
| ------------------------- | ------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Bio / Clinical-stage**  | pre-rev, 20–60 FTE             | burn rate + runway to next milestone (IND / Ph1 readout / BLA) | `shape:contains("ORR")` OR `contains("Pipeline")` OR `contains("BLA")` OR `contains("runway")` ≥ 1 |
| **Deep Tech / Frontier**  | pre-rev or early pilot rev     | technical milestones + TRL level + benchmark vs SoTA           | `shape:contains("TRL")` OR `contains("benchmark")` ≥ 1                                             |
| **Marketplace / Network** | GMV $10–100M                   | take rate + cohort retention + liquidity                       | `shape:contains("GMV")` + `contains("take rate")` ≥ 1                                              |
| **Consumer hardware**     | $2–15M revenue (shipped units) | contribution margin + repeat rate + blended CAC                | `shape:contains("repeat")` OR `contains("contribution")` ≥ 1                                       |

Substitute the analogue grep when running Gate 6.3 on these verticals. False WARN on SaaS CAC/LTV = expected; real concern = vertical-specific analogue present. Bio Series B decks especially: burn + runway-to-milestone IS the "unit econ" story.

## 赛道 arc templates (5 families)

5 mainstream verticals. Each one has different slide weights because what VCs require as proof-of-concept differs. Pick the vertical row; the slide skeleton is a copy-able starting point. Slide counts assume the matching stage row above.

### (1) B2B SaaS / Enterprise software

Canonical arc — the template most of VC muscle memory is built on. Series B example (20 slides): cover · TL;DR · problem · problem evidence · solution · product loop · market TAM/SAM/SOM · **unit economics (CAC / LTV / payback / GM)** · ARR trajectory · retention cohort · logo wall · team · competitors · financials 4-year · ask. Must-have: unit-econ slide from Series A onward; logo wall from Series B onward.

### (2) Consumer (B2C app / consumer hardware / D2C)

Narrative-driven. Early-stage decks lean on **product-experience screenshots + founding story + "why now"** market timing; lighter on unit econ (which are usually weaker than SaaS). Series A example (14 slides): cover · hook (30-second product demo or 1-line vision) · problem (lived experience) · solution (product shots) · product-experience flow · "why now" market window · pre-order / crowdfunding / early-sales evidence · retention / engagement (DAU, D30) · market (top-down ok if bottom-up unreliable) · competitive positioning · founder story + team · press / endorsements · financials · ask. Must-have: product visuals on ≥ 3 slides; "why now" slide (window justification); engagement metric not just revenue.

### (3) Deep Tech / Frontier tech (AI foundation models, quantum, climate hardware, robotics)

Technology credibility is the sell. Pre-revenue deep tech replaces "traction" with **technical milestones + defensibility**. Series B example (22 slides): cover · thesis (one-line "what changes if this works") · problem (current state of art) · solution (technical approach) · **technology architecture** · benchmarks vs SoTA · pipeline / TRL levels · market (long-tail) · business model · early commercial traction (pilots, LOIs) · IP / patents · team (usually PhD / ex-FAANG-research) · partners · financials · ask. Must-have: benchmark slide; IP slide; team slide dense with PhDs / prior-lab names.

### (4) Marketplace / Network business (two-sided platform, social, commerce)

Liquidity is the metric. Replace "unit econ" with **GMV + take rate + cohort retention + supply / demand balance**. Series A example (15 slides): cover · problem (friction in current supply-demand) · solution · product demo (both sides) · network effects diagram · early liquidity (first-week GMV, time-to-match) · cohort retention · geographic / category expansion plan · competitive positioning vs incumbents · take-rate model · team · financials · ask. Must-have: liquidity metric slide; cohort retention chart; network-effect diagram.

### (5) Bio / Life sciences / Healthtech

Regulatory pipeline IS the business. Replace "product roadmap" with **clinical pipeline + regulatory path + scientific evidence**. Series B example (22 slides): cover · unmet medical need · scientific rationale (mechanism of action) · preclinical / clinical data (ORR, safety, endpoints) · **pipeline chart** (candidates × stages × dates) · differentiation vs standard of care · IP / exclusivity · regulatory strategy (IND, BTD, fast-track) · market (prevalence × pricing) · commercial strategy (orphan / specialty / biosimilar) · partnerships / collaborations · team (CSO / CMO with prior FDA wins) · financials (burn to next milestone) · ask. Must-have: pipeline chart; clinical data slide; team slide with prior regulatory wins.

**Cross-vertical rule.** You can mix elements across templates, but never drop a must-have from your primary vertical. A SaaS deck missing unit econ, a bio deck missing a pipeline chart, a marketplace deck missing a liquidity metric — each is an instant VC disqualification.

## Slide Patterns (layout canon)

Patterns are **layout geometry**; recipes below are **narrative intent**. A slide picks one pattern for its visual shape (6 canonical ones below) and one recipe for what it argues (cover / problem / traction / ...). Multiple recipes can share one pattern — Problem / Why-Now / Traction-callout all lean on the 3-stat row (C.2). Pick the pattern first, then fill it with recipe content.

**Speaker notes rule.** Every content slide (non-cover, non-closing) MUST carry speaker notes via `officecli add "$FILE" /slide[N] --type notes --prop text='…'`. Missing notes = not shippable — inherits pptx v2 §Hard rules (H7). Run `officecli help pptx notes` to confirm prop names before building.

**Pattern reuse discipline.** Never run the same pattern on two consecutive slides — even with different data, two identical geometries in a row read as a template loop. Alternate C.2 with C.4 or C.5b to break rhythm.

**Vertical centering.** When a slide carries fewer elements than the pattern's maximum, nudge y-positions down 2–3cm to center the visual weight. Tables below assume full content.

### C.1 Title / Cover (dark gradient)

3–4 text shapes on a gradient fill. Slide 1 in every deck.

```
+----------------------------------+
|                                  |
|          TITLE (centered)        |
|          tagline                 |
|                                  |
|   round · amount · date          |
|  ________________________        |  <- thin brand band
+----------------------------------+
```

| Element                 | X   | Y    | Width   | Height | Font / size                     |
| ----------------------- | --- | ---- | ------- | ------ | ------------------------------- |
| Title                   | 2cm | 5cm  | 29.87cm | 4cm    | serif bold, ≥ 36pt (44 typical) |
| Tagline                 | 2cm | 10cm | 29.87cm | 2cm    | sans 18–22pt                    |
| Meta (round · $ · date) | 2cm | 13cm | 29.87cm | 1.5cm  | sans 12–16pt                    |

**Use this when** the slide is the first one (Cover recipe 1) — 3-second identity grab. Background is a 180° linear gradient between two dark palette shades (e.g. Professional Navy `1E2761 → 0D1F35`). If the title wraps to 2 lines, **add height (4cm → 5cm), never drop font below 36pt** — sub-36pt on a pitch cover reads as timid regardless of content. Transition: fade.

### C.2 3-Stat callout row

Title + 3 big-number / label pairs across. The default for Problem / Why-Now / Traction-callout slides.

```
+----------------------------------+
|  Title                           |
|                                  |
|   73%      12hr      $4.2B       |
|   label    label     label       |
|   source   source    source      |
+----------------------------------+
```

| Element               | X      | Y      | Width   | Height | Font / size            |
| --------------------- | ------ | ------ | ------- | ------ | ---------------------- |
| Title                 | 1.5cm  | 1cm    | 30.87cm | 3cm    | serif bold ≥ 36pt      |
| Stat 1 number         | 2cm    | 5cm    | 9cm     | 4cm    | serif bold 60–64pt     |
| Stat 1 label          | 2cm    | 9.5cm  | 9cm     | 2cm    | sans ≥ 16pt (H4 floor) |
| Stat 2 number / label | 12.5cm | (same) | 9cm     | (same) | (same)                 |
| Stat 3 number / label | 23cm   | (same) | 9cm     | (same) | (same)                 |

**Use this when** you have 2–3 anchoring numbers and the story is "three facts argue the point" — Problem, Why-Now, Market-callout, single-row Traction. Labels ≥ 16pt is the H4 floor (sub-label exception); a number without a label reads as bravado, so never drop labels to 12–14pt to fit more text.

### C.3 4-Stat callout row

Same geometry as C.2 but 4 columns. Numbers 60pt, width 7cm each.

```
+-------------------------------------+
|  Title                              |
|                                     |
|  73%   12hr   $9M   4.2x            |
|  lbl   lbl    lbl   lbl             |
+-------------------------------------+
```

| Element      | X positions               | Y     | Width   | Height | Font / size     |
| ------------ | ------------------------- | ----- | ------- | ------ | --------------- |
| Title        | 1.5cm                     | 1cm   | 30.87cm | 3cm    | serif bold 36pt |
| Stat numbers | 1.5 / 9.5 / 17.5 / 25.5cm | 5cm   | 7cm     | 4cm    | serif bold 60pt |
| Stat labels  | (same X)                  | 9.5cm | 7cm     | 2cm    | sans ≥ 16pt     |

**Use this when** exactly 4 parallel metrics tell the story and 3 feels under-counted. Prefer C.2 if in doubt — 4 always feels tighter than 3, and wrap risk is real.

> **Wrap warning.** At 60pt in 7cm width, dollar patterns with both `$` and `.` fail: `$9.4M` is 5 glyphs but the wide `$` and `.` in a serif bold make it wrap to 2 lines and destroy the callout. Safe dollar shapes at 60pt/7cm: `$9M`, `$96B`, `$4K` (3–4 chars). Non-dollar shapes: `340%`, `4.2x`, `12.3` safe up to 5 chars. Values ≥ 6 chars (`197min`, `3 Days`) will wrap — either (a) drop font to 44–48pt, (b) abbreviate (`197m`, `$9M`), or (c) shift to C.2 (9cm per stat). Single tokens only, no internal spaces.

### C.4 Chart + Context (chart left, stats right)

Chart takes left 55%, 2–3 stacked callouts on the right. The default for Traction / Financials / Market-sizing-with-context.

```
+-------------------------------------+
|  Title                              |
|                                     |
|  +---------------+   +--------+     |
|  |               |   | Stat 1 |     |
|  |    chart      |   +--------+     |
|  |               |   | Stat 2 |     |
|  +---------------+   +--------+     |
+-------------------------------------+
```

| Element      | X    | Y    | Width   | Height                                       |
| ------------ | ---- | ---- | ------- | -------------------------------------------- |
| Title        | 2cm  | 1cm  | 29.87cm | 3cm                                          |
| Chart        | 2cm  | 4cm  | 17cm    | 13cm                                         |
| Stats column | 21cm | 4cm+ | 11cm    | 2.5cm number + 1.5cm label (~3.7cm per pair) |

Sub-labels ≥ 16pt (H4 floor). For 5 stats stacked, drop number size to 44pt; 6+ stats means pick a different pattern. Post-batch for column/bar charts: `officecli set "$FILE" "/slide[N]/chart[1]" --prop gap=80` to tighten bar spacing.

**Use this when** one primary chart drives the story and 2–3 numeric anchors reinforce it — Traction (ARR curve + current ARR + YoY + NRR), Financials (4-year column chart + assumption callouts), Market (bar chart + SOM / CAGR / methodology).

### C.5 Icon-in-circle grid (3-row vertical)

3 vertical rows, each = circle icon on the left + title + 1-line description.

```
+---------------------------------------+
|  Title                                |
|                                       |
|  (o)  Label one                       |
|       description one                 |
|                                       |
|  (o)  Label two                       |
|       description two                 |
|                                       |
|  (o)  Label three                     |
|       description three               |
+---------------------------------------+
```

| Element     | X     | Y positions        | Width | Height | Font / size                   |
| ----------- | ----- | ------------------ | ----- | ------ | ----------------------------- |
| Icon circle | 2cm   | 4.5 / 8.5 / 12.5cm | 2.5cm | 2.5cm  | ellipse, accent fill          |
| Label       | 5.5cm | (icon Y + 0)       | 25cm  | 1.2cm  | sans bold 18pt                |
| Description | 5.5cm | (icon Y + 1.3cm)   | 25cm  | 1.8cm  | sans ≥ 16pt (H4 floor), muted |

**Use this when** you have 3 short vertical points that benefit from a visual anchor per row — Solution mechanism, Value pillars, Product loop. Choose C.5b (2×2 grid) when items are parallel and you have exactly 4; choose a horizontal 5-across variant when icons should read side-by-side (e.g. 5-step process).

### C.5b 2×2 Feature grid (4 parallel items)

4 rounded cards, 2 columns × 2 rows. Use when you have exactly 4 parallel items (product pillars, service types, feature quadrants).

```
+-----------------------------+
|  Title                      |
|                             |
|  +---------+  +---------+   |
|  | (o) T1  |  | (o) T2  |   |
|  | body    |  | body    |   |
|  +---------+  +---------+   |
|  +---------+  +---------+   |
|  | (o) T3  |  | (o) T4  |   |
|  | body    |  | body    |   |
|  +---------+  +---------+   |
+-----------------------------+
```

| Element                  | X              | Y              | Width   | Height | Font / size            |
| ------------------------ | -------------- | -------------- | ------- | ------ | ---------------------- |
| Slide title              | 2cm            | 1cm            | 29.87cm | 2.5cm  | serif bold 32pt        |
| Card 1 bg (top-left)     | 1.5cm          | 4cm            | 14.5cm  | 7cm    | roundRect              |
| Card 2 bg (top-right)    | 17.5cm         | 4cm            | 14.5cm  | 7cm    | roundRect              |
| Card 3 bg (bottom-left)  | 1.5cm          | 12cm           | 14.5cm  | 7cm    | roundRect              |
| Card 4 bg (bottom-right) | 17.5cm         | 12cm           | 14.5cm  | 7cm    | roundRect              |
| Icon ellipse (each card) | card_x + 0.5cm | card_y + 0.5cm | 2cm     | 2cm    | —                      |
| Card title (each)        | card_x + 3.2cm | card_y + 0.6cm | 10.5cm  | 1.8cm  | sans bold 16pt         |
| Card body (each)         | card_x + 0.5cm | card_y + 3cm   | 13cm    | 3.5cm  | sans ≥ 16pt (H4 floor) |

**Use this when** you have exactly 4 parallel items and the eye should land on each equally — 4 product pillars, 4 service tiers, 4 stakeholder types. 3 items feel lonely in a 2×2; 5+ items break the grid — go to a 3×2 (see pptx v2 §(d) grid math) or C.5 row pattern.

> **Z-order canon (critical).** Each card's `roundRect` background must be added immediately before that card's icon / title / body shapes in the batch JSON — pptx paints in insertion order, so a background added after its text paints over and hides the text. When building with `officecli batch`, follow the per-card sequence `bg → ellipse → title → body` strictly. Pattern and z-order details → see pptx v2 §Recipe (c) z-order canon; reuse grid math from pptx v2 §(d) for non-2×2 counts.

**Dark-background variant.** Change card fill from `F0F4F8` (light) to a lighter-dark shade like `1A2540` and bump body text to `FFFFFF` / `E8E8E8`. Palette variables (e.g. `$MUTED`) do NOT expand inside single-quoted heredocs — write the literal hex (`64748B`) in the JSON.

---

## Key-slide recipes (10 essentials)

The 10 slides every pitch deck carries. Each recipe below gives: **visual outcome** (what the slide looks like from 3m away) + **runnable block** (≤ 18 lines) + **QA one-liner**. All recipes inherit pptx v2 palettes, grid math, type hierarchy, and `--prop tailEnd=triangle` on every connector. Recipes reference the Slide Patterns above: Cover reuses C.1; Problem / Why-Now reuse C.2; Traction / Financials reuse C.4; Feature / pillar slides reuse C.5b. `$FILE` is your deck file.

**Long-title wrap rule.** A 36pt+ title that wraps to 2 lines: add `height` (e.g. 2cm → 3.5cm) — never drop the font below 36pt. Titles < 36pt on a pitch deck read as timid regardless of content.

### (1) Cover slide — company · tagline · round · date

**Visual outcome.** Dark navy fill, centered 44pt company name, 20pt one-line tagline underneath, small 16pt meta line at the bottom with round + amount + date. Thin brand band at the very bottom (0.5cm high) in the accent color.

```bash
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" "/slide[1]" --type shape --prop name=BrandBand \
  --prop geometry=rect --prop fill=CADCFC \
  --prop x=0cm --prop y=18.5cm --prop width=33.87cm --prop height=0.55cm
officecli add "$FILE" "/slide[1]" --type shape --prop name=CoverTitle --prop text="Acme DevOps" \
  --prop x=2cm --prop y=7cm --prop width=29.87cm --prop height=3cm \
  --prop font=Georgia --prop size=44 --prop bold=true --prop color=FFFFFF --prop align=center --prop fill=none
officecli add "$FILE" "/slide[1]" --type shape --prop name=Tagline --prop text="Kubernetes observability, built for production at scale" \
  --prop x=2cm --prop y=10.5cm --prop width=29.87cm --prop height=1.5cm \
  --prop font=Calibri --prop size=20 --prop color=CADCFC --prop align=center --prop fill=none
officecli add "$FILE" "/slide[1]" --type shape --prop name=CoverMeta --prop text='Series B · $35M · April 2026' \
  --prop x=2cm --prop y=15cm --prop width=29.87cm --prop height=1.2cm \
  --prop font=Calibri --prop size=16 --prop color=FFFFFF --prop align=center --prop fill=none
```

**QA.** Cover has 4 discrete elements (brand band + title + tagline + meta). 80%-whitespace covers fail the pptx "cover ≥ 60% filled" floor.

**Consumer variant (3-second grab).** Consumer decks (B2C app / hardware / D2C) should add a single dominant motif — hero product shot, oversized company name (60–96pt), or symbolic mark (crescent moon / abstract geometric). Replace the 44pt title with an 80–96pt name + one motif shape (`--type shape --prop geometry=ellipse --prop fill=<accent>` for an abstract mark, or `picture` at ~40% of slide for a product hero). Keep tagline + round + date identical. SaaS / B2B may skip — the typographic-only cover is sufficient.

### (2) Problem slide — industry pain in 1 sentence + 3 data cards

**Visual outcome.** 36pt title stating the pain (not "The Problem"). Below, three equal-width data cards across the slide: each a giant number (40pt) + one-line qualifier (16pt) + source footnote (12pt gray).

Grid math for 3 cards, 1.5cm margins, 0.76cm gap: `usable = 33.87 − 3 − 2·0.76 = 29.35`, `col_width = 29.35 / 3 = 9.78cm`. x-positions: `1.5 / 12.04 / 22.58`.

```bash
SLIDE=2  # second slide, after cover. Adjust from your build order.
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Kubernetes debugging burns 12 engineering hours / incident" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2.5cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"name":"PC1","geometry":"roundRect","fill":"F5F7FA","x":"1.5cm","y":"5cm","width":"9.78cm","height":"10cm"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"73%","x":"1.5cm","y":"6cm","width":"9.78cm","height":"3cm","font":"Georgia","size":"60","bold":"true","color":"1E2761","align":"center","fill":"none"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"of incidents take > 1 hour to diagnose","x":"1.5cm","y":"9.5cm","width":"9.78cm","height":"3cm","font":"Calibri","size":"18","color":"333333","align":"center","fill":"none"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Source: 2025 DORA Report","x":"1.5cm","y":"13cm","width":"9.78cm","height":"1cm","font":"Calibri","size":"12","italic":"true","color":"666666","align":"center","fill":"none"}}
]
EOF
# Repeat the 4-block pattern at x=12.04cm and x=22.58cm for cards 2 and 3.
```

**QA.** `officecli query "$FILE" 'shape:contains("Source")'` returns ≥ 3 (every claim carries a source). If zero sources, VCs will not trust a single number.

### (2b) Why Now slide — Consumer / Seed / early A must-have

**Visual outcome.** 3 cards across: each = **trigger headline** (24pt bold) + **data point** (60pt number or date) + **one-line implication** (16pt) + **source footnote** (12pt gray). Reuse Problem grid math (`col=9.78cm`, x = `1.5 / 12.04 / 22.58`). §赛道 Consumer row 2 must-have; Seed / early A in any vertical benefits when "market window" IS the thesis.

```bash
SLIDE=3
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Why now: three converging triggers" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2.5cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
# Card 1 (x=1.5cm) — trigger / data / implication / source. Repeat at x=12.04cm and x=22.58cm.
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"geometry":"roundRect","fill":"F5F7FA","x":"1.5cm","y":"5cm","width":"9.78cm","height":"10cm"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"BOM cost","x":"1.5cm","y":"5.5cm","width":"9.78cm","height":"1.2cm","font":"Calibri","size":"24","bold":"true","color":"1E2761","align":"center","fill":"none"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"−90%","x":"1.5cm","y":"7cm","width":"9.78cm","height":"3cm","font":"Georgia","size":"60","bold":"true","color":"B85042","align":"center","fill":"none"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Wearable BOM fell 90% since 2021; sub-$40 retail now viable","x":"1.5cm","y":"11cm","width":"9.78cm","height":"2cm","font":"Calibri","size":"16","color":"333333","align":"center","fill":"none"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Source: IDC Wearables Teardown 2025","x":"1.5cm","y":"13.5cm","width":"9.78cm","height":"1cm","font":"Calibri","size":"12","italic":"true","color":"666666","align":"center","fill":"none"}}
]
EOF
# Card 2 pattern: Oura IPO 2024 / +$2.4B valuation / category proven. Card 3: On-device LLM (Llama 3.2) / Q4-24 / privacy moat viable.
```

**QA.** 3 cards, each with a date/year citation in the source footnote, each card ≤ 30 words. `officecli query "$FILE" 'shape:contains("2024")'` + `'shape:contains("2025")'` ≥ 2 combined (timing anchors visible).

### (3) Solution slide — product in one sentence + 3-step "how it works"

**Visual outcome.** 36pt title naming the product pattern (not "Our Solution"). Below: 3 or 4 rounded boxes horizontally at y=7cm with elbow connectors + triangle arrowheads. Each box = one verb (observe / correlate / resolve). Reuse pptx Recipe (c) flowchart — orchestration, not a new primitive.

```bash
# Title — "a product pattern, not a brand slogan".
# Good: "Auto-correlate K8s events across 3 data planes in 90 seconds"
# Bad:  "The future of observability"
SLIDE=4
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop name=SolTitle \
  --prop text="Correlate K8s events across 3 data planes in 90 seconds" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2.2cm \
  --prop font=Georgia --prop size=32 --prop bold=true --prop color=1E2761 --prop fill=none
# 3 boxes across: gap = (33.87 − 3 − 3·7) / 2 = 4.93cm; x = 1.5, 13.43, 25.36
# Connectors + arrowheads: --prop tailEnd=triangle ALWAYS (pptx Known Issues C-P-5..6).
# Full batch block → see pptx v2 §Creating and Editing (c) 4-step flowchart; swap N from 4 boxes to 3.
```

**Product-pattern title rule.** The solution title is a verb + differentiated mechanism + metric. "Observe / Correlate / Resolve" is generic; VCs read it as any APM vendor. "Correlate K8s events across 3 data planes in 90 seconds" is specific; VCs read it as an insight.

**QA.** Count connectors: `officecli query "$FILE" 'connector' --json | jq '.data.results | length'` ≥ (step_count − 1). Every connector must have `tailEnd=triangle` — `view annotated` confirms arrowhead direction. Title must be ≤ 12 words (one breath).

### (4) Market slide — TAM / SAM / SOM nested columns

**Visual outcome.** 36pt title "Market: $X.YB growing Z% CAGR". Below: three horizontal bars (or three stacked nested rectangles), labeled TAM / SAM / SOM with dollar values + growth rate. Bottom footnote cites **top-down vs bottom-up source** — pick one methodology per deck, don't mix.

```bash
# Use a pptx column chart with 3 values. Categories = TAM,SAM,SOM. Source annotation is a separate shape.
SLIDE=5
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="$42B observability market, 18% CAGR" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type chart --prop chartType=bar \
  --prop series1.name="USD (billions)" --prop series1.values="42,8.4,0.62" --prop series1.color=1E2761 \
  --prop categories="TAM,SAM,SOM (5-yr)" \
  --prop x=2cm --prop y=4cm --prop width=22cm --prop height=12cm \
  --prop title='Market sizing — bottom-up by enterprise count × ACV'
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='Source: Gartner 2025 APM Magic Quadrant; SAM = 20% of TAM (K8s-first shops); SOM = 7.4% of SAM over 5 years at 18-24% share.' \
  --prop x=2cm --prop y=16.5cm --prop width=29.87cm --prop height=2cm \
  --prop font=Calibri --prop size=12 --prop italic=true --prop color=666666 --prop fill=none
```

**QA.** Top-down vs bottom-up MUST be declared in the source footnote. A TAM without methodology reads as fabricated.

### (5) Product slide — screenshot + 3 bullets OR 3-card feature grid

**Visual outcome.** Two layout options: (a) hero product screenshot on the left (60% of slide), 3 one-line feature bullets on the right (each ≥ 18pt body, no bullets under bullets). (b) 3 feature cards with one icon / screenshot thumbnail each. Pick (a) for consumer / app products, (b) for B2B / infrastructure.

```bash
# (a) screenshot + bullets — consumer pattern
officecli add "$FILE" "/slide[$SLIDE]" --type picture --prop src=product_hero.png \
  --prop x=1cm --prop y=4cm --prop width=18cm --prop height=13cm
officecli set "$FILE" "/slide[$SLIDE]/picture[1]" --prop alt="Product UI: dashboard with 12 K8s clusters, live correlation graph"
# Right column bullets (each as a separate shape so sizes stay explicit)
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Auto-correlate across 3 data planes" \
  --prop x=20cm --prop y=5cm --prop width=12cm --prop height=1.5cm \
  --prop font=Calibri --prop size=20 --prop bold=true --prop color=1E2761 --prop fill=none
# Repeat for bullets 2 and 3 at y=7.5cm / y=10cm.
```

**QA.** Picture alt text present (`query 'picture:no-alt'` = empty). Bullets each ≥ 18pt. No "Lorem"/"product name here"/`{{...}}` tokens.

### (6) Business model slide — unit econ or revenue model

**Visual outcome.** Decision tree by vertical:

- **SaaS / Enterprise (Series A+)** — 4 KPI callouts: CAC / LTV / Payback / GM (reuse pptx Recipe (e)).
- **Consumer / D2C** — AOV · repeat-purchase rate · contribution margin · blended CAC.
- **Marketplace** — GMV / take-rate / liquidity metric / cohort retention.
- **Bio / Deep tech** — revenue model (license / milestone / royalty split) with assumed ranges.

Title names the dominant metric (e.g. "LTV:CAC 4.7x · 14-month payback · 78% gross margin"), not "Business Model". Full 4-card batch block → see pptx v2 §(e) KPI callouts.

```bash
# SaaS pattern: KPI card values + sub-label + gray VC-floor context under each.
# Card 1 (LTV): big number "$420K", sub "Lifetime value", context "floor: ARPU × GM / churn"
# Card 2 (CAC): big number "$90K",  sub "Acquisition cost", context "fully-loaded S&M spend"
# Card 3 (Payback): big number "14 mo", sub "CAC payback", context "VC floor: < 18 mo"
# Card 4 (GM): big number "78%", sub "Gross margin", context "SaaS floor: 70%+"
# Grid math for 4 cards across: usable = 33.87 − 3 − 3·0.76 = 28.59, col = 7.15cm
# → Full batch template → pptx v2 §(e). Adapt card count 3→4 and card width 9.78cm→7.15cm.
```

**QA.** For Series B+, all four of {CAC, LTV, payback, GM} present: `officecli query "$FILE" 'shape:contains("CAC")'` ≥ 1 AND `shape:contains("LTV")'` ≥ 1 AND `shape:contains("payback")'` ≥ 1 AND `shape:contains("gross margin")'` ≥ 1.

### (7) Traction slide — ARR curve that starts at 0

**Visual outcome.** Line chart taking 60% of slide width; ARR on y-axis **starting at 0** (not at 80% of current value — the VC hockey-stick lie). Right-side commentary card: single giant number (current ARR) + growth rate + 2-3 milestones. If Series B+, second row: cohort retention snippet or logo wall.

```bash
SLIDE=7
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='ARR: $0 → $18M in 24 months' \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type chart --prop chartType=line \
  --prop series1.name=ARR --prop series1.values="0.2,0.6,1.4,3.2,6.1,11.3,15.8,18.0" --prop series1.color=1E2761 \
  --prop categories="Q1-24,Q2-24,Q3-24,Q4-24,Q1-25,Q2-25,Q3-25,Q4-25" \
  --prop x=1.5cm --prop y=4cm --prop width=21cm --prop height=13cm \
  --prop title='Quarterly ARR ($M) — y-axis anchored at 0' \
  --prop axismin=0
# Right callout
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop geometry=roundRect --prop fill=1E2761 --prop line=none \
  --prop x=23.5cm --prop y=4cm --prop width=8.8cm --prop height=13cm
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='$18M' \
  --prop x=23.5cm --prop y=5cm --prop width=8.8cm --prop height=3cm \
  --prop font=Georgia --prop size=64 --prop bold=true --prop color=FFFFFF --prop align=center --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="ARR · +312% YoY · NRR 128%" \
  --prop x=23.5cm --prop y=9cm --prop width=8.8cm --prop height=3cm \
  --prop font=Calibri --prop size=18 --prop color=CADCFC --prop align=center --prop fill=none
```

**`--prop axismin=0` is load-bearing** — without it, pptx auto-scales the y-axis to start near the lowest value. That is the hockey-stick lie. Gate 6 greps this below.

**QA.** ARR curve chart must carry `axismin=0`. `officecli get "$FILE" "/slide[$SLIDE]/chart[1]" --json | jq .format.axisMin` returns `0` (CLI emits camelCase `axisMin` in readback even though input prop is lowercase `axismin`).

### (8) Team slide — avatars + names + prior companies (not just a wall)

**Visual outcome.** 3- or 4-card row across the middle of the slide. Each card: picture (6×6cm) on top; name (20pt bold); role (16pt); **prior company + title** (16pt italic, 1 key line); optional LinkedIn URL footer (12pt). Team slide with just headshots and names reads as amateur.

```bash
SLIDE=11
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Team: 3 prior exits, 42 years combined K8s" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
# Card 1 — CEO
officecli add "$FILE" "/slide[$SLIDE]" --type picture --prop src=alice.jpg \
  --prop x=2cm --prop y=5cm --prop width=6cm --prop height=6cm
officecli set "$FILE" "/slide[$SLIDE]/picture[1]" --prop alt="Alice Chen, CEO — portrait"
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Alice Chen" \
  --prop x=2cm --prop y=11.5cm --prop width=6cm --prop height=1cm \
  --prop font=Georgia --prop size=20 --prop bold=true --prop color=1E2761 --prop align=center --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="CEO" \
  --prop x=2cm --prop y=12.8cm --prop width=6cm --prop height=0.8cm \
  --prop font=Calibri --prop size=16 --prop color=333333 --prop align=center --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="ex-Datadog Director (Series C → IPO); led K8s observability GTM $40M → $200M ARR" \
  --prop x=2cm --prop y=13.8cm --prop width=6cm --prop height=2.5cm \
  --prop font=Calibri --prop size=14 --prop italic=true --prop color=333333 --prop align=center --prop fill=none
# Repeat for Card 2 (CTO, x=10cm) and Card 3 (VP Eng, x=18cm) — 3 cards × 5-6 shapes each.
```

Prior companies carry **credibility density**. VCs read "ex-Datadog Director + led $40M → $200M" in 2 seconds; they read "co-founder, passionate" in 0 seconds (because they skip it). Advisors, if shown, go in a smaller row below with a single logo each.

**Arrangement helper.** 3 cards: `col=9.78cm, x=1.5/12.04/22.58`. 4 cards: `col=7.15cm, x=1.5/9.41/17.32/25.23`. 5 cards: `col=5.85cm, x=1.5/7.75/14.0/20.25/26.5` (0.4cm gap, tighter). 6+ or asymmetric → 2-row grid (3×2 / 3×3); see pptx v2 §(d) grid math.

**QA.** `officecli query "$FILE" 'shape:contains("ex-")'` + `'shape:contains("prior")'` + `'shape:contains("former")'` ≥ 1 per team member. If zero, you have a portfolio, not a team.

### (9) Financials slide — 4-year plan + honest assumptions

**Visual outcome.** Column chart: 4 years × (revenue, gross margin $, EBITDA). Right-side card: 3-bullet assumption panel (ARPU assumption, win-rate assumption, churn assumption). Title names the trajectory ("$18M → $85M by FY29"), not "Financial Projections".

Reuse pptx Recipe (b) chart + commentary. Pitch-specific: ASSUMPTIONS column on the right is **load-bearing** — a 4-year plan without visible assumptions reads as aspirational. VCs will ask what's behind every number anyway; surface it.

Left 2/3 — slide + title + 3-series column chart:

```bash
SLIDE=17
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='$18M → $85M ARR by FY29' \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type chart --prop chartType=column \
  --prop series1.name="Revenue ($M)"  --prop series1.values="18,34,58,85" --prop series1.color=1E2761 \
  --prop series2.name="Gross Margin ($M)" --prop series2.values="14,26,45,68" --prop series2.color=CADCFC \
  --prop series3.name="EBITDA ($M)"   --prop series3.values="-6,-2,8,22" --prop series3.color=B85042 \
  --prop categories="FY26,FY27,FY28,FY29" \
  --prop x=1.5cm --prop y=4cm --prop width=20cm --prop height=13cm \
  --prop title='4-year plan — revenue, GM, EBITDA ($M)'
```

Right 1/3 — assumptions commentary card:

```bash
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop geometry=roundRect --prop fill=F5F7FA --prop line=none \
  --prop x=22.5cm --prop y=4cm --prop width=9.8cm --prop height=13cm
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Key Assumptions" \
  --prop x=23cm --prop y=4.5cm --prop width=8.8cm --prop height=1.2cm \
  --prop font=Georgia --prop size=20 --prop bold=true --prop color=1E2761 --prop fill=none
# 5 assumption bullets as 5 separate paragraph shapes at y=6, 7.5, 9, 10.5, 12cm — size=14, italic=true.
# Keep each bullet ≤ 14 words so 8.8cm width fits without wrap.
```

**Assumptions panel is load-bearing.** A 4-year plan without visible assumptions reads as aspirational. VCs ask what's behind every number anyway — surface the three or four assumptions that drive the curve.

**QA.** `officecli query "$FILE" 'shape:contains("assumption")'` OR `'shape:contains("Assumes")'` ≥ 1. If zero, add the panel.

### (10) The Ask — hero number + 4-bucket Use-of-Funds + runway

**Visual outcome.** Dark fill (match cover). Hero number in the center top: `$35M` at 96pt white. Below, a 4-bucket pie OR a 4-card row listing **Engineering 40% / GTM 35% / G&A 15% / Reserve 10%**. Bottom line: "18-month runway to $40M ARR" (next milestone, not "until next round").

```bash
SLIDE=20
officecli add "$FILE" / --type slide --prop layout=blank --prop background=1E2761
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='$35M Series B' \
  --prop x=2cm --prop y=2cm --prop width=29.87cm --prop height=4cm \
  --prop font=Georgia --prop size=88 --prop bold=true --prop color=FFFFFF --prop align=center --prop fill=none
officecli add "$FILE" "/slide[$SLIDE]" --type chart --prop chartType=pie \
  --prop series1.name="Use of Funds" --prop series1.values="40,35,15,10" \
  --prop categories="Engineering,Go-to-Market,G&A,Reserve" \
  --prop colors="CADCFC,B85042,97BC62,FFFFFF" \
  --prop x=6cm --prop y=7cm --prop width=12cm --prop height=10cm \
  --prop title="Use of Funds — 4 buckets"
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='18 months runway to $40M ARR and Series C' \
  --prop x=2cm --prop y=17cm --prop width=29.87cm --prop height=1.5cm \
  --prop font=Calibri --prop size=22 --prop color=CADCFC --prop align=center --prop fill=none
```

**4-bucket convention.** Engineering / GTM / G&A / Reserve is the canonical breakdown. Typical Series A ranges: Eng 40-50%, GTM 30-40%, G&A 10-15%, Reserve 5-10%. Series B shifts 5-10 points from Eng to GTM.

**QA.** `officecli query "$FILE" 'shape:contains("Use of Funds")'` ≥ 1. Pie chart present on ask slide. Runway + milestone on ask slide.

### (11) Pipeline chart — Bio / Deep Tech must-have

**Visual outcome.** Horizontal swimlane. Left column = candidate name; 4 stage columns to the right (Preclinical / Ph1 / Ph2 / Ph3 for bio — or TRL1-3 / TRL4-6 / TRL7-8 / TRL9 for deep tech). Each row's bar extends to its current stage; darker fill for later stages. NCT / trial-ID footer below. §赛道 row 5 Bio must-have; SaaS / Consumer skip.

Grid math: usable `= 30.87cm`, candidate col `= 7cm`, stage cols `= (30.87 − 7) / 4 = 5.97cm` each, row height `= 2.3cm`. Stage col x: `8.5 / 14.47 / 20.44 / 26.41`.

```bash
SLIDE=6
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Pipeline: 3 candidates across Ph1–Ph3" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
# 4 stage headers + candidate row 1 (HLX-201 at Ph2, bar width = 3·5.97 = 17.91cm) in one batch.
cat <<EOF | officecli batch "$FILE"
[
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Preclinical","x":"8.5cm","y":"4cm","width":"5.97cm","height":"1cm","font":"Calibri","size":"16","bold":"true","color":"333333","align":"center","fill":"F5F7FA"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Phase 1","x":"14.47cm","y":"4cm","width":"5.97cm","height":"1cm","font":"Calibri","size":"16","bold":"true","color":"333333","align":"center","fill":"F5F7FA"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Phase 2","x":"20.44cm","y":"4cm","width":"5.97cm","height":"1cm","font":"Calibri","size":"16","bold":"true","color":"333333","align":"center","fill":"F5F7FA"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"Phase 3","x":"26.41cm","y":"4cm","width":"5.97cm","height":"1cm","font":"Calibri","size":"16","bold":"true","color":"333333","align":"center","fill":"F5F7FA"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"text":"HLX-201 (lead)","x":"1.5cm","y":"5.5cm","width":"7cm","height":"1.5cm","font":"Calibri","size":"18","bold":"true","color":"1E2761","align":"left","fill":"none"}},
  {"command":"add","parent":"/slide[$SLIDE]","type":"shape","props":{"geometry":"roundRect","fill":"1E2761","x":"8.5cm","y":"5.7cm","width":"17.91cm","height":"1.1cm","line":"none"}}
]
EOF
# Repeat rows 2 & 3 at y=7.8cm / y=10.1cm with bar widths per stage (Ph1=5.97cm, Ph1-Ph2=11.94cm, Ph1-Ph3=17.91cm).
# NCT footer full-width at y=16.8cm.
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text='NCT05021323 (HLX-201, Ph2, n=48) · NCT06142091 (HLX-304, Ph1, n=24) · IND-filed Q1-26 for HLX-412' \
  --prop x=1.5cm --prop y=16.8cm --prop width=30.87cm --prop height=1.2cm \
  --prop font=Calibri --prop size=12 --prop italic=true --prop color=666666 --prop fill=none
```

**QA.** `officecli query "$FILE" 'shape:contains("NCT")' --json | jq '.data.results | length'` ≥ 1. Bar colors darken across stages (`CADCFC` preclinical-only, `1E2761` Ph2-reached).

### (12) Competitive comparison table — Series B+ essential

**Visual outcome.** 5–7 rows × 4–6 cols. Column 1 = competitor name (optional logo shape beside); rest = differentiators (speed / price / integrations / margin / coverage). **Last row = your company, fill highlighted** in an accent color (CADCFC / 97BC62); competitor rows gray. Every Series B+ deck needs this (SaaS: Datadog / New Relic / Splunk; Bio: Kite / Novartis / BMS).

```bash
SLIDE=13
officecli add "$FILE" / --type slide --prop layout=blank --prop background=FFFFFF
officecli add "$FILE" "/slide[$SLIDE]" --type shape --prop text="Competitive landscape" \
  --prop x=1.5cm --prop y=1.2cm --prop width=30.87cm --prop height=2cm \
  --prop font=Georgia --prop size=36 --prop bold=true --prop color=1E2761 --prop fill=none
# Inline table via --prop data= (confirmed on v1.0.63; per-cell r#c# rejected). Single-quote the data value — '$15/host' would strip.
officecli add "$FILE" "/slide[$SLIDE]" --type table \
  --prop data='Competitor,Speed,Price,Integrations,Margin;Datadog,12 min,$15/host,680,75%;New Relic,18 min,$25/host,520,68%;Splunk,45 min,$45/GB,310,62%;You (Acme DevOps),90 sec,$8/host,1200,82%' \
  --prop style=medium1 --prop headerFill=1E2761 \
  --prop x=1.5cm --prop y=4cm --prop width=30.87cm --prop height=12cm
# Highlight your row: loop over /slide[$SLIDE]/table[1]/tr[5]/tc[1..5] and set cell fill to CADCFC.
```

**QA.** `officecli query "$FILE" 'table' --json | jq '.data.results | length'` ≥ 1. Row count ≥ 4 (you + ≥ 3 named competitors). Your row visually distinct via cell fill (Gate 5b visual check — table style alone does not highlight one row).

## Numbers convention (pitch-specific)

A terse convention table — **not a finance tutorial**. If you don't already know what these mean, pause the deck and ask the user for the values; don't guess.

| Metric                          | Shape                              | Floor / convention                                                                      |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| **TAM**                         | `$X.YB`, one methodology           | Either top-down (analyst report) or bottom-up (count × ACV). Never both; never neither. |
| **SAM**                         | `$X.YB`, fraction of TAM you serve | Typically 15 – 30% of TAM for verticalized SaaS; higher for horizontal                  |
| **SOM**                         | `$X.YB` at year N                  | Realistic 5-yr share: 5 – 15% of SAM for early stage                                    |
| **ARR**                         | MRR × 12. NOT revenue.             | SaaS only; contracts on books, net of churn                                             |
| **MRR**                         | Monthly recurring                  | ARR / 12; do not confuse with monthly revenue                                           |
| **NRR (Net Revenue Retention)** | %, trailing 12 mo                  | VC floor: > 100% acceptable, > 115% strong, > 130% exceptional                          |
| **CAC**                         | $ fully-loaded                     | Sales + marketing spend / new logos acquired                                            |
| **LTV**                         | $                                  | ARPU × gross margin × (1 / churn rate)                                                  |
| **LTV:CAC**                     | ratio                              | VC floor: 3x OK, > 4x strong, > 5x exceptional                                          |
| **CAC payback**                 | months                             | VC floor: < 18 mo OK, < 12 mo strong                                                    |
| **Gross margin**                | %                                  | SaaS floor 70%, strong 80%+; marketplace 15-40%; hardware 30-50%                        |
| **Burn / runway**               | $/month + months                   | Gross burn vs net burn — label which; runway to specific milestone                      |
| **Use of Funds**                | 4-bucket pie                       | Engineering / Go-to-Market / G&A / Reserve — see Ask slide recipe                       |

**Rule.** Every number on a deck carries a unit. `18%` or `18M` alone is ambiguous — write `$18M ARR` / `18% NRR growth`. `TBD`, `coming soon`, `(fill in)`, `lorem`, `xxxx` in numeric slots = immediate VC disqualification. Gate 6 greps these below.

## VC ship-check (6 red flags / positive signals)

What the VC reads in the first 30 seconds. Six one-line conditions — every "FAIL" below is an instant round-killer; fix before delivering.

| #   | Red flag (FAIL if present)                                   | Positive signal (shipwise)                                                      |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | Cover without round + amount + date                          | `Company · tagline · Series X · $YM · Date` in 4 lines                          |
| 2   | TAM > $100B without a cited source / methodology             | TAM clearly labeled bottom-up OR top-down with a visible 2024+ source           |
| 3   | Traction chart y-axis does not start at 0 (hockey-stick lie) | Line chart `axismin=0`; growth shape honest                                     |
| 4   | Team slide: headshots + names only, no prior companies       | Every member: prior company + role + 1 achievement metric                       |
| 5   | Ask slide missing Use-of-Funds breakdown                     | `$XM` hero + 4-bucket pie (Eng / GTM / G&A / Reserve) + runway + next milestone |
| 6   | `TBD` / `lorem` / `xxxx` / `{{...}}` / `(fill in)` anywhere  | `view text` clean — zero placeholder tokens                                     |

**Common Series-specific failures.**

- **Series A specific** — bottom-up TAM calculated from a fictional enterprise-count × ACV (no reference customers to anchor the count); `CAC / LTV` shown with < 12 months of data (statistically meaningless).
- **Series B specific** — no unit-econ slide at all; CAC payback > 24 months without a "we're pre-scale, here's the plan" narrative; logo wall < 8 customers.
- **Series C specific** — no moat / defensibility slide; revenue growth shown without margin trajectory; international expansion stated but no specific launch plan / hires.

The Delivery Gate 6 block below executes checks 1–6 above via grep + query. Gate 5b fresh-eyes covers the visual judgments (hockey stick, team credibility) that grep can't see.

## Traction triple-pattern (ARR + milestones + logos)

For Series B+, traction often spans 2 slides: one for the chart + callout (recipe 7 above), one for **milestone timeline + logo wall**. Timeline = 4-6 horizontal dates with one-line events. Logo wall = 12-20 customer logos in a 4×N or 5×N grid, muted monochrome so no single brand dominates.

```bash
# Milestone timeline: 5 dates as circles on a horizontal line at y=8cm.
# Use pptx shapes (ellipse preset) + connectors (shape=straight) between them.
# Each milestone = ellipse at y=8cm + date label above + event description below.
# → See pptx v2 Recipe (d) row 9 (Roadmap timeline) for the canonical pattern.

# Logo wall: pictures in a 5×N grid. Typical spacing: logo width = 5cm, height = 2cm, gap = 0.4cm.
# grid math for 5 logos across, 1.5cm edge margin: usable = 33.87 − 3 − 4·0.4 = 29.27, col = 5.85cm
# (use 5cm logo width centered in each 5.85cm column)
```

**QA.** Logo wall should have ≥ 8 logos for Series B+, ≥ 4 for Series A. Fewer = "lighter than it looks"; more than 20 = pixel noise.

## QA — Delivery Gate (executable)

**Assume there are problems.** First render is almost never correct. Pitch decks fail at two layers: **structural** (schema, token leaks — caught by pptx v2 Gates 1–3) and **narrative** (wrong stage, missing unit econ, TAM unsourced — the checks that make pptx v2 Gate 5b + Gate 6 indispensable). Every check must print its success message.

### Gates 1–5a — inherited from pptx v2 verbatim

→ see pptx v2 §Delivery Gate L637-679. Copy-paste the full block:

- **Gate 1** — `validate` schema check (whitelist `ChartShapeProperties` warnings per C-P-2).
- **Gate 2** — token leak via `view text` grep (`$xxx$`, `{{...}}`, `<TODO>`, `lorem`, `xxxx`, empty `()`/`[]`, `\$`/`\t`/`\n` literals).
- **Gate 3** — hyperlink `rPr` schema trap (C-P-1) — zero `<a:rPr><a:hlinkClick>`.
- **Gate 4** — slide-order sanity — cover first, dividers before sections, closing last.
- **Gate 5a** — dark-on-dark contrast — every fill in `{1E2761, 0A1628, 8B1A1A, 2C5F2D, 36454F}` must declare near-white textColor. **This includes charts rendered on that fill**: chart `title.textColor`, `legend.textColor`, axis text default to dark and read as invisible on dark backgrounds — set them explicitly, or place the chart on a light card inside the dark slide.

Do not skip or reorder these five. Every pptx-layer defect caught by Gates 1–5a also fires on pitch decks.

**Gate 2b — pitch-specific shell-strip signatures (MANDATORY).** Gate 2 misses `$35M` that zsh silently stripped to empty (no residue to grep). Run this after Gate 2:

```bash
# $XXM stripped by zsh leaves bare " M ARR" / " M raised" / "Series [A-C] · M" patterns.
STRIP=$(officecli view "$FILE" text | grep -niE '(^|[^A-Za-z0-9])M (ARR|raised|Series|runway|round|raise)|Series [A-C] · M( |$)|runway · M|raised · M|raising ·? M')
[ -z "$STRIP" ] && echo "Gate 2b OK (no \$-strip signatures)" || { echo "REJECT Gate 2b (likely zsh \$-strip — re-issue with single quotes):"; echo "$STRIP"; exit 1; }
```

Fix: re-issue the offending `add`/`set` with single quotes around the text value (`--prop text='Series B · $35M'`, not double quotes). The same strip hits **chart series names / axis titles** (`--prop name="营收 ($M)"` → legend shows `营收 ()`): single-quote every chart prop carrying `$`.

### Gate 5b — Visual audit via HTML preview (MANDATORY, NOT optional)

Gates 1–5a are token-grep defenses. **They cannot see a rendered slide.** This step is the only visual-assembly check. Do not skip.

Run `officecli view "$FILE" html` and Read the returned HTML. Walk every slide and answer, for EACH (inherits pptx v2 Gate 5b checklist; pitch-specific additions marked ⭐):

- **overlap**: do any text shapes overlap each other or a chart?
- **dark-on-dark**: is any text on a fill where fill brightness < 30% AND text brightness < 80%?
- **divider overlap**: any giant decorative number (01/02/03 at 100pt+) colliding with the divider title text?
- **order sanity**: does the slide sequence match your stage-appropriate narrative outline?
- **missing arrowheads**: do flowchart/decision-tree connectors show direction, or plain lines?
- ⭐ **traction y-axis**: does every ARR / revenue / growth line chart start at 0 on the y-axis? (Not 80% of current — that is the hockey-stick lie.)
- ⭐ **team credibility**: does every team-slide card show a prior company or prior title? (Cards with just headshot + name = reject.)
- ⭐ **TAM / market number credibility**: is the TAM under $100B for a niche market, or if ≥ $100B, is a methodology source cited? (A claimed `$500B TAM` with no source is an auto-reject red flag.)
- ⭐ **Use-of-Funds pie**: does the ask slide carry a 4-bucket pie (Engineering / GTM / G&A / Reserve) or a 4-card row with %s?
- ⭐ **narrative completeness**: is the order cover → problem → solution → market → product → model → traction → team → financials → ask, or your stage-appropriate permutation from §Stage diagnosis?

**Instruction.** Run `officecli view "$FILE" html` and Read the HTML. Walk every slide against the questions below. If rendering chart colors, animations, or zoom — those only show in the target viewer (PowerPoint / Keynote / WPS); ask the user to open `.pptx` directly for those runtime features.

> For every slide:
> (a) Are slides in VC narrative order (cover → problem → solution → market → product → model → traction → team → financials → ask, with your stage's adjustments)? Flag any out-of-sequence.
> (b) Is every ARR / revenue / growth line chart y-axis anchored at 0? Flag hockey-stick visual lies.
> (c) Does the team slide carry prior-company credentials for each person? (Not just headshot + name.)
> (d) Does every TAM / SAM / SOM claim have a visible source or methodology?
> (e) Does the ask slide have a 4-bucket Use of Funds (Engineering / GTM / G&A / Reserve) and a specific next milestone + runway length?
> (f) Any text overlap, dark-on-dark, off-slide geometry, missing arrowheads, placeholder tokens (`TBD` / `lorem` / `{{...}}` / `xxxx` / empty `()`)?

Report every instance with slide number. If ANY defect — REJECT; do not deliver until fixed.

**Human preview (optional).** If you want the user to visually preview the deck, run `officecli watch "$FILE"` for a live preview the user can open at their own discretion, or have them open the `.pptx` directly in PowerPoint / WPS / Keynote. For final visual verification, open the file in the target presentation viewer.

### Gate 6 — Pitch narrative sanity (executable)

Pitch-specific checks that grep the deck for VC red flags. Every one is a token check — combine with Gate 5b's human read for full coverage.

```bash
FILE="deck.pptx"

# 6.1 — no TBD / lorem / placeholder tokens (stronger than Gate 2 — pitch-specific scope)
LEAK=$(officecli view "$FILE" text | grep -niE 'TBD|lorem|\(fill in\)|xxxx|coming soon|placeholder')
[ -z "$LEAK" ] && echo "Gate 6.1 OK (no placeholder tokens)" || { echo "REJECT Gate 6.1:"; echo "$LEAK"; exit 1; }

# 6.2 — TAM / SAM / SOM presence (Series A+)
TAM_HIT=$(officecli query "$FILE" 'shape:contains("TAM")' --json | jq '.data.results | length')
[ "$TAM_HIT" -ge 1 ] && echo "Gate 6.2 OK (TAM slide present)" || echo "WARN Gate 6.2: no TAM mention — confirm stage is Seed / Bridge if intentional"

# 6.3 — Unit econ presence (Series B+): CAC OR LTV OR payback
CAC_HIT=$(officecli query "$FILE" 'shape:contains("CAC")' --json | jq '.data.results | length')
LTV_HIT=$(officecli query "$FILE" 'shape:contains("LTV")' --json | jq '.data.results | length')
if [ "$CAC_HIT" -ge 1 ] || [ "$LTV_HIT" -ge 1 ]; then
  echo "Gate 6.3 OK (unit econ surface)"
else
  echo "WARN Gate 6.3: no CAC / LTV — confirm stage Seed/A if intentional, REJECT if Series B+"
fi

# 6.4 — Use of Funds present on ask slide
UOF_HIT=$(officecli query "$FILE" 'shape:contains("Use of Funds")' --json | jq '.data.results | length')
[ "$UOF_HIT" -ge 1 ] && echo "Gate 6.4 OK (Use of Funds)" || { echo "REJECT Gate 6.4: ask slide missing Use of Funds"; exit 1; }

# 6.5 — Team prior-company signal (at least one of ex- / former / prior / previously)
PRIOR_HIT=$(officecli view "$FILE" text | grep -ciE '\b(ex-|former|prior|previously)\b')
[ "$PRIOR_HIT" -ge 1 ] && echo "Gate 6.5 OK (team prior-company)" || { echo "REJECT Gate 6.5: team slide has no prior-company credentials"; exit 1; }

# 6.6 — Traction chart y-axis anchored at 0 (at least one chart must set axismin=0, Series A+)
AXISMIN_HIT=$(officecli query "$FILE" 'chart' --json | jq '[.data.results[]? | select(.format.axisMin == "0" or .format.axisMin == 0 or .format.axismin == "0" or .format.axismin == 0)] | length')
[ "$AXISMIN_HIT" -ge 1 ] && echo "Gate 6.6 OK (traction chart axisMin=0)" || echo "WARN Gate 6.6: no chart sets axisMin=0 — confirm no ARR/revenue line chart, or add --prop axismin=0"

echo "Delivery Gate 6 PASS (token + narrative checks) — proceed to Gate 5b fresh-eyes (MANDATORY)"
```

**Readback key note.** CLI accepts lowercase `axismin` as input (on `--prop axismin=0`) but emits camelCase `axisMin` in `query --json` on v1.0.63. The jq above accepts both for forward-compat.

Gate 6 is a grep floor. Gate 5b is the visual ceiling. Ship only when both print PASS.

### Honest limit

`validate` catches schema errors, not fundraising errors. A deck passes `validate` with a `$500B TAM` on a $10M market, a team slide of four co-founders with no prior companies, a hockey stick y-axis at 80%, a pitch for a Series B round without unit econ, and an ask slide saying "we're raising some money". Gates 5b + 6 above exist because `validate` cannot catch any of this.

## Known Issues & Pitfalls

→ Base pitfalls (shell escape, `[last()]` in resident, connector `@name=` rejection C-P-6, picture alt two-step C-P-7, animation remove C-P-4, chart color normalization C-P-7): see pptx v2 §Known Issues & Pitfalls C-P-1..7.

Pitch-specific:

- **Stage misidentified.** Series A deck with 6 pages of CAC/LTV math = over-packaged. Series B deck missing unit econ = incomplete. If unsure, re-read §Stage diagnosis before building.
- **Hockey-stick y-axis.** If the line chart's y-axis doesn't start at 0, VCs read it as a visual lie within 2 seconds. Always `--prop axismin=0` on ARR / revenue / growth charts. Gate 6.6 checks this.
- **Team slide = portfolio.** Cards showing only {headshot + name + role} fail VC credibility. Every card needs a prior-company or prior-achievement line. Gate 6.5 checks this.
- **TAM without methodology.** A claimed number with no "top-down" or "bottom-up" source footnote = fabricated. Pick one methodology per deck; don't mix.
- **Use-of-Funds as 3-bucket or 5-bucket.** 4-bucket (Eng / GTM / G&A / Reserve) is convention; departing from it reads as sloppy. Gate 6.4 checks presence.
- **Pitch deck used for a board review / sales deck.** Narrative arc (problem → ask) makes board reviews awkward — route to pptx v2 Recipe (d) 10-slide instead. See §Reverse handoff above.
- **pptx v2 Recipe (d′) 20-slide is a starting point, not a formula.** It is stage-agnostic SaaS. Adjust for your stage + 赛道 via §Stage diagnosis and §赛道 arc templates — never ship (d′) unchanged for a non-SaaS Series A.

## Help pointer

When in doubt: `officecli help pptx`, `officecli help pptx <element>`, `officecli help pptx <element> --json`. Help is the authoritative schema; this skill is the decision guide for fundraising deltas on top of pptx v2.

```

### A4. _builtin/office-cli/SKILL.md (verbatim)

```markdown
---
name: officecli
description: Create, analyze, proofread, and modify Office documents (.docx, .xlsx, .pptx) using the officecli CLI tool. Use when the user wants to create, inspect, check formatting, find issues, add charts, or modify Office documents.
---

# officecli

AI-friendly CLI for .docx, .xlsx, .pptx. Single binary, no dependencies, no Office installation needed.

## Install

If `officecli` is not installed:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash

# Windows (PowerShell)
irm https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.ps1 | iex
```

Verify with `officecli --version`. If still not found after install, open a new terminal.

---

## Strategy

**L1 (read) → L2 (DOM edit) → L3 (raw XML)**. Always prefer higher layers. Add `--json` for structured output.

**Before doc work, check Specialized Skills** (bottom of this file). Fundraising decks, academic papers, financial models, dashboards, and Morph animations need their own skill loaded first — `load_skill` once, then proceed.

---

## Help System (IMPORTANT)

**When unsure about property names, value formats, or command syntax, ALWAYS run help instead of guessing.** One help query beats guess-fail-retry loops.

`officecli help` ≡ `officecli --help`, and `officecli <cmd> --help` ≡ `officecli help <cmd>` — same content.

```bash
officecli help                                  # All commands + global options + schema entry points
officecli help docx                             # List all docx elements
officecli help docx paragraph                   # Full schema: properties, aliases, examples, readbacks
officecli help docx set paragraph               # Verb-filtered: only props usable with `set`
officecli help docx paragraph --json            # Structured schema (machine-readable)
```

Format aliases: `word`→`docx`, `excel`→`xlsx`, `ppt`/`powerpoint`→`pptx`. Verbs: `add`, `set`, `get`, `query`, `remove`. MCP exposes the same schema via `{"command":"help","format":"docx","type":"paragraph"}`.

---

## Performance: Resident Mode

**Every command auto-starts a resident on first access** (60s idle timeout) — file-lock conflicts are automatically avoided. Explicit `open`/`close` is still recommended for longer sessions (12min idle):

```bash
officecli open report.docx       # explicitly keep in memory
officecli set report.docx ...    # no file I/O overhead
officecli close report.docx      # save and release
```

Opt out of auto-start: `OFFICECLI_NO_AUTO_RESIDENT=1`.

---

## Quick Start

**PPT:**

```bash
officecli create slides.pptx
officecli add slides.pptx / --type slide --prop title="Q4 Report" --prop background=1A1A2E
officecli add slides.pptx '/slide[1]' --type shape --prop text="Revenue grew 25%" --prop x=2cm --prop y=5cm --prop font=Arial --prop size=24 --prop color=FFFFFF
```

**Word:**

```bash
officecli create report.docx
officecli add report.docx /body --type paragraph --prop text="Executive Summary" --prop style=Heading1
officecli add report.docx /body --type paragraph --prop text="Revenue increased by 25% year-over-year."
```

**Excel:**

```bash
officecli create data.xlsx
officecli set data.xlsx /Sheet1/A1 --prop value="Name" --prop bold=true
officecli set data.xlsx /Sheet1/A2 --prop value="Alice"
```

---

## L1: Create, Read & Inspect

```bash
officecli create <file>               # Create blank .docx/.xlsx/.pptx (type from extension)
officecli view <file> <mode>          # outline | stats | issues | text | annotated | html
officecli get <file> <path> --depth N # Get a node and its children [--json]
officecli query <file> <selector>     # CSS-like query
officecli validate <file>             # Validate against OpenXML schema
```

### view modes

| Mode        | Description                                                       | Useful flags                                               |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `outline`   | Document structure                                                |                                                            |
| `stats`     | Statistics (pages, words, shapes)                                 |                                                            |
| `issues`    | Formatting/content/structure problems                             | `--type format\|content\|structure`, `--limit N`           |
| `text`      | Plain text extraction                                             | `--start N --end N`, `--max-lines N`                       |
| `annotated` | Text with formatting annotations                                  |                                                            |
| `html`      | Static HTML snapshot — same renderer as `watch`, no server needed | `--browser`, `--page N` (docx), `--start N --end N` (pptx) |

Use `view html` for one-shot snapshots (CI artifacts, archival, diffing); use `watch` when you need live refresh or browser-side click-to-select.

### get

Any XML path via element localName. Use `--depth N` to expand children. Add `--json` for structured output. Default text output is grep-friendly: `path (type) "text" key=val key=val ...`

```bash
officecli get report.docx '/body/p[3]' --depth 2 --json
officecli get slides.pptx '/slide[1]' --depth 1          # list all shapes on slide 1
officecli get data.xlsx '/Sheet1/B2' --json
```

### Stable ID Addressing

Elements with stable IDs return `@attr=value` paths instead of positional indices. Prefer these in multi-step workflows — positional indices shift on insert/delete, stable IDs do not.

```
/slide[1]/shape[@id=550950021]                    # PPT shape
/slide[1]/table[@id=1388430425]/tr[1]/tc[2]       # PPT table
/body/p[@paraId=1A2B3C4D]                         # Word paragraph
/comments/comment[@commentId=1]                    # Word comment
```

PPT also accepts `@name=` (e.g. `shape[@name=Title 1]`), with morph `!!` prefix awareness. Elements without stable IDs (slide, run, tr/tc, row) fall back to positional indices.

### query

CSS-like selectors: `[attr=value]`, `[attr!=value]`, `[attr~=text]`, `[attr>=value]`, `[attr<=value]`, `:contains("text")`, `:empty`, `:has(formula)`, `:no-alt`.

```bash
officecli query report.docx 'paragraph[style=Normal] > run[font!=Arial]'
officecli query slides.pptx 'shape[fill=FF0000]'
```

For large documents, use `--max-lines` to limit output.

---

## Watch & Interactive Selection

Live HTML preview that auto-refreshes on every file change. Browsers can click / shift-click / box-drag to select shapes; the CLI can read the current browser selection and act on it.

```bash
officecli watch <file> [--port N]      # Start preview server (default port 18080)
officecli unwatch <file>               # Stop
officecli goto <file> <path>           # Scroll watching browser(s) to element (docx: p / table / tr / tc)
```

Open the printed `http://localhost:N` URL. Click to select; shift/cmd/ctrl+click to multi-select; drag from empty space to box-select. PPT/Word use blue outline; Excel uses native-style green selection (double-click cell to edit inline; drag a chart to reposition).

### `get <file> selected` — read what the user clicked

```bash
officecli get <file> selected [--json]
```

Returns DocumentNodes for whatever is currently selected. Empty result if nothing selected. Exit code != 0 if no watch is running.

```bash
# User clicks shapes in the browser, then asks "make these red"
PATHS=$(officecli get deck.pptx selected --json | jq -r '.data.Results[].path')
for p in $PATHS; do officecli set deck.pptx "$p" --prop fill=FF0000; done
```

### Key properties

- **Selection survives file edits.** Paths use stable `@id=` form.
- **All connected browsers share one selection.** Last-write-wins.
- **Same-file single-watch.** A given file can have only one watch process at a time.
- **Group shapes select as a whole.** Drilling into individual children of a group is not supported in v1.
- **Coverage:** `.pptx` shapes/pictures/tables/charts/connectors/groups; `.docx` top-level paragraphs and tables. Inherited layout/master decorations and Word nested elements (table cells, run-level) are not addressable. **`.xlsx` does not emit `data-path`** — `mark`/`selection` on xlsx always resolve `stale=true` (v2 candidate).

### Marks — edit proposals waiting for review

Use `mark` when changes need human review BEFORE they hit the file. Marks live in the watch process only; a separate `set` pipeline applies accepted ones. For one-shot changes use `set` directly; for permanent file annotations use `add --type comment` (Word native).

```bash
officecli mark <file> <path> [--prop find=... color=... note=... tofix=... regex=true] [--json]
officecli unmark <file> [--path <p> | --all] [--json]
officecli get-marks <file> [--json]
```

Props: `find` (literal or regex when `regex=true`; raw form `find='r"[abc]"'`), `color` (hex / `rgb(...)` / 22 named whitelist), `note`, `tofix` (drives apply pipeline). **Path** must be `data-path` format from watch HTML — see subskills for full pipeline.

---

## L2: DOM Operations

### set — modify properties

```bash
officecli set <file> <path> --prop key=value [--prop ...]
```

**Any XML attribute is settable** via element path (found via `get --depth N`) — even attributes not currently present. Without `find=`, `set` applies format to the entire element.

**Value formats:**

| Type       | Format                                    | Examples                                                         |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Colors     | Hex (with/without `#`), named, RGB, theme | `FF0000`, `#FF0000`, `red`, `rgb(255,0,0)`, `accent1`..`accent6` |
| Spacing    | Unit-qualified                            | `12pt`, `0.5cm`, `1.5x`, `150%`                                  |
| Dimensions | EMU or suffixed                           | `914400`, `2.54cm`, `1in`, `72pt`, `96px`                        |

**Dotted-attr aliases** — `font.<attr>` forms accepted on shape/run/paragraph/table/row/cell/section/styles, e.g. `--prop font.color=red --prop font.bold=true --prop font.size=14pt`. Run `officecli help <fmt> <element>` for the full list.

### find — format or replace matched text

Use `find=` with `set` to target specific text for formatting or replacement. Format props are separate `--prop` flags — do NOT nest them.

```bash
# Format matched text (auto-splits runs)
officecli set doc.docx '/body/p[1]' --prop find=weather --prop bold=true --prop color=red

# Regex matching
officecli set doc.docx '/body/p[1]' --prop 'find=\d+%' --prop regex=true --prop color=red

# Replace text (use `/` for whole-document scope)
officecli set doc.docx / --prop find=draft --prop replace=final

# PPT — same syntax, different paths
officecli set slides.pptx / --prop find=draft --prop replace=final
```

**Path controls search scope:** `/` = whole document, `/body/p[1]` or `/slide[N]/shape[M]` = specific element, `/header[1]` / `/footer[1]` = headers/footers.

**Notes:**

- Case-sensitive by default. Case-insensitive: `--prop 'find=(?i)error' --prop regex=true`
- Matches work across run boundaries
- No match = silent success. `--json` includes `"matched": N`
- **Excel:** only `find` + `replace` supported (no find + format props)

### add — add elements or clone

```bash
officecli add <file> <parent> --type <type> [--prop ...]
officecli add <file> <parent> --type <type> --after <path> [--prop ...]   # insert after anchor
officecli add <file> <parent> --type <type> --before <path> [--prop ...]  # insert before anchor
officecli add <file> <parent> --type <type> --index N [--prop ...]        # 0-based position (legacy)
officecli add <file> <parent> --from <path>                               # clone existing element
```

`--after`, `--before`, `--index` are mutually exclusive. No position flag = append to end.

**Element types (with aliases):**

| Format   | Types                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pptx** | slide (incl. hidden), shape (textbox — font.latin/ea/cs, direction=rtl), picture (SVG, brightness/contrast/glow/shadow), chart (direction=rtl), table (cell direction=rtl), row (tr), connector (connection/line), group, video (audio/media, trim), equation (formula/math), notes (direction=rtl, lang), comment (RTL via U+200F bidi mark; full CRUD via /slide[N]/comment[M]), paragraph (para), run, zoom (slidezoom), ole (oleobject/object/embed), placeholder (phType=title/body/subtitle/footer/...). slideLayout/slideMaster direction inheritance.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **docx** | paragraph (para — direction/font.latin/ea/cs, bold.cs/italic.cs/size.cs for RTL/CJK; lang.latin/ea/cs BCP-47 tags on run; wordWrap toggle), run, table (direction=rtl → bidiVisual), row (tr), cell (td), image (picture/img — SVG supported), header (direction), footer (direction), section (pageNumFmt full ECMA-376 enum incl. Hindi/Arabic/Thai/CJK numerals; direction=rtl on Add/Set; rtlGutter; pgBorders=box shorthand), bookmark, comment, footnote, endnote, formfield (text/checkbox/dropdown), sdt (contentcontrol), chart, equation, field (28 types incl. mergefield/ref/seq/styleref/docproperty/if), hyperlink, style (direction round-trip), toc, watermark, break (pagebreak/columnbreak), ole, **num / abstractNum / lvl** (numbering/list system), **tab** (paragraph or paragraph/table style tab stops). docDefaults.rtl document-wide override; `get /` exposes `locale`. Document protection: `set / --prop protection=forms\|readOnly\|comments\|trackedChanges\|none` |
| **xlsx** | sheet (visible/hidden/veryHidden, print margins, printTitleRows/Cols, rightToLeft sheetView, cascade-aware rename), row, cell (type=richtext+runs, merge=range/sweep, direction=rtl, phonetic guide on add), chart (direction=rtl on per-axis txPr / title; incl. pareto), image (picture — SVG), comment (direction=rtl), table (listobject), namedrange (definedname, volatile, `[@name=X]` selector), pivottable (pivot, calculatedField), sparkline, validation (datavalidation), autofilter, shape, textbox, databar/colorscale/iconset/formulacf/cellIs/topN/aboveAverage (conditional formatting), ole, csv (tsv). Query supports `merge`/`mergedrange` aliases for `mergeCell`. Workbook: password. `value="=SUM(...)"` auto-detects as formula. Chart/picture/shape/slicer accept `anchor=A1:E10`.                                                                                                                                                                                       |

### Pivot tables (xlsx)

```bash
officecli add data.xlsx /Sheet1 --type pivottable \
  --prop source="Sheet1!A1:E100" --prop rows=Region,Category \
  --prop cols=Year --prop values="Sales:sum,Qty:count" \
  --prop grandTotals=rows --prop subtotals=off --prop sort=asc
```

Key props: `rows`, `cols`, `values` (Field:func[:showDataAs]), `filters`, `source`, `position`, `layout` (compact/outline/tabular), `repeatLabels`, `blankRows`, `aggregate`, `showDataAs` (percent_of_total/row/col, running_total), `grandTotals`, `subtotals`, `sort`. Aggregators: sum, count, average, max, min, product, stdDev, stdDevp, var, varp, countNums. Date columns auto-group. Run `officecli help xlsx pivottable` for full schema.

### Document-level properties (all formats)

```bash
officecli set doc.docx / --prop docDefaults.font=Arial --prop docDefaults.fontSize=11pt
officecli set doc.docx / --prop protection=forms --prop evenAndOddHeaders=true
officecli set data.xlsx / --prop calc.mode=manual --prop calc.refMode=r1c1
officecli set slides.pptx / --prop defaultFont=Arial --prop show.loop=true --prop print.what=handouts
```

Run `officecli help <format> /` for all document-level properties (docDefaults, docGrid, CJK spacing, calc, print, show, theme, extended).

### Sort (xlsx)

```bash
officecli set data.xlsx /Sheet1 --prop sort="C desc" --prop sortHeader=true
officecli set data.xlsx '/Sheet1/A1:D100' --prop sort="A asc" --prop sortHeader=true
```

Format: `COL DIR[, COL DIR ...]`. Rejects ranges with merged cells or formulas. Sidecar metadata (hyperlinks, comments, conditional formatting, drawings) follows rows automatically.

### Text-anchored insert (`--after find:X` / `--before find:X`)

Locate an insertion point by text match within a paragraph. Inline types (run, picture, hyperlink) insert within the paragraph; block types (table, paragraph) auto-split it. PPT only supports inline.

```bash
# Word: inline run after matched text
officecli add doc.docx '/body/p[1]' --type run --after find:weather --prop text=" (sunny)"

# Word: block table after matched text (auto-splits paragraph)
officecli add doc.docx '/body/p[1]' --type table --after "find:First sentence." --prop rows=2 --prop cols=2
```

### Clone

`officecli add <file> / --from '/slide[1]'` — copies with all cross-part relationships.

### move, swap, remove

```bash
officecli move <file> <path> [--to <parent>] [--index N] [--after <path>] [--before <path>]
officecli swap <file> <path1> <path2>
officecli remove <file> '/body/p[4]'
```

When using `--after` or `--before`, `--to` can be omitted — the target container is inferred from the anchor.

### batch — multiple operations in one save cycle

Stops on first error by default. Use `--force` to continue.

```bash
echo '[
  {"command":"set","path":"/Sheet1/A1","props":{"value":"Name","bold":"true"}},
  {"command":"set","path":"/Sheet1/B1","props":{"value":"Score","bold":"true"}}
]' | officecli batch data.xlsx --json

officecli batch data.xlsx --commands '[{"op":"set","path":"/Sheet1/A1","props":{"value":"Done"}}]' --json
officecli batch data.xlsx --input updates.json --force --json
```

Supports: `add`, `set`, `get`, `query`, `remove`, `move`, `swap`, `view`, `raw`, `raw-set`, `validate`. Fields: `command` (or `op`), `path`, `parent`, `type`, `from`, `to`, `index`, `after`, `before`, `props`, `selector`, `mode`, `depth`, `part`, `xpath`, `action`, `xml`.

---

## L3: Raw XML

Use when L2 cannot express what you need. No xmlns declarations needed — prefixes auto-registered.

```bash
officecli raw <file> <part>                          # view raw XML
officecli raw-set <file> <part> --xpath "..." --action replace --xml '<w:p>...</w:p>'
officecli add-part <file> <parent>                   # create new document part (returns rId)
```

`raw-set` actions: `append`, `prepend`, `insertbefore`, `insertafter`, `replace`, `remove`, `setattr`. Run `officecli help <format> raw` for available parts.

---

## Common Pitfalls

| Pitfall                          | Correct Approach                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `--name "foo"`                   | Use `--prop name="foo"` — all attributes go through `--prop`                                 |
| Unquoted `[N]` paths in zsh/bash | Always quote: `'/slide[1]'` or `"/slide[1]"` (shell glob-expands brackets)                   |
| PPT `shape[1]` for content       | `shape[1]` is typically the title placeholder. Use `shape[2]+` for content shapes            |
| `/shape[myname]`                 | Name indexing not supported. Use numeric index or `@name=` (PPT only)                        |
| Guessing property names          | Run `officecli help <format> <element>` to see exact names                                   |
| Modifying an open file           | Close the file in PowerPoint/WPS first                                                       |
| `\n` in shell strings            | Use `\\n` for newlines in `--prop text="..."`                                                |
| `$` in shell text                | `--prop text="$15M"` strips `$15`. Use single quotes: `--prop text='$15M'`, or heredoc batch |

---

## Specialized Skills

`officecli load_skill <name>` — output is a SKILL.md, follow its rules.

**Loading rule**:

- Pick the most specific match in "When to use"; if none fits, load the format default (`word` / `pptx` / `excel`).
- Scenes already contain the format default's rules — load **one** skill per artifact, never stack.
- Loaded rules persist across turns; don't re-load each reply.
- Two distinct artifacts → two separate loads.

### Word (.docx)

| Name             | When to use                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `word`           | Reports, letters, memos, proposals, generic documents                                                                                                                                                            |
| `academic-paper` | Journal / conference / thesis: APA / Chicago / IEEE / MLA citations, equations, SEQ + PAGEREF cross-refs, multi-column journal layout, bibliography. NOT for business reports or letters (route those to `word`) |

### PowerPoint (.pptx)

| Name           | When to use                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pptx`         | Generic decks: board reviews, sales decks, all-hands, product launches                                                                         |
| `pitch-deck`   | **Fundraising only** — seed / Series A-C / SAFE / convertible / strategic raise. NOT for sales / product / board decks (route those to `pptx`) |
| `morph-ppt`    | Cinematic Morph-animated presentations. NOT for static decks (route those to `pptx`)                                                           |
| `morph-ppt-3d` | 3D Morph: GLB models, camera moves, depth. NOT for 2D-only Morph (route those to `morph-ppt`)                                                  |

### Excel (.xlsx)

| Name              | When to use                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `excel`           | Generic workbooks, formulas, pivots, trackers                                                                                            |
| `financial-model` | Financial models, scenarios, projections. NOT for general data analysis (route those to `excel`)                                         |
| `data-dashboard`  | CSV/tabular data → KPI / analytics / executive dashboards with charts and sparklines. NOT for raw data tracking (route those to `excel`) |

Example: a fundraising deck task → `officecli load_skill pitch-deck` → use the printed rules.

---

## Notes

- Paths are **1-based** (XPath convention): `'/body/p[3]'` = third paragraph
- `--index` is **0-based** (array convention): `--index 0` = first position
- After modifications, verify with `validate` and/or `view issues`
- **When unsure**, run `officecli help <format> <element>` instead of guessing

```
