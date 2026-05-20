# vercel-labs/agent-skills/web-design-guidelines — Skill 分析

> **源**: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
> **原始资料**: `/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/skills-sh/design-skills-RAW.md` §7
> **类型**: 静态规则审计 skill（high-signal anti-pattern checklist）

---

## 1. 概览

Vercel Labs 把"前端 UI 是否合格"做成了一份**机器可消费的 checklist**：每条规则都是一行 terse rule，按 13 个类别组织（accessibility / focus / forms / animation / typography / content / images / performance / navigation / touch / safe areas / dark mode / i18n / hydration / hover / copy / anti-patterns）。skill 输出格式也是 terse：按文件分组，`file:line` 格式，问题 + 位置，不解释（除非 fix 不显然）。

这条 skill 与其它"美学指引"不同——它是一份**可自动化、可代码扫描**的工程级规则，不输出审美 judgement，只输出"违反/未违反"。它的 typography 与 content 段落在 PPT 场景里有大量直接可迁移内容。

---

## 2. 核心方法

**Anti-pattern blacklist**：列出 12 项硬"不允许"——`user-scalable=no` / `onPaste preventDefault` / `transition: all` / `outline-none` 无 focus replacement / `<div onClick>` / 图片无尺寸 / `.map()` 无虚拟化大列表 / 表单输入无 label / icon button 无 `aria-label` / 硬编码日期数字 / `autoFocus` 无明确理由 / 内联导航。

**Typography rules**（PPT 高相关）：
- 用 `…` 而不是 `...`
- 用弯引号 `"` `"` 而不是直引号 `"`
- non-breaking space：`10&nbsp;MB`、`⌘&nbsp;K`、品牌名
- Loading 状态用省略号收尾：`"Loading…"`、`"Saving…"`
- 数字列/对比使用 `font-variant-numeric: tabular-nums`
- 标题用 `text-wrap: balance` 或 `text-pretty` 避免寡行

**Content & Copy rules**（PPT 高相关）：
- 主动语态："Install the CLI"，不是"The CLI will be installed"
- 标题/按钮用 Title Case（Chicago style）
- 数字用阿拉伯：`"8 deployments"` 不是 `"eight"`
- 按钮文案具体：`"Save API Key"` 不是 `"Continue"`
- 错误信息包含 fix / next step
- 用第二人称；避免第一人称
- 空间紧凑时用 `&` 替代 "and"

**Output format**：按文件分组 + `file:line` 定位 + terse 描述。高 signal/noise 比的工程报告。

---

## 3. 关键 prompt 片段或规则

> "Output concise but comprehensive—sacrifice grammar for brevity. High signal-to-noise."

> "Use `…` not `...`. Curly quotes `\"` `\"` not straight `\"`."

> "Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names."

> "Loading states end with `…`: `\"Loading…\"`, `\"Saving…\"`."

> "`font-variant-numeric: tabular-nums` for number columns/comparisons."

> "Use `text-wrap: balance` or `text-pretty` on headings (prevents widows)."

> "Specific button labels: 'Save API Key' not 'Continue'."

> "Error messages include fix/next step."

---

## 4. 对 PPT 视觉质量提升的可迁移点

**主要插入层：RenderedPage（出厂前 lint）+ StyleGenes（字体规则）**——这是一份现成的"自动化 lint 规则集"，可以直接做成 PPT 的 detector 脚本（结合 `critique` skill 的 Assessment B）。

**StyleGenes 层吸收（typography micro-polish）**：
- 中文 PPT 强制使用 `text-wrap: balance` 等价物——标题不能出现"末行 1 字孤儿"
- 数字密集页（财务/对比）强制 tabular-nums 字体特性
- 省略号、引号必须用排印正字：`…`/`"`/`"`
- 标题 + 单位之间 non-breaking：`10 MB` / `¥ 100` / `45%` 之间避免换行
- 中英文标点混排时强制使用中文标点（。，：；）+ 中英文空格 token

**PageBrief 层吸收（copy 规则）**：
- bullet 强制主动语态（中文场景：动词开头）
- bullet 强制带具体名词，禁止"实现优化"这类抽象动词
- 按钮/CTA 文案具体化："导出 PDF"，不是"完成"
- 错误/提示包含 next step

**TemplateGenes 不直接受影响**，但 Vercel 的 "anti-pattern flag these" 列表可以转译为 PPT 的"反模式黑名单"——例如"图表无单位" / "饼图分类>5个" / "正文 < 12pt" 等。

**最佳迁移点**：把这份规则做成 IntelliFlow 的 **typography & copy linter**（自动化的、确定性的），与 visual QA subagent 的主观评审独立运行——这恰好对应 `critique` 的 Assessment B 角色。
