# 14 — Presenton (presenton/presenton)

> Repo: https://github.com/presenton/presenton — Apache-2.0
> Source notes: `01-raw-sources/others/presenton-RAW.md`

## 1. 项目概览

Presenton 把自己定位为 Gamma / Beautiful AI / Decktopus 的开源替代，强调 "self-host, integrate via API, generate pixel-perfect decks in minutes. No vendor lock-in"。主入口 `POST /api/v1/ppt/presentation/generate` 接受 content/markdown slides、tone（default/casual/professional/funny/educational/sales_pitch）、verbosity（concise/standard/text-heavy）、slide count、language、template 等参数，并支持可选的 web search grounding 与 extended reasoning。

部署形态丰富：
- Electron 桌面应用（macOS 双架构 / Windows x64 / Linux x64），内置 FastAPI 后端，需 Node LTS + Python 3.11。
- Docker：`docker run -it --name presenton -p 5000:80 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest`。
- 托管云 presenton.ai 与 API tier。

认证为最简形态——单管理员、`AUTH_USERNAME` + `AUTH_PASSWORD` 环境变量、HTTP Basic 加在 REST 端点上。模型层面支持 OpenAI / Google / Anthropic / Azure / Vertex / Ollama 以及任意 OpenAI-compatible 端点；图像层面支持 DALL-E 3、GPT-Image-1.5、Gemini Flash、NanoBanana Pro、Pexels、Pixabay、ComfyUI、Open WebUI。Memory 采用 Mem0 + 本地 Qdrant + SQLite。

## 2. 架构

代码库分两层：`servers/fastapi/`（Python，主 AI pipeline）和 `servers/nextjs/`（前端 + layout 渲染器）。两者并行运行，FastAPI 通过 `endpoints/layouts.py` 反向代理到 `http://localhost:3000/api/layouts` —— **layout 渲染权完全归 Next.js**，Python 只做编排。

`presentation.py` 编排端到端流程：
1. 校验请求参数。
2. **大纲生成**（若用户已给 markdown slides 则跳过）—— SSE 流式 `generate_ppt_outline()`。
3. **布局选择** —— "Selecting layout for each slide"，每个 outline 节点映射到一个 slide layout。
4. **结构生成** —— `PresentationStructureModel` 记录每张幻灯片用哪个 layout（非有序 layout 用随机化）。
5. **TOC 插入** —— 可选目录页。
6. **幻灯片正文生成** —— 10 路并发 LLM 调用，每张幻灯片对照其 layout 的 JSON Schema 生成 JSON；schema 上 `__image_url__` / `__icon_url__` 字段被剥离，注入 `__speaker_note__: string`（minLength=100, maxLength=500）。
7. **资源抓取** —— 图像 + 图标与幻灯片生成 **并行**（关键延迟优化点）。
8. **入库**：presentation / slides / assets 落 DB。
9. **导出**：渲染为 PPTX/PDF，触发 webhook。

前端栈：Next.js + React + TSX，幻灯片本身是 React 组件（不是 HTML 模板字符串）。

## 3. 主题系统

Presenton 不像 Allweone 那样把"主题"做成预置的 38 套设计 token —— 它的主题更窄：**颜色调色板**。

`theme_generate.py` 的请求体只暴露 6 个颜色字段：

```python
class GenerateThemeRequestV3(BaseModel):
    primary: Optional[str] = None
    background: Optional[str] = None
    accent_1: Optional[str] = None
    accent_2: Optional[str] = None
    text_1: Optional[str] = None
    text_2: Optional[str] = None
```

调色由 `generate_color_palette()` **确定性算法**生成（非 LLM），产出 `ThemeData`：primary/background、card+stroke 变体、文本色、还有 `graph_0…graph_9` 数据可视化专用色板。

CRUD：`/themes/default`（内置）、`/themes/all`、`POST /create`、`PATCH /update/{id}`、`DELETE /delete/{id}`。自定义主题作为一整块 JSON 存在 `KeyValueSqlModel` 的 `presentation_custom_themes` 键下。

**主题与 layout 解耦**：layout 是 TSX 组件，可在自助创建页 `(presentation-generator)/custom-template/` 内通过 LLM 从一张幻灯片图片生成 TSX + Zod schema。Presenton 的 PPTX/PDF 主题 import 在落地页提及（"AI-powered template conversion from existing PPTX/PDF files"），但实际逻辑落在 `presentation-export/index.cjs` 这块 5.87 MB 的封装产物里，未公开源码。

## 4. Prompt 工程

四组核心提示词：

**(1) 大纲** —— `utils/llm_calls/generate_presentation_outlines.py`：
> "Generate presentation title and content for slides … Presentation title should be plain text, not markdown. Follow user instructions strictly and literally without reinterpretation. Apply slide-specific instructions only to the exact slide mentioned and only once. Slide content must follow markdown format with `##` titles. Make sure data used is strictly from the provided content/context. Use the web search tool when the user request requires current, factual, or external information."

用户模板：
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

**(2) 布局选择** —— `generate_presentation_structure.py`（184 行）。关键规则：
> "If content contains table, then select either table layout or graph layout."
> "Don't select layout with image unless content contains image."

**(3) 幻灯片正文** —— `generate_slide_content.py`：
> System: "Analyze the content. Analyze the response schema. Generate structured content json based on the schema."
> User: "Current Date and Time: [timestamp]. Icon Query And Image Prompt Language: English. Slide Language: [language]. SLIDE CONTENT: [content]"

**(4) Layout 模板生成** —— `templates/prompts.py` 的 `SLIDE_LAYOUT_CREATION_SYSTEM_PROMPT`：把一张幻灯片图像喂给 LLM，要求同时输出 Zod schema 与 TSX 组件，并约束：
- 分析视觉层级
- 区分装饰元素 vs 内容元素
- 固定 **1280×720 px** 画布
- 用 flex/grid 而非 absolute
- 只用 "PROVIDED FONTS" 名单内的字体
- 不准写注释，输出合法 TSX

`SLIDE_LAYOUT_EDIT_SYSTEM_PROMPT` / `..._SECTION_..._PROMPT` 负责增量改 layout，保留可工作路径，并自动剪去未使用的 schema 字段。

## 5. 图像生成

`services/image_generation_service.py` 统一三类 provider：
- **库存**：Pexels、Pixabay —— prompt 直传，拿到 URL 即可。
- **生成式**：DALL-E 3、GPT-Image-1.5、Gemini Flash、NanoBanana Pro —— 注入完整的 image prompt + theme 上下文。
- **自托管**：ComfyUI（提交 workflow → 轮询 → 下载）、Open WebUI（base64 或相对 URL）、任意 OpenAI-compatible 端点。

返回形式两种：HTTP URL（库存/远端）或本地文件转 app-data URL（`ImageAsset`）。若图像功能被禁用，回退占位图。

图标走另一条路 —— `services/icon_finder_service.py` 用 **FastEmbed `AllMiniLML6V2`** 做语义向量检索，索引以 `f"{each['name']}||{each['tags']}"` 嵌入，查询 `vectorstore.search()` —— 关键词不匹配也能命中（如 "growth" 命中 "trending_up"）。本地缓存在 `fastembed_cache/`。

外部 GET 端点：`/api/v1/ppt/images/generate?prompt=...`，跑 `ImagePrompt` → 服务 → 本地落 `ImageAsset`。

## 6. 导出机制

**核心反直觉点**：实际 PPTX 输出在 `presentation-export/index.cjs` —— 一个 5.87 MB 的 bundled CommonJS（GitHub 因为太大拒绝渲染源码）。它由 `export_task_service.py` 在 FastAPI 编排器里 spawn 出来，输入是 Next.js 渲染器产出的 HTML/JSON 表示，输出是 PPTX —— 基本可以确认底层是 **pptxgenjs**（Allweone 也是同款）。

另有反向通路用于 preview/缩略图：
- `pptx_slides.py` 把上传的 PPTX 转 PDF（LibreOffice headless）
- `pdf_slides.py` 再把 PDF 转 PNG（ImageMagick）

PDF 导出走同套通路。

## 7. 对 IntelliFlow 的可迁移点

IntelliFlow 当前用 4 层 LandPPT 风格 pipeline + headless Chrome + pptxgenjs 出图。Presenton 提供几个直接可借鉴的点：

1. **资源与正文并行抓取**（pipeline 第 6/7 步）—— 我们现在是串行 LLM → 然后图，这里 10 并发幻灯片 + 并行 icon/image 抓取可显著降低总延迟。落到我们 4 层架构上就是 P3（内容）和 P4（资源）并发。
2. **layout 选择 = LLM 任务，不是规则**（`generate_presentation_structure.py`）—— 把 layout 池暴露给 LLM 让它根据 outline 选择，比硬规则更鲁棒，对"多页视觉一致性"也更友好（同一报告类型 LLM 倾向选同套 layout）。
3. **FastEmbed 语义图标检索** —— 我们的"图标统一"需求可以直接借鉴这套，`AllMiniLML6V2` 模型小，本地化容易，避免 keyword miss。
4. **theme 数据可视化色板** —— `graph_0…graph_9` 这种 10 色调色板用于图表配色，正好补齐我们"跨页视觉一致性"的图表部分。
5. **layout 自助生成** —— LLM 把幻灯片图像翻译成 TSX + Zod schema，固定 1280×720、字体白名单约束 —— 我们如果想支持"用户上传一张参考 PPT，自动出 layout"可以照搬。
6. **schema 注入 speaker note** —— 把演讲备注作为强约束 (`minLength=100, maxLength=500`) 嵌进 schema，比单独再起一次 LLM 调用便宜。
7. **MCP via FastMCP.from_openapi** —— 一行代码让所有 REST 端点变成 MCP tool，未来如果要接 Claude/agent 工具调用是最低成本路径。
8. **Mem0 + Qdrant + SQLite 做 presentation-scoped memory** —— 我们后续多模型对比/迭代场景，让模型记住"用户偏好哪一版"非常需要这种轻量记忆层。

## 8. 风险 / 局限

1. **核心导出器闭源化**：`presentation-export/index.cjs` 是一个 5.87 MB 黑盒 bundle，无法直接审计，也无法 fork 改造。如果我们想完全掌控 PPTX 输出，得自己重做。
2. **layout 与 Next.js 强耦合**：layout 是 TSX 组件，渲染必须经 Next.js 进程；headless 渲染要再起一个 SSR/headless 浏览器，部署链路比纯 Python 复杂。
3. **认证薄弱**：单 admin + HTTP Basic + 环境变量。多部门企业内部场景不可用，必须套自家 RBAC。
4. **theme = 仅颜色**：没有字体/圆角/阴影维度的完整 design token —— 我们要"跨页字体/排版一致"得自己补这层。
5. **PPTX 主题导入未开源**：landing page 提到 "AI-powered template conversion from existing PPTX/PDF"，但代码在 export bundle 中。Allweone 那边反而开源了 `pptx-theme-extractor.ts`，可借鉴它。
6. **memory backend 强依赖 Mem0 OSS + Qdrant**：自托管栈更重，对运维和我们的"PostgreSQL + 文件系统"既定架构是负担。
7. **没有 outline 可视化编辑**：大纲走 SSE 流式但没有显式的 ProseMirror/Tiptap 编辑器层；用户改大纲只能通过自由文本反提示，迭代闭环不闭。Allweone 在这点上更成熟。
8. **slide-edit 双路径**：`edit_slide.py`（结构化）和 `edit_slide_html.py`（HTML 直改）由 `select_slide_type_on_edit.py` 选——分支多但缺乏统一抽象，引入维护负担。
9. **layout 池规模未公开**：内置 layout 数量、命名、覆盖场景没有清晰文档，与 Allweone 的"15 layout components 名单 + 38 themes"清单式描述形成对比。
10. **图像 prompt 与 theme 上下文耦合方式不透明**：要做"全 deck 视觉风格统一"得读 service 代码确认是否真的把 theme 注入到每次图像生成请求中。
