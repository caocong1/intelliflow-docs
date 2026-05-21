# IntelliFlow PPT 代码审查（骨架）

> **状态**：骨架待终版报告生成后填充。本文档列出审查范围、检查清单、优先级框架。
> **输入**：阶段 6 的终版报告（skill 形态）+ 主线程已收集的代码观察。

---

## 1. 审查范围

### 1.1 MVP 实验路径（4 层 LandPPT pipeline）

`packages/backend/src/scripts/ppt-mvp/ai-pipeline/`

| 文件 | 行数 | 关注点 |
|---|---|---|
| `pipeline.ts` | 391 | Layer 0-4 编排 + validateHtml + placeholder fallback |
| `prompts.ts` | 516 | SYSTEM_DESIGN + Layer 0-4 prompt builders + variant recipes |
| `types.ts` | 138 | TemplateGenes/StyleGenes/GlobalConstitution/PageBrief/RenderedPage |
| `css-from-genes.ts` | 155 | 确定性 CSS 生成 |
| `render-html.ts` | 73 | headless Chrome 截图 |
| `pack-pptx.ts` | 63 | image-backed PPTX 打包 |
| `claude-client.ts` | 146 | LLM 客户端 + mock |
| `build-from-page-plan.ts` | 166 | 通用 driver |

### 1.2 生产路径（runtime）

`packages/backend/src/modules/runtime/`

| 文件 | 行数 | 关注点 |
|---|---|---|
| `ppt.service.ts` | 200+ | 入口编排 + style 推荐 + OfficeCLI 质检 |
| `ppt-export-ai.service.ts` | 215 | 单次 AI 调用 → SlidePresentation JSON |
| `ppt-deck-composition.ts` | 468 | inferSemanticRole / inferArchetype / scoreRoleMatch |
| `ppt-archetype-renderer.ts` | 901 | 14 个 archetype 的确定性渲染 |
| `ppt-style-packs.ts` | 303 | 6 个 style pack（corporate_blue / minimal_gold / tech_dark / warm_review / high_contrast / consulting_gray）|
| `ppt-scene.ts` | 812 | scene_canvas 渲染（visual_premium_v1）|
| `ppt-visual-premium.ts` | 1024 | visual_premium_v1 主入口 |
| `slide-schema.ts` | 172 | SlidePresentation JSON Schema 校验 |

### 1.3 其他相关

- `packages/backend/src/modules/ppt-templates/` — native template profile + 校验
- `packages/backend/src/scripts/ppt-mvp/preserve/` — Preserve mode (模板保真) + html-roundtrip
- `packages/backend/src/scripts/ppt-mvp/html-styles/622eee2ab7e6e/` — HTML 模板样例
- `docs/design/ppt-mvp/*.md` — 设计文档

---

## 2. 检查清单（基于横向分析的 11 个缺口）

每项审查输出："现状描述 + 改进方向 + 工作量评估 + 优先级"

| # | 缺口 | 审查目标 |
|---|---|---|
| **C1** | 缺 spec_lock 机器契约 | Layer 1/2 输出是自然语言，是否能升级为机器契约？ |
| **C2** | 缺 NEVER-list 密度 | prompts.ts SYSTEM_DESIGN 仅 1 条 avoid 句子。能加多少条？|
| **C3** | 缺视觉 QA 闭环 | pipeline.ts validateHtml 仅静态结构。能否加 subagent 视觉评审？ |
| **C4** | 缺 3D 图像锁 | visual brief 仅 imageLanguage 一词。能否升级为 rendering+palette+type？ |
| **C5** | retry 反馈不结构化 | Layer 4 retry 仅"failed validation"。能否注入具体错误信息？ |
| **C6** | placeholder fallback 是 anti-pattern | pipeline.ts L289 renderPlaceholder。能否取消，要求重生成？ |
| **C7** | curated palette 缺失 | TemplateGenes 是 LLM 推断。能否提供 10 套兜底？ |
| **C8** | PageBrief visualElement 字段缺失 | PageBrief 仅 primaryFocal 自然语言。能否加 enum？ |
| **C9** | font stack 无兜底 | css-from-genes.ts L47 字体栈仅 2-3 项。能否强制以 Windows 预装字体结尾？ |
| **C10** | Icon library 未锁定 | 无明确 icon 库选择。能否加 library_id？ |
| **C11** | Style packs 仅 6 套 | ppt-style-packs.ts 硬编码 6 套。能否引入 anthropics 的 10 套？|

---

## 3. 改动方案分级

### Tier 1：prompt-only（零代码风险，立即可发）
- C2 NEVER-list 扩充
- C7 curated palette 注入 Layer 0 prompt
- C9 font stack 兜底（在 prompt 末尾加 fallback 要求）
- C4 visual brief schema 加 rendering/palette/type 字段

### Tier 2：schema + validation 增强（中等风险）
- C1 spec_lock 层
- C5 结构化 retry 反馈
- C8 PageBrief.visualElement enum + 渲染后校验
- C10 spec_lock 含 icon_library_id

### Tier 3：架构升级（高风险，需要分阶段）
- C3 subagent 视觉 QA 闭环
- C6 取消 placeholder fallback（先观察 retry 命中率）
- C11 style packs 扩到 10 套（与 anthropics 对齐）

---

## 4. 评估指标（决定优化是否有效）

| 指标 | 测量方法 |
|---|---|
| Layer 4 一次性通过率 | pipeline.test.ts 跑 6 页 × 3 brief 配置 = 18 样本，看 `retryCount=0` 比例 |
| 视觉元素覆盖率 | PNG 渲染后扫描非文字元素（image/svg/shape）出现率 |
| 颜色 token drift | 渲染后 HTML 用色 vs spec_lock 锁定色差异 |
| 跨页一致性（视觉） | 6 页 PNG 用 LLM 主观打分 1-5（PPTEval Coherence rubric）|
| placeholder fallback 触发率 | session log 中 `retryCount=2` 占比 |
| 端到端延迟 | 6 页 deck 总耗时（含 retry）|

---

## 5. 测试策略

### 5.1 现有测试
- `pipeline.test.ts` (420 行) — pipeline 集成测试，4-6 页 mock provider
- `claude-client.test.ts` — LLM 客户端单元
- `css-from-genes.test.ts` — CSS 生成
- `live-config.test.ts` — provider 配置

### 5.2 优化后新增测试
- spec_lock schema 单元测试
- NEVER-list 命中扫描（用 fixture HTML 测试反模式被拒）
- visual QA subagent mock 测试
- placeholder fallback 取消后的 retry 上限测试

### 5.3 验收
- `bun vitest run packages/backend/src/scripts/ppt-mvp/ai-pipeline/` 全绿
- 至少 1 次 mock-mode 端到端跑通 6 页
- 至少 1 次 live-mode 端到端跑通 6 页（用 doubao-seed-2.0-pro）
- 输出 PPTX 通过 `unzip -t` 完整性检查

---

## 6. 输出形式

最终代码审查报告写在 `/home/user/intelliflow-docs/ai-agent-ppt-research/07-code-review/CODE-REVIEW.md`，包含：

1. Executive Summary（≤300 字）
2. 11 个缺口的逐项审查（C1-C11）
3. 改动方案的 P0/P1/P2 分组
4. 风险与回退策略
5. 实施顺序（PR 拆分建议）

优化实施在 `08-optimization-plan/` 目录，包含：

- `OPTIMIZATION-PLAN.md` — 主计划
- `01-tier1-prompt-only.md` — Tier 1 详细 diff
- `02-tier2-schema.md` — Tier 2 详细 diff
- `03-tier3-architecture.md` — Tier 3 详细路线
- `TEST-PLAN.md` — 验证方案
