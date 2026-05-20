# pbakaus/impeccable/bolder — Skill 分析

> **源**: `https://raw.githubusercontent.com/pbakaus/impeccable/main/skill/reference/bolder.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §5
> **类型**: 把"安全/通用"的设计放大成"distinctive"的 amplification skill

---

## 1. 概览

`bolder` 是 impeccable 套件中专门治"设计太安全/太 AI-generic"的 amplifier。它的核心定义非常重要：**"bolder" 不是"更多效果"，而是 "distinctive: extreme scale, unexpected color, typographic risk, committed POV"**。

这条 skill 最有价值的部分是它**显式列出 AI 在被要求"再大胆一点"时会犯的典型错误**：cyan/purple 渐变、glassmorphism、暗背景上的霓虹 accent——这些都**不是 bolder**，反而是 AI 的常见 tells。它给了一套结构化的 amplification 策略，覆盖 typography / color / space / effects / composition 五维。

---

## 2. 核心方法

**Six weakness sources in safe designs**（先识别"为什么平庸"）：
1. generic choices
2. timid scale
3. low contrast
4. static presentation
5. predictability
6. flat hierarchy

**五维 amplification strategies**：

| 维度 | 具体动作 |
|------|---------|
| Typography | 换 distinctive 字体；制造 3x–5x extreme size jump；pair extreme weights |
| Color | 提高 saturation；用一个 bold color 占 60%；避免标准渐变 |
| Space | gap 用 100–200px 而非 20–40px；故意 break grid；layer elements asymmetrically |
| Effects | dramatic shadows + textures；**explicitly reject glassmorphism**（"it's overused AI slop"） |
| Composition | 清晰 focal point；用 70/30 非对称切分代替 balanced layout |

**Ultimate test**：把成品给人看，如果对方立刻识别出"这是 AI 生成的"——设计失败。

---

## 3. 关键 prompt 片段或规则

> "When asked for 'bolder,' AI defaults to the same tired tricks: cyan/purple gradients, glassmorphism, neon accents on dark backgrounds. These are NOT bolder."

> "Bold means distinctive, not 'more effects.'"

> "Use one bold color dominating 60% of design; avoid standard gradients."

> "Use 100–200px gaps instead of standard 20–40px; break grids intentionally; layer elements asymmetrically."

> "Unexpected proportions like 70/30 splits rather than balanced layouts."

> "The ultimate test: would showing the result prompt immediate recognition of AI authorship? If yes, the design failed."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：StyleGenes（风格基因）+ TemplateGenes（模板基因）**——这是治 IntelliFlow"弱背景 + 弱字体层级"病的最对症 skill。

**StyleGenes 升级**：
- **Type scale**：当前 PPT 的 H1/H2/Body 大概率差距太小，导致视觉层级"flat"。引入 `bolder` 的"3x–5x size jump"——H1 用 96–144pt，副标 36pt，正文 14–16pt
- **Color**：禁用 cyan/purple gradient & glassmorphism；一张 PPT 中允许的最大 accent 比例是 60%，其余为中性
- **Spacing**：增加宏观留白；section padding 100–200px 量级，不要 20–40px 量级
- **Pairing weights**：H1 用 Black/950，副标用 Light/300，制造对比冲击

**TemplateGenes 升级**：
- 模板要支持 70/30 非对称切分，而不仅是 50/50 或居中
- 故意 break grid 的"打破型"页型作为节奏 contrast

**插入到 PageBrief**：每个 brief 要带"focal point"字段，明确这一页的视觉锚是什么。

**RenderedPage QA 嵌入"ultimate test"**：visual QA subagent 在打分时强制问"这看起来像不像一眼就被认出是 AI 做的 PPT"——如果是，触发 bolder 重生。

**对当前问题最直接的对症**：
- **背景弱** → 强制采用 dramatic shadow / texture / dominant-color 60% 填色，而不是默认白底
- **字体层级弱** → 直接套 3x–5x 跳级规则
- **图标平庸** → 用 outlined / extreme-weight icon set，避免 stroke-1 标准 lucide
