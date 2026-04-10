# AI 自动生成流程功能实施计划

> 编写日期：2026-04-10
> 状态：待评审
> 关联模块：流程管理、工作流 Builder/Validator、后台模型调用、管理端菜单与路由

---

## 一、背景与目标

### 1.1 背景

当前 IntelliFlow 的流程创建方式是：

- 管理员在流程管理页点击“新建流程”
- 仅填写文档类型、流程名称、描述
- 系统创建一个空的 `draft` 工作流
- 管理员再进入流程编辑器手工添加节点、配置输入项、提示词、导出规则

这套方式适合熟悉流程编排的管理员，但在以下场景效率较低：

- 新业务场景较多，流程模板沉淀速度不够快
- 管理员知道业务目标，但不熟悉节点级配置细节
- 输入项、文件分组、命名产物、导出映射需要重复手工配置
- 多阶段 AI 编排逻辑虽然已有成熟范式，但还没有“生成器”把这些范式快速落成草稿流程

### 1.2 目标

新增一个管理端功能“AI 自动生成流程”，让管理员填写业务意图和输入文件结构后，由后台按一套写死的、多阶段的 AI 编排流程，自动生成一个合法的、可编辑的 `draft` 工作流。

该功能的目标不是“运行一次模型帮用户随便拼个流程图”，而是：

- 先把用户需求整理为结构化流程规格
- 再由后台固定流程进行分析、蓝图设计、提示词生成、评审和修复
- 最终编译为符合 IntelliFlow 当前引擎约束的工作流
- 将生成结果落为草稿，供管理员预览和微调

### 1.3 非目标

本期不做以下内容：

- 不支持用户自由定义“AI 如何生成流程”的后台编排逻辑
- 不支持任意 DAG/分支图生成，首版仅支持系统可稳定运行的线性流程
- 不支持直接生成并自动启用 `active` 流程
- 不支持一个流程生成多个独立导出文件的复杂物理打包逻辑
- 不支持无人工确认的一键上线

---

## 二、现有系统约束

### 2.1 流程图结构约束

根据当前 `validateWorkflow()` 的规则，生成器首版必须满足：

- 工作流至少包含一个 `input_transform` 节点
- 工作流至少包含一个 `export` 节点
- 工作流必须无环
- 工作流必须是线性结构，每个节点最多一入一出
- 工作流最多只能包含一个 `desensitize` 节点
- 若包含脱敏，则其下游必须有对应 `restore` 节点

这意味着首版 AI 生成器不能直接产出任意复杂图，而应产出受控模板：

`输入转换 -> 信息脱敏 -> 若干模型调用阶段 -> 信息恢复 -> 可选后处理阶段 -> 文件导出`

### 2.2 工作流数据结构约束

当前 `workflows` 表直接持久化：

- `nodes`
- `edges`
- `status`
- `schemaVersion`

节点配置结构由共享类型定义，当前生成器必须遵守：

- 输入项定义使用 `FormFieldDef`
- 模型调用节点使用 `ModelCallConfig`
- 导出节点使用 `ExportConfig`
- 导出内容来自上游 `VariableRef[]`

### 2.3 可复用能力

当前系统已经具备以下可复用能力：

- Demo workflow 的 blueprint -> workflow 编译器
- 工作流结构校验器
- 后台模型调用服务，支持多模型并行
- 模型调用日志
- 后台异步任务执行范式
- 管理端菜单、路由、工作流管理页、流程编辑器

本方案应优先复用这些能力，而不是重新发明一套流程引擎。

---

## 三、功能定义

### 3.1 菜单与入口

新增管理端菜单：

- 菜单名称：`AI 自动生成流程`
- 路由建议：`/admin/workflow-ai`

入口方式建议有两种：

- 侧边栏管理区新增独立菜单入口
- 在“流程管理”页的“新建流程”按钮旁边新增“AI 生成流程”按钮

### 3.2 用户价值

管理员通过一个向导页完成以下事情：

- 说明这个流程是干什么的
- 定义用户需要输入的文件组和文件项
- 描述输出目标、风格、限制、是否涉及敏感信息
- 提交后等待后台生成
- 查看生成摘要、节点结构、输入项、命名产物和导出内容
- 生成草稿流程并进入编辑器微调

### 3.3 输出结果

功能成功后输出的不是一段文本，而是：

- 一个新的 `draft` 工作流
- 一份生成任务记录
- 一份可追踪的中间蓝图和评审报告
- 一组模型调用日志，便于后续排查

---

## 四、用户输入模型

### 4.1 必填字段

管理员在向导中至少需要填写：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `documentTypeId` | 选择 | 是 | 所属文档类型 |
| `workflowName` | 文本 | 是 | 流程名称 |
| `workflowGoal` | 长文本 | 是 | 流程最终要生成什么文档、给谁用、使用场景 |
| `mainPrompt` | 长文本 | 是 | 业务目标、风格、边界、输出偏好 |
| `fileGroups` | 数组 | 是 | 输入文件分组定义 |
| `exportFormats` | 多选 | 是 | 最终导出格式 |

### 4.2 文件分组结构

每个文件分组建议包含：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `groupId` | string | 是 | 前端临时 ID |
| `groupName` | string | 是 | 组名，如“项目基础材料” |
| `groupDescription` | string | 是 | 组的用途说明 |
| `required` | boolean | 是 | 是否必填组 |
| `priority` | enum | 否 | `high` / `medium` / `low` |
| `files` | array | 是 | 组内文件项 |

### 4.3 文件项结构

每个文件项建议包含：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `fileId` | string | 是 | 前端临时 ID |
| `name` | string | 是 | 文件项名称 |
| `description` | string | 是 | 文件项用途说明 |
| `direction` | enum | 是 | `input` 或 `output` |
| `required` | boolean | 是 | 是否必填 |
| `fileCountMode` | enum | 是 | `single` 或 `unlimited` |
| `acceptedFileTypes` | string[] | 否 | 允许扩展名 |

### 4.4 建议新增字段

为保证 AI 能稳定生成可用流程，建议在表单中补充以下字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sensitiveDataLevel` | enum | 否 | `none` / `likely` / `high`，决定是否强制插入脱敏链路 |
| `desiredArtifacts` | array | 否 | 希望产出的中间命名产物，如“蓝图”“风险清单”“章节草稿” |
| `referenceStyle` | 长文本 | 否 | 风格参考、语言要求、术语要求 |
| `hardConstraints` | 长文本 | 否 | 禁止编造、必须保留字段、合规边界 |
| `qualityMode` | enum | 否 | `fast` / `standard` / `strict` |
| `defaultWorkflowCandidate` | boolean | 否 | 是否希望后续作为默认流程候选 |
| `templatePreference` | enum | 否 | `none` / `word` / `pptx` / `mixed` |
| `referenceMaterials` | 上传/引用 | 否 | 参考模板、示例流程说明、已有文档 |

### 4.5 关于“输出文件”的解释

用户可能会把某些文件项标记为“输出”。首版必须统一语义，避免系统行为不确定：

- `input`：表示用户在运行时上传的输入文件
- `output`：表示希望流程中产生的命名产物或最终导出内容片段

首版不把 `output` 解释为“生成多个物理文件并分别导出”。原因：

- 当前系统的工作流终点是单一 `export` 节点
- 导出逻辑本质上是从上游 `contentMapping` 选择内容组合成一个导出产物

因此，首版 UI 应明确提示：

> 标记为“输出”的文件项会被解释为流程中的命名产物或导出内容目标，而不是多个独立文件打包导出。

---

## 五、生成结果的目标结构

### 5.1 生成器内部不直接产出 nodes/edges

后台固定 AI 流程应先生成一个中间蓝图 `WorkflowBlueprintDraft`，再由编译器落为正式工作流。

这样做的原因：

- AI 输出更容易约束
- 更容易做结构化评审和修复
- 更容易复用现有 builder 能力
- 降低直接生成非法 workflow 的概率

### 5.2 建议的中间蓝图结构

```ts
interface WorkflowGenerationRequest {
  documentTypeId: string;
  workflowName: string;
  workflowGoal: string;
  mainPrompt: string;
  fileGroups: FileGroupSpec[];
  exportFormats: Array<"word" | "pdf" | "markdown" | "pptx">;
  sensitiveDataLevel?: "none" | "likely" | "high";
  desiredArtifacts?: string[];
  referenceStyle?: string;
  hardConstraints?: string;
  qualityMode?: "fast" | "standard" | "strict";
  templatePreference?: "none" | "word" | "pptx" | "mixed";
}

interface WorkflowBlueprintDraft {
  description: string;
  inputFields: FormFieldDef[];
  useDesensitize: boolean;
  preRestoreStages: StageDraft[];
  restoreSources: RestoreSourceDraft[];
  postRestoreStages: StageDraft[];
  exportPlan: ExportPlanDraft;
  warnings: string[];
  assumptions: string[];
}

interface StageDraft {
  id: string;
  label: string;
  displayName: string;
  mission: string;
  modelMode: "single" | "compare";
  promptTemplate: string;
  systemPromptTemplate?: string;
  namedOutputs: NamedOutputDef[];
  stepDescription?: string;
  executionRuleHint?: unknown;
}
```

### 5.3 目标流程模板

首版统一收敛到如下逻辑模板：

1. `node_input`
2. `node_desens`（按需）
3. `stage_1 ... stage_n`
4. `node_restore`（若有脱敏）
5. `stage_post_1 ... stage_post_n`（按需）
6. `node_export`

---

## 六、后台固定 AI 编排流程

### 6.1 总体原则

后台编排必须是系统写死的，不开放给用户配置。其职责是把用户需求从“自然语言 + 文件分组”转换为“可运行工作流草稿”。

该编排不是一次模型调用，而是固定的多阶段流水线。

### 6.2 推荐阶段

#### 阶段 0：请求归一化

由代码完成，不走 AI：

- 校验必填字段
- 清洗空白字符
- 将组名/文件名转成安全的 `machineKey`
- 推断默认 `acceptedFileTypes`
- 将“输出文件项”转成候选命名产物需求
- 生成标准化 `NormalizedGenerationRequest`

#### 阶段 1：需求分析

目标：

- 提炼业务目标
- 判断流程复杂度
- 判断是否需要脱敏链路
- 判断是否需要多阶段生成而不是单阶段生成
- 判断哪些输入项应为文本字段，哪些应为文件字段

输出：

- `intentSummary`
- `inputStrategy`
- `artifactStrategy`
- `riskList`

#### 阶段 2：蓝图架构生成

目标：

- 生成 `inputFields`
- 设计 pre-restore stages
- 设计 restore sources
- 设计 post-restore stages
- 设计 export plan

要求：

- 明确每个 stage 的单一职责
- 每个 stage 的 named outputs 不重复
- export plan 只引用最终需要导出的内容
- 保证流程仍是线性链路

输出：

- `WorkflowBlueprintDraft`

#### 阶段 3：提示词与产物细化

目标：

- 为每个阶段生成系统提示词和主提示词
- 为每个命名产物补齐 `outputPrompt`
- 需要 JSON 输出时补齐 `simpleFields` 或 `jsonSchema`
- 补齐 `stepDescription`

输出：

- `EnrichedWorkflowBlueprint`

#### 阶段 4：结构评审

目标：

- 使用第二套模型对蓝图进行结构评审
- 不做编译，只检查结构合理性

检查维度：

- 输入项是否覆盖用户需求
- 文件分组是否被正确映射
- 命名产物是否冗余或缺失
- prompt 是否存在空泛或自相矛盾描述
- export plan 是否遗漏关键内容
- 是否违反当前流程引擎约束

输出：

- `reviewReport`
- `revisionInstructions`

#### 阶段 5：蓝图修订

目标：

- 根据评审意见修订蓝图
- 最多 1 到 2 轮

输出：

- `FinalBlueprint`

#### 阶段 6：确定性编译

由代码完成，不走 AI：

- 将 `FinalBlueprint` 编译为 `nodes/edges`
- 复用现有 demo workflow builder 的思路
- 统一插入脱敏节点、恢复节点、导出节点
- 补充节点位置、输出定义、导出映射

输出：

- `CompiledWorkflowDraft`

#### 阶段 7：校验与修复闭环

由代码 + AI 协同完成：

- 调用 `validateWorkflow()`
- 若校验通过，结束
- 若校验失败，将错误转成结构化修复任务
- 让修复 AI 修改蓝图而不是直接改最终 workflow
- 重新编译并再次校验
- 最大修复轮数建议 2 到 3 轮

输出：

- `validatedWorkflow`
- `validationReport`

#### 阶段 8：落库与摘要生成

由代码完成：

- 创建 `draft` workflow
- 保存 job 中间产物
- 输出摘要给前端

摘要内容建议包括：

- 生成的输入项列表
- 文件组映射结果
- 阶段节点摘要
- 命名产物摘要
- 导出格式与导出内容摘要
- 风险与假设

---

## 七、模型策略

### 7.1 首版推荐策略

不同阶段使用不同模型角色，而不是“同一个 AI 一路跑到底”：

- 需求分析模型：偏理解与抽象
- 蓝图设计模型：偏结构规划
- 提示词细化模型：偏文案与输出格式控制
- 评审模型：偏审查与找错
- 修复模型：偏结构修补

### 7.2 推荐运行方式

优先使用现有后台模型调用框架和 provider 配置能力：

- 分析/蓝图/提示词/评审可使用云端模型
- 若选择支持 Agent SDK 的模型，可在个别阶段使用 `autonomous_agent`
- 但首版不建议把整个生成器都建立在 agent file tool 行为上

原因：

- 当前工作流生成是结构化产物生成，不是开放式代码任务
- 结构化 API 调用更稳定、成本更可控
- 只有在“复杂提示词修订”或“蓝图修复”阶段，Agent 模式才可能有明显收益

### 7.3 推荐的首版模型编排

- 阶段 1-3：`simple_chat`
- 阶段 4：第二个模型或第二组模型做 review
- 阶段 5：根据 review 结果做修订
- 修复失败时，不自动无限重试，交由人工查看报告

---

## 八、数据存储设计

### 8.1 为什么需要单独 Job 表

本功能的后台任务比现有文档生成任务更需要保存中间产物：

- 原始请求
- 归一化请求
- 蓝图
- 评审报告
- 编译结果
- 校验结果

现有 `background_tasks` 更偏通用进度记录，不适合直接承载大量结构化中间数据。

### 8.2 新表建议

建议新增：

`workflow_generation_jobs`

建议字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `createdBy` | uuid | 创建人 |
| `documentTypeId` | uuid | 所属文档类型 |
| `workflowName` | varchar | 目标流程名 |
| `status` | enum | `queued/running/completed/failed/review_needed` |
| `progress` | int | 进度百分比 |
| `requestPayload` | jsonb | 原始请求 |
| `normalizedRequest` | jsonb | 归一化请求 |
| `intentSummary` | jsonb | 需求分析结果 |
| `blueprintDraft` | jsonb | 初版蓝图 |
| `reviewReport` | jsonb | 评审结果 |
| `finalBlueprint` | jsonb | 修订后蓝图 |
| `compiledWorkflow` | jsonb | 编译结果 |
| `validationReport` | jsonb | 校验结果 |
| `generatedWorkflowId` | uuid | 成功后生成的 workflow ID |
| `errorMessage` | varchar | 失败信息 |
| `createdAt` | timestamp | 创建时间 |
| `updatedAt` | timestamp | 更新时间 |

### 8.3 模型调用日志扩展

建议为 `modelCallLogs.callSource` 增加：

- `workflow_generation`

目的：

- 在模型调用日志中区分“运行时生成文档”和“后台生成流程”
- 后续便于统计成本、定位失败原因、回看 prompt 链路

---

## 九、后端模块设计

### 9.1 模块目录建议

新增模块：

`packages/backend/src/modules/workflow-generator/`

建议文件：

- `workflow-generator.routes.ts`
- `workflow-generator.service.ts`
- `workflow-generator.orchestrator.ts`
- `workflow-generator.compiler.ts`
- `workflow-generator.validation-fix.ts`
- `workflow-generator.prompts.ts`
- `workflow-generator.types.ts`

### 9.2 组件职责

#### `routes`

负责：

- 创建生成任务
- 查询任务详情
- 查询任务列表
- 将生成结果落为 workflow
- 触发重试或重新生成

#### `service`

负责：

- job 增删改查
- 状态流转
- 摘要格式化

#### `orchestrator`

负责：

- 按固定阶段编排整个 AI 生成流程
- 管理阶段性进度
- 串联模型调用与结构化产物

#### `compiler`

负责：

- 从蓝图编译 `nodes/edges`
- 复用现有 builder 设计
- 统一补节点位置、输出定义、导出映射

#### `validation-fix`

负责：

- 调用校验器
- 将错误转成修复任务
- 控制修复轮次

#### `prompts`

负责：

- 存放每个生成阶段的系统提示词和模板
- 将产品规则写死在代码中，避免散落

---

## 十、API 设计

### 10.1 创建任务

`POST /workflow-generator/jobs`

请求体：

```json
{
  "documentTypeId": "uuid",
  "workflowName": "招投标自动生成流程",
  "workflowGoal": "生成招投标相关文档",
  "mainPrompt": "根据用户上传材料生成结构化投标文档流程",
  "fileGroups": [],
  "exportFormats": ["word", "pdf"],
  "sensitiveDataLevel": "high",
  "desiredArtifacts": ["blueprint", "risk_list", "draft_sections"],
  "referenceStyle": "正式、企业内部交付风格",
  "hardConstraints": "不得编造事实，必须保留关键字段"
}
```

响应：

```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

### 10.2 查询任务详情

`GET /workflow-generator/jobs/:id`

返回：

- job 基础状态
- 进度
- 阶段名称
- 生成摘要
- 警告与假设
- 生成出的 workflow 概览

### 10.3 查询任务列表

`GET /workflow-generator/jobs`

用于管理端查看近期生成记录。

### 10.4 生成草稿流程

如果任务完成但尚未落 workflow，可提供：

`POST /workflow-generator/jobs/:id/create-workflow`

如果编排完成时就直接落 workflow，也可以省略该接口，只在创建任务后最终返回 `generatedWorkflowId`。

### 10.5 重新生成

`POST /workflow-generator/jobs/:id/regenerate`

用途：

- 保留原输入
- 重新跑生成链路
- 便于管理员在小范围修改后重试

---

## 十一、前端页面设计

### 11.1 页面结构

新页面建议分为三段：

#### A. 创建向导区

包含：

- 基础信息
- 流程目标
- 主提示词
- 文件分组与文件项编辑器
- 附加约束与质量档位
- 导出格式配置

#### B. 任务状态区

提交后显示：

- 当前阶段
- 整体进度
- 最近错误
- 重试按钮

#### C. 生成结果预览区

显示：

- 流程描述
- 输入项列表
- 阶段节点列表
- 每个阶段的命名产物
- 导出内容
- 警告与假设

### 11.2 关键交互

- 文件分组支持增删改排序
- 文件项支持增删改
- 提交后轮询任务状态
- 任务完成后显示“创建草稿并进入编辑器”
- 若后台已直接创建 workflow，则显示“进入流程编辑器”

### 11.3 与现有流程管理页的关系

建议保留现有“新建流程”弹窗不变，用于空流程创建。

新增入口单独负责：

- 面向 AI 生成
- 承载更复杂表单
- 承载任务状态和生成预览

这样能避免把 `WorkflowManagement` 当前的轻弹窗做成过重的多步骤流程。

---

## 十二、编译规则设计

### 12.1 输入字段生成规则

文件组和文件项需要映射到 `FormFieldDef[]`：

- `input` 文件项 -> `type: "file"`
- 文本类基础字段 -> `type: "text"` 或 `textarea`
- 必填标记映射到 `required`
- 文件数量映射到 `fileCountMode`
- 允许类型映射到 `acceptedFileTypes`
- `machineKey`、`fileSlotId`、`fileSlotLabel` 由系统生成

### 12.2 阶段节点生成规则

每个 stage 必须满足：

- 有稳定的 `id`
- 有清晰的 `label` 和 `displayName`
- promptTemplate 不为空
- namedOutputs 中每个 `id` 唯一且合法
- 若输出为 JSON，应明确 `simpleFields` 或 `jsonSchema`

### 12.3 恢复源生成规则

若启用脱敏：

- 优先让 `restoreSources` 指向需要被导出的命名产物
- 避免把所有中间产物都恢复，减少不必要的恢复步骤
- 恢复后的内容才应进入最终导出映射

### 12.4 导出映射规则

`export.contentMapping` 只选择真正需要进入最终文档的内容：

- 正文主产物
- 必要附加产物
- 质检报告不默认进入导出
- 风险提示、缺失信息通常用于管理端预览，不直接导出

### 12.5 导出格式规则

首版支持：

- `word`
- `pdf`
- `markdown`
- `pptx`

但生成器需要根据场景做保守推荐：

- 正式文档类优先 `word` + `pdf`
- 技术草稿类可包含 `markdown`
- 演示场景可包含 `pptx`

---

## 十三、失败处理与人工介入

### 13.1 失败类型

生成任务失败主要分为：

- 请求不合法
- 模型调用失败
- 蓝图结构不合法
- 修复轮次耗尽
- 落库失败

### 13.2 处理原则

- 所有失败都必须有 job 记录
- 必须保留中间产物，便于排查
- 不自动无限重试
- 失败时前端显示“查看错误摘要”和“重新生成”

### 13.3 人工介入路径

若任务生成失败，但已经有较完整蓝图，可提供后续能力：

- 仅展示蓝图报告，不创建 workflow
- 管理员调整输入后重跑
- 后续版本可支持“将失败蓝图导入编辑器手工修正”

---

## 十四、测试计划

### 14.1 单元测试

至少覆盖：

- 请求归一化
- `machineKey/fileSlotId` 生成
- blueprint -> workflow 编译
- 命名产物 ID 唯一性处理
- 导出映射生成
- validation error -> repair instruction 转换

### 14.2 集成测试

至少覆盖：

- 创建 job -> 完成 -> 创建 workflow
- 创建 job -> 校验失败 -> 修复 -> 成功
- 创建 job -> 模型失败 -> job 标记失败
- 生成出的 workflow 可以通过现有 `validateWorkflow()`

### 14.3 前端测试

至少覆盖：

- 表单校验
- 文件分组与文件项增删改
- 提交任务
- 轮询与状态展示
- 生成结果预览
- 跳转编辑器

### 14.4 人工验收要点

- 能否稳定生成合法 workflow
- 输入项是否符合用户表单预期
- 命名产物和导出内容是否可理解
- 生成的流程是否便于进入编辑器继续修改
- 错误信息是否足够排查

---

## 十五、实施阶段

### Phase 1：数据结构与后端骨架

范围：

- 新增 job 表
- 新增模块目录
- 定义请求类型、蓝图类型、任务状态
- 扩展 `callSource`

交付：

- 数据库迁移
- 后端空路由和 service 骨架

### Phase 2：蓝图生成链路

范围：

- 请求归一化
- 需求分析 prompt
- 蓝图生成 prompt
- 提示词细化 prompt

交付：

- 能产出 `FinalBlueprint`

### Phase 3：编译器与校验修复

范围：

- blueprint -> workflow 编译器
- 调用现有 validator
- 修复闭环

交付：

- 能稳定产出合法 workflow draft

### Phase 4：前端向导页

范围：

- 新菜单
- 新路由
- 创建表单
- 任务状态轮询
- 结果预览

交付：

- 管理员可在 UI 上完成提交和预览

### Phase 5：落库与编辑器打通

范围：

- 创建 `draft` workflow
- 返回 workflow ID
- 跳转到现有编辑器

交付：

- 生成后可直接进入 `/admin/workflows/:id/edit`

### Phase 6：测试与调优

范围：

- 单测
- 集成测试
- 人工验收
- prompt 调优

交付：

- 首版上线候选

---

## 十六、关键决策

### 16.1 首版只支持已有文档类型

原因：

- 当前 workflow 与 `documentTypeId` 强绑定
- 同时生成“新文档类型 + 新流程”会明显扩大范围

### 16.2 首版只生成 `draft`

原因：

- AI 生成流程仍需人工审核
- 当前启用前已有 workflow validation 和管理动作，流程清晰

### 16.3 首版只支持受控线性蓝图

原因：

- 当前 validator 明确要求线性结构
- 复杂 DAG 会显著提高失败率和调试成本

### 16.4 首版将“输出文件项”解释为命名产物需求

原因：

- 当前导出模型是单导出节点
- 可复用现有 content mapping 机制

### 16.5 后台编排应先蓝图后编译

原因：

- 便于 review
- 便于 repair
- 便于测试

---

## 十七、主要风险

| 风险 | 说明 | 应对 |
|---|---|---|
| AI 产出结构不稳定 | 直接生成 workflow 容易非法 | 采用蓝图中间层 + validator repair |
| 提示词过泛 | 生成出来阶段职责不清 | 固定阶段模板，强化命名产物约束 |
| 用户输入歧义大 | 文件组和输出目标解释不一致 | 表单文案明确，提交前预检查 |
| 后台成本偏高 | 多阶段多模型调用成本上升 | 设置质量档位和修复轮次上限 |
| 与现有模型能力不匹配 | 本地/云端模型能力差异大 | 先用云端模型为主，后续再分层优化 |
| 任务排查困难 | 中间状态不可见 | 单独 job 表保存中间产物 |

---

## 十八、验收标准

功能满足以下条件即可认为首版完成：

1. 管理端存在独立入口“AI 自动生成流程”
2. 管理员可提交包含文件分组和文件项的完整请求
3. 后台按固定多阶段 AI 流程生成蓝图、评审、修复并落草稿流程
4. 生成出的 workflow 能通过现有 `validateWorkflow()`
5. 前端能展示任务状态、生成摘要和预览结果
6. 管理员可从结果页跳转到流程编辑器继续调整
7. 失败任务可查看错误摘要并重新生成
8. 关键逻辑具备单测和集成测试

---

## 十九、建议的首批实现顺序

为降低风险，建议开发顺序如下：

1. 先做后端类型、job 表和空 API
2. 再做请求归一化和 blueprint 编译器
3. 接入 AI 生成阶段
4. 接入 validation repair
5. 最后做前端向导和预览页

不要反过来先做 UI，因为生成器成败的核心在于：

- 输入模型是否稳定
- 蓝图是否可编译
- 校验修复闭环是否可靠

---

## 二十、待确认问题

以下问题建议在开发前确认：

1. 首版是否允许在生成页选择 Word/PPT 模板偏好，还是仅生成 workflow，不绑定模板
2. 首版是否要支持引用已有流程作为风格参考
3. 首版是否允许用户编辑 AI 生成出的流程描述后再落库
4. 首版 job 结果是否需要长期保留，还是保留最近 N 天
5. 首版是否要求统计单次生成成本与模型耗时

---

## 二十一、结论

本功能适合按“受控蓝图生成器”而不是“自由流程生成器”来实现。

正确的实现路径是：

- 新增独立管理入口
- 定义完整输入模型
- 用后台固定多阶段 AI 编排生成蓝图
- 通过确定性编译器生成 workflow
- 使用现有 validator 做闭环修复
- 最终只落 `draft`，再交由管理员进入编辑器确认

这样既能复用 IntelliFlow 当前成熟的工作流引擎能力，也能把 AI 引入到“加速搭建流程”这一高价值环节，同时把风险控制在当前系统约束范围内。
