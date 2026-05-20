# pbakaus/impeccable/polish — Skill 分析

> **源**: `https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/polish.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §3
> **类型**: 出厂前最终质量过滤 skill（不做新增，只做对齐）

---

## 1. 概览

`polish` 是 `impeccable` 套件里的"出厂质量门"——专门负责在功能完成后做最后一道精修。整个 skill 的内核就一句话："polish without alignment is decoration on top of drift"（在漂移的基础上再加装饰，只会更糟）。它强制要求：**先对齐 design system，再做 polish**；否则任何精修都是"在不一致基础上叠加更多不一致"。

skill 把 polish 拆成 11 个维度并方法论化处理，并显式拒绝"局部完美但全局不一致"的孤岛打磨。它不是给一个像素调整工具，而是给一套**质量心智 + 维度检查清单**。

---

## 2. 核心方法

**Design System Discovery 先行**：在动手 polish 之前，先识别现有设计系统（tokens / shared components / conventions），把发现到的偏差按"根因"分类——missing tokens / unused shared components / 概念错位。**Polish 不发明新模式**。

**Pre-Polish Assessment（experience-first）**：先问"这个 feature 实际上是否对用户体验有效"，再问视觉是否精美。"a feature that looks beautiful but fights the user's flow is not polished."

**11 维度全覆盖扫描**（核对清单形式）：visual alignment & spacing → IA 与邻近 feature 一致 → 字号层级 → 颜色与 token → 全交互态（default/hover/focus/active/disabled/loading/error/success）→ micro-interaction 尊重 `prefers-reduced-motion` → 内容与文案一致性 → 表单校验/可访问 → edge case 与错误处理 → 跨设备响应式 → 代码整洁。

**Hard Guardrails**：不 polish 未完成的功能；不在不问的情况下猜测系统原则；不引入与现有模式发散的新 pattern；"quality must remain consistent across features rather than perfecting isolated corners"。

---

## 3. 关键 prompt 片段或规则

> "Polish without alignment is decoration on top of drift."

> "Effective design beats decorative polish; a feature that looks beautiful but fights the user's flow is not polished."

> "Categorize deviations by root cause: missing tokens, unused shared components, or conceptual misalignment with neighboring features."

> "Do not polish incomplete work, do not guess system principles without asking, do not introduce new patterns that diverge from established ones."

> "Quality must remain consistent across features rather than perfecting isolated corners."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：RenderedPage（渲染页层）— 作为最后一道质量过滤器**。当前 IntelliFlow 的"页与页之间不连贯"问题，本质上就是 polish 这条 skill 在描述的"drift"——每页各自 polish，整体却越来越散。引入 polish 心智意味着：每页生成后不直接交付，而是过一道"是否与已生成页面对齐"的检查。

**核心动作 mapping 到 PPT pipeline**：

| Polish 维度 | PPT 对应 |
|------------|---------|
| Design System Discovery | 把 GlobalConstitution + StyleGenes 视为 design system；每页 polish 前必须 re-read 这两层 |
| Visual alignment & spacing consistency | 检查所有页同栏宽、同 baseline grid、同 padding scale（参考 impeccable 8/16/24/32/48/80/120） |
| Typography hierarchy | 每页 H1/H2/Body 必须复用 StyleGenes 的 type scale |
| Color & token usage | 强制 100% 走 OKLCH token，禁止页内自由 hex |
| Content consistency | tone of voice / 大小写规范跨页一致（中文场景：术语表对齐） |

**插入到 verify/visual QA subagent**：在视觉 QA 阶段，把 polish 的 11 维度做成 checklist 让 subagent 逐项打分，发现"局部美但与其他页不一致"的孤岛打磨直接打回。

**重要心智迁移**："不对齐的精修是装饰漂移上的装饰"——直接写进 PPT 最终输出环节的 prompt 顶部，作为 anti-drift 锚。
