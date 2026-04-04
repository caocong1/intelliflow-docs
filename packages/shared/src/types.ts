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
  /** Named artifact definitions for multi-segment output */
  namedOutputs?: NamedOutputDef[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

export interface RestoreConfig {
  type: "restore";
  pairedDesensitizeNodeId: string | null;
  inputSources?: InputSource[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}

export interface ExportConfig {
  type: "export";
  /** Allowed export formats (multi-select in config, user picks one at runtime) */
  formats: Array<"word" | "pdf" | "markdown" | "pptx">;
  /** @deprecated Use formats instead */
  format?: "word" | "pdf" | "markdown" | "pptx";
  /** @deprecated Use templateBindings instead */
  templateId?: string | null;
  /** Per-format template binding. Key = format, value = template ID */
  templateBindings?: Partial<Record<"word" | "pdf" | "pptx", string>>;
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

/** SSE event types for model streaming */
export type SSEEventType = "status" | "delta" | "complete" | "error";

export interface SSEEvent {
  type: SSEEventType;
  modelId: string;
  data: string;
  timestamp: string;
}

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
  workflowName: string;
  currentNodeIndex: number;
  nodes: NodeExecution[];
  workflowNodes: WorkflowNodeDef[];
}
