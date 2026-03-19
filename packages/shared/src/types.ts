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
