# pbakaus/impeccable/distill — Skill 分析

> **源**: `https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/distill.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §6
> **类型**: 移除一切非必要元素的"减法"skill

---

## 1. 概览

`distill` 是 `bolder` 的对立面——专门做减法。核心哲学："Simplicity is not about removing features. It's about removing obstacles between users and their goals."（简化不是去掉功能，而是去掉用户与目标之间的障碍。）

整条 skill 把"减法"系统化为 6 个简化维度，并配以严格的边界约束——不允许减掉必要功能、不允许牺牲可访问性、不允许"为了极简而极简"造成更难用。skill 强调：**复杂度应匹配任务实际复杂度**。

---

## 2. 核心方法

**Six simplification dimensions**：

| 维度 | 具体动作 |
|------|---------|
| Information Architecture | 缩小 scope；progressive disclosure；合并 actions；消除冗余；**明确一个 primary action + 极少 secondary** |
| Visual Simplification | palette 限制为 1–2 色 + 中性色；字体限制为 1 family + 3–4 字号；移除装饰；**剔除无功能的 card** |
| Layout Simplification | 偏好垂直线性流而非复杂 grid；移除 sidebar、内联化；慷慨使用 full-width；保持一致对齐 + 大量 whitespace |
| Interaction Simplification | 减少决策点；smart defaults；inline action 优先于 modal；最小化步骤 |
| Content Simplification | brevity；active voice；plain language；scannable；ruthless elimination of redundant explanations |
| Code Simplification | 删除未使用代码；扁平化组件层级；合并样式；限制组件变体 |

**Safeguards**：不删除必要功能；不牺牲 accessibility；不"过度极简"造成困惑；不删用户决策需要的信息。

---

## 3. 关键 prompt 片段或规则

> "Simplicity is not about removing features. It's about removing obstacles between users and their goals."

> "Restrict color palettes to 1–2 colors plus neutrals; limit typography to one font family with 3–4 sizes; remove decorative elements; eliminate unnecessary cards that don't serve functional purposes."

> "Favor linear vertical flows over complex grids; remove sidebars by moving content inline; use full-width layouts generously; maintain consistent alignment with abundant white space."

> "Complexity should match actual task complexity."

> "Ruthless elimination of redundant explanations."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：PageBrief（页摘要层）+ StyleGenes（风格基因）**——`distill` 是治 IntelliFlow "信息过载导致视觉混乱"的对症 skill。

**PageBrief 层强制约束**：
- 每页**只允许一个 primary message / 一个 primary visual**，所有 secondary 要么 progressive disclose 到 footnote/appendix，要么完全砍掉
- "ruthless elimination of redundant explanations"——禁止 H1 + 副标 + 正文 + 配图 caption 重复同一句话
- bullet 数量上限：5 条；超过强制重新组织信息架构

**StyleGenes 层硬约束**：
- 颜色：1 primary + 1 accent + 中性灰阶。禁止 4 色以上 palette
- 字体：1 family + 最多 4 字号（这与 frontend-design 的 "distinctive font" 并不冲突——挑一个独特字体，但只用这一个字体的不同 weight）
- **"剔除无功能的 card"**：当前 PPT 中常见"为了好看而包 box"的卡片，必须有"elevation communicates hierarchy"的功能理由才允许保留

**TemplateGenes 层**：偏好 vertical linear flow / full-width 版式；避免页内复杂 grid 切分。

**与 `bolder` 的协奏**：`bolder` 负责放大 chosen 元素的视觉冲击；`distill` 负责砍掉没被 chosen 的元素。两者共同作用 = 60% 一种 bold accent + 极少元素 + 大留白 = Awwwards-tier 极简风格。

**最有用的一条直接迁移**：每个 PageBrief 在生成前必须回答一个问题——"如果我把这一页减到只剩 3 个元素，会留下哪 3 个？"留下的就是 primary，其它进入 secondary/appendix。这个动作可以在生成阶段就杜绝信息过载。
