import { describe, it, expect } from "vitest";
import { getTypeLabel, maskOriginal } from "./desensitize-utils";

describe("getTypeLabel", () => {
  it("maps snake_case: person_name → 姓名", () => {
    expect(getTypeLabel("person_name")).toBe("姓名");
  });

  it("maps UPPER_CASE: PHONE_NUMBER → 手机号", () => {
    expect(getTypeLabel("PHONE_NUMBER")).toBe("手机号");
  });

  it("strips suffix: person_name_1 → 姓名", () => {
    expect(getTypeLabel("person_name_1")).toBe("姓名");
  });

  it("strips suffix + uppercase: PHONE_NUMBER_3 → 手机号", () => {
    expect(getTypeLabel("PHONE_NUMBER_3")).toBe("手机号");
  });

  it("unknown type returns original string", () => {
    expect(getTypeLabel("custom_type")).toBe("custom_type");
  });

  it("maps single-word keys: email → 邮箱", () => {
    expect(getTypeLabel("email")).toBe("邮箱");
  });

  it("maps uppercase single-word: ADDRESS → 地址", () => {
    expect(getTypeLabel("ADDRESS")).toBe("地址");
  });
});

describe("maskOriginal", () => {
  it("masks middle: 张三丰 → 张*丰", () => {
    expect(maskOriginal("张三丰")).toBe("张*丰");
  });

  it("short string ≤2 chars returns as-is", () => {
    expect(maskOriginal("张三")).toBe("张三");
    expect(maskOriginal("A")).toBe("A");
  });

  it("long string masks proportionally", () => {
    const result = maskOriginal("13812345678");
    // visible = floor(11/3) = 3
    expect(result).toBe("138*****678");
  });

  it("handles 3-char string", () => {
    const result = maskOriginal("ABC");
    expect(result).toBe("A*C");
  });
});
