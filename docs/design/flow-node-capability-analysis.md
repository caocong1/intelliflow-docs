# IntelliFlow 流程编排与节点能力 — 需求分析报告 v2

## Context

基于投标文件生成流程（docs/design/bid-response-flow-design.md）的设计实践，反向审视 IntelliFlow 系统当前的流程编排、节点配置和节点执行能力，识别通用性的功能缺口。这些改进不针对投标场景，而是提升系统作为通用 AI 文档生成平台的能力。

**分析方法**：对比 v4 需求文档的设计 vs 当前代码实现 vs 投标流程实际需要，提取出对所有文档类型都有价值的通用改进项。

---

## 一、当前系统实现状态概览

> 以下状态基于代码仓库实际验证，标注了具体的代码证据。

| 模块 | 状态 | 证据 |
|------|------|------|
| 流程编辑器（可视化画布） | ✅ 完整 | `packages/frontend/src/lib/flow-engine/` — store/undo-redo/autosave/alignment 全套 |
| 5 种节点类型配置 | ✅ 完整 | `packages/shared/src/types.ts` L87-181 — 类型定义完整 |
| 运行时执行引擎 | ✅ 完整 | `runtime.service.ts` — initDocumentExecution/advanceNode/rollbackToNode/skipNode |
| 模型调用（API 模式） | ✅ 完整 | `strategies/openai-compatible.strategy.ts` + `claude-agent-sdk.strategy.ts` |
| 多模型并行 + SSE 流式 | ✅ 完整 | `model-call.service.ts` — Promise.allSettled + SSE delta events |
| 脱敏/恢复 | ✅ 完整 | `desensitize.service.ts` / `restore.service.ts` |
| 变量系统（当前为 `{{nodeId.outputId}}`，v2 统一为 `{{nodeId.segmentKey}}`） | ⚠️ 基础可用，有限制 | `model-call.service.ts` L30-57 — 见下方详细说明 |
| 后台流水线执行 | ⚠️ 基本可用，有缺陷 | `background.service.ts` — 见下方详细说明 |
| 回退/版本快照 | ✅ 完整 | `runtime.service.ts::rollbackToNode()` — executionRound 追踪 |
| 文件导出 | ⚠️ 基础，关键能力缺失 | `export.service.ts` — 见下方详细说明 |
| 资料库 RAG | ❌ 仅有设计文档 | `docs/design/material-context-design.md` — 606 行设计，无实现代码 |

### 变量系统详细状态

**已实现**：
- `resolvePromptTemplate()` 使用 `/\{\{([^}]+)\}\}/g` 正则匹配（L30）
- 支持 `{{nodeId.outputId}}` 格式解析
- 支持 input_transform 的 `fields.fieldKey` 一级嵌套（L44-51）
- 前端有完整的变量选择器 `VariablePicker.tsx` 和提示词编辑器 `PromptEditor.tsx`

**未实现/限制**：
- ❌ **不支持任意层级的嵌套字段**（如 `{{n3.result.hasBlockingIssues}}`），仅支持 input_transform 的 `fields` 特殊路径
- ❌ **无错误处理**：引用不存在的节点/输出时，原始 `{{...}}` 文本静默保留在提示词中，无警告、无日志、无前端提示
- ❌ **无运行时校验**：不检查变量引用是否指向已完成的上游节点

### 资料库/RAG 详细状态

- ❌ **无 `packages/backend/src/modules/materials/` 目录**
- ❌ **无 materials 相关 DB 表**（schema.ts 370 行中无 materials/materialVersions 等表）
- ❌ **无向量化/pgvector 集成**
- 设计文档（`material-context-design.md`）明确**拒绝了向量嵌入方案**，选择"长上下文 + Prompt Caching"策略
- **边界说明**：资料库是后续阶段的独立模块，当前报告中的改进项不依赖资料库能力

### 后台流水线详细状态

**已实现**：并发控制、按节点顺序执行、失败通知

**已知缺陷**：
- ❌ **节点类型枚举不匹配**：`background.service.ts` L259 的 switch case 使用 `"file_export"`，但 `types.ts` L87 定义的枚举值是 `"export"`。后台执行到导出节点时会落入 `default` 分支打印 `Unknown node type` 警告并跳过，导出不会执行。
- ❌ **后台执行忽略运行时 gating/手动确认语义**：`background.service.ts` L216-223 遍历节点时仅跳过 `status === "completed" || "skipped"` 的节点，不检查节点配置中的 `skippable` / `autoAdvance` 标记。所有节点（包括设计为需用户确认的节点）在后台模式下都会被直接执行，而非按 skippable+autoAdvance 规则自动跳过。

### 导出模块详细状态

- `ExportConfig.contentMapping: VariableRef[]` 字段存在于类型定义中（L175），前端 `ExportConfig.tsx` L44-58 可配置
- ❌ **后端 `export.service.ts::resolveContent()` 完全未引用 contentMapping**，使用通用的"查找最近一个上游节点的内容"逻辑（L16-92）
- Word 导出仅支持：H1-H3 标题、加粗/斜体、无序列表（`parseMarkdownToParagraphs` L96-145）
- ❌ **不支持表格渲染**（Markdown 表格变纯文本）
- ❌ **不支持封面/目录/页眉页脚**
- ❌ **不支持多文件导出**
- `templateId` 字段存在但未实现

---

### 已知 Bug（应在缺口实施前修复）

| Bug | 严重度 | 位置 | 修复方式 |
|-----|--------|------|---------|
| 后台执行导出节点类型不匹配 | **高** | `background.service.ts` L259：`case "file_export"` 应为 `case "export"` | 改为 `"export"` 对齐 `types.ts` L87 的枚举定义 |
| 后台执行忽略 skippable+autoAdvance 语义，所有节点直接执行 | **中** | `background.service.ts` L216-223 不检查 config 标记 | 后台模式应尊重节点的运行时设置：`skippable && autoAdvance` 的节点应被自动跳过而非执行。具体实现方式由开发者决定，需注意 `background.service.ts` 使用预加载的 executions 快照，而 `runtime.service.ts::skipNode()` 会修改状态并推进流程，需协调两者的状态同步 |

---

## 二、输出路径规范（Output Path Grammar）

> 本节统一定义变量引用的路径语法，后续所有缺口的设计以此为准。

### 当前语法与数据结构

**变量引用语法**：`{{nodeId.outputId}}`

**VariableRef 类型**（`types.ts` L107-111）：
```typescript
interface VariableRef {
  nodeId: string;
  outputId: string;
  variableName: string;  // 显示名，如 "n1.项目名称"
}
```

**表单字段 ID 生成**（`InputTransformConfig.tsx` L29）：
```typescript
id: crypto.randomUUID()  // 如 "a3f2e1d4-..."，不可读
```

**OutputDef 推导**（`derive-outputs.ts` L12-14）：
```typescript
outputs.push({
  id: `${nodeId}-field-${field.id}`,  // 如 "n1-field-a3f2e1d4-..."
  name: field.label || "未命名",
});
```

**当前限制**：
- 表单字段 ID 是 opaque UUID，路径中出现的是 `{{n1.n1-field-a3f2e1d4-...}}`，不可读不可预测
- `resolvePromptTemplate()` L30-57 仅支持二级路径，无多级字段引用
- `VariableRef` 只有 `nodeId + outputId`，无法表达 `segmentId.fieldPath` 的多级语法
- 前端 VariablePicker 从 OutputDef 列表构建选项，用户通过 UI 选择而非手写路径，**当前路径不可读问题被 UI 屏蔽了**

### 扩展方案

#### 步骤 1：为表单字段增加可选的 machineKey

```typescript
interface FormFieldDef {
  id: string;              // 保留 UUID（内部主键，向后兼容）
  machineKey?: string;     // 新增：管理员自定义的稳定标识（如 "project_name"）
  label: string;
  // ...
}
```

- `machineKey` 可选，管理员在配置 UI 中填写（建议但不强制）
- 格式约束：`/^[a-zA-Z_][a-zA-Z0-9_]*$/`，不可包含 `.` 或 `[]`
- 默认值：不填则使用 UUID

**segmentKey 统一命名规则**（适用于所有通过 `{{nodeId.segmentKey}}` 寻址的标识）：

| 来源 | segmentKey 值 | 是否必填 | 说明 |
|------|--------------|---------|------|
| 表单字段 machineKey | 管理员自定义（如 `project_name`） | 可选，不填则用 UUID | input_transform 节点 |
| 文件槽位 fileSlotId | 管理员自定义（如 `tender_doc`） | 可选，不填则文件合并到 `text` | input_transform 节点，启用槽位语义时填写 |
| 命名产物 namedOutputs[].id | 管理员自定义（如 `blueprint`） | 必填 | model_call 节点多产物模式 |
| 模型输出 modelId | 系统 model 表的 ID | 自动 | model_call 节点单产物模式，segmentKey = modelId |

- 格式约束统一：`/^[a-zA-Z_][a-zA-Z0-9_]*$/`（modelId 例外，由系统生成可包含 `-`）
- **同一节点内所有 segmentKey 必须跨类型唯一**，否则路径解析会产生歧义
- `validation.ts` 在流程保存时校验：收集节点内所有 segmentKey，检查无重复。对 model_call 节点：有 namedOutputs 时校验 namedOutputs[].id；无 namedOutputs 时校验 modelIds（均来自节点配置，静态可知）
- `derive-outputs.ts` 对 model_call 节点：有 namedOutputs 时按 namedOutputs[].id 生成 OutputDef；无 namedOutputs 时按配置的 modelIds 生成 OutputDef（segmentKey = modelId）

#### 步骤 2：修改 OutputDef 推导使用 machineKey

```typescript
// derive-outputs.ts
const key = field.machineKey || field.id;
outputs.push({
  id: `${nodeId}-field-${key}`,     // 有 machineKey 时可读：n1-field-project_name
  name: field.label,
  segmentKey: key,                   // 新增：路径解析用的 segment 标识
});
```

#### 步骤 3：扩展 VariableRef 支持多级路径

```typescript
interface VariableRef {
  nodeId: string;
  outputId: string;           // 存 segmentKey（如 "project_name"、"tender_doc"、"blueprint"）
  variableName: string;       // 显示名（如 "n1.项目名称"）
  fieldPath?: string;         // 新增：JSON 产物的字段路径（如 "items[0].name"）
}
```

**关键决策：`outputId` 存 `segmentKey` 而非 `OutputDef.id`**：
- 旧格式中 `outputId` 存的是完整的 `OutputDef.id`（如 `"n1-field-a3f2e1d4-..."`）
- 新格式中 `outputId` 存的是 `segmentKey`（如 `"project_name"`）
- 迁移策略见下方"旧格式处理"小节

- `fieldPath` 为空时 → 按输出类型自动解包返回默认值（见步骤 5）
- `fieldPath` 有值时 → 按命中的输出类型分别解析（见步骤 6）

**完整路径解析算法**：

```
resolveRef(ref: VariableRef, nodeExecs):
  1. exec = nodeExecs.find(e => e.nodeId === ref.nodeId)
  2. od = exec.outputData
  3. segmentKey = ref.outputId   // 直接使用，不再需要去前缀
  4. 按优先级查找 segmentKey：
     a. od.fieldsByKey?.[segmentKey]        → 按 machineKey 查表单字段值
     a2.od.fields?.[segmentKey]            → 按 fieldId(UUID) 查表单字段值（兼容）
     b. od.fileSlots?.[segmentKey]          → 文件槽位对象 → 无 fieldPath 时默认取 .text；有 fieldPath 时对整个对象做路径解析（如 fileMetadata[0].metadata.cert_no）
     c. od.namedOutputs?.[segmentKey]      → 命名产物对象（{content, format}）→ 取 .content
     d. od.models?.[segmentKey]            → 模型输出对象（{content, status}）→ 取 .content
     e. od[segmentKey]                     → 直接属性（text、confirmedAt 等）
  5. 无 fieldPath 时的默认取值（自动解包）：
     - a/a2 命中 → 直接返回字符串值
     - b 命中 → 返回 .text
     - c 命中 → 返回 .content
     - d 命中 → 返回 .content
     - e 命中 → 直接返回值
  6. 有 fieldPath 时的路径解析：
     - a/a2 命中（string）→ 尝试 JSON.parse 后按 fieldPath 取值
     - b 命中（fileSlot 对象）→ 直接对整个对象按 fieldPath 取值
       示例：fileMetadata[0].metadata.cert_no → obj.fileMetadata[0].metadata.cert_no
     - c 命中（namedOutput 对象）→ 对 .content 做 JSON.parse 后按 fieldPath 取值
     - d 命中（model output 对象）→ 对 .content 做 JSON.parse 后按 fieldPath 取值
     fieldPath 语法：key(.key)*([index](.key)*)*
  7. 取值失败 → 记录警告日志，返回原始 {{...}} 文本
```

**提示词中的变量格式（统一为一种 canonical form）**：

提示词模板中**只有一种合法的变量语法**：

```
{{nodeId.segmentKey}}              — 引用整个输出
{{nodeId.segmentKey.fieldPath}}    — 引用 JSON 产物的嵌套字段
```

其中 `segmentKey` 是 OutputDef 的 `segmentKey` 字段值，来源为：machineKey（表单字段）、fileSlotId（文件槽位）、namedOutputId（命名产物）、modelId（单产物模式下的模型输出）或 UUID fallback。

**不存在双轨制**：VariablePicker 插入的和手写的是同一种格式。具体机制：

1. `derive-outputs.ts` 为每个输出生成 `OutputDef`，其中 `segmentKey` 是路径中的标识符
2. `VariablePicker` 选择后插入 `{{nodeId.segmentKey}}`（如 `{{n1.project_name}}`）
3. `PromptEditor` 渲染时按 `segmentKey` 查找 OutputDef 显示可读标签
4. `resolvePromptTemplate()` 用正则 `/\{\{([^}]+)\}\}/g` 提取后，按 `nodeId` 和 `segmentKey` 构造 VariableRef，调用 `resolveRef()` 取值
5. `ExportConfig.contentMapping` 和 `NodeCondition.sourceRef` 都使用 `VariableRef` 结构，包含相同的 segmentKey

**OutputDef.id vs segmentKey 的关系**：
- `OutputDef.id` 是内部唯一标识，格式按类型区分：
  - 表单字段：`{nodeId}-field-{segmentKey}`
  - 文件槽位：`{nodeId}-fileslot-{segmentKey}`
  - 命名产物：`{nodeId}-namedoutput-{segmentKey}`
  - 模型输出：`{nodeId}-model-{modelId}`
- `OutputDef.segmentKey` 是路径中使用的标识，也是 VariableRef.outputId 的值
- 例：machineKey="project_name" → id="n1-field-project_name"，segmentKey="project_name"
- VariableRef 中 `outputId` 存的是 `segmentKey`（而非完整的 OutputDef.id），因为路径解析只需要 segmentKey

### 旧格式处理

**系统当前处于开发阶段，所有数据可重置清空，无需旧流程迁移。**

实施时直接全量切换到新格式：
- `VariablePicker` 改为插入 `{{nodeId.segmentKey}}`
- `PromptEditor` 序列化/反序列化统一使用 segmentKey
- `VariableRef.outputId` 统一存 segmentKey
- `derive-outputs.ts` 统一用 segmentKey 生成 OutputDef
- 开发环境中旧流程数据在切换后重置

**不需要**双读单写、兼容层、迁移脚本。

### 需要同步修改的模块

| 模块 | 文件 | 修改内容 |
|------|------|---------|
| 表单字段配置 | `InputTransformConfig.tsx` | 新增 machineKey 输入框（可选，带格式校验） |
| 类型定义 | `types.ts` | FormFieldDef 增加 machineKey；VariableRef 增加 fieldPath；OutputDef 增加 segmentKey |
| 输出定义推导 | `derive-outputs.ts` | 使用 machineKey 优先于 id 生成 OutputDef；新增 fileSlotId 的输出项；model_call 节点：有 namedOutputs 时按 namedOutputs[].id 生成，无 namedOutputs 时按 modelIds 生成（segmentKey = modelId） |
| 路径解析引擎 | `model-call.service.ts::resolvePromptTemplate()` | 提取通用 `resolveRef()` 函数，支持 segmentKey 查找 + fieldPath 解析 |
| 变量选择器 | `VariablePicker.tsx` | 展示 fileSlot/namedOutput 类型输出；JSON 产物展示可展开字段树供用户选择 fieldPath |
| 提示词编辑器 | `PromptEditor.tsx` | resolveVarDisplayName 使用新的 segmentKey 显示可读名称 |
| 流程校验 | `validation.ts` | 校验 VariableRef.outputId（即 segmentKey）在上游节点的 OutputDef.segmentKey 集合中存在；同一节点内所有 segmentKey 跨类型唯一 |
| 导出配置 | `ExportConfig.tsx` | contentMapping 选择器使用相同的 OutputDef 体系和 VariableRef 结构 |
| 条件规则 | `ConfigPanel.tsx`（缺口 5） | sourceRef 使用 VariableRef 结构（含 fieldPath），非自由文本 |

---

## 三、识别的通用功能缺口（7 项）

---

### 缺口 1：输入转换节点 — 表单字段类型不足

**现状证据**：`FormFieldDef.type` 仅支持 `"text" | "textarea" | "file"` 三种（`types.ts` L117）。

**影响范围**：所有需要结构化输入的文档类型——投标流程（日期、金额、下拉选择采购方式）、技术方案（版本号）、会议纪要（日期时间）、项目计划（数字预算）等。当前只能用 text 让用户自由输入，无前端校验和格式约束。

**建议改进**：

```typescript
// packages/shared/src/types.ts — FormFieldDef.type 扩展
type FormFieldType =
  | "text" | "textarea" | "file"     // 现有
  | "number"      // 新增：数字输入（含 min/max/step）
  | "date"        // 新增：日期选择器
  | "datetime"    // 新增：日期时间选择器
  | "select"      // 新增：下拉单选（需 options 配置）
  | "multiselect" // 新增：下拉多选

interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  fileCountMode?: "single" | "unlimited";
  acceptedFileTypes?: string[];
  // number 专属
  min?: number; max?: number; step?: number;
  // select/multiselect 专属
  options?: Array<{ label: string; value: string }>;
}
```

**实现边界**：
- 不引入动态表单引擎，每种类型对应一个前端组件即可
- 后端校验按 type 做简单规则校验（number 范围、date 格式、select 值在 options 中）
- 字段值存储采用**双视图**：`outputData.fields` 按 `fieldId`（UUID）存值不变（向后兼容），新增 `outputData.fieldsByKey` 按 `machineKey` 存值（仅对有 machineKey 的字段）：
  ```typescript
  outputData: {
    fields: { "a3f2e1d4-...": "2026-04-01" },      // 现有：按 UUID 存（不变）
    fieldsByKey: { "deadline": "2026-04-01" },       // 新增：按 machineKey 存
    // ...
  }
  ```
- 路径解析算法（第二节）中 `od.fields[segmentKey]` 实际查找顺序：先查 `fieldsByKey[segmentKey]`，未命中再查 `fields[segmentKey]`（兼容无 machineKey 时直接用 UUID 引用）

**涉及文件**：
- `packages/shared/src/types.ts` — 类型定义
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` — 前端渲染
- `packages/frontend/src/components/workflow/config/ConfigPanel.tsx` — 管理员配置 UI
- `packages/backend/src/modules/runtime/input-transform.service.ts` — 后端校验

**验收标准**：
- ✅ 管理员能在流程编辑器中为输入转换节点添加 number/date/select 类型字段
- ✅ 用户在执行页面看到对应的原生输入控件（数字输入框、日期选择器、下拉框）
- ✅ number 字段输入非数字时前端阻止提交，超出 min/max 时提示
- ✅ select 字段用户只能从预定义选项中选择
- ✅ 下游模型调用节点通过 `{{nodeId.machineKey}}` 能正确引用新类型字段的值（如 `{{n1.deadline}}`）；无 machineKey 时通过 UUID 引用仍有效
- ❌ 失败场景：未配置 machineKey 的字段仍可通过 UUID 引用

---

### 缺口 2：输入转换节点 — 文件上传缺少槽位语义

**现状证据**：
- `FormFieldDef` 的 file 类型只有 `fileCountMode`（single/unlimited）和 `acceptedFileTypes` 两个属性（`types.ts` L119-122）
- `input-transform.service.ts` L115 所有上传文件统一标记 `category: "upload"`
- `confirmInputTransform()` L154-162 将所有文件的解析文本用文件名分隔符拼接为单一文本块
- **无任何字段区分文件用途/角色**

**影响范围**：所有需要区分多种输入文件的流程。投标流程中"招标文件"和"证据附件"和"产品选型表"是完全不同角色的文件，下游节点需要分别引用；技术方案中"需求文档"和"参考架构图"也是不同角色。当前所有文件混在一起，下游节点无法定向引用特定文件。

**建议改进**：

```typescript
// packages/shared/src/types.ts — FormFieldDef 扩展
interface FormFieldDef {
  // ...existing fields...
  /** file 类型专属：文件槽位的语义标签 */
  fileSlotId?: string;          // e.g. "tender_doc", "evidence_pack", "product_spec"
  fileSlotLabel?: string;       // e.g. "招标文件", "证据附件包", "产品选型表"
}
```

**运行时行为变更**：
- `confirmInputTransform()` 输出新增 `fileSlots` 字段，**不修改现有 `files` 数组结构**：
  ```typescript
  // outputData 结构（向后兼容）
  {
    fields: { ... },              // 表单字段（不变）
    files: [                      // 保留：现有数组结构，不改动
      { fileId: "f1", name: "招标文件.docx", parsedText: "..." },
      { fileId: "f2", name: "营业执照.pdf", parsedText: "..." },
    ],
    fileSlots: {                  // 新增：按槽位分组的视图
      "tender_doc": {
        text: "...",              // 该槽位所有文件的合并文本
        fileIds: ["f1"],
        fileNames: ["招标文件.docx"],
      },
      "evidence_pack": {
        text: "...",
        fileIds: ["f2","f3"],
        fileNames: ["营业执照.pdf","审计报告.pdf"],
      },
    },
    text: "..."                   // 保留：所有文件合并文本（向后兼容）
  }
  ```
- 下游变量引用：`{{n1.tender_doc}}` 通过路径解析算法命中 `outputData.fileSlots["tender_doc"].text`
- 无 `fileSlotId` 的 file 字段不写入 `fileSlots`，仅保留在 `files` 数组和 `text` 中

**实现边界**：
- 前端每个 file 字段渲染为独立的上传区域，标题显示 `fileSlotLabel`
- 后端新增 `fileSlots` 字段作为按槽位的聚合视图，`files` 数组保持原样
- DB 层面 `documentFiles` 表增加 `slotId` 列（nullable），不影响现有记录
- `derive-outputs.ts` 需修改：有 `fileSlotId` 的 file 字段各自生成独立 OutputDef（id 为 `{nodeId}-fileslot-{slotId}`），替代当前的单一 `{nodeId}-file-upload`；无 slotId 的 file 字段仍合并为单一输出

**涉及文件**：
- `packages/shared/src/types.ts` — 类型
- `packages/backend/src/modules/runtime/input-transform.service.ts` — 分组逻辑
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` — 分区域上传 UI
- `packages/backend/src/db/schema.ts` — documentFiles 表增加 slotId 列

**验收标准**：
- ✅ 管理员能为 file 字段配置 fileSlotId 和 fileSlotLabel
- ✅ 用户在执行页面看到多个独立上传区域，各有标题
- ✅ 下游节点通过 `{{n1.tender_doc}}` 只获取该槽位的文件文本，不混入其他文件
- ✅ 不配置 fileSlotId 的 file 字段行为不变（合并到 text）
- ❌ 失败场景：未配置 fileSlotId 的 file 字段内容仍合并到 `text`，可通过 `{{n1.text}}` 引用

---

### 缺口 3：模型调用节点 — 缺少结构化输出与多产物命名能力

**现状证据**：
- `ModelCallConfig` 无 `outputFormat` 字段（`types.ts` L144-157）
- 模型输出存储为 `outputData.models[modelId].content`（string 类型）
- 节点只声明一组 `outputs: OutputDef[]`，但运行时输出结构是固定的 `{ models: { [modelId]: { content, status } } }`，`OutputDef` 实际未在运行时产物定位中发挥作用
- 变量系统仅支持引用整个 `content` 字符串，无法按字段引用（`model-call.service.ts` L30-57 仅处理 `nodeId.outputId` 二级路径）

**影响范围**：所有需要"一个模型调用节点输出多个命名产物"或"输出结构化数据供下游按字段引用"的流程。例如：
- 投标流程节点③需要同时输出蓝图、条款清单、评分矩阵三个独立产物
- 质检节点需要输出 `{ hasBlockingIssues: true, issues: [...] }` 供条件执行判断
- 竞品分析需要输出 JSON 表格数据供导出节点渲染

**建议改进**：

```typescript
// packages/shared/src/types.ts — ModelCallConfig 扩展
interface ModelCallConfig {
  type: "model_call";
  displayName: string;
  stepDescription?: string;         // 新增：面向用户的任务说明
  modelIds: string[];
  promptTemplate: string;
  inputRefs: VariableRef[];
  outputFormat?: "text" | "json" | "markdown";  // 新增：输出格式规约
  jsonSchema?: object;              // 新增：outputFormat="json" 时的可选 schema
  /** 新增：命名产物定义 — 一个节点可声明多个命名输出 */
  namedOutputs?: Array<{
    id: string;                     // e.g. "blueprint", "clause_list"
    name: string;                   // e.g. "投标蓝图", "条款清单"
    format: "text" | "json" | "markdown";
    jsonSchema?: object;
  }>;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}
```

**运行时行为**：

A. **outputFormat（单产物模式，向后兼容）**：
- `"text"/"markdown"` — 现有行为不变
- `"json"` — 模型输出后自动校验 JSON 合法性；校验失败标记为 `status: "format_error"`，用户可查看原始输出并手动修正后重新校验

B. **namedOutputs（多产物模式）**：
- 提示词中系统自动注入输出格式指令，要求 AI 用 `===OUTPUT:id===` 分隔符包裹每个产物
- 运行时解析分隔符，将内容拆分到 `outputData.namedOutputs[id]`
- 下游变量引用：`{{n3.blueprint}}` 获取蓝图文本，`{{n3.clause_list}}` 获取条款清单
- JSON 格式的命名产物自动校验，支持 `{{n3.clause_list.fieldName}}` 按字段引用

C. **变量系统扩展**：
- `resolvePromptTemplate()` 增加对 `namedOutputs[id]` 的查找路径
- JSON 产物支持任意深度的字段引用：`{{nodeId.outputId.field.subfield}}`
- 引用不存在的路径时记录警告日志并在前端展示（替代现有的静默保留行为）

D. **前端展示**：
- 单产物模式：现有 Markdown 渲染 + JSON 格式新增结构化表格/树视图切换
- 多产物模式：每个命名产物独立展示卡片，用户可逐个审核编辑
- JSON 产物编辑：用户可直接编辑 JSON 字段值，编辑后回写到 `outputData`

**实现边界**：
- 多产物解析的分隔符格式固定为 `===OUTPUT:id===...===END:id===`，不支持自定义
- JSON schema 校验使用 ajv 库，仅做格式校验不做语义校验
- 向后兼容：无 `namedOutputs` 和 `outputFormat` 时完全走现有逻辑

**数组索引语法**：
- 支持 `items[0].name` 格式，解析规则见第二节路径规范的 `fieldPath` 语法
- 解析时用正则 `/\[(\d+)\]/g` 提取索引，依次取 `value[index]`
- 索引越界时返回 null，触发警告日志

**涉及文件**：
- `packages/shared/src/types.ts` — 类型定义（ModelCallConfig 扩展）
- `packages/backend/src/modules/runtime/model-call.service.ts` — 输出解析/校验/分拆 + `resolvePromptTemplate()` 扩展多级字段引用（注：resolvePromptTemplate 在此文件 L20-68，不在 runtime.service.ts）
- `packages/frontend/src/lib/flow-engine/derive-outputs.ts` — 有 namedOutputs 时按 namedOutputs[].id 生成 OutputDef；无 namedOutputs 时按 modelIds 生成（segmentKey = modelId）
- `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` — 多产物卡片/JSON 编辑
- `packages/frontend/src/components/workflow/prompt/VariablePicker.tsx` — 命名产物出现在变量选择器，JSON 产物展示可展开字段树
- `packages/frontend/src/components/workflow/config/ConfigPanel.tsx` — 命名产物配置 UI
- `packages/backend/src/modules/workflows/validation.ts` — 校验同一节点内所有 segmentKey 跨类型唯一

**验收标准**：
- ✅ 配置 `outputFormat: "json"` 后，模型输出非法 JSON 时前端显示校验错误，用户可手动修正
- ✅ 配置 `namedOutputs` 后，前端按产物分卡片展示，每个可独立编辑
- ✅ `{{n3.clause_list}}` 返回该命名产物的完整内容
- ✅ `{{n3.clause_list.items[0].name}}` 对 JSON 产物返回嵌套字段值
- ✅ 变量引用不存在路径时，模型调用日志记录警告，前端在变量选择器中标记为无效
- ❌ 失败场景：AI 输出未按分隔符格式生成 → 回退到单产物模式，全部内容存入默认 output，前端提示"未能解析多产物输出，已回退为单产物"
- ❌ 默认行为：未配置 namedOutputs 和 outputFormat 时走现有单产物文本逻辑

**新增状态值的类型变更**：

本缺口引入 `format_error` 状态，需同步修改共享类型和相关 UI：

```typescript
// types.ts — ModelOutput.status 扩展
export interface ModelOutput {
  // ...
  status: "pending" | "streaming" | "completed" | "failed" | "format_error";
  //                                                          ^^^^^^^^^^^ 新增
}
```

| 涉及位置 | 修改内容 |
|---------|---------|
| `packages/shared/src/types.ts` L382 | ModelOutput.status 联合类型增加 `"format_error"` |
| `packages/frontend/src/components/workspace/nodes/ModelCallExecutor.tsx` | 渲染 format_error 状态：显示校验错误详情 + "修正并重新校验"按钮 |
| `packages/backend/src/modules/runtime/model-call.service.ts` | JSON 校验失败时设置 `status: "format_error"` 而非 `"failed"` |
| 模型调用日志 | `modelCallLogs` 记录 format_error 及原始输出内容，便于排查 |

---

### 缺口 4：文件导出节点 — contentMapping 未生效 + 渲染能力不足

> 拆为 4a/4b/4c 三个子项，按依赖关系排序。

#### 缺口 4a：contentMapping 运行时未生效（最高优先）

**现状证据**：
- `ExportConfig.contentMapping: VariableRef[]` 在类型定义中存在（`types.ts` L175）
- 前端 `ExportConfig.tsx` L44-58 允许用户勾选要导出的上游输出
- **后端 `export.service.ts::resolveContent()` 完全未引用 contentMapping**（L16-92），使用"遍历所有上游已完成节点，取第一个有内容的"通用逻辑

**影响范围**：所有多节点流程的导出。当流程有 4 个模型调用节点时，用户无法控制"导出哪些节点的输出、按什么顺序组装"，系统只取最近一个节点的内容。

**当前调用链**（contentMapping 缺失的根因）：

```
export.routes.ts L36-67:
  POST /:documentId/export/:nodeExecutionId/generate
  body: { format, filename }                    ← 不含 contentMapping
  ↓
  generateExport(documentId, nodeExecutionId, format, filename, userId)
  ↓
export.service.ts L227-233:
  generateExport() 内部调用：
  const content = await resolveContent(documentId, nodeExecutionId)  ← 不传 contentMapping
  ↓
export.service.ts L16-92:
  resolveContent() 遍历所有上游节点取第一个有内容的   ← 完全忽略用户配置
```

**建议改进**：

步骤 1 — `generateExport()` 自行加载节点配置获取 contentMapping：
```typescript
// export.service.ts — generateExport() 修改
export async function generateExport(
  documentId: string,
  nodeExecutionId: string,
  format: "word" | "pdf" | "markdown",
  filename: string,
  userId: string,
) {
  // 新增：从节点执行记录关联的 workflow 节点定义中加载 ExportConfig
  const exportConfig = await loadNodeConfig(documentId, nodeExecutionId);
  const contentMapping = exportConfig?.contentMapping ?? [];

  const content = await resolveContent(documentId, nodeExecutionId, contentMapping);
  // ... 后续不变
}
```

步骤 2 — `resolveContent()` 增加 contentMapping 参数：
```typescript
async function resolveContent(
  documentId: string,
  nodeExecutionId: string,
  contentMapping: VariableRef[]
): Promise<string> {
  if (contentMapping.length > 0) {
    // 按 contentMapping 顺序，逐条解析引用
    // 使用与 resolvePromptTemplate() 相同的路径解析算法（第二节）
    // 拼接为最终导出内容，段间用 \n\n 分隔
    // 引用不存在 → 该段内容标注 [内容未生成]
  } else {
    // 保留现有逻辑作为 fallback（向后兼容）
  }
}
```

步骤 3 — 新增 `loadNodeConfig()` 辅助函数：
```typescript
// export.service.ts — 新增
async function loadNodeConfig(documentId: string, nodeExecutionId: string): Promise<ExportConfig | null> {
  // 1. 从 nodeExecutions 查 nodeId
  // 2. 从 documents 查 workflowId
  // 3. 从 workflows.nodes JSONB 中找 nodeId 对应的节点定义
  // 4. 返回 config as ExportConfig
}
```

步骤 4 — `getExportPreview()` 同步修复（L293-304）：
```typescript
// export.service.ts — getExportPreview() 修改
export async function getExportPreview(
  documentId: string,
  nodeExecutionId: string,
): Promise<{ content: string; defaultFilename: string }> {
  // 新增：加载 contentMapping，与 generateExport 使用相同逻辑
  const exportConfig = await loadNodeConfig(documentId, nodeExecutionId);
  const contentMapping = exportConfig?.contentMapping ?? [];

  const content = await resolveContent(documentId, nodeExecutionId, contentMapping);
  // ... 后续不变
}
```

**实现边界**：
- **不修改 route 层参数**，由 export service 自行加载节点配置
- `generateExport()` 和 `getExportPreview()` 都通过 `loadNodeConfig()` 获取 contentMapping，确保预览和导出内容一致
- 路径解析复用 `resolvePromptTemplate()` 中提取的 `resolveRef()` 函数
- 多条内容间用 `\n\n` 分隔（Markdown 段落间距）
- 后台执行（`background.service.ts`）中的 `generateExport()` 调用同样受益，无需额外修改

**涉及文件**：
- `packages/backend/src/modules/runtime/export.service.ts` — resolveContent 重写 + loadNodeConfig 新增 + generateExport 修改
- `packages/backend/src/modules/runtime/model-call.service.ts` — 提取路径解析为独立函数 `resolveOutputPath()`，供 export.service 复用

**验收标准**：
- ✅ 管理员配置 contentMapping 引用 3 个上游节点输出，导出文件按顺序包含这 3 段内容
- ✅ contentMapping 为空时，行为与当前一致（取最近上游内容）
- ✅ 后台执行模式下 contentMapping 同样生效
- ❌ 失败场景：引用的上游节点未完成 → 导出内容中该段标注 `[内容未生成]`，不阻断导出
- ❌ 默认行为：contentMapping 为空时走 fallback 逻辑（取最近上游内容）

#### 缺口 4b：Word 导出渲染能力不足

**现状证据**：
- `parseMarkdownToParagraphs()` L96-145 仅支持 H1-H3、加粗/斜体、无序列表
- ❌ 不解析 Markdown 表格（`|` 语法）
- ❌ 不支持有序列表
- ❌ 不支持代码块
- ❌ 不支持嵌套列表

**影响范围**：所有导出 Word 的场景。当 AI 输出包含表格（极常见）时，Word 中变成无格式纯文本。

**建议改进**：
- 使用 `marked` 库将 Markdown 解析为 AST，替代当前的逐行正则
- AST → docx 节点映射：table → `docx.Table`，ol → numbered paragraph，code block → monospace TextRun

**涉及文件**：
- `packages/backend/src/modules/runtime/export.service.ts` — 替换 parseMarkdownToParagraphs
- 新增依赖：`marked`（AST 解析）

**验收标准**：
- ✅ Markdown 表格导出为 Word 表格，带边框和表头加粗
- ✅ 有序列表导出为编号段落
- ✅ 代码块导出为等宽字体段落，带灰色背景
- ✅ 嵌套列表层级正确缩进
- ❌ 失败场景：Markdown 语法不规范时降级为纯文本段落，不报错

#### 缺口 4c：导出模板与多文件导出

**现状证据**：
- `ExportConfig.templateId` 存在但未实现
- 不支持封面/目录/页眉页脚
- 不支持多文件导出

**建议改进**（分两步）：

步骤一：模板引擎
```typescript
interface ExportTemplate {
  id: string;
  name: string;
  coverPage?: { title: string; subtitle?: string; logo?: string };
  headerFooter?: { header: string; footer: string; pageNumbers: boolean };
  styles?: { fontFamily: string; fontSize: number; margins: { top: number; bottom: number; left: number; right: number } };
  autoToc?: boolean;  // 自动生成目录
}
```

步骤二：多文件导出
```typescript
interface ExportConfig {
  // ...existing...
  multiFile?: boolean;
  fileList?: Array<{
    fileName: string;
    contentRefs: VariableRef[];
    templateId?: string;
  }>;
}
```

**涉及文件**：
- `packages/shared/src/types.ts` — 类型
- `packages/backend/src/modules/runtime/export.service.ts` — 模板渲染 + 多文件
- 新增：`packages/backend/src/modules/export-templates/` — 模板 CRUD
- `packages/backend/src/db/schema.ts` — exportTemplates 表
- `packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx` — 多文件下载 UI

**验收标准**：
- ✅ 配置模板后，导出 Word 包含封面页、自动目录、页码
- ✅ 多文件模式导出 3 个 Word 文件，每个包含指定的内容段
- ❌ 失败场景：模板缺字段时使用系统默认值，不报错

---

### 缺口 5：节点间 — 缺少条件执行能力

**现状证据**：
- `runtime.service.ts::advanceNode()` 按 stepOrder 顺序推进，无条件判断
- `skippable: true` 仅支持用户手动跳过
- 后台执行（`background.service.ts`）忽略 skippable/autoAdvance 标记，所有节点直接执行（见已知 Bug 表）

**影响范围**：所有需要"前置节点结果影响后续流程"的场景——质检阻断、降级分支、可选步骤智能跳过。

**建议改进**：

```typescript
interface NodeCondition {
  /** 引用上游节点输出，使用与变量系统相同的 VariableRef 结构 */
  sourceRef: VariableRef;    // 复用 VariableRef（含 nodeId, outputId, fieldPath）
  operator: "equals" | "not_equals" | "exists" | "not_exists" | "contains";
  value?: string;
}

interface NodeExecutionRule {
  action: "skip" | "block";
  conditions: NodeCondition[];
  logic: "and" | "or";
}
```

**运行时行为**：
- `advanceNode()` 推进到下一节点前，检查该节点的 `executionRule`
- 条件评估使用 `resolveRef()`（第二节路径解析算法），与变量引用和 contentMapping 共用同一套解析逻辑
- `skip` → 自动跳过该节点，记录 `status: "skipped"`，推进到下一节点
- `block` → 节点状态设为 `"blocked"`，前端显示阻断原因和条件来源。解除流程：
  1. 用户点击"返回修改上游"→ 复用现有 `rollbackToNode()` 回退到条件引用的上游节点。若条件引用多个不同上游节点，回退到所有 `sourceRef.nodeId` 中 stepOrder 最小的那个（即最早的上游节点），确保后续所有相关节点都能重新执行
  2. 用户修改上游节点内容并重新确认
  3. `advanceNode()` 再次推进到被 blocked 的节点时，重新评估条件
  4. 条件不再满足 → 状态从 `"blocked"` 改为 `"pending"`，正常进入执行
  5. 条件仍满足 → 保持 `"blocked"`，再次显示阻断提示
  - **不引入新的 reevaluate/resume 动作**，完全复用现有回退+重推进链路

**实现边界**：
- 条件仅支持对字符串值的简单比较，不支持数值比较或正则
- 一个节点最多一条 executionRule
- 条件评估在后台执行和前台执行中行为一致
- **依赖缺口 3**：条件引用需要多级字段路径解析能力

**涉及文件**：
- `packages/shared/src/types.ts` — NodeCondition/NodeExecutionRule 类型
- `packages/backend/src/modules/runtime/runtime.service.ts` — advanceNode 增加条件评估
- `packages/backend/src/modules/runtime/background.service.ts` — 后台执行同步支持
- `packages/backend/src/modules/workflows/validation.ts` — 校验条件引用合法性
- `packages/frontend/src/components/workflow/config/ConfigPanel.tsx` — 条件配置 UI

**验收标准**：
- ✅ 配置 `action: "skip"` + 条件满足时，节点自动跳过，执行日志记录跳过原因
- ✅ 配置 `action: "block"` + 条件满足时，前端显示阻断提示，用户不可跳过
- ✅ 后台执行模式下条件评估行为一致
- ✅ 条件引用指向未完成的上游节点时，评估结果为 false（不触发）
- ❌ 失败场景：sourceRef 路径不存在 → 条件评估为 false，记录警告日志，不阻断流程
- ❌ 默认行为：未配置 executionRule 的节点正常执行，不受影响

**新增状态值的类型变更**：

本缺口引入 `blocked` 状态，需同步修改共享类型和相关 UI：

```typescript
// types.ts — NodeExecutionStatus 扩展
export type NodeExecutionStatus =
  "pending" | "in_progress" | "completed" | "skipped" | "failed" | "blocked";
//                                                                  ^^^^^^^ 新增
```

| 涉及位置 | 修改内容 |
|---------|---------|
| `packages/shared/src/types.ts` L336 | NodeExecutionStatus 联合类型增加 `"blocked"` |
| `packages/frontend/src/pages/workspace/DocumentWorkspace.tsx` | 渲染 blocked 状态：显示阻断原因 + 条件来源 + "返回修改上游"按钮 |
| `packages/backend/src/modules/runtime/runtime.service.ts` | `advanceNode()` 中条件评估为 block 时设置 `status: "blocked"` |
| `packages/backend/src/modules/runtime/background.service.ts` | 后台执行遇到 blocked 状态时中止流水线，发送通知 |
| 前端状态标签 | blocked 节点显示红色"已阻断"标签，与 failed 区分（failed=执行错误，blocked=条件阻断） |

---

### 缺口 6：模型调用节点 — System/User Prompt 分离

**现状证据**：`ModelCallConfig.promptTemplate` 是单一字符串（`types.ts` L152），`model-call.service.ts` 将其作为单条消息发送。所有策略（`openai-compatible.strategy.ts`、`claude-agent-sdk.strategy.ts`）均接收单一 prompt 字符串。

**影响范围**：所有模型调用。大多数 AI API 区分 system/user 角色，混在一起降低指令遵循效果。管理员无法将"角色定义+格式约束"与"具体任务+数据"分开管理。

**建议改进**：

```typescript
interface ModelCallConfig {
  // ...existing...
  promptTemplate: string;              // 保留作为 User Prompt（向后兼容）
  systemPromptTemplate?: string;       // 新增：System Prompt
}
```

**实现边界**：
- 有 `systemPromptTemplate` → 拆为 `[{role:"system",...}, {role:"user",...}]` 两条消息
- 无 → 现有行为不变
- 两个模板都支持 `{{变量}}` 插值和脱敏规则注入
- 脱敏规则注入位置：system prompt 末尾（如有 system prompt）或 user prompt 开头（fallback）

**涉及文件**：
- `packages/shared/src/types.ts` — 类型
- `packages/backend/src/modules/runtime/model-call.service.ts` — 组装双消息
- `packages/backend/src/modules/runtime/strategies/*.strategy.ts` — 接收消息数组
- `packages/frontend/src/components/workflow/config/ConfigPanel.tsx` — 双文本框

**验收标准**：
- ✅ 配置 systemPromptTemplate 后，模型调用日志显示 system 和 user 两条消息
- ✅ 不配置 systemPromptTemplate 时行为不变
- ✅ 两个模板中的 `{{变量}}` 都能正确解析
- ❌ 默认行为：未配置 systemPromptTemplate 时全部内容作为 user 消息发送

---

### 缺口 7：输入转换节点 — 上传文件缺少结构化元数据提取

**现状证据**：
- `input-transform.service.ts::parseUploadedFile()` L15-78 提取纯文本
- 输出只有 `parsedText` 字符串，无结构化字段

**影响范围**：上传证书/合同/报告等结构化文档时，用户需要提取关键字段（证书编号、有效期等）。当前只能靠后续模型调用节点再从文本中提取，增加一跳延迟和不稳定性。

**建议改进**：

```typescript
interface FormFieldDef {
  // ...existing...
  fileProcessing?: {
    extractMetadata?: boolean;
    extractionModelId?: string;       // 本地模型优先
    extractionFields?: Array<{
      fieldName: string;
      description: string;
      type: "string" | "date" | "number";
    }>;
  };
}
```

**实现边界**：
- 元数据提取是可选步骤，不配置时不执行
- 元数据按文件粒度存储在 `outputData.fileSlots[slotId].fileMetadata` 数组中（依赖缺口 2 的槽位机制），结构示例：
  ```typescript
  fileSlots: {
    "evidence_pack": {
      text: "...",
      fileIds: ["f2", "f3"],
      fileNames: ["营业执照.pdf", "审计报告.pdf"],
      fileMetadata: [                    // 新增：按文件粒度
        {
          fileId: "f2",
          fileName: "营业执照.pdf",
          extractionStatus: "success",
          metadata: {
            "cert_no": "91110108...",
            "valid_until": "长期",
            "issuer": "海淀区市场监管局",
          },
        },
        {
          fileId: "f3",
          fileName: "审计报告.pdf",
          extractionStatus: "success",
          metadata: {
            "audit_year": "2024",
            "auditor": "某会计师事务所",
          },
        },
      ],
    }
  }
  ```
- 下游变量引用路径：`{{n1.evidence_pack.fileMetadata[0].metadata.cert_no}}`
- `extractMetadata` 可用于任意 `fileCountMode`（single 或 unlimited），因为结构是按文件存的
- 提取失败不阻断流程，对应文件的 `extractionStatus` 标记为 `"failed"`，metadata 为空对象

**涉及文件**：
- `packages/shared/src/types.ts` — 类型
- `packages/backend/src/modules/runtime/input-transform.service.ts` — 提取逻辑
- `packages/frontend/src/components/workspace/nodes/InputTransformExecutor.tsx` — 元数据展示/编辑

**验收标准**：
- ✅ 配置提取字段后，上传 PDF 自动提取指定字段值
- ✅ 提取结果可编辑，用户可修正 AI 提取错误
- ✅ 下游通过 `{{n1.evidence_pack.fileMetadata[0].metadata.cert_no}}` 引用提取字段
- ❌ 失败场景：提取失败 → 对应文件的 `extractionStatus` 为 `"failed"`，`metadata` 为空对象 `{}`，前端显示"提取失败，请手动填写"

---

## 四、优先级排序

> 排序依据：缺口是否阻断核心用户路径 > 影响流程类型范围 > 实现规模

| 优先级 | 缺口 | 改动规模 | 阻断性 | 通用价值 | 依赖关系 |
|--------|------|---------|--------|---------|---------|
| **P0** | #4a contentMapping 生效 | 小 | 导出无法选择内容 | 所有多节点流程 | 无 |
| **P0** | #2 文件槽位语义 | 小-中 | 多文件输入无法区分 | 所有多文件输入流程 | 无 |
| **P0** | #3 结构化输出+多产物+字段引用 | 大 | 复杂流程无法编排 | 所有多步骤流程 | 无 |
| **P0** | #1 表单字段类型扩展 | 小 | 无法收集结构化输入 | 所有文档类型 | 无 |
| **P1** | #4b Word 表格渲染 | 中 | 导出质量差 | 所有 Word 导出 | 依赖 #4a |
| **P1** | #6 System/User Prompt 分离 | 小 | 无（优化项） | 所有模型调用 | 无 |
| **P1** | #5 条件执行 | 中 | 无法做质检阻断 | 复杂流程 | 依赖 #3（字段引用） |
| **P2** | #4c 模板+多文件导出 | 大 | 无（增强项） | 专业文档场景 | 依赖 #4a |
| **P2** | #7 文件元数据提取 | 中 | 无（增强项） | 证据管理场景 | 依赖 #2（槽位） |

**推荐实施顺序**：
1. 第一批（P0，可并行）：#4a + #2 + #1 — 打通输入输出的基础管道
2. 第二批（P0）：#3 — 核心能力升级，为后续铺路
3. 第三批（P1，可并行）：#4b + #6 — 质量提升
4. 第四批（P1）：#5 — 依赖 #3 完成
5. 第五批（P2）：#4c + #7 — 按需推进

---

## 五、验证方法

每个缺口实现后的端到端验证场景：

| 缺口 | 验证场景 |
|------|---------|
| #1 表单字段 | 创建流程 → 输入节点配置 date+number+select（各带 machineKey）→ 用户执行 → 下游 `{{n1.machineKey}}` 引用正确值 |
| #2 文件槽位 | 创建流程 → 输入节点配置 2 个 file 字段各带 fileSlotId → 上传 2 个文件 → 下游 `{{n1.tender_doc}}` 和 `{{n1.evidence}}` 各自引用正确文本 |
| #3 结构化输出 | 创建流程 → 模型节点配置 namedOutputs 含 2 个 JSON 产物 → 执行 → 前端分卡片展示 → 下游 `{{n3.blueprint.chapters[0].title}}` 返回正确值 |
| #4a contentMapping | 创建流程 → 导出节点 contentMapping 引用 3 个上游输出 → 导出 Word → 验证 3 段内容按顺序出现 |
| #4b 表格渲染 | 模型输出含 Markdown 表格 → 导出 Word → 打开 Word 验证表格带边框和表头 |
| #5 条件执行 | 质检节点输出 `hasBlockingIssues:true` → 导出节点配置 block 条件 → 验证前端显示阻断提示 |
| #6 System Prompt | 配置 systemPromptTemplate → 查看模型调用日志 → 验证 system/user 双消息 |
| #7 元数据提取 | 输入节点配置提取字段 → 上传 PDF → 验证自动提取结果可编辑 → 下游引用 metadata 字段 |
