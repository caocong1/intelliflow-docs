# Phase 23: Output Path Grammar + File Slots + Export ContentMapping - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish unified output path grammar (segmentKey canonical form), add file slot semantics to input transform nodes, and make export contentMapping work at runtime. Data model, resolution algorithm, and type changes are defined in `docs/design/flow-node-capability-analysis.md` Section 二 + Section 三 缺口 #2 + #4a.

</domain>

<decisions>
## Implementation Decisions

### machineKey 配置交互
- machineKey 输入框放在每个表单字段的"高级设置"折叠区内，不干扰基础配置流程
- 输入时实时行内校验格式（`/^[a-zA-Z_][a-zA-Z0-9_]*$/`），非法字符时输入框下方红字提示
- 同一节点内 segmentKey 跨类型冲突时，字段级实时提示"与 [xx] 字段的标识符冲突"
- 保存时 validation.ts 也做二次校验

### 文件槽位上传 UX
- 每个 fileSlot 渲染为独立卡片区域，带 fileSlotLabel 作为标题，内含拖拽上传区和已上传文件列表
- 变量路径提示（如 `{{n1.tender_doc}}`）仅在管理员配置页显示，用户执行页不显示
- 混合排布：有 fileSlotId 的槽位卡片按配置顺序在前，无 fileSlotId 的普通 file 字段显示为"其他文件"区域在后
- fileSlotId 和 fileSlotLabel 配置放在 file 类型字段的"高级设置"折叠区内（与 machineKey 同一区域）

### 导出内容组装
- contentMapping 引用多个上游输出时，各段内容用双换行 (`\n\n`) 拼接，不加标题或分隔线
- contentMapping 为空时保留现有回退逻辑（取最近一个上游节点内容），完全向后兼容
- 导出预览（getExportPreview）展示合并后的完整预览文本，与实际导出结果一致
- contentMapping 中某个变量引用解析失败时，跳过该段并记录警告日志，继续导出其他可用内容；预览时显示缺失提示

### 变量选择器展示
- VariablePicker 按节点分组，每个输出项前加类型图标（文本字段=T，文件槽位=文件图标，模型输出=机器人图标）
- 选择变量后在 PromptEditor 中显示为可读标签芯片（如 [n1.项目名称]），底层存储 `{{n1.project_name}}`
- 暂不需要搜索/过滤功能，当前流程规模（5-8 节点）下分组展示已够用
- ExportConfig 的 contentMapping 配置复用 VariablePicker 组件，选中后加入列表，支持拖拽调整导出顺序

### Claude's Discretion
- machineKey 是否从 label 自动生成建议值（如"项目名称" → project_name），由 Claude 根据实现复杂度决定
- 具体图标选择和配色方案
- 高级设置折叠区的默认展开/收起状态

</decisions>

<specifics>
## Specific Ideas

- 高级设置折叠区模式统一应用于 machineKey 和 fileSlot 配置，保持配置面板的一致性
- VariablePicker 的分组标题显示节点名称，与流程编辑器中的节点标签保持一致
- contentMapping 的拖拽排序决定了最终导出文档中各段的顺序

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VariablePicker.tsx`: 已有变量选择器组件，需扩展支持 fileSlot 类型和图标显示
- `PromptEditor.tsx`: 已有标签芯片渲染模式，需更新 segmentKey 显示逻辑
- `InputTransformExecutor.tsx`: 已有表单渲染逻辑，需扩展独立文件槽位卡片
- `ConfigPanel.tsx` / `InputTransformConfig.tsx`: 已有字段配置面板，需加入高级设置折叠区

### Established Patterns
- `derive-outputs.ts`: OutputDef 推导模式——按节点类型 switch case 生成，需加入 segmentKey 字段和 fileSlot 输出项
- `resolvePromptTemplate()` in `model-call.service.ts:20-68`: 正则替换 + fields 查找模式，需重构为 `resolveRef()` 支持优先级查找链
- `export.service.ts::resolveContent()`: 当前遍历上游节点取内容的回退逻辑需保留，新增 contentMapping 优先路径
- `validation.ts`: 已有流程保存校验，需扩展 segmentKey 唯一性检查

### Integration Points
- `packages/shared/src/types.ts`: OutputDef 加 segmentKey、VariableRef 加 fieldPath、FormFieldDef 加 machineKey/fileSlotId/fileSlotLabel
- `export.service.ts::generateExport()`: 需通过 `loadNodeConfig()` 加载 ExportConfig 获取 contentMapping
- `export.service.ts::getExportPreview()`: 同样需要 contentMapping 支持
- 数据切换：设计文档明确"无需迁移，全量切换到新格式"——开发环境旧数据可重置

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-output-path-grammar-file-slots-export-contentmapping*
*Context gathered: 2026-03-27*
