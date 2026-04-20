# PPT MVP Next-Phase Roadmap

## 1. 目标重述

下一阶段不再只是继续打磨当前无线网络 6 页样本，而是同时推进两条正式主线：

1. `AI -> native` 生成路线  
   目标是让 AI 在明确 family / template 约束下，直接生成可被 native renderer 消费的页面计划与版式结果。

2. `PPT 模板导入 -> native template` 转换路线  
   目标是把现有 `.pptx` 模板先 ingest 成结构化描述，再进一步转换成 native renderer 能直接消费的模板格式，而不是只把它当 Layer 0 的视觉参考。

核心原则：

- 不把整页截图当正式路线
- 不把当前无线样本当唯一目标
- 不直接把 `ingest-template.ts` 的原始输出拿来驱动 native renderer
- 先建立统一中间层，再接 AI 与 runtime

## 2. 统一概念分层

当前代码里其实已经隐含了三层概念，但还没有正式拆清：

1. `raw template descriptor`
   - 来源：`ingest-template.ts`
   - 当前产物：`template.json`
   - 用途：保留原始 PPT 模板的 palette / font / layout / asset 摘要
   - 问题：它更像“研究摘要”，还不是 native renderer 可直接执行的模板

2. `native template`
   - 这是下一阶段必须补出来的正式中间层
   - 用途：给 native builder / renderer 直接消费
   - 必须包含：
     - 颜色、字体、间距、圆角、描边、阴影等 token
     - title block / hero rail / card / image frame / footer bar 等 primitives
     - variant 到模板能力的绑定规则
     - 图片容器策略、chart style、icon style、note style

3. `page plan / content plan`
   - 来源：当前 `wireless-page-plan*.json` 和未来 AI 输出
   - 用途：描述每页讲什么，而不是模板长什么样

结论：

- `template.json` 不是最终模板
- 需要新增 `native-template.json`
- AI 和 native builder 后续都应该围绕 `native-template` 对齐

## 3. 下一阶段主线

### 3.1 主线 A：AI Native Generation

目标：

- 让 AI 不只是生成 image-backed HTML
- 而是逐步生成更贴近 native family 的结构化结果
- 最终把 AI 的作用收敛为：
  - 生成 `page plan`
  - 生成 family 受约束的 layout decisions
  - 生成可映射到 native renderer 的 slot/value 结果

这一条线下一步的重点不是接 runtime，而是：

1. 扩 family
   - 当前 6 页只是最小验证集
   - 下一批建议新增：
     - `brand_comparison`
     - `scenario_selection_matrix`
     - `faq_or_summary`

2. 收紧 AI 输出边界
   - AI 继续负责：
     - 内容组织
     - 结构选择
     - 视觉方向决策
   - AI 不直接负责：
     - 最终 PPT 绝对布局细节
     - 任意自由形状生成
     - 不受约束的模板发明

3. 把 AI 输入从“纯 brief”升级为“brief + native template”
   - 这样 AI 看到的不是抽象风格要求
   - 而是一个明确可落地的模板能力边界

### 3.2 主线 B：PPT Template Import -> Native Template

目标：

- 把外部 `.pptx` 模板导入后，转换成 native 系统可复用的模板资产
- 不让 `ingest-template.ts` 只停在“研究报告”层

这一条线建议分成两步：

1. `ingest`
   - 保留当前 `ingest-template.ts`
   - 继续输出：
     - `template.json`
     - `template.md`
     - `media/*`
   - 这一层负责“提取与观察”

2. `convert`
   - 新增 `convert-ingested-template-to-native.ts`
   - 输入：`template.json`
   - 输出：`native-template.json`
   - 这一层负责“归一化到 native renderer 可执行模板”

关键判断：

- `ingest` 是 reverse engineering
- `convert` 是 template normalization
- 这两层不能混在一起

## 4. 建议新增的核心产物

### 4.1 Schema / Contract

建议新增：

- `docs/design/ppt-mvp/native-template-contract.md`
- `native_template/v1` schema

`native_template/v1` 至少要覆盖：

- `templateId`
- `source`
  - `brief`
  - `ingested_template`
  - `hand_authored`
- `tokens`
  - colors
  - typography
  - spacing
  - radius
  - shadow
  - lines
- `primitives`
  - title_block
  - hero_panel
  - info_rail
  - card
  - image_frame
  - badge
  - timeline_node
  - process_step
  - footer_summary
- `variantBindings`
  - 每个 variant 能调用哪些 primitives
  - 哪些是 required
  - 哪些是 optional
- `assetRules`
  - cover 背景图
  - comparison 左右图
  - timeline 图标
  - device image frame

### 4.2 Conversion Scripts

建议新增：

- `packages/backend/src/scripts/ppt-mvp/convert-ingested-template-to-native.ts`
- `packages/backend/src/scripts/ppt-mvp/batch-convert-native-templates.ts`
- `packages/backend/src/scripts/ppt-mvp/validate-native-template.ts`

职责：

- `convert-ingested-template-to-native.ts`
  - 单个模板转换
- `batch-convert-native-templates.ts`
  - 对整个 ingest-out 批量转 native template
- `validate-native-template.ts`
  - 校验模板是否满足 native family 运行前提

### 4.3 Builder Integration

建议增强：

- `build-native-from-page-plan.ts`

新增能力：

- 支持传入 `nativeTemplatePath`
- 默认使用当前 hand-authored family
- 指定模板时，renderer 从 `native-template.json` 读取 token / primitive config

这一步完成后，native builder 才真正从“无线样本专用 family”进入“可切换模板的 native builder”。

## 5. 推荐执行顺序

### Phase 1：冻结当前 baseline，补统一合同层

目标：

- 不再继续无边界微调当前 6 页
- 先定义清楚 `raw template descriptor` 与 `native template` 的边界

交付：

- `next-phase-roadmap.md`
- `native-template-contract.md`
- `native_template/v1` 结构定义

完成标志：

- 团队内部对三层概念没有歧义：
  - ingest descriptor
  - native template
  - page plan

### Phase 2：打通模板转换 POC

目标：

- 从一个真实 `.pptx` 模板出发
- 跑通：
  - `ingest-template.ts`
  - `convert-ingested-template-to-native.ts`

交付：

- 至少 1 个 `native-template.json`
- 对应验证文档，明确哪些信息成功映射，哪些仍需人工兜底

完成标志：

- 能证明“导入 PPT 模板后，可落成 native 可用模板”，而不是只得到观察报告

### Phase 3：让 native builder 吃模板

目标：

- `build-native-from-page-plan.ts` 支持模板驱动
- 同一份 page plan，可以切不同 native template 出不同视觉风格

交付：

- `--template <native-template.json>` 或等价参数
- 至少 2 套模板驱动同一内容生成不同结果

完成标志：

- native 路线不再只依赖 hand-authored `doubao_light_tech_v1`

### Phase 4：AI 线接 native template

目标：

- AI 不再只依赖 `brief` 或 `ingested template` 摘要
- AI 输入里显式引入 `native template`

交付：

- AI pipeline 支持：
  - `brief -> native template`
  - `ingested template -> native template`
  - `native template + page plan -> native deck`

完成标志：

- AI 线与 native 线不再是两套松散并行的实验，而是共享模板层

### Phase 5：扩 family，不只做无线样本

目标：

- 新增至少 2 到 3 个页型
- 并在至少 2 套模板下验证

建议优先页型：

- `brand_comparison_matrix`
- `scenario_selection_matrix`
- `faq_summary`

完成标志：

- 证明系统支持：
  - 多模板
  - 多页型
  - 同一内容在不同模板下稳定产出

### Phase 6：最后再考虑 runtime/export 集成

前提：

- 模板层稳定
- native builder 可切模板
- AI/native 共用同一模板语义层

否则不建议过早接主链。

## 6. 接下来 2 到 3 次 session 的具体任务建议

### Session A

只做模板层合同，不扩 runtime：

1. 新建 `native-template-contract.md`
2. 定义 `native_template/v1`
3. 设计 ingest descriptor -> native template 的字段映射表

### Session B

只做模板转换 POC：

1. 新增 `convert-ingested-template-to-native.ts`
2. 选 1 个真实模板转换
3. 生成首个 `native-template.json`
4. 输出映射缺口清单

### Session C

只做 builder 接入：

1. `build-native-from-page-plan.ts` 支持模板输入
2. 同一份无线内容，用两套模板生成两份 native PPT
3. 跑 `quality-gates` 与人工预览

## 7. 当前明确不做的事

下一阶段不优先做：

- 不先接 `runtime/export.service.ts`
- 不把 screenshot/image-backed 当正式交付
- 不继续只围着当前 6 页无限磨像素
- 不把 `ingest-template.ts` 直接等价成 native template

## 8. 一句话总结

下一阶段真正要做的不是“继续把 AI 生成得更像某个样板”，而是补出一个统一中间层：

`外部 PPT 模板 -> native template -> AI/native 共用的页面生成能力`

只有这层站住，后面不管是导入模板、AI 生成，还是 runtime 正式接入，才不会继续分叉。
