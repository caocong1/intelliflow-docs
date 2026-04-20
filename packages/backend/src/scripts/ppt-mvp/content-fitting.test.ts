import { describe, expect, test } from "vitest";
import { fitPageToSchema } from "./content-fitting";
import { VARIANT_SCHEMAS } from "./variant-library";

describe("ppt-mvp content fitting", () => {
  test("truncates toc items and long fields to schema limits", () => {
    const schema = VARIANT_SCHEMAS.find((item) => item.variantId === "toc_card_grid_8");
    expect(schema).toBeDefined();

    const fitted = fitPageToSchema({
      pageId: "p2",
      pageType: "toc",
      variantHint: "toc_card_grid_8",
      title: "一个非常非常非常长的目录标题一定会被截断",
      eyebrow: "非常非常长的 eyebrow 用于测试截断逻辑是否生效",
      items: Array.from({ length: 10 }, (_, index) => ({
        index: `0${index + 1}`,
        title: `这是第 ${index + 1} 个目录项，它的标题也非常长需要被压缩`,
        subtitle: `这是第 ${index + 1} 个目录项说明，应该被限制在较短摘要内以避免页面拥挤和失真`,
      })),
    }, schema!);

    expect(Array.isArray(fitted.slots.items)).toBe(true);
    expect((fitted.slots.items as unknown[]).length).toBe(8);
    expect(fitted.warnings.length).toBeGreaterThan(0);
  });

  test("limits comparison bullets to 3 short items", () => {
    const schema = VARIANT_SCHEMAS.find((item) => item.variantId === "comparison_dual_image");
    expect(schema).toBeDefined();

    const fitted = fitPageToSchema({
      pageId: "p3",
      pageType: "comparison",
      variantHint: "comparison_dual_image",
      title: "无线与有线网络核心优势对比",
      eyebrow: "ARCHITECTURE COMPARISON",
      leftTitle: "无线网络 · 核心优势",
      rightTitle: "有线网络 · 主要局限",
      leftBullets: [
        "终端接入不受物理位置限制，具备极强移动性",
        "无需大规模布线，部署周期短、场景适配灵活",
        "扩容只需新增 AP 即可",
        "这一条应该被截断掉",
      ],
      rightBullets: [
        "终端依赖网口接入，位置固定",
        "布线改造成本高",
        "IoT 场景适配较差",
        "这一条也不应该存在",
      ],
    }, schema!);

    expect((fitted.slots.leftBullets as string[]).length).toBe(3);
    expect((fitted.slots.rightBullets as string[]).length).toBe(3);
    expect(fitted.warnings.length).toBeGreaterThan(0);
  });

  test("fits process steps to native family limits", () => {
    const schema = VARIANT_SCHEMAS.find((item) => item.variantId === "process_flow_5");
    expect(schema).toBeDefined();

    const fitted = fitPageToSchema({
      pageId: "p5",
      pageType: "process",
      variantHint: "process_flow_5",
      title: "无线网络建设实施流程",
      eyebrow: "DELIVERY WORKFLOW",
      summary: "从现场勘测到最终验收，五步闭环共同决定网络稳定性与可维护性。",
      steps: Array.from({ length: 6 }, (_, index) => ({
        index: `0${index + 1}`,
        title: `步骤 ${index + 1} 的标题非常长需要被压缩`,
        detail: `步骤 ${index + 1} 的说明也很长，需要被压缩到适合卡片展示的长度，避免 native 页面溢出`,
      })),
    }, schema!);

    expect(Array.isArray(fitted.slots.steps)).toBe(true);
    expect((fitted.slots.steps as unknown[]).length).toBe(5);
    expect(fitted.warnings.length).toBeGreaterThan(0);
  });

  test("fits device overview items to native family limits", () => {
    const schema = VARIANT_SCHEMAS.find((item) => item.variantId === "device_triptych_3");
    expect(schema).toBeDefined();

    const fitted = fitPageToSchema({
      pageId: "p6",
      pageType: "device_overview",
      variantHint: "device_triptych_3",
      title: "主流 AP 形态与部署场景",
      eyebrow: "DEVICE OVERVIEW",
      summary: "不同 AP 形态覆盖不同部署环境。",
      devices: [
        {
          name: "面板 AP 标题非常长需要被压缩",
          scenario: "客房 / 小会议室 / 走廊等多场景",
          note: "隐蔽安装，兼顾无线接入与有线回传，同时减少空间占用，说明非常长需要压缩",
        },
        {
          name: "吸顶 AP",
          scenario: "办公区 / 教室",
          note: "覆盖均匀，适合室内高并发环境",
        },
        {
          name: "室外 AP",
          scenario: "园区 / 通道",
          note: "防护要求更高，适合远距离覆盖",
        },
        {
          name: "额外设备",
          scenario: "无",
          note: "应被截断",
        },
      ],
    }, schema!);

    expect(Array.isArray(fitted.slots.devices)).toBe(true);
    expect((fitted.slots.devices as unknown[]).length).toBe(3);
    expect(fitted.warnings.length).toBeGreaterThan(0);
  });
});
