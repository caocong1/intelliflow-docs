# presenton/presenton — RAW captured sources

> Captured via WebFetch on 2026-05-20. Repo: https://github.com/presenton/presenton
> License: Apache-2.0. Marketing site: https://presenton.ai

---

## 1. README highlights (from main/README.md)

**Positioning**: "Open-Source AI Presentation Generator and API. Self-host, integrate via API, and generate pixel-perfect decks in minutes. No vendor lock-in." Apache-2.0 alternative to Gamma / Beautiful AI / Decktopus.

**Core features**:
- AI-powered generation from prompts or documents
- Fully editable PPTX export with professional formatting
- Custom template creation using HTML + Tailwind CSS
- Multi-provider LLM support (OpenAI / Google / Anthropic / Azure / Vertex AI / Ollama / custom OpenAI-compatible)
- Built-in MCP server for Model Context Protocol integration
- Local / offline processing (Ollama) — no cloud dependency required
- Rich media: icons, charts, custom graphics

**Image generation providers**: DALL-E 3, GPT-Image-1.5, Gemini Flash, NanoBanana Pro, Pexels, Pixabay, ComfyUI, Open WebUI, OpenAI-compatible.

**Deployment**:
- Desktop Electron app (macOS Apple Silicon/Intel, Windows x64, Linux x64) — bundles FastAPI backend, requires Node LTS + Python 3.11
- Docker: `docker run -it --name presenton -p 5000:80 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest`
- Cloud at presenton.ai

**Auth**: Single admin per instance via `AUTH_USERNAME` / `AUTH_PASSWORD` env vars; HTTP Basic on REST endpoints.

**Memory**: Mem0 with local Qdrant vector store + SQLite for presentation-scoped recall.

**Key API**: `POST /api/v1/ppt/presentation/generate` accepts content/markdown slides, tone (default/casual/professional/funny/educational/sales_pitch), verbosity (concise/standard/text-heavy), slide count, language, template, optional web-search grounding and extended reasoning.

---

## 2. Top-level repository structure

```
presenton/
├── .github/
├── electron/                  # Desktop app shell
├── presentation-export/       # Single huge index.cjs file (5.87 MB) — bundled Node export module
├── readme_assets/images/
├── scripts/
├── servers/
│   ├── fastapi/               # Python backend (main AI pipeline)
│   └── nextjs/                # Frontend + layout/template renderer
├── docker-compose.yml
├── Dockerfile
├── package.json
└── start.js
```

### 2.1 servers/fastapi/

```
fastapi/
├── alembic/                   # DB migrations
├── api/
│   ├── __init__.py
│   ├── lifespan.py
│   ├── main.py
│   ├── middlewares.py
│   └── v1/
│       ├── auth/
│       ├── mock/
│       ├── ppt/
│       │   ├── background_tasks.py
│       │   ├── router.py
│       │   └── endpoints/
│       │       ├── anthropic.py        # provider proxy
│       │       ├── chat.py
│       │       ├── codex_auth.py
│       │       ├── files.py
│       │       ├── fonts.py
│       │       ├── google.py
│       │       ├── icons.py
│       │       ├── images.py            # GET /images/generate
│       │       ├── layouts.py           # proxies http://localhost:3000/api/layouts
│       │       ├── ollama.py
│       │       ├── openai.py
│       │       ├── outlines.py          # SSE streaming outline gen
│       │       ├── pdf_slides.py        # PDF→PNG via ImageMagick
│       │       ├── pptx_slides.py       # PPTX→PDF via LibreOffice (reverse direction)
│       │       ├── presentation.py      # main /generate orchestrator
│       │       ├── prompts.py
│       │       ├── slide.py             # edit / edit-html
│       │       ├── slide_to_html.py
│       │       ├── theme.py             # CRUD on custom themes
│       │       └── theme_generate.py    # deterministic palette generation
│       └── webhook/
├── assets/
├── constants/
├── enums/
├── fastembed_cache/           # local vector cache for icon search
├── models/
├── scripts/
├── services/
│   ├── chat/
│   ├── concurrent_service.py
│   ├── database.py
│   ├── document_conversion_service.py
│   ├── documents_loader.py
│   ├── export_task_service.py
│   ├── icon_finder_service.py       # FastEmbed AllMiniLML6V2 semantic icon search
│   ├── image_generation_service.py  # multi-provider image gen
│   ├── liteparse_service.py
│   ├── mem0_oss_memory.py
│   ├── mem0_presentation_memory_service.py
│   ├── score_based_chunker.py
│   ├── temp_file_service.py
│   └── webhook_service.py
├── static/
├── templates/                 # ⭐ Layout templates (NOT Jinja — see below)
│   ├── __init__.py
│   ├── example.py
│   ├── font_utils.py
│   ├── get_layout_by_name.py
│   ├── handler.py             # CRUD + clone of templates, persists to DB
│   ├── presentation_layout.py
│   ├── preview.py
│   ├── prompts.py             # ⭐ TSX layout generation prompts
│   ├── providers.py
│   ├── router.py
│   └── slide_layout_jobs.py
├── tests/
├── utils/
│   ├── llm_calls/
│   │   ├── edit_slide.py
│   │   ├── edit_slide_html.py
│   │   ├── generate_presentation_outlines.py   # ⭐
│   │   ├── generate_presentation_structure.py  # ⭐ layout-picking
│   │   ├── generate_slide_content.py           # ⭐
│   │   └── select_slide_type_on_edit.py
│   ├── oauth/
│   ├── available_models.py
│   ├── datetime_utils.py
│   ├── dict_utils.py
│   ├── error_handling.py
│   ├── file_utils.py
│   ├── get_env.py / set_env.py
│   ├── get_layout_by_name.py  # re-export wrapper
│   ├── llm_client_error_handler.py
│   ├── llm_config.py
│   ├── llm_provider.py
│   ├── llm_utils.py
│   ├── ollama.py
│   ├── outline_utils.py
│   ├── parsers.py
│   ├── path_helpers.py
│   ├── ppt_utils.py
│   ├── process_slides.py
│   ├── schema_utils.py
│   ├── simple_auth.py
│   ├── theme_utils.py
│   ├── user_config.py
│   └── validators.py
├── server.py
├── mcp_server.py              # uses FastMCP.from_openapi(openai_spec.json)
├── migrations.py
├── pyproject.toml
└── openai_spec.json
```

### 2.2 servers/nextjs/

```
nextjs/
├── app/
│   ├── (export)/                       # export route group
│   ├── (presentation-generator)/
│   │   ├── (dashboard)/
│   │   ├── components/
│   │   │   ├── EditableLayoutWrapper.tsx
│   │   │   ├── HeaderNab.tsx
│   │   │   ├── IconsEditor.tsx
│   │   │   ├── ImageEditor.tsx
│   │   │   ├── MarkdownEditor.tsx
│   │   │   ├── NewSlide.tsx
│   │   │   ├── PresentationMode.tsx
│   │   │   ├── PresentationRender.tsx
│   │   │   ├── SlideErrorBoundary.tsx
│   │   │   ├── TemplatePreviewComponents.tsx
│   │   │   ├── TiptapText.tsx
│   │   │   ├── TiptapTextReplacer.tsx
│   │   │   └── V1ContentRender.tsx
│   │   ├── custom-template/            # ⭐ React-based template authoring (.tsx)
│   │   │   ├── components/
│   │   │   ├── constants/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   ├── CustomTemplatePage.tsx
│   │   │   └── page.tsx
│   │   ├── documents-preview/
│   │   ├── hooks/
│   │   ├── outline/
│   │   ├── presentation/
│   │   ├── services/api/
│   │   ├── template-preview/
│   │   ├── types/
│   │   ├── upload/
│   │   └── utils/
│   ├── api/
│   ├── fonts/
│   ├── hooks/
│   ├── presentation-templates/         # ⭐ Built-in layouts (TSX React components)
│   └── schema/
├── components/
├── cypress/
├── lib/
├── models/
├── public/
├── store/
├── types/
├── utils/
├── package.json
├── next.config.mjs
└── proxy.ts
```

---

## 3. AI pipeline (orchestrator in presentation.py)

End-to-end flow at `/api/v1/ppt/presentation/generate`:

1. **Validate** request parameters (content/files required, slide count within limits).
2. **Outline generation** (skipped if user supplies markdown slides) — calls `generate_ppt_outline()` (SSE stream).
3. **Layout selection** — load template, "Selecting layout for each slide" maps each outline to an appropriate slide layout/template.
4. **Structure generation** — `PresentationStructureModel` records which layout each slide uses; randomization for non-ordered layouts.
5. **TOC insertion** — optional Table of Contents slides at appropriate positions.
6. **Slide content generation** — batches of 10 concurrent LLM calls. Each slide content generated against its assigned layout's JSON Schema (with `__image_url__` / `__icon_url__` stripped and `__speaker_note__` injected as 100-500 char string).
7. **Asset fetching** — images + icons fetched **in parallel** with slide generation.
8. **Persist** presentation, slides, assets to DB.
9. **Export** to requested format (PPTX/PDF), trigger webhook.

---

## 4. Key prompts (verbatim or near-verbatim quotes)

### 4.1 Outline generation (`utils/llm_calls/generate_presentation_outlines.py`)

System prompt (paraphrased from fetched content):
> "Generate presentation title and content for slides … Presentation title should be plain text, not markdown. Follow user instructions strictly and literally without reinterpretation. Apply slide-specific instructions only to the exact slide mentioned and only once. Slide content must follow markdown format with `##` titles. Make sure data used is strictly from the provided content/context. Use the web search tool when the user request requires current, factual, or external information."

User template:
```
Content: [user content]
Number of Slides: [auto-detect or number]
Language: [auto-detect or specified]
Tone: [optional]
Today's Date: [current date]
Include Title Slide: [true/false]
Instructions: [optional]
Context: [additional context or 'None']
```

Response: `PresentationOutlineModel` (or dynamic variant with strict slide count), JSON Schema with strict validation.

### 4.2 Presentation structure (layout picker) (`generate_presentation_structure.py`)

184 lines. Picks a layout per slide given outline + available layouts.

Key rules quoted:
> "If content contains table, then select either table layout or graph layout."
> "Don't select layout with image unless content contains image."

Returns `PresentationStructureModel` with layout-index assignments.

### 4.3 Slide content (`generate_slide_content.py`)

System: "Analyze the content. Analyze the response schema. Generate structured content json based on the schema."

User: `"Current Date and Time: [timestamp]. Icon Query And Image Prompt Language: English. Slide Language: [language]. SLIDE CONTENT: [content]"`

Schema mutation:
- Removes `__image_url__` and `__icon_url__` (assets fetched separately later)
- Adds `__speaker_note__: string` with `minLength=100, maxLength=500`
- Ensures array schemas have `items` defined

### 4.4 Layout (template) generation prompts (`templates/prompts.py`)

`SLIDE_LAYOUT_CREATION_SYSTEM_PROMPT`: instructs LLM to take a slide *image* and emit both a Zod schema and a TSX React component. Rules:
- "Analyze the slide image to understand the visual hierarchy"
- Classify elements as decorative vs content-based
- Reusable components with fixed **1280×720 px** canvas
- Use flex/grid, not absolute positioning
- Use only fonts from a "PROVIDED FONTS" list
- Output valid TSX, no comments

`SLIDE_LAYOUT_EDIT_SYSTEM_PROMPT` / `SLIDE_LAYOUT_EDIT_SECTION_SYSTEM_PROMPT`: incremental edits, retain working code paths, strip unused schema fields after edit.

---

## 5. Theme system (deterministic + custom)

### 5.1 `theme_generate.py` request model:
```python
class GenerateThemeRequestV3(BaseModel):
    primary: Optional[str] = None
    background: Optional[str] = None
    accent_1: Optional[str] = None
    accent_2: Optional[str] = None
    text_1: Optional[str] = None
    text_2: Optional[str] = None
```

Generation is **deterministic**, not LLM-driven:
```
color_palette = generate_color_palette(request.primary, request.background,
                                       request.accent_1, request.accent_2,
                                       request.text_1, request.text_2)
```
Builds `ThemeData` with primary/background, card+stroke variants, text colors, and `graph_0 … graph_9` data-viz palette.

### 5.2 Theme CRUD (`endpoints/theme.py`)
- GET `/themes/default` — built-in (served by Next.js)
- GET `/themes/all` — list custom
- POST `/themes/create`
- PATCH `/themes/update/{theme_id}`
- DELETE `/themes/delete/{theme_id}`
Stored in `KeyValueSqlModel` under key `presentation_custom_themes` as a single JSON blob.

### 5.3 Layouts = TSX React components
- Built-in layouts live in `servers/nextjs/presentation-templates/` (TSX React components rendered at 1280×720).
- Custom templates created via the `(presentation-generator)/custom-template/` route — also TSX.
- Templates persisted to DB through `templates/handler.py` (`TemplateModel`, `PresentationLayoutCodeModel`, fonts list).
- The FastAPI `endpoints/layouts.py` simply proxies to `http://localhost:3000/api/layouts` — the Next.js side owns layout rendering.

---

## 6. Image generation (`services/image_generation_service.py`)

Providers:
- Stock: **Pexels**, **Pixabay** — pass prompt directly, get URL.
- Generative: **DALL-E 3**, **GPT-Image-1.5**, **Gemini Flash**, **NanoBanana Pro** — full image prompt + theme context injected.
- Self-hosted: **ComfyUI** (submit workflow → poll → download), **Open WebUI** (base64 or relative URL).
- **OpenAI-compatible** endpoints.

Return formats: HTTP URL (stock/remote) or local file converted to app-data URL (`ImageAsset`). Placeholder fallback if disabled.

GET endpoint: `/api/v1/ppt/images/generate?prompt=...` — runs `ImagePrompt` → service → persists `ImageAsset` if local.

---

## 7. Icon finder (`services/icon_finder_service.py`)

Semantic search using **FastEmbed `AllMiniLML6V2`** model. Documents embedded as `f"{each['name']}||{each['tags']}"`. Query via `vectorstore.search()` — meaning-based matching not keyword. Local persistence in `fastembed_cache/`.

---

## 8. PPTX export

⚠ The reverse direction (PPTX→PDF→PNG via LibreOffice and ImageMagick) lives in `pptx_slides.py` and `pdf_slides.py` for preview/thumbnailing.

The actual outbound PPTX generation lives in **`presentation-export/index.cjs`** — a single bundled CommonJS file 5.87 MB in size (GitHub refuses to render). It is a Node module bundled separately, invoked by the FastAPI orchestrator (`export_task_service.py`). The Next.js renderer produces the visual HTML; index.cjs is the JS bundle that converts that DOM/JSON into PPTX, almost certainly via **pptxgenjs** (also confirmed by the allweone twin project below).

---

## 9. MCP integration

`mcp_server.py` uses `FastMCP.from_openapi(openapi_spec=openapi_spec, ...)` — auto-generates an MCP server from the FastAPI OpenAPI spec (`openai_spec.json`). So **every REST endpoint becomes an MCP tool** with no manual tool-definition overhead.

---

## 10. Slide editing tools

Two LLM-call functions in `utils/llm_calls/`:
- `edit_slide.py` — edits structured content + speaker notes + image assets.
- `edit_slide_html.py` — edits raw HTML directly.
- `select_slide_type_on_edit.py` — chooses which path to take.

---

## 11. Landing page (presenton.ai) notes

- "Reusable PPTX design preservation maintaining colors, typography, spacing, and layout"
- AI-powered template conversion from existing PPTX/PDF files
- "End-to-end deck creation From structure and storyline to layout and content"
- "Self-host complete offline with Ollama"
- Cloud / self-hosted / API tiers
- Use cases: financial services automated reports, SaaS white-label, enterprise data-privacy needs
- (No explicit Gamma comparison or explicit MCP marketing claim on landing page itself, but README mentions MCP server feature)

---

## 12. Key technical decisions to remember

1. **Layouts are React/TSX components** at fixed 1280×720, picked per slide by an LLM (`generate_presentation_structure`). The LLM doesn't draw — it picks.
2. **Slide content schema** is layout-specific (each TSX layout exports a Zod schema). LLM generates JSON conforming to that schema.
3. **Image/icon assets fetched in parallel** with slide-content LLM calls — significant latency win.
4. **Theme = deterministic palette generator** + custom user CRUD; not LLM-driven.
5. **Icon search = FastEmbed semantic vector search**, local.
6. **MCP = OpenAPI-generated** — minimal additional surface for AI agents.
7. **Custom layouts = LLM image→TSX+Zod** with 1280×720 canvas and font allowlist constraint.
8. **Memory = Mem0 OSS + local Qdrant + SQLite** — presentation-scoped.
