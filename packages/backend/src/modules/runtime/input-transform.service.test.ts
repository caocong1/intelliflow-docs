import { describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../db/schema", () => ({
  documents: {},
  nodeExecutions: {},
  workflows: {},
}));
vi.mock("../files/files.service", () => ({
  getUploadPath: vi.fn(),
  insertDocumentFile: vi.fn(),
}));

import { buildFileSlots, resolveFileOutputSlotId } from "./input-transform.service";

describe("input transform file slot persistence", () => {
  it("falls back to field.id when file field has no explicit fileSlotId", () => {
    expect(resolveFileOutputSlotId({ id: "tender_file" })).toBe("tender_file");
    expect(resolveFileOutputSlotId({ id: "tender_file", fileSlotId: "slot-a" })).toBe("slot-a");
  });

  it("builds fileSlots for file fields without explicit fileSlotId", () => {
    const result = buildFileSlots(
      [
        {
          fileId: "file-1",
          name: "招标文件.pdf",
          parsedText: "招标正文",
          slotId: "tender_file",
        },
      ],
      [
        {
          id: "tender_file",
          label: "招标文件",
          type: "file",
          required: true,
        },
      ],
    );

    expect(result).toEqual({
      tender_file: {
        text: "招标正文",
        files: [{ fileId: "file-1", name: "招标文件.pdf" }],
      },
    });
  });

  it("ignores files whose slotId is not declared by any file field", () => {
    const result = buildFileSlots(
      [
        {
          fileId: "file-1",
          name: "招标文件.pdf",
          parsedText: "招标正文",
          slotId: "unknown_slot",
        },
      ],
      [
        {
          id: "tender_file",
          label: "招标文件",
          type: "file",
          required: true,
        },
      ],
    );

    expect(result).toEqual({});
  });
});
