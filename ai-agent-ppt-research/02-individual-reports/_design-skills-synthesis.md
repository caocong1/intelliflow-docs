# 9 个 Design Skills 综合方案 — 如何叠加到 IntelliFlow 4 层 Pipeline

> 综合自 02-09 个个体报告，目标：解决 IntelliFlow PPT 当前的"页间视觉不连贯、背景/图标/字体层级弱"。

---

## 9 个 skill 在 4 层 pipeline 的分工矩阵

| Skill | GlobalConstitution | TemplateGenes | StyleGenes | PageBrief | RenderedPage |
|-------|:------------------:|:-------------:|:----------:|:---------:|:------------:|
| 02 frontend-design | ★ POV/tone | | ★ 反 slop 黑名单 | ★ tone tag | |
| 03 canvas-design | ★ deck philosophy | ★ coffee table 节奏 | ★ 系统观察语言 | ★ craftsmanship 修辞 | |
| 04 polish | | | | | ★ anti-drift 门 |
| 05 critique | | | | ★ 反馈回写 | ★ 双盲 QA |
| 06 bolder | | ★ 70/30 切分 | ★ 字号 3x–5x 跳级 | ★ focal point | ★ "AI 一眼识破"测试 |
| 07 distill | | ★ 线性垂直流 | ★ 1 family + 4 字号 | ★ 1 primary message | |
| 08 vercel guidelines | | | ★ 排印正字 | ★ 文案规则 | ★ 自动 lint detector |
| 09 design-taste-frontend | ★ 3-dial 参数化 | ★ Anti-Center 强制 | ★ 反 slop 字体/色 | | |
| 10 high-end-visual-design | ★ Variance Mandate | ★ Vibe + Layout 选择 | ★ Double-Bezel/Eyebrow | | ★ "$150k agency" 测试 |

---

## 推荐叠加顺序（自顶向下）

### Layer 1 · GlobalConstitution（宪法层）
吸收 `09 design-taste-frontend` 的**三 dial 参数化**（DECK_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY）+ `10 high-end-visual-design` 的 **Variance Mandate**（不重复上次组合）+ `03 canvas-design` 的 **Movement Name + Manifesto** + `02 frontend-design` 的 **Bold POV first**。
**产出**：每个 deck 在生成前先确定一个唯一的"运动名 + 三 dial 数值 + Vibe Archetype"，整个 deck 后续都受此约束。

### Layer 2 · TemplateGenes（模板基因）
吸收 `10` 的 **Vibe + Layout Archetype 二维选择**（Ethereal Glass / Editorial Luxury / Soft Structuralism × Asymmetric Bento / Z-Axis / Editorial Split）+ `09` 的 **Anti-Center Bias** + `06 bolder` 的 **70/30 非对称切分** + `03` 的 **coffee table book 节奏**（每页是同一哲学的 unique twist）+ `07 distill` 的 **vertical linear flow**。
**产出**：6 套基础版式 × 3 套 vibe = 18 个 template combinations，按 deck 的 dial 值选择。

### Layer 3 · StyleGenes（风格基因）
最关键的一层，吸收最多：
- `10`：**Double-Bezel 嵌套** + **Eyebrow Tags** + 大留白 (py-24 ~ py-40)
- `09`：禁字体 LILA BAN + monospace 数字（高密度时）+ 反 slop 黑名单
- `06`：字号 3x–5x 跳级 + 60% dominant color
- `07`：1 family + 4 字号 + 1 primary + 1 accent
- `08`：排印正字（… " " tabular-nums text-wrap balance）
- `02`：背景必有 gradient mesh / noise / pattern / shadow 之一
- `03`：systematic observation 视觉语言（dense repetition / patient accumulation）

### Layer 4 · PageBrief（页摘要层）
- `07`：每页 1 primary message + 5 bullets 上限
- `06`：每页明确 focal point
- `08`：bullets 主动语态 + 具体名词 + CTA 文案具体化
- `03`：craftsmanship 修辞嵌入元数据
- `05`：上一轮 critique 的发现回写为生成约束

### Layer 5 · RenderedPage（出厂层）
- `04 polish`：11 维度 anti-drift 检查
- `05 critique`：双盲 Assessment A（LLM 评审）+ B（detector 脚本）
- `08`：自动化 typography & copy linter（detector）
- `06`：AI-authorship 一眼识破测试
- `10`：$150k agency 测试

---

## 核心心智迁移（一句话）

| skill | 关键心智 |
|-------|---------|
| 02 | intentionality, not intensity |
| 03 | information lives in design, not paragraphs |
| 04 | polish without alignment is decoration on top of drift |
| 05 | if everything is important, nothing is |
| 06 | bold means distinctive, not "more effects" |
| 07 | simplicity is removing obstacles, not features |
| 08 | high signal-to-noise, file:line terse |
| 09 | LILA BAN（紫蓝 AI 渐变绝禁） + dial 参数化 |
| 10 | reads as $150k agency build, not template with nice fonts |

合起来：**先有 POV，再做参数化收敛，然后用 micro-aesthetic 落地（Double-Bezel/Eyebrow/留白/字号跳级），最后双盲 QA 兜底**。
