# oh-my-ppt (arcsin1) - 原始素材

> 来源: https://github.com/arcsin1/oh-my-ppt
> 抓取时间: 2026-05-20
> 作者: arcsin1 (zy19931129@gmail.com)
> License: MIT
> Stars 1.2k · Forks 115 · 最新版本 v2.0.10 (2026-05-18)

---

## 1. README 完整内容（节选要点）

### 标语

> "Describe what you need — a presentation, lesson, or story — and let the AI build clean, beautiful HTML slides for you. Local-first · Works offline, works for you."

### Why I Built This

> "There are many AI PPT tools, but most output fixed-format files. Fine-tuning styles or adding custom animation demos is still painful. So I built my own HTML-based PPT generator. Output is pure HTML slides: instant browser preview, no extra software, easy to tweak styles, add motion, embed code, and export to PDF / PNG / editable PPTX."

### What It Can Do（特性）

- One-prompt generation - 输入主题+要求，AI 规划 outline + palette + layout，生成完整 deck
- Document-based creation - 上传 txt/md/csv/docx 自动提取主题/页数/描述，全过程保留源文档
- Import PPTX for editing - 把本地 pptx 转成 app 内 HTML 页面，继续编辑
- Image-based style and outline generation - 上传截图/设计稿，自动提取视觉风格 + 生成大纲
- Local-first - 本地运行，无注册无上传
- Font management - 14 款 Google Fonts (含中文)，可上传本地字体，标题/正文分别选
- 30+ style skills - Minimal White, Cyber Neon, Bauhaus, Japanese Minimal, Xiaohongshu White ...
- Chat-based editing - 对某一页说 "change title color" / "add a data chart"
- 可视化编辑 - 拖拽、缩放每一个元素；每个元素也可被 AI 选中后修改
- 图片/视频插入 - 编辑模式直接上传
- 元素复制 - 一键复制任意元素
- Undo/Redo
- Element delete
- Presentation mode - 全屏演示，键盘导航
- Animation - 切页动画 + Anime.js v4 基础整体元素动画
- Math formula - 常用 LaTeX 公式
- Multi-format export - PDF / 批量 PNG / 可编辑 PPTX（嵌入字体）
- Session management - 区分 AI 生成 deck vs 导入 pptx
- 16:9 固定画布 + content-height 预算，减少 overflow
- Version history rollback
- One-click packaging - 把 HTML deck 打包成单可执行文件（双击打开即可）
- 会话文件 import/export - 跨设备协作

### Workflow

> "Input your intent or upload a document → AI plans outline → generates visual direction → renders page by page → preview & chat edits → export PDF / PNG / PPTX"

### Animation Support

> "Whole-element animation is preferred over splitting text into many tiny moving fragments. It keeps slides readable, stable, and better suited for reports, pitches, classes, and live demos."

最稳定的 4 类整体元素动画：
- Fade in（模块出现）
- Subtle slide-in motion（标题/卡片轻量滑入）
- Scale emphasis（关键数字/结论卡片轻微放大）
- Simple stagger（卡片或列表错峰显示）

### Local Ollama Support (OpenAI-Compatible)

Settings 填法：
- provider: `openai`
- base_url: `http://127.0.0.1:11434/v1`
- model: 本地 model tag (例 `qwen2.5-coder:14b`)，推荐 14B+ 或强云端模型
- api_key: 任意非空字符串（例 `ollama`）

> "The app does not use thinking / reasoning mode by default. When a custom OpenAI-compatible `base_url` is configured, the app asks the provider to disable thinking so document parsing, tool calls, and retry generation avoid `reasoning_content` compatibility issues."

### Export

> "Oh My PPT currently supports three export modes:
> - PDF: best for sharing, archiving, and printing.
> - PNG: batch-export every slide as an image for docs, Notion, articles, or social posts.
> - PPTX: export an editable file for PowerPoint / Keynote. Text, images, colors, formulas, and basic layout are preserved where possible, while text overlap, mixed-language layout, complex HTML, animation, and some charts are still being improved."

### Reference

- ui-ux-pro-max-skill: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- html-ppt-skill: https://github.com/lewislulu/html-ppt-skill

---

## 2. CHANGELOG 重点版本（v2.0.10 / v2.0.9 / v2.0.8）

### 2026-05-18 · v2.0.10

- 新增 element inspector panel：选中元素可独立调整文字样式（字号、粗细、颜色）、外观（背景色、边框、圆角、阴影）、布局、图层、媒体属性。
- 新增取色器：自定义取色板 + 透明度。
- 新增导出/导入会话文件：跨设备继续编辑。
- 新增编辑页面历史记录：自动记录操作历史，可回退到任意编辑步骤。
- 新增字体数据回填：升级后自动为已有会话补充字体信息。
- **优化生成成功率**：大幅提升页面生成稳定性，减少失败和格式异常，增加兜底策略，减少 token 消耗。
- 优化生成引擎：改进大纲规划和页面写入逻辑。
- 优化编辑交互。
- 修复风格预览 bug (Windows)。

### 2026-05-17 · v2.0.9

- 新增字体管理：14 款 Google Fonts (含 CJK)、上传 .woff2、字体名称/分类/用途/语言类型。
- 新增字体选择：标题字体 + 正文字体可分别设定，或交给 AI 自动匹配。
- 新增字体嵌入：导出 PPTX 时自动嵌入。
- 新增风格缩略图。
- 新增 Max Tokens 设置。
- 新增 Windows 系统托盘。
- 优化风格管理 / 内置风格的 prompt 与 style_skill。
- 优化 PPTX 导出（暂不支持视频和动画导出）。
- 默认最小字号 16px。
- 修复演示模式键盘鼠标 bug、Win11 批量导出图片失败、默认导出目录错误。

### 2026-05-15 · v2.0.8

- 优化数学公式导出：可编辑 PPTX 中公式以截图作为独立图片插入。
- 优化背景截图：导出时自动隐藏已截图的公式元素。
- 新增：一键打包当前 html pptx 为单个可执行文件。

---

## 3. 目录结构

```
oh-my-ppt/
├── README.md / README_ZH.md
├── CHANGELOG.md
├── Agent.md
├── CLAUDE.md
├── electron-builder.yml
├── electron.vite.config.ts
├── drizzle.config.ts          # Drizzle ORM 配置
├── tailwind.config.js
├── package.json (pnpm-lock.yaml)
├── docs/
├── resources/
└── src/
    ├── main/                  # Electron 主进程（agent 逻辑、tool 实现）
    │   ├── agent.ts           # createSessionDeckAgent / createSessionEditAgent
    │   ├── index.ts
    │   ├── tray.ts
    │   ├── db/                # Drizzle 本地数据库
    │   ├── history/           # 版本历史
    │   ├── ipc/               # 主<>渲染通信
    │   ├── prompt/            # 所有 prompt 模板
    │   │   ├── deck-system.ts          # 整套 deck 生成
    │   │   ├── edit-system.ts          # 编辑模式（单页/选择器/整套）
    │   │   ├── planning.ts             # 大纲规划 + 设计契约
    │   │   ├── generation-user.ts      # 用户消息装配
    │   │   ├── runtime-user.ts
    │   │   ├── shared.ts               # 通用 prompt 片段（画布约束等）
    │   │   ├── style-import-prompt.ts
    │   │   ├── style-image-import-prompt.ts
    │   │   ├── style-pptx-import-prompt.ts
    │   │   └── index.ts
    │   ├── session-import/    # 会话导入
    │   ├── tools/             # Agent 工具
    │   │   ├── deck-tools.ts           # createSessionBoundDeckTools
    │   │   ├── font-registry.ts        # 字体登记
    │   │   ├── html-utils.ts
    │   │   ├── page-fragment-normalizer.ts
    │   │   ├── page-writer.ts
    │   │   ├── types.ts
    │   │   └── index.ts
    │   └── utils/
    ├── preload/               # Electron preload
    ├── renderer/              # React + TS UI
    │   ├── index.html
    │   └── src/
    └── shared/                # 共享类型
        ├── app-update.ts
        ├── generation.ts
        ├── history.ts
        ├── image-mime.ts
        ├── layout-intent.ts
        ├── model-timeout.ts
        └── progress.ts
```

---

## 4. 技术栈

- Frontend: React + TypeScript 5.x + Tailwind CSS
- Desktop: Electron + Vite (electron.vite.config.ts)
- DB: Drizzle ORM (本地 SQLite)
- AI agent 框架: **DeepAgents** (LangChain Anthropic / LangChain OpenAI 双适配)
- Animation: Anime.js v4（内置 ./assets/anime.v4.js）
- Charts: Chart.js v4 (./assets/chart.v4.js)
- CSS Runtime: Tailwind v3 (./assets/tailwindcss.v3.js) - JIT browser runtime
- Math: KaTeX
- Code: ESLint + Prettier (注意 README 说 ESLint/Prettier，与 IntelliFlow 的 Biome 不同)

---

## 5. Agent 架构（src/main/agent.ts）

```typescript
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { FilesystemBackend, createDeepAgent, type EditResult } from "deepagents";

// 把 deepagents 内置的 edit_file 工具按场景禁用（防止 agent 走野路子）
class GuardedFilesystemBackend extends FilesystemBackend {
  async edit(filePath, oldString, newString, replaceAll?) {
    if (this.disableEditFile) {
      return { error: this.editBlockedReason };
    }
    return super.edit(...);
  }
}

export function createSessionDeckAgent(args) {
  const model = resolveModel(args.provider, args.apiKey, args.model, args.baseUrl, ...);
  const backend = new GuardedFilesystemBackend({
    rootDir: context.projectDir,
    virtualMode: true,
    disableEditFile: true,  // 生成场景始终禁 edit_file
    editBlockedReason: "请使用 update_single_page_file 或 update_page_file。",
  });
  const tools = createSessionBoundDeckTools(context);
  const systemPrompt = buildDeckAgentSystemPrompt(args.styleId, context);
  return createDeepAgent({ model, backend, systemPrompt, tools });
}

export function createSessionEditAgent(args) {
  // 编辑场景按 mode/selector 决定是否禁 edit_file
  const disableNativeEditFile = shouldBlockNativeEditFile(context);
  const backend = new GuardedFilesystemBackend({ ..., disableEditFile: disableNativeEditFile });
  const systemPrompt = buildEditAgentSystemPrompt(args.styleId, context);
  ...
}
```

关键设计：
- 使用 deepagents 库（一个 ReAct-style file-system + tool agent）
- 整个生成过程实际是 agent 在虚拟 FS 里写 `/<pageId>.html` 文件
- 用 `GuardedFilesystemBackend` 拦截 `edit_file` 等危险工具
- 模型走 LangChain (Anthropic 或 OpenAI-compatible)
- baseUrl 配了 OpenAI-compatible 时自动加 `thinking: { type: "disabled" }`

---

## 6. Pipeline 4 层（关键发现）

通过分析 prompt 模块，Pipeline 是：

```
1. Planning (buildPlanningSystemPrompt)
   → 输出 JSON 数组：[{ title, keyPoints[1-6], layoutIntent }, ...]
   → layoutIntent 枚举：cover / data-focus / comparison / timeline / concept / process / summary / quote / image-focus

2. Design Contract (buildDesignContractSystemPrompt)
   → 输出 JSON 对象：{ theme, background, palette[3-6], titleStyle, layoutMotif, chartStyle, shapeLanguage, titleFont, bodyFont }
   → 用 availableFonts + languageHint 限定字体
   → titleStyle 必须用 text-4xl 或 text-5xl（禁 6xl/7xl/8xl）

3. Deck Generation (buildDeckAgentSystemPrompt)
   → Agent 按 outline + design contract，逐页调用 update_page_file 工具写 HTML 片段
   → 工具校验：truncation、tag closure、ChartFrame 父容器高度、anime PPT.animate 写法等

4. (Optional) Edit
   → 单页 / selector / deck / index-container 4 个 mode
```

---

## 7. 关键 Prompt 全文 - planning.ts

```typescript
export function buildPlanningSystemPrompt(totalPages: number = 0): string {
  return [
    "You are a PPT structure planner. Plan slide titles and concise key points from the user's topic, requirements, and source-material brief.",
    '',
    CONTENT_LANGUAGE_RULES,
    '',
    '## Hard constraints',
    `Return exactly ${totalPages} slide plans. The JSON array length must equal ${totalPages}.`,
    `Never return fewer or more than ${totalPages} items.`,
    `If the material does not naturally fill ${totalPages} slides, split sections thoughtfully or add useful transition slides such as agenda, data overview, synthesis, next steps, or outlook.`,
    '',
    'Rules:',
    '- Titles should be concise, hierarchical, and aligned with the narrative.',
    '- The first slide is usually a cover; the last slide is usually a conclusion, summary, thank-you, or next-steps slide.',
    '- Key points must be short phrases, not long paragraphs. Provide 1-6 key points per slide.',
    '- Keep each key point compact and focused on the information type: data, chart, structure, conclusion, decision, or action.',
    '- Assign layoutIntent based on the slide content type:',
    '  - cover: opening or section divider slides',
    '  - data-focus: slides whose key points are primarily metrics, KPIs, trends, or quantitative results',
    '  - comparison: slides that compare 2+ options, alternatives, or before/after states',
    '  - timeline: slides about phases, stages, roadmap, or historical progression',
    '  - concept: slides explaining ideas, frameworks, principles, or viewpoints',
    '  - process: slides about how something works or step-by-step mechanisms',
    '  - summary: conclusion, key takeaways, or synthesis slides',
    '  - quote: slides built around a single statement or judgment',
    '  - image-focus: slides about products, scenes, people, or places where visuals dominate',
    '',
    'Return only a JSON array. ...',
    'Each item must use exactly these fields: title, keyPoints, and layoutIntent.',
    'Format example: [{"title":"Cover","keyPoints":["Project name and subtitle","Presenter and date","One-sentence thesis"],"layoutIntent":"cover"},...]',
    'Each slide must have 1-6 keyPoints.'
  ].join('\n')
}
```

---

## 8. 关键 Prompt 全文 - shared.ts CANVAS_CONSTRAINTS

```
## 画布约束
- 16:9（1600×900），系统自动缩放。可用内容区约 1584×884（外层有 p-2）。
- 用 Tailwind flex/grid 布局；禁止 w-[1600px]/h-[900px]/100vw/100vh/w-screen/h-screen 等画布锁定。
- 禁止 vw/vh 字体单位和 text-[clamp(...)]；h1 统一 text-5xl，禁 text-6xl/7xl/8xl。
- 禁止 iframe。禁止引用系统骨架类。
- 整套页面复用同一背景体系/主色/字体；背景铺满画布，定义在最外层容器上。
- 内容过长时精简文字和卡片；不要预留页脚/meta 区。
- 全局最小字号 16px，禁止 text-xs / text-sm / text-[12px] / text-[14px] 等小于 16px 的字号，正文最小 text-base。
```

---

## 9. 关键 Prompt 全文 - shared.ts FRONTEND_CAPABILITIES

```
## 前端能力（已内置）
每个 /<pageId>.html 已预注入：
- ./assets/anime.v4.js
- ./assets/tailwindcss.v3.js
- ./assets/chart.v4.js
- ./assets/ppt-runtime.js
- KaTeX
禁止重复插入；禁止任何 CDN 外链。

### 字体
装饰字体已由系统根据 design contract 自动注入（@font-face + CSS 变量），直接使用：
- 标题用 var(--ppt-title-font)
- 正文用 var(--ppt-body-font)
禁止手写 @font-face 或 <link> 引入外部字体，系统已自动处理。

### 图表 — 必须严格按此模板写
正确写法（高度写在 canvas 的直接父容器上）：
<div class="ppt-chart-frame relative h-[260px] w-full">
  <canvas class="h-full w-full"></canvas>
</div>
const chart = PPT.createChart(canvasEl, { type: "bar", data: {...}, options: {} });

错误写法（全部会被验证拦截，导致该页生成失败）：
- new Chart(ctx, config) → 必须用 PPT.createChart(el, config)
- canvas 上直接写 h-32 / h-full / flex-1 → 高度必须写在父容器
- canvas 父容器写 h-full / flex-1 / 只有 min-h-* → 父容器必须有明确 h-[...]
- 把 canvas 直接放进卡片/文本块 → 必须有专属 chart frame 父容器

### 动画 — 必须严格按此写法
PPT.animate 的第一个参数是 targets（CSS 选择器字符串或 DOM 元素），第二个参数是动画参数对象：
PPT.animate(".card", { opacity: [0, 1], translateY: [20, 0], duration: 500, delay: PPT.stagger(100) })

错误：把 targets 放在对象里
PPT.animate({ targets: ".card", opacity: [0, 1] })  // 会被拦截
anime({ targets: ".card" })                          // 会被拦截

### 其他硬校验禁区（违反即失败）
- 禁止 opacity-0 / invisible / visibility:hidden（初始态必须可见）
- <style> 中禁止写 opacity:0 / visibility:hidden / display:none
- 动画初始态写在 PPT.animate 参数里（如 opacity: [0, 1]），不要写在 CSS 或 class 中
- 数学公式用 \( \) 或 $$ $$，不用单 $
- 动画仅做轻量入场增强（opacity/translate/scale，300-700ms），禁止无限循环
```

---

## 10. 关键 Prompt 全文 - shared.ts PAGE_SEMANTIC_STRUCTURE

```
## 页面语义结构
- 直接输出完整创意页面片段；系统会自动包裹 section[data-page-scaffold]、main[data-role="content"] 和标准 page frame。
- 如果页面有明确标题，可以给第一个标题元素添加 data-role="title"；没有传统标题时不要为了校验硬造标题。
- 主动添加 data-block-id 时保持页面内唯一（kebab-case：metric-1、summary、chart-main）；未添加时系统会自动补齐。

布局决策：
- 先判断本页叙事重心：数据展示、概念解释、信息对比、流程时间线、结论收束、封面/章节页。
- 标题是阅读路径的一部分，不是固定装饰头部；它应该出现在最能引导阅读的位置。
- 数据页可以让图表/指标成为主视觉，标题靠边或与关键数字组合。
- 对比页优先考虑分区结构，标题服务于对比关系。
- 概念页可以使用中心主视觉、侧栏标题、图文交错或卡片组合。
- 总结页和封面页可以让标题占据视觉重心。
- 在同一套视觉语言下保持变化，不要机械重复同一标题位置和同一网格。

标题可读性底线：
- 竖排仅限 2-6 个中文字符的短标签。
- 标题包含英文、数字、年份、中英混排或长句时必须横排。
- 完整标题优先保证可读性，不要为了装饰牺牲阅读。
```

---

## 11. 关键 Prompt 全文 - shared.ts STABLE_HTML_FRAGMENT_PROTOCOL

```
## Stable HTML fragment protocol
- Submit only the creative body fragment. The tool will add section[data-page-scaffold], main[data-role="content"], data-block-id attributes, and the runtime page frame.
- Do not include <!doctype>, <html>, <head>, <body>, section[data-page-scaffold], main[data-role="content"], .ppt-page-root, .ppt-page-content, .ppt-page-fit-scope, or data-ppt-guard-root.
- Use one outer <div> as the fragment root.
- Prefer a shallow grid/flex structure with direct module children.
- Avoid nested cards and wrapper chains. Aim for 3 levels of nesting and avoid exceeding 4.
- If the page needs many ideas, reduce the number of modules before adding more containers.
- Decorative blocks should stay flat: a single absolute-positioned div, a few sibling decorative divs, or one SVG are all acceptable; avoid nested wrapper chains inside decoration.
- Before calling the write tool, check that every opened div/span/ul/li/p/table-related tag is closed and the fragment ends with a complete closing tag.
```

---

## 12. 关键 Prompt 全文 - shared.ts CONTENT_WRITING_RULES

```
## 内容写入规则
- 只输出页面片段（不是完整 HTML）。工具自动包裹 page frame、补 data-block-id。
- 禁止 <!doctype>/<html>/<head>/<body>/<meta>/<title>/<link>/<script src=...>。
- 禁止系统骨架标识：.ppt-page-root / .ppt-page-fit-scope / .ppt-page-content / data-ppt-guard-root。
- 所有标签必须成对闭合；items-center/justify-* 的父节点必须有 flex 或 grid。
- 标签闭合是最常见的失败原因。
- 控制嵌套层级：目标 3 层左右，避免超过 4 层。嵌套越深越容易漏闭合标签。
- 片段最外层优先只用一个 <div> 根节点。
- 精简 HTML 结构：用 Tailwind 类替代多层 wrapper div。
- 装饰块保持扁平。
- 默认禁止 emoji/贴纸装饰；单区最多 3 列；留白优先，不要塞满。
```

---

## 13. deck-system.ts 顶部巨大 CRITICAL 提示

```
⛔⛔⛔ CRITICAL — TOOL CALL IS MANDATORY ⛔⛔⛔
You MUST call update_single_page_file (single-page) or update_page_file (multi-page) to write every page.
Put ALL HTML into the tool's content parameter. Do NOT output HTML in your text reply.
A response without successful tool calls is a FAILED generation.

You are a PPT generation expert responsible for turning a planned page outline into slide HTML content.
You run inside a DeepAgents filesystem session and must write each slide into its own /<pageId>.html file through tools.

...

## 创意变化
- 在统一风格内制造每页的视觉惊喜：变化主视觉位置、标题进入方式、信息节奏、留白比例或局部装饰语言。
- 每页至少有一个清晰的视觉焦点，可以是关键数字、图表、产品/场景图、概念符号、时间节点或一句核心判断。
- 惊喜感服务于内容理解；不要为了变化加入无关装饰、复杂嵌套、遮挡文字或难以维护的结构。
- 同一套 deck 内避免连续页面使用完全相同的标题位置、卡片网格和背景分区。
```

进度上报机制：
```
report_generation_status labels and details must be written in {statusLanguage}, because they are application UI logs.
This status/log language is independent from deck content language.
progress must be a numeric literal such as 10, 35, or 88. Do not pass strings such as "10".
Progress must be detailed and monotonic. Suggested ranges:
  Analyzing request (8-18)
  Reading context (18-30)
  Writing pages (30-88, linear by page)
  Verifying (88-96)
  Completed (98-100)
Report once for each major action so the UI does not stay silent for too long.
```

---

## 14. Tool 工具集（deck-tools.ts 节选）

- `get_session_context` — 读 session 上下文与约束
- `report_generation_status(label, progress, detail)` — 进度上报
- `update_single_page_file(pageId, content)` — 单页写入（强校验）
- `update_page_file(pageId, content)` — 多页生成时按页写入
- `verify_completion()` — 验证目标页都填好了
- `set_index_transition(type, durationMs)` — 配置切页动画（只有 container-edit 任务可用）
- `read_file` — 读源文档
- 内置 `edit_file` 在生成/全局编辑场景被禁用，强制走 update_*

校验函数（validateIndexShellHtml 等）拒绝缺少 `frameViewport / pages-data / ppt-preview-frame / ppt-controls / hashchange / applyPage / framePool` 这些核心容器的 index 写入。

---

## 15. layoutIntent 枚举（shared/layout-intent.ts）

```
cover / data-focus / comparison / timeline / concept / process / summary / quote / image-focus
```

每个 intent 有专属的 prompt 提示（formatLayoutIntentPrompt），引导 Agent 在 HTML 片段里采取不同的版式策略。

---

## 16. 局限与已知问题（README 中坦承）

- PPTX 导出："text overlap, mixed-language layout, complex HTML, animation, and some charts are still being improved"
- 暂不支持视频导出、动画导出（HTML 复杂度导致导出无法完全一样）
- 数学公式在 PPTX 中以截图形式作为独立图片插入（避免 PowerPoint 不识别）
- 推荐 14B+ 模型（小模型生成质量不稳）
- Ollama 默认关 thinking，避免 reasoning_content 兼容问题
- macOS / Windows 未签名，首次启动需手动处理安全警告

---

## 17. 启发

1. **HTML-first 而非 PPTX-first**：用 Tailwind + Anime.js + Chart.js + KaTeX 一套 web 技术构造每一页 HTML，最终再导出 PDF/PNG/PPTX。这让风格变化和动画几乎是免费的。
2. **DeepAgents + Guarded FS**：用 agent 写文件而不是返回纯 JSON。文件本身就是 source of truth，可读、可 diff、可回滚。
3. **巨量硬约束**：CANVAS_CONSTRAINTS、CONTENT_WRITING_RULES、STABLE_HTML_FRAGMENT_PROTOCOL、FRONTEND_CAPABILITIES — 通过 prompt + 工具校验双重保险防止 LLM 写出 broken HTML。
4. **设计契约**：每套 deck 先生成一个 DesignContract（palette/titleStyle/layoutMotif/chartStyle/shapeLanguage/font），后续每一页都按这个契约渲染，保证视觉一致。
5. **layoutIntent 枚举**：在 Planning 阶段就给每页打标签，Generation 阶段按 intent 决定版式。
6. **进度上报协议化**：明确 progress 数值范围、报告频率、UI 日志语言独立于内容语言。
