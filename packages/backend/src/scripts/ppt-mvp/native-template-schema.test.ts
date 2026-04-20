import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { validateNativeTemplate } from "./native-template-schema";

function readFixture(name: string) {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), "docs/design/ppt-mvp/templates", name),
      "utf-8",
    ),
  );
}

describe("ppt-mvp native template schema", () => {
  test("accepts the current hand-authored native template fixture", () => {
    const result = validateNativeTemplate(
      readFixture("doubao-light-tech-v1.native-template.json"),
    );

    expect(result.valid).toBe(true);
    expect(result.template?.variantBindings).toHaveLength(6);
  });

  test("rejects duplicate variant bindings and missing primitive references", () => {
    const fixture = readFixture("doubao-light-tech-v1.native-template.json");
    fixture.variantBindings.push({
      ...fixture.variantBindings[0],
    });
    fixture.variantBindings[1].requiredPrimitives = ["missing_primitive"];

    const result = validateNativeTemplate(fixture);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate variant binding"),
        expect.stringContaining("missing primitive"),
      ]),
    );
  });
});
