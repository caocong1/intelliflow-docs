# anthropics/skills/canvas-design — Skill 分析

> **源**: `https://github.com/anthropics/skills/blob/main/skills/canvas-design/SKILL.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §2
> **类型**: 两阶段美学生成 skill（哲学 → 画布表达）

---

## 1. 概览

把"生成一张视觉作品"拆成两步：(1) **Design Philosophy Creation**——写一份艺术运动级别的宣言（manifesto）；(2) **Canvas Creation**——把哲学翻译成 .pdf / .png 输出。SKILL.md 的本质创新是：**不让模型直接画画**，而先生成一个"美学世界观"做约束层。输出是 90% 视觉 + 10% 必要文字。明确目标是看起来像 **museum-grade masterpiece**，不是 AI generated。

整个 skill 包含一个非常特殊的"final step"——它**人为预设了一个用户 push-back**："It isn't perfect enough. It must be pristine, a masterpiece of craftsmanship, as if it were about to be displayed in a museum"，强制模型进入二次打磨阶段。

---

## 2. 核心方法

**Movement-name first（1-2 字命名）**：每个哲学要被命名为一个艺术运动，例如 "Brutalist Joy"、"Chromatic Silence"、"Metabolist Dreams"、"Concrete Poetry"、"Analog Meditation"、"Organic Systems"、"Geometric Silence"。这种命名锁定了 visual DNA。

**Philosophy as scientific-bible vibe**：rendering 时被要求"treat the abstract philosophical design as if it were a scientific bible, borrowing the visual language of systematic observation—dense accumulation of marks, repeated elements, or layered patterns"。这是非常独特的"耐看性"获取方式——靠 repetition 和 patient accumulation 形成"花了很长时间手工做"的视觉感。

**Subtle conceptual thread (Deduce-then-embed)**：用户原始请求里要提取一个"微妙的、niche 的"引用埋进作品里——"Someone familiar with the subject should feel it intuitively."

**Refinement guardrail**：打磨阶段明确禁止"加更多图形"——"If the instinct is to call a new function or draw a new shape, STOP and instead ask: 'How can I make what's already here more of a piece of art?'"

---

## 3. 关键 prompt 片段或规则

> "Emphasize craftsmanship REPEATEDLY: The philosophy MUST stress multiple times that the final work should appear as though it took countless hours to create … Repeat phrases like 'meticulously crafted,' 'the product of deep expertise,' 'painstaking attention,' 'master-level execution.'"

> "Information lives in design, not paragraphs."

> "Treat the abstract philosophical design as if it were a scientific bible, borrowing the visual language of systematic observation—dense accumulation of marks, repeated elements, or layered patterns that build meaning through patient repetition and reward sustained viewing."

> "Text as a contextual element: Text is always minimal and visual-first. Most of the time, font should be thin. … Regardless of text scale, nothing falls off the page and nothing overlaps."

> "Treat the first page as just a single page in a whole coffee table book. Make the next pages unique twists and memories of the original."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：GlobalConstitution（全局宪法层）**——引入"deck philosophy"概念，每个 PPT 在生成前先产出一个 1-2 字的运动名（如 "Quiet Precision"、"Industrial Joy"）+ 4-6 段视觉宣言，作为后续 StyleGenes/PageBrief 的"灵魂约束"。这恰好补齐 IntelliFlow 当前"视觉不连贯"的根本原因——缺少 deck-level POV。

**次要插入层：TemplateGenes（模板基因）**——多页 PPT 必须遵循 "coffee table book" 模型："next pages unique twists and memories of the original"。每页是同一哲学的不同切面，**不是模板复用**。这能解决"页与页割裂"的同时避免"页面同质化"。

**StyleGenes 层吸收**：systematic observation 视觉语言——dense repetition / layered patterns / sparse clinical typography / 系统性 reference markers。这种 DNA 极适合做信息密度高的章节页与封面对比。

**RenderedPage 层吸收**：refinement 阶段的"don't add more graphics, refine what's there"原则可直接写进 visual QA subagent 的 prompt，避免迭代越来越乱。

**craftsmanship 嵌入提示词**：在 PageBrief 元数据中加入 "meticulously crafted / painstaking attention / master-level execution" 等措辞，作为给渲染模型的硬性 framing。
