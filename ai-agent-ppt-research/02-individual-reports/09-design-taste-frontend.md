# leonxlnx/taste-skill/design-taste-frontend — Skill 分析

> **源**: `https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §8
> **类型**: 高度参数化的 Senior UI/UX engineer skill（带 3 个数值 dial）

---

## 1. 概览

这条 skill 把"前端审美"做成了**可调参数化系统**。整个 skill 顶部就声明三个 0-10 dial：
- `DESIGN_VARIANCE: 8`（1=完美对称 / 10=艺术混乱）
- `MOTION_INTENSITY: 6`（1=静态 / 10=电影级物理）
- `VISUAL_DENSITY: 4`（1=画廊 / 10=驾驶舱）

默认 baseline `(8, 6, 4)`，可按 user request 动态调整。这三个 dial 在 Section 3-7 内作为 if-else 触发条件——例如 `VISUAL_DENSITY > 7` 时禁用 generic card，强制 `border-t` / `divide-y` / 负空间。

skill 还有一个特别完整的"Creative Arsenal"——列出 ~40 个高级 pattern（Magnetic Button / Gooey Menu / Dynamic Island / Bento Grid / Mesh Gradient Background / Kinetic Marquee / Text Mask Reveal 等），并提供"Motion-Engine Bento Paradigm"作为 default reference 设计。

---

## 2. 核心方法

**Variance Engine（三 dial）**：用确定性数值控制风格强度，避免每次输出都偏向同一区间。

**反 slop 硬规则**：
- 字体：禁 Inter，强推 Geist / Outfit / Cabinet Grotesk / Satoshi
- 颜色：**THE LILA BAN** = "AI Purple/Blue" 禁绝，无 purple button glow，无 neon gradient
- 布局：**ANTI-CENTER BIAS** = `LAYOUT_VARIANCE > 4` 时居中 H1 BANNED
- 卡片：`VISUAL_DENSITY > 7` 时 generic card 容器 BANNED → 改用 `border-t`/`divide-y`/负空间
- 内容：禁 "John Doe" / 禁 generic avatar / 禁 99.99% / 禁 Acme/Nexus / 禁 "Elevate/Seamless" 文案

**AI Tells 黑名单**：neon glows / pure black / oversaturated accents / gradient text / custom cursors / oversized H1 / 3-column card row / 完美 padding。

**Motion-Engine Bento Paradigm**（default 参考）：
- palette `#f9fafb` 背景 + 白色卡片 + `border-slate-200/50`
- `rounded-[2.5rem]` + diffusion shadow `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`
- Spring physics + `layoutId` 重排 + 后台无限循环 + memoize 隔离永久动画
- 五种 card 原型：Intelligent List / Command Input / Live Status / Wide Data Stream / Contextual UI

**默认架构规则**：禁 emoji（用 Phosphor / Radix icons）；用 CSS Grid 替代 flex math；`min-h-[100dvh]` 不 `h-screen`；图标 strokeWidth 标准化 1.5 或 2.0。

---

## 3. 关键 prompt 片段或规则

> "DESIGN_VARIANCE: 8 (1=Perfect Symmetry, 10=Artsy Chaos) / MOTION_INTENSITY: 6 / VISUAL_DENSITY: 4 — Standard baseline strictly (8, 6, 4)."

> "THE LILA BAN: 'AI Purple/Blue' aesthetic is BANNED. No purple button glows, no neon gradients."

> "ANTI-CENTER BIAS: Centered Hero/H1 sections BANNED when LAYOUT_VARIANCE > 4."

> "DASHBOARD HARDENING: For VISUAL_DENSITY > 7, generic card containers BANNED. Use `border-t`, `divide-y`, or negative space."

> "ANTI-EMOJI POLICY: NEVER use emojis. Replace with Radix/Phosphor icons."

> "Display/Headlines: `text-4xl md:text-6xl tracking-tighter leading-none`"

> "VISUAL_DENSITY: 8-10 Cockpit (monospace numbers mandatory)."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：GlobalConstitution（全局宪法层，作为参数化系统）+ StyleGenes**——这是**最适合 IntelliFlow 直接吸收的 skill**，因为它已经把"美学决定"做成了数值化、确定性的规则系统，与 IntelliFlow 的 4 层 pipeline 天然契合。

**GlobalConstitution 直接吸收"三 dial"**：
- 每个 deck 在生成 brief 时确定 `DECK_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY` 三个数值
- 数值作为后续 StyleGenes / TemplateGenes / PageBrief 的硬约束
- 例如 `VISUAL_DENSITY > 7` 自动禁用卡片化版式，改用横线分隔（这恰好对治 IntelliFlow 当前"无脑套卡片"的问题）

**StyleGenes 吸收反 slop 规则集**：
- 字体黑白名单：禁 Inter / Roboto / Arial / 系统字体；强推 Geist / Outfit / Cabinet Grotesk / Satoshi（中文场景可对应到 思源/霞鹜 等）
- 颜色：LILA BAN——禁紫色 + 蓝色 AI 渐变
- 数字密集页（财务）自动启用 monospace 数字
- icon：标准化 strokeWidth；禁 emoji

**TemplateGenes 吸收 Anti-Center Bias**：
- 章节封面禁居中 H1（除非显式 variance 拉低）
- 强制 Split Screen / Left Aligned content + Right Aligned asset / Asymmetric White-space 三选一

**PageBrief 层吸收 5 card archetypes 灵感**：Intelligent List / Live Status / Wide Data Stream 等可对应到 PPT 的 list 页 / 指标页 / 数据流页

**最直接对症 IntelliFlow 问题**：
- 视觉不连贯 → 三 dial 锁定到 deck 级别后，跨页风格强度统一
- 弱背景 → `VISUAL_DENSITY` 参数化后，低密度页自动启用大量负空间 + 单色铺底，高密度页强制无 card
- 弱字体层级 → 显式给出 `text-4xl md:text-6xl tracking-tighter leading-none` 这类成品 token
