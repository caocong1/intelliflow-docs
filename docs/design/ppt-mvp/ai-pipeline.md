# AI Pipeline (Phase A Iteration 1)

**Position**: 范式 4 路线 (LandPPT 4 层 AI 流水线 + ppt-master 预制元件库的混合架构) 的第一版生产实现。
**Code**:
- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/` (核心模块)
- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/build-from-page-plan.ts` (内容无关的通用驱动器)
- `packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts` (薄 wrapper：wireless 场景 + mock provider)
- `docs/design/ppt-mvp/wireless-page-plan-expanded.json` (6 页 live 验证集)
- `docs/design/ppt-mvp/wireless-asset-plan-expanded.json` (6 页素材计划)

**研究背景**: `docs/research/template-generation-paradigms.md` §4 / §7.5 / §8.5 / §8.6 / §8.7

## 流水线层

```
Layer 0  →  TemplateGenes        (project-level design intent，from brief OR ingested template)
            ↓ deterministic CSS generator (no AI)
            04-design-system.css
Layer 1  →  StyleGenes           (verbal design DNA)
Layer 2  →  GlobalConstitution   (deck-wide rules)
Layer 3  →  PageBrief[]          (per-page direction without locking layout)
Layer 4  →  RenderedPage[]       (per-page HTML with validation + retry + fallback)
            ↓ headless Chrome
            page.png (1920×1080)
            ↓ pptxgenjs image-backed
            <output>.pptx (含 speaker notes)
```

**关键设计决策**：CSS 由代码生成（确定性），不让 AI 写 CSS（避开 LLM 一致性失败模式）。AI 只负责 design tokens 和 per-page HTML 的语义结构。

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
- `<sessionDir>/02-global-constitution.json` — Layer 2 产出
- `<sessionDir>/03-page-briefs.json` — Layer 3 产出（per page）
- `<sessionDir>/04-design-system.css` — 由 TemplateGenes 自动生成
- `<sessionDir>/pages/<pageId>.html` — Layer 4 产出（per page）
- `<sessionDir>/pages/<pageId>.png` — Chrome 渲染
- `<sessionDir>/pipeline.log.txt` — 调用时间 + 模式
- `<output>.pptx` — 最终交付

当提供 `assetPlanPath` 时，Layer 3 / 4 prompt 会拿到每页素材清单，且 Layer 4 会校验必需素材是否在 HTML 中真正被引用；缺失则触发 retry。

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
