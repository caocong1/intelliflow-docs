# PPT MVP

## Goal

隔离验证一条接近 Kimi / 豆包的正式主路线：

- 固定 variant
- 固定内容
- 固定素材
- 稳定 `.pptx` 编译

本 MVP 不接现有 runtime/export 正式链路。

## Fixed Benchmark Files

- `/Users/dongli/Downloads/无线网络建设科普方案.pptx`（豆包）
- `/Users/dongli/Downloads/无线网络建设科普方案 (1).pptx`（Kimi）

## Included Pages

1. `cover_hero_image`
2. `toc_card_grid_8`
3. `comparison_dual_image`
4. `timeline_horizontal_5`

## Expanded AI Validation Set

AI pipeline 当前的扩展版 live 验证集为 6 页：

1. `cover_hero_image`
2. `toc_card_grid_8`
3. `comparison_dual_image`
4. `timeline_horizontal_5`
5. `process_flow_5`
6. `device_triptych_3`

相关文件：

- `docs/design/ppt-mvp/wireless-page-plan-expanded.json`
- `docs/design/ppt-mvp/wireless-asset-plan-expanded.json`
- `docs/design/ppt-mvp/next-phase-roadmap.md`
- `docs/design/ppt-mvp/native-template-contract.md`
- `docs/design/ppt-mvp/templates/doubao-light-tech-v1.native-template.json`

## Build

```bash
bun packages/backend/src/scripts/ppt-mvp/build-wireless-mvp.ts
```

输出：

- `/tmp/intelliflow-ppt-mvp-wireless-v1.pptx`

扩展版 6 页 native-editable baseline：

```bash
bun packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts \
  /tmp/intelliflow-ppt-mvp-wireless-v2r.pptx
```

输出：

- `/tmp/intelliflow-ppt-mvp-wireless-v2r.pptx`
- `/tmp/intelliflow-ppt-mvp-wireless-v2r.deck.json`

模板驱动 native build：

```bash
bun packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts \
  /tmp/intelliflow-ppt-mvp-wireless-v2w-bluebiz.pptx \
  --template /tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/native-template.json
```

输出：

- `/tmp/intelliflow-ppt-mvp-wireless-v2w-bluebiz.pptx`
- `/tmp/intelliflow-ppt-mvp-wireless-v2w-bluebiz.deck.json`

通用 native builder：

```ts
import { buildNativeFromPagePlan } from "packages/backend/src/scripts/ppt-mvp/build-native-from-page-plan";
```

当前 `build-wireless-mvp-expanded.ts` 已经只是对无线 6 页样本的 thin wrapper。

单页原生调试：

```bash
# 只生成目录页
bun packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts \
  /tmp/intelliflow-ppt-mvp-native-p2.pptx \
  --pages p2

# 只生成设备页
bun packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts \
  /tmp/intelliflow-ppt-mvp-native-p6c.pptx \
  --pages p6

# 只生成对比页
bun packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts \
  /tmp/intelliflow-ppt-mvp-native-p3g.pptx \
  --pages p3

# 直接输出单页原生预览 PNG
bun packages/backend/src/scripts/ppt-mvp/render-native-page-preview.ts \
  p2 \
  /tmp/intelliflow-ppt-mvp-native-p2-tool.png

# 使用指定 native template 预览单页
bun packages/backend/src/scripts/ppt-mvp/render-native-page-preview.ts \
  p2 \
  /tmp/intelliflow-ppt-mvp-native-p2-bluebiz.png \
  --template /tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/native-template.json
```

当前模板驱动能力：

- 模板可影响：
  - `familyId / familyName`
  - colors / fonts
  - primitive 默认 radius / stroke / shadow
  - builder 的 required asset 校验
  - 部分可选结构是否渲染（例如 `info_rail_right`）
  - `cover / toc / timeline` 的 recipe 分支
- 模板真实布局已开始进入 renderer（**已冻结，见下**）：
  - `cover` 直接复用原模板封面背景图与标题/标签位置
  - `toc` 直接复用原模板目录页背景与条目节奏
  - `comparison` 已切到原模板双图 + 底部说明区节奏
  - `process` 已切到原模板四列流程节奏，尾步下沉到 footer strip
- 当前还未完成：
  - primitive 级几何完全模板化
  - `device_overview` 仍未切到真实模板布局

> **Freeze notice (2026-04-19)** — 上面的“模板真实布局进入 renderer”一支已被 preserve mode 取代，详见 [ppt-three.md](../ppt-three.md)。`layout-preset render` 路径默认 **关闭**，仅在 `USE_LAYOUT_PRESET_RENDER=1` 时生效。不再为模板保真目标扩展 variant-library 的 `renderExtractedTemplate*` 分支——模板保真走 [preserve mode](#preserve-mode-template-fidelity)。

## Preserve Mode (template fidelity)

模板保真线第一版已落成，跑通了 `622eee2ab7e6e.pptx` 封面页的原地替换：

```bash
# 首次运行会自动把 /tmp/ppt-research/batch-input/622eee2ab7e6e.pptx
# 复制到 packages/backend/test-fixtures/ppt-mvp/ 下
bun packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts \
  /tmp/intelliflow-ppt-mvp-wireless-preserve-v1.pptx
```

产物：

- 原模板 25 页结构保留，sldIdLst 只指向 slide26（替换后的封面）
- 替换的 5 个文本槽位：`eyebrow / title / body / pill_1 / pill_2`
- 保留：`hero_bg / brand_icon / decoration_pill_group`

合约位置：

- Slot map：[docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide1.slot-map.json](slot-maps/622eee2ab7e6e/slide1.slot-map.json)（`template_slot_map/v1`，含 `maxWidthUnits` / `maxLines` 硬约束）
- Fill plan：[docs/design/ppt-mvp/templates/wireless-template-fill-plan.json](templates/wireless-template-fill-plan.json)（`template_fill_plan/v1`）
- Builder：[packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.ts](../../../packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.ts)
- 宽度/行数校验：[text-width.ts](../../../packages/backend/src/scripts/ppt-mvp/preserve/text-width.ts)（CJK=2 / ASCII=1 单位制）
- 超限自愈改写：[rewrite-with-llm.ts](../../../packages/backend/src/scripts/ppt-mvp/preserve/rewrite-with-llm.ts)（复用 `ai-pipeline/claude-client`，`--strict` 可跳过）

槽位内容如果超出 `maxWidthUnits * maxLines` 容量，builder 会自动调用 LLM 压缩内容（最多 2 次 retry）。**暂不做字号缩放**，Phase 2 会加 `minFontPt` 字段作为兜底。

验证：

```bash
# 测试套件（8 tests）
bunx vitest run packages/backend/src/scripts/ppt-mvp/preserve/ --config packages/backend/vitest.config.ts

# 手工 relationship 审查
bun packages/backend/src/scripts/ppt-mvp/preserve/verify-pptx-relationships.ts /tmp/intelliflow-ppt-mvp-wireless-preserve-v1.pptx
```

Session 2+ 继续扩 p2/p3/p4/p5/p6 slot-maps 与 image-slot 支持，详见 [ppt-three.md](../ppt-three.md)。

AI pipeline live 验证：

```bash
CLAUDE_MOCK=0 \
bun --env-file=.env packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --model-id doubao-seed-2.0-pro \
  /tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v4.pptx
```

native template 校验：

```bash
bun packages/backend/src/scripts/ppt-mvp/validate-native-template.ts \
  docs/design/ppt-mvp/templates/doubao-light-tech-v1.native-template.json
```

ingested template -> native template 转换：

```bash
bun packages/backend/src/scripts/ppt-mvp/convert-ingested-template-to-native.ts \
  /tmp/ppt-research/ingest-out/doubao-wireless_1384bb/template.json \
  --out /tmp/ppt-research/ingest-out/doubao-wireless_1384bb/native-template.json
```

## HTML Fidelity (editable pptx via HTML templates)

HTML-fidelity 线独立于 preserve 模式之外，产出**可编辑** .pptx（每个
`data-region` 成为真实 PowerPoint 文本框，装饰几何烘焙成单张背景 PNG
垫底）。当前覆盖 6 种页型。

文件布局：

- `docs/design/ppt-mvp/html-styles/622eee2ab7e6e/` — 模板家族
  - `cover.html` / `toc.html` / `comparison.html` / `timeline.html` / `process.html` / `device.html`
  - `outline-to-deck.prompt.md` — 大纲 → `html_fidelity_deck/v1` JSON 的 model_call 指令
- `packages/backend/src/scripts/ppt-mvp/preserve/html-roundtrip.ts` — LLM fill-plan roundtrip（带预算迭代重试）
- `packages/backend/src/scripts/ppt-mvp/preserve/html-to-editable-pptx.ts` — HTML + fill-plan → editable .pptx
- `packages/backend/src/modules/runtime/html-editable-adapter.ts` — 多页 deck buffer 产出器 + runtime dispatch 入口

产品侧完整 chain（给下一步 UI 接入时参考）：

```
upstream model_call (system: outline-to-deck.prompt.md)
  → 输出 html_fidelity_deck/v1 JSON 字符串
export node (format: pptx)
  → generatePptBuffer → parseHtmlFidelityDeckContent 识别版本签名
  → renderHtmlFidelityDeckToBuffer 逐页 fill-plan + bg render + editable text overlay
  → 返回可编辑 .pptx buffer
```

单页脚本线（开发/调试用）：

```bash
# fill plan + bg PNG + 可编辑单页 .pptx
bun packages/backend/src/scripts/ppt-mvp/preserve/html-to-editable-pptx.ts \
  --html docs/design/ppt-mvp/html-styles/622eee2ab7e6e/cover.html \
  --content docs/design/ppt-mvp/wireless-page-plan.json \
  --page p1 \
  --out /tmp/cover.pptx

# 用已有 fill plan 跳过 LLM（加速迭代）
bun packages/backend/src/scripts/ppt-mvp/preserve/html-to-editable-pptx.ts \
  --html ... --page p1 --out ... \
  --fill-plan /tmp/intelliflow-html-roundtrip/cover-live-v3.fillplan.json
```

Outline-to-deck prompt 的 live smoke：

```bash
bun --env-file=.env /tmp/outline-to-deck-smoke.ts   # see smoke fixture
```

验证：

- `packages/backend/src/scripts/ppt-mvp/preserve/html-roundtrip.test.ts` — roundtrip 6 tests
- `packages/backend/src/modules/runtime/html-editable-adapter.test.ts` — adapter 8 tests（含 3-slide + 6-slide 集成）

## Verification

- PowerPoint 打开不得弹修复
- 页面不空白
- 文字不重叠
- 图片不丢失
- `.pptx` 可通过 `unzip -t`

native-editable 扩展版额外要求：

- `.deck.json` 可通过 `quality-gates.ts`
- 6 页结构完整：
  - `cover`
  - `toc`
  - `comparison`
  - `timeline`
  - `process`
- `device_overview`
- 不再出现 `pptxgenjs addImage path should be a string` 警告
- timeline SVG 图标不再缩在左上角
