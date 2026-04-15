import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  advanceNodeMock: vi.fn(),
  canEditDocumentMock: vi.fn(),
  downloadExportMock: vi.fn(),
  generateExportMock: vi.fn(),
  getExportPreviewMock: vi.fn(),
  isDocumentProjectMemberMock: vi.fn(),
}));

vi.mock("../auth/auth.guard", async () => {
  const { default: Elysia } = await import("elysia");

  return {
    requireAuth: new Elysia({ name: "requireAuth" }).derive({ as: "global" }, () => ({
      user: { id: "user-1" },
    })),
  };
});

vi.mock("../versions/versions.service", () => ({
  canEditDocument: mocks.canEditDocumentMock,
  isDocumentProjectMember: mocks.isDocumentProjectMemberMock,
}));

vi.mock("./export.service", () => ({
  downloadExport: mocks.downloadExportMock,
  generateExport: mocks.generateExportMock,
  getExportPreview: mocks.getExportPreviewMock,
}));

vi.mock("./runtime.service", () => ({
  advanceNode: mocks.advanceNodeMock,
}));

import Elysia from "elysia";
import { exportRoutes } from "./export.routes";

describe("exportRoutes", () => {
  beforeEach(() => {
    mocks.advanceNodeMock.mockReset().mockResolvedValue({ id: "doc-1" });
    mocks.canEditDocumentMock.mockReset().mockResolvedValue(true);
    mocks.downloadExportMock.mockReset();
    mocks.generateExportMock.mockReset().mockResolvedValue({
      filename: "report.docx",
      format: "word",
      fileSize: 1024,
      storagePath: "/tmp/report.docx",
    });
    mocks.getExportPreviewMock.mockReset();
    mocks.isDocumentProjectMemberMock.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("auto-advances the export node after a successful generate request", async () => {
    const app = new Elysia().use(exportRoutes);

    const response = await app.handle(
      new Request("http://localhost/runtime/doc-1/export/node-exec-1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "word",
          filename: "report.docx",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.generateExportMock).toHaveBeenCalledWith(
      "doc-1",
      "node-exec-1",
      "word",
      "report.docx",
      "user-1",
    );
    expect(mocks.advanceNodeMock).toHaveBeenCalledWith("doc-1", "node-exec-1", "user-1");

    await expect(response.json()).resolves.toEqual({
      filename: "report.docx",
      format: "word",
      fileSize: 1024,
      storagePath: "/tmp/report.docx",
    });
  });

  it("does not generate or advance when the user cannot edit the document", async () => {
    mocks.canEditDocumentMock.mockResolvedValue(false);
    const app = new Elysia().use(exportRoutes);

    const response = await app.handle(
      new Request("http://localhost/runtime/doc-1/export/node-exec-1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "word",
          filename: "report.docx",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.generateExportMock).not.toHaveBeenCalled();
    expect(mocks.advanceNodeMock).not.toHaveBeenCalled();
  });
});
