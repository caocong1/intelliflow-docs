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
}

export interface DesensitizeConfig {
  type: "desensitize";
  ruleTypes: string[];
  placeholderFormat: string;
  localModelId: string | null;
}

export interface ModelCallConfig {
  type: "model_call";
  displayName: string;
  modelId: string | null;
  promptTemplate: string;
  inputRefs: VariableRef[];
}

export interface RestoreConfig {
  type: "restore";
  pairedDesensitizeNodeId: string | null;
}

export interface ExportConfig {
  type: "export";
  format: "word" | "pdf" | "markdown";
  templateId: string | null;
  contentMapping: VariableRef[];
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
