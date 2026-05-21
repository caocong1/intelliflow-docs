# pbakaus/impeccable/critique — Skill 分析

> **源**: `https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/critique.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §4
> **类型**: 双盲设计评审 + 自动检测器联合评估 skill

---

## 1. 概览

`critique` 是 impeccable 套件中的"设计批判家"。它对一个设计目标跑 **两个独立评估**——A: 模型主导的 design review；B: detector 脚本 + 浏览器证据——然后合成结果、持久化、并以"用户下一步优先级"问题收尾。整个流程强制 **assessment independence**：Assessment A 必须在不看 B 的输出下先完成，避免 confirmation bias。

skill 不是"给我一些反馈"，而是把设计评审做成了"研究方法"：互相独立的双盲评估 + 可追溯的报告快照 + 趋势线 + 锁定 P0–P3 优先级。其核心野心是把"设计批评"从主观艺术变成**可复现的评估流程**。

---

## 2. 核心方法

**Assessment A（Design Review）**：跑 5 个标准化框架
- AI slop detection（这个设计是否一眼就 scream "AI generated"）
- Nielsen 10 heuristics（每个 0–4 分打分）
- 认知负载 checklist
- Peak-end rule 的情感旅程
- Persona 红旗
- 返回：2–3 strengths + 3–5 priority issues + 挑衅式问题

**Assessment B（Detector + Browser Evidence）**：跑脚本 `detect.mjs` 扫 markup，或在 URL 上做浏览器可视化 overlay。明确规则：**"Do not claim a user-visible overlay exists unless script injection succeeded and the detector ran in the page."**

**Target Resolution**：宽泛指向（"the homepage"）必须解析为具体 file path 或 URL；**paths preferred over dev-server URLs because ports drift**。

**Synthesis & 持久化**：把双结果织在一起，标注一致点 / detector 抓到但 LLM 漏掉的项 / false positives。报告 snapshot 写到 `.impeccable/critique/` 并附最近 5 次评分的趋势线。

**Engagement protocol**：完成后向用户问 2–4 个"基于实际发现"的针对性问题（**禁止 generic 用户画像问题**），每个问题给 2–3 个具体选项。

---

## 3. 关键 prompt 片段或规则

> "Assessment Independence: Design review (Assessment A) completes first without seeing detector output (Assessment B). Both must finish before synthesis."

> "Do not claim a user-visible overlay exists unless script injection succeeded and the detector ran in the page."

> "If everything is important, nothing is — ruthless prioritization required."

> "Feedback must be direct, specific, actionable."

> "Present full structured critique in chat (not summary + link)."

> "Then ask 2–4 targeted questions grounded in actual findings — never generic audience questions."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：RenderedPage（验收层）+ visual QA subagent 升级**。当前 IntelliFlow 的 visual QA 似乎是"看一眼，挑几个问题"，把它升级为 `critique` 流程后，每个 deck 都跑：

1. **Assessment A（LLM 评审 subagent）**：基于 deck 的 Nielsen 改编（PPT 版的 10 heuristics——visual hierarchy / consistency / aesthetic-minimalist / error recovery 等）+ AI-slop detection（紫色渐变？三列卡片？无脚注？） + 信息密度负载 + peak-end（开篇/结尾留下什么感受）
2. **Assessment B（Detector）**：跑确定性脚本——颜色 token 漂移检测、字体一致性检测、对齐网格检测、文字溢出框检测、图标 strokeWidth 检测
3. **Synthesis**：合成报告，明确 P0–P3 优先级；持久化到 `.intelliflow/critique/{deck-id}/`，记录 5 次迭代趋势

**对 PageBrief 层的反馈环**：critique 的发现要回写到 PageBrief 上下文，让下一轮生成有据可依。

**关键迁移到 prompt**："If everything is important, nothing is"——直接写进 visual QA subagent 的 system prompt，强制 ruthless prioritization，避免输出"100 个小问题但用户不知道先改哪个"。

**Independence 原则**：A 和 B 必须并行启动，互不可见——可以用两个 subagent 实现，避免视觉评审被 detector 数字 anchor 拖偏。
