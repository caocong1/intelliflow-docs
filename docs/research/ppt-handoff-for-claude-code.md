# PPT Handoff For Claude Code

日期：2026-04-17  
仓库：`/Users/dongli/Workspace/intelliflow-docs`

这份文档用于让新的 Claude Code session 直接接手当前 IntelliFlow PPT 方向工作。  
它总结了：

- 已经做过什么
- 哪些路线被验证失败
- 当前代码和研究产物在哪里
- 当前 MVP 到了什么阶段
- 后续最值得重构/推进的方向是什么

---

## 1. 一句话结论

当前已经明确：

**`free-scene-first` 不是正式主路线。**

正确方向应当是：

`LLM 结构化 -> PageFamily / Variant / SlotSchema -> CanvasRenderModel / Deck JSON -> PPTX 双路导出`

并且：

- `notes / speaker notes` 必须是一等产物
- `.pptx` 不是事实来源，`Deck JSON / CanvasRenderModel` 才应该是事实来源
- 当前 4 页 MVP 已经从“单页函数拼 PPT”演进到“family/variant/canvas/export plan”的早期骨架
- 但视觉质量仍未达到豆包/Kimi 成品水准，尤其目录页与整体 family 完整度仍偏弱

---

## 2. 先看这些文档

Claude Code 接手时，建议优先阅读顺序：

1. [docs/research/ppt-handoff-for-claude-code.md](./ppt-handoff-for-claude-code.md)
2. [docs/research/intelliflow-ppt-optimal-architecture.md](./intelliflow-ppt-optimal-architecture.md)
3. [docs/research/deep-report-synthesis.md](./deep-report-synthesis.md)
4. [docs/design/ppt-mvp/family-design-contract.md](../design/ppt-mvp/family-design-contract.md)
5. [docs/design/staged-ai-ppt-protocol.md](../design/staged-ai-ppt-protocol.md)
6. [docs/design/ppt-mvp/README.md](../design/ppt-mvp/README.md)

辅助研究文档：

- [docs/research/oss-ai-ppt-landscape.md](./oss-ai-ppt-landscape.md)
- [docs/research/oss-ai-ppt-comparison-matrix.md](./oss-ai-ppt-comparison-matrix.md)
- [docs/research/oss-ai-ppt-source-map.md](./oss-ai-ppt-source-map.md)
- [docs/research/README.md](./README.md)

---

## 3. 本轮已经做过的事情

## 3.1 失败路线：`ppt_scene / free-scene-first`

一开始做过一整轮 `ppt_scene/v1` 自由场景 JSON 的尝试，路径包括：

- 设计高自由度 JSON 协议
- 用本地 Gemini 生成多种单页与 family 场景
- 渲染成真实 `.pptx`

相关文件：

- [docs/design/ppt-scene-json-protocol.md](../design/ppt-scene-json-protocol.md)
- `docs/design/ppt-scene-*.json`
- `docs/design/ppt-scene-family-*.json`
- [packages/backend/src/modules/runtime/ppt-scene.ts](../../packages/backend/src/modules/runtime/ppt-scene.ts)
- [packages/backend/src/modules/runtime/ppt-scene.test.ts](../../packages/backend/src/modules/runtime/ppt-scene.test.ts)
- [packages/backend/src/scripts/render-ppt-scene.ts](../../packages/backend/src/scripts/render-ppt-scene.ts)
- [packages/backend/src/scripts/audit-ppt-scene-assets.ts](../../packages/backend/src/scripts/audit-ppt-scene-assets.ts)

结论：

- 文件结构可以做通
- 中文字体/零尺寸 line/透明色等兼容问题也修了一部分
- 但页面观感非常差，属于“换皮+坐标漂移”范式
- 用户明确反馈这条路线方向不对

当前结论：

> `ppt_scene` 保留为实验资产，不再作为正式主链路。

---

## 3.2 研究阶段：Kimi / 豆包 / 开源项目深度研究

### Benchmark 样本

研究和对标时使用了这些文件：

- 豆包：
  - `/Users/dongli/Downloads/无线网络建设科普方案.pptx`
- Kimi：
  - `/Users/dongli/Downloads/无线网络建设科普方案 (1).pptx`
- GPT-5.4-pro 深度研究报告：
  - `/Users/dongli/Downloads/deep-research-report (2).md`

### 已研究的开源项目

- `Anionex/banana-slides`
- `SmartSchoolAI/ai-to-pptx`
- `hugohe3/ppt-master`
- `veasion/AiPPT`
- `sligter/LandPPT`
- `pipipi-pikachu/PPTist`

相关总结文档：

- [oss-ai-ppt-landscape.md](./oss-ai-ppt-landscape.md)
- [oss-ai-ppt-comparison-matrix.md](./oss-ai-ppt-comparison-matrix.md)
- [intelliflow-ppt-optimal-architecture.md](./intelliflow-ppt-optimal-architecture.md)
- [deep-report-synthesis.md](./deep-report-synthesis.md)
- [oss-ai-ppt-source-map.md](./oss-ai-ppt-source-map.md)

结论已经收敛成一句话：

> 最优路线不是抄一个项目，而是组合：
> `LandPPT` 的工作流骨架
> + `ai-to-pptx` 的强约束 variant
> + `AiPPT/PPTist` 的 JSON/canvas/editor model
> + `ppt-master` 的可编辑导出边界
> + `banana-slides` 的 AI-native 修改体验和高保真 fallback

---

## 3.3 当前正式实验主线：隔离的 4 页 MVP

目录：

- [docs/design/ppt-mvp/README.md](../design/ppt-mvp/README.md)
- [docs/design/ppt-mvp/family-design-contract.md](../design/ppt-mvp/family-design-contract.md)
- [docs/design/ppt-mvp/wireless-outline.json](../design/ppt-mvp/wireless-outline.json)
- [docs/design/ppt-mvp/wireless-visual-brief.json](../design/ppt-mvp/wireless-visual-brief.json)
- [docs/design/ppt-mvp/wireless-page-plan.json](../design/ppt-mvp/wireless-page-plan.json)
- [docs/design/ppt-mvp/wireless-asset-plan.json](../design/ppt-mvp/wireless-asset-plan.json)
- [docs/design/ppt-mvp/wireless-page-plan-ai.prompt.md](../design/ppt-mvp/wireless-page-plan-ai.prompt.md)
- `docs/design/ppt-mvp/assets/*.svg`

目的：

- 先不接主业务导出链路
- 先验证：
  - family/variant/slot schema
  - notes
  - Deck JSON
  - native editable / hybrid 基础设施

当前页型：

1. `cover_hero_image`
2. `toc_card_grid_8`
3. `comparison_dual_image`
4. `timeline_horizontal_5`

---

## 4. 关键代码入口

以下是当前 MVP 真正应该看的代码：

### 类型与协议

- [packages/backend/src/scripts/ppt-mvp/types.ts](../../packages/backend/src/scripts/ppt-mvp/types.ts)
  - `PresentationOutline`
  - `VisualBrief`
  - `PagePlan`
  - `PageFamilyDefinition`
  - `VariantDefinition`
  - `CanvasRenderModel`
  - `DeckExportPlan`

### Family / Variant

- [packages/backend/src/scripts/ppt-mvp/family-library.ts](../../packages/backend/src/scripts/ppt-mvp/family-library.ts)
  - 当前唯一 family：`doubao_light_tech_v1`
  - 4 个 variant 的注册表

- [packages/backend/src/scripts/ppt-mvp/family-primitives.ts](../../packages/backend/src/scripts/ppt-mvp/family-primitives.ts)
  - family 共享渲染原语
  - 背景、标题块、图片容器、卡片、文本

- [packages/backend/src/scripts/ppt-mvp/variant-library.ts](../../packages/backend/src/scripts/ppt-mvp/variant-library.ts)
  - 4 个 variant 的当前渲染实现
  - 当前仍偏“每页一个大分支”，这是未来应进一步重构的地方

### 内容裁剪 / 校验

- [packages/backend/src/scripts/ppt-mvp/content-fitting.ts](../../packages/backend/src/scripts/ppt-mvp/content-fitting.ts)
- [packages/backend/src/scripts/ppt-mvp/page-plan-schema.ts](../../packages/backend/src/scripts/ppt-mvp/page-plan-schema.ts)
- [packages/backend/src/scripts/ppt-mvp/validate-page-plan.ts](../../packages/backend/src/scripts/ppt-mvp/validate-page-plan.ts)

### Canvas / Deck JSON / Export Plan

- [packages/backend/src/scripts/ppt-mvp/canvas-model.ts](../../packages/backend/src/scripts/ppt-mvp/canvas-model.ts)
- [packages/backend/src/scripts/ppt-mvp/export-strategy.ts](../../packages/backend/src/scripts/ppt-mvp/export-strategy.ts)
- [packages/backend/src/scripts/ppt-mvp/deck-json.ts](../../packages/backend/src/scripts/ppt-mvp/deck-json.ts)

说明：

- 当前构建不会只生成 `.pptx`
- 还会生成 `.deck.json`
- `Deck JSON` 已被明确提升为事实来源之一

### 构建 / 预览 / 单页截图

- [packages/backend/src/scripts/ppt-mvp/build-wireless-mvp.ts](../../packages/backend/src/scripts/ppt-mvp/build-wireless-mvp.ts)
  - 生成 PPTX + Deck JSON

- [packages/backend/src/scripts/ppt-mvp/build-wireless-preview.ts](../../packages/backend/src/scripts/ppt-mvp/build-wireless-preview.ts)
  - 生成本地 HTML 预览

- [packages/backend/src/scripts/ppt-mvp/render-slide-image.ts](../../packages/backend/src/scripts/ppt-mvp/render-slide-image.ts)
  - 单页 HTML -> Chrome headless -> PNG
  - 这是为 hybrid 路线做的基础设施

### 质量与门槛

- [packages/backend/src/scripts/ppt-mvp/quality-metrics.ts](../../packages/backend/src/scripts/ppt-mvp/quality-metrics.ts)
- [packages/backend/src/scripts/ppt-mvp/quality-gates.ts](../../packages/backend/src/scripts/ppt-mvp/quality-gates.ts)

当前这些工具已经能告诉你：

- notes 覆盖率
- 页面文本密度
- 页面资产数量
- 当前 variant 是否超预算

### 资源解析

- [packages/backend/src/scripts/ppt-mvp/assets.ts](../../packages/backend/src/scripts/ppt-mvp/assets.ts)
  - 当前支持：
    - 本地文件
    - benchmark PPTX 内嵌资源抽取

---

## 5. 当前已经达成的阶段性成果

### 5.1 `free-scene-first` 被正式降级

不再作为主路线。

### 5.2 `speaker notes` 已正式接入

当前 MVP 所有页：
- 都会带 notes
- `.pptx` 里 notesSlides 已实写

### 5.3 `Deck JSON` 已正式接入

构建时现在会同时产出：

- `xxx.pptx`
- `xxx.deck.json`

### 5.4 `CanvasRenderModel` 已成真实代码结构

不是只有文档里的名词。

### 5.5 `hybrid` 基础设施已经打通

虽然当前 `v17` 已回到全 editable 主路，但以下基础设施已可用：

- 单页 HTML 预览
- headless Chrome 截图
- `hybrid_candidate` -> `hybrid` export strategy

曾经跑通过：

- 第 3 页 hybrid PNG
- 第 4 页 hybrid PNG

这说明将来对复杂页启用 hybrid 已经不是空谈。

### 5.6 第 4 页“上图和下卡不对齐”的根问题已被修掉

原来错误做法：
- 把豆包时间轴那张 4 节点主视觉硬贴到 5 节点结构里

后来的修复：
- 改成 5 个独立 SVG Wi‑Fi 图标
- 5 个独立圆锚点
- 5 张卡片
- 同一套 5 列栅格

当前第 4 页已经重新走 `native_editable`，不是整页图片。

### 5.7 质量门槛工具已跑通

例如：
- `notesCoverage`
- `avgSlotTextCharsPerSlide`
- `quality gates passed/failed`

---

## 6. 当前产物路径

### 最新 PPT / Deck JSON

当前最新版本：

- [v17 PPTX](/private/tmp/intelliflow-ppt-mvp-wireless-v17.pptx)
- [v17 Deck JSON](/private/tmp/intelliflow-ppt-mvp-wireless-v17.deck.json)

更早的阶段版本（如需回看）：

- [v15 PPTX](/private/tmp/intelliflow-ppt-mvp-wireless-v15.pptx)
- [v16 PPTX](/private/tmp/intelliflow-ppt-mvp-wireless-v16.pptx)

注意：
- `/tmp` 和 `/private/tmp` 在当前环境下都能看到
- 但 handoff 时建议优先引用 `/private/tmp/...`

### 中间预览与 hybrid 产物

例如：
- `/tmp/ppt-mvp-p3-hybrid.png`
- `/tmp/ppt-mvp-p4-hybrid.png`
- `/tmp/intelliflow-ppt-mvp-wireless-preview-v3.html`

这些是可再生成的临时产物，不是长期文档资产。

---

## 7. 当前最关键的判断

### 已确认正确的方向

1. `PageFamily / Variant / SlotSchema`
2. `CanvasRenderModel`
3. `Deck JSON` 作为事实来源
4. `Notes-first`
5. `Dual export` 作为必要能力边界，而不是默认主路径

### 已确认错误的方向

1. `AI -> 自由坐标 scene -> 直接导出`
2. 一页一页抄豆包的视觉位置
3. 把整页图片 fallback 当成默认主路
4. 把 `.pptx` 本身当成主编辑语义

---

## 8. 当前还没解决的问题

### 8.1 family 仍然不够“厚”

虽然已经有 family primitives，但仍然偏薄：

- 目录页还是偏卡片列表
- 对比页虽然层级收了一轮，但 still 比 benchmark 更机械
- cover 还行，toc 和 comparison 仍然弱

### 8.2 当前 MVP 页数太少

只有 4 页，判断力不足。  
真正该验证的 family 至少要扩到：

- `process`
- `device_overview`
- `principles` / `faq`

形成 6-8 页测试 deck 才有意义。

### 8.3 `variant-library.ts` 仍偏大分支实现

虽然已经引入 `family-primitives`，但渲染层仍然是：

- 一个文件
- 4 个大 case

还没完全进化成：

- family block
- variant layout recipe
- shared slot renderer

### 8.4 hybrid 策略还只是早期基础设施

已经能跑：
- 单页 HTML
- 单页 PNG
- exportPlan 分流

但还没有真正做到：
- 自动按复杂度判断页级 hybrid
- native/hybrid 混排时的质量最优化

### 8.5 benchmark 不是根本答案

当前工作仍然带有“向豆包/Kimi 靠”的倾向。  
用户已经明确指出：

> 现在目的容易变成一直往豆包样式里套，这个方向本身就有问题。

这意味着下一轮 Claude Code 分析时，不应该再把目标设成：

- “更像豆包”

而应设成：

- “提炼我们自己的产品级 family system”

---

## 9. 建议 Claude Code 下一步怎么做

以下是最推荐的重构顺序。

### Phase 1：先重构系统，不先磨样式

目标：
- 把当前 MVP 变成真正的 family-driven 系统，而不是 4 个特例页面

建议：

1. 继续拆 `variant-library.ts`
   - family background
   - family title block
   - family card system
   - family image container
   - summary bar / insight bar
   - per-variant layout recipe

2. 保留 `Deck JSON` 为正式事实来源
   - 不要把它降成附属产物

3. 保留 `quality gates`
   - 后续扩页必须靠门槛检查，不只靠主观感觉

### Phase 2：扩到 6-8 页，再判断 family 成败

当前 4 页不足以判断。

建议新增：

- `process`
- `device_overview`
- `principles` 或 `faq`

目标：
- 验证这套 family 对更多内容结构是否仍成立

### Phase 3：hybrid 只作为复杂页的工具，不抢主路

建议：

- 当前 `comparison` 和 `timeline` 都先保持 `native_editable`
- 只保留 hybrid 作为复杂视觉页的后备能力
- 不要再默认把整页转图

### Phase 4：如果继续研究架构

可继续回看这些文档：

- [intelliflow-ppt-optimal-architecture.md](./intelliflow-ppt-optimal-architecture.md)
- [deep-report-synthesis.md](./deep-report-synthesis.md)
- [oss-ai-ppt-source-map.md](./oss-ai-ppt-source-map.md)

---

## 10. 当前工作区注意事项

当前 `git status` 里有一些**与本轮 PPT 方向无关的脏改动**，不要在重构时误覆盖：

已修改但非本轮重点：

- `packages/backend/src/modules/runtime/background.service.ts`
- `packages/backend/src/modules/runtime/export.service.ts`
- `packages/backend/src/modules/runtime/model-call-output.ts`
- `packages/backend/src/modules/runtime/model-call-output.test.ts`

这些文件中：

- `export.service.ts` 之前有接 `ppt-scene` 的变更
- `model-call-output*` 与背景服务不是本轮重点

如果 Claude Code 只接手 PPT family/variant/canvas 重构，建议：

- 尽量不要碰这几个非核心文件
- 优先只在：
  - `docs/design/ppt-mvp/*`
  - `docs/research/*`
  - `packages/backend/src/scripts/ppt-mvp/*`
  - `packages/backend/src/modules/runtime/ppt-scene*`
  范围内行动

---

## 11. 最终判断

当前项目已经走过三步：

1. `free-scene` 实验
2. benchmark / 开源项目研究
3. 4 页 family MVP 骨架搭建

现在最值得做的，不是再输出更多版本号的 PPT，而是：

> **把当前 family/variant/canvas/deck-json 这套骨架重构成真正可扩展的系统，然后用 6-8 页 family test deck 去验证它。**

如果 Claude Code 要整体重构分析，这就是最合适的切入点。

