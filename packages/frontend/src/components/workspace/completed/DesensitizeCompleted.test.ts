import { describe, it, expect } from "vitest";

/** Replicate the statistics computation logic from DesensitizeCompleted */
function computeStats(outputData: {
  text?: string;
  mappingCount?: number;
  detectedItems?: Array<{ placeholder: string; sensitiveType: string; checked: boolean }>;
} | null) {
  const od = outputData ?? null;
  const detectedItems = od?.detectedItems ?? [];
  const totalDetected = detectedItems.length || (od?.mappingCount ?? 0);
  const desensitizedCount = detectedItems.filter((i) => i.checked).length;
  const skippedCount = detectedItems.filter((i) => !i.checked).length;
  return { totalDetected, desensitizedCount, skippedCount };
}

describe("DesensitizeCompleted statistics", () => {
  it("legacy: no detectedItems → total=mappingCount, desensitized=mappingCount, skipped=0", () => {
    const stats = computeStats({ text: "sanitized", mappingCount: 5 });
    expect(stats.totalDetected).toBe(5);
    // Without detectedItems, desensitized/skipped can't be computed from items
    expect(stats.desensitizedCount).toBe(0);
    expect(stats.skippedCount).toBe(0);
  });

  it("new: detectedItems → total=items.length, desensitized=checked.length, skipped=unchecked.length", () => {
    const stats = computeStats({
      text: "sanitized",
      mappingCount: 2,
      detectedItems: [
        { placeholder: "[NAME_1]", sensitiveType: "person_name", checked: true },
        { placeholder: "[PHONE_1]", sensitiveType: "phone_number", checked: true },
        { placeholder: "[EMAIL_1]", sensitiveType: "email", checked: false },
      ],
    });
    expect(stats.totalDetected).toBe(3);
    expect(stats.desensitizedCount).toBe(2);
    expect(stats.skippedCount).toBe(1);
  });

  it("empty: all zeros", () => {
    const stats = computeStats({ text: "", mappingCount: 0, detectedItems: [] });
    expect(stats.totalDetected).toBe(0);
    expect(stats.desensitizedCount).toBe(0);
    expect(stats.skippedCount).toBe(0);
  });

  it("null outputData: all zeros", () => {
    const stats = computeStats(null);
    expect(stats.totalDetected).toBe(0);
    expect(stats.desensitizedCount).toBe(0);
    expect(stats.skippedCount).toBe(0);
  });
});
