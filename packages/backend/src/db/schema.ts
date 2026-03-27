import { boolean, integer, jsonb, pgEnum, pgTable, real, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import type { WorkflowEdgeDef, WorkflowNodeDef } from "@intelliflow/shared";

export const providerTypeEnum = pgEnum("provider_type", ["openai_compatible", "opencode", "claude_agent_sdk", "ollama"]);
export const deploymentTypeEnum = pgEnum("deployment_type", ["cloud", "local"]);

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  wecomUserId: varchar("wecom_userid", { length: 64 }).unique(),
  mobile: varchar("mobile", { length: 20 }),
  avatar: varchar("avatar", { length: 500 }),
  email: varchar("email", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const documentTypes = pgTable("document_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 500 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: providerTypeEnum("type").default("openai_compatible").notNull(),
  deploymentType: deploymentTypeEnum("deployment_type").default("cloud").notNull(),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  apiKey: varchar("api_key", { length: 500 }),
  username: varchar("username", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentModeEnum = pgEnum("agent_mode", ["simple_chat", "autonomous_agent"]);

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id),
  modelId: varchar("model_id", { length: 200 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isProviderDisabled: boolean("is_provider_disabled").default(false).notNull(),
  temperature: real("temperature"),
  maxTokens: integer("max_tokens"),
  topP: real("top_p"),
  // Agent SDK specific fields
  agentMode: agentModeEnum("agent_mode").default("simple_chat"),
  agentMaxTurns: integer("agent_max_turns").default(15),
  agentMaxBudgetUsd: varchar("agent_max_budget_usd", { length: 20 }).default("2.00"),
  agentAllowedTools: jsonb("agent_allowed_tools").$type<string[]>().default([]),
  // Pricing fields for cost estimation
  inputPricePerMTok: varchar("input_price_per_mtok", { length: 20 }),
  outputPricePerMTok: varchar("output_price_per_mtok", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectRoleEnum = pgEnum("project_role", ["owner", "participant"]);
export const documentVisibilityEnum = pgEnum("document_visibility", ["self", "project", "specific"]);
export const documentStatusEnum = pgEnum("document_status", ["draft", "in_progress", "completed", "failed"]);

export const workflowStatusEnum = pgEnum("workflow_status", ["draft", "active", "disabled"]);

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentTypeId: uuid("document_type_id")
    .notNull()
    .references(() => documentTypes.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: varchar("description", { length: 1000 }),
  status: workflowStatusEnum("status").default("draft").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  nodes: jsonb("nodes").$type<WorkflowNodeDef[]>().default([]).notNull(),
  edges: jsonb("edges").$type<WorkflowEdgeDef[]>().default([]).notNull(),
  schemaVersion: integer("schema_version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Phase 4: Project, Document, Version, File tables ────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: varchar("description", { length: 1000 }),
  department: varchar("department", { length: 100 }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "rejected", "expired"]);

export const projectInvitations = pgTable("project_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  inviterId: uuid("inviter_id")
    .notNull()
    .references(() => users.id),
  wecomUserId: varchar("wecom_userid", { length: 64 }).notNull(),
  wecomName: varchar("wecom_name", { length: 100 }),
  status: invitationStatusEnum("status").default("pending").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: projectRoleEnum("role").default("participant").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id),
  title: varchar("title", { length: 300 }).notNull(),
  description: varchar("description", { length: 1000 }),
  status: documentStatusEnum("status").default("draft").notNull(),
  visibility: documentVisibilityEnum("visibility").default("project").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentVisibilityMembers = pgTable("document_visibility_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
});

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  versionNumber: integer("version_number").notNull(),
  nodeId: varchar("node_id", { length: 100 }).notNull(),
  nodeLabel: varchar("node_label", { length: 200 }).notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Phase 5: Runtime Execution tables ───────────────────────────────────────

export const nodeExecutionStatusEnum = pgEnum("node_execution_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped",
  "failed",
  "blocked",
]);

export const nodeExecutions = pgTable("node_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  nodeId: varchar("node_id", { length: 100 }).notNull(),
  nodeLabel: varchar("node_label", { length: 200 }).notNull(),
  nodeType: varchar("node_type", { length: 50 }).notNull(),
  status: nodeExecutionStatusEnum("status").default("pending").notNull(),
  stepOrder: integer("step_order").notNull(),
  executionRound: integer("execution_round").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  selectedOutputKey: varchar("selected_output_key", { length: 200 }),
  errorMessage: varchar("error_message", { length: 2000 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const desensitizeMappings = pgTable("desensitize_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  nodeExecutionId: uuid("node_execution_id")
    .notNull()
    .references(() => nodeExecutions.id),
  placeholder: varchar("placeholder", { length: 200 }).notNull(),
  originalValue: varchar("original_value", { length: 2000 }).notNull(),
  sensitiveType: varchar("sensitive_type", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const callSourceEnum = pgEnum("call_source", [
  "runtime",
  "model_test",
  "provider_test",
  "prompt_optimize",
  "inline_edit",
]);

export const modelCallLogs = pgTable("model_call_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nullable: test/optimize calls don't have a document context
  documentId: uuid("document_id").references(() => documents.id),
  nodeExecutionId: uuid("node_execution_id").references(() => nodeExecutions.id),
  // Who triggered this call
  userId: uuid("user_id").references(() => users.id),
  // Provider info
  providerId: uuid("provider_id").references(() => providers.id),
  providerName: varchar("provider_name", { length: 100 }),
  // Model info
  modelId: uuid("model_id").references(() => models.id),
  modelName: varchar("model_name", { length: 200 }),
  // Call source
  callSource: callSourceEnum("call_source").default("runtime").notNull(),
  // Prompt
  promptTemplate: text("prompt_template"),
  systemPrompt: text("system_prompt"),
  resolvedPrompt: text("resolved_prompt"),
  variableMapping: jsonb("variable_mapping"),
  temperature: real("temperature"),
  maxTokens: integer("max_tokens"),
  // Response
  responseStatus: varchar("response_status", { length: 20 }),
  responseContent: text("response_content"),
  contentLength: integer("content_length"),
  tokenUsage: jsonb("token_usage"),
  duration: integer("duration"),
  errorMessage: varchar("error_message", { length: 2000 }),
  // Agent SDK specific log fields
  agentTurnsUsed: integer("agent_turns_used"),
  agentToolsCalled: jsonb("agent_tools_called").$type<string[]>(),
  budgetUsedUsd: varchar("budget_used_usd", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentFiles = pgTable("document_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  category: varchar("category", { length: 20 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  storagePath: varchar("storage_path", { length: 1000 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  slotId: varchar("slot_id", { length: 100 }),  // nullable, links to FormFieldDef.fileSlotId
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Phase 17 (v1.1): New tables and enums ────────────────────────────────────

export const backgroundTaskStatusEnum = pgEnum("background_task_status", ["queued", "running", "completed", "failed"]);
export const backgroundTaskTypeEnum = pgEnum("background_task_type", ["document_generation"]);
export const favoriteTargetTypeEnum = pgEnum("favorite_target_type", ["project", "document", "workflow"]);
export const recentAccessTargetTypeEnum = pgEnum("recent_access_target_type", ["project", "document", "workflow"]);

export const backgroundTasks = pgTable("background_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  taskType: backgroundTaskTypeEnum("task_type").notNull(),
  status: backgroundTaskStatusEnum("status").default("queued").notNull(),
  documentId: uuid("document_id").references(() => documents.id),
  progress: integer("progress").default(0),
  errorMessage: varchar("error_message", { length: 2000 }),
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userFavorites = pgTable("user_favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  targetType: favoriteTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("uq_user_favorites_user_target").on(table.userId, table.targetType, table.targetId),
]);

export const userRecentAccess = pgTable("user_recent_access", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  targetType: recentAccessTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("uq_user_recent_access_user_target").on(table.userId, table.targetType, table.targetId),
]);

// ─── Phase 18: Notifications ────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("notification_type", [
  "generation_completed",
  "generation_failed",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: varchar("message", { length: 1000 }),
  documentId: uuid("document_id").references(() => documents.id),
  projectId: uuid("project_id").references(() => projects.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
