# 15 — ALLWEONE presentation-ai

> Repo: https://github.com/allweonedev/presentation-ai — MIT
> Source notes: `01-raw-sources/others/allweone-presentation-ai-RAW.md`

## 1. 项目概览

ALLWEONE® AI Presentation Generator 直白定位"Gamma.app open-source alternative"，由 Next.js + tRPC-ish API routes 构建，~2.8k stars / ~491 forks。功能矩阵覆盖典型 SaaS deck 工具：AI 内容生成、Outline-First 流程、38 套内置主题 + 自建主题 + PPTX 主题导入、多模型图像生成（Together AI / FAL / Unsplash）、Plate.js 富文本、DND Kit 拖拽、Presentation Mode（含麦克风/摄像头录制）、Public Sharing、PPTX 导出。

部署：标准 Next.js + Postgres + Prisma 栈，Google OAuth (NextAuth.js)。本地模型：Ollama (`ollama pull llama3.1` 自动出现)、LM Studio（启用 CORS）。Tavily 提供 web search。`@ai-sdk/openai-compatible` 允许接入任意第三方 OpenAI 协议端点。

Roadmap 部分完成项：PPTX 导出（图像/组件存在不能 1:1 翻译的情况）、媒体嵌入、移动端响应式、高级图表、Presentation Recording。未开始：e2e 测试、实时协作、PDF 导出、模板市场、动画、云存储、分析、Speaker Notes、自定义字体、插件系统、对外 API。

## 2. 架构

前端栈固化在 Next.js 16.2.1 + React 19.2.4 + TypeScript 上，构建用 Turbo（`next build --turbo`、`next dev --turbo`），lint 用 Biome（不是 ESLint/Prettier）。状态用 Zustand 4.5 一套。Editor 双栈分工明确：**Plate.js 52.3** 管 slide 内层富文本（图像/charts/embeds），**ProseMirror 1.25** 管大纲编辑。AI SDK 用 Vercel `ai` 6.0 + `@ai-sdk/openai` 3.0 + `@ai-sdk/openai-compatible` 1.0 + `@ai-sdk/react`，并通过 `@ai-sdk/langchain` 桥接到 LangChain，让 LangChain 的 `RunnableSequence` 流式输出能直接喂给 `useChat` / UI message stream。

AI pipeline 是经典 4 阶段，分散在 4 个 API route：

| 阶段 | 路径 | 输出 |
|---|---|---|
| P1 大纲 | `POST /api/presentation/outline` | XML 标题 + Markdown 大纲（流式） |
| P2 整 deck | `POST /api/presentation/generate` | `<PRESENTATION>` XML（流式） |
| P3 单张幻灯片 | `POST /api/presentation/generate-slide` | 单张 `<SECTION>` XML |
| P3' 图像幻灯片 | `POST /api/presentation/generate-image-slides` | image-only XML 序列 |

旁路：`edit-diagram` / `prompt-to-diagram` / `text-to-diagram`（Mermaid 类）、`local-models`（Ollama / LM Studio 模型列表）、`agent`（编辑代理）。

模型分发由 `src/lib/model-picker.ts` 在调用点解析 provider + model id，默认 OpenAI `gpt-4o-mini`。

## 3. 主题系统

主题位于 `src/lib/presentation/themes.ts`，38 套全部以静态 TypeScript 常量声明，每个 theme 实现完整 `ThemeProperties`：

- `name`、`description`、`mode`（"light"/"dark"）
- `colors`：`primary`、`accent`、`background`、`text`、`heading`、`smartLayout`、`cardBackground` 共 7 个色 token
- `fonts`：`heading` + `body` 字体家族，可附 weight/URL
- `borderRadius`：`card`/`slide`/`button` 三层
- `transitions.default`、`shadows.{card,button,slide}`
- 可选 `mask`（CSS 遮罩）、`background`（渐变/图片）

样本：

| # | Name | Mode | Primary | Heading / Body | Button radius |
|---|---|---|---|---|---|
| 1 | Daktilo | Light | `#3B82F6` | Inter / Inter | 0.17rem |
| 2 | Noir | Dark | `#60A5FA` | Inter / Inter | blue-tint shadows |
| 3 | Cornflower | Light | `#4F46E5` | Poppins / Source Sans Pro | 0.25rem |
| 4 | Indigo | Dark | `#818CF8` | Poppins / — | card-bg `#312E81` |
| 5 | Orbit | Light | `#312E81` | Space Grotesk / IBM Plex Sans | 9999px (pill) |

**主题生成不走 LLM**——这是与 Presenton（部分走确定性算法）相反、与许多 SaaS Gamma 同侪一致的设计：人手设计 38 套，用户在 `ThemeSelector.tsx` 三标签页选择（My Themes / Public Themes / Built-in Themes），可点 "Create New Theme" 进入纯前端编辑器从零搭。

**PPTX 主题导入** —— `src/lib/presentation/pptx-theme-extractor.ts` 用 **JSZip** 解 PPTX（本质是 ZIP），沿着 OOXML 关系链跳：`presentation.xml.rels → slideMaster → slideMaster.rels → theme.xml`。`extractThemeFromPptx()` 五步：

1. 通过 relationships 解析 theme 文件位置
2. 解析 slide master 的 `clrMap`
3. 解析 theme.xml 里 12 个标准 OOXML 色槽（`dk1`, `lt1`, `accent1..6` 等）
4. 扫真实幻灯片内容，统计字号 / 字体使用频率
5. 加权合并出最终 `ThemeProperties`

启发式：
- 字号 `>= 3000`（即 30pt）算 heading
- `resolveColorFromFill()` 同时处理直接 sRGB 和 scheme refs（含 `tint`/`shade`/`lumMod` 修饰器）
- 字体名映射 OOXML → web 替代（如 `Calibri → Inter`）
- theme.xml 缺失时仅靠 slide content 降级

这套是整库 **最大的可移植技术资产**——独立、自包含、纯 TS、无 React 依赖。

## 4. Prompt 工程

**P1 大纲**（`outline/route.ts`）—— `buildOutlineSystemPrompt()` 动态拼接：

> "You are an expert presentation outline generator. Your task is to create a comprehensive and engaging presentation outline based on the user's topic."

输出格式硬约束：
> "Start with the title in XML tags, then generate markdown with each topic as a heading followed by bullet points."

不模板化用户 prompt（取最后一条 user message），Web search 开关注入 `search_tool`（Tavily）。流式经 `agent.stream(["values","messages"])` → `toUIMessageStream()` → `createUIMessageStreamResponse()`。

**P2 整 deck**（`generate/route.ts`）—— `SLIDES_TEMPLATE`：
> "You are an expert presentation designer. Create an engaging presentation in XML format."

输出 XML 结构：
```xml
<PRESENTATION>
  <SECTION layout="left|right|vertical">
    <!-- 15 layout components -->
    <IMG query="..." />
  </SECTION>
</PRESENTATION>
```

15 个 layout 组件常量：**COLUMNS, BULLETS, ICONS, CYCLE, ARROWS, TIMELINE, PYRAMID, STAIRCASE, BOXES, COMPARE, BEFORE-AFTER, PROS-CONS, TABLE, CHART, STATS**。

Image query 写法两套并存：
- 库存 (Unsplash)：1-4 词关键词，强制英文
- AI：60-120 词描述

实现：LangChain `PromptTemplate.fromTemplate()` → `RunnableSequence.from([prompt, model])` → 流式。

**P3 单张幻灯片**（`generate-slide/route.ts`）—— 严格约束：
> "Return ONLY the XML for a single slide. No explanation, no wrapper tags"

支持 `slideType: "standard" | "image"`、`imageStyle: "3D" | "Sketch" | "Flat"`、`textDensity: "Minimal" | "Balanced" | "Detailed"`。

**P3' 图像幻灯片**（`generate-image-slides/route.ts`）—— `IMAGE_SLIDES_TEMPLATE`：
> "You are an expert visual presentation designer. Create image-based slides where each slide is a full-screen image with ALL text rendered inside the image itself"

> "Do NOT use placeholders, brackets, or vague references; write every word exactly as it must appear in the image"

每个 IMG query 必须把要画进图里的文字完整写出来并加引号，并明确字体 / 排版指引。

**Agent 系统提示**（`createAgent.ts`）：
> "You are an expert presentation editing agent specialized in modifying and enhancing presentation slides."

本地模型注入额外约束：
> "LOCAL TOOL CALLING RULES - Use the available tools whenever you need to edit slides or answer via a tool."

7 个 Zod-验证 LangChain tool：`edit_slide_properties`、`replace_image`、`change_theme`、`regenerate_slide`、`create_slide`、`delete_slide`、`respond_to_user`。`change_theme` 接受 enum 主题名（"daktilo"、"cornflower"、"orbit"、"piano"、"mystique"...）。

## 5. 图像生成

`TOGETHER_AI_API_KEY`（主）+ `FAL_API_KEY`（副）+ `UNSPLASH_ACCESS_KEY`（库存）三选一。用户在生成时选 `imageSource: "automatic" | "ai" | "stock"`。

XML 里嵌 `<IMG query="...">`，下游 renderer 根据 source 走不同管道：
- AI 路径：query 是 60-120 词的细节描述，包含场景、风格、情绪、构图
- Stock 路径：query 是 1-4 词英文关键词，直拿 Unsplash 结果

image-as-slide 模式（"image slides"）是独立 endpoint，文字直接渲染进图——绕开 HTML/PPTX 文字排版的全部边界 case。这套对"教学海报"、"促销 banner"很合身，但导出 PPTX 时就是一张大图。

## 6. 导出机制

`src/components/presentation/export/` 是关键目录：

```
contentWalker.ts        — DOM 节点遍历
cssVariableResolver.ts  — CSS var → literal color
domSlideScanner.ts      — 扫描 React-rendered slide DOM
domToFabricConverter.ts — 中间态 Fabric.js objects
domToPptxConverter.ts   — 主写出器 (pptxgenjs)
```

主流程：

```typescript
export async function convertToPptx(
  scanResults: ScanResult[],
  slides: PlateSlide[],
): Promise<ArrayBuffer>
```

**关键差异**：不像我们用 headless Chrome，**Allweone 直接读运行中的 React/DOM**。其作者赌的是：编辑器渲染就是真值，把它扫一遍即可避免双源不一致。

pptxgenjs 调用面：
- `pptx.addSlide()` 起新页
- `slide.addText()` —— h1=32pt / body=12pt，带 bold/italic/underline 与样式继承
- `slide.addImage()` —— 同时支持 base64 与文件路径，多种 sizing（crop/contain/fill）
- `slide.addShape()` —— 箭头、胶囊、平行四边形等装饰形状（含旋转、圆角）
- `slide.addTable()`

特殊分支：
- Image slide 整张图打满，跳过其他内容
- 纯黑/纯白 solid background 跳过填色
- 渐变 background 退化为首停留色
- 通过 `cssVariableResolver` 把 `var(--primary)` 之类先解成 hex 再传给 pptxgenjs

`thumbnail.ts` **不是** headless render —— 只是从 slide 数据里抽出第一张可用图 URL，作为缩略图源。

## 7. 对 IntelliFlow 的可迁移点

IntelliFlow 走 4 层 LandPPT 风格 + headless Chrome + pptxgenjs，目标是改善"跨页视觉一致性"。Allweone 给出 6 个高价值借鉴点：

1. **38 套静态 ThemeProperties 设计 token** —— 直接抄数据结构（colors + fonts + borderRadius + shadows + transitions + mask + background），把我们当前可能只有 colors 的主题扩成完整 token。这是"跨页视觉一致"的基础。
2. **`pptx-theme-extractor.ts` 整套搬过来** —— 用户上传一份现有 PPT，按 OOXML 关系链 + slide content 加权抽出主题。直接补齐我们的"用现成模板"需求，且代码独立，纯 TS。
3. **outline-first ProseMirror 编辑器**（`src/components/prose-mirror/`）—— 我们如果想让用户在生成幻灯片前先确认大纲，ProseMirror 比 Tiptap/Plate 都轻，Schema 只 420 字节。配合 SSE 流式生成 + 后端持久化，4 层 pipeline 第 1 层可以直接换上。
4. **15 个 layout 组件名单的 XML 标签设计** —— 比 JSON Schema 更易让 LLM 输出稳定结构（XML 错配可恢复性强），并且与"页与页样式不同但同主题"目标天然兼容。我们当前用 JSON Schema 可考虑混合：结构走 XML，组件内 props 走 JSON。
5. **`domToPptxConverter.ts` 思路替换 headless Chrome** —— 如果我们的渲染器是 React/Web Component，可以读 live DOM 直接出 PPTX，把 headless Chrome 这一层"renderer-to-PNG"换成"renderer-to-pptx primitives"，避免栅格化损失（PPTX 仍然是矢量+可编辑）。
6. **多 image provider 自由切换 + 强制英文 IMG query** —— 把图像 query 与 slide 语言解耦（无论 slide 是中文都用英文找图）能显著提升 Unsplash / Together AI / FAL 的命中率与一致性。我们 prompt 工程层面零成本接入。

补充：image-slides 模式作为独立通道，可作为我们"营销/海报"型场景的差异化选项；其 prompt 约束（文本逐字、引号、字体指引）值得直接复制。

## 8. 风险 / 局限

1. **PPTX 导出不闭环**：README 自己承认 "images and components don't translate one-to-one"。任何依赖完美 PPTX 还原的企业场景必须自行补完。
2. **没有 Speaker Notes**：Roadmap 上未实现项，Presenton 反而把 note 注入 schema 解决得更优雅。
3. **强 Next.js 锁定**：导出基于"DOM 是真值"，必须在浏览器（或带 DOM 的 Node 环境）里跑。要 server-side 一锤子生成 PPTX 还得起 headless 浏览器走完一遍渲染。
4. **38 个主题是人手设计常量**：扩展靠人工编辑 `themes.ts`，没有"用户填几个色就自动调色板"的自动生成路径（Presenton 那种 deterministic palette）。要批量增主题成本高。
5. **OOXML extractor 是只读单向通路**：仅做 inspiration 抓取，不会保留母版/版式/动画/SmartArt。"主题导入"在产品语言里等价于"复用调色+字体"，不要被名字误导。
6. **Plate.js + ProseMirror 双栈编辑器**：内容层与大纲层用不同框架，二次开发要熟两套 schema/transform/plugin API，对小团队是负担。
7. **认证依赖 Google OAuth**：自托管企业内网用户不友好，需替换 NextAuth provider（虽然 NextAuth 支持多 provider，但要额外接入企微/SAML/OIDC）。
8. **prompt 全部走 LangChain `PromptTemplate`**：可读性 OK 但 LangChain 版本绑定与 AI SDK 版本绑定双层依赖，升级 OpenAI / Anthropic 模型时改动面比纯 Vercel AI SDK 大。
9. **图像 prompt 与主题不联动**：观察不到证据表明 image generation 会注入当前 theme 的 colors/style——也就是说图像风格与幻灯片排版风格之间没有显式耦合，"视觉一致性"层面仍然有缝。我们可以在自己实现时把 theme colors + accent 注入 image prompt 头部。
10. **没有 E2E 测试 / 文档不深入**：Roadmap 显示 e2e 测试未做，自行 fork 后维护需自建测试基线；许多设计决策需读代码而非读 docs。
11. **缺乏 outline → slide 的版本控制**：自动保存仅当前编辑态，没看到 diff/版本/对比逻辑。我们 IntelliFlow 的"多模型对比、迭代"需求需要自补这层。
12. **15 个 layout 组件枚举写死在 prompt 字符串里**：扩展 layout 需同步改 prompt + renderer + PPTX converter 三处，没有 single source of truth。
