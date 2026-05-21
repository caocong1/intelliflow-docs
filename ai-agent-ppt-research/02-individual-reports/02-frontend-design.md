# anthropics/skills/frontend-design — Skill 分析

> **源**: `https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §1
> **类型**: 通用前端美学指引 prompt skill（无脚本、无数据库）

---

## 1. 概览

Anthropic 官方对"如何避免 AI 风格的前端 slop"提出的总纲。整篇 SKILL.md 是一份高度浓缩的 **prompt-only 美学约束清单**，没有任何脚本、没有任何代码生成器。它把"做出一个不一眼看出是 AI 生成的前端"拆成三件事：(1) 先做 **设计思考**（确定 bold aesthetic direction），(2) 实现时遵守一组**美学守则**（typography / color / motion / spatial / background），(3) 显式列出**禁用模式**（generic fonts、紫色渐变、对称三列等）。整个 skill 的内核是一句话——"intentionality, not intensity"，即不论是极简还是极繁，关键是要有**清晰的 POV** 并贯彻执行。

---

## 2. 核心方法

**Bold-direction first**：每次生成前，先从一组"极端档位"中选一个 tone：brutally minimal / maximalist chaos / retro-futuristic / organic / luxury / playful / editorial / brutalist / art deco / pastel / industrial。SKILL 明确要求"pick an extreme"，不允许 mid-of-road 折衷。

**Match complexity to vision**：maximalist 设计必须有 elaborate code + 大量动画与效果；minimalist 设计必须有 restraint + precision + 极致 spacing 注意。两种方向都可以"赢"，但都需要全力执行。

**Variance mandate**：明确要求"NEVER converge on common choices (Space Grotesk, for example) across generations"，每一次生成都应该不一样，亮/暗主题、不同字体、不同美学都要轮换。

---

## 3. 关键 prompt 片段或规则

> "Bold maximalism and refined minimalism both work - the key is intentionality, not intensity."

> "NEVER use generic AI-generated aesthetics: overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character."

> "Dominant colors with sharp accents outperform timid, evenly-distributed palettes."

> "Backgrounds & Visual Details: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures … gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays."

> "one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions."

> "Match implementation complexity to the aesthetic vision. … Elegance comes from executing the vision well."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：GlobalConstitution（全局宪法层）**——把这套"bold direction first"机制写成宪法层的强制问答：先选一个极端 tone（不允许 generic），再生成 StyleGenes。当前 IntelliFlow PPT 的"视觉不连贯 + 弱背景"问题，根因就是缺少这一层 POV 收敛。

**次要插入层：StyleGenes（风格基因）**——直接吸收 SKILL.md 的反模式黑名单：禁用 Inter/Roboto/Arial 和 purple-on-white 渐变；颜色 palette 必须是 dominant + sharp accent（60% 主色 + 一个尖锐 accent），不允许 timid evenly-distributed palettes。

**RenderedPage 层可吸收**：staggered reveals（动画延迟串联）替代分散的 micro-interaction；背景层必须主动调用 gradient mesh / noise texture / geometric pattern 之一，而不是默认纯色。

**最有用的一句迁移到 PageBrief 提示词**："Choose a clear conceptual direction and execute it with precision"——每张 page brief 都应在 metadata 里携带一个 tone 标签，作为渲染时的硬约束。
