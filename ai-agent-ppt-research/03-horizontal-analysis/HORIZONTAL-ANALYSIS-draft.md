# PPT AI 生成横向对比分析（草稿 v0.1）

> **状态**：基于已完成的 4 份个案报告 + 3 份 RAW 已读完的项目 + 主线程对 IntelliFlow 代码的直接观察起草。其余项目报告完成后会迭代到 v1.0。
> **目的**：跨 16 个资料源横向对比，识别共识、分歧、IntelliFlow 当前缺口、可落地的优化路径。

---

## 1. 资料源全景表

| 编号 | 项目 | 类型 | 核心定位 | 最相关迁移点 |
|---|---|---|---|---|
| 01 | anthropics/skills/pptx | Skill (Anthropic 官方) | 工具集 + 设计 IDE + Subagent QA | Subagent 视觉 QA 循环 / 10 配色 / NEVER-list |
| 02-10 | skills.sh 9 个设计 skills | 视觉优化 skill 族 | 单点视觉打磨 / 评审 / 减法 / 视觉权重提升 | 注入 Critic Agent prompt 库 |
| 11 | iOfficeAI/AionUi | 桌面平台 + 多 PPT skill | Persona 薄 + Skill 厚 + OfficeCLI + ACP 协作 | Gate 5b 编排式校验 / H4-H7 硬约束 / 每 3 页 1 视觉元素 |
| 12 | icip-cas/PPTAgent | 学术 agentic 框架 | 两阶段 + 5 编辑动作 + REPL 反思 + PPTEval | PPTEval 三维 critic / 编辑式生成 / archetype 参考库 |
| 13 | hugohe3/ppt-master | IDE skill (native editable) | Strategist/Executor + SVG 中间层 + spec_lock | spec_lock 锁定 / 3D 图像锁 / per-page 重读 |
| 14 | presenton/presenton | 开源 Gamma alternative | TSX 布局 + LLM 选 layout + MCP | 布局组件化 + LLM 只选不画 |
| 15 | allweonedev/presentation-ai | 开源 Gamma alternative | Gamma 风格 SaaS + 38 主题 | 主题导入 + 编辑流 |
| 16 | ai-forever/slides_generator | 单 prompt 框架 | python-pptx 直构 + Kandinsky 图像 | 14 种 background style 预设 |
| 17 | arcsin1/oh-my-ppt | HTML-first 本地优先 | DeepAgents + Guarded FS + DesignContract | layoutIntent 枚举 + 强约束 prompt + Tool 校验 |
| 18 | barun-saha/slide-deck-ai | 多 LLM 协同 | LangChain + Streamlit + 模板填充 | 多 provider 抽象 |
| 19 | danny0926/ppt-skills | Claude Code Skill | 手绘风 + Playwright + dual-layer editable | Skill 格式参考（终版交付形态）|

---

## 2. 共识维度（≥3 个项目都做的事）

### 2.1 **预设而非生成**：色 + 字体 + 布局都用 curated 列表

| 项目 | 配色 | 字体 | 布局 |
|---|---|---|---|
| anthropics/pptx | 10 套 curated | 8 套 pairing | 4 类版式 + 5 类点缀 |
| AionUi morph-ppt-3d | 10 套（与 anthropics 完全一致）| 8 套 pairing | 6 个 layout pattern (3D) |
| PPT Master | 行业 palette + spec_lock 锁定 | PPT-safe stack | 72 numbered 技巧（Primary + Modifier）|
| oh-my-ppt | DesignContract palette[3-6] | titleFont / bodyFont 二分 | 9 个 layoutIntent 枚举 |
| presenton | 主题系统 | font allowlist | TSX 布局组件库 |

**共识**：成熟项目**都不让 LLM 自由发明色/字体/布局**。给一张 curated 表，挑一行。

**IntelliFlow 当前差距**：
- Layer 0 TemplateGenes 是 LLM 自由发明（基于 visual brief + outline 推出 HEX 色 + 字体名）
- 没有 curated palette 预设池
- visual brief 只描述 3 个抽象词（imageLanguage / iconLanguage / shapeLanguage）

### 2.2 **每页强制重读上游约束**

| 项目 | 重读机制 |
|---|---|
| PPT Master | `read_file spec_lock.md` 强制每页执行 |
| anthropics/pptx | "commit to a visual motif" 反复在 prompt 强调 |
| AionUi | Persona → Skill 双层结构，Skill 内有 Gates checklist |
| oh-my-ppt | 每个 page tool call 都引用 DesignContract 全文 |

**共识**：跨页一致性来自**每页生成时的"完整上游上下文"**（PPT Master 规则 9 的字面陈述）。

**IntelliFlow 当前差距**：Layer 4 prompt 把 styleGenes / constitution / brief 全 attach，但**没有显式"重读"的语义指令**。Layer 4 system prompt 是"通用 designer"角色，每次拿到一堆 JSON，模型可能聚焦于 page content 而忽略上游 anchor。

### 2.3 **视觉元素硬约束**

| 项目 | 视觉元素硬约束 |
|---|---|
| anthropics/pptx | "every slide needs at least one visual element"（实质条款）|
| AionUi morph-ppt-3d | "Every 3 content slides, at least 1 must contain a non-text visual element"（显式 1/3 规则）|
| PPTAgent PPTEval | Design 维度 3→4 分水岭 = "supplementary visual elements (icons, geometric shapes)" |
| oh-my-ppt | "每页至少有一个清晰的视觉焦点" |
| PPT Master | spec_lock §VIII 图片资源列表强制声明 layout pattern |

**共识**：不能让 LLM 出"纯文字 slide"——这是 Design 维度的关键闸门。

**IntelliFlow 当前差距**：Layer 3 PageBrief 有 `primaryFocal` 字段，但无强校验。Layer 4 validateHtml 只检查 assets 中的图片 URL 是否被引用，不强制每页必须出现某种 visual element。

### 2.4 **NEVER-list 反模式黑名单**

| 项目 | 关键禁令 |
|---|---|
| anthropics/pptx | "NEVER use accent lines under titles" / "Don't default to blue" / "Don't center body text" |
| AionUi officecli-pptx | "Never place decorative lines under slide titles ('chief AI-generation tell')" |
| oh-my-ppt | 长串 "禁止 text-xs / opacity-0 / visibility:hidden / vw/vh 字体单位 / iframe / @font-face / emoji" |
| PPT Master | Banned SVG features 黑名单（`<mask>`, `<style>`, `class=`, 等）|

**共识**：显式禁止比正向描述更有效。LLM 默认会犯的错（蓝色为主、accent line、居中正文）必须 prompt 明令禁止。

**IntelliFlow 当前差距**：prompts.ts SYSTEM_DESIGN 有一句宽泛的 "avoid generic AI-PPT aesthetics: no hero photo backgrounds with white-text overlay, no rainbow gradients, no decorative emoji"——**密度严重不够**。

### 2.5 **视觉 QA 反馈循环**

| 项目 | QA 机制 |
|---|---|
| anthropics/pptx | Subagent 强制 → 11 项 checklist → "do not declare success without at least one fix-and-verify cycle" |
| PPTAgent | REPL 反馈（动作执行失败 → 回传错误 → 重写，≤2 轮）+ PPTEval 三维评分 |
| AionUi | Delivery Gates 1-5a + Gate 5b morph-specific（actor leakage / spatial variety / name-match）|
| PPT Master | svg_quality_checker.py（不允许 auto-fix，要求 Executor 重新生成）|

**共识**：成功的 PPT 项目都有 **"生成 → 检查 → 反馈 → 重生成"** 的闭环。**没有**纯单向生成的 production-grade 项目。

**IntelliFlow 当前差距**：
- pipeline.ts Layer 4 仅 1 次 retry，第二次失败 fall back 到 placeholder（这是关键 anti-pattern）
- 校验仅静态 HTML 结构（body/slide class/content presence），**无视觉级校验**（无对比度、无 overlap、无截图 LLM 评审）
- 无 PPTEval 风格的多维 critic
- 无 PPT Master 的"errors block, no auto-fix"的严肃性

---

## 3. 分歧维度（项目之间路径不同）

### 3.1 输出形态

| 形态 | 项目 | 优势 | 局限 |
|---|---|---|---|
| **Image-backed PPTX**（截图打包）| presenton 部分路径 / IntelliFlow MVP | 视觉保真高 / 不依赖 LLM 出 PPTX 元素 | 不可编辑 / 文件大 |
| **Native editable PPTX**（pptxgenjs / python-pptx 直构）| anthropics/pptx / AionUi (OfficeCLI) / PPT Master / slides_generator | 可编辑 / 文件小 | LLM 需输出结构化指令 |
| **SVG 中间层 → DrawingML 转换** | PPT Master 独有 | 1:1 概念映射 / AI 训练数据充足 | 转换器工程量大 |
| **HTML 中间层 → PPTX 导出** | oh-my-ppt / IntelliFlow html_fidelity | 风格变化容易 / web 技术栈 | 导出时文本叠加/动画/复杂 HTML 损失 |

**IntelliFlow 选择**：3 种路径并存（archetype native / scene_canvas / html_fidelity / 实验 image-backed）。复杂但灵活。

### 3.2 AI 介入程度

| 程度 | 项目 | 路径 |
|---|---|---|
| **AI 只选不画** | presenton（LLM 选 TSX 布局） / archetype-renderer | 模板池 + LLM 选层 |
| **AI 出结构 + 代码渲染** | anthropics/pptx (pptxgenjs) / AionUi (OfficeCLI 命令) | LLM 出命令，工具确定性渲染 |
| **AI 出 SVG/HTML 渲染层** | PPT Master / oh-my-ppt / IntelliFlow MVP | LLM 出可视化中间表示 |
| **AI 全权（编辑式）** | PPTAgent | LLM 在已渲染版式上做 DOM 编辑 |

**趋势**：成熟项目更靠近"AI 只选不画 + 代码确定性渲染"端。**完全让 LLM 出像素级布局**的项目少见且质量不稳。

**IntelliFlow 选择**：production 走"AI 出 SlidePresentation JSON + archetype 确定性渲染"——和 presenton 思路一致。MVP 走"AI 出 HTML + Chrome 渲染"——和 oh-my-ppt 思路一致。**两条路对 visual quality 的优化策略不同**。

### 3.3 跨页一致性的实现层

| 层 | 项目 |
|---|---|
| **Prompt 层**（commit to one motif）| anthropics/pptx |
| **机器契约层**（spec_lock.json）| PPT Master |
| **代码生成层**（CSS variables 派生）| IntelliFlow（css-from-genes.ts）|
| **编辑约束层**（参考 slide schema）| PPTAgent |
| **风格 prompt 重发**（DesignContract）| oh-my-ppt |
| **没有专门层**（靠 LLM 自评）| AionUi / slides_generator |

**关键发现**：IntelliFlow 已经做了"代码生成 CSS variables"（这是相对前沿的做法）。但**缺少机器契约 spec_lock**——styleGenes 是自然语言 DNA，不是机器锁定值。

---

## 4. IntelliFlow 当前架构对标矩阵

| 维度 | IntelliFlow 现状 | 业界最佳实践 | 差距 |
|---|---|---|---|
| 配色来源 | LLM 推断（Layer 0）| Curated palette 池（anthropics 10 套）| 缺 curated 池 |
| 字体来源 | LLM 推断（Layer 0）| Curated pairing 池 + PPT-safe stack 兜底 | 缺 pairing 池 + 兜底栈 |
| 布局来源 | Variant recipe（6 种文本配方）| TSX 组件 / SVG 模板 / 9 种 layoutIntent | 缺组件化布局；recipe 太抽象 |
| 跨页一致性 | CSS variables（代码生成）+ 自然语言 DNA | spec_lock.json + 强制每页重读 | 缺机器契约 + 缺重读语义 |
| 视觉 QA | HTML 结构校验（body/slide class/asset URL）| Subagent 视觉评审 + 多维 critic | 缺视觉级校验 |
| 重试机制 | 1 次 retry → placeholder | 反馈驱动 REPL（≤2 轮）+ Gate 拒绝 | retry 反馈不够具体；placeholder 是 anti-pattern |
| 反模式禁令 | 4 条宽泛 | 10+ 条具体 NEVER 条款 | 严重不足 |
| 视觉元素硬约束 | PageBrief.primaryFocal（自然语言）| "every 3 slides ≥1 visual element" + 强校验 | 缺硬规则 + 缺校验 |
| 图像生成一致性 | imageLanguage 一个抽象词 | rendering + palette + type 三维度锁 | 维度太少 |
| Icon 库 | 无明确锁定 | 1 库锁定（4 选 1）| 缺锁定 |
| Critic agent | 无 | PPTEval 三维 / Subagent / Gate 5b | 完全缺失 |

---

## 5. 优化路径的优先级排序（草案）

### P0（必做，最大 ROI）
1. **新增 `spec_lock.json` 层**：在 Layer 0/1 后输出机器契约（HEX 色 + 字体字符串 + 图标库 ID + 图像 rendering/palette）。Layer 4 prompt 强制 read_spec_lock。
2. **扩充 NEVER-list**：从 anthropics + AionUi 抓 10+ 条具体反模式塞进 SYSTEM_DESIGN。
3. **Layer 4 后置 Subagent 视觉 QA 闭环**：用 Anthropic 的 11 项 checklist + PPTEval Design rubric。
4. **3D 图像锁**：visual brief 升级为 rendering + palette + type 三维结构。

### P1（明确收益，工程量中等）
5. **PageBrief 增加 `visualElement` 硬字段**（icon_circle / colored_block / large_stat / chart / shape_composition），渲染后校验该元素是否实际出现。
6. **Layer 4 retry 改造**：增加结构化错误反馈（如 PPTAgent REPL 风格），不再是"failed validation"通用消息。
7. **Curated palette 池**：作为 Layer 0 brief 路线的兜底基线，避免 LLM 默认蓝。
8. **进度协议化**：仿 oh-my-ppt 的 report_generation_status，给前端实时反馈。

### P2（架构升级，长期）
9. **TSX/SVG 布局组件库**：参考 presenton + PPT Master，把 6 种 archetype 从 prompt recipe 升级为代码组件。
10. **PPTEval 自动评分** + 高分作为 critic 训练信号。
11. **multi-agent**（Strategist + Designer + Critic）：仿 PPT Master 三角色，但避开 AionUi 的 mailbox/sequencing 陷阱。

### P3（探索）
12. **SVG 中间层**：作为 Native editable 路径的更优中间表示。
13. **Live preview**：让前端在生成期间实时看到每页 HTML。
14. **Edit-mode**：仿 PPTAgent 5 个编辑动作 + 仿 oh-my-ppt selector 编辑。

---

## 6. 待补充

- 9 个设计 skill 报告完成后，把 visual QA prompt 库的具体构造加入 §2.5 / P0
- presenton + allweone 报告完成后，把 TSX 组件化方案加入 §3.2 / P2
- slide-deck-ai 完成后，补 §3.2 的"多 LLM 抽象"角度
- danny0926/ppt-skills 完成后，决定终版交付形态（Skill vs Docs）

---

**当前结论**：IntelliFlow 视觉质量痛点的根因**不是模型能力不足**，而是 agent 设计上 5 个具体缺口：缺机器契约、缺重读语义、缺视觉元素硬约束、缺 NEVER-list 密度、缺视觉 QA 闭环。每一项都有≥3 个业界项目验证的成熟做法。
