# 19. danny0926/ppt-skills (Excalidraw Slides) + daymade/ppt-creator + lewislulu/html-ppt-skill

> 调研对象：三个以 "Claude Code Skill" 形式发布的 PPT 生成项目。
> 这三个项目对智文平台格外重要——我们的最终研究交付物本身可能就是一个 Claude Code Skill，因此它们的 SKILL.md 结构、prompt 工程、目录组织都是直接可借鉴的模板。
> 项目链接：
> - github.com/danny0926/ppt-skills（主要分析对象）
> - github.com/daymade/claude-code-skills（ppt-creator 子目录）
> - github.com/lewislulu/html-ppt-skill（对比参考）

---

## 1. 项目概览

**danny0926/ppt-skills**（自称 "Excalidraw Slides"）是一个手绘风格的 AI PPT 生成器，把文本/大纲/PDF 转成"看起来像手画"但**文字仍可编辑**的 PPTX。技术栈：Python（python-pptx + Jinja2 + Playwright + lxml） + 前端 CDN（rough.js + rough-notation + Mermaid + Chart.js + Google Fonts）。仓库语言占比 Python 77% / Jinja 23%。MIT 许可。差异化卖点：
1. **手绘 / Excalidraw 风格**——通过 rough.js 渲染粗糙线条、roughness 0-3 可调；
2. **双层可编辑（dual-layer editable）架构**——手绘图层做成 PNG 背景，文字层用原生 python-pptx TextBox，用户拿到 .pptx 后可以直接改文字；
3. **作为 Claude Code Skill 分发**——把 `docs/` 目录放到 `.claude/skills/excalidraw-slides/` 即可被自动调用；
4. **Playwright 渲染**——HTML→PNG，6 阶段 pipeline 中显式包含"视觉复审"环节（Phase 5 让 AI 用 Read 工具看 PNG 再修复）。

**daymade/ppt-creator** 是另一种思路：标准 Anthropic Skills 格式（YAML frontmatter + `references/` + `scripts/`），核心 IP 是金字塔原则 + 论断-证据叙事，配 10 项评分 RUBRIC（≥75 分才交付，否则自动迭代 ≤2 次），双路径生成两份 PPTX 让用户对比。

**lewislulu/html-ppt-skill** 是纯 HTML 路线：36 主题 + 15 整 deck 模板 + 31 单页 layout + 47 动画 + 演讲者模式（S 键弹四磁卡：CURRENT/NEXT/SCRIPT/TIMER，通过 `<iframe ?preview=N>` 实现像素级一致预览，`postMessage` + `BroadcastChannel` 跨窗同步）。完全无构建。

---

## 2. Skill 格式拆解

**两种 Skill 格式并存，对我们设计自己的 skill 很关键：**

**A. 文档式（danny0926）——不用 YAML frontmatter**
```
docs/
├── SKILL.md          ← 主入口，prose 写 trigger
├── DESIGN_SYSTEM.md  ← 大量参考资料
└── STYLE_PRESETS.md  ← 主题预设
gen_pptx.py            ← 仓库根目录的可执行脚本
render_slides.py
```
SKILL.md 中显式说明 Trigger："Use when the user wants to create a presentation / PPT / slides / 簡報, especially with a hand-drawn or sketch style. Keywords: PPT, PPTX, slides, 簡報, presentation, hand-drawn slides, excalidraw slides."

**B. 标准 Anthropic Skills 格式（daymade、lewislulu）——有 YAML frontmatter**
```yaml
---
name: ppt-creator
description: "Create professional slide decks from topics or documents. Generates structured content with data-driven charts, speaker notes, and complete PPTX files. Applies persuasive storytelling principles (Pyramid Principle, assertion-evidence). Supports multiple formats (Marp, PowerPoint). Use for presentations, pitches, slide decks, or keynotes."
---
```
目录用 `references/` 而非 `docs/`，`scripts/` 而非根目录脚本。lewislulu 的 description 极长且塞满中文触发词（"幻灯片、演讲稿、做一份 PPT、小红书图文..."），明显是为了提高被 Claude 自动召回的概率。

**结论**：标准格式（B）更符合 Anthropic 官方惯例、可直接 `claude plugin install`；文档式（A）灵活但要靠用户手动放置文件。我们若要做发行版，建议走 B；若要做内部约束式工作流，A 更轻。

---

## 3. 核心架构（以 danny0926 为主）

**6 阶段 pipeline**（这是 SKILL.md 的骨干）：
```
Phase 1 Content Structuring  → 拆成"一页一信息"的 outline
Phase 2 Style Selection       → 从 6 个 preset 中挑一个
Phase 3 Layout Planning       → 给每页分配 layout type，强制多样性
Phase 4 HTML Generation       → 写出每页的 html/css/shapes_js/elements
Phase 5 Render + Visual Review → Playwright → PNG → Read 工具看图 → 修
Phase 6 Assemble PPTX         → gen_pptx.py 装配
```

**JSON Schema 是关键中介**——AI 不直接写 PPTX，而是写一份 deck.json：
- 顶层 `style`：bg/text/roughness/stroke_width/font_map
- `slides[]`：每页含 `id` / `render_mode` ("dual" | "image_only") / `html` / `css` / `shapes_js` / `annotations_js` / `accent_index` / `elements[]`

`elements[]` 是双层架构的核心，每个元素是 textbox 或 image，坐标以 1920×1080 像素表达；gen_pptx.py 通过 `1 px = 6350 EMU` 换算成 PowerPoint 坐标。textbox 支持 `paragraphs[].runs[]` 嵌套结构，可以做混合字体/混合颜色的富文本。

**视觉优先约束（60/40 rule）**——这是它和其他项目最大差异：硬性规定"每页内容至少 60% 必须是视觉（图/图表/大数字/插画），文字最多 40%"。配合 "headlines ≤ 8 words"、"max 3 bullets" 三条数值化约束，把 LLM 容易"写满字"的倾向反向约束住。

**Layout 决策树**让 LLM 在 Phase 3 选择 layout 时有清晰规则：

```
Has a key statistic?          → big-number
Has a quote?                  → quote
Has a process/steps?          → process-flow or timeline
Has comparison data?          → split-visual or comparison
Has a concept to explain?     → visual-hero (rough.js illustration + text)
Has a list of items (≤6)?     → icon-grid
Has a list of items (>6)?     → two-column or three-column with icons
Has a diagram/architecture?   → diagram (image_only) or annotated-diagram
Has an image/photo?           → split-visual (image + text side-by-side)
Default                       → split-visual (placeholder image + text)
```

外加 5 条 variety rules：不能连续两页同 layout、title-bullets 10 页内最多 2 次、任意 5 页窗口至少 3 种 layout、每 4 页至少 1 个视觉强 layout、连续两页不能用同一种 rough.js 装饰图案。

---

## 4. prompt 工程（精彩段落引用）

**关于 visual-first 的硬约束**（SKILL.md 原文）：
> "60/40 rule: At least 60% of each content slide's area must be visual (images, diagrams, rough.js illustrations, big numbers, charts). Max 40% text."
> "Every content slide must have a visual: Either a concept illustration (rough.js), a placeholder image, a diagram, a chart, or a big-number display. No text-only slides except section-break/closing."

**关于图片占位符作为 prompt**（这条非常巧妙，值得直接挪用）：
> "When src is null, the label text appears inside the placeholder box. Write the label as a ready-to-use image generation prompt so the user can copy-paste it directly into any AI image tool (Gemini, DALL-E, Midjourney, etc.)."
> "Bad: '[Insert diagram here]', '[Add relevant image]'"
> "Good: 'Hand-drawn funnel: raw data → filtering → clean insights, sketch style, white background'"
> "Good: 'Minimal illustration of a neural network with 3 layers, hand-drawn style, blue and orange nodes'"

——这把"图片缺位"从 bug 变成了用户的下一步行动，且 label 不只是描述，而是一个 30 词以内、含风格 cue 的可执行 prompt。

**关于装饰选择矩阵**（DESIGN_SYSTEM.md）：
> "One primary decoration per slide. If the layout already contains a visual element (illustration, diagram, image), that IS the decoration — do not add a border frame on top."
> "Roughness consistency. Keep roughness between 1.5-2.5 for decorations. Lower values (0.5-1) for small details like dots; higher values (2.5-3) for large background elements only."

**daymade 的金字塔原则约束**：
> "Information Organization: Conclusion first, then evidence (Pyramid Principle). Each slide conveys only 1 core idea. Headings must be testable assertion sentences, not topic labels."
> "Evidence-First: Use charts/tables/evidence blocks instead of long paragraphs; limit to 3-5 bullet points per slide."

daymade 还有一个独到机制：**RUBRIC 自评分 + 自动迭代**——10 项 0-10 分，总分 <75 就找最弱 3 项重做，最多 2 轮。这把"质量"做成数值闭环。

---

## 5. dual-layer editable 机制（核心创新）

danny0926 最值得学的部分。原文（README）：
> "Each slide has two layers:
> - Layer 1 (background): Hand-drawn decorations rendered as PNG via rough.js + rough-notation
> - Layer 2 (foreground): Native python-pptx TextBox / Image elements — fully editable in PowerPoint"

实现细节：
1. **render_slides.py 的双模式渲染**——`--mode both` 同时输出 `slide_XX.png`（完整预览，用于 AI 视觉复审）和 `slide_XX_bg.png`（仅背景，用于 PPTX）。
2. **Ghost CSS**——bg_only 模式注入一段 CSS 让 `#content` 及全部子元素 `color:transparent; -webkit-text-fill-color:transparent; background-color:transparent; box-shadow:none`，并把 `img/svg.mermaid-svg/canvas` 设为 `opacity:0`。**但 `<svg id="rough-layer">`（rough.js 容器）不在 #content 内，所以装饰仍可见**。
3. **gen_pptx.py 装配**——把 bg PNG 全幅插入，然后用 `elements[]` 坐标在上面放原生 python-pptx 形状。坐标换算 `1 px = 6350 EMU`。CJK 文字通过 `a:ea` typeface 在每个 run 上自动处理。
4. **混合 render_mode**——简单文本页用 `"dual"`，Mermaid/Chart.js 页用 `"image_only"`（因为这些 viz 没法在 PPTX 里原生重现，只能烤进 PNG）。

效果：用户得到一份"看起来像 Excalidraw 手画"但**双击文字就能改**的 .pptx。这是 PPT 输出领域罕见的体验——一般的"AI PPT 工具"要么输出图片 PPT（不能改），要么输出纯结构化 PPT（没设计感）。这个折中方案直击痛点。

---

## 6. 对 IntelliFlow 的可迁移点

我们的最终交付物有可能就是个 Claude Code Skill，因此分两块讨论：

### A. 设计我们自己的 Skill 时可直接借鉴

1. **走标准 Anthropic Skills 格式（YAML frontmatter）**——参考 daymade。`description` 一定要塞满中英文触发关键词（"智文、文档生成、合同、报告、PPT、流程编排..."），最大化被自动召回的概率。
2. **目录组织用 `references/` + `scripts/`**——主入口 SKILL.md 不超过 200 行，所有详细规则拆到 references 下按需加载。lewislulu 的 references 拆法（themes.md / layouts.md / animations.md / authoring-guide.md / presenter-mode.md）值得抄。
3. **多阶段 pipeline + JSON Schema 中介**——别让 LLM 直接产出最终文件，要它先产出结构化 JSON（节点编排、模型调用、脱敏映射），再由确定性脚本组装。我们的 5 节点编排刚好对应这套理念。
4. **视觉/质量复审环节**——Phase 5 让 LLM 用 Read 工具看渲染产物再修复，是关键创新。我们的 v4 流程也应该在文档输出后做"自检读回 → 改进"的 loop。
5. **自评分 RUBRIC**——daymade 的 ≥75 分阈值 + 最多 2 轮自动迭代，是个轻量但有效的质量门。我们可以为不同文档类型（合同/报告/方案）各做一份 RUBRIC。
6. **placeholder 即 prompt**——把缺失资源（图片、数据、表格）的占位符直接写成下一步 AI 工具的可复制 prompt。我们的素材库缺失场景可以同样处理。

### B. 应用到 IntelliFlow 现有 pipeline

1. **HTML→PNG→插入 office 文档的渲染思路**——我们 v4 的"文件导出"节点如果要支持 PPTX/DOCX 的视觉化输出，可以照搬这套 Playwright pipeline，把复杂图表 HTML 烤成 PNG 再嵌入。
2. **双层架构延伸**——智文的合同/报告也可以做"背景视觉层 + 可编辑文字层"，让用户拿到 .docx/.pptx 后能直接改而不丢设计。
3. **layout 决策树 + variety rules**——可作为我们"模型调用节点"输出阶段的提示词组件，强制 LLM 在结构选择上避免单调。
4. **6 主题预设**——给智文平台的输出文档也做几个预设主题（正式公文、商业提案、技术报告、轻量备忘），用 JSON `style` 块切换。
5. **CJK 字体自动处理**——`a:ea` typeface 注入在每个 run 上的做法，我们做中文 PPTX 时必抄。

---

## 7. 风险/局限

1. **danny0926 的手绘风格相对小众**——formal 商业场景里 rough.js 不一定合适，我们不能直接用其美学风格，但 pipeline 和架构可以学。
2. **依赖重**——Playwright + Chromium + 多个 CDN（rough.js / rough-notation / mermaid / chart.js / Google Fonts）。**Google Fonts 在内网部署时会失败**，需要本地化 CDN 或字体内嵌；这是我们部署时必须解决的。
3. **双层架构的坐标精度难题**——px→EMU 换算导致字位置可能和背景装饰错开 1-2 像素。danny0926 用大段视觉复审来兜底，但成本高（每页都要 LLM 重新看 PNG）。
4. **`elements[]` 的双重维护**——同一份内容要写两遍（HTML 用于渲染、elements JSON 用于 PPTX），LLM 容易写出不一致的版本。daymade 走 Marp + document-skills:pptx 双路径输出两份 PPTX 让用户对比，是另一种应对方式但更耗 token。
5. **danny0926 不用 YAML frontmatter**——意味着无法被 Claude 的 skill marketplace 自动召回，需要用户手动放置文件。我们若发行 skill 必须用标准格式。
6. **daymade 的 RUBRIC 自评分有"自我验证"陷阱**——LLM 评 LLM 自己产出的分数通常偏高。需要在 RUBRIC 题目里加客观可测的项（字数上限、必含字段、引用数量等）。
7. **lewislulu 的演讲者模式（S 键 4 卡）**虽然不直接适用于我们的文档场景，但它的 `<iframe ?preview=N>` 实现像素级预览 + `postMessage`/`BroadcastChannel` 跨窗同步的技巧，可用于我们前端"编排预览/对比生成"场景。

---

**总评**：danny0926 在"Skill 工程 + Pipeline + 视觉/编辑性平衡"三方面都给出了可学的范本，dual-layer editable 是它的核心创新；daymade 在"质量评分闭环"上有亮点；lewislulu 在"主题/动画系统化 + 演讲者体验"上是另一种纯前端路线。这三个项目共同验证了"以 Claude Code Skill 形式发行文档生成能力"是可行的，而且 6 阶段 pipeline + JSON Schema 中介 + 视觉复审 + 自评分迭代这套范式已经被独立项目反复采用，可以作为我们最终交付物的骨架。
