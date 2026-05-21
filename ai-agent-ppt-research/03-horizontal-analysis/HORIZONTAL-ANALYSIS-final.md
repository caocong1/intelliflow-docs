# PPT AI 生成横向对比分析（定版 v1.0）

> **基础**：19 份个案报告（`02-individual-reports/`） + `_design-skills-synthesis.md` + 主线程对 IntelliFlow 代码的 1300+ 行直接观察
> **目的**：跨 19 个资料源识别共识、分歧、IntelliFlow 当前缺口、最高 ROI 优化路径
> **下游**：本文将驱动终版报告（Claude Code Skill）+ 代码审查 + 优化实施

---

## 1. 资料源全景与角色

| # | 项目 | 类型 | 一句话定位 |
|---|---|---|---|
| 01 | anthropics/skills/pptx | 官方 Skill | 工具集 + 10 配色 + 8 字体对 + Subagent QA |
| 02 | frontend-design | 设计 Skill | "intentionality not intensity" + 强 POV |
| 03 | canvas-design | 设计 Skill | "information lives in design" + 哲学化 deck |
| 04 | impeccable/polish | 设计 Skill | 11 维 anti-drift 终检 |
| 05 | impeccable/critique | 设计 Skill | 双盲评审（LLM + Detector）+ 趋势线 |
| 06 | impeccable/bolder | 设计 Skill | 70/30 非对称 + 字号 3x–5x 跳级 |
| 07 | impeccable/distill | 设计 Skill | 1 family + 4 字号 + 1 primary |
| 08 | vercel-web-design-guidelines | 设计 Skill | 排印正字 + 自动 linter |
| 09 | design-taste-frontend | 设计 Skill | 3 dial 参数化 + LILA BAN（禁紫蓝 AI 渐变）|
| 10 | high-end-visual-design | 设计 Skill | Double-Bezel + Eyebrow + Vibe × Layout 矩阵 |
| 11 | iOfficeAI/AionUi | 桌面平台 | Persona 薄 + Skill 厚 + ACP team + OfficeCLI |
| 12 | icip-cas/PPTAgent | 学术框架 | 编辑式 + REPL 反思 + PPTEval 三维 |
| 13 | hugohe3/ppt-master | IDE Skill | Strategist/Executor + SVG + spec_lock |
| 14 | presenton | Web Saas | TSX 布局 + LLM 选 layout + MCP 自动派生 |
| 15 | allweone | Web Saas | 38 主题 + PPTX→Theme 导入 + DOM-to-PPTX |
| 16 | slides_generator | CLI | python-pptx 单 prompt + Kandinsky + 14 bg style |
| 17 | oh-my-ppt | Electron | DeepAgents + Guarded FS + DesignContract + 9 layoutIntent |
| 18 | slide-deck-ai | Streamlit | LiteLLM 统一 + Pyramid Principle + 叙事弧 |
| 19 | danny0926/ppt-skills | Claude Code Skill | dual-layer editable + rough.js + 6 phase + 75 分门 |
| (+) | daymade/ppt-creator | Claude Code Skill | Pyramid + Assertion-Evidence + RUBRIC ≥75 + 10-question intake |
| (+) | lewislulu/html-ppt-skill | Claude Code Skill | 36 主题 + 31 版式 + 演讲者模式 + 逐字稿 |

---

## 2. 核心共识（≥4 个项目都做）

### 2.1 **预设而非生成**（10/19 项目）
不让 LLM 自由发明色 / 字体 / 布局 / 主题，而是 curated 列表选择。
- **anthropics/pptx** & **AionUi morph-ppt-3d** 用同一份 10 套配色 + 8 套字体对（**两个独立项目趋同设计**，已成事实标准）
- **allweone**：38 套静态 TS 主题常量
- **presenton**：TSX 组件库 + 字体 allowlist
- **PPT Master**：spec_lock + 行业 palette + PPT-safe font stack
- **oh-my-ppt**：DesignContract palette[3-6] + 9 layoutIntent 枚举
- **danny0926**：6 套 style preset + 15 layout type
- **slide-deck-ai**：4 套 PPTX 模板，LLM 不发明模板

> **IntelliFlow 差距**：Layer 0 TemplateGenes 完全靠 LLM 推断 hex 色 + 字体名。**严重缺 curated 池**。

### 2.2 **每页强制重读上游约束**（5/19）
跨页一致性来自每页生成时的"完整上游 anchor"。
- **PPT Master 规则 #8**："SPEC_LOCK RE-READ PER PAGE — must `read_file <project>/spec_lock.md` before each page"
- **anthropics/pptx**："commit to one visual motif" 反复在 prompt 强调
- **AionUi**：Persona → Skill 双层 + Gates checklist 每页执行
- **oh-my-ppt**：每个 page tool call 都引用 DesignContract 全文
- **slide-deck-ai refinement**：preserve-first 原则 + 完整对话历史回灌

> **IntelliFlow 差距**：Layer 4 prompt 把上游 JSON 全 attach，但**无显式"重读"语义指令**。

### 2.3 **NEVER-list 反模式黑名单**（7/19）
显式禁令 > 正向描述。
- **anthropics/pptx**: "NEVER use accent lines under titles — chief AI-generation tell" / "Don't default to blue" / "Don't center body text" / "Don't create text-only slides"
- **AionUi officecli-pptx**: "Never place decorative lines under slide titles ('chief AI-generation tell')"
- **PPT Master**: 9 hard rules（including SVG banned features 长列表）
- **oh-my-ppt**: "禁 text-xs / opacity-0 / visibility:hidden / vw vh / iframe / @font-face / emoji / 系统骨架类"
- **design-taste-frontend (09)**: **LILA BAN** — 禁紫蓝 AI 渐变作为整体特征
- **slide-deck-ai**: "MUST NEVER create harmful/unsafe content"

> **IntelliFlow 差距**：prompts.ts SYSTEM_DESIGN 只 1 句 avoid。**密度严重不够**。

### 2.4 **视觉 QA 反馈循环**（8/19）
没有纯单向生成的成熟项目。
- **anthropics/pptx**: Subagent + 11 项 checklist + "at least one fix-and-verify cycle"
- **PPTAgent**: REPL 反馈（动作执行失败 → 回传错误 → 重写，≤2 轮）+ PPTEval 三维
- **AionUi**: Delivery Gates 1-5a + Gate 5b morph-specific
- **PPT Master**: svg_quality_checker.py（errors block, no auto-fix）
- **impeccable/critique (05)**: 双盲 Assessment A + B + 趋势线
- **impeccable/polish (04)**: 11 维 anti-drift 终检
- **daymade/ppt-creator**: RUBRIC 10 项 × 10 分 = 100 分，<75 自动 refine（最多 2 轮）
- **danny0926**: Phase 5 read PNG 视觉评审 + Phase 6 之前 ≥75 分门

> **IntelliFlow 差距**：pipeline.ts 仅 1 次 retry → placeholder fallback。**无视觉级 QA**。

### 2.5 **视觉元素硬约束**（6/19）
不允许纯文字 slide。
- **anthropics/pptx**：实质条款 "every slide needs at least one visual element"
- **AionUi morph-ppt-3d**：显式 1/3 规则 "Every 3 content slides, ≥1 non-text visual"
- **PPTAgent PPTEval**：Design 维度 3→4 分水岭 = "supplementary visual elements"
- **oh-my-ppt**："每页至少一个清晰视觉焦点"
- **danny0926**："60/40 visual-to-text ratio" + "max 3 bullets" + "headlines ≤ 8 words"
- **slide-deck-ai**：每 deck 必含 ≥1 table + 1 icons 页 + 1 双栏 + 1 sequential process

> **IntelliFlow 差距**：PageBrief 有 primaryFocal 自然语言字段，无强校验。

### 2.6 **机器契约 / 锁定值**（4/19）
跨页 token 必须 verbatim 来自机器契约文件。
- **PPT Master**：spec_lock.md 是 anti-drift 核心
- **oh-my-ppt**：DesignContract JSON（palette[3-6] + titleStyle + layoutMotif + chartStyle + shapeLanguage + fonts）
- **presenton**：deterministic palette generator + 12-color schema
- **allweone**：6 类设计 token 全覆盖（colors / fonts / radius / shadow / transition / background）

> **IntelliFlow 差距**：StyleGenes 是自然语言 DNA，**非机器契约**。CSS variables 已派生，但**没有锁定层**。

### 2.7 **数字硬约束击败软 prompt**（5/19）
- **danny0926**：60/40 visual ratio / ≤8 words headlines / ≤3 bullets / 1920×1080 / 1px=6350EMU
- **anthropics/pptx**：36-44pt 标题 / 14-16pt 正文 / 0.5" 最小边距
- **AionUi**：H4 body ≥16pt / H6 暗背景对比度 / 每 3 页 ≥1 视觉
- **PPT Master**：max 4 colors per page / contrast ≥4.5:1 / 60-30-10
- **daymade/ppt-creator**：font 34-40/24-28/18-22/14-16 / 行距 1.1/1.3 / ≤70 词每页

> **IntelliFlow 差距**：CSS variables 提供字号字号（14/19/22/32/50/68），但 prompt 不显式引用这些为硬约束。

### 2.8 **三维度图像锁**（2/19，但震动性强）
- **PPT Master**：rendering（vector / editorial / 3d-isometric / sketch-notes / ...）× palette × per-image type → 整 deck 视觉一致性核心
- **allweone**：image query "60-120 words"，AI 模式 vs stock 模式 prompt 形式不同

> **IntelliFlow 差距**：visual brief 仅 imageLanguage 一词，**漂移严重**。

---

## 3. 分歧维度（项目路径不同的选择）

### 3.1 输出形态

| 形态 | 项目 | 优 | 劣 |
|---|---|---|---|
| Image-backed PPTX | IntelliFlow MVP | 视觉保真 | 不可编辑 |
| Native editable PPTX | anthropics/pptx, AionUi (OfficeCLI), PPT Master, slides_generator, slide-deck-ai, presenton | 可编辑 | LLM 需出结构化指令 |
| SVG 中间层 → DrawingML | **PPT Master 独有** | 1:1 概念映射 | 转换器工程量大 |
| HTML 中间层 → PPTX | oh-my-ppt, danny0926, IntelliFlow html_fidelity | 风格变化容易 | 导出损失 |
| DOM 直扫 → PPTX | **allweone 独有** | 简洁，所见即所得 | 需 Web 环境 |
| Dual-layer（bg PNG + native text） | **danny0926 独有** | 手绘风格 + 可编辑 | 实现复杂 |

**IntelliFlow 现状**：3 路并存（archetype native / scene_canvas / html_fidelity / 实验 image-backed）。**复杂度过高，无统一**。

### 3.2 AI 介入程度

| 程度 | 项目 |
|---|---|
| AI 只选不画 | presenton (LLM 选 TSX) / archetype-renderer / slide-deck-ai (模板填充) |
| AI 出结构 + 代码渲染 | anthropics/pptx / AionUi (OfficeCLI 命令) / daymade/ppt-creator |
| AI 出 SVG/HTML 渲染层 | PPT Master / oh-my-ppt / danny0926 / IntelliFlow MVP |
| AI 全权（编辑式） | PPTAgent / allweone agent tools |

**趋势**：成熟产品级项目倾向 **"AI 选 + 代码确定性渲染"**。完全让 LLM 像素级布局**质量不稳**。

### 3.3 跨页一致性实现层

| 层 | 实现 | 项目 |
|---|---|---|
| Prompt 层 | "commit to one motif" 自然语言 | anthropics/pptx |
| 机器契约层 | spec_lock.json / DesignContract | PPT Master / oh-my-ppt |
| 代码生成层 | CSS variables 派生 | IntelliFlow (已做) |
| 编辑约束层 | 参考 slide schema | PPTAgent |
| 静态主题层 | 38 套预制主题 | allweone |
| 编排器层 | Strategist 锁定 | PPT Master |

**关键发现**：IntelliFlow 已经在"代码生成 CSS"上走对方向，但**缺机器契约层**——styleGenes 是自然语言，不是机器锁定值。

### 3.4 Skill 形态

| 形态 | 例子 | 适合场景 |
|---|---|---|
| 标准 Anthropic YAML frontmatter | anthropics/pptx, daymade/ppt-creator, lewislulu/html-ppt-skill | Skill 市场 / Claude Code 触发 |
| docs 风格（无 YAML） | danny0926/ppt-skills | 项目内嵌部署 |
| 后端集成（非 Skill） | IntelliFlow / presenton / allweone | SaaS 产品 |

**IntelliFlow 选择**：作为内部产品后端集成，但 **方法论可以打包为内部 Skill** 供二次开发者借鉴。

---

## 4. IntelliFlow 11 个缺口诊断（基于 19 份报告 + 代码观察）

| # | 缺口 | 严重度 | 业界标准方案 | 修复 ROI |
|---|---|:---:|---|:---:|
| **C1** | 缺机器契约 spec_lock | 🔴 高 | PPT Master spec_lock.md / oh-my-ppt DesignContract | ★★★★★ |
| **C2** | 缺 NEVER-list 密度 | 🔴 高 | anthropics + AionUi + design-taste-frontend LILA BAN | ★★★★★ |
| **C3** | 缺视觉 QA 闭环 | 🔴 高 | anthropics Subagent / PPTAgent REPL / daymade RUBRIC | ★★★★ |
| **C4** | 缺三维度图像锁 | 🟠 中 | PPT Master rendering+palette+type | ★★★★ |
| **C5** | retry 反馈不结构化 | 🟠 中 | PPTAgent REPL execution feedback | ★★★ |
| **C6** | placeholder fallback 是 anti-pattern | 🟠 中 | PPT Master "errors block, no auto-fix" | ★★★ |
| **C7** | 缺 curated palette 池 | 🔴 高 | anthropics + AionUi 10 套配色 | ★★★★★ |
| **C8** | PageBrief 缺 visualElement 硬字段 | 🟠 中 | AionUi 1/3 规则 / danny0926 60/40 | ★★★★ |
| **C9** | font stack 无兜底 | 🟢 低 | PPT Master PPT-safe font stack | ★★ |
| **C10** | Icon library 未锁定 | 🟢 低 | PPT Master 4 套库 1 选 | ★★ |
| **C11** | Style packs 仅 6 套 | 🟢 低 | allweone 38 套 / presenton TSX 池 | ★★ |

---

## 5. 优化路径优先级（最终版）

### Tier 1 — Prompt-only 改造（零代码风险，立即可发）
**预期收益：解决 60-70% 视觉质量痛点**

1. **C2 扩充 NEVER-list**：在 prompts.ts SYSTEM_DESIGN 增加 12+ 条具体反模式：
   - 禁紫蓝 AI 渐变（LILA BAN）
   - 禁 accent line under title
   - 禁居中正文
   - 禁纯文字 slide
   - 禁四色以上正文
   - 禁默认蓝（除非锁定）
   - 禁 emoji 装饰
   - 禁 hero photo + white overlay
   - 禁 generic 4×2 卡片墙
   - 禁字号 <16pt
   - 禁 visibility:hidden / opacity:0 初始态
   - 禁字体回退栈无 Windows 预装字体

2. **C7 注入 curated palette 池**：Layer 0 prompt 末尾追加 "If you cannot derive a color from the brief with high confidence, use one of these curated palettes verbatim:" + 10 套配色（anthropics 同款）

3. **C4 visual brief schema 加 3 维度图像锁**：
   ```typescript
   {
     imageRendering: "vector-illustration" | "editorial" | "3d-isometric" | "sketch-notes" | "realistic-photo" | "abstract-geometric"
     imagePalette: { dominantUsage: "60%", supportingUsage: "30%", accentUsage: "10%" }
     imageTypes: { hero: "...", framework: "...", comparison: "..." }
   }
   ```

4. **C9 强制 PPT-safe font stack**：Layer 0 prompt 注入 "Every font stack MUST end with a Windows-preinstalled fallback (Microsoft YaHei / SimHei / Arial / Calibri / Segoe UI / Times New Roman)."

5. **C8 PageBrief.visualElement 必填枚举**：
   ```typescript
   visualElement: "icon_in_colored_circle" | "colored_block" | "large_stat_number" | "chart" | "shape_composition" | "hero_image" | "diagram"
   ```

6. **Per-page 重读语义**（来自 PPT Master 规则 #8）：Layer 4 system prompt 加 "Before authoring this page, RE-ANCHOR on these locked values: {{spec_lock_summary}}. Do not invent new colors / fonts / icon styles."

### Tier 2 — Schema + Validation 增强（中等风险）
**预期收益：再解决 15-20% 视觉质量痛点**

7. **C1 引入 spec_lock 层**：Layer 1 后输出 `spec_lock.json`：
   ```typescript
   {
     palette: { primary: "#XX", secondary: "#XX", accents: ["#XX"], neutrals: [...] },
     typography: { titleFont: "Source Han Serif SC, ...", bodyFont: "PingFang SC, ...", titleSize: 50, bodySize: 19 },
     iconLibrary: "tabler-outline" | "phosphor-duotone" | "chunk-filled" | "tabler-filled",
     imageRendering: ..., imagePalette: ..., imageTypes: ...,
     constraints: { maxBulletsPerSlide: 5, maxWordsHeadline: 8, visualRatio: 0.6 }
   }
   ```
   Layer 4 prompt 强制 quote spec_lock 全文。

8. **C5 结构化 retry 反馈**：仿 PPTAgent REPL——validateHtml 返回结构化错误对象（`{ code, slot, expected, actual, suggestion }`），retry prompt 注入这个结构化错误，不再是 "previous attempt failed"。

9. **C8 visualElement 渲染后校验**：HTML 内必须找到对应 element 类型，否则 retry。

10. **C10 spec_lock 含 icon_library_id**：Layer 0/1 选 4 套库之一，渲染前预下载该库 SVG，Layer 4 prompt 只引用本库 icon name。

### Tier 3 — 架构升级（高风险，分阶段）
**预期收益：解决最后 10-15% 视觉质量痛点 + 提升可维护性**

11. **C3 Subagent 视觉 QA 闭环**：Layer 4 渲染 PNG 后启动 critic subagent，11 项 checklist + PPTEval Design rubric 评分，<阈值触发 regenerate。

12. **C6 取消 placeholder fallback**：先观察 retry 命中率（应 <5%），再决定是否取消。短期至少**记录 retry 失败到 metrics**，便于回归。

13. **C11 Style packs 扩到 12 套**（用 anthropics + AionUi 10 套对齐 + IntelliFlow 现有 2 套）。

14. **PPTAgent 编辑式生成实验**：选 1 个 archetype（如 comparison），把 6 个 hand-authored HTML 样板做成"参考库"，Layer 4 改为"选样板 + 5 编辑动作填空"，对比纯生成的视觉一致性。

### Tier 4 — 探索（长期）
- SVG 中间层（替代 HTML 中间层）
- Multi-agent（Strategist + Designer + Critic）— 但避开 AionUi 的 mailbox/sequencing 陷阱
- Live preview（仿 PPT Master localhost:5050 + AionUi `officecli watch`）
- Edit-mode（仿 PPTAgent 5 编辑动作 + 仿 oh-my-ppt selector）

---

## 6. 设计 Skills 9 套的具体落点（深化 Layer 1/2/3）

> 详见 `_design-skills-synthesis.md`，本节摘核心。

### Layer 1 GlobalConstitution 吸收：
- `09 design-taste-frontend`：**3 dial 参数化**（DECK_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY 基线 8/6/4）
- `10 high-end-visual-design`：**Variance Mandate**（不重复上次组合）
- `03 canvas-design`：**Movement Name + Manifesto**（每 deck 有唯一身份）
- `02 frontend-design`：**Bold POV first**

### Layer 2 TemplateGenes 吸收：
- `10`：**Vibe × Layout Archetype 二维选择**（Ethereal Glass / Editorial Luxury / Soft Structuralism × Asymmetric Bento / Z-Axis / Editorial Split）
- `09`：**Anti-Center Bias**
- `06 bolder`：**70/30 非对称切分**
- `03`：**coffee table book 节奏**
- `07 distill`：**vertical linear flow**

### Layer 3 StyleGenes 吸收（最多 skill 在此层）：
- `10`：**Double-Bezel 嵌套** + **Eyebrow Tags** + 大留白 (py-24 ~ py-40)
- `09`：禁字体 LILA BAN + monospace 数字 + 反 slop 黑名单
- `06`：字号 3x–5x 跳级 + 60% dominant color
- `07`：1 family + 4 字号
- `08`：排印正字（… " " tabular-nums text-wrap balance）
- `02`：背景必有 gradient mesh / noise / pattern / shadow 之一
- `03`：systematic observation 视觉语言

### Layer 4 PageBrief 吸收：
- `07`：每页 1 primary message + 5 bullets 上限
- `06`：每页明确 focal point
- `08`：bullets 主动语态 + 具体名词 + CTA 文案具体化
- `05`：上一轮 critique 回写为生成约束

### Layer 5 RenderedPage 吸收：
- `04 polish`：11 维 anti-drift 检查
- `05 critique`：双盲 Assessment A + B + 趋势线
- `08`：自动 typography & copy linter
- `06`：AI-authorship 一眼识破测试
- `10`：$150k agency 测试
- `daymade RUBRIC`：≥75 分门 + 最多 2 轮 refine

---

## 7. 终极结论

### 7.1 IntelliFlow 视觉质量痛点的根因（推翻初设疑问）

> 用户原问"是不是模型能力不足？"

**结论：不是模型能力不足，是 AI agent 设计的 5 个具体缺口**。

每个缺口都有 **≥3 个业界项目验证的成熟做法**：
1. 缺机器契约层（C1）— 6 个项目用 spec_lock 类机制
2. 缺 NEVER-list 密度（C2）— 7 个项目用具体反模式黑名单
3. 缺视觉 QA 闭环（C3）— 8 个项目用反馈循环
4. 缺三维度图像锁（C4）— 2 个项目用，但效果极强
5. 缺 curated palette 池（C7）— anthropics + AionUi 已成事实标准

### 7.2 最高 ROI 改造路径（一句话）

**先做 Tier 1（Prompt-only，6 项改造，预期 60-70% 痛点缓解），观测 1-2 周生成质量数据，再决定 Tier 2 / Tier 3。**

### 7.3 终版交付形态选择

**推荐做 Claude Code Skill（标准 YAML frontmatter 形态）**，理由：
- 是业界对"PPT 生成方法论"的标准封装形式
- daymade/ppt-creator + lewislulu/html-ppt-skill + anthropics/pptx 都用这个形式
- 对外可被 IntelliFlow 二次开发者 / AI 工程师作为参考
- 对内可被 IntelliFlow 后端 ppt.service 调用 reference 文件来注入 prompt
- Skill 同时是文档 + 可执行 spec，**比纯 docs 多一个 trigger keyword 入口**

终版 skill 名建议：`intelliflow-ppt` 或 `editorial-ppt`，含：
- `SKILL.md` — 主文档（核心方法论）
- `references/spec-lock-schema.md` — 机器契约 schema
- `references/never-list.md` — 反模式黑名单
- `references/curated-palettes.md` — 10 套配色
- `references/visual-qa-checklist.md` — 11 项视觉 QA
- `references/hard-rules.md` — H1-H8 硬约束
- `scripts/spec-lock-validator.ts` — 校验脚本

下一步：阶段 6 起草这个 skill。
