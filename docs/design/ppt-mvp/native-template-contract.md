# Native Template Contract

## 1. 目的

`native_template/v1` 是 PPT MVP 下一阶段必须补出的统一中间层。

它的作用不是替代：

- `template.json` 这类 raw ingest descriptor
- `page_plan/v1` 这类内容计划

而是专门解决一个问题：

**把“原始模板信息”归一化成 native renderer、AI layout decisions、后续 runtime 集成都能共用的模板能力层。**

## 2. 三层分工

### 2.1 Raw Template Descriptor

来源：

- `packages/backend/src/scripts/ppt-mvp/ingest-template.ts`

当前产物：

- `template.json`
- `template.md`

职责：

- 提取 PPT 模板里的 palette / font / layout / media / chart 摘要
- 描述“原模板长什么样”

限制：

- 还不能直接驱动 native renderer
- 里面缺少 primitive 级别的明确布局约束
- 里面没有 variant 到模板能力的正式绑定

### 2.2 Native Template

来源：

- `hand_authored`
- `ingested_template -> converted`
- 未来也可以来自 `visual_brief -> normalized`

当前目标格式：

- `native_template/v1`

职责：

- 描述“这个模板能怎么生成 native 页面”
- 固化 token、primitive、asset rule、variant binding

### 2.3 Page Plan

来源：

- 手工内容规划
- AI 输出

职责：

- 描述“每一页讲什么”
- 不负责模板是什么样

## 3. Native Template 的字段结构

### 3.1 Header

- `version`
  - 固定为 `native_template/v1`
- `templateId`
  - 模板唯一标识
- `familyId`
  - 当前 family 归属
- `familyName`
  - 可读名称
- `source`
  - 来源信息：
    - `hand_authored`
    - `ingested_template`
    - `visual_brief`

### 3.2 Tokens

`tokens` 解决“风格常量”问题。

包括：

- `colors`
- `typography`
- `spacing`
- `radius`
- `stroke`
- `shadow`

这部分是从原模板抽象出的稳定设计 token，不应混入具体页面文案。

### 3.3 Primitives

`primitives` 解决“可重复页面构件”问题。

当前建议 primitive 类型：

- `title_block`
- `hero_panel`
- `info_rail`
- `card`
- `image_frame`
- `badge`
- `timeline_node`
- `process_step`
- `footer_summary`

注意：

- primitive 不是某一页的最终 layout
- primitive 是 native renderer 的可复用构件语义

### 3.4 Variant Bindings

`variantBindings` 解决“某个页型应该如何调用模板能力”问题。

每个 binding 需要说明：

- `variantId`
- `pageType`
- `requiredPrimitives`
- `optionalPrimitives`
- `requiredAssetSlots`
- `contentRules`
- `notesPolicy`

它是未来 AI/native 共用的关键接口。

### 3.5 Asset Rules

`assetRules` 解决“素材槽位在模板中的处理方式”问题。

例如：

- `hero_bg -> background_cover`
- `bg_texture -> texture_overlay`
- `timeline_icon_* -> icon_badge`
- `device_image_* -> image_contain`

也就是说：

- 素材是否必须
- 如何摆放
- 属于哪些 variant

都在这层定义，而不是分散在 renderer 代码里硬编码。

## 4. ingest descriptor -> native template 映射

### 4.1 可直接映射

这些字段通常能从 `ingest-template.ts` 原始输出中直接或半直接得到：

- `design_tokens.color_palette -> tokens.colors`
- `design_tokens.typography -> tokens.typography`
- `slide_examples / layouts_extracted -> primitives` 的候选线索
- `asset_library` -> `assetRules` 的候选槽位与素材类型

### 4.2 不能直接映射，必须归一化

这些是 `convert-ingested-template-to-native.ts` 必须解决的：

- 哪些布局构件该提升成 primitive
- 哪些素材槽位应该是 required，哪些只是 optional
- 哪些 primitive 对应哪些 variant
- 页面级 spacing / radius / stroke 应归一成哪一组标准值

### 4.3 仍需人工兜底

至少在前几轮，下面这些不建议完全自动化：

- family 命名
- primitive 语义命名
- variantBinding 的 contentRules
- 复杂模板中“相似构件是否应合并”

也就是说：

- ingest 是观察
- convert 是归一化
- human review 仍是模板成型的最后一步

## 5. 当前 hand-authored 基线

当前已经落了一份 hand-authored 样例模板：

- `docs/design/ppt-mvp/templates/doubao-light-tech-v1.native-template.json`

它的意义不是“最终模板市场格式已定”，而是：

- 给 schema 一个真实样例
- 给后续 ingest -> native 转换提供目标形态
- 给 builder 接模板提供第一份输入

## 6. 校验与工具

当前新增的校验链路：

- `packages/backend/src/scripts/ppt-mvp/native-template-schema.ts`
- `packages/backend/src/scripts/ppt-mvp/validate-native-template.ts`

用途：

- 确保模板 JSON 结构完整
- 确保 6 个现有 variant 都有 binding
- 确保 binding 引用的 primitive 都存在

## 7. 下一步接口方向

下一阶段代码接入建议：

1. `convert-ingested-template-to-native.ts`
   - 输入 `template.json`
   - 输出 `native-template.json`

2. `build-native-from-page-plan.ts`
   - 新增 `nativeTemplatePath`
   - 从模板读取 token / primitive / asset rule

3. AI pipeline
   - Layer 0 不再只输出抽象 genes
   - 要能在 native template 边界内做设计决策

## 8. 结论

`native_template/v1` 的存在，是为了把这三件事统一到一层里：

- 外部 PPT 模板导入
- AI 页面生成
- native 可编辑 PPT 导出

没有这层，系统会一直停留在：

- ingest 是一条线
- AI 是一条线
- native renderer 又是一条线

有了这层，后面才能开始真正合流。
