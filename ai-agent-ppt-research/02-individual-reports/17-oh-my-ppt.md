# oh-my-ppt (arcsin1) 报告

> 来源: https://github.com/arcsin1/oh-my-ppt
> 作者: arcsin1 · License: MIT · Stars 1.2k · 最新版本 v2.0.10 (2026-05-18)
> 抓取时间: 2026-05-20

## 1. 项目概览

oh-my-ppt 是一款 **Electron 桌面端、HTML-first 的本地 AI PPT 生成器**。标语是 "Local-first · Works offline, works for you"——无需注册、不上传数据，全部在本地通过用户配置的 LLM（Anthropic / OpenAI-compatible / 本地 Ollama）完成生成。作者动机直白："There are many AI PPT tools, but most output fixed-format files. Fine-tuning styles or adding custom animation demos is still painful. So I built my own HTML-based PPT generator."

技术栈：React + TS + Tailwind v3（JIT 浏览器运行时）+ Electron + Vite + Drizzle ORM (SQLite) + **DeepAgents** (LangChain Anthropic/OpenAI 双适配) + Anime.js v4 + Chart.js v4 + KaTeX。最终每张幻灯片是一个 `/<pageId>.html`，再用浏览器渲染/截图导出 PDF / PNG / 可编辑 PPTX。支持从 txt/md/csv/docx 文档生成、从截图风格化、从 PPTX 反向导入编辑、聊天式编辑、可视化拖拽、版本历史回退、单可执行文件打包等高级特性。

## 2. 架构 — Pipeline Stages

源码组织在 `src/main/`（Electron 主进程，负责 agent 逻辑和工具）和 `src/renderer/`（React UI）。Pipeline 实际是 4 层，由 `src/main/prompt/` 下的多个 system prompt 与 `tools/deck-tools.ts` 串成：

1. **Planning**（`planning.ts::buildPlanningSystemPrompt`）—— 输出 JSON 数组：`[{ title, keyPoints[1-6], layoutIntent }, ...]`，且数组长度必须严格等于 `totalPages`。每页打上 `layoutIntent` 标签（9 种枚举）。
2. **Design Contract**（`planning.ts::buildDesignContractSystemPrompt`）—— 输出 JSON 对象：`{ theme, background, palette[3-6], titleStyle, layoutMotif, chartStyle, shapeLanguage, titleFont, bodyFont }`。字体被限定在 `availableFonts + languageHint` 之内，`titleStyle` 必须用 `text-4xl` 或 `text-5xl`（禁 6xl/7xl/8xl）。
3. **Deck Generation**（`deck-system.ts::buildDeckAgentSystemPrompt`）—— DeepAgents 在虚拟文件系统里按页调用 `update_single_page_file(pageId, content)` 或 `update_page_file`，把片段写入 `/<pageId>.html`。每次写入都过 `page-fragment-normalizer.ts` 和 `page-writer.ts` 的强校验。
4. **Edit**（`edit-system.ts`）—— 4 个 mode：single page / selector / deck / index-container，按场景禁用或开启 deepagents 内置的 `edit_file` 工具。

关键设计是 `GuardedFilesystemBackend extends FilesystemBackend`：在生成场景始终设 `disableEditFile: true`，强制 agent 走 `update_*_file`；编辑场景再按 mode 决定是否解禁。配合 baseUrl 检测，若是 OpenAI-compatible 提供方则自动加 `thinking: { type: "disabled" }` 兜底 reasoning_content 兼容性。

`layoutIntent` 9 种值（`shared/layout-intent.ts`）：
```
cover / data-focus / comparison / timeline / concept / process / summary / quote / image-focus
```
每个 intent 通过 `formatLayoutIntentPrompt` 注入差异化版式提示。

## 3. Prompt 工程要点

oh-my-ppt 的 prompt 资产非常厚——几个共享 prompt 片段（CANVAS_CONSTRAINTS、FRONTEND_CAPABILITIES、PAGE_SEMANTIC_STRUCTURE、STABLE_HTML_FRAGMENT_PROTOCOL、CONTENT_WRITING_RULES）通过 `shared.ts` 复用到所有 system prompt 中，构成了一套"硬约束矩阵"。

**画布约束（CANVAS_CONSTRAINTS）**：

```
- 16:9（1600×900），可用内容区约 1584×884（外层有 p-2）。
- 禁止 w-[1600px]/h-[900px]/100vw/100vh/w-screen/h-screen 等画布锁定。
- 禁止 vw/vh 字体单位和 text-[clamp(...)]；h1 统一 text-5xl，禁 text-6xl/7xl/8xl。
- 全局最小字号 16px，禁止 text-xs / text-sm / text-[12px] / text-[14px]，正文最小 text-base。
- 整套页面复用同一背景体系/主色/字体；背景铺满画布，定义在最外层容器上。
```

**图表硬模板（FRONTEND_CAPABILITIES）**：

```
正确写法（高度写在 canvas 的直接父容器上）：
<div class="ppt-chart-frame relative h-[260px] w-full">
  <canvas class="h-full w-full"></canvas>
</div>
const chart = PPT.createChart(canvasEl, { type: "bar", data: {...}, options: {} });

错误写法（全部会被验证拦截，导致该页生成失败）：
- new Chart(ctx, config) → 必须用 PPT.createChart(el, config)
- canvas 上直接写 h-32 / h-full / flex-1 → 高度必须写在父容器
- canvas 父容器只有 min-h-* 或 h-full → 父容器必须有明确 h-[...]
```

**动画约束**：

```
PPT.animate(".card", { opacity: [0, 1], translateY: [20, 0], duration: 500, delay: PPT.stagger(100) })

禁止：opacity-0 / invisible / visibility:hidden（初始态必须可见）
<style> 中禁止写 opacity:0 / visibility:hidden / display:none
动画初始态写在 PPT.animate 参数里，不要写在 CSS 或 class 中
动画仅做轻量入场增强（opacity/translate/scale，300-700ms），禁止无限循环
```

**HTML fragment 协议（STABLE_HTML_FRAGMENT_PROTOCOL）**：要求只输出"创意 body fragment"，禁 `<!doctype>`/`<html>`/`<head>`/`<body>` 和系统骨架类，工具会自动补齐外层。强调嵌套不超过 4 层、最外层一个 `<div>` 根、所有标签成对闭合。

**deck-system.ts 顶部巨大 CRITICAL 提示**直接用 emoji 围栏强调工具调用强制性：

```
⛔⛔⛔ CRITICAL — TOOL CALL IS MANDATORY ⛔⛔⛔
You MUST call update_single_page_file (single-page) or update_page_file (multi-page) to write every page.
Put ALL HTML into the tool's content parameter. Do NOT output HTML in your text reply.
A response without successful tool calls is a FAILED generation.
```

进度上报协议化也写在 prompt 里：`progress must be a numeric literal such as 10, 35, or 88. Do not pass strings`，并预设了阶段区间（Analyzing 8-18 / Reading 18-30 / Writing 30-88 / Verifying 88-96 / Completed 98-100）。

## 4. 可迁移到 IntelliFlow 的点

我们 pipeline 是 LandPPT-style 4-layer + 图片化 PPTX，视觉一致性是主要痛点。oh-my-ppt 的强项就是用 prompt + 工具校验双重保险逼出稳定一致的视觉，可直接吸收：

- **DesignContract per deck**：在 Planning 之后、Generation 之前插入一个"设计契约"中间层（palette/titleStyle/layoutMotif/chartStyle/shapeLanguage/字体配对），后续每页 prompt 都注入该契约。这是治"每页风格漂移"的根方法。
- **layoutIntent 9 枚举**：把 cover / data-focus / comparison / timeline / concept / process / summary / quote / image-focus 引入 Planning 阶段元数据，再用 `formatLayoutIntentPrompt` 给 Generation 注入差异化版式提示。让一致风格下仍有版式变化。
- **CSS 硬约束清单**：即便我们走图片化 PPTX，也可借鉴 "禁 text-xs"、"最小字号 16px"、"禁 opacity-0/invisible/visibility:hidden"、"禁 vw/vh/clamp"、"h1 统一 text-5xl 禁 6xl+" 这类硬规则。把"看起来怪"的常见根因前置到 prompt 中拦截。
- **STABLE_HTML_FRAGMENT_PROTOCOL**：只生成 body fragment、外层由工具包裹、嵌套层级 ≤4 层、标签闭合检查——能显著降低 LLM 写出 broken HTML 的概率。
- **Guarded FS + 强制工具调用**：用 `GuardedFilesystemBackend` 在生成场景禁掉 `edit_file`、强迫 agent 走 `update_*_file`，并在 system prompt 顶部用强烈视觉警告。我们 agent 写文档时可借鉴这种"工具白名单 + prompt 强约束"双管齐下。
- **进度协议化**：把 progress 数值范围、阶段命名、UI 日志语言独立性写进 prompt，避免 UI 长时间沉默；前后端协议更清晰。
- **ChartFrame 父容器明确高度**：哪怕只是约束 LLM 写图表，"高度必须在 canvas 直接父容器上、不能是 h-full/flex-1/只有 min-h-*"这条经验非常重要，可以直接抄到我们的图表生成约束里。
- **整体元素动画偏好**：作者强调 "Whole-element animation is preferred over splitting text into many tiny moving fragments. It keeps slides readable, stable, and better suited for reports, pitches, classes, and live demos." 这个保守动画策略对企业内部场景特别合适。

## 5. 局限

1. **PPTX 导出 fidelity 有限**：README 坦承 "text overlap, mixed-language layout, complex HTML, animation, and some charts are still being improved"。数学公式只能在 PPTX 中以截图作为独立图片插入（避开 PowerPoint 不识别问题），动画不导出。
2. **依赖较重 LLM**：作者推荐 14B+ 模型或强云端模型，小模型生成 HTML 质量不稳。Ollama 默认要关闭 thinking，规避 reasoning_content 兼容性问题。
3. **Tailwind JIT 浏览器运行时**：每页 HTML 都内联 `tailwindcss.v3.js` 在浏览器中现编译。简单但首屏成本和包体积会比 build-time 编译高。
4. **HTML 复杂度反过来阻碍 PPTX 导出**：因为生成层很自由，反向到 PPTX 时丢真度成了固有矛盾。
5. **打包未签名**：macOS / Windows 首次启动需手动处理安全警告。
6. **架构耦合 DeepAgents + LangChain**：换框架成本不低；不是纯函数式 pipeline。
7. **prompt 体量大**：CANVAS_CONSTRAINTS + FRONTEND_CAPABILITIES + STABLE_HTML_FRAGMENT_PROTOCOL + CONTENT_WRITING_RULES 几乎每次生成都附在 system prompt，token 成本高。v2.0.10 changelog 中专门提到"优化生成成功率"和"减少 token 消耗"是持续战场。
8. **代码规范用 ESLint + Prettier**：与我们项目用 Biome 的规范不一致，参考时注意工具链差异。

整体看，这是当前开源里 HTML-first PPT 生成的最完整工程实现之一，prompt 体系和工具校验值得逐条对照吸收。
