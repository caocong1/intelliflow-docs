---
plan: 05-01
status: complete
started: "2026-03-20"
completed: "2026-03-20"
duration: "5min"
tasks_completed: 2
tasks_total: 2
commits:
  - hash: "34dac60"
    message: "feat(05-01): add runtime DB tables for node execution tracking and desensitize mappings"
  - hash: "826100f"
    message: "feat(05-01): add runtime types, augment node configs with runtime control fields"
---

# Plan 05-01 Summary: Runtime DB Schema & Shared Types

## What was built

1. **Runtime DB tables** (schema.ts):
   - `nodeExecutionStatusEnum` — pending, in_progress, completed, skipped, failed
   - `nodeExecutions` — per-node execution state within documents (status, I/O data, timing)
   - `desensitizeMappings` — sensitive info placeholder mappings (placeholder, original value, type)

2. **Shared runtime types** (types.ts):
   - `NodeExecution`, `DesensitizeMapping` — mirror DB tables
   - `DesensitizeRuleDesc` — sanitized rule descriptions for prompt injection
   - `ModelOutput` — per-model generation result with streaming status
   - `SSEEvent` — server-sent event types for model streaming
   - `DocumentRuntimeState` — full workspace state for frontend

3. **Node config augmentation**:
   - All 5 node configs got `autoAdvance?`, `allowEdit?`, `skippable?` fields
   - `ModelCallConfig.modelId` changed to `modelIds: string[]` for multi-model support
   - Backward-compatible `modelId?` kept as deprecated
   - Validation updated to check `modelIds` array

## Decisions

- [05-01] v1 stores desensitize mappings as plaintext; encryption deferred
- [05-01] modelId kept as deprecated optional for backward compat with saved workflows
- [05-01] All runtime control fields optional to avoid migration of existing workflows

## Verification

- `bun run tsc --noEmit` passes in both backend and frontend
- All types exported from shared package
