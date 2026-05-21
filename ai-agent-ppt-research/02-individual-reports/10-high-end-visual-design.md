# leonxlnx/taste-skill/high-end-visual-design (= soft-skill) — Skill 分析

> **源**: `https://raw.githubusercontent.com/leonxlnx/taste-skill/main/skills/soft-skill/SKILL.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §9
> **类型**: Awwwards-tier 顶配前端 skill（持 Vanguard_UI_Architect 人格）

---

## 1. 概览

这条 skill 与 `design-taste-frontend` 出自同一作者，但定位更高端——目标是 **$150k+ 代理级数字体验**，模型扮演 `Vanguard_UI_Architect` 人格。整篇 SKILL.md 围绕一个核心目标：让产出读起来像 "$150k agency build, not template with nice fonts"。

它最独特的贡献是一套高度具体的"**haptic 微美学**"工具集——尤其是 **Double-Bezel（双层贝塞尔嵌套）** 和 **Button-in-Button** 这两个微构造，加上严格的 motion choreography（自定义 cubic-bezier + scroll interpolation + magnetic hover）。

整个 skill 通过 **Variance Mandate** ("NEVER generate the same layout or aesthetic twice in a row") 锁定输出多样性。

---

## 2. 核心方法

**Absolute Zero 黑名单**（任一项命中直接失败）：
- 字体：Inter / Roboto / Arial / Open Sans / Helvetica BANNED → 用 Geist / Clash Display / PP Editorial New / Plus Jakarta Sans
- 图标：标准 Lucide / FontAwesome / Material BANNED → 用 Phosphor Light / Remix Line
- 边框/阴影：generic 1px solid gray borders BANNED；harsh dark shadows BANNED
- 布局：edge-to-edge sticky navbar BANNED；对称 3 列 grid 无 whitespace BANNED
- 动效：standard `linear` / `ease-in-out` BANNED；instant state change BANNED

**Variance Engine** (Vibe + Layout, 每次 roll 一次):

**A. Vibe Archetypes（三选一）**：
1. **Ethereal Glass**（SaaS/AI/Tech）：OLED 黑 `#050505` + radial mesh gradient（subtle purple/emerald 光球） + Vantablack cards 配 `backdrop-blur-2xl` + white/10 hairline + 宽 geometric Grotesk
2. **Editorial Luxury**（Lifestyle/Agency）：warm cream `#FDFBF7` + muted sage + deep espresso + Variable Serif 巨标题 + noise/film-grain `opacity-[0.03]`
3. **Soft Structuralism**（Consumer/Health/Portfolio）：silver-grey / white 背景 + 巨大 bold Grotesk + airy floating components + diffused ambient shadows

**B. Layout Archetypes（三选一）**：Asymmetrical Bento / Z-Axis Cascade / Editorial Split

**Haptic 微美学（最独特部分）**：

**Double-Bezel（双层贝塞尔）**：never place a card flat on background
- Outer Shell: 包裹 div + `bg-black/5` + `ring-1 ring-black/5` + `p-1.5`/`p-2` + `rounded-[2rem]`
- Inner Core: 不同背景 + 内高光 `shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]` + 数学计算的更小半径 `rounded-[calc(2rem-0.375rem)]`（同心曲线）

**Button-in-Button**：尾部 icon 嵌在 own 圆形 wrapper `w-8 h-8 rounded-full bg-black/5`

**Spatial Rhythm**：双倍标准 padding；section 用 `py-24` 到 `py-40`；H1/H2 前必有 micro pill eyebrow tag `rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em]`

**Motion Choreography**：所有动效用 custom cubic-bezier 如 `cubic-bezier(0.32, 0.72, 0, 1)`；scroll entry 用 `translate-y-16 blur-md opacity-0` → 800ms 完成；IntersectionObserver 实现，禁止 scroll listener

---

## 3. 关键 prompt 片段或规则

> "NEVER generate the same layout or aesthetic twice in a row."

> "Never place a card flat on the background. Use nested enclosures: Outer Shell … Inner Core with inner highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`), mathematically calculated smaller radius `rounded-[calc(2rem-0.375rem)]` for concentric curves."

> "Eyebrow Tags: Microscopic pill badge before H1/H2 (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`)."

> "Macro-Whitespace: Double standard padding. Use `py-24` to `py-40` for sections."

> "All motion must simulate real-world mass and spring physics. Use custom cubic-beziers (e.g., `cubic-bezier(0.32,0.72,0,1)`)."

> "Reads as '$150k agency build', not 'template with nice fonts'."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：StyleGenes（haptic 微美学层）+ TemplateGenes（archetype 选择层）**——这条 skill 给的是**最高密度的具体可执行 token**，几乎可以无损翻译到 PPT 视觉规则。

**StyleGenes 直接复刻 Double-Bezel**：
- PPT 中的每个 card / quote / metric 不允许"扁平贴在背景"
- 强制嵌套：外层（薄底色 + 1px hairline + 圆角 R1）+ 内层（不同底色 + 内高光 + 圆角 R1 - 1.5\*p）
- 这一项就能解决 IntelliFlow"图标/卡片单薄无质感"的问题，且实现成本极低

**StyleGenes 复刻 Eyebrow Tags**：
- 每页 H1/H2 上方必须有微型 pill 标签：`SECTION 02 · DATA INSIGHTS` 风格
- 这能立即建立"高端杂志感"且大幅改善视觉层级

**StyleGenes 复刻 Spatial Rhythm**：
- section padding 用大于业内常见值 1.5–2 倍的留白
- 字号 jump 至少 4x（H1 → 副标 → 正文）

**TemplateGenes 吸收三 Vibe Archetype**：
- 让用户/AI 在 deck 级别选择 Ethereal Glass / Editorial Luxury / Soft Structuralism 之一
- 每个 archetype 自带完整的色板 + 字体 + texture 规则，避免风格漂移
- 这恰好对症 IntelliFlow"视觉不连贯 + 弱背景"——选 Ethereal Glass 时背景自带 radial mesh gradient，选 Editorial Luxury 时背景自带 film grain

**GlobalConstitution 复刻 Variance Mandate**：
- 每次新 deck 必须从历史中 roll 出与上次不同的 Vibe + Layout 组合
- 强制差异化，避免每个用户拿到的 PPT 长得一样

**RenderedPage QA 阶段强制 "$150k agency" 测试**：让 visual QA subagent 问"这看起来像 $150k 代理出品 还是 template with nice fonts"。

**最高 ROI 的迁移**：Double-Bezel 嵌套 + Eyebrow Tag + 大留白 + custom cubic-bezier 这四个微构造，单独任一项都能让 PPT 立刻有"质感",合在一起几乎是一条 plug-and-play 升级路径。
