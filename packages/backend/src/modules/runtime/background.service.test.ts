import { describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../db/schema", () => ({
  backgroundTasks: {},
  documents: {},
  nodeExecutions: {},
  projects: {},
  users: {},
  workflows: {},
}));
vi.mock("../notifications/notifications.service", () => ({ createNotification: vi.fn() }));
vi.mock("../wecom/wecom.service", () => ({ sendTextCardMessage: vi.fn() }));
vi.mock("./conditions.service", () => ({ evaluateExecutionRule: vi.fn() }));
vi.mock("./desensitize.service", () => ({
  confirmDesensitization: vi.fn(),
  detectSensitiveInfo: vi.fn(),
}));
vi.mock("./export.service", () => ({ generateExport: vi.fn() }));
vi.mock("./model-call-state", () => ({ normalizeModelCallOutputDataForFailure: vi.fn() }));
vi.mock("./model-call.service", () => ({ executeModelCallBackground: vi.fn() }));
vi.mock("./restore.service", () => ({ executeRestore: vi.fn() }));
vi.mock("./runtime.service", () => ({
  advanceNode: vi.fn(),
  initDocumentExecution: vi.fn(),
}));

import type { DesensitizeConfig, PptConfig, RestoreConfig } from "@intelliflow/shared";
import { shouldPauseBackgroundAfterExecution } from "./background.service";

describe("shouldPauseBackgroundAfterExecution", () => {
  it("treats restore with autoAdvance=true as non-interactive", () => {
    const config: RestoreConfig = {
      type: "restore",
      pairedDesensitizeNodeId: "node_desens",
      autoAdvance: true,
    };

    expect(shouldPauseBackgroundAfterExecution("restore", config)).toBe(false);
  });

  it("still pauses on restore when autoAdvance is disabled", () => {
    const config: RestoreConfig = {
      type: "restore",
      pairedDesensitizeNodeId: "node_desens",
      autoAdvance: false,
    };

    expect(shouldPauseBackgroundAfterExecution("restore", config)).toBe(true);
  });

  it("keeps desensitize interactive only when autoAdvance is disabled", () => {
    const config: DesensitizeConfig = {
      type: "desensitize",
      categories: [],
      localModelId: "local-model",
      autoAdvance: true,
    };

    expect(shouldPauseBackgroundAfterExecution("desensitize", config)).toBe(false);
    expect(
      shouldPauseBackgroundAfterExecution("desensitize", {
        ...config,
        autoAdvance: false,
      }),
    ).toBe(true);
  });

  it("pauses on standalone ppt nodes because generation is user-driven", () => {
    const config: PptConfig = {
      type: "ppt",
      contentMapping: [],
      styleSelectionMode: "runtime_select",
    };

    expect(shouldPauseBackgroundAfterExecution("ppt", config)).toBe(true);
  });
});
