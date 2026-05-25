import type { DeckPlan, DeckSlide } from "./types";

const PAGE_SEQUENCE: DeckSlide["pageType"][] = [
  "cover",
  "agenda",
  "problem",
  "strategy",
  "architecture",
  "capability",
  "governance",
  "scenario",
  "timeline",
  "metrics",
  "risk",
  "closing",
  "section",
  "table",
  "summary",
];

const TITLE_BY_TYPE: Record<DeckSlide["pageType"], string> = {
  cover: "AI 驱动的企业知识中台建设方案与落地路线图",
  agenda: "汇报目录",
  section: "推进原则",
  problem: "现状痛点与建设必要性",
  strategy: "战略价值与管理收益",
  architecture: "总体架构与能力分层",
  capability: "核心能力体系",
  governance: "数据治理与安全体系",
  scenario: "试点场景设计",
  timeline: "实施路线图",
  metrics: "投入产出测算",
  table: "方案对比与决策建议",
  risk: "风险与治理机制",
  summary: "关键结论",
  closing: "总结与立项请求",
  comparison: "方案对比分析",
  process: "流程与步骤",
  roadmap: "未来路线图",
  team: "团队与分工",
  quote: "关键引用与评价",
  chart: "数据图表分析",
  contact: "联系方式与下一步",
};

export function buildFallbackDeckPlan(input: {
  prompt: string;
  slideCount: number;
  style: string;
  reason: string;
}): DeckPlan {
  const topic = inferTopic(input.prompt);
  const audience = inferAudience(input.prompt);
  const pageTypes = buildPageTypes(input.slideCount);

  return {
    title: topic,
    subtitle: "面向集团管理层的正式汇报",
    audience,
    visualDirection:
      "正式商务、咨询公司风，以石墨黑和深海军蓝为主色，配合高亮青蓝与琥珀金，呈现高管级 AI 战略汇报质感。",
    theme: {
      palette: ["0B1220", "111827", "38BDF8", "F59E0B"],
      mood: "正式、冷静、战略、科技、可信",
      referenceKeywords: [
        "executive AI strategy deck",
        "enterprise knowledge command center",
        "premium consulting",
      ],
      visualMotif: "深色知识网络、发光治理环、企业能力地图、路线图光轨",
      paletteDominance: "石墨黑/深海军蓝 65%，雾白 20%，高亮青蓝 10%，琥珀金 5%",
    },
    slides: pageTypes.map((pageType, index) =>
      buildSlide({
        index,
        pageType,
        topic,
        prompt: input.prompt,
        reason: input.reason,
      }),
    ),
  };
}

function buildPageTypes(slideCount: number): DeckSlide["pageType"][] {
  return Array.from(
    { length: slideCount },
    (_, index) => PAGE_SEQUENCE[index % PAGE_SEQUENCE.length],
  );
}

function inferTopic(prompt: string): string {
  const themeMatch = prompt.match(/主题为\s*([^。；;]+)/)?.[1]?.trim();
  if (themeMatch) return themeMatch.slice(0, 80);
  const firstSentence = prompt
    .split(/[。；;\n]/)
    .find((part) => part.trim().length > 0)
    ?.trim();
  return (firstSentence || "企业知识中台建设方案").slice(0, 80);
}

function inferAudience(prompt: string): string {
  const audienceMatch = prompt.match(/受众\s*([^；;。]+)/)?.[1]?.trim();
  return audienceMatch || "集团管理层、业务负责人、信息化负责人和财务负责人";
}

function buildSlide(input: {
  index: number;
  pageType: DeckSlide["pageType"];
  topic: string;
  prompt: string;
  reason: string;
}): DeckSlide {
  const title = input.index === 0 ? input.topic : TITLE_BY_TYPE[input.pageType];
  const contentBlocks = buildBlocks(input.pageType);

  return {
    id: `slide-${input.index + 1}`,
    pageType: input.pageType,
    layoutPattern: `${input.pageType}-pattern-${input.index + 1}`,
    title,
    subtitle: input.index === 0 ? "建设方案与落地路线图" : undefined,
    keyMessage: buildKeyMessage(input.pageType),
    contentBlocks,
    chart:
      input.pageType === "metrics"
        ? {
            title: "投入产出假设",
            labels: ["效率提升", "重复劳动下降", "知识复用提升"],
            values: [35, 20, 60],
            unit: "%",
          }
        : input.pageType === "chart"
          ? {
              title: "关键数据对比",
              labels: ["效率提升", "成本下降", "知识复用", "错误率降低"],
              values: [35, 20, 60, 15],
              unit: "%",
              chartType: "bar",
            }
          : undefined,
    table:
      input.pageType === "table"
        ? {
            title: "推进方案对比",
            headers: ["方案", "优势", "约束"],
            rows: [
              ["单点工具", "启动快", "难沉淀集团能力"],
              ["知识中台", "可复用、可治理", "需要统一投入"],
              ["外包交付", "短期省人力", "长期成本不可控"],
            ],
          }
        : undefined,
    timeline:
      input.pageType === "timeline"
        ? [
            { label: "试点验证", description: "选择高频知识场景，验证效率和质量收益", date: "Q1" },
            { label: "能力扩展", description: "接入治理、安全、权限和运营指标", date: "Q2" },
            { label: "集团推广", description: "形成标准化能力包和预算闭环", date: "Q3" },
          ]
        : undefined,
    visualPrompt: buildVisualPrompt(input.pageType),
    speakerNotes:
      input.index === 0
        ? `说明本材料基于用户需求自动生成；若模型规划失败，系统已使用保底 DeckPlan 继续生成，原因：${input.reason}。`
        : `围绕“${title}”说明管理层关注点、预算判断和试点授权建议，强调可衡量收益与风险治理。`,
    layoutIntent: "正文左对齐，保留左右 0.5 inch 安全边距，不使用标题下划线装饰。",
    contentDensity: input.pageType === "cover" || input.pageType === "closing" ? "low" : "medium",
    visualHierarchy: "标题、关键判断、三条管理要点、右侧或底部视觉元素。",
  };
}

function buildBlocks(pageType: DeckSlide["pageType"]) {
  const blockMap: Record<
    DeckSlide["pageType"],
    Array<{ heading: string; body: string; emphasis: "normal" | "strong" | "metric" }>
  > = {
    cover: [
      { heading: "汇报目标", body: "争取预算、试点授权和跨部门协同机制。", emphasis: "strong" },
      {
        heading: "决策焦点",
        body: "从知识资产治理切入，支撑集团级 AI 应用落地。",
        emphasis: "normal",
      },
    ],
    agenda: [
      { heading: "为什么建设", body: "现状痛点、战略价值和管理收益。", emphasis: "normal" },
      { heading: "如何建设", body: "总体架构、核心能力和治理安全。", emphasis: "normal" },
      { heading: "如何落地", body: "试点场景、路线图、投入产出和风险治理。", emphasis: "normal" },
    ],
    section: [
      { heading: "价值牵引", body: "先验证高频场景，再推广共性能力。", emphasis: "strong" },
      { heading: "治理前置", body: "权限、安全、质量和运营指标同步设计。", emphasis: "normal" },
    ],
    problem: [
      {
        heading: "知识分散",
        body: "制度、案例、经验和数据散落在多个系统，检索和复用成本高。",
        emphasis: "strong",
      },
      {
        heading: "流程割裂",
        body: "知识沉淀与业务流程脱节，员工依赖人工问询和重复整理。",
        emphasis: "normal",
      },
      {
        heading: "口径不一",
        body: "管理层缺少统一、可信、可追溯的知识与决策依据。",
        emphasis: "normal",
      },
    ],
    strategy: [
      {
        heading: "组织效率",
        body: "把知识资产嵌入业务流程，缩短查找、判断和审批周期。",
        emphasis: "strong",
      },
      {
        heading: "AI 底座",
        body: "为智能问答、辅助决策和自动化协作提供统一知识基础。",
        emphasis: "normal",
      },
      {
        heading: "资产复用",
        body: "形成可运营的集团知识资产，提升跨部门复用率。",
        emphasis: "metric",
      },
    ],
    architecture: [
      { heading: "接入层", body: "连接文档库、业务系统、数据平台和协同工具。", emphasis: "normal" },
      { heading: "治理层", body: "统一标签、权限、质量、脱敏和审计。", emphasis: "strong" },
      { heading: "服务层", body: "提供检索、问答、推荐、摘要和流程助手能力。", emphasis: "normal" },
      { heading: "运营层", body: "以指标驱动知识更新、场景扩展和价值复盘。", emphasis: "normal" },
    ],
    capability: [
      { heading: "知识采集", body: "自动解析制度、案例、项目材料和业务问答。", emphasis: "normal" },
      { heading: "语义检索", body: "支持跨系统、跨格式、可追溯的知识检索。", emphasis: "strong" },
      { heading: "智能生成", body: "生成报告、方案、FAQ 和决策摘要。", emphasis: "normal" },
      { heading: "运营反馈", body: "通过使用数据持续优化知识质量。", emphasis: "normal" },
    ],
    governance: [
      { heading: "权限控制", body: "按组织、角色、密级和场景控制访问边界。", emphasis: "strong" },
      { heading: "数据安全", body: "支持脱敏、审计、留痕和风险告警。", emphasis: "normal" },
      {
        heading: "质量治理",
        body: "建立知识责任人、版本、有效期和可信来源机制。",
        emphasis: "normal",
      },
    ],
    scenario: [
      { heading: "经营分析", body: "快速汇总业务口径、历史案例和管理建议。", emphasis: "normal" },
      { heading: "制度问答", body: "面向员工提供可信、可追溯的政策解释。", emphasis: "strong" },
      { heading: "项目复盘", body: "沉淀成功经验、风险清单和可复用模板。", emphasis: "normal" },
    ],
    timeline: [
      { heading: "阶段一", body: "完成试点场景、数据接入和价值验证。", emphasis: "strong" },
      { heading: "阶段二", body: "扩展治理、安全和业务流程集成。", emphasis: "normal" },
      { heading: "阶段三", body: "集团推广并建立运营指标体系。", emphasis: "normal" },
    ],
    metrics: [
      { heading: "效率提升", body: "目标提升 35% 的知识查找和报告准备效率。", emphasis: "metric" },
      { heading: "成本下降", body: "减少重复整理、重复问询和外部咨询依赖。", emphasis: "metric" },
      { heading: "复用增长", body: "推动跨部门知识复用率提升 60%。", emphasis: "metric" },
    ],
    table: [
      { heading: "推荐方案", body: "以知识中台为主线，先试点再规模化推广。", emphasis: "strong" },
      { heading: "决策依据", body: "兼顾短期收益、长期复用和治理可控。", emphasis: "normal" },
    ],
    risk: [
      {
        heading: "数据风险",
        body: "通过权限、脱敏和审计降低敏感信息暴露风险。",
        emphasis: "strong",
      },
      { heading: "采纳风险", body: "以高频刚需场景和运营指标提升用户使用率。", emphasis: "normal" },
      { heading: "质量风险", body: "用责任人、版本和反馈机制保持知识可信。", emphasis: "normal" },
    ],
    summary: [
      {
        heading: "建设价值",
        body: "知识中台是集团级 AI 应用落地的关键基础设施。",
        emphasis: "strong",
      },
      { heading: "落地路径", body: "建议以试点授权启动，三阶段推进规模化。", emphasis: "normal" },
    ],
    closing: [
      { heading: "立项请求", body: "批准预算、试点范围和跨部门工作机制。", emphasis: "strong" },
      { heading: "下一步", body: "两周内完成试点方案、数据清单和实施计划。", emphasis: "normal" },
    ],
    comparison: [
      {
        heading: "方案 A",
        body: "知识中台方案，兼顾短期试点价值和长期集团复用。",
        emphasis: "strong",
      },
      { heading: "方案 B", body: "单点工具方案，启动快但难沉淀集团级能力。", emphasis: "normal" },
    ],
    process: [
      { heading: "需求分析", body: "梳理高频知识场景和关键度量指标。", emphasis: "normal" },
      { heading: "平台搭建", body: "完成架构设计、数据接入和核心服务部署。", emphasis: "strong" },
      { heading: "试点验证", body: "在 2-3 个业务场景完成价值验证。", emphasis: "normal" },
      { heading: "规模推广", body: "形成标准化能力包，推进集团推广。", emphasis: "normal" },
    ],
    roadmap: [
      { heading: "短期 (Q1)", body: "试点验证，选择高频知识场景。", emphasis: "strong" },
      { heading: "中期 (Q2)", body: "能力扩展，接入治理和安全机制。", emphasis: "normal" },
      { heading: "长期 (Q3)", body: "集团推广，形成标准化能力包。", emphasis: "normal" },
    ],
    team: [
      { heading: "项目 Owner", body: "负责整体推进和资源协调。", emphasis: "strong" },
      { heading: "技术负责人", body: "负责架构设计和技术选型。", emphasis: "normal" },
      { heading: "业务负责人", body: "负责场景选择和业务验证。", emphasis: "normal" },
    ],
    quote: [
      {
        heading: "关键判断",
        body: "知识中台是集团级 AI 应用落地的关键基础设施。",
        emphasis: "strong",
      },
    ],
    chart: [
      { heading: "效率提升", body: "年化效率提升 35%", emphasis: "metric" },
      { heading: "成本下降", body: "重复劳动下降 20%", emphasis: "metric" },
      { heading: "知识复用", body: "跨部门复用率提升 60%", emphasis: "metric" },
    ],
    contact: [
      { heading: "项目组", body: "contact@example.com", emphasis: "normal" },
      { heading: "发起部门", body: "信息化部 / 知识管理办公室", emphasis: "normal" },
    ],
  };
  return blockMap[pageType];
}

function buildKeyMessage(pageType: DeckSlide["pageType"]): string {
  const map: Record<DeckSlide["pageType"], string> = {
    cover: "本次汇报聚焦预算审批和试点授权。",
    agenda: "从价值、架构、落地和治理四个维度形成决策闭环。",
    section: "以价值牵引、治理前置、试点先行为推进原则。",
    problem: "当前知识分散、流程割裂和口径不一已经影响组织效率。",
    strategy: "知识中台将把分散经验转化为可复用、可治理、可运营的集团资产。",
    architecture: "总体架构需要同时覆盖接入、治理、服务和运营。",
    capability: "核心能力围绕采集、理解、检索、生成和运营反馈展开。",
    governance: "数据治理与安全必须前置，确保可信可控。",
    scenario: "试点场景优先选择高频、高价值、易衡量的业务问题。",
    timeline: "建议以三阶段路线图控制投入、风险和推广节奏。",
    metrics: "投入产出需要用效率、成本和复用指标闭环衡量。",
    table: "知识中台方案兼顾短期试点价值和长期集团复用。",
    risk: "风险可通过治理机制、运营指标和分阶段推进来控制。",
    summary: "建议批准试点授权并启动预算测算和实施准备。",
    closing: "请批准预算、试点范围和跨部门协同机制。",
    comparison: "知识中台方案兼顾短期试点价值和长期集团复用，优于单点工具方案。",
    process: "建议按照需求分析、平台搭建、试点验证、规模推广四步推进。",
    roadmap: "以 Q1 试点、Q2 扩展、Q3 推广的节奏控制风险和节奏。",
    team: "建议由信息化部牵头，联合业务部门和外部技术伙伴组成项目团队。",
    quote: "知识中台是集团级 AI 应用落地的关键基础设施。",
    chart: "关键指标显示效率、成本和复用均有显著改善空间。",
    contact: "欢迎联系项目组，期待与您深入交流。",
  };
  return map[pageType];
}

function buildVisualPrompt(pageType: DeckSlide["pageType"]): string {
  const motifs: Record<DeckSlide["pageType"], string> = {
    cover: "wide cinematic knowledge command center with subtle network depth",
    agenda: "minimal executive agenda map with numbered waypoints and semantic line icons",
    section: "chapter divider with large abstract knowledge gateway",
    problem: "fragmented enterprise systems converging into unresolved nodes",
    strategy: "strategic value flywheel and executive decision path",
    architecture: "layered platform architecture diagram, clean system blocks",
    capability: "capability map with modular service nodes",
    governance: "security shield, governance layers, audit trail diagram",
    scenario: "business pilot scenario workflow with people-free process lanes",
    timeline: "roadmap light trail with milestone nodes",
    metrics: "executive KPI dashboard bars without labels or numbers",
    table: "comparison matrix visual structure without text",
    risk: "risk control shield and mitigation loop",
    summary: "executive synthesis map with three converging paths",
    closing: "boardroom decision moment, abstract approval gateway",
    comparison: "side-by-side strategic comparison with split visual field",
    process: "process flow diagram with numbered steps and directional arrows",
    roadmap: "future timeline with glowing milestone markers on dark path",
    team: "professional team portrait placeholder with role indicators",
    quote: "large quotation mark motif with executive testimonial framing",
    chart: "bar chart visualization with layered metric indicators",
    contact: "professional contact card with geometric icon placeholders",
  };
  return [
    "premium dark executive enterprise AI knowledge platform visual",
    motifs[pageType],
    "graphite command center, luminous knowledge network, governance rings, strategic roadmap light trails",
    "deep navy and black, electric cyan accent, subtle amber highlights, formal consulting presentation background",
    "no text / no letters / no typography / no UI labels",
  ].join(", ");
}
