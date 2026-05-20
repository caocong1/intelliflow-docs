# AionUi — 多 agent 协作 + OfficeCLI 编辑式 PPT 生成

> **源**：iOfficeAI/AionUi (25.9k stars, Apache-2.0) + iOfficeAI/OfficeCLI (4.7k, C#) + iOfficeAI/AionHub
> **原始资料**：`/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/aionui/aionui-RAW.md`（1024 行）
> **分析对象**：4 个 PPT 类 assistant prompt + 5 个 PPT skill SKILL.md + ACP 运行时 + Team Mode Leader/Teammate prompt

---

## 1. 项目概览

AionUi 是个**桌面级开源 AI Cowork 平台**（Electron + Vite + React + Bun + TypeScript），把 PPT 生成作为内置 assistant 之一，**底层完全依托同组织的 OfficeCLI**（一个号称"为 AI agent 而生"的单二进制 Office 套件）。架构分三层：

1. **Assistant**（persona 层）—— `ppt-creator` / `morph-ppt` / `morph-ppt-3d` / `pitch-deck-creator`，每个 1 个 markdown 文件描述角色 + 触发条件
2. **Skill**（workflow 层）—— `officecli-pptx` / `morph-ppt` / `officecli-pitch-deck` / `_builtin/office-cli`，每个 SKILL.md 描述完整 7-stage workflow + delivery gates
3. **Team Mode**（ACP 协作层）—— Leader / Teammate prompt + mailbox + 9 个 `team_*` MCP 工具，跨 agent 并行 + 串行依赖管理

**关键定位**：AionUi 不自己生成 PPT 内容，而是把任务交给 OfficeCLI——一个把 PPTX 抽象成"XPath 可定位的 DOM 树"的 CLI 工具。LLM 通过 shell 命令做读/编辑/校验/渲染。

---

## 2. PPT 生成架构

### 2.1 Assistant → Skill 路由

`ppt-creator.md` 仅 ~20 行 persona，**核心指令是一句"Follow the `officecli-pptx` skill exactly without deviation"**。这种"persona 极薄 + skill 厚"的设计意味着：

- Persona 解决"打招呼"和"提醒不要打开文件锁定"
- Skill 承载所有真正的方法论（hierarchy / palette / hard rules / gates）
- 升级 skill 不需要改 persona

### 2.2 OfficeCLI 三抽象层（PPT 生成的实际命令面）

| Layer | Verbs | When |
|---|---|---|
| **L1 (Read)** | `view`, `get`, `query`, `validate` | 检查文件状态 |
| **L2 (DOM Edit)** | `set`, `add`, `remove`, `move`, `swap`, `batch` | 99% 的编辑操作 |
| **L3 (Raw XML)** | `raw`, `raw-set` | 仅当 L2 表达不出时 |

LLM 通过 `officecli help` 查询任何命令的完整 schema。**"When unsure about property names, value formats, or command syntax, ALWAYS run help instead of guessing."**

### 2.3 Resident 模式 + Watch live preview

```bash
officecli watch deck.pptx  # → http://localhost:26315 实时预览
officecli get deck.pptx selected  # 读浏览器选中的元素
officecli goto deck.pptx /slide[3]  # 滚到指定 slide
```

这把"AI 生成 → 用户预览"做成秒级反馈，避开了 PowerPoint 占用文件锁的问题。

---

## 3. Morph PPT — 真正区别化的设计

### 3.1 三前缀命名系统（CORE 概念）

| 前缀 | 用途 | 持久性 |
|---|---|---|
| `!!scene-*` | 背景/装饰 | 整个 deck |
| `!!actor-*` | 跨页演化内容；离场时 ghosted 到 `x=36cm` | 章节内 |
| `#sN-*` | 单页内容（titles/bullets） | 每页新建；下页 ghosted |

> "PowerPoint's Morph engine pairs shapes by identical `name=` across adjacent slides and interpolates their position / size / rotation / fill / opacity."

### 3.2 空间多样性硬约束

> "Between morph pairs ensure: ≥5cm displacement OR ≥15° rotation OR ≥30% size delta on **at least 3 different shapes per pair**."

不到这个阈值 Morph 退化为单纯 fade。

### 3.3 Delivery Gates 5b-morph-1..4

- Gate 5b-morph-1：actor leakage check（上页 actor 是否正确 ghost）
- Gate 5b-morph-2：spatial variety proof（≥3 shapes 变化）
- Gate 5b-morph-3：name-match verification（跨页 name 一致性）
- Gate 5b-morph-4：`#sN-*` ghosting confirmation

每一 gate 都是可机械执行的脚本检查，**不依赖 LLM 自评**。

---

## 4. 视觉设计系统（morph-ppt-3d 的 4.0 enrichment）

### 4.1 10 套配色 × 8 套字体对（与 Anthropic skill 同一套）

注意：AionUi 这 10 套配色和 Anthropic `pptx` skill 完全一致（Midnight Executive / Forest & Moss / Coral Energy 等），且都强调 "One color dominates (60-70% visual weight)"。**这两套独立项目趋同设计**，说明这套预设值已成事实标准。

### 4.2 Hard Rules（硬约束，无例外）

| ID | Rule |
|---|---|
| **H4** | Body text **≥16pt**；不允许"内容塞不下就缩字"，必须 split slides / reduce items |
| **H6** | 暗背景（亮度<30%）的 body / cards / chart labels 必须 white 或 near-white（亮度>80%）|
| **H7** | 每个 content slide 必须有 speaker notes |

### 4.3 Visual Element Checkpoint

> "Every 3 content slides, at least 1 must contain a non-text visual element."

非文字视觉元素被定义为：icon-in-circle / colored block / large stat / chart / gradient bg / shape composition。**纯文字 slide 仅允许 quotes / code / pure tables**。

这是直接对应 PPTAgent PPTEval Design 维度 3→4 分水岭的设计——通过"is the slide visually engaged?"做闸门。

---

## 5. Team Mode：跨 agent PPT 协作

### 5.1 Leader prompt 的核心约束（verbatim TypeScript）

```
## Your Role
You coordinate a team of AI agents. You do NOT do implementation work
yourself. You break down tasks, assign them to teammates, and synthesize
results.
```

Leader **强制使用 `team_*` MCP 工具**（不能用 SendMessage / Agent 等其他通用工具），因为"They belong to a different system and will break team coordination."

### 5.2 Sequencing Dependent Work（防 LLM 流超时）

> "When teammate B's work depends on teammate A's output, do NOT dispatch the dependent task to B with a 'stand by until A finishes' instruction. Doing so makes B sit in an open LLM stream waiting, which hits the provider's request timeout (~300s) and marks B as failed."

**正确流程**：
1. 派 A 任务
2. 等 A 的 idle_notification
3. 再派 B 任务

这条对我们 IntelliFlow 未来引入 Critic Agent + Designer Agent 编排时极其关键——**不能用"等待"指令保活，要用 idle + wake 模式**。

### 5.3 Teammate "Standing By"

> "'Standing by' or 'waiting' means **end your current turn**, not generate idle text in a live LLM stream."

显式教导子 agent 在没工作时返回主流，等 mailbox 唤醒。

---

## 6. 可迁移到 IntelliFlow 的关键点

> 对照 4 层 LandPPT pipeline + 生产 archetype renderer

### 6.1 **Visual Element Checkpoint 直接挂到 Layer 3 (PageBrief)**
我们目前 PageBrief 只约束 intent / focal / composition / tone，没有"必须含非文字视觉元素"的硬规则。可在 PageBrief schema 加 `visualElement: "icon_circle" | "colored_block" | "large_stat" | "chart" | "shape_composition"` 必填项，渲染后无该元素则 retry。这是 PPTEval Design 维度 3→4 的提升路径。

### 6.2 **Hard Rules H4/H6/H7 写进 Layer 4 system prompt**
我们 prompts.ts SYSTEM_DESIGN 比较抽象（"editorial-grade"）。直接照搬 AionUi 的 H4（body ≥16pt）、H6（暗背景对比度）、H7（speaker notes）作为不可越界的硬规则。

### 6.3 **Delivery Gate 模式取代当前单次 retry**
我们 pipeline.ts 现在是"validate fails → retry once → fallback to placeholder"。AionUi 是 **Gates 1-5a 串行**（schema validate → structural integrity → visual audit → ...），每 gate 失败明确 reject 哪几页。建议改造为：每页过 Gate 1（HTML valid）→ Gate 2（content presence）→ Gate 3（asset usage）→ Gate 4（visual audit via subagent）。Gate 3 之前是同步 validate，Gate 4 异步且可以并行多页。

### 6.4 **引入 archetype 命名标准化（类比 !!scene-*  / !!actor-*）**
当前我们 archetype 是 `cover_hero_image` 等命名，没有"跨页元素延续"的概念。如果未来要做 Morph PPT，可以引入 `!!brand-logo`、`!!section-marker` 等跨页元素 ID 标准化。短期不是核心问题，但作为未来扩展点很重要。

### 6.5 **Persona ⇄ Skill 解耦**
我们当前 `prompts.ts` 把 SYSTEM_DESIGN（persona） + Layer 0-4 user prompt（workflow）都混在一个文件。建议拆出 `ppt-personas.ts` + `ppt-skills/*.md`。让 SYSTEM_DESIGN 仅含"你是什么人"，workflow 在外部 markdown skill 里。这种拆分让 prompt 维护更轻、可被多个 entry-point 复用（PPT 节点、Word 节点、Excel 节点共享）。

### 6.6 **Live preview 思路：暴露 session HTML 给前端**
AionUi 的 `officecli watch` 跑 localhost:26315 实时预览。我们 `<sessionDir>/pages/<pageId>.html` 已经在磁盘上，可以加一个 dev mode dev server，让前端浏览器在 AI 生成期间实时查看每页 HTML。这能让产品方/用户在 5-10 分钟生成过程中提前发现问题，而不是等完整 PPTX 出来。

### 6.7 **Team Mode 的 Leader-Teammate-Critic 三角**
未来如果走 multi-agent，AionUi 的 mailbox + idle + sequencing 模式是必读。**关键陷阱**：永远不要用 "wait" prompt 保活子 agent，必须用 idle-then-wake。我们当前是单线性 pipeline，不存在这个问题，但引入 Critic Agent（如 PPTEval-style 评审）时要避免这个坑。

---

## 7. 局限 / 不适合的地方

- **OfficeCLI 是单二进制 C# 工具**，需 install 脚本部署。我们后端是 TypeScript / Bun，要么 spawn 子进程调 OfficeCLI（增运维成本），要么自己重新实现一遍 L1/L2/L3 抽象（短期看不值得）。建议**借鉴方法论而非直接集成 OfficeCLI**。
- **Morph PPT 是 PowerPoint 365 / Keynote / WPS 独占特性**，在 LibreOffice / Google Slides / web viewer 上退化为 fade。我们用户群和导出场景可能不全是 PPT 365，Morph 不一定是优先级。
- **没有 multi-page coherence 中间层**：AionUi skill 通过 prompt 里的 "commit to one visual motif" 和 visual QA 兜底 cross-slide coherence。它**没有我们 GlobalConstitution 这样的形式化中间层**。这反过来证明我们 4 层 pipeline 在这一点上**比 AionUi 更前沿**。
- **没有 ingestion / template 转换** —— AionUi 完全不做"导入用户模板"，假设 LLM 凭设计系统从 0 生成。我们的 `batch-ingest-templates.ts` + `presets-index.json` 是 AionUi 没有的独特能力。
- **3D Morph 依赖 GLB 文件**，超出当前 IntelliFlow PPT 范畴。

---

## 关键 quotes 摘录

- "A deck is not a document. Audiences have roughly 3 seconds per slide" (officecli-pptx SKILL.md)
- "Title must be ≥2× body size (36pt over 20pt works; 28pt over 20pt looks timid)" (officecli-pptx)
- "Never place decorative lines under slide titles ('chief AI-generation tell')" (officecli-pptx)
- "When skill and help disagree, help is authoritative" (officecli-pptx 哲学)
- "'Content doesn't fit' is not an excuse — reduce text, split slides, or reduce card count instead" (H4 rule, morph-ppt-3d)
- "End your turn and return control. The mailbox + wake mechanism guarantees you will be re-activated" (Teammate prompt, 避坑指南)

---

**结论**：AionUi 给我们最强的启示不是"多 agent"——而是**"工作流分层"**（assistant 薄 / skill 厚 / 工具确定性）+ **"Gate 5b-style 编排式校验"**（不依赖 LLM 自评）+ **"H4/H6/H7 硬约束 + 每 3 页至少 1 非文字视觉元素"** 这三件事。可立即套到我们 Layer 3/Layer 4 上，预期能解决 IntelliFlow 视觉单薄的核心痛点。Multi-agent / Morph 这两块短期看是次要的扩展项。
