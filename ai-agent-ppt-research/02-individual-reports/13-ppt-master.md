# PPT Master — Strategist-Executor 双角色 + SVG 中间层

> **源**：hugohe3/ppt-master (~18.9k stars, MIT, v2.7.0 May 2026)
> **原始资料**：`/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/others/ppt-master-RAW.md` (432 行)
> **作者**：Hugo He (CPA / 咨询业出身，Strategist 角色设计直接源自咨询行业方法论)

---

## 1. 项目概览

PPT Master 是一个 **"harness 不是 agent"** 的设计哲学产物：作者明确说"harness + model = agent，工具拥有 workflow，模型决定上限"。它把自己定位为 IDE-native skill（Cursor / VS Code / Claude Code / Codex CLI / Cline / Aider 等），通过 `npx skills add hugohe3/ppt-master` 或 marketplace `/plugin install ppt-master` 装到 IDE harness 里跑。

**核心区别于其他工具**的一句话：

> "Drop in a PDF, DOCX, URL, or Markdown — get back a **natively editable PowerPoint** with real shapes, real text boxes, and real charts. Not images. Click anything and edit it."

作者明确分类了四种 AI PPT 工具，只有自己属于"Native editable"：
- Template fill-in：部分可编辑（受模板限制）
- Image-based：不可编辑（每页是图）—— **这是 IntelliFlow 当前 image-backed 路径所属类别**
- HTML presentation：不是 PPTX
- **Native editable (PPT Master)：真 DrawingML shapes, 完全可点击编辑**

模型推荐：Claude Opus 4.7 + ~1M token 上下文 + `gpt-image-2` 图像生成。

---

## 2. 核心架构

### 2.1 三角色（Strategist / Executor / Image_Generator）

> "PPT Master uses **role switching within one main agent** rather than parallel sub-agents."

注意：**不是 multi-agent**。是单 agent 在不同阶段切换 prompt + 工作模式。

| Role | Mode | Deliverable |
|---|---|---|
| **Strategist** | 与用户对话、可回溯 | `design_spec.md`（人话）+ `spec_lock.md`（机器契约）|
| **Executor** | 严格出 XML，零即兴 | `svg_output/` 各页 SVG + speaker notes |
| **Image_Generator** | manifest-driven | `image_prompts.json` + 生成图 |

角色切换协议：每次切换前必须 `read_file references/<role>.md`，并显式输出：

```
## [Role Switch: <Role Name>]
Reading role definition: references/<filename>.md
Current task: <brief description>
```

### 2.2 9 条不可违反的执行规则（SKILL.md 原文）

1. **SERIAL EXECUTION** —— 步骤严格串行
2. **BLOCKING = HARD STOP** —— BLOCKING 步骤必须等用户回复
3. **NO CROSS-PHASE BUNDLING** —— Eight Confirmations 是 BLOCKING，不允许预先打包后续阶段
4. **GATE BEFORE ENTRY** —— 每步有 prerequisite
5. **NO SPECULATIVE EXECUTION** —— 禁止为后续步骤"预热"
6. **NO SUB-AGENT SVG GENERATION** —— Step 6 SVG 必须主 agent 直接写，不能委托
7. **SEQUENTIAL PAGE GENERATION ONLY** —— SVG 页必须**逐页**生成；批量 5 页一组 FORBIDDEN
8. **SPEC_LOCK RE-READ PER PAGE** —— 每页生成前必须重读 spec_lock.md；不可凭记忆用色用字
9. **SVG MUST BE HAND-WRITTEN, NOT SCRIPT-GENERATED** —— 主 agent 手写 SVG，不允许写 Python/Node 脚本批量产生

> 规则 9 的注释（罕见的设计反思）："the script-generation path was tried on a feature branch and abandoned: **cross-page visual consistency depends on per-page authoring with full upstream context, which a generator script cannot reproduce.**"

这对 IntelliFlow 是直接的警示——**视觉一致性来自每页生成时的"完整上游上下文"，不是来自脚本批量生成**。

---

## 3. Eight Confirmations（BLOCKING gate）

Strategist 唯一的阻塞决策点，必须用户确认 8 项才能进入 Executor：

| # | 确认项 |
|---|---|
| a | Canvas format（ppt169 / ppt43 / xhs 等 10+ 格式）|
| b | Page count range |
| c | Target audience（Key Information）|
| d | Style objective（Mode A/B/C × 视觉风格描述）|
| e | Color scheme |
| f | Icon library |
| g | Typography plan |
| h | Image usage approach |

### 3.1 Style mode（咨询业三段式）

| Mode | 重心 | 受众 | Tagline |
|---|---|---|---|
| A 通用 | 视觉冲击 | 公开/客户/培训 | "Catch the eye at a glance" |
| B 一般咨询 | 数据清晰 | 团队/管理层 | "Let data speak" |
| C 顶级咨询 | 逻辑说服 | 高管/董事会 | "Lead with conclusions" |

### 3.2 三维度 AI 图像锁（视觉一致性核心机制）

**最值得借鉴的设计**：Strategist 锁定三个正交维度：

1. **rendering** —— 视觉风格族（vector-illustration / editorial / 3d-isometric / sketch-notes / ...）
2. **palette** —— deck 色值的使用方式（比例 + 角色 + 气质）
3. **type** —— 每图的内部构图（background / hero / framework / comparison / ...）

`rendering` 和 `palette` 是 deck-wide 写进 spec_lock.md，每张图的 prompt 由 locked rendering + palette + per-image type 拼装。

> "Without this, every image gets its own style drift and the deck reads as a stack of unrelated illustrations."

**IntelliFlow 当前问题正是这个**——visual brief 只描述 imageLanguage 一个抽象词，AI 每页生成图各自漂移。

### 3.3 Icon library 锁

> "**One presentation = one stylistic library** for generic icons. Mixing `chunk-filled` / `tabler-filled` / `tabler-outline` / `phosphor-duotone` is FORBIDDEN."

4 套库各自一致：`chunk-filled`（fill+直角）/ `tabler-filled`（fill+贝塞尔）/ `tabler-outline`（描边）/ `phosphor-duotone`（双色）。

### 3.4 Typography Hard Rule

> "Every stack MUST end with a pre-installed font (CJK: Microsoft YaHei / SimHei / SimSun / FangSong / KaiTi; Latin sans: Arial / Calibri / Segoe UI; ...)."

Stack 长度 ≤4，必须以 Windows 预装字体兜底。这避免了 PPTX 在用户机器上字体回退乱套。

---

## 4. spec_lock.md — 防漂移执行契约

两个 Strategist 产物：
- **design_spec.md** —— 人类叙事（11 节：项目信息 → 画布 → 视觉主题 → 字体 → 布局 → 图标 → 可视化 → 图片 → 大纲 → 演讲注 → 技术约束）
- **spec_lock.md** —— 机器契约（HEX 色 + 字体字符串 + 图标库 + 图片资源清单 with status）

> "spec_lock.md is the **anti-drift mechanism** — the SKILL.md mandates `read_file <project>/spec_lock.md` before every page, so values stay verbatim across 20+ slides."

**这正是 IntelliFlow 应该新增的层**——我们当前 GlobalConstitution 是 6-8 条"用 X 不用 Y"自然语言规则，没有可机器读的 spec_lock 锁定值。

`update_spec.py` 支持窄范围变更传播：仅 `colors.*` (HEX) 和 `typography.font_family`。其他字段不支持批量改，因为"风险/收益不合"。

---

## 5. 为什么是 SVG（关键技术决策）

> "SVG sits at the center of this pipeline. The choice was made by elimination."

| 备选 | 否决原因 |
|---|---|
| Direct DrawingML | XML 巨冗，AI 训练数据少，不可调 |
| HTML/CSS | 内容流模型 vs PPT 绝对定位模型不兼容 |
| WMF/EMF | AI 没训练数据 |
| SVG as image | 销毁可编辑性 |

**SVG 胜出原因**："SVG shares the same world view as DrawingML: both are absolute-coordinate 2D vector graphics formats built around the same concepts."

SVG → DrawingML 元素映射（直接 1:1）：
- `<path d="...">` → `<a:custGeom>`
- `<rect rx="...">` → `<a:prstGeom prst="roundRect">`
- `transform=translate/scale/rotate` → `<a:xfrm>`
- `linearGradient` → `<a:gradFill>`

**ViewBox 用 pixels**，不是 EMU，因为像素空间对 AI 推理布局更直观。EMU 转换在 export 时一次性完成。

---

## 6. 质量保证机制

### 6.1 svg_quality_checker.py

强制校验：
- Banned features（`<mask>`, `<style>`, `class=`, `@font-face`, `<foreignObject>`, `<symbol>`, `<textPath>`, `<animate>*`, `<script>`）
- viewBox 不匹配
- spec_lock drift（颜色/字体必须 verbatim 匹配）
- 低分辨率图像 / 非 PPT-safe 字体尾（仅警告）

> "Severity model: errors block, warnings don't, and there is intentionally no auto-fix. Errors require the Executor to re-author the offending page in context — a banned `<style>` element isn't a mechanical patch, because the Executor used it for a reason."

**关键设计**：不允许自动修补。因为 banned 元素的存在反映 Executor 有特定意图，机械替换会破坏意图，必须重新生成。

### 6.2 verify-charts 工作流

> "AI models routinely introduce 10-50 px errors when mapping data to pixel positions."

图表页单独 verify workflow。承认 LLM 在数据→像素映射上的系统性偏差。

---

## 7. 动画模型（references/animations.md）

锚定逻辑：**top-level `<g id="...">` 内容组**。一个组 = 一次点击 reveal。每页 3-8 个 group。

Chrome auto-skip：命名为 `background` / `bg` / `header` / `footer` / `decoration` / `watermark` / `pagenumber` / `chrome` 的组不参与 cascade。

22 single effects + 2 auto-vary（mixed/random）。**默认 fade 0.4s + after-previous + 0.5s stagger**——零交互级联出现。

> "Why object-level animation uses a sidecar (`animations.json`), not SVG attributes: **SVG remains the static visual source of truth. Custom PPTX animation is export policy.**"

---

## 8. Live Preview

> "During generation, a browser preview at `http://localhost:5050` opens automatically. Click any element, write what to change, hit Submit annotations, then return to the chat and say 'apply my annotations' — the AI rewrites the SVG and re-exports."

可视化标注 → AI 重写 SVG 闭环。对应 AionUi `officecli watch`。

---

## 9. 可迁移到 IntelliFlow 的关键点

### 9.1 **引入 spec_lock 层（最高优先级）**

我们当前 4 层（TemplateGenes → StyleGenes → GlobalConstitution → PageBrief → RenderedPage）中，**Layer 1 StyleGenes 和 Layer 2 GlobalConstitution 都是自然语言**，不可机器校验。

建议在 Layer 1 后加 `spec_lock.json`：machine contract，verbatim HEX / 字体字符串 / 图标库 / 图片资源列表。**Layer 4 prompt 必须先 read spec_lock 再生成**。

### 9.2 **三维度 AI 图像锁（直接套）**

我们 visual brief 当前只有 `imageLanguage: "technical_illustration_plus_real_photo"`——抽象、易漂移。

升级为：
```json
{
  "imageRendering": "vector-illustration",
  "imagePalette": { "primary": "60%", "secondary": "30%", "accent": "10%" },
  "imageTypes": ["background", "hero", "framework"]
}
```

每张图的 prompt 由 (rendering + palette) deck-wide + per-image type 拼装。

### 9.3 **Icon library 锁（每 deck 1 套）**

我们当前 visual brief `iconLanguage: "simple_numeric_badge"`，但 AI 实际选哪套图标库是开放的。加入 enum 限制：4 套库选 1（`chunk-filled` / `tabler-filled` / `tabler-outline` / `phosphor-duotone`），并在 spec_lock 锁定库 ID。

### 9.4 **Typography Hard Rule**

Layer 0 TemplateGenes 当前生成 `titleEa: "...", titleLatin: "..."` 字符串，无回退。改为强制 stack 形式 + 必须以 Windows 预装字体结尾。

### 9.5 **SVG 中间层（中期）**

短期看 IntelliFlow 目前 image-backed PPTX 已经成型，切到 SVG 中间层是大改造。但作为 Iteration 2 "Native editable PPTX" 路径，**SVG 是比 HTML 更合适的中间表示**（这是 PPT Master 的核心论点）。HTML 是内容流模型，不适合 PPT 的绝对定位本质。

### 9.6 **9 条执行规则中的 #8 和 #9 最关键**

- **#8 SPEC_LOCK RE-READ PER PAGE** —— 我们 Layer 4 prompt 每页都把所有上游产物 attach 进去，但**没有强制"重读"的语义**。可以在 Layer 4 system prompt 里加："Before authoring this page, re-anchor on the spec_lock values: {{spec_lock_summary}}"。

- **#9 SVG MUST BE HAND-WRITTEN** —— 等价于"每页必须有完整上游上下文"。我们当前 6 页可以接受，但如果未来扩到 30+ 页，要警惕"批量生成"模式的诱惑。

### 9.7 **Quality checker 思路**

我们 pipeline.ts 的 validateHtml 偏宽（structure / asset usage）。可以仿 svg_quality_checker.py：
- Banned features 黑名单（如 `class="text-xs"` / inline emoji / 内嵌 base64 图像）
- 颜色/字体 drift 检查（HTML 实际用色必须 verbatim 来自 spec_lock）
- 不支持 auto-fix，错误要求 Executor 重新生成该页

### 9.8 **进度上报协议**

PPT Master 的 status 数值范围（8-18 分析 → 18-30 读上下文 → 30-88 逐页 → 88-96 verify → 98-100）。我们 pipeline 当前只有 console.log，可以引入结构化 status event 给前端实时展示。

---

## 10. 风险 / 局限

- **完全 IDE-bound**：是个 skill 而非 SaaS，需要用户有 Claude Code / Cursor 等 harness。我们 IntelliFlow 是 web app，无法直接套这种"用户在 IDE 里跑"的模式——但**方法论可借鉴**。
- **Python 单体**（91.2% Python）。我们后端 TypeScript / Bun，要么重写要么 subprocess。
- **SVG → DrawingML 转换工程量大**。`finalize_svg.py` 各个子转换器（icon expand / tspan flatten / image align / rect-to-path）都是手写规则。
- **"design draft" 的诚实定位**：作者明说"expect to do your own finishing work in PowerPoint"。我们 IntelliFlow 的用户期望可能是"开箱即用"，需要更高的开箱质量门槛。
- **依赖 Claude Opus 强模型 + ~1M context**——对中型 Chinese cloud 模型（doubao-seed / qwen-max）能力可能不足。我们当前已经支持多 cloud provider，但需要做模型能力分级。

---

## 关键 quote 摘录

- "**harness + model = agent** — the tool owns the workflow; the model sets the ceiling" (作者哲学)
- "cross-page visual consistency depends on **per-page authoring with full upstream context**" (规则 9 设计反思)
- "Without [3D image lock], every image gets its own style drift and the deck reads as a stack of unrelated illustrations" (3D image lock 设计动机)
- "**spec_lock.md is the anti-drift mechanism**" (执行契约)
- "Templates are **floors that easily become ceilings**: they lock the deck into the template's visual idioms regardless of how the content actually wants to be presented." (模板观)
- "The generated PPTX is a **design draft**, not a finished product. Think of it like an architect's rendering." (产品诚实定位)

---

**结论**：PPT Master 给我们的最大启示是 **"spec_lock 锁定 + 每页强制重读"** 和 **"三维度 AI 图像锁"**——这两件事对应 IntelliFlow 视觉漂移的根因，可以直接迁移到我们 4 层 pipeline 的 Layer 1 / Layer 4。SVG 中间层是中期可考虑的架构升级，但短期不必动。角色切换（Strategist / Executor）也是有价值的模型——目前我们 prompts.ts 把所有 layer 混在一个 file 里，没有显式的"角色身份"切换。
