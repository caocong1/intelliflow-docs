/** User roles in the system */
export type UserRole = "admin" | "user";

/** Base entity with common fields */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** User entity (public-facing, no password hash) */
export interface User extends BaseEntity {
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string | null;
}

/** Document type definition */
export interface DocumentType extends BaseEntity {
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

/** API health check response */
export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

/** AI provider types */
export type ProviderType = "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";

/** Agent SDK running mode */
export type AgentMode = "simple_chat" | "autonomous_agent";

/** Model deployment types */
export type DeploymentType = "cloud" | "local";

/** AI provider configuration */
export interface Provider extends BaseEntity {
  name: string;
  type: ProviderType;
  deploymentType: DeploymentType;
  baseUrl: string;
  apiKeyMasked: string | null;
  username: string | null;
  isActive: boolean;
}

/** AI model under a provider */
export interface Model extends BaseEntity {
  providerId: string;
  modelId: string;
  displayName: string;
  isActive: boolean;
  isProviderDisabled: boolean;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  providerName?: string;
  /** Agent SDK specific fields */
  agentMode?: AgentMode | null;
  agentMaxTurns?: number | null;
  agentMaxBudgetUsd?: string | null;
  agentAllowedTools?: string[] | null;
}

/** Provider with its models */
export interface ProviderWithModels extends Provider {
  models: Model[];
}

/** Result of a provider connectivity test */
export interface ConnectivityTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

/** Explicit default PPT style pack used by both frontend and backend */
export const DEFAULT_PPT_STYLE_PACK_ID = "corporate_blue";

// ─── Workflow types ───────────────────────────────────────────────────────────

/** The 5 workflow node types */
export type WorkflowNodeType =
  | "input_transform"
  | "desensitize"
  | "model_call"
  | "restore"
  | "export";

/** Workflow status */
export type WorkflowStatus = "draft" | "active" | "disabled";

/** Named output (content block) from a node */
export interface OutputDef {
  id: string;
  name: string;
  description?: string;
  segmentKey?: string; // canonical path identifier for variable resolution
  category?:
    | "field"
    | "file_slot"
    | "model"
    | "model_artifact"
    | "manual_feedback"
    | "selected"
    | "selected_artifact"
    | "desensitized"
    | "restored";
  groupLabel?: string;
  modelId?: string;
  artifactId?: string;
}

/** Explicit input source reference for desensitize/restore nodes */
export interface InputSource {
  sourceNodeId: string;
  /** References the upstream node's OutputDef.segmentKey (canonical path identifier),
   * not OutputDef.id. Used by desensitize/restore nodes to declare input dependencies. */
  outputId: string;
  displayName: string; // auto-filled from upstream output name
}

/** Variable reference in prompt templates */
export interface VariableRef {
  nodeId: string;
  /** Stores OutputDef.segmentKey (not OutputDef.id).
   * Used in prompt templates for variable substitution (e.g., ${nodeId.outputId.fieldPath}). */
  outputId: string;
  variableName: string;
  fieldPath?: string; // for nested JSON field access (Phase 24 use)
}

/** Condition for conditional node execution */
export interface NodeCondition {
  sourceRef: VariableRef;
  operator: "equals" | "not_equals" | "exists" | "not_exists" | "contains";
  value?: string;
}

/** Execution rule for conditional node skip/block */
export interface NodeExecutionRule {
  action: "skip" | "block";
  conditions: NodeCondition[];
  logic: "and" | "or";
}

/** Output-level behavior when a node is skipped */
export interface SkipBinding {
  mode: "inherit" | "empty";
  sourceRef?: VariableRef;
}

/** Preconfigured skip behavior for a node */
export interface SkipStrategy {
  bindings: Record<string, SkipBinding>;
}

/** Form field type union */
export type FormFieldType =
  | "text"
  | "textarea"
  | "file"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "multiselect";

/** Form field definition for input transform node */
export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  /** Stable machine-readable identifier, format: /^[a-zA-Z_][a-zA-Z0-9_]*$/ */
  machineKey?: string;
  /** File upload: how many files allowed */
  fileCountMode?: "single" | "unlimited";
  /** When set, restrict to these file extensions (e.g. [".pdf", ".doc,.docx"]) */
  acceptedFileTypes?: string[];
  /** Option list for select/multiselect fields */
  options?: string[];
  /** Single default value for text/number/date/datetime/select */
  defaultValue?: string;
  /** Multiple default values for multiselect */
  defaultValues?: string[];
  /** File slot identifier for variable path */
  fileSlotId?: string;
  /** Display name for file slot card */
  fileSlotLabel?: string;
}

/** Node config discriminated union */
export interface InputTransformConfig {
  type: "input_transform";
  formFields: FormFieldDef[];
  /** Optional short hint displayed to users while executing this node */
  stepDescription?: string;
  /** Preconfigured output materialization when this node is skipped */
  skipStrategy?: SkipStrategy;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

export interface DesensitizeConfig {
  type: "desensitize";
  categories: Array<{ name: string; description: string }>;
  localModelId: string | null;
  inputSources?: InputSource[];
  /** Optional short hint displayed to users while executing this node */
  stepDescription?: string;
  /** Preconfigured output materialization when this node is skipped */
  skipStrategy?: SkipStrategy;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

export interface ModelCallConfig {
  type: "model_call";
  displayName: string;
  modelIds: string[];
  /** Model ID → display name mapping for readable output names */
  modelNames?: Record<string, string>;
  /** @deprecated Use modelIds instead. Kept for backward compatibility. */
  modelId?: string | null;
  promptTemplate: string;
  /** Optional system prompt template for AI persona/role */
  systemPromptTemplate?: string;
  inputRefs: VariableRef[];
  /** Output format declaration */
  outputFormat?: "text" | "json" | "markdown";
  /** JSON Schema for validation (only when outputFormat=json) */
  jsonSchema?: object;
  /** Description displayed to user during execution */
  stepDescription?: string;
  /** Preconfigured output materialization when this node is skipped */
  skipStrategy?: SkipStrategy;
  /** Named artifact definitions for multi-segment output */
  namedOutputs?: NamedOutputDef[];
  /** Whether this node exposes an extra "user selected output" group downstream */
  enableUserSelectionOutput?: boolean;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

export interface RestoreConfig {
  type: "restore";
  pairedDesensitizeNodeId: string | null;
  inputSources?: InputSource[];
  /** Optional short hint displayed to users while executing this node */
  stepDescription?: string;
  /** Preconfigured output materialization when this node is skipped */
  skipStrategy?: SkipStrategy;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

/**
 * Renderer engine for pptx export.
 *
 * - `archetype` (default): classic pptxgenjs-driven archetype renderer.
 *   Fast, no external deps, but visually plainer.
 * - `html_fidelity`: route through the HTML-fidelity pipeline
 *   (LLM fill-plan + Chrome render + editable text overlay). Richer
 *   asymmetric layouts, slower, requires a live LLM provider. See
 *   [HTML fidelity section in README](../../../docs/design/ppt-mvp/README.md).
 */
export type PptRenderEngine = "archetype" | "html_fidelity";

export interface ExportConfig {
  type: "export";
  /** Allowed export formats (multi-select in config, user picks one at runtime) */
  formats: Array<"word" | "pdf" | "markdown" | "pptx">;
  /** Optional short hint displayed to users while executing this node */
  stepDescription?: string;
  /** Preconfigured output materialization when this node is skipped */
  skipStrategy?: SkipStrategy;
  /** @deprecated Use formats instead */
  format?: "word" | "pdf" | "markdown" | "pptx";
  /** @deprecated Use templateBindings instead */
  templateId?: string | null;
  /** Per-format template binding. Key = format, value = template ID */
  templateBindings?: Partial<Record<"word" | "pdf" | "pptx", string>>;
  /**
   * Pptx render engine selector. Only consulted when the resolved format
   * is `pptx`. Defaults to `archetype` when absent — existing configs
   * behave unchanged.
   */
  pptRenderEngine?: PptRenderEngine;
  /**
   * Template ID for the HTML-fidelity family (only when
   * pptRenderEngine === "html_fidelity"). Defaults to 622eee2ab7e6e.
   */
  pptHtmlFidelityTemplateId?: string;
  contentMapping: VariableRef[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

export type NodeConfig =
  | InputTransformConfig
  | DesensitizeConfig
  | ModelCallConfig
  | RestoreConfig
  | ExportConfig;

/**
 * Skip strategy is configured against the node's primary outputs.
 * For model_call nodes, manual feedback is excluded and selected artifact outputs
 * mirror named output bindings automatically at runtime.
 */
export function getSkipStrategyTargets(nodeId: string, config: NodeConfig): OutputDef[] {
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
              category: "file_slot",
            });
          }
        } else {
          const key = field.machineKey || field.id;
          outputs.push({
            id: `${nodeId}-field-${key}`,
            name: field.label || "未命名",
            description: `用户输入项: ${field.label}`,
            segmentKey: key,
            category: "field",
          });
        }
      }
      if (config.formFields.some((field) => field.type === "file")) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (合并)",
          description: "所有文件合并文本",
          segmentKey: "text",
          category: "file_slot",
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

      return [
        ...config.modelIds.map((modelId) => ({
          id: `${nodeId}-model-${modelId}`,
          name: config.modelNames?.[modelId] ?? modelId,
          description: "模型生成输出",
          segmentKey: modelId,
          category: "model" as const,
          modelId,
        })),
        ...(config.enableUserSelectionOutput
          ? [
              {
                id: `${nodeId}-selected-output`,
                name: "用户选择输出",
                description: "模型生成输出",
                segmentKey: "selected",
                category: "selected" as const,
                groupLabel: "用户选择输出",
              },
            ]
          : []),
      ];

    case "desensitize":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((source) => ({
          id: `${nodeId}-desensitized-${source.outputId}`,
          name: `${source.displayName}.脱敏`,
          description: `脱敏后文本: ${source.displayName}`,
          segmentKey: source.outputId,
          category: "desensitized",
        }));
      }
      return [
        {
          id: `${nodeId}-desensitized`,
          name: "脱敏后文本",
          description: "脱敏后文本",
          segmentKey: "desensitized",
          category: "desensitized",
        },
      ];

    case "restore":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((source) => ({
          id: `${nodeId}-restored-${source.sourceNodeId}-${source.outputId}`,
          name: `${source.displayName}.恢复`,
          description: `恢复后文本: ${source.displayName}`,
          segmentKey: `${source.sourceNodeId}.${source.outputId}`,
          category: "restored",
        }));
      }
      return [
        {
          id: `${nodeId}-restored`,
          name: "恢复后文本",
          description: "恢复后文本",
          segmentKey: "restored",
          category: "restored",
        },
      ];

    case "export":
      return [];
  }
}

/** A node instance in a workflow */
export interface WorkflowNodeDef {
  id: string;
  type: WorkflowNodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;
  outputs: OutputDef[];
}

/** An edge connecting two nodes */
export interface WorkflowEdgeDef {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** Validation error from workflow validation */
export interface WorkflowValidationError {
  nodeId?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

/** Workflow entity */
export interface Workflow extends BaseEntity {
  documentTypeId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  isDefault: boolean;
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  schemaVersion: number;
}

/** Workflow list item (without full graph data for list pages) */
export interface WorkflowListItem extends BaseEntity {
  documentTypeId: string;
  documentTypeName: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  isDefault: boolean;
  nodeCount: number;
}

// ─── Project & Document types ────────────────────────────────────────────────

/** Project member roles */
export type ProjectRole = "owner" | "participant";

/** Document visibility scope */
export type DocumentVisibility = "self" | "project" | "specific";

/** Document lifecycle status */
export type DocumentStatus = "draft" | "in_progress" | "completed" | "failed";

/** Project entity */
export interface Project extends BaseEntity {
  name: string;
  description: string | null;
  department: string | null;
  createdBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

/** Project member (user assigned to a project) */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  /** Joined fields (optional, for list views) */
  displayName?: string;
  username?: string;
}

/** Project list item with aggregated info */
export interface ProjectListItem extends Project {
  memberCount: number;
  /** null if user is not a member (admin viewing "all") */
  userRole: ProjectRole | null;
}

/** Document entity */
export interface Document extends BaseEntity {
  projectId: string;
  workflowId: string;
  title: string;
  description: string | null;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  createdBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
  isArchived: boolean;
  /** Joined fields (optional) */
  creatorName?: string;
  workflowName?: string;
}

/** Document version snapshot */
export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  nodeId: string;
  nodeLabel: string;
  snapshotData: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  /** Joined fields */
  creatorName?: string;
}

/** Document file (uploaded or exported) */
export interface DocumentFile {
  id: string;
  documentId: string;
  category: "upload" | "export";
  originalName: string;
  storagePath: string;
  mimeType: string | null;
  fileSize: number | null;
  createdBy: string;
  createdAt: string;
}

/** A single line in a version diff */
export interface VersionDiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/** Result of comparing two document versions */
export interface VersionDiffResult {
  versionA: DocumentVersion;
  versionB: DocumentVersion;
  /** Keyed by content field name */
  diffs: Record<string, VersionDiffLine[]>;
}

// ─── Phase 5: Document Creation Runtime types ────────────────────────────────

/** Node execution status */
export type NodeExecutionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "failed"
  | "blocked";

/** Per-node execution record within a document */
export interface NodeExecution {
  id: string;
  documentId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: WorkflowNodeType;
  status: NodeExecutionStatus;
  stepOrder: number;
  executionRound: number;
  isCurrent: boolean;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  selectedOutputKey: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Desensitize mapping entry */
export interface DesensitizeMapping {
  id: string;
  documentId: string;
  nodeExecutionId: string;
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  createdAt: string;
}

/** Desensitize rule description (injected into prompts, NO real values) */
export interface DesensitizeRuleDesc {
  placeholder: string;
  sensitiveType: string;
  description: string;
}

/** Simple field definition for normal-mode JSON outputs (flat atomic types only) */
export interface SimpleFieldDef {
  name: string; // field name, must match /^[a-zA-Z_]\w*$/
  type: "string" | "number" | "boolean";
  description?: string;
  required?: boolean;
}

/** Named output definition for model call nodes */
export interface NamedOutputDef {
  id: string; // segmentKey, e.g. "blueprint"
  name: string; // display name, e.g. "投标蓝图"
  format: "text" | "json" | "markdown";
  jsonSchema?: object; // per-artifact JSON Schema
  simpleFields?: SimpleFieldDef[]; // normal-mode field definitions (source of truth for UI)
  outputPrompt?: string; // per-output prompt (merged with main prompt by backend)
}

/** Model call output for a single model */
export interface ModelOutput {
  modelId: string;
  modelDisplayName: string;
  content: string;
  status: "pending" | "streaming" | "completed" | "failed" | "format_error";
  errorMessage?: string;
  tokenCount?: number;
  formatErrors?: string[];
}

/** User-authored feedback attached to a model_call node for re-generation */
export interface ModelCallManualFeedback {
  content: string;
  updatedAt?: string | null;
  /** When equal to updatedAt, the latest feedback has already been applied. */
  appliedAt?: string | null;
}

/** Named output value stored in model_call outputData */
export interface ModelCallNamedOutputValue {
  content: string;
  format: "text" | "json" | "markdown";
  modelId?: string;
  modelDisplayName?: string;
  modelIds?: string[];
}

/** Flattened output item stored in model_call outputData */
export interface ModelCallOutputItem {
  content: string;
  format: "text" | "json" | "markdown";
  kind: "model" | "model_artifact" | "manual_feedback" | "selected" | "selected_artifact";
  modelId?: string;
  modelDisplayName?: string;
  modelIds?: string[];
  artifactId?: string;
}

/** Runtime outputData shape for model_call nodes */
export interface ModelCallOutputData {
  [key: string]: unknown;
  models?: Record<string, ModelOutput>;
  selectedModelIds?: string[];
  selectedContent?: string;
  text?: string;
  namedOutputs?: Record<string, ModelCallNamedOutputValue>;
  namedOutputsByModel?: Record<string, Record<string, ModelCallNamedOutputValue>>;
  outputItems?: Record<string, ModelCallOutputItem>;
  fallbackWarning?: boolean;
  manualFeedback?: ModelCallManualFeedback;
}

/** SSE event types for model streaming */
export type SSEEventType = "status" | "delta" | "complete" | "error";

export interface SSEEvent {
  type: SSEEventType;
  modelId: string;
  data: string;
  timestamp: string;
}

/** Snapshot payload for resumable model-call live streaming */
export interface ModelCallSnapshotPayload {
  models: Record<string, ModelOutput>;
  selectedModelId?: string | null;
  selectedModelIds?: string[];
  done: boolean;
}

/** Live SSE events for background model-call execution */
export type ModelCallLiveEvent =
  | SSEEvent
  | {
      type: "snapshot";
      data: ModelCallSnapshotPayload;
    };

/** Model call log entry */
export interface ModelCallLog {
  id: string;
  documentId: string;
  nodeExecutionId: string;
  modelId: string;
  modelName: string;
  promptTemplate: string;
  resolvedPrompt: string;
  variableMapping: Record<string, string>;
  temperature: number | null;
  maxTokens: number | null;
  responseStatus: "completed" | "failed";
  contentLength: number | null;
  tokenUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  duration: number | null;
  errorMessage: string | null;
  createdAt: string;
}

/** Document runtime state (full workspace state for frontend) */
export interface DocumentRuntimeState {
  documentId: string;
  projectId: string | null;
  documentTitle: string;
  workflowName: string;
  currentNodeIndex: number;
  backgroundTaskActive: boolean;
  nodes: NodeExecution[];
  workflowNodes: WorkflowNodeDef[];
}

// ─── Desensitize specific types ────────────────────────────────────────────

/** 脱敏检测到的敏感信息项（前后端共用） */
export interface DetectedSensitiveItem {
  original: string;
  placeholder: string;
  sensitiveType: string;
  description: string;
  startIndex: number;
  endIndex: number;
}

/** 前端审核阶段的条目（增加 checked 状态） */
export interface DesensitizeReviewItem extends DetectedSensitiveItem {
  checked: boolean;
}

/** 审核摘要条目（不含 original，安全存储在 outputData） */
export interface DesensitizeReviewSummaryItem {
  placeholder: string;
  sensitiveType: string;
  checked: boolean;
}

/** 单个文件源的脱敏输出 */
export interface FileSourceOutput {
  fileId: string;
  name: string;
  desensitizedText: string;
}

/** 单个输入源的脱敏输出 */
export interface SourceOutput {
  displayName: string;
  desensitizedText: string;
  files?: FileSourceOutput[];
}

/** 脱敏节点的最终输出数据结构 */
export interface DesensitizeOutputData {
  text: string;
  mappingCount: number;
  detectedItems: DesensitizeReviewSummaryItem[];
  sources?: Record<string, SourceOutput>;
  confirmedAt?: string;
}

/** 单条还原记录 */
export interface RestorationItem {
  placeholder: string;
  originalValue: string;
  sensitiveType: string;
  restored: boolean;
}

/** 单个输入源的还原输出 */
export interface RestoreSourceOutput {
  displayName: string;
  originalText: string; // 恢复前文本
  restoredText: string;
}

/** 还原节点的最终输出数据结构 */
export interface RestoreOutputData {
  originalText: string;
  restoredText: string;
  restorations: RestorationItem[];
  sources: Record<string, RestoreSourceOutput>;
  confirmedAt?: string; // 确认时间戳
}

/** 检测阶段临时状态（confirm 后被完整覆盖） */
export interface DesensitizeDetectState {
  _detectPhase: "detecting" | "detected" | "failed";
  _detectedItems?: DetectedSensitiveItem[];
  _detectError?: string;
}
