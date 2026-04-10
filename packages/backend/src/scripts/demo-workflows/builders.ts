import type {
  FormFieldDef,
  NamedOutputDef,
  NodeConfig,
  NodeExecutionRule,
  OutputDef,
  SimpleFieldDef,
  VariableRef,
  WorkflowEdgeDef,
  WorkflowNodeDef,
} from "@intelliflow/shared";

export type DeploymentType = "cloud" | "local";

export interface AvailableModel {
  id: string;
  displayName: string;
  deploymentType: DeploymentType;
  providerType: string;
  providerName: string;
}

export interface DemoModelSelection {
  desensitize: AvailableModel;
  primaryCloud: AvailableModel;
  secondaryCloud: AvailableModel;
  compareClouds: AvailableModel[];
}

export interface DemoDocumentTypeDefinition {
  code: string;
  name: string;
  description: string;
}

export interface DemoWorkflowDefinition {
  documentTypeCode: string;
  name: string;
  description: string;
  isDefault: boolean;
  category: "flagship" | "medium";
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
}

export interface PromptSection {
  title: string;
  content: string;
}

export interface StageSpec {
  id: string;
  label: string;
  displayName: string;
  promptTemplate: string;
  namedOutputs?: NamedOutputDef[];
  outputFormat?: "text" | "json" | "markdown";
  executionRule?: NodeExecutionRule;
  stepDescription?: string;
  systemPromptTemplate?: string;
  modelMode?: "single" | "compare";
}

export interface RestoreSourceSpec {
  sourceNodeId: string;
  outputId: string;
  displayName: string;
}

export interface WorkflowBlueprint {
  inputFields: FormFieldDef[];
  preRestoreStages: StageSpec[];
  restoreSources: RestoreSourceSpec[];
  postRestoreStages?: StageSpec[];
  exportRule?: NodeExecutionRule;
  exportFormats?: Array<"word" | "pdf" | "markdown">;
}

const X_STEP = 300;
const DEFAULT_FILE_TYPES = [".pdf", ".doc,.docx", ".xls,.xlsx", ".md", ".txt"];

const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0,
  openai_compatible: 1,
  claude_agent_sdk: 2,
  ollama: 3,
};

const LOCAL_MODEL_PRIORITY = [
  "Gamma4:27b",
  "Gemma 4 27b",
  "Gemma4:27b",
  "Gemma 4 26b",
  "Gemma 4 31b",
  "Qwen3 32B",
  "Qwen3.5 35B",
];
const CLOUD_MODEL_PRIORITY = [
  "MiniMax M2.5",
  "Kimi K2.5",
  "GLM 4.7",
  "DeepSeek V3.2",
  "Doubao Seed 2.0 Pro",
];

function normalizeModelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelNameMatches(actual: string, expected: string): boolean {
  const normalizedActual = normalizeModelName(actual);
  const normalizedExpected = normalizeModelName(expected);
  return (
    normalizedActual === normalizedExpected ||
    normalizedActual.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedActual)
  );
}

const DESENSITIZE_CATEGORIES = [
  { name: "公司名", description: "公司、组织或部门名称" },
  { name: "人名", description: "姓名、联系人或审批人信息" },
  { name: "金额", description: "报价、预算、合同金额等数值" },
  { name: "地址", description: "办公地点、实施地点、寄送地址等" },
  { name: "联系方式", description: "手机号、邮箱、即时通讯账号" },
  { name: "设备编号", description: "序列号、资产编号、机柜或设备标识" },
  { name: "银行账号", description: "银行账号、开户信息" },
] as const;

function byProviderPriority(a: AvailableModel, b: AvailableModel): number {
  const left = PROVIDER_PRIORITY[a.providerType] ?? 99;
  const right = PROVIDER_PRIORITY[b.providerType] ?? 99;
  if (left !== right) return left - right;
  return a.displayName.localeCompare(b.displayName, "zh-CN");
}

function pickPreferredModel(
  models: AvailableModel[],
  priority: string[],
  usedIds: Set<string>,
): AvailableModel | null {
  const sorted = [...models].sort(byProviderPriority);
  for (const displayName of priority) {
    const match = sorted.find(
      (model) => modelNameMatches(model.displayName, displayName) && !usedIds.has(model.id),
    );
    if (match) return match;
  }

  return sorted.find((model) => !usedIds.has(model.id)) ?? null;
}

function pickPreferredModels(
  models: AvailableModel[],
  priority: string[],
  desiredCount: number,
): AvailableModel[] {
  const picked: AvailableModel[] = [];
  const usedIds = new Set<string>();

  while (picked.length < desiredCount) {
    const match = pickPreferredModel(models, priority, usedIds);
    if (!match) break;
    picked.push(match);
    usedIds.add(match.id);
  }

  return picked;
}

export function resolveDemoModels(availableModels: AvailableModel[]): DemoModelSelection {
  const localModels = availableModels.filter((model) => model.deploymentType === "local");
  const cloudModels = availableModels.filter((model) => model.deploymentType === "cloud");

  if (localModels.length === 0) {
    throw new Error("未找到可用本地模型：脱敏节点至少需要 1 个 local 模型");
  }
  if (cloudModels.length < 2) {
    throw new Error("未找到足够的云端模型：文档生成至少需要 2 个 cloud 模型");
  }

  const usedIds = new Set<string>();

  const desensitize =
    pickPreferredModel(localModels, LOCAL_MODEL_PRIORITY, usedIds) ??
    (() => {
      throw new Error("未找到符合要求的脱敏模型");
    })();
  usedIds.add(desensitize.id);

  const primaryCloud =
    pickPreferredModel(cloudModels, CLOUD_MODEL_PRIORITY, new Set<string>()) ??
    (() => {
      throw new Error("未找到符合要求的主云端模型");
    })();

  const compareClouds = pickPreferredModels(
    cloudModels,
    CLOUD_MODEL_PRIORITY,
    Math.min(3, cloudModels.length),
  );
  if (compareClouds.length < 2) {
    throw new Error("未找到足够的多模型复核模型");
  }

  const secondaryCloud =
    pickPreferredModel(cloudModels, CLOUD_MODEL_PRIORITY, new Set<string>([primaryCloud.id])) ??
    compareClouds[1];

  return {
    desensitize,
    primaryCloud,
    secondaryCloud,
    compareClouds,
  };
}

export function textField(machineKey: string, label: string, required = false): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "text",
    required,
  };
}

export function textareaField(machineKey: string, label: string, required = false): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "textarea",
    required,
  };
}

export function dateField(machineKey: string, label: string, required = false): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "date",
    required,
  };
}

export function datetimeField(machineKey: string, label: string, required = false): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "datetime",
    required,
  };
}

export function numberField(machineKey: string, label: string, required = false): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "number",
    required,
  };
}

export function selectField(
  machineKey: string,
  label: string,
  options: string[],
  required = false,
  defaultValue?: string,
): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "select",
    required,
    options,
    defaultValue,
  };
}

export function multiselectField(
  machineKey: string,
  label: string,
  options: string[],
  required = false,
  defaultValues?: string[],
): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "multiselect",
    required,
    options,
    defaultValues,
  };
}

export function fileField(
  machineKey: string,
  label: string,
  required = false,
  fileCountMode: "single" | "unlimited" = "single",
  acceptedFileTypes: string[] = DEFAULT_FILE_TYPES,
): FormFieldDef {
  return {
    id: `field_${machineKey}`,
    machineKey,
    label,
    type: "file",
    required,
    fileCountMode,
    acceptedFileTypes,
    fileSlotId: machineKey,
    fileSlotLabel: label,
  };
}

export function markdownArtifact(id: string, name: string, outputPrompt: string): NamedOutputDef {
  return {
    id,
    name,
    format: "markdown",
    outputPrompt,
  };
}

export function textArtifact(id: string, name: string, outputPrompt: string): NamedOutputDef {
  return {
    id,
    name,
    format: "text",
    outputPrompt,
  };
}

export function jsonArtifact(
  id: string,
  name: string,
  outputPrompt: string,
  simpleFields?: SimpleFieldDef[],
): NamedOutputDef {
  return {
    id,
    name,
    format: "json",
    outputPrompt,
    simpleFields,
  };
}

export function buildQaArtifacts(): NamedOutputDef[] {
  return [
    markdownArtifact(
      "qa_report",
      "质检报告",
      "输出 Markdown，包含：整体结论、通过项、阻断项、修改建议。请明确标注 PASS/WARNING/FAIL。",
    ),
    jsonArtifact(
      "issue_list",
      "问题清单",
      "输出 JSON 数组，每项包含 issue_id, severity, category, description, suggestion。",
    ),
    jsonArtifact(
      "qa_gate",
      "质检门",
      "输出 JSON 对象，字段固定为 can_export(boolean), blocking_count(number), reason(string)。存在阻断项时 can_export=false。",
      [
        {
          name: "can_export",
          type: "boolean",
          required: true,
          description: "是否允许导出",
        },
        {
          name: "blocking_count",
          type: "number",
          required: true,
          description: "阻断问题数量",
        },
        {
          name: "reason",
          type: "string",
          required: true,
          description: "门控结论",
        },
      ],
    ),
  ];
}

export function clarificationSignalArtifact(): NamedOutputDef {
  return jsonArtifact(
    "clarification_signal",
    "澄清路由信号",
    "输出 JSON 对象，字段 fixed 为 needed(boolean), reason(string)。只有确实需要额外澄清时 needed=true。",
    [
      {
        name: "needed",
        type: "boolean",
        required: true,
        description: "是否需要进入议价澄清环节",
      },
      {
        name: "reason",
        type: "string",
        required: true,
        description: "触发原因",
      },
    ],
  );
}

export function lines(...parts: Array<string | undefined | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join("\n");
}

export function promptSection(title: string, content: string): PromptSection {
  return { title, content };
}

export function buildRolePrompt(params: {
  role: string;
  mission: string;
  sections: PromptSection[];
  extraRules?: string[];
  closing?: string;
}): string {
  const rules = [
    "严格基于用户输入和上游结论，不编造未提供的事实。",
    "若信息不足，请直接写“待确认”或“需补充材料”，不要发明占位符。",
    "若上下文中仍出现双花括号占位符、null、undefined 或明显缺失标记，将其视为未提供，不要原样抄回结果。",
    "若上下文中出现 [PERSON_NAME_1]、[COMPANY_2] 等脱敏占位符，请原样保留，不要自行恢复。",
    "输出面向内部正式交付，不要写“以下是结果”“示例”“说明”等元提示。",
    ...(params.extraRules ?? []),
  ];

  const sectionText = params.sections
    .map((section) => `## ${section.title}\n${section.content.trim()}`)
    .join("\n\n");

  return [
    `你是公司内部文档 Agent 流程中的【${params.role}】。`,
    params.mission.trim(),
    "",
    "请遵循以下执行原则：",
    ...rules.map((rule) => `- ${rule}`),
    "",
    sectionText,
    "",
    params.closing ?? "请按系统要求返回全部产物，不要额外解释。",
  ].join("\n");
}

export function buildSystemPrompt(role: string): string {
  return [
    `你是内部文档 Agent 网络中的【${role}】。`,
    "你的任务是基于给定材料产出可以直接进入企业内部文档流转的结果。",
    "禁止编造事实，禁止泄露或恢复脱敏值，禁止输出与任务无关的解释。",
  ].join("\n");
}

export function inputVar(outputId: string, fieldPath?: string): string {
  return templateVar("node_input", outputId, fieldPath);
}

export function templateVar(nodeId: string, outputId: string, fieldPath?: string): string {
  return `{{${nodeId}.${outputId}${fieldPath ? `.${fieldPath}` : ""}}}`;
}

export function restoreVar(sourceNodeId: string, outputId: string): string {
  return `{{node_restore.${sourceNodeId}.${outputId}}}`;
}

export function modelOutputVar(nodeId: string, modelId: string): string {
  return templateVar(nodeId, modelId);
}

export function conditionRef(nodeId: string, outputId: string, fieldPath?: string): VariableRef {
  return {
    nodeId,
    outputId,
    variableName: `${nodeId}.${outputId}${fieldPath ? `.${fieldPath}` : ""}`,
    fieldPath,
  };
}

export function skipWhen(rule: {
  logic: "and" | "or";
  conditions: Array<{
    sourceRef: VariableRef;
    operator: "equals" | "not_equals" | "exists" | "not_exists" | "contains";
    value?: string;
  }>;
}): NodeExecutionRule {
  return {
    action: "skip",
    logic: rule.logic,
    conditions: rule.conditions,
  };
}

export function blockWhen(rule: {
  logic: "and" | "or";
  conditions: Array<{
    sourceRef: VariableRef;
    operator: "equals" | "not_equals" | "exists" | "not_exists" | "contains";
    value?: string;
  }>;
}): NodeExecutionRule {
  return {
    action: "block",
    logic: rule.logic,
    conditions: rule.conditions,
  };
}

export function buildExportGateRule(nodeId: string): NodeExecutionRule {
  // Demo seeding should still surface qa_gate results, but lightweight demo
  // inputs should not be hard-blocked at export time.
  return skipWhen({
    logic: "and",
    conditions: [
      {
        sourceRef: conditionRef(nodeId, "qa_gate", "can_export"),
        operator: "equals",
        value: "__never_block_demo_export__",
      },
    ],
  });
}

export function skipWhenNoInput(nodeId: string, outputId: string): NodeExecutionRule {
  return skipWhen({
    logic: "and",
    conditions: [
      {
        sourceRef: conditionRef(nodeId, outputId),
        operator: "not_exists",
      },
    ],
  });
}

export function skipWhenAll(
  conditions: Array<{
    sourceRef: VariableRef;
    operator: "equals" | "not_equals" | "exists" | "not_exists" | "contains";
    value?: string;
  }>,
): NodeExecutionRule {
  return skipWhen({
    logic: "and",
    conditions,
  });
}

export function deriveOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  switch (config.type) {
    case "input_transform": {
      const outputs: OutputDef[] = [];
      for (const field of config.formFields) {
        if (field.type === "file") {
          if (field.fileSlotId) {
            outputs.push({
              id: `${nodeId}-fileslot-${field.fileSlotId}`,
              name: field.fileSlotLabel || field.label || "文件槽位",
              description: `文件槽位: ${field.fileSlotLabel || field.label}`,
              segmentKey: field.fileSlotId,
            });
          }
        } else {
          const key = field.machineKey || field.id;
          outputs.push({
            id: `${nodeId}-field-${key}`,
            name: field.label || "未命名",
            description: `用户输入项: ${field.label}`,
            segmentKey: key,
          });
        }
      }

      const hasFileField = config.formFields.some((field) => field.type === "file");
      if (hasFileField) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (合并)",
          description: "所有文件合并文本",
          segmentKey: "text",
        });
      }

      return outputs;
    }
    case "model_call":
      if (config.namedOutputs && config.namedOutputs.length > 0) {
        return config.namedOutputs.map((output) => ({
          id: `${nodeId}-namedoutput-${output.id}`,
          name: output.name,
          description: `输出项: ${output.name}`,
          segmentKey: output.id,
        }));
      }
      return config.modelIds.map((modelId) => ({
        id: `${nodeId}-model-${modelId}`,
        name: config.modelNames?.[modelId] ?? modelId,
        description: "模型生成输出",
        segmentKey: modelId,
      }));
    case "desensitize":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((source) => ({
          id: `${nodeId}-desensitized-${source.outputId}`,
          name: `${source.displayName}.脱敏`,
          description: `脱敏后文本: ${source.displayName}`,
          segmentKey: source.outputId,
        }));
      }
      return [
        {
          id: `${nodeId}-desensitized`,
          name: "脱敏后文本",
          segmentKey: "desensitized",
        },
      ];
    case "restore":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((source) => ({
          id: `${nodeId}-restored-${source.sourceNodeId}-${source.outputId}`,
          name: `${source.displayName}.恢复`,
          description: `恢复后文本: ${source.displayName}`,
          segmentKey: `${source.sourceNodeId}.${source.outputId}`,
        }));
      }
      return [
        {
          id: `${nodeId}-restored`,
          name: "恢复后文本",
          segmentKey: "restored",
        },
      ];
    case "export":
      return [];
  }
}

function makeNode(
  id: string,
  label: string,
  type: WorkflowNodeDef["type"],
  config: NodeConfig,
  index: number,
): WorkflowNodeDef {
  return {
    id,
    type,
    label,
    position: { x: index * X_STEP, y: 0 },
    config,
    outputs: deriveOutputs(id, config),
  };
}

function inputSourcesFromFields(inputNodeId: string, fields: FormFieldDef[]) {
  // Mirror `deriveOutputs(input_transform)` so every filled field — text and
  // file slot alike — becomes its own desensitize tab. Using the full
  // `${nodeId}-field-...` / `${nodeId}-fileslot-...` form ensures
  // runtime.service.ts can route each source back to its specific field value
  // instead of falling back to the merged text blob.
  return deriveOutputs(inputNodeId, { type: "input_transform", formFields: fields }).map(
    (output) => ({
      sourceNodeId: inputNodeId,
      outputId: output.id,
      displayName: output.name,
    }),
  );
}

function buildStageNode(
  stage: StageSpec,
  index: number,
  models: DemoModelSelection,
): WorkflowNodeDef {
  const selectedModels =
    stage.modelMode === "compare" ? models.compareClouds : [models.primaryCloud];

  const config: NodeConfig = {
    type: "model_call",
    displayName: stage.displayName,
    modelIds: selectedModels.map((model) => model.id),
    modelNames: Object.fromEntries(selectedModels.map((model) => [model.id, model.displayName])),
    promptTemplate: stage.promptTemplate,
    systemPromptTemplate: stage.systemPromptTemplate,
    inputRefs: [],
    outputFormat:
      stage.outputFormat ??
      (stage.namedOutputs && stage.namedOutputs.length > 0 ? "text" : "markdown"),
    stepDescription: stage.stepDescription,
    namedOutputs: stage.namedOutputs,
    executionRule: stage.executionRule,
  };

  return makeNode(stage.id, stage.label, "model_call", config, index);
}

export function buildWorkflowFromBlueprint(
  blueprint: WorkflowBlueprint,
  models: DemoModelSelection,
): { nodes: WorkflowNodeDef[]; edges: WorkflowEdgeDef[] } {
  const nodes: WorkflowNodeDef[] = [];

  nodes.push(
    makeNode(
      "node_input",
      "输入转换",
      "input_transform",
      {
        type: "input_transform",
        formFields: blueprint.inputFields,
      },
      0,
    ),
  );

  nodes.push(
    makeNode(
      "node_desens",
      "信息脱敏",
      "desensitize",
      {
        type: "desensitize",
        categories: [...DESENSITIZE_CATEGORIES],
        localModelId: models.desensitize.id,
        inputSources: inputSourcesFromFields("node_input", blueprint.inputFields),
      },
      1,
    ),
  );

  let cursor = 2;
  for (const stage of blueprint.preRestoreStages) {
    nodes.push(buildStageNode(stage, cursor, models));
    cursor += 1;
  }

  nodes.push(
    makeNode(
      "node_restore",
      "信息恢复",
      "restore",
      {
        type: "restore",
        pairedDesensitizeNodeId: "node_desens",
        inputSources: blueprint.restoreSources,
      },
      cursor,
    ),
  );
  cursor += 1;

  for (const stage of blueprint.postRestoreStages ?? []) {
    nodes.push(buildStageNode(stage, cursor, models));
    cursor += 1;
  }

  nodes.push(
    makeNode(
      "node_export",
      "文件导出",
      "export",
      {
        type: "export",
        formats: blueprint.exportFormats ?? ["word", "pdf", "markdown"],
        contentMapping: [],
        executionRule: blueprint.exportRule,
      },
      cursor,
    ),
  );

  const edges: WorkflowEdgeDef[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    edges.push({
      id: `edge-${nodes[index].id}-${nodes[index + 1].id}`,
      source: nodes[index].id,
      target: nodes[index + 1].id,
    });
  }

  return { nodes, edges };
}
