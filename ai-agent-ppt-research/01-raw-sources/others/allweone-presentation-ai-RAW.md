# allweonedev/presentation-ai — RAW captured sources

> Captured via WebFetch on 2026-05-20. Repo: https://github.com/allweonedev/presentation-ai
> License: MIT. Positioned as an open-source Gamma.app alternative.
> Stars: ~2.8k / Forks: ~491 at snapshot.

---

## 1. README highlights (from main/README.md)

**Positioning**: "ALLWEONE AI Presentation Generator — open-source, AI-powered presentation generator. Create beautiful, customizable slides in minutes." Part of the broader ALLWEONE AI platform; explicit comparison to Gamma.app.

**Feature list (verbatim where possible):**

Content / workflow:
- "AI-Powered Content Generation": full deck from a single topic prompt.
- "Outline-First Workflow": generate outline first, review, then turn into slides.
- "Editable Outlines": review and modify AI-generated outlines before finalizing.
- "Blank Presentations": start from scratch without AI.
- "Real-Time Generation": watch presentation build live.
- "Auto-Save": automatic saving during edits.
- Configurable: text model, slide count, language, web search toggle.

Design / presentation tools:
- "Multiple Themes": 38 built-in themes out-of-the-box.
- "Custom Theme Creation": create, save, reuse personalised themes.
- "PPTX Theme Import": import theme inspiration directly from PowerPoint files.
- "Audience-Focused Styles": Professional and Casual styles.
- "Presentation Mode": present directly from app.
- "Public Sharing": shareable public links.
- "Presentation Recording": microphone + webcam controls.
- "PowerPoint Export": `.pptx` (partial — images/components do not always translate 1:1).
- Charts, infographics, media embeds.
- Drag-and-drop slide reordering (DND Kit).
- Rich text editing via Plate Editor.

**Image generation**: AI-generated (Together AI primary, FAL secondary) + Unsplash stock.

**Local model support**:
- Ollama: `ollama pull llama3.1` — models auto-appear in selector.
- LM Studio: install app, enable Server + CORS, load model before use.

**Auth**: NextAuth.js with Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

---

## 2. Environment variables (.env shape)

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/presentation_ai"
# Authentication
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
# AI Providers
OPENAI_API_KEY=""
TOGETHER_AI_API_KEY=""
FAL_API_KEY=""
# File Upload
UPLOADTHING_TOKEN=""
# Optional Services
UNSPLASH_ACCESS_KEY=""
TAVILY_API_KEY=""
```

---

## 3. Tech stack

| Category | Tech |
|---|---|
| Framework | Next.js 16.2.1, React 19.2.4, TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma 6.13 |
| Auth | NextAuth.js |
| UI | Radix UI |
| Text editor | Plate Editor (platejs 52.3.3) |
| Outline editor | ProseMirror (prosemirror-model 1.25, prosemirror-view 1.39) |
| State | Zustand 4.5 |
| AI SDK | Vercel `ai` 6.0.73 + `@ai-sdk/openai` 3.0 + `@ai-sdk/openai-compatible` 1.0 + `@ai-sdk/react` 3.0 + LangChain integration |
| AI providers | OpenAI (gpt-4o-mini default), Together AI (`together-ai` 0.7), FAL (`@fal-ai/client` 1.8), Ollama, LM Studio |
| PPTX | `pptxgenjs` 4.0.1 |
| Lint | Biome |
| Build | `next build --turbo`, `next dev --turbo` |
| Upload | UploadThing |
| Charts | `ag-charts` |

Scripts: `dev`, `build`, `start`, `db:push`, `db:studio`, `lint`/`lint:fix` (Biome), `check`/`check:fix`, `postinstall` (prisma generate), `type` (`tsc --noEmit`).

---

## 4. Repository structure

```
presentation-ai/
├── prisma/                        # schema + seed
├── src/
│   ├── ai/
│   │   ├── agents/presentation/
│   │   │   └── createAgent.ts     # LangChain agent constructor
│   │   ├── lib/
│   │   │   ├── postgres.ts
│   │   │   └── processPastedContent.ts
│   │   └── tools/
│   │       ├── search.ts          # Tavily web search tool
│   │       └── presentation/
│   │           └── tools.ts       # ⭐ edit-slide / replace-image / change-theme / regenerate-slide tools (LangChain + Zod)
│   ├── app/
│   │   ├── (router pages)
│   │   └── api/
│   │       ├── agent/
│   │       ├── auth/              # NextAuth
│   │       ├── presentation/
│   │       │   ├── outline/route.ts            # ⭐ outline streaming endpoint
│   │       │   ├── generate/route.ts           # ⭐ full deck XML streaming
│   │       │   ├── generate-slide/route.ts     # single slide regeneration
│   │       │   ├── generate-image-slides/route.ts  # image-as-slide variant
│   │       │   ├── edit-diagram/
│   │       │   ├── prompt-to-diagram/
│   │       │   ├── text-to-diagram/
│   │       │   └── local-models/
│   │       └── uploadthing/
│   ├── components/
│   │   ├── notebook/
│   │   │   ├── notes/
│   │   │   └── presentation/
│   │   ├── presentation/
│   │   │   ├── agent/
│   │   │   │   ├── AIMessage.tsx
│   │   │   │   ├── HumanMessage.tsx
│   │   │   │   ├── ToolMessage.tsx
│   │   │   │   ├── Compare.tsx
│   │   │   │   ├── PresentationAgentPanel.tsx
│   │   │   │   └── tools/
│   │   │   ├── core/
│   │   │   │   ├── PresentationHeader.tsx
│   │   │   │   └── PresentationPage.tsx
│   │   │   ├── edit-panel/
│   │   │   ├── buttons/
│   │   │   ├── controls/
│   │   │   ├── export/                       # ⭐ DOM → PPTX
│   │   │   │   ├── contentWalker.ts
│   │   │   │   ├── cssVariableResolver.ts
│   │   │   │   ├── domSlideScanner.ts
│   │   │   │   ├── domToFabricConverter.ts
│   │   │   │   ├── domToPptxConverter.ts     # ⭐ pptxgenjs wrapper
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── utils.ts
│   │   │   ├── floating-toolbar/
│   │   │   ├── present-mode/
│   │   │   ├── presentation-page/
│   │   │   ├── providers/
│   │   │   ├── shared/
│   │   │   ├── sidebar/
│   │   │   ├── slides/
│   │   │   ├── theme/
│   │   │   │   └── ThemeSelector.tsx        # tabs: My Themes / Public Themes / Built-in
│   │   │   └── utils/
│   │   ├── plate/
│   │   ├── prose-mirror/
│   │   │   ├── ProseMirrorEditor.tsx        # ⭐ outline editor
│   │   │   ├── FloatingToolbar.tsx
│   │   │   └── ProseMirrorSchema.ts
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   │   ├── ai/
│   │   ├── env/
│   │   ├── notes/
│   │   ├── observability/
│   │   ├── presentation/
│   │   │   ├── customization.ts             # ⭐ tone/audience/scenario types
│   │   │   ├── loadCustomFont.ts
│   │   │   ├── pptx-theme-extractor.ts      # ⭐ JSZip-based theme import
│   │   │   ├── themes.ts                    # ⭐ 38 built-in themes
│   │   │   └── thumbnail.ts
│   │   ├── model-picker.ts
│   │   ├── modelPicker.ts
│   │   └── utils.ts
│   ├── provider/
│   ├── server/                              # auth, DB, sharing
│   ├── states/                              # Zustand stores
│   ├── styles/
│   ├── env.js
│   └── proxy.ts
└── package.json, next.config.js, tailwind.config.ts, biome.json, tsconfig.json
```

---

## 5. AI pipeline (outline → slides → assets → export)

### 5.1 Outline endpoint — `src/app/api/presentation/outline/route.ts`

System prompt is built dynamically via `buildOutlineSystemPrompt()`. Opening line:

> "You are an expert presentation outline generator. Your task is to create a comprehensive and engaging presentation outline based on the user's topic."

Templated sections include:
- Current date insertion
- Customization parameters (text content level, tone, audience, scenario)
- Process steps (with conditional research phase when web search enabled)
- Web search guidelines
- Output format: **"Start with the title in XML tags, then generate markdown with each topic as a heading followed by bullet points."**

User prompt: not templated — comes from `getMessageText(latestUserMessage).trim()`.

Streaming via LangChain `agent.stream()` with `["values", "messages"]` modes, wrapped in `toUIMessageStream()` + `createUIMessageStreamResponse()`.

Optional `search_tool` (Tavily) bound when `webSearch` true.

Provider via `modelPicker(modelProvider, modelId)` — defaults to OpenAI `gpt-4o-mini`.

### 5.2 Full deck endpoint — `src/app/api/presentation/generate/route.ts`

System prompt header (`SLIDES_TEMPLATE`):
> "You are an expert presentation designer. Create an engaging presentation in XML format."

Input schema `SlidesRequest`:

```typescript
interface SlidesRequest {
  title: string;
  prompt: string;
  outline: string[];
  language: string;
  tone: string;
  modelId?: string;
  modelProvider?: "openai" | "ollama" | "lmstudio";
  searchResults?: Array<{ query: string; results: unknown[] }>;
  textContent?: "minimal" | "concise" | "detailed" | "extensive";
  audience?: string;
  scenario?: string;
  imageSource?: "automatic" | "ai" | "stock";
  templateContext?: string;
  outlineTemplateHints?: Record<number, string>;
  selectedTemplateCount?: number;
}
```

XML markup:
```xml
<PRESENTATION>
  <SECTION layout="left|right|vertical">
    <!-- layout component (COLUMNS, BULLETS, ICONS, ...) -->
    <IMG query="..." />
  </SECTION>
</PRESENTATION>
```

**15 layout components**: COLUMNS, BULLETS, ICONS, CYCLE, ARROWS, TIMELINE, PYRAMID, STAIRCASE, BOXES, COMPARE, BEFORE-AFTER, PROS-CONS, TABLE, CHART, STATS.

Image-query style:
- Stock images: "1-4 word keywords, English-only"
- AI images: "60-120 word descriptions"

Implementation: `RunnableSequence.from([prompt, model])` then `chain.stream({...})` wrapped via `toUIMessageStream()`.

### 5.3 Single-slide regeneration — `src/app/api/presentation/generate-slide/route.ts`

Two templates:
- Standard slide: "create a SINGLE engaging slide in XML format" with one of the 15 layout components.
- Image slide: "Create a SINGLE image-based slide in XML format" with **all text rendered inside the image itself**.

Strict constraints quoted:
- "Return ONLY the XML for a single slide. No explanation, no wrapper tags"
- IMG query "60-120 words, highly descriptive"
- IMG query MUST be "in English for Unsplash compatibility, even if {LANGUAGE} is not English"
- For image slides: "Do NOT use placeholders, brackets, or vague references"

`GenerateSlideRequest`:
- `prompt` (required), `currentSlide?`, `theme?`, `language?`
- `slideType`: "standard" | "image"
- `imageStyle`: "3D" | "Sketch" | "Flat"
- `textDensity`: "Minimal" | "Balanced" | "Detailed"

### 5.4 Image-slides endpoint — `src/app/api/presentation/generate-image-slides/route.ts`

`IMAGE_SLIDES_TEMPLATE` opening:
> "You are an expert visual presentation designer. Create image-based slides where each slide is a full-screen image with ALL text rendered inside the image itself"

Critical rules:
- "Generate exactly {TOTAL_SLIDES} slides matching outline length"
- Each IMG query must include "the exact on-image text in quotes" with typography guidance
- "Do NOT use placeholders, brackets, or vague references; write every word exactly as it must appear in the image"

The endpoint itself only generates XML with image prompts — actual image rendering happens downstream.

---

## 6. Theme system

### 6.1 `src/lib/presentation/themes.ts` — 38 built-in themes

`ThemeProperties` interface:
- `name` — display name
- `description` — tagline
- `mode` — `"light" | "dark"`
- `colors` — `{ primary, accent, background, text, heading, smartLayout, cardBackground }`
- `fonts` — `{ heading, body }` font families, optional weight/URL
- `borderRadius` — `{ card, slide, button }`
- `transitions` — `{ default }` animation timing
- `shadows` — `{ card, button, slide }`
- `mask?` — clipping/masking CSS
- `background?` — gradient or image config

Examples (first 5 of 38):

| # | Name | Mode | Primary | Heading font | Body font | Button radius |
|---|---|---|---|---|---|---|
| 1 | Daktilo | Light | `#3B82F6` | Inter | Inter | 0.17rem |
| 2 | Noir | Dark | `#60A5FA` | Inter | Inter | — (blue-tint shadows) |
| 3 | Cornflower | Light | `#4F46E5` | Poppins | Source Sans Pro | 0.25rem |
| 4 | Indigo | Dark | `#818CF8` | Poppins | — | card-bg `#312E81` |
| 5 | Orbit | Light | `#312E81` | Space Grotesk | IBM Plex Sans | 9999px (pill) |

Themes are static TypeScript constants — no LLM in the theme generation path.

### 6.2 `src/lib/presentation/pptx-theme-extractor.ts` — PPTX → Theme

Uses **JSZip** to parse PPTX (which is a ZIP archive).

Follows OOXML relationship chain: `presentation.xml.rels → slideMaster → slideMaster.rels → theme.xml`.

Five-step `extractThemeFromPptx()`:
1. Resolve theme via relationships
2. Parse colour mapping (`clrMap` in slide master)
3. Parse palette — 12 standard OOXML colour slots from `theme.xml`
4. Scan actual slides for semantic colour and font usage
5. Build a **weighted theme** combining palette + slide analysis

Extracted fields:
- Colours: primary, accent, background, text, heading, smartLayout, cardBackground — resolved through palette slots (`dk1`, `lt1`, `accent1…accent6`).
- Fonts: heading + body mapped from OOXML names to web alternatives (e.g. `Calibri → Inter`).
- Layout: border radius / transitions / shadows from `STANDARD_DESIGN` constants.

Heuristics:
- Text runs with `fontSize >= 3000` (30pt) count as headings.
- `resolveColorFromFill()` handles direct sRGB and scheme refs with modifiers (`tint`, `shade`, `lumMod`).
- Graceful degradation: if `theme.xml` missing, fall back to slide-content analysis.

### 6.3 `src/components/presentation/theme/ThemeSelector.tsx`

UI strings:
- "Presentation Theme" (header)
- "Choose a theme for your presentation"
- "Create New Theme"
- Tabs: "My Themes", "Public Themes", "Built-in Themes"
- Empty states: "You haven't created any themes yet" / "No public themes available"

Theme cards render with each theme's own typography, shadows, and colours.

### 6.4 `src/lib/presentation/customization.ts`

Type union exports:
- `textContent`: `"minimal" | "concise" | "detailed" | "extensive"`
- `tone`: `"auto" | "general" | "persuasive" | "inspiring" | "instructive" | "engaging"`
- `audience`: `"auto" | "general" | "business" | "investor" | "teacher" | "student"`
- `scenario`: `"auto" | "general" | "analysis-report" | "teaching-training" | "promotional-materials" | "public-speeches"`

Helper functions: `buildPresentationCustomization`, `extractPageBackgroundFromConfig`, `applyPageBackgroundToConfig`. No theme arrays inside this file.

---

## 7. Agent / tools (`src/ai/tools/presentation/tools.ts`)

LangChain tools, validated with Zod:

| Tool | Purpose |
|---|---|
| `edit_slide_properties` | Modify slide attrs: background colour, content alignment, layout type, width. Accepts scope `"all"` or specific slide IDs. |
| `replace_image` | Swap slide image. Requires either `imageUrl` or `imagePrompt`. |
| `change_theme` | Apply theme from a predefined set ("daktilo", "cornflower", "orbit", "piano", "mystique", ...). |
| `regenerate_slide` | Re-emit slide using XML `<SECTION>` markup. Supports COLUMNS / BULLETS / TIMELINE / CHART / TABLE etc. |
| `create_slide` | New slide with optional `afterSlideId`. |
| `delete_slide` | Remove slide(s). |
| `respond_to_user` | Non-modifying clarifying reply. |

Agent system prompt (`createAgent.ts`):
> "You are an expert presentation editing agent specialized in modifying and enhancing presentation slides."

For local models (Ollama / LM Studio), an additional clause is injected:
> "LOCAL TOOL CALLING RULES - Use the available tools whenever you need to edit slides or answer via a tool."

Defaults to `gpt-4o-mini` on OpenAI; switchable via `modelProvider` param.

Workflow sections in the prompt:
1. Understanding Requests
2. Tool Selection (scope: "all" / slide IDs)
3. Design Considerations (visual consistency, readability)
4. Response Style (brief summary after tool runs)

Error handling: explain failures, suggest alternatives, request clarification, warn about design-integrity risk.

---

## 8. Outline editor (`src/components/prose-mirror/ProseMirrorEditor.tsx`)

ProseMirror-based markdown editor used between AI outline generation and slide generation.

Features:
- Bold (`Mod-b`), italic (`Mod-i`)
- Undo / redo (`Mod-z` / `Mod-y`)
- Floating toolbar appears 150ms after selection
- Change detection vs original content via `onChangeState`
- Editing-mode toggle (`isEditing`) — cursor switches between `cursor-text` and `cursor-default`
- External content updates are synchronized without disturbing local cursor state
- Serializes back to markdown on every transaction
- Tailwind `prose` styling + custom CSS removing default focus outline

Schema is tiny (`ProseMirrorSchema.ts` is 420 bytes) — minimal node set tailored to outline structure.

---

## 9. Export (`src/components/presentation/export/`)

Files:
- `domSlideScanner.ts` — walks the live React/DOM of the editor to find slide elements.
- `contentWalker.ts` — traverses DOM nodes inside each slide.
- `cssVariableResolver.ts` — resolves CSS variables to literal colours.
- `domToFabricConverter.ts` — intermediate Fabric.js object representation.
- `domToPptxConverter.ts` — main PPTX writer.

`convertToPptx()` signature:
```typescript
export async function convertToPptx(
  scanResults: ScanResult[],
  slides: PlateSlide[],
): Promise<ArrayBuffer>
```

pptxgenjs methods used:
- `pptx.addSlide()`
- `slide.addImage()` (supports base64 data URLs and file paths)
- `slide.addText()` (font-size mapping h1=32pt, body=12pt; bold/italic/underline)
- `slide.addShape()` (arrows, pills, parallelograms, with rotation + corner radius)
- `slide.addTable()`

Special cases:
- Image slides bypass other content and fill entire slide.
- Solid backgrounds skip black/white defaults.
- Gradient backgrounds extract the first stop as fallback.
- In-editor images support crop/contain/fill sizing.

---

## 10. Thumbnails — `src/lib/presentation/thumbnail.ts`

NOT a headless-browser pipeline. Just URL extraction:
- `getPresentationThumbnailUrl()` — checks "root image" first, then first inline image inside slide content.
- `getPresentationSlidesFromContent()` — validates slide data shape.

Real visual rendering happens in the live React editor; thumbnail is just whichever image URL is found first.

---

## 11. Other directories

- `src/app/api/presentation/edit-diagram/`, `prompt-to-diagram/`, `text-to-diagram/` — diagram-specific generation endpoints (mermaid/structured diagrams).
- `src/app/api/presentation/local-models/` — Ollama / LM Studio model listing endpoint (populates the model picker).
- `src/components/notebook/notes/` + `presentation/` — top-level dashboard UI for both notes and decks.
- `src/components/plate/` — Plate.js plugins for the slide editor (rich text, images, etc.).
- `src/server/` — auth, DB clients, presentation-sharing logic.
- `src/states/` — Zustand stores: editing state, theme config, generation progress, user selections.

---

## 12. Key technical decisions to remember

1. **Outline is editable markdown** (ProseMirror), persisted server-side, then converted to slide XML. The two stages are distinct API endpoints.
2. **Slide content is XML** with 15 layout components + `<SECTION layout="left|right|vertical">` wrappers. No JSON Schema enforcement — the model emits XML and the renderer maps it to React.
3. **Themes are static TS constants** (38 of them) with full design tokens (colours / fonts / radius / shadow). No LLM in the theme path.
4. **PPTX theme import** uses JSZip to walk OOXML relationships → palette → slide scan → weighted theme. Maps OOXML fonts to web alternatives.
5. **Image generation** routed through Together AI or FAL; stock via Unsplash. Image query is auto-localised to English on the LLM side for stock compatibility.
6. **Image-only slides** are a first-class mode — all text baked into the image via 60-120 word prompts.
7. **PPTX export uses pptxgenjs** with DOM scanning (`domSlideScanner` → `contentWalker` → `domToPptxConverter`). No headless browser — the live DOM is the source of truth.
8. **Agent tool surface** is 7 named tools (edit / replace_image / change_theme / regenerate_slide / create_slide / delete_slide / respond_to_user), all LangChain + Zod.
9. **Multi-provider AI**: OpenAI default, plus Together AI, FAL, Ollama, LM Studio, Tavily for web search.
10. **Model picker** in `src/lib/model-picker.ts` resolves provider + model id at call time; local provider lists are fetched from `/api/presentation/local-models`.
11. **Customisation knobs** (tone, audience, scenario, text density) are typed unions injected into prompts.
12. **Bidirectional PPTX**: import via JSZip + OOXML parsing for theme inspiration; export via pptxgenjs from DOM. Asymmetric — neither side is fully round-trippable.
