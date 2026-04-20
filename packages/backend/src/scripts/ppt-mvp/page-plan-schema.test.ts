import { describe, expect, test } from "vitest";
import { validateMvpPagePlan } from "./page-plan-schema";

describe("ppt-mvp page plan schema", () => {
  test("accepts a valid minimal page plan", () => {
    const result = validateMvpPagePlan({
      version: "page_plan/v1",
      pages: [
        {
          pageId: "p1",
          pageType: "cover",
          variantHint: "cover_hero_image",
          title: "无线网络建设科普方案",
          subtitle: "场景选型 · 品牌选择 · 建设运维全指南",
          eyebrow: "WIRELESS NETWORK CONSTRUCTION GUIDE",
          audienceLine: "面向企业与公共机构的采购与 IT 负责人",
          speakerNote: "用一句话介绍这份演示的目标与受众。",
        },
      ],
    });

    expect(result.valid).toBe(true);
  });

  test("rejects invalid variant/pageType combinations", () => {
    const result = validateMvpPagePlan({
      version: "page_plan/v1",
      pages: [
        {
          pageId: "p1",
          pageType: "cover",
          variantHint: "timeline_horizontal_5",
          title: "bad",
          subtitle: "bad",
          eyebrow: "bad",
          audienceLine: "bad",
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  test("accepts new process and device overview page types", () => {
    const result = validateMvpPagePlan({
      version: "page_plan/v1",
      pages: [
        {
          pageId: "p5",
          pageType: "process",
          variantHint: "process_flow_5",
          title: "无线网络建设实施流程",
          eyebrow: "DELIVERY WORKFLOW",
          summary: "从勘测到验收形成闭环。",
          steps: [
            { index: "01", title: "勘测", detail: "核对覆盖与干扰" },
            { index: "02", title: "设计", detail: "确定点位与容量" },
            { index: "03", title: "部署", detail: "安装 AP 与交换" },
            { index: "04", title: "调优", detail: "优化信道与漫游" },
            { index: "05", title: "验收", detail: "压测并记录基线" },
          ],
        },
        {
          pageId: "p6",
          pageType: "device_overview",
          variantHint: "device_triptych_3",
          title: "主流 AP 形态与部署场景",
          eyebrow: "DEVICE OVERVIEW",
          summary: "不同 AP 形态适配不同部署环境。",
          devices: [
            { name: "面板 AP", scenario: "客房 / 小会议室", note: "隐蔽安装，兼顾回传" },
            { name: "吸顶 AP", scenario: "办公区 / 教室", note: "覆盖均匀，适合室内高并发" },
            { name: "室外 AP", scenario: "园区 / 室外通道", note: "防护更强，适合远距离覆盖" },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
  });
});
