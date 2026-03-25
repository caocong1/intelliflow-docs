---
status: blocked
phase: 05-document-creation-runtime
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md, 05-08-SUMMARY.md]
started: "2026-03-20T11:00:00Z"
updated: "2026-03-20T11:00:00Z"
---

## Current Test

number: 1
name: Enter Document Workspace
expected: |
  From a document detail page (draft or in_progress), click "Enter Workspace" button.
  The workspace page loads showing a horizontal stepper bar at the top with all workflow nodes listed in order.
  The current node is highlighted. An action bar at the bottom has advance/rollback buttons.
awaiting: user response

## Tests

### 1. Enter Document Workspace
expected: From a document detail page, click "Enter Workspace". Workspace loads with horizontal stepper bar showing all workflow nodes in order. Current node highlighted. Action bar at bottom with advance/rollback controls.
result: [pending]

### 2. Input Transform — Form Fields & File Upload
expected: On an input_transform node, the executor shows form fields (text/textarea) as defined in the workflow config. A drag-drop file upload area accepts files. Upload shows progress bar. After upload, parsed text appears in an editable textarea (supports txt/pdf/docx).
result: [pending]

### 3. Input Transform — Confirm & Advance
expected: After filling form fields and/or uploading files, click Confirm. The node output is saved. The stepper advances to the next node. Re-entering a completed input_transform node shows the saved data in read-only mode.
result: [pending]

### 4. Desensitize — Detection & Review
expected: On a desensitize node, click to start detection. The system scans input text for sensitive info (names, phone numbers, emails, IDs). Results appear in a split panel: left shows text with yellow-highlighted sensitive items, right shows a checklist of detected items with toggle to include/exclude each.
result: [pending]

### 5. Desensitize — Manual Add & Confirm
expected: In the desensitize review panel, user can manually add sensitive items. A sanitized preview shows placeholders replacing real values (e.g., [PERSON_1]). Clicking Confirm stores mappings and advances.
result: [pending]

### 6. Model Call — SSE Streaming
expected: On a model_call node, execution starts and text streams in real-time from the AI model via SSE. A status badge shows "streaming" during generation and "completed" when done. The generated content renders with basic markdown formatting.
result: [pending]

### 7. Model Call — Multi-Model Tabs & Comparison
expected: When a model_call node has multiple models configured, each model's output appears in its own tab. User can switch between tabs. A "Compare" button opens a side-by-side view of two selected model outputs.
result: [pending]

### 8. Model Call — Retry & Select Output
expected: User can retry a specific model's generation without affecting others. After all models complete, user selects one output via radio buttons (auto-selected if single model). The selected output becomes the node's output for downstream nodes.
result: [pending]

### 9. Restore — Placeholder Replacement & Diff
expected: On a restore node, clicking "Start Restore" replaces placeholders with original values from the desensitize step. A side-by-side diff view appears: left panel shows desensitized text with amber placeholders, right panel shows restored text with green highlights for successful replacements and red for failures.
result: [pending]

### 10. Restore — Manual Correction
expected: If any placeholder restoration fails (shown in red), failed items are listed below the diff. User can click to edit and manually correct the text. After correction, the system re-validates restoration status.
result: [pending]

### 11. Export — Format Selection & Preview
expected: On an export node, user sees format radio buttons (Word/PDF/Markdown). A markdown preview shows the content that will be exported. The filename is editable with auto-extension matching the selected format.
result: [pending]

### 12. Export — Generate & Download
expected: Clicking Export generates the file in the selected format. A download button appears. Clicking it downloads the file. Re-entering a completed export node shows file info with a re-download button.
result: [pending]

### 13. Inline Markdown Editor
expected: Below the node executor area, an "Edit" toggle opens a split-view Markdown editor. Left side is a textarea for editing, right side shows a live HTML preview. A toolbar provides formatting buttons (bold, italic, headers, lists). Ctrl+B and Ctrl+I keyboard shortcuts work.
result: [pending]

### 14. Skip Node
expected: For optional nodes (where skippable is configured), a Skip button appears. Clicking Skip marks the node as skipped and advances to the next node. The skipped node shows "Skipped" status in the stepper.
result: [pending]

### 15. Rollback to Previous Node
expected: Clicking Rollback returns to the previous node. The previous node's status resets to pending (but its output data is preserved). User can re-execute the node. A confirmation dialog appears before rollback.
result: [pending]

### 16. Node History Panel
expected: A collapsible history panel shows completed nodes with their input/output data. User can expand each completed node to review what was done. The panel updates as nodes are completed.
result: [pending]

### 17. Auto-Resume on Reload
expected: If user closes the workspace and reopens it (or refreshes), the workspace resumes at the last active node with all previous node states preserved.
result: [pending]

## Summary

total: 17
passed: 0
issues: 0
pending: 17
skipped: 0

## Gaps

[none yet]
