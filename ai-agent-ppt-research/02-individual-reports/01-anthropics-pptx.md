# Anthropic 官方 PPTX Skill — 架构与可迁移点分析

> **源**: `anthropics/skills` GitHub, path `skills/pptx/` (main 分支，proprietary license)
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/anthropics-pptx-RAW.md`
> **分析对象**: SKILL.md (~210 行) + editing.md (~180 行) + pptxgenjs.md (~360 行) + 6 个 Python 脚本

---

## 1. 概览

Anthropic 把 PowerPoint 处理封装成一个 **"prompt + 工具集"** 形态的 Skill，而不是一条端到端的生成流水线。整个 skill 只有 3 个 markdown + 6 个 Python 脚本，**没有 ingestion、没有数据库、没有 4 层 AI 链路**。其核心思想是：把 PPTX 当作一个"可遍历的 XML 包"（unpack/edit/pack 三步模型），LLM 作为高级别决策者直接编辑底层 XML 或调用 `pptxgenjs` JS；同时通过一份"设计 IDE 性 prompt"（10 个 curated 配色 + 8 个字体对 + 反模式黑名单）把"如何不像 AI 生成的 PPT"显式约束进模型行为。最后通过 **subagent 视觉 QA 闭环** 兜住质量。本质上是把"判断"留给 LLM，"工具/校验"留给确定性脚本。

---

## 2. 核心架构

**Skill 的三条工作流（明确路由）** 在 SKILL.md 的 "Quick Reference" 表里：

| Task | Guide |
|------|-------|
| Read/analyze content | `python -m markitdown presentation.pptx` |
| Edit or create from template | `editing.md` |
| Create from scratch | `pptxgenjs.md` |

LLM 进入 skill 后第一件事是判断路径，**不会同时加载两个 guide**——这是 prompt 工程上的 economy。

### Read 路径
- 用 Microsoft 的 [`markitdown`](https://github.com/microsoft/markitdown) 把 PPTX 转 markdown 提取文本
- `scripts/thumbnail.py` 渲缩略图网格做版式预览（PPTX → PDF via LibreOffice → JPEG via Poppler）

### Edit 路径（editing.md 7 步）
1. `thumbnail.py` + `markitdown` 分析模板
2. **Plan slide mapping** — 显式强调"USE VARIED LAYOUTS"，要求 LLM 主动从 multi-column / image+text / quote / divider / stat callout / icon grid 中选择
3. `scripts/office/unpack.py` 解压并 pretty-print 所有 XML，**同时把 smart quotes 转成 XML 实体**（防止后续 Edit 工具误转 ASCII）
4. 结构调整（删/复制/排序 slide）——**editing.md 明确要求"do this yourself, not with subagents"**
5. 内容编辑（per-slide XML） ——**反之，"Use subagents here ... slides can edit in parallel"**
6. `scripts/clean.py` 反向可达性遍历，删除孤儿 slide / media / rels
7. `scripts/office/pack.py` 走 **`PPTXSchemaValidator`** 校验+自动修复，然后 condense XML 并打包

### Create 路径（pptxgenjs.md）
- 直接用 `pptxgenjs` 在 Node 里 `addText / addShape / addImage / addChart`
- 图标方案：`react-icons` 渲 SVG → `sharp` 转 PNG base64 → 嵌入 slide
- 字符体系明确："NEVER use '#' with hex colors"（会破坏文件）、"NEVER 8-char hex for opacity"、"option objects 不能复用"（pptxgenjs 会就地 mutate）

### 工具栈
- **`markitdown[pptx]`** — 文本抽取
- **`pptxgenjs`** — 从零生成
- **`defusedxml.minidom`** — XML 操作（**显式禁用** `xml.etree.ElementTree`："corrupts namespaces"）
- **LibreOffice headless + Poppler `pdftoppm`** — slide → JPEG（QA 输入）
- **`Pillow`** — 缩略图拼接
- **自带 C shim** (`scripts/office/soffice.py`) — 沙箱里 AF_UNIX 被 seccomp 封禁时 `LD_PRELOAD` 一个 socket 拦截动态库给 LibreOffice 跑

---

## 3. 设计系统

### 10 套精选配色（不是 Hue 算法，是 curated list）

> 引用 SKILL.md 原文："If swapping your colors into a completely different presentation would still 'work,' you haven't made specific enough choices."

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| Midnight Executive | `1E2761` | `CADCFC` | `FFFFFF` |
| Forest & Moss | `2C5F2D` | `97BC62` | `F5F5F5` |
| Coral Energy | `F96167` | `F9E795` | `2F3C7E` |
| Warm Terracotta | `B85042` | `E7E8D1` | `A7BEAE` |
| Ocean Gradient | `065A82` | `1C7293` | `21295C` |
| Charcoal Minimal | `36454F` | `F2F2F2` | `212121` |
| Teal Trust | `028090` | `00A896` | `02C39A` |
| Berry & Cream | `6D2E46` | `A26769` | `ECE2D0` |
| Sage Calm | `84B59F` | `69A297` | `50808E` |
| Cherry Bold | `990011` | `FCF6F5` | `2F3C7E` |

**Dominance 规则**："One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight." 这是显式 60/30/10 法则。

### 8 套字体配对（Header / Body）

Georgia/Calibri、Arial Black/Arial、Calibri/Calibri Light、Cambria/Calibri、Trebuchet MS/Calibri、Impact/Arial、Palatino/Garamond、Consolas/Calibri。**完全不让模型自由选字**——给一张映射表，挑一行就行。

### 字号 / 间距硬约束

| Element | Size | Spacing |
|---------|------|---------|
| Slide title | 36-44pt bold | 0.5" 最小边距 |
| Section header | 20-24pt bold | 0.3-0.5" 块间距 |
| Body text | 14-16pt | "Leave breathing room" |
| Captions | 10-12pt muted | — |

### 4 类版式 + 数据展示 + 视觉点缀（3 类）

- 两栏（文字左 / 图右）、Icon + 文字行（圆形 icon + 粗标题）、2x2 或 2x3 网格、半出血图 + 文字 overlay
- 大数字 callout (60-72pt) / 对比双栏 / Timeline 流程
- Section 标题前小圆 icon、关键数据 italic 强调

### "Sandwich" 结构

> "Dark backgrounds for title + conclusion slides, light for content"

明示 visual rhythm。

---

## 4. 质量保证机制

**核心信条** (SKILL.md 原文)：

> "Assume there are problems. Your job is to find them. Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough."

### 双轨 QA

**Content QA** — `python -m markitdown output.pptx | grep -iE "xxxx|lorem|ipsum|this.*(page|slide).*layout"`，做 placeholder 残留扫描。

**Visual QA** — **必须用 subagent**，原文："⚠️ USE SUBAGENTS — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there."

子 agent 收到的检查清单（这是 prompt 工程精华，可直接迁移）：
- Overlapping elements（文字穿过形状、线条穿过文字）
- Text overflow / cut off at edges
- Decorative lines positioned for single-line but title 换行了
- Source citations / footers colliding 上方内容
- Elements too close (< 0.3" gaps)
- Uneven gaps（一处空旷一处拥挤）
- Insufficient margin from slide edges (< 0.5")
- Columns not aligned consistently
- Low-contrast text / icons
- Text boxes too narrow → 过度换行
- Leftover placeholder content

### 验证循环（强制至少 1 轮 fix-and-verify）

1. Generate → Convert to images → Inspect
2. List issues (**if none, look again more critically**)
3. Fix
4. **Re-verify affected slides — one fix often creates another problem**
5. Repeat until full pass clean

> "Do not declare success until you've completed at least one fix-and-verify cycle."

### Slide → JPEG 管道

```bash
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
# 局部重渲：pdftoppm -jpeg -r 150 -f N -l N output.pdf slide-fixed
```

150 DPI 足够看清字号 + 间距 + 对比度问题。

---

## 5. Prompt 工程要点

1. **"Don't create boring slides"** 作为 design 段开场，定调"不允许平庸"。
2. **强反模式黑名单**（不是"你应该做什么"，而是"这些是 AI 生成的特征，绝对不要做"）：
   - "NEVER use accent lines under titles — these are a hallmark of AI-generated slides"
   - "Don't default to blue"
   - "Don't repeat the same layout"
   - "Don't center body text"
   - "Don't create text-only slides"
3. **决策树而非自由发挥**：选 1 个配色（10 选 1）、1 套字体（8 选 1）、1 个 visual motif（"pick ONE distinctive element and repeat"）。
4. **subagent 分工显式化**：结构调整自己做（步骤 4），文本编辑用 subagent 并行（步骤 5），视觉检查用 subagent 兜底（"fresh eyes"）。
5. **检查表 = 复制即用 prompt** —— 视觉 QA prompt 是完整可粘贴的（不让模型自己列检查项）。
6. **触发条件极宽**：YAML `description` 把"deck"/"slides"/"presentation"/".pptx filename" 全列上，"regardless of what they plan to do with the content afterward"——任何文件涉及 pptx 都触发。
7. **底层 XML 不藏着**：直接告诉模型 `b="1"` 是 bold、`<a:pPr><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>` 是行距、`<a:buChar>` vs `<a:buNone>` 控制 bullet。模型直接编辑 XML，不走中间层。

---

## 6. 可迁移到 IntelliFlow PPT 流水线的关键点

> 对照 `docs/design/ppt-mvp/ai-pipeline.md` 的 4 层（TemplateGenes → StyleGenes → GlobalConstitution → PageBrief → RenderedPage）

1. **把"10 套 curated palette" 注入 Layer 0 / Layer 1**——目前 TemplateGenes 是 brief 派生 + ingested template，可以把 Anthropic 这 10 套作为 "preset palette" 的兜底集，给 brief 路线一个高质量基线（避免 LLM 默认蓝）。
2. **把视觉 QA prompt 直接挂到 Layer 4 之后**——pipeline 现在 `pages/<pageId>.png` 已经渲好，缺一个"主动 bug hunt"步骤。把 SKILL.md 里那段 visual inspection prompt 套上 `<sessionDir>/pages/*.png`，配 retry 上限，能显著降低 overlap/contrast/placeholder 残留率。我们当前只做了 HTML 校验（"body / .slide / 最小尺寸"），偏宽。
3. **"反模式 NEVER list" 写进 Layer 4 system prompt**——尤其 "NEVER use accent lines under titles"、"don't default to blue"、"don't center body text"、"don't create text-only slides"——这些是模型默认会犯的错，**显式禁止比正向描述更有效**。
4. **强制 "every slide needs a visual element"**——Layer 3 (PageBrief) 现在不强约束。可以在 PageBrief schema 里加一个 `visualElement: image | chart | icon | shape` 必填字段，让 Layer 4 渲染时如果空就 retry。
5. **subagent 视觉 QA 闭环作为 Iteration 2 的 P0**——目前 ai-pipeline 写"Live mode 未实测"，QA 还停留在 HTML 静态检查。引入"PNG → 子 agent 检视 → 列 issue → 局部重渲" 是质量跃迁。pdftoppm 那个"局部重渲" `-f N -l N` 的招也直接可用。
6. **smart-quote 转 XML 实体的处理**——如果我们 Iteration 2 走 "Native editable PPTX"（pptxgenjs 直出而不是截图），`unpack.py` 那种 "extract → escape `‘’"“` to `&#x2018;...` → edit → re-emit" 的处理方式必须照搬，否则模型一编辑就破坏 curly quotes。
7. **pptxgenjs 八大致命陷阱清单纳入 native PPTX 路线的代码约束**：
   - 颜色字符串绝不带 `#`
   - opacity 单独属性，绝不塞进 hex
   - 每次调用 `shadow` 给新对象（pptxgenjs 会就地 mutate 成 EMU）
   - 不要混用 `ROUNDED_RECTANGLE` 和矩形 accent bar
   - 不用 unicode 项目符号
   - 这些可以做成 pptxgenjs **lint 层**，在 Layer 4 输出后扫一遍。
8. **`PPTXSchemaValidator` 思路**——pack.py 在 zip 之前调 schema validator + 自动 repair。我们的 native 路径如果直出 OOXML，需要类似一层 schema gate；image-backed 路径不需要但 native 路径必上。

---

## 7. 局限 / 不适合的地方

- **没有 ingestion**：Anthropic skill 只接"模板路径"或"从零"两种 Layer 0；不像我们要求"批量摄取一个目录 → 自动建索引 → 前端列出 preset"那种产品形态。我们的 `batch-ingest-templates.ts` + `presets-index.json` 链路是 skill 完全没有的。
- **没有多页一致性建模**：每个 slide 是独立 XML 文件，靠 prompt 里"commit to a visual motif"和 visual QA 人工兜底；没有 GlobalConstitution 这样跨页约束的中间层。我们 4 层流水线在 deck-level coherence 上**更系统**。
- **没有 brief → 大纲 → 内容生成的链路**：skill 假设内容已经在 LLM 上下文里（或来自源文档）。我们要从 outline.json + visual-brief 出发生成全部内容，是 skill 不覆盖的部分。
- **JS / Python 双语言**：编辑路线是 Python (XML)，生成路线是 Node.js (pptxgenjs)，对 toolchain 有要求。我们目前后端是 TypeScript / Bun，pptxgenjs 部分可直接复用，但 XML 编辑路径要么用 Bun + xml 库，要么单独跑 Python 子进程。
- **没有图表预制库**：和我们一样的痛点——SKILL.md 给了"better-looking charts"的 pptxgenjs 选项段，但没有 ppt-master 那种 50+ SVG 模板。我们 Iteration 2 的 P1 仍要自己造。
- **没有 native editable PPTX 优先级**：skill 直接用 pptxgenjs 生成或编辑 XML，不存在我们目前 "Image-backed only" 的妥协。如果我们走截图路径，subagent 视觉 QA 还可用；但 pptxgenjs 那 8 条陷阱用不上（因为我们不生成 OOXML 元素）。
- **没有企业内 SSO / 多租户**：skill 是单用户单文件场景。我们 IntelliFlow 的多部门、企微 OAuth、脱敏映射等都不在 skill 范畴。

---

## 附：关键引用集中清单

- "Assume there are problems. Your job is to find them." (SKILL.md, QA 段)
- "If swapping your colors into a completely different presentation would still 'work,' you haven't made specific enough choices." (SKILL.md, Design Ideas)
- "One color should dominate (60-70% visual weight)" (SKILL.md, Dominance over equality)
- "NEVER use accent lines under titles — these are a hallmark of AI-generated slides" (SKILL.md, Avoid)
- "USE SUBAGENTS — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there." (SKILL.md, Visual QA)
- "Do not declare success until you've completed at least one fix-and-verify cycle." (SKILL.md, Verification Loop)
- "Template slots ≠ Source items" (editing.md, Common Pitfalls)
- "Use defusedxml.minidom, not xml.etree.ElementTree (corrupts namespaces)" (editing.md, Other)
- "PptxGenJS mutates objects in-place ... Sharing one object between multiple calls corrupts the second shape." (pptxgenjs.md, Common Pitfall #7)
