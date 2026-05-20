# PPTAgent — Raw Source Capture

Source repository: https://github.com/icip-cas/PPTAgent
Paper (EMNLP 2025): https://arxiv.org/abs/2501.03936
Paper title: *PPTAgent: Generating and Evaluating Presentations Beyond Text-to-Slides*
Authors: Zheng et al. (Institute of Computing Technology, Chinese Academy of Sciences)
Follow-up paper (ACL 2026): *DeepPresenter: Environment-Grounded Reflection for Agentic Presentation Generation* (arxiv 2602.22839)

Stars: ~4.4k. License: visible repo (academic). Languages: Python 71%, JavaScript 20.4%, TypeScript 7.2%.

---

## 1. README highlights (verbatim excerpts)

> "We **strongly recommend** deploying our fine-tuned model for the best experience with our agent project. According to our experiments, it **significantly outperforms existing open-source models**."

Models published on HuggingFace and ModelScope:
- `Forceless/DeepPresenter-9B-GGUF` (quantized)
- `Forceless/DeepPresenter-9B` (full weights)

News timeline (verbatim):
- **[2026/04]** DeepPresenter accepted to **ACL 2026**.
- **[2026/03]** Released fine-tuned models and taskset on Hugging Face.
- **[2026/01]** Freeform & template generation support PPTX export and offline mode. Context management added.
- **[2025/12]** Released DeepPresenter codebase with major upgrades — Deep Research Integration, Free-Form Visual Design, Autonomous Asset Creation, Text-to-Image Generation, Agent Environment with sandbox & 20+ tools.
- **[2025/09]** MCP server support added.
- **[2025/08]** PPTAgent accepted to **EMNLP 2025**.
- **[2025/05]** Reached **1,000 stars** on GitHub.
- **[2025/01]** Open-sourced the PPTAgent codebase.

Deployment modes:
1. **CLI** (uvx pptagent onboard / generate)
2. **Build From Source** (uv pip install -e .; playwright install chromium; html2pptx via npm; docker images deeppresenter-host & deeppresenter-sandbox)
3. **Docker Compose** (exposes web UI on `http://localhost:7861`)

Optional services that improve quality:
- **Tavily** — better web search (`TAVILY_API_KEY`)
- **MinerU** — better PDF parsing (`MINERU_API_KEY` or local deployment via `MINERU_API_URL`)
- **Text-to-image model** — configured via `t2i_model` in config.yaml

Constraint: "Windows is not supported. If you are on Windows, please use WSL."

---

## 2. Source tree (`/pptagent` package)

Top-level modules:

| Module | Purpose |
|--------|---------|
| `agent.py` | Main agent orchestration |
| `pptgen.py` | Slide generation engine |
| `llms.py` | LLM interface |
| `litellm.py` | LiteLLM wrapper |
| `apis.py` | External API connections |
| `multimodal.py` | Text + image integration |
| `induct.py` | Learning from reference presentations (Stage 1) |
| `model_utils.py` | Model utilities |
| `mcp_server.py` | MCP server implementation |

Sub-directories:
- `docker/` — containers
- `document/` — document processing
- `ppteval/` — evaluation framework
- `presentation/` — slide manipulation
- `prompts/` — prompt templates
- `resource/` — assets
- `response/` — response handling
- `roles/` — agent role definitions
- `scripts/` — utility scripts
- `templates/` — presentation templates
- `test/` — tests

Role YAML files in `/pptagent/roles/`:
1. `agent.yaml` — core agent role
2. `coder.yaml` — code generation
3. `content_organizer.yaml` — content structure
4. `doc_extractor.yaml` — document parsing
5. `editor.yaml` — content editing
6. `layout_selector.yaml` — layout selection
7. `planner.yaml` — planning
8. `schema_extractor.yaml` — schema extraction

---

## 3. Two-stage pipeline (verbatim from paper)

> "PPTAgent comprehensively improves presentation generation through a two-stage, edit-based approach inspired by human workflows."

> "PPTAgent first analyzes reference presentations to extract slide-level functional types and content schemas, then drafts an outline and iteratively generates editing actions based on selected reference slides to create new slides."

**Stage I — Presentation Analysis (induction)**

> "Stage I - Analysis: Presentation Analysis involves analyzing the input presentation to cluster slides into groups and extract their content schemas."

Two slide categories:
- **Structural slides** — "support the presentation's organization (e.g., opening slides)"
- **Content slides** — "convey specific information"

For content slides: "convert them into images and then apply a hierarchical clustering approach to group similar slide images." MLLMs then "analyze converted images to identify layout patterns within each cluster."

Slide clustering algorithm (Algorithm 1 in paper): hierarchical clustering with similarity threshold θ=0.65. Iteratively identifies the most similar slide pairs from a cosine-similarity matrix, merges them into clusters, and updates the similarity matrix by zeroing processed rows/columns until max similarity falls below θ.

Schema extraction: each element represented by `category`, `description`, `content`. Example schema:
- Category: Title | Description: Main title | Data: Sample Library
- Category: Date | Description: Date of the event | Data: 15 February 2018

**Stage II — Presentation Generation**

> "Stage II - Generation: Presentation Generation generates new presentations guided by the outline, incorporating self-correction mechanisms to ensure robustness."

> "the outline generation process selects reference slides based on the slide-level functional description in Stage I, while the relevant document content is identified based on the input document."

---

## 4. Edit-based API (the 5 editing actions)

PPTAgent operates on HTML-rendered slide representations (not raw OOXML/XML) and exposes 5 atomic edit APIs:

| API | Function |
|-----|----------|
| `del_span` | Delete a span |
| `del_image` | Delete an image element |
| `clone_paragraph` | Create a duplicate of an existing paragraph |
| `replace_span` | Replace the content of a span |
| `replace_image` | Replace the source of an image |

The HTML abstraction is key: "operate on HTML-rendered slide representations rather than raw XML, simplifying LLM interaction significantly."

---

## 5. Self-Reflection / REPL feedback loop

> "Generated editing actions execute within a REPL environment. When actions fail to apply to reference slides, the REPL provides execution feedback to assist LLMs in refining their actions."

> "The LLM then analyzes this feedback to adjust its editing actions, enabling iterative refinement until a valid slide is generated or the maximum retry limit is reached."

Experimental setting: "maximum of two self-correction iterations" per slide.

DeepPresenter v2 (2025/12) extends this with:
- **Environment-Grounded Reflection** — deep integration with research and autonomous asset creation
- **Sandbox** — isolated tool execution with 20+ integrated tools
- **Free-Form Visual Design** — beyond template constraints
- **Text-to-Image Generation** — integrated image creation
- **Context management** — prevents context overflow on long decks

---

## 6. PPTEval — three-dimensional evaluation framework

> "PPTEval, assessing presentations across three dimensions: Content, Design, and Coherence."

5-point Likert scale per dimension. Content and Design assessed per-slide; Coherence is presentation-wide.

Inter-rater agreement: 0.59 average Fleiss' Kappa (0.61 / 0.61 / 0.54 for Content / Design / Coherence respectively).

### 6.1 Content rubric (verbatim from `prompts/ppteval/ppteval_content.txt`)

> You are an unbiased presentation analysis judge responsible for evaluating the quality of slide content.

| Score | Criterion |
|-------|-----------|
| 1 | Significant grammatical errors or poorly structured, hard to understand. |
| 2 | Lacks clear focus, awkward phrasing, weak organization. |
| 3 | Clear and complete but lacks visual aids, insufficient overall appeal. |
| 4 | Clear and well-developed, but images have weak relevance to theme. |
| 5 | Well-developed with clear focus; images and text effectively complement each other. |

### 6.2 Design rubric (verbatim from `prompts/ppteval/ppteval_style.txt`)

> You are an unbiased presentation analysis judge responsible for evaluating the visual appeal of slides... assessing their aesthetics only.

| Score | Criterion |
|-------|-----------|
| 1 | Conflict between slide styles; content difficult to read. |
| 2 | Monotonous colors (black and white); readable but lacks visual appeal. |
| 3 | Basic color scheme; lacks supplementary visual elements like icons, backgrounds, images or geometric shapes. |
| 4 | Harmonious color scheme + some visual elements; minor design flaws may exist. |
| 5 | Harmonious and engaging style; use of supplementary visual elements (images, geometric shapes) enhances overall visual appeal. |

### 6.3 Coherence rubric (verbatim from `prompts/ppteval/ppteval_coherence.txt`)

> You are an unbiased presentation analysis judge responsible for evaluating the coherence of the presentation. Please carefully review the provided summary of the presentation, assessing its logical flow and contextual information.

| Score | Criterion |
|-------|-----------|
| 1 | Logical structure is chaotic. |
| 2 | Generally reasonable but with minor transition issues. |
| 3 | Clear logical structure, smooth transitions, but lacks essential background information. |
| 4 | Well-organized logical flow + basic background info (speaker, date, institution). |
| 5 | Engaging narrative + detailed background information (speaker/institution, date, acknowledgments/conclusion). |

### 6.4 Per-slide descriptor prompts (used as input to the rubrics)

**Content description** (`ppteval_describe_content.txt`):
> Describe the input slide based on the following three dimensions:
> 1. **Information Density** — Whether the slide conveys too lengthy or too little information, resulting in large white space without colors or images.
> 2. **Content Quality** — Check if there are grammatical errors or unclear expressions of textual content.
> 3. **Images and Relevance** — Assess use of visual aids (images, icons), presence, and how well they relate to the theme.

**Style description** (`ppteval_describe_style.txt`):
> 1. **Visual Consistency** — Evaluate if any stylistic choices affect readability (overlapping elements, low contrast).
> 2. **Color Scheme** — Identify colors used; determine if monochromatic (black/white) or colorful (including gray).
> 3. **Use of Visual Elements** — Assess presence of backgrounds, textures, patterns, or geometric shapes (rectangles, circles, bold dividers).

**Presentation-level extractor** (`ppteval_extract.txt`):
> Extract: (1) **Slide Descriptions** — conclude the purpose of each slide; (2) **Presentation Metadata** — explicit background information (author, speaker, date, institution) from opening and closing slides.

---

## 7. Other prompts captured verbatim

### 7.1 `prompts/ask_category.txt` (layout pattern naming)

> Analyze the content layout and media types in the provided slide images.
> Your objective is to provide a concise, descriptive title that captures purely the layout pattern.
>
> Requirements:
> - Focus on HOW content is structured and presented, not WHAT the content is
> - Describe the number, visual arrangement, and interaction between different elements (text, images, diagrams, etc.)
>
> Avoid: Specific topics or subjects, and detailed content descriptions.
>
> Example Outputs:
> - One Central Square Chart with a explanatory paragraph
> - Picture and three illustrative key points
> - Two Landscape Images with Descriptive Text Below Each

### 7.2 `prompts/caption.txt` (image classification + caption)

> Describe the main content of the image in less than 50 words... Additionally, classify the image as 'Table', 'Chart', 'Diagram', 'Banner', 'Background', 'Icon', 'Logo', etc. or 'Picture' if it cannot be classified as one of the above.
>
> Format: `<type>:<description>`

### 7.3 `prompts/lengthy_rewrite.txt` (presentation-suitable rewriting)

> You are a presentation expert tasked with rewriting each item of a given presentation element to be concise and suitable for presentation slides.
>
> - Prioritize clarity and readability over information density. Within the character limit, make each item as clear and easy to understand as possible, even if this means omitting some details (such as content after colons).
> - Preserve the original structure: The number of strings in the output JSON array must match the input. Maintain the original language, spelling, capitalization, and spacing.
> - Use only commonly recognized abbreviations (e.g., etc., et al., TOC, LLM) for brevity where appropriate. **Do not invent new abbreviations** or add information not present in the original.

### 7.4 `prompts/category_split.txt` (structural slide identification — Opening/TOC/Section Outline/Ending)

> You are an expert presentation analyst specializing in categorizing PowerPoint slides, focusing on structural slides (Opening, Table of Contents, Section Outline, and Ending) that guide the presentation's flow.
>
> Structural Characteristics:
> - Position and Quantity:
>   - Opening, Table of Contents, and Ending: Typically appear as single slides at the start (first and second slides) and end of the presentation respectively.
>   - Section Outline: Must be multiple slides, each interleave several slides to detail the content of the section.
> - Content:
>   - Opening: Minimal content, often meta-information (e.g., title, presenter, or context).
>   - Table of Contents: Lists section titles in order, often with numbers or bullets as indicators. Usually displays "Table of Contents", "TOC", or similar as the main title.
>   - Ending: Minimal content, often meta-information (e.g., "Thank You" or contact details).
>   - Section Outline: Contains a section title that strictly matches the Table of Contents (identical wording).

Output example:
```json
{"opening": [1], "table of contents": [2], "section outline": [3, 7], "ending": [12]}
```

### 7.5 Document-processing prompts (verbatim)

**`document/heading_extract.txt`** (heading extraction):
> You are a Markdown formatting assistant. I'll provide you with a Markdown tree containing headings with potentially inconsistent levels (#, ##, etc.), and number of characters. Your task is to identify and extract the appropriate top-level headings defined in the <title> tags based on their semantic and logical structure.

**`document/section_summary.txt`**:
> Please summarize the content of the document section into a concise paragraph less than 100 words.

Other document prompts:
- `markdown_image_caption.txt`
- `markdown_table_caption.txt`
- `merge_metadata.txt`

---

## 8. Experimental results (from paper)

PPTEval scores (avg across test sets):

| Method | Content | Design | Coherence | Avg |
|--------|---------|--------|-----------|-----|
| DocPres | 2.98 | 2.37 | 3.24 | 2.85 |
| KCTV | 2.55 | 2.95 | 3.36 | 2.95 |
| **PPTAgent** | **3.28** | **3.34** | **4.48** | **3.67** |

Success rates: PPTAgent 95.0% vs KCTV 88.0%.

Notable: PPTAgent's biggest lead is on **Coherence** (4.48 vs 3.24-3.36), validating the value of explicit structural-slide categorization (Opening/TOC/Section Outline/Ending) and reference-slide selection grounded in the source document outline.

---

## 9. Architectural takeaways (synthesized)

1. **Reference-driven generation** — PPTAgent does not invent layouts. It selects + edits real reference slides, which is both robust (proven layouts) and content-aware.
2. **HTML as the editing substrate** — avoids the LLM having to reason about OOXML/DrawingML XML directly; reduces hallucination on structural fields.
3. **5 atomic edits** — minimal sufficient action set: delete-span, delete-image, clone-paragraph, replace-span, replace-image. Composable to reach any content edit.
4. **REPL self-correction** — failed edits get execution feedback, LLM iterates up to N=2 times.
5. **Two-tier clustering** — structural slides (Opening/TOC/SectionOutline/Ending) detected by position-aware rules; content slides clustered by image similarity (θ=0.65).
6. **PPTEval as both metric and signal** — three orthogonal scoring axes, each with a 1-5 anchored rubric, designed so the LLM-as-judge can score sensibly with reasonable inter-rater agreement (κ≈0.59).
7. **DeepPresenter evolution** — moves from "edit reference slides" to "free-form visual design + autonomous asset creation + environment-grounded reflection", but PPTEval remains the evaluation backbone.

