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
export type ProviderType = "openai_compatible" | "opencode";

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
export type WorkflowNodeType = "input_transform" | "desensitize" | "model_call" | "restore" | "export";

/** Workflow status */
export type WorkflowStatus = "draft" | "active" | "disabled";

/** Named output (content block) from a node */
export interface OutputDef {
  id: string;
  name: string;
  description?: string;
}

/** Variable reference in prompt templates */
export interface VariableRef {
  nodeId: string;
  outputId: string;
  variableName: string;
}

/** Form field definition for input transform node */
export interface FormFieldDef {
  id: string;
  name: string;
  label: string;
  type: "text" | "textarea" | "file";
  required: boolean;
}

/** Node config discriminated union */
export interface InputTransformConfig {
  type: "input_transform";
  formFields: FormFieldDef[];
  allowFileUpload: boolean;
  acceptedFileTypes?: string[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}

export interface DesensitizeConfig {
  type: "desensitize";
  ruleTypes: string[];
  placeholderFormat: string;
  localModelId: string | null;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}

export interface ModelCallConfig {
  type: "model_call";
  displayName: string;
  modelIds: string[];
  /** @deprecated Use modelIds instead. Kept for backward compatibility. */
  modelId?: string | null;
  promptTemplate: string;
  inputRefs: VariableRef[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}

export interface RestoreConfig {
  type: "restore";
  pairedDesensitizeNodeId: string | null;
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}

export interface ExportConfig {
  type: "export";
  format: "word" | "pdf" | "markdown";
  templateId: string | null;
  contentMapping: VariableRef[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
}

export type NodeConfig = InputTransformConfig | DesensitizeConfig | ModelCallConfig | RestoreConfig | ExportConfig;

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
export type DocumentStatus = "draft" | "in_progress" | "completed";

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
export type NodeExecutionStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

/** Per-node execution record within a document */
export interface NodeExecution {
  id: string;
  documentId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: WorkflowNodeType;
  status: NodeExecutionStatus;
  stepOrder: number;
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

/** Model call output for a single model */
export interface ModelOutput {
  modelId: string;
  modelDisplayName: string;
  content: string;
  status: "pending" | "streaming" | "completed" | "failed";
  errorMessage?: string;
  tokenCount?: number;
}

/** SSE event types for model streaming */
export type SSEEventType = "status" | "delta" | "complete" | "error";

export interface SSEEvent {
  type: SSEEventType;
  modelId: string;
  data: string;
  timestamp: string;
}

/** Document runtime state (full workspace state for frontend) */
export interface DocumentRuntimeState {
  documentId: string;
  workflowName: string;
  currentNodeIndex: number;
  nodes: NodeExecution[];
}
