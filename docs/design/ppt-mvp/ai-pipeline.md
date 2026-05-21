# AI Pipeline (Phase A Iteration 2)

**Position**: 范式 4 路线 (LandPPT 4 层 AI 流水线 + ppt-master 预制元件库 + Anthropic/PPTAgent 双轨视觉 QA 的混合架构) 的第二版生产实现。
**Code**:
- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/` (核心模块)
- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/build-from-page-plan.ts` (内容无关的通用驱动器)
- `packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts` (薄 wrapper：wireless 场景 + mock provider)
- `docs/design/ppt-mvp/wireless-page-plan-expanded.json` (6 页 live 验证集)
- `docs/design/ppt-mvp/wireless-asset-plan-expanded.json` (6 页素材计划)

**研究背景**: `docs/research/template-generation-paradigms.md` §4 / §7.5 / §8.5 / §8.6 / §8.7
**Iteration 2 研究背景**: `ai-agent-ppt-research/06-final/SKILL.md` (editorial-ppt skill v1.0) + `06-final/references/source-deep-dive.md` (13 个 primitive 借鉴溯源)

## 流水线层

```
Layer 0    →  TemplateGenes        (project-level design intent，from brief OR ingested template)
              ↓ deterministic CSS generator (no AI; ensureWindowsFallback for all font stacks)
              04-design-system.css
Layer 1    →  StyleGenes           (verbal design DNA)
Layer 1.5  →  SpecLock             (★ machine contract — locked HEX / fonts / icons / image lock)
              ↓ deterministic (no AI; written to 01b-spec-lock.json)
Layer 2    →  GlobalConstitution   (deck-wide rules)
Layer 3    →  PageBrief[]          (per-page direction; now requires visualElement enum +
                                    layoutArchetype + Variance Mandate vs previous slide)
Layer 4    →  RenderedPage[]       (per-page HTML; prompt RE-ANCHORS on SpecLock first;
                                    validation returns structured ValidationError[];
                                    retry feeds errors back into system prompt PPTAgent-style)
              ↓ headless Chrome
              page.png (1920×1080)
QA (optional, opt-in via opts.visualQa)
              Track A subagent (10-dim × 10-pt rubric, ≥75 threshold)
              Track B detector (color/font drift + banned features + placeholder residue)
              ↓ writes 05-visual-qa.json
              ↓ pptxgenjs image-backed
              <output>.pptx (含 speaker notes)
```

**关键设计决策**：
1. CSS 由代码生成（确定性），不让 AI 写 CSS（避开 LLM 一致性失败模式）。AI 只负责 design tokens 和 per-page HTML 的语义结构。
2. **SpecLock (Layer 1.5)** 是机器契约，把 design tokens 凝固成 verbatim 值。Layer 4 prompt 顶置 spec_lock anchor，强制每页生成前重读（hugohe3/ppt-master 规则 #8 "SPEC_LOCK RE-READ PER PAGE"）。
3. **结构化 retry feedback**（icip-cas/PPTAgent REPL pattern）：validateHtml 返回 `ValidationError[]`，retry 时把具体修复建议注入 system prompt，模型针对性修复而不是从头重写。
4. **可选 Visual QA 闭环**（anthropics/skills/pptx Subagent + 11-item checklist + daymade/ppt-creator 10-dim rubric）：渲染后双轨评分 + 失败页打标 needsRegenerate，调用方决定是否触发再生。

## 用法

### Mock mode (默认 — 不消耗 API token)

```bash
# 默认: visual brief 路线，输出 /tmp/intelliflow-ppt-mvp-wireless-ai-v1.pptx
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts

# Ingested template 路线，输出 /tmp/intelliflow-ppt-mvp-wireless-ai-blue-business.pptx
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --ingested /tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/template.json
```

Mock mode 用 `/tmp/ppt-research/landppt-experiment*` 下的实验 HTML 作为 canned LLM response，让流水线零 token 端到端跑。
当前为了保持零 token 回归稳定，mock 路径仍使用原始 4 页基线；live 路径使用扩展版 6 页 plan + asset plan。

### Live mode (真调 Claude)

```bash
CLAUDE_MOCK=0 \
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts
```

若当前仓库根目录可读取 `.env` 中的 `DATABASE_URL`，脚本会自动从数据库里选择一个
可用的 `claude_agent_sdk` cloud 模型，并把对应的火山 `baseUrl/apiKey/modelId`
注入到 live 调用中，无需再手工导出 `ANTHROPIC_*` 环境变量。

如需指定库里的某个模型：

```bash
CLAUDE_MOCK=0 \
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --model-id doubao-seed-2.0-pro
```

如果你希望覆盖数据库配置，也仍然可以显式传入环境变量；显式环境变量优先。

## 输出

- `<sessionDir>/00-template-genes.json` — Layer 0 产出
- `<sessionDir>/01-style-genes.json` — Layer 1 产出
- `<sessionDir>/01b-spec-lock.json` — **★ Layer 1.5 SpecLock**（机器契约，确定性派生）
- `<sessionDir>/02-global-constitution.json` — Layer 2 产出
- `<sessionDir>/03-page-briefs.json` — Layer 3 产出（per page，含 visualElement + layoutArchetype）
- `<sessionDir>/04-design-system.css` — 由 TemplateGenes 自动生成
- `<sessionDir>/pages/<pageId>.html` — Layer 4 产出（per page）
- `<sessionDir>/pages/<pageId>.png` — Chrome 渲染
- `<sessionDir>/05-visual-qa.json` — **★ 可选 Visual QA 双轨报告**（仅当 `opts.visualQa` 启用）
- `<sessionDir>/pipeline.log.txt` — 调用时间 + 模式 + fallback 计数
- `<output>.pptx` — 最终交付

`PipelineArtifacts` 同时暴露：
- `specLock: SpecLock` — 程序化访问机器契约（颜色 / 字体 / 图标 / 图像锁三维）
- `placeholderFallbackCount: number` — fallback 触发次数（应当 0；>0 触发警告日志）

当提供 `assetPlanPath` 时，Layer 3 / 4 prompt 会拿到每页素材清单，且 Layer 4 会校验必需素材是否在 HTML 中真正被引用；缺失则触发 retry。

### Layer 1.5 SpecLock — 机器契约（防漂移）

`SpecLock` 是 Iteration 2 引入的中间层（hugohe3/ppt-master + arcsin1/oh-my-ppt 合并设计）：

```typescript
type SpecLock = {
  palette: {
    primary / secondary / accents / neutrals / bg / surface / text / textMuted: string;
    allValues: string[];   // ★ deduplicated union — drift detector compares against this
  };
  typography: {
    titleStack / bodyStack / monoStack: string;  // 必以 Windows 预装字体收尾
    titleSize / sectionSize / bodySize / captionSize: number;
    allFamilies: string[];
  };
  iconLibrary: "tabler-outline" | "tabler-filled" | "chunk-filled" | "phosphor-duotone";
  iconStrokeWidth: 1.5 | 2 | 3;
  imageLock: {
    rendering: "vector-illustration" | "editorial-photography" | "3d-isometric" | ...;
    palette: { dominantUsage, supportingUsage, accentUsage };  // 60/30/10 默认
    types: { [slotId]: ImageType };
  };
  constraints: {
    maxBulletsPerSlide / maxWordsHeadline / minVisualRatio /
    contrastMinRatio / colorEconomyMax / layoutVarianceWindow / maxNestingDepth;
  };
};
```

`VisualBrief` 现支持可选字段 `imageRendering / imagePalette / imageTypes / iconLibrary / iconStrokeWidth` 覆盖 spec_lock 默认值。完整 schema 见 `ai-agent-ppt-research/06-final/references/spec-lock-schema.md`。

Layer 4 prompt 顶置 `renderSpecLockAnchor(specLock)` 块，**每页生成前都强制 RE-ANCHOR**。

### Layer 3 — Variance Mandate

`buildLayer3Prompt(page, ..., previousArchetype?)` 在生成第 N 页（N>1）时把上一页的 `layoutArchetype` 注入 prompt：

```
## Variance constraint (H8)
Previous slide used layoutArchetype="centered-hero". You MUST pick a DIFFERENT archetype.
```

防止连续两页使用同一版式 — 这是跨页"识破感"的主因（anthropics/skills/pptx 反模式 #14）。

### Layer 4 — 结构化 retry（PPTAgent REPL pattern）

校验失败时不再用"previous attempt failed validation"通用消息，而是把 `ValidationError[]` 渲染成针对性修复指引：

```
## Previous attempt failed validation

Fix THESE specific issues — do not rewrite working sections from scratch:

  - [missing_visual_element] [expected: chart, got: undefined] — This page must
    contain a chart (bar / line / pie) rendered via SVG or canvas. Add it.
  - [missing_asset] (slot: hero_bg) [expected: file:///tmp/wireless/hero.png, got: undefined]
    — Use the EXACT fileUrl for slot "hero_bg" via <img src> or CSS background-image.

After fixing, re-validate against the same checks before emitting.
```

`ValidationErrorCode` 枚举：
- `empty_html` / `size_too_small` / `missing_body` / `missing_slide_class` / `hidden_content`
- `missing_content` / `missing_asset` / `missing_visual_asset_markup`
- `missing_visual_element` / `color_drift` / `font_drift`

### 可选 Visual QA 双轨闭环

```typescript
await buildFromPagePlan({
  // ... 其他配置 ...
  visualQa: true,                                  // 默认配置：threshold=75, both tracks
  // or
  visualQa: { threshold: 80, detectorOnly: true }, // 跳过 LLM 子 agent，只跑确定性 detector
});
```

返回 `result.visualQa: QaResult`：
- `subagent`：10 维 × 10 分 scores + total + passed + weakestDimensions + violations[]
- `detector`：colorDrift / fontDrift / bannedFeatures / placeholderResidue
- `needsRegenerate: string[]` — 失败页 pageId 列表
- `passed: boolean` — 整体通过门控

**当前不会自动触发再生**（避免无限循环），调用方根据 `needsRegenerate` 决定下一步。后续 Iteration 3 可加 `regenerationStrategy: "auto" | "manual"` 选项。

### Placeholder Fallback 可观测性

Layer 4 retry 失败时仍 fall back 到占位 HTML（保证 deck 完整可交付），但：
- 控制台日志显示 `❌ CRITICAL retry also failed (...); emitting placeholder (anti-pattern)`
- 汇总日志 `⚠️  N of M pages fell back to placeholder. Investigate retry-error patterns in pipeline.log.txt.`
- `RenderedPage.fallback: boolean` 字段标识
- `PipelineArtifacts.placeholderFallbackCount` 暴露给调用方

**生产监控建议**：任何 `placeholderFallbackCount > 0` 视为 P1 告警，并保留 `<sessionDir>/` 用于人工 RCA。

## 通用 API：用任何主题的 page-plan 驱动流水线

`build-wireless-ai-mvp.ts` 是 wireless 场景的薄 wrapper。底层通用驱动器是
`buildFromPagePlan(opts)`，可被任何主题的脚本调用：

```typescript
import { buildFromPagePlan } from "./ai-pipeline/build-from-page-plan";

await buildFromPagePlan({
  outlinePath: "./my-deck/outline.json",      // PresentationOutline
  briefPath:   "./my-deck/visual-brief.json", // VisualBrief (可省略，若提供 layer0Source)
  planPath:    "./my-deck/page-plan.json",    // PagePlan
  assetPlanPath: "./my-deck/asset-plan.json", // AssetPlan (可省略)
  outputPptx:  "./out/my-deck.pptx",

  // 可选：直接用 ingested template 替代 brief
  layer0Source: { kind: "ingested_template", templateJsonPath: "..." },

  // 可选：测试用 mock provider（生产环境留空走 live API）
  mockProvider: undefined,
  forceMock:    false,

  sessionTag:   "my-deck",
});
```

返回值 `{ pptxPath, sessionDir, artifacts }`，供调用方持久化或后续二次加工。

新主题只需准备 3 个 JSON（同当前 wireless 输入结构），无需碰核心代码。

## 与 ingestion POC 的接口

`build-wireless-ai-mvp.ts` 支持三种 Layer 0 入口：

### 1. 单文件 ingestion → `--ingested <path>`

```bash
bun packages/backend/src/scripts/ppt-mvp/ingest-template.ts ~/Downloads/some-template.pptx
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --ingested /tmp/ppt-research/ingest-out/<slug>/template.json
```

### 2. 批量 ingestion + preset 选择 (Mode B 完整闭环)

```bash
# Step 1: 批量摄取一个目录的模板，自动建索引
bun packages/backend/src/scripts/ppt-mvp/batch-ingest-templates.ts ~/Downloads/templates
# → /tmp/ppt-research/ingest-out/presets-index.json

# Step 2: 按 preset id 选风格生成 PPT
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --preset 622eee2ab7e6e_5f5b65
```

`presets-index.json` 是 Mode B 的索引文件 (供前端列出供用户挑选)，每条 preset 含：
- `presetId` (用作 `--preset` 参数)
- `summary` (一句话风格描述)
- `palette.primary / secondary / accents`
- `fonts.title_ea / body_ea`
- `pageCount`, `hasCharts`
- `templateJson` (传给 Layer 0 的实际路径)

### 3. 默认 brief 路线 (Layer 0 用 visual-brief.json)

```bash
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts
```

## 已知限制 (Iteration 1)

- **Image-backed only**: 输出 PPTX 是单图嵌入模式，PowerPoint 里不可对象级编辑。Native editable 路线在 Iteration 2 范围。
- ~~**固定 wireless 内容**: build script 是 `build-wireless-ai-mvp.ts`，硬编码 wireless 输入。~~ **已抽出 `build-from-page-plan.ts` 通用驱动器**（见上方"通用 API"段）。
- **无预制图表库**: 复杂数据可视化页（如 timeline）依赖 AI 一次出对，无 ppt-master 风格的 SVG 兜底。
- **HTML 校验偏宽**: 当前只检查 `<body>`、`.slide` 类、最小尺寸。可加入更严的样式校验。
- **Live mode 未实测**: 全部用 mock 验证。Live 跑通需要业务侧提供 ARK API key。

## 下一步 (Iteration 2 候选)

| 优先级 | 任务 |
|---|---|
| ~~P0~~ | ~~真实 live mode 验证~~ ✅ 已通过数据库 provider 自动取配置跑通 |
| ~~P0~~ | ~~抽出通用 `build-from-page-plan.ts`，不绑定 wireless 内容~~ ✅ 已完成 |
| ~~P0~~ | ~~素材计划接入 Layer 3/4 + 资产缺失校验~~ ✅ 已完成 |
| ~~P0~~ | ~~扩展到 6 页 family 验证集~~ ✅ 已完成 |
| P1 | Native editable PPTX 路径 (pptxgenjs 的 addText/addShape 直出，跳过截图) |
| P1 | 引入 ppt-master 预制图表 SVG 库 (50+ 图表/图示模板) |
| P1 | 第二轮 family 提纯：重点收紧 toc / comparison / timeline / process / device_overview 的版式约束 |
| P2 | HTML 校验加严：visual hierarchy / 颜色越界 / 字体越界 |
| P2 | 接进 backend `runtime/export.service.ts` 主链路 |
