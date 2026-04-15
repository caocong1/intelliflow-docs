import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmInputTransformMock: vi.fn(),
  handleFileUploadMock: vi.fn(),
  canEditDocumentMock: vi.fn(),
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
  isDocumentProjectMember: vi.fn(),
}));

vi.mock("./input-transform.service", () => ({
  confirmInputTransform: mocks.confirmInputTransformMock,
  handleFileUpload: mocks.handleFileUploadMock,
}));

import Elysia from "elysia";
import { inputTransformRoutes } from "./input-transform.routes";

describe("inputTransformRoutes", () => {
  beforeEach(() => {
    mocks.confirmInputTransformMock.mockReset();
    mocks.handleFileUploadMock.mockReset();
    mocks.canEditDocumentMock.mockReset().mockResolvedValue(true);
    mocks.confirmInputTransformMock.mockResolvedValue({ id: "node-exec-1" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("preserves file slot ids when confirming input transform output", async () => {
    const app = new Elysia().use(inputTransformRoutes);

    const response = await app.handle(
      new Request("http://localhost/runtime/doc-1/input-transform/node-exec-1/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formData: {
            field_ppt_request: "生成 PPT",
          },
          fileOutputs: [
            {
              fileId: "file-1",
              name: "reference.txt",
              parsedText: "参考内容",
              slotId: "reference_files",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.confirmInputTransformMock).toHaveBeenCalledWith({
      documentId: "doc-1",
      nodeExecutionId: "node-exec-1",
      formData: {
        field_ppt_request: "生成 PPT",
      },
      fileOutputs: [
        {
          fileId: "file-1",
          name: "reference.txt",
          parsedText: "参考内容",
          slotId: "reference_files",
        },
      ],
      userId: "user-1",
    });
  });
});
