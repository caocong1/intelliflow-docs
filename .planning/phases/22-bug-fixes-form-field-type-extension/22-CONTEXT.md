# Phase 22: Bug Fixes + Form Field Type Extension - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

修复 background.service.ts 中 2 个已知 bug（导出节点类型不匹配、忽略 skippable+autoAdvance 语义），然后扩展 input transform 表单字段类型（新增 number、date、datetime、select、multiselect）并添加 machineKey 支持，实现 outputData 双视图和下游变量引用。

</domain>

<decisions>
## Implementation Decisions

### Select/Multiselect 选项管理
- 选项定义为纯文本列表（每个选项仅一个文本值，存储值 = 显示文本）
- 管理员在配置面板中通过列表 UI 添加/删除/排序选项
- select 存储选中的文本值，multiselect 用逗号拼接（如 "高,中"）
- 支持默认值：管理员可指定一个默认选项（select）或多个默认选项（multiselect）
- multiselect 不限制最大可选数量

### machineKey UX
- machineKey 输入折叠在"高级设置"区域中，默认不显示
- 提供自动生成建议：用户输入字段名称后自动生成 machineKey 建议值，用户可修改
- 格式校验为实时校验：输入时实时显示红色错误提示（"只允许英文字母、数字和下划线"），格式不合法时阻止保存

### 新字段类型控件
- 使用浏览器原生控件：number → `<input type="number">`，date → `<input type="date">`，datetime → `<input type="datetime-local">`，select → `<select>`，multiselect → 多选复选框或原生多选
- number 字段不配置 min/max/step，纯数字输入
- date/datetime 支持默认值（管理员可设置，如"今天"），不限制日期范围
- 日期值以 ISO 格式传递给下游（date → "2025-03-26"，datetime → "2025-03-26T14:30:00"）
- 用 Tailwind 统一样式，与现有 text/textarea/file 控件保持视觉一致

### 验证与错误显示
- 前端实时 + 提交时双重验证：用户离开字段时实时校验，提交时再做整体校验
- 错误信息显示在字段下方，红色文本 + 字段边框变红
- 必填字段未填时阻止提交（与现有 text/textarea 必填行为一致）
- 后端也做校验（双重校验）：校验必填、类型正确性、select 值在选项列表内

### Claude's Discretion
- machineKey 自动生成的具体策略（拼音、field_N、或其他方案）
- multiselect 用原生 `<select multiple>` 还是复选框组
- 具体的错误提示文案
- 两个 bug 修复的具体实现细节

</decisions>

<specifics>
## Specific Ideas

- select/multiselect 的选项管理 UI 应与现有字段列表管理（添加/删除/拖拽排序）风格一致
- machineKey 高级设置的展开/折叠交互与现有配置面板中的折叠区域保持一致
- 新字段类型在配置面板的 FIELD_TYPE_OPTIONS 中添加，与现有 text/textarea/file 并列

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InputTransformConfig.tsx`: 现有字段配置面板，FIELD_TYPE_OPTIONS 数组可直接扩展新类型
- `InputTransformExecutor.tsx`: 现有表单执行器，按 field.type switch 渲染不同控件
- `InputTransformCompleted.tsx`: 已完成状态的展示组件
- `derive-outputs.ts`: OutputDef 推导，已有 field.id 生成逻辑可扩展为 machineKey

### Established Patterns
- 字段类型用 TypeScript 联合类型定义在 `FormFieldDef.type`（当前 "text" | "textarea" | "file"）
- 字段配置通过 addField/updateField/removeField 函数管理
- 文件类型字段有 fileCountMode 和 acceptedFileTypes 等类型特定配置，新类型可循此模式
- 节点配置统一有 autoAdvance/allowEdit/skippable 可选字段

### Integration Points
- `packages/shared/src/types.ts`: FormFieldDef 接口需扩展（新类型 + machineKey + options/defaultValue）
- `packages/backend/src/modules/runtime/background.service.ts`: bug 修复位置（L259 file_export → export，L216-223 增加 skippable+autoAdvance 检查）
- `packages/backend/src/modules/workflows/validation.ts`: 后端校验逻辑添加位置
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts`: machineKey 作为 segmentKey 的推导逻辑

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-bug-fixes-form-field-type-extension*
*Context gathered: 2026-03-26*
