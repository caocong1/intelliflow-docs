import { describe, expect, test } from "vitest";
import { MVP_FAMILY, MVP_VARIANTS, MVP_VARIANT_SCHEMAS, getMvpVariantDefinition } from "./family-library";

describe("ppt-mvp family library", () => {
  test("registers a single coherent page family", () => {
    expect(MVP_FAMILY.familyId).toBe("doubao_light_tech_v1");
    expect(MVP_FAMILY.variants.length).toBe(6);
    expect(new Set(MVP_FAMILY.variants.map((variant) => variant.familyId)).size).toBe(1);
    expect(new Set(MVP_FAMILY.variants.map((variant) => variant.pageType))).toEqual(new Set([
      "cover",
      "toc",
      "comparison",
      "timeline",
      "process",
      "device_overview",
    ]));
  });

  test("keeps variant definitions and schemas aligned", () => {
    expect(MVP_VARIANTS.length).toBe(MVP_VARIANT_SCHEMAS.length);
    for (const variant of MVP_VARIANTS) {
      const schema = getMvpVariantDefinition(variant.variantId)?.schema;
      expect(schema?.variantId).toBe(variant.variantId);
      expect(schema?.pageType).toBe(variant.pageType);
    }
  });
});
