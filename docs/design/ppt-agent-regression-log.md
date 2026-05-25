# PPT Agent Regression Log

## 2026-05-22

### Scope
- `packages/backend/src/modules/ppt-agent/service.test.ts`
- `packages/backend/src/modules/ppt-agent/svg-templates.test.ts`
- `packages/backend/src/modules/ppt-agent/test-helpers/svg-test-helpers.ts`
- `packages/backend/src/modules/ppt-agent/svg-renderer.ts`
- `packages/backend/src/modules/ppt-agent/svg-templates/base.ts`
- `packages/backend/src/modules/ppt-agent/svg-templates/extra.ts`

### What changed
- Added multilingual text wrapping utility (`wrapMultilingualLines`) and reused it across `quote/contact/comparison/roadmap`.
- Improved `quote` template readability:
  - dynamic card height by content lines
  - dark-theme contrast tuning
  - optional side-image behavior guarded by visual availability.
- Added renderer-level artifact builder:
  - `buildSvgArtifacts(deckPlan, visuals)` exports deterministic `filename + svg` per slide.
- Split SVG-focused checks out of `service.test.ts` into dedicated `svg-templates.test.ts`.
- Extracted reusable SVG test helpers to `test-helpers/svg-test-helpers.ts`.

### Regression coverage added
- Template validity smoke for new page types (`comparison/process/roadmap/team/quote/contact/chart`).
- Chart variant smoke (`bar/line/pie/radar`).
- Long-text truncation coverage for `quote/contact/comparison/roadmap`.
- Structural signature smoke checks for key templates.
- Renderer artifact routing coverage:
  - filename determinism
  - expected template dispatch markers
  - no side-image when visuals are absent.
- Stable hash snapshots for key templates:
  - `quote`
  - `contact`
  - Purpose: catch subtle markup/style drift beyond coarse structural counts.
- Edge behavior for wrapping utility:
  - empty input fallback
  - trailing punctuation cleanup before ellipsis.

### Runbook
- From repo root:
  - `bun run test:ppt-agent:svg`
  - `bun run test:ppt-agent:svg:hash` (recompute `quote/contact` stable hashes after intentional template changes)
  - `bun run test:ppt-agent:svg:hash:check` (strict check, non-zero exit when snapshot drifts)
  - `bun run test:ppt-agent:svg:gate` (strict hash check + full regression in one command)
- From backend workspace:
  - `bun run test:ppt-agent:svg`
  - `bun run test:ppt-agent:svg:hash`
  - `bun run test:ppt-agent:svg:hash:check`
  - `bun run test:ppt-agent:svg:gate`

### Latest result
- `40 pass, 0 fail` on:
  - `service.test.ts`
  - `svg-templates.test.ts`

### Risks and follow-ups
- Threshold-style checks (for example structural counts using `toBeGreaterThanOrEqual`) are intentionally less brittle, but they may miss subtle visual regressions when structure is still present.
- `svgSignature`-based assertions protect topology markers (`id`, element counts) rather than pixel-level style fidelity.
- The most regression-prone template areas are:
  - `quote` (line wrapping, dynamic card height, dark-mode text contrast)
  - `contact/comparison/roadmap` (single-line truncation boundaries and ellipsis behavior)
  - `svg-renderer` dispatch map (`pageType -> renderFn`) and side-image injection conditions.
- If template semantics change (new ids, removed wrappers, merged groups), update signature assertions in `svg-templates.test.ts` first, then re-run root script.
- Optional next hardening:
  - add one lightweight image diff or rendered screenshot sanity check for 1-2 key templates
  - split `service.test.ts` further into orchestration-focused and schema-focused files when size grows again.
