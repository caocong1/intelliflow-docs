---
phase: 25-export-table-rendering-system-prompt-separation
plan: 03
subsystem: frontend
tags: [system-prompt, model-call, solid-js, frontend]
---

# Dependency graph
requires:
  - phase: 25-02
    provides: systemPromptTemplate field in config type, systemPrompt in API response, backend dual prompt resolution
    why: Frontend reads systemPromptTemplate from config and displays systemPrompt from API log response

# What was built

## ModelCallConfig.tsx
- Added `systemPromptExpanded` signal and `hasSystemPrompt()` helper
- Added collapsible System Prompt section with:
  - **Empty state**: `+ 添加 System Prompt` button — sets `systemPromptTemplate: ""` and expands editor
  - **Has content**: collapsible header with expand/collapse chevron, 50-char truncated summary in collapsed state, full PromptEditor when expanded, "移除" button to clear
  - Reuses same PromptEditor component with variable support
- User Prompt label changes from "提示词模板" to "User Prompt" when system prompt is active

## ModelCallLogs.tsx
- Added `systemPrompt: string | null` to `ModelCallLogEntry` interface
- Added `systemPromptOpen` and `userPromptOpen` signals for independent collapse state
- Replaced single "完整提示词" section with dual collapsible sections:
  - **System Prompt section**: shown only when `log.systemPrompt` is truthy; header shows "System Prompt" with chevron; collapsed shows 80-char preview
  - **User Prompt section**: always shown when `log.resolvedPrompt` is truthy; header shows "User Prompt" if system prompt present, else "完整提示词" for backward compatibility; collapsed shows 80-char preview
- Old logs (null systemPrompt) display unchanged — single "完整提示词" section

## Verification
- Frontend build: `✓ built in 4.20s` — no TypeScript errors

# Decisions

- Collapsed preview length: 50 chars for config (space-constrained), 80 chars for logs (wider detail panel) — no conflict between the two UIs
- Signals named `systemPromptExpanded` (config) vs `systemPromptOpen` (logs) — different contexts, same pattern, different naming to avoid confusion
