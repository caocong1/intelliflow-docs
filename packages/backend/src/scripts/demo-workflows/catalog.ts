import type {
  DemoDocumentTypeDefinition,
  DemoModelSelection,
  DemoWorkflowDefinition,
  WorkflowBlueprint,
} from "./builders";
import {
  buildBlockingExportGateRule,
  buildExportGateRule,
  buildQaArtifacts,
  buildRolePrompt,
  buildSystemPrompt,
  buildWorkflowFromBlueprint,
  clarificationSignalArtifact,
  conditionRef,
  dateField,
  datetimeField,
  fileField,
  inputVar,
  jsonArtifact,
  lines,
  markdownArtifact,
  modelOutputVar,
  multiselectField,
  numberField,
  promptSection,
  restoreContentRef,
  restoreVar,
  selectField,
  skipWhenAll,
  skipWhenNoInput,
  textField,
  textareaField,
} from "./builders";

export const DEMO_DOCUMENT_TYPES: DemoDocumentTypeDefinition[] = [
  {
    code: "solution_docs",
    name: "解决方案文档",
    description: "面向解决方案部门与售前团队的建议书、需求澄清和价值论证类文档。",
  },
  {
    code: "requirement_design",
    name: "需求设计文档",
    description: "面向软件研发部门的需求规格、概要设计与评审类文档。",
  },
  {
    code: "technical_analysis",
    name: "技术分析文档",
    description: "面向架构、研发与技术管理的技术选型、PoC 与复盘分析文档。",
  },
  {
    code: "implementation_delivery",
    name: "实施交付文档",
    description: "面向实施、交付与项目经理的计划、验收、周报类文档。",
  },
  {
    code: "procurement_selection",
    name: "采购比选文档",
    description: "面向采购、方案和项目团队的软硬件比选与推荐文档。",
  },
  {
    code: "meeting-notes",
    name: "会议纪要",
    description: "面向客户沟通、项目例会和跨部门同步的纪要与行动项文档。",
  },
];

function buildWorkflowDefinition(params: {
  documentTypeCode: string;
  name: string;
  description: string;
  isDefault: boolean;
  category: "flagship" | "medium";
  blueprint: WorkflowBlueprint;
  models: DemoModelSelection;
}): DemoWorkflowDefinition {
  const { nodes, edges } = buildWorkflowFromBlueprint(params.blueprint, params.models);
  return {
    documentTypeCode: params.documentTypeCode,
    name: params.name,
    description: params.description,
    isDefault: params.isDefault,
    category: params.category,
    nodes,
    edges,
  };
}

const PRD_SCOPE_MODULES = [
  "门户",
  "移动端",
  "管理后台",
  "数据中台",
  "接口平台",
  "设备接入",
  "智能分析",
  "开放生态",
];

function buildPrdProgressGateArtifact(id: string, name: string) {
  return jsonArtifact(
    id,
    name,
    "输出 JSON 对象，字段固定为 can_progress(boolean), blocking_count(number), reason(string)。若存在阻断级问题，can_progress=false。",
    [
      {
        name: "can_progress",
        type: "boolean",
        required: true,
        description: "是否允许进入下一轮改写",
      },
      {
        name: "blocking_count",
        type: "number",
        required: true,
        description: "阻断问题数量",
      },
      {
        name: "reason",
        type: "string",
        required: true,
        description: "门控说明",
      },
    ],
  );
}

function buildPrdFinalQaArtifacts() {
  return [
    markdownArtifact(
      "qa_report",
      "最终治理报告",
      "输出 Markdown，包含：PASS/WARNING/FAIL 结论、通过项、阻断项、回退建议。请面向正式发版前的产品文档治理。",
    ),
    jsonArtifact(
      "issue_list_final",
      "最终问题清单",
      "输出 JSON 数组，每项包含 issue_id, severity, category, description, suggestion, owner_hint。",
    ),
    jsonArtifact(
      "qa_gate",
      "最终导出门",
      "输出 JSON 对象，字段固定为 can_export(boolean), blocking_count(number), reason(string)。存在阻断项时 can_export=false。",
      [
        {
          name: "can_export",
          type: "boolean",
          required: true,
          description: "是否允许导出",
        },
        {
          name: "blocking_count",
          type: "number",
          required: true,
          description: "阻断问题数量",
        },
        {
          name: "reason",
          type: "string",
          required: true,
          description: "导出门控结论",
        },
      ],
    ),
  ];
}

function buildSolutionFlagship(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("project_name", "项目名称", true),
      textField("customer_name", "客户名称", true),
      selectField(
        "industry",
        "所属行业",
        ["制造", "能源", "政务", "教育", "医疗", "零售", "金融", "其他"],
        true,
      ),
      selectField(
        "sales_stage",
        "销售阶段",
        ["线索", "方案交流", "技术澄清", "商务谈判", "待签约"],
        true,
      ),
      selectField("budget_range", "预算区间", [
        "50万以下",
        "50-200万",
        "200-500万",
        "500万以上",
        "待确认",
      ]),
      dateField("target_due", "期望提交日期"),
      multiselectField("desired_modules", "目标模块", [
        "软件平台",
        "硬件设备",
        "实施服务",
        "系统集成",
        "运维服务",
        "培训支持",
      ]),
      textareaField("requirement_summary", "需求概述", true),
      textareaField("current_environment", "现网情况"),
      textareaField("differentiators", "已知优势与限制"),
      fileField("rfp_or_requirement", "RFP/需求材料"),
      fileField("architecture_reference", "架构参考材料", false, "unlimited"),
      fileField("case_studies", "案例材料", false, "unlimited"),
      fileField("service_catalog", "服务目录"),
      fileField("competitor_material", "竞品资料", false, "unlimited"),
      fileField("compliance_requirements", "合规要求材料"),
    ],
    preRestoreStages: [
      {
        id: "node_opportunity",
        label: "机会分析官",
        displayName: "机会分析官",
        systemPromptTemplate: buildSystemPrompt("机会分析官"),
        stepDescription: "识别客户画像、需求矩阵和风险基线",
        promptTemplate: buildRolePrompt({
          role: "机会分析官",
          mission: "请识别客户业务背景、关键诉求、采购驱动和决策风险，为后续方案设计建立统一基线。",
          sections: [
            promptSection(
              "项目基础信息",
              lines(
                `- 项目名称：${inputVar("project_name")}`,
                `- 客户名称：${inputVar("customer_name")}`,
                `- 行业：${inputVar("industry")}`,
                `- 销售阶段：${inputVar("sales_stage")}`,
                `- 预算区间：${inputVar("budget_range")}`,
                `- 期望提交日期：${inputVar("target_due")}`,
                `- 目标模块：${inputVar("desired_modules")}`,
              ),
            ),
            promptSection(
              "需求与背景材料",
              lines(
                `### 需求概述\n${inputVar("requirement_summary")}`,
                `### 现网情况\n${inputVar("current_environment")}`,
                `### 已知优势与限制\n${inputVar("differentiators")}`,
                `### RFP/需求材料\n${inputVar("rfp_or_requirement")}`,
                `### 合规要求\n${inputVar("compliance_requirements")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "customer_profile",
            "客户画像",
            "输出 Markdown，包含业务目标、关键角色、采购驱动、关注指标、潜在阻力。",
          ),
          jsonArtifact(
            "requirement_matrix",
            "需求矩阵",
            "输出 JSON 数组，每项包含 dimension, request, priority, evidence, owner_hint。",
          ),
          markdownArtifact(
            "risk_watchlist",
            "风险观察",
            "输出 Markdown，列出推进阶段最值得关注的业务、技术、商务风险及原因。",
          ),
          markdownArtifact(
            "missing_info",
            "缺失信息",
            "输出 Markdown，列出仍需补充的材料、关键问题和建议责任方。",
          ),
        ],
      },
      {
        id: "node_architecture",
        label: "方案架构师",
        displayName: "方案架构师",
        systemPromptTemplate: buildSystemPrompt("方案架构师"),
        stepDescription: "形成方案架构、集成思路和实施阶段划分",
        promptTemplate: buildRolePrompt({
          role: "方案架构师",
          mission: "请在客户基线之上设计解决方案主体，确保架构、集成路径和实施阶段可执行。",
          sections: [
            promptSection(
              "输入基线",
              lines(
                `### 客户画像\n${inputVar("customer_name")}\n${inputVar("industry")}\n${inputVar("sales_stage")}`,
                `### 上游客户画像\n${inputVar("project_name")}\n${inputVar("customer_name")}\n${inputVar("industry")}`,
                `### 客户画像详情\n${inputVar("project_name")}\n${inputVar("customer_name")}`,
                `### 机会分析结果\n${inputVar("project_name")}\n${inputVar("customer_name")}`,
                "### 机会分析官 · 客户画像\n{{node_opportunity.customer_profile}}",
                "### 机会分析官 · 需求矩阵\n{{node_opportunity.requirement_matrix}}",
                "### 机会分析官 · 风险观察\n{{node_opportunity.risk_watchlist}}",
              ),
            ),
            promptSection(
              "参考材料",
              lines(
                `### 架构参考\n${inputVar("architecture_reference")}`,
                `### 案例材料\n${inputVar("case_studies")}`,
                `### RFP/需求材料\n${inputVar("rfp_or_requirement")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "solution_architecture",
            "方案架构",
            "输出 Markdown，描述总体方案结构、关键组件、软硬件边界和关键依赖。",
          ),
          markdownArtifact(
            "integration_plan",
            "集成方案",
            "输出 Markdown，描述系统集成对象、数据流、接口边界和实施配合要求。",
          ),
          markdownArtifact(
            "implementation_phases",
            "实施阶段计划",
            "输出 Markdown，按阶段描述目标、输入、输出和关键里程碑。",
          ),
          jsonArtifact(
            "architecture_decisions",
            "关键设计决策",
            "输出 JSON 数组，每项包含 decision, rationale, tradeoff, prerequisite。",
          ),
        ],
      },
      {
        id: "node_strategy",
        label: "差异化策略师",
        displayName: "差异化策略师",
        systemPromptTemplate: buildSystemPrompt("差异化策略师"),
        stepDescription: "提炼竞争策略和赢单主张",
        executionRule: skipWhenNoInput("node_input", "competitor_material"),
        promptTemplate: buildRolePrompt({
          role: "差异化策略师",
          mission: "请结合竞品资料和既有优势，输出对外沟通时可使用的差异化卖点与赢单主张。",
          sections: [
            promptSection(
              "项目背景",
              lines(
                `- 项目名称：${inputVar("project_name")}`,
                `- 客户名称：${inputVar("customer_name")}`,
                `- 销售阶段：${inputVar("sales_stage")}`,
              ),
            ),
            promptSection(
              "参考输入",
              lines(
                `### 已知优势与限制\n${inputVar("differentiators")}`,
                `### 竞品资料\n${inputVar("competitor_material")}`,
                "### 上游架构方案\n{{node_architecture.solution_architecture}}",
                "### 上游实施阶段\n{{node_architecture.implementation_phases}}",
              ),
            ),
          ],
          closing:
            "若系统判定材料缺失而跳过本节点，无需补写任何内容；若执行，请按系统要求返回全部产物。",
        }),
        namedOutputs: [
          markdownArtifact(
            "differentiation_strategy",
            "差异化策略",
            "输出 Markdown，说明我们相对于竞品的优势点、规避点和推荐表述方式。",
          ),
          markdownArtifact(
            "win_themes",
            "赢单主张",
            "输出 Markdown，提炼 3-5 个高层沟通主张，每条都要有事实支撑。",
          ),
        ],
      },
      {
        id: "node_value",
        label: "价值与服务设计师",
        displayName: "价值与服务设计师",
        systemPromptTemplate: buildSystemPrompt("价值与服务设计师"),
        stepDescription: "补齐价值论证、服务承诺和落地 adoption 设计",
        promptTemplate: buildRolePrompt({
          role: "价值与服务设计师",
          mission: "请把技术方案转成业务价值、服务承诺和推进落地的动作设计。",
          sections: [
            promptSection(
              "上游方案",
              lines(
                "### 方案架构\n{{node_architecture.solution_architecture}}",
                "### 集成方案\n{{node_architecture.integration_plan}}",
                "### 实施阶段\n{{node_architecture.implementation_phases}}",
              ),
            ),
            promptSection(
              "补充材料",
              lines(
                `### 服务目录\n${inputVar("service_catalog")}`,
                `### 案例材料\n${inputVar("case_studies")}`,
                "### 风险观察\n{{node_opportunity.risk_watchlist}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "roi_summary",
            "ROI 摘要",
            "输出 Markdown，说明业务价值、成本收益、投入产出和阶段性预期。",
          ),
          markdownArtifact(
            "service_commitment",
            "服务承诺",
            "输出 Markdown，描述实施、运维、SLA、响应与协同方式。",
          ),
          markdownArtifact(
            "adoption_plan",
            "落地采用计划",
            "输出 Markdown，描述推广步骤、培训重点、里程碑和组织配合。",
          ),
        ],
      },
      {
        id: "node_qa",
        label: "正式质检官",
        displayName: "正式质检官",
        systemPromptTemplate: buildSystemPrompt("正式质检官"),
        stepDescription: "对方案包进行可导出质检",
        promptTemplate: buildRolePrompt({
          role: "正式质检官",
          mission: "请对方案文档包进行内部交付前审查，判断是否可直接导出给团队演示。",
          sections: [
            promptSection(
              "审查对象",
              lines(
                "### 客户画像\n{{node_opportunity.customer_profile}}",
                "### 需求矩阵\n{{node_opportunity.requirement_matrix}}",
                "### 方案架构\n{{node_architecture.solution_architecture}}",
                "### 集成方案\n{{node_architecture.integration_plan}}",
                "### ROI 摘要\n{{node_value.roi_summary}}",
                "### 服务承诺\n{{node_value.service_commitment}}",
              ),
            ),
            promptSection(
              "约束输入",
              lines(
                `### 合规要求\n${inputVar("compliance_requirements")}`,
                "### 缺失信息\n{{node_opportunity.missing_info}}",
              ),
            ),
          ],
          extraRules: ["当存在影响正式展示的重大缺口时，必须在 qa_gate 中阻断导出。"],
        }),
        namedOutputs: buildQaArtifacts(),
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_opportunity",
        outputId: "customer_profile",
        displayName: "机会分析官 · 客户画像",
      },
      {
        sourceNodeId: "node_architecture",
        outputId: "solution_architecture",
        displayName: "方案架构师 · 方案架构",
      },
      {
        sourceNodeId: "node_architecture",
        outputId: "integration_plan",
        displayName: "方案架构师 · 集成方案",
      },
      {
        sourceNodeId: "node_architecture",
        outputId: "implementation_phases",
        displayName: "方案架构师 · 实施阶段计划",
      },
      {
        sourceNodeId: "node_strategy",
        outputId: "differentiation_strategy",
        displayName: "差异化策略师 · 差异化策略",
      },
      {
        sourceNodeId: "node_strategy",
        outputId: "win_themes",
        displayName: "差异化策略师 · 赢单主张",
      },
      {
        sourceNodeId: "node_value",
        outputId: "roi_summary",
        displayName: "价值与服务设计师 · ROI 摘要",
      },
      {
        sourceNodeId: "node_value",
        outputId: "service_commitment",
        displayName: "价值与服务设计师 · 服务承诺",
      },
      {
        sourceNodeId: "node_value",
        outputId: "adoption_plan",
        displayName: "价值与服务设计师 · 落地采用计划",
      },
    ],
    postRestoreStages: [
      {
        id: "node_assembly",
        label: "正文装配师",
        displayName: "正文装配师",
        systemPromptTemplate: buildSystemPrompt("正文装配师"),
        stepDescription: "将已恢复内容装配为可演示的解决方案建议书",
        outputFormat: "markdown",
        promptTemplate: buildRolePrompt({
          role: "正文装配师",
          mission:
            "请将恢复后的核心内容装配成一份结构完整、适合内部演示的解决方案建议书 Markdown 正文。",
          sections: [
            promptSection(
              "文档基础信息",
              lines(
                `- 项目名称：${inputVar("project_name")}`,
                `- 客户名称：${inputVar("customer_name")}`,
                `- 行业：${inputVar("industry")}`,
                `- 销售阶段：${inputVar("sales_stage")}`,
              ),
            ),
            promptSection(
              "恢复后的正文材料",
              lines(
                `### 客户画像\n${restoreVar("node_opportunity", "customer_profile")}`,
                `### 方案架构\n${restoreVar("node_architecture", "solution_architecture")}`,
                `### 集成方案\n${restoreVar("node_architecture", "integration_plan")}`,
                `### 实施阶段\n${restoreVar("node_architecture", "implementation_phases")}`,
                `### 差异化策略\n${restoreVar("node_strategy", "differentiation_strategy")}`,
                `### 赢单主张\n${restoreVar("node_strategy", "win_themes")}`,
                `### ROI 摘要\n${restoreVar("node_value", "roi_summary")}`,
                `### 服务承诺\n${restoreVar("node_value", "service_commitment")}`,
                `### 落地采用计划\n${restoreVar("node_value", "adoption_plan")}`,
              ),
            ),
          ],
          extraRules: [
            "请直接输出最终正文，不要输出审查说明。",
            "建议使用一级、二级标题组织内容，并保留适量列表。",
          ],
        }),
      },
      {
        id: "node_compare",
        label: "专家复核对比",
        displayName: "专家复核对比",
        systemPromptTemplate: buildSystemPrompt("专家复核对比"),
        stepDescription: "由两位专家模型并行复核最终演示稿",
        modelMode: "compare",
        outputFormat: "markdown",
        promptTemplate: buildRolePrompt({
          role: "专家复核对比",
          mission:
            "请站在第二视角复核解决方案建议书，保留事实基础并直接输出可导出的优化后最终版本。",
          sections: [
            promptSection(
              "待复核正文",
              lines(`### 正文装配稿\n${modelOutputVar("node_assembly", models.primaryCloud.id)}`),
            ),
            promptSection(
              "质检参考",
              lines("### 质检报告\n{{node_qa.qa_report}}", "### 问题清单\n{{node_qa.issue_list}}"),
            ),
          ],
          extraRules: ["不要输出“审查意见”列表，直接给出修订后的最终正文。"],
        }),
      },
    ],
    exportRule: buildExportGateRule("node_qa"),
  };

  return buildWorkflowDefinition({
    documentTypeCode: "solution_docs",
    name: "解决方案建议书 Agent 流程",
    description:
      "11 节点旗舰流程，展示机会分析、架构设计、差异化策略、价值设计、质检、恢复、装配与双模型复核。",
    isDefault: true,
    category: "flagship",
    blueprint,
    models,
  });
}

function buildRequirementFlagship(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("document_title", "文档标题", true),
      textField("product_name", "产品/项目名称", true),
      textField("target_release", "目标版本", true),
      textareaField("target_users", "目标用户"),
      textareaField("business_goals", "业务目标", true),
      multiselectField("scope_modules", "涉及模块", [
        "门户",
        "移动端",
        "管理后台",
        "数据中台",
        "接口平台",
        "设备接入",
      ]),
      selectField("priority_principle", "优先级原则", [
        "价值优先",
        "风险优先",
        "交付优先",
        "平衡型",
      ]),
      textareaField("non_functional", "非功能需求"),
      textareaField("compliance_constraints", "合规约束"),
      fileField("prd_file", "PRD 文档"),
      fileField("prototype_file", "原型材料", false, "unlimited"),
      fileField("interface_docs", "接口资料", false, "unlimited"),
      fileField("current_architecture", "现有架构资料"),
    ],
    preRestoreStages: [
      {
        id: "node_requirement",
        label: "需求分析官",
        displayName: "需求分析官",
        systemPromptTemplate: buildSystemPrompt("需求分析官"),
        stepDescription: "梳理范围、用户故事和歧义点",
        promptTemplate: buildRolePrompt({
          role: "需求分析官",
          mission: "请将业务目标和原始材料转成可设计的范围基线、用户故事和待澄清问题。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 文档标题：${inputVar("document_title")}`,
                `- 产品/项目名称：${inputVar("product_name")}`,
                `- 目标版本：${inputVar("target_release")}`,
                `- 目标用户：${inputVar("target_users")}`,
                `- 涉及模块：${inputVar("scope_modules")}`,
                `- 优先级原则：${inputVar("priority_principle")}`,
              ),
            ),
            promptSection(
              "输入材料",
              lines(
                `### 业务目标\n${inputVar("business_goals")}`,
                `### 非功能需求\n${inputVar("non_functional")}`,
                `### 合规约束\n${inputVar("compliance_constraints")}`,
                `### PRD 文档\n${inputVar("prd_file")}`,
                `### 原型材料\n${inputVar("prototype_file")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "scope_baseline",
            "范围基线",
            "输出 JSON 对象，字段包含 in_scope, out_of_scope, constraints, acceptance_focus。",
          ),
          jsonArtifact(
            "user_story_map",
            "用户故事地图",
            "输出 JSON 数组，每项包含 persona, story, value, priority, module。",
          ),
          markdownArtifact(
            "ambiguity_list",
            "歧义清单",
            "输出 Markdown，列出仍需澄清的业务术语、流程和边界。",
          ),
          markdownArtifact("glossary", "术语表", "输出 Markdown，沉淀关键术语、缩写和统一口径。"),
        ],
      },
      {
        id: "node_domain",
        label: "领域设计师",
        displayName: "领域设计师",
        systemPromptTemplate: buildSystemPrompt("领域设计师"),
        stepDescription: "形成模块边界和领域模型",
        promptTemplate: buildRolePrompt({
          role: "领域设计师",
          mission: "请在需求基线上形成模块边界、领域模型和业务规则抽象。",
          sections: [
            promptSection(
              "上游需求结论",
              lines(
                "### 范围基线\n{{node_requirement.scope_baseline}}",
                "### 用户故事地图\n{{node_requirement.user_story_map}}",
                "### 歧义清单\n{{node_requirement.ambiguity_list}}",
                "### 术语表\n{{node_requirement.glossary}}",
              ),
            ),
            promptSection(
              "参考架构",
              lines(`### 现有架构资料\n${inputVar("current_architecture")}`),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "domain_model",
            "领域模型",
            "输出 Markdown，说明领域对象、职责和关键交互关系。",
          ),
          markdownArtifact(
            "module_boundaries",
            "模块边界",
            "输出 Markdown，说明模块职责、接口边界和依赖方向。",
          ),
          jsonArtifact(
            "business_rules",
            "业务规则",
            "输出 JSON 数组，每项包含 rule, trigger, expected_result, risk。",
          ),
        ],
      },
      {
        id: "node_api_data",
        label: "API/数据设计师",
        displayName: "API/数据设计师",
        systemPromptTemplate: buildSystemPrompt("API/数据设计师"),
        stepDescription: "规划接口与数据实体",
        promptTemplate: buildRolePrompt({
          role: "API/数据设计师",
          mission: "请把领域设计落成接口纲要、核心数据实体和集成假设。",
          sections: [
            promptSection(
              "上游设计",
              lines(
                "### 领域模型\n{{node_domain.domain_model}}",
                "### 模块边界\n{{node_domain.module_boundaries}}",
                "### 业务规则\n{{node_domain.business_rules}}",
              ),
            ),
            promptSection("输入材料", lines(`### 接口资料\n${inputVar("interface_docs")}`)),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "api_outline",
            "接口设计纲要",
            "输出 Markdown，说明关键接口、调用方式、输入输出和鉴权关注点。",
          ),
          markdownArtifact(
            "data_entities",
            "数据实体",
            "输出 Markdown，说明核心实体、关键字段和生命周期关系。",
          ),
          markdownArtifact(
            "integration_assumptions",
            "集成假设",
            "输出 Markdown，列出需要验证的外部依赖、环境前提和兼容假设。",
          ),
        ],
      },
      {
        id: "node_test",
        label: "测试策略师",
        displayName: "测试策略师",
        systemPromptTemplate: buildSystemPrompt("测试策略师"),
        stepDescription: "形成验收与测试策略",
        promptTemplate: buildRolePrompt({
          role: "测试策略师",
          mission: "请根据需求与设计结果制定测试矩阵、验收要点和可追踪关系。",
          sections: [
            promptSection(
              "设计输入",
              lines(
                "### 范围基线\n{{node_requirement.scope_baseline}}",
                "### 模块边界\n{{node_domain.module_boundaries}}",
                "### 接口设计纲要\n{{node_api_data.api_outline}}",
                "### 数据实体\n{{node_api_data.data_entities}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "test_matrix",
            "测试矩阵",
            "输出 JSON 数组，每项包含 area, test_type, objective, priority, owner。",
          ),
          markdownArtifact(
            "acceptance_points",
            "验收要点",
            "输出 Markdown，说明验收重点、关键通过标准和风险点。",
          ),
          markdownArtifact(
            "traceability_map",
            "需求追踪关系",
            "输出 Markdown，说明需求、设计、测试三者之间的映射关系。",
          ),
        ],
      },
      {
        id: "node_review",
        label: "评审官",
        displayName: "评审官",
        systemPromptTemplate: buildSystemPrompt("评审官"),
        stepDescription: "评估设计包是否可正式导出",
        promptTemplate: buildRolePrompt({
          role: "评审官",
          mission: "请对需求与设计成果进行正式评审，判断是否可以形成内部标准文档。",
          sections: [
            promptSection(
              "评审对象",
              lines(
                "### 范围基线\n{{node_requirement.scope_baseline}}",
                "### 用户故事地图\n{{node_requirement.user_story_map}}",
                "### 领域模型\n{{node_domain.domain_model}}",
                "### 模块边界\n{{node_domain.module_boundaries}}",
                "### 接口设计纲要\n{{node_api_data.api_outline}}",
                "### 数据实体\n{{node_api_data.data_entities}}",
                "### 测试矩阵\n{{node_test.test_matrix}}",
              ),
            ),
            promptSection("约束", lines(`### 合规约束\n${inputVar("compliance_constraints")}`)),
          ],
          extraRules: ["如存在范围断裂、设计缺口或无法执行的测试策略，必须阻断导出。"],
        }),
        namedOutputs: buildQaArtifacts(),
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_requirement",
        outputId: "ambiguity_list",
        displayName: "需求分析官 · 歧义清单",
      },
      {
        sourceNodeId: "node_requirement",
        outputId: "glossary",
        displayName: "需求分析官 · 术语表",
      },
      {
        sourceNodeId: "node_domain",
        outputId: "domain_model",
        displayName: "领域设计师 · 领域模型",
      },
      {
        sourceNodeId: "node_domain",
        outputId: "module_boundaries",
        displayName: "领域设计师 · 模块边界",
      },
      {
        sourceNodeId: "node_api_data",
        outputId: "api_outline",
        displayName: "API/数据设计师 · 接口设计纲要",
      },
      {
        sourceNodeId: "node_api_data",
        outputId: "data_entities",
        displayName: "API/数据设计师 · 数据实体",
      },
      {
        sourceNodeId: "node_api_data",
        outputId: "integration_assumptions",
        displayName: "API/数据设计师 · 集成假设",
      },
      {
        sourceNodeId: "node_test",
        outputId: "acceptance_points",
        displayName: "测试策略师 · 验收要点",
      },
      {
        sourceNodeId: "node_test",
        outputId: "traceability_map",
        displayName: "测试策略师 · 需求追踪关系",
      },
    ],
    postRestoreStages: [
      {
        id: "node_assembly",
        label: "设计装配师",
        displayName: "设计装配师",
        systemPromptTemplate: buildSystemPrompt("设计装配师"),
        stepDescription: "将恢复后的内容装配为需求规格与概要设计文档",
        modelMode: "compare",
        outputFormat: "markdown",
        promptTemplate: buildRolePrompt({
          role: "设计装配师",
          mission: "请把恢复后的分析与设计成果装配成一份规范的需求规格与概要设计文档。",
          sections: [
            promptSection(
              "文档基础信息",
              lines(
                `- 文档标题：${inputVar("document_title")}`,
                `- 产品/项目名称：${inputVar("product_name")}`,
                `- 目标版本：${inputVar("target_release")}`,
              ),
            ),
            promptSection(
              "恢复后的设计材料",
              lines(
                `### 歧义清单\n${restoreVar("node_requirement", "ambiguity_list")}`,
                `### 术语表\n${restoreVar("node_requirement", "glossary")}`,
                `### 领域模型\n${restoreVar("node_domain", "domain_model")}`,
                `### 模块边界\n${restoreVar("node_domain", "module_boundaries")}`,
                `### 接口设计纲要\n${restoreVar("node_api_data", "api_outline")}`,
                `### 数据实体\n${restoreVar("node_api_data", "data_entities")}`,
                `### 集成假设\n${restoreVar("node_api_data", "integration_assumptions")}`,
                `### 验收要点\n${restoreVar("node_test", "acceptance_points")}`,
                `### 需求追踪关系\n${restoreVar("node_test", "traceability_map")}`,
              ),
            ),
          ],
          extraRules: ["请直接输出最终文档正文，章节标题清晰，避免重复结论。"],
        }),
      },
    ],
    exportRule: buildExportGateRule("node_review"),
  };

  return buildWorkflowDefinition({
    documentTypeCode: "requirement_design",
    name: "需求规格与概要设计 Agent 流程",
    description: "10 节点旗舰流程，展示需求分析、领域设计、接口数据设计、测试策略和评审门控。",
    isDefault: true,
    category: "flagship",
    blueprint,
    models,
  });
}

function buildPrdReviewFlagship(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("document_title", "文档标题", true),
      textField("product_name", "产品/项目名称", true),
      textField("target_release", "目标版本", true),
      textareaField("target_users", "目标用户", true),
      textareaField("problem_statement", "问题定义", true),
      textareaField("business_goals", "业务目标", true),
      textareaField("core_scenarios", "核心场景", true),
      textareaField("success_metrics", "成功指标"),
      multiselectField("scope_modules", "范围模块", PRD_SCOPE_MODULES),
      textareaField("non_functional_requirements", "非功能要求"),
      textareaField("compliance_constraints", "合规约束"),
      textareaField("technical_constraints", "技术约束"),
      fileField("user_research_material", "用户研究材料", false, "unlimited"),
      fileField("competitor_material", "竞品材料", false, "unlimited"),
      fileField("prototype_material", "原型材料", false, "unlimited"),
      fileField("data_metric_material", "数据指标材料", false, "unlimited"),
      fileField("historical_prd", "已有 PRD/历史版本", false, "unlimited"),
    ],
    preRestoreStages: [
      {
        id: "node_facts",
        label: "事实基线官",
        displayName: "事实基线官",
        systemPromptTemplate: buildSystemPrompt("事实基线官"),
        stepDescription: "抽取事实基线、术语和边界约束",
        promptTemplate: buildRolePrompt({
          role: "事实基线官",
          mission: "请把输入材料整理成 PRD 起草可直接引用的事实基线、待确认问题和边界约束。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 文档标题：${inputVar("document_title")}`,
                `- 产品/项目名称：${inputVar("product_name")}`,
                `- 目标版本：${inputVar("target_release")}`,
                `- 目标用户：${inputVar("target_users")}`,
                `- 范围模块：${inputVar("scope_modules")}`,
              ),
            ),
            promptSection(
              "业务输入",
              lines(
                `### 问题定义\n${inputVar("problem_statement")}`,
                `### 业务目标\n${inputVar("business_goals")}`,
                `### 核心场景\n${inputVar("core_scenarios")}`,
                `### 成功指标\n${inputVar("success_metrics")}`,
                `### 非功能要求\n${inputVar("non_functional_requirements")}`,
                `### 合规约束\n${inputVar("compliance_constraints")}`,
                `### 技术约束\n${inputVar("technical_constraints")}`,
                `### 已有 PRD/历史版本\n${inputVar("historical_prd")}`,
              ),
            ),
          ],
          extraRules: ["所有缺失事实必须标为“待确认”，不得补造。"],
        }),
        namedOutputs: [
          jsonArtifact(
            "baseline_facts",
            "事实基线",
            "输出 JSON 对象，字段包含 problem, goals, users, scenarios, metrics, dependencies, unresolved_assumptions。",
          ),
          markdownArtifact(
            "missing_questions",
            "待确认问题",
            "输出 Markdown，按 P0/P1/P2 分组列出需要业务方补充确认的问题。",
          ),
          markdownArtifact("glossary", "术语表", "输出 Markdown，沉淀关键术语、定义和统一口径。"),
          markdownArtifact(
            "boundary_constraints",
            "边界约束",
            "输出 Markdown，列出合规、技术、资源、时间边界和不可突破条件。",
          ),
        ],
      },
      {
        id: "node_insight",
        label: "用户洞察官",
        displayName: "用户洞察官",
        systemPromptTemplate: buildSystemPrompt("用户洞察官"),
        stepDescription: "构建人群画像、场景和痛点证据",
        promptTemplate: buildRolePrompt({
          role: "用户洞察官",
          mission: "请基于研究材料、原型和业务目标，输出产品决策可用的用户洞察。",
          sections: [
            promptSection(
              "上游基线",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 待确认问题\n{{node_facts.missing_questions}}",
                "### 边界约束\n{{node_facts.boundary_constraints}}",
              ),
            ),
            promptSection(
              "用户证据",
              lines(
                `### 目标用户\n${inputVar("target_users")}`,
                `### 核心场景\n${inputVar("core_scenarios")}`,
                `### 用户研究材料\n${inputVar("user_research_material")}`,
                `### 原型材料\n${inputVar("prototype_material")}`,
                `### 数据指标材料\n${inputVar("data_metric_material")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "persona_pack",
            "用户画像包",
            "输出 Markdown，覆盖核心角色、目标、动机、阻碍、使用频率和成功标准。",
          ),
          jsonArtifact(
            "scenario_map",
            "场景地图",
            "输出 JSON 数组，每项包含 persona, scenario, trigger, current_flow, expected_flow, success_signal。",
          ),
          markdownArtifact(
            "painpoint_evidence",
            "痛点证据",
            "输出 Markdown，逐条列出痛点、证据、影响范围、优先级判断。",
          ),
        ],
      },
      {
        id: "node_competitor",
        label: "竞品策略官",
        displayName: "竞品策略官",
        systemPromptTemplate: buildSystemPrompt("竞品策略官"),
        stepDescription: "沉淀竞品对照与差异化策略",
        executionRule: skipWhenNoInput("node_input", "competitor_material"),
        promptTemplate: buildRolePrompt({
          role: "竞品策略官",
          mission: "请将竞品材料转成 PRD 可直接使用的对照矩阵、差异化方向和可借鉴模式。",
          sections: [
            promptSection(
              "业务与用户上下文",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 用户画像包\n{{node_insight.persona_pack}}",
                "### 痛点证据\n{{node_insight.painpoint_evidence}}",
              ),
            ),
            promptSection(
              "竞品输入",
              lines(
                `### 竞品材料\n${inputVar("competitor_material")}`,
                `### 原型材料\n${inputVar("prototype_material")}`,
                `### 已有 PRD/历史版本\n${inputVar("historical_prd")}`,
              ),
            ),
          ],
          extraRules: ["如竞品材料缺失或质量过低，请明确写“竞品证据不足”，不要假设市场事实。"],
        }),
        namedOutputs: [
          markdownArtifact(
            "competitor_matrix",
            "竞品对照矩阵",
            "输出 Markdown 表格，对比目标用户、核心能力、体验差异、弱项和空白位。",
          ),
          markdownArtifact(
            "differentiation_axes",
            "差异化方向",
            "输出 Markdown，说明应该强化、规避和不跟进的方向。",
          ),
          markdownArtifact(
            "pattern_notes",
            "模式借鉴",
            "输出 Markdown，列出可借鉴的交互/流程模式及适用前提。",
          ),
        ],
      },
      {
        id: "node_scope",
        label: "范围规划官",
        displayName: "范围规划官",
        systemPromptTemplate: buildSystemPrompt("范围规划官"),
        stepDescription: "形成范围矩阵、特性清单和版本切分",
        promptTemplate: buildRolePrompt({
          role: "范围规划官",
          mission: "请基于事实、洞察与竞品结论，形成可执行的版本范围与优先级切分。",
          sections: [
            promptSection(
              "输入结论",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 待确认问题\n{{node_facts.missing_questions}}",
                "### 用户画像包\n{{node_insight.persona_pack}}",
                "### 场景地图\n{{node_insight.scenario_map}}",
                "### 痛点证据\n{{node_insight.painpoint_evidence}}",
                "### 竞品对照矩阵\n{{node_competitor.competitor_matrix}}",
                "### 差异化方向\n{{node_competitor.differentiation_axes}}",
              ),
            ),
            promptSection(
              "范围约束",
              lines(
                `### 成功指标\n${inputVar("success_metrics")}`,
                `### 范围模块\n${inputVar("scope_modules")}`,
                `### 合规约束\n${inputVar("compliance_constraints")}`,
                `### 技术约束\n${inputVar("technical_constraints")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "scope_matrix",
            "范围矩阵",
            "输出 JSON 数组，每项包含 module, goal, in_scope, out_of_scope, rationale, risk。",
          ),
          jsonArtifact(
            "feature_backlog",
            "特性清单",
            "输出 JSON 数组，每项包含 feature, user_value, priority, release_bucket, dependency, acceptance_note。",
          ),
          markdownArtifact(
            "release_cut",
            "版本切分",
            "输出 Markdown，说明本期必须做、可延后、明确不做的版本切分方案。",
          ),
          markdownArtifact(
            "non_goals",
            "非目标",
            "输出 Markdown，明确本版本不承诺、不解决、不展开的事项。",
          ),
        ],
      },
      {
        id: "node_prd_v1",
        label: "PRD V1 起草委员会",
        displayName: "PRD V1 起草委员会",
        systemPromptTemplate: buildSystemPrompt("PRD V1 起草委员会"),
        stepDescription: "多模型并行起草 PRD V1",
        modelMode: "compare",
        compareModelCount: 4,
        promptTemplate: buildRolePrompt({
          role: "PRD V1 起草委员会",
          mission: "请将已有分析结论装配为一版完整、可评审的 PRD V1。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 文档标题：${inputVar("document_title")}`,
                `- 产品/项目名称：${inputVar("product_name")}`,
                `- 目标版本：${inputVar("target_release")}`,
              ),
            ),
            promptSection(
              "上游结论",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 待确认问题\n{{node_facts.missing_questions}}",
                "### 用户画像包\n{{node_insight.persona_pack}}",
                "### 场景地图\n{{node_insight.scenario_map}}",
                "### 痛点证据\n{{node_insight.painpoint_evidence}}",
                "### 竞品对照矩阵\n{{node_competitor.competitor_matrix}}",
                "### 差异化方向\n{{node_competitor.differentiation_axes}}",
                "### 范围矩阵\n{{node_scope.scope_matrix}}",
                "### 特性清单\n{{node_scope.feature_backlog}}",
                "### 版本切分\n{{node_scope.release_cut}}",
                "### 非目标\n{{node_scope.non_goals}}",
              ),
            ),
            promptSection(
              "原始材料",
              lines(
                `### 原型材料\n${inputVar("prototype_material")}`,
                `### 数据指标材料\n${inputVar("data_metric_material")}`,
                `### 已有 PRD/历史版本\n${inputVar("historical_prd")}`,
              ),
            ),
          ],
          extraRules: [
            "PRD 正文缺失处必须写“待确认”。",
            "decision_log_v1 必须包含“新增决定 / 保留争议 / 删除内容”三个小节。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "prd_v1",
            "PRD V1",
            "输出 Markdown 完整 PRD，至少包含背景、目标、用户、场景、需求范围、非功能要求、验收要点、风险与依赖。",
          ),
          markdownArtifact(
            "open_items_v1",
            "V1 未决事项",
            "输出 Markdown，列出待确认事项、决策风险、需要额外材料补齐的点。",
          ),
          markdownArtifact(
            "decision_log_v1",
            "V1 决策日志",
            "输出 Markdown，严格包含“新增决定 / 保留争议 / 删除内容”三个小节。",
          ),
        ],
      },
      {
        id: "node_review_v1",
        label: "V1 审稿委员会",
        displayName: "V1 审稿委员会",
        systemPromptTemplate: buildSystemPrompt("V1 审稿委员会"),
        stepDescription: "多模型并行审稿，产出第一轮修改简报",
        modelMode: "compare",
        compareModelCount: 4,
        promptTemplate: buildRolePrompt({
          role: "V1 审稿委员会",
          mission:
            "请站在资深产品评审视角，指出 PRD V1 的事实缺口、逻辑断裂、边界问题和可执行性风险。",
          sections: [
            promptSection(
              "评审对象",
              lines(
                "### PRD V1\n{{node_prd_v1.prd_v1}}",
                "### V1 未决事项\n{{node_prd_v1.open_items_v1}}",
                "### V1 决策日志\n{{node_prd_v1.decision_log_v1}}",
              ),
            ),
            promptSection(
              "对照基线",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 边界约束\n{{node_facts.boundary_constraints}}",
                "### 范围矩阵\n{{node_scope.scope_matrix}}",
                "### 版本切分\n{{node_scope.release_cut}}",
                `### 合规约束\n${inputVar("compliance_constraints")}`,
                `### 技术约束\n${inputVar("technical_constraints")}`,
              ),
            ),
          ],
          extraRules: [
            "issue_list_v1 只记录可执行问题，不写空泛意见。",
            "rewrite_brief_v1 必须按阻断项优先级组织，禁止遗漏已发现问题。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "review_v1",
            "V1 评审结论",
            "输出 Markdown，包含整体评价、亮点、主要缺口、是否建议进入改写。",
          ),
          jsonArtifact(
            "issue_list_v1",
            "V1 问题清单",
            "输出 JSON 数组，每项包含 issue_id, severity, category, description, suggestion, affected_section。",
          ),
          markdownArtifact(
            "rewrite_brief_v1",
            "V1 改写简报",
            "输出 Markdown，面向下一轮重写，给出逐项改写要求和取舍原则。",
          ),
          buildPrdProgressGateArtifact("quality_gate_v1", "V1 质量门"),
        ],
      },
      {
        id: "node_prd_v2",
        label: "PRD V2 重写委员会",
        displayName: "PRD V2 重写委员会",
        systemPromptTemplate: buildSystemPrompt("PRD V2 重写委员会"),
        stepDescription: "根据 V1 问题清单重写 PRD V2",
        modelMode: "compare",
        compareModelCount: 4,
        promptTemplate: buildRolePrompt({
          role: "PRD V2 重写委员会",
          mission: "请严格根据上一轮问题清单与改写简报重写 PRD，生成更稳定的 V2 版本。",
          sections: [
            promptSection(
              "重写输入",
              lines(
                "### PRD V1\n{{node_prd_v1.prd_v1}}",
                "### V1 未决事项\n{{node_prd_v1.open_items_v1}}",
                "### V1 决策日志\n{{node_prd_v1.decision_log_v1}}",
                "### V1 问题清单\n{{node_review_v1.issue_list_v1}}",
                "### V1 改写简报\n{{node_review_v1.rewrite_brief_v1}}",
                "### V1 质量门\n{{node_review_v1.quality_gate_v1}}",
              ),
            ),
            promptSection(
              "硬约束",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 边界约束\n{{node_facts.boundary_constraints}}",
                "### 非目标\n{{node_scope.non_goals}}",
              ),
            ),
          ],
          extraRules: [
            "上一轮 issue_list 是硬约束，必须逐项处理，不允许回归已解决问题。",
            "change_log_v2 必须包含“新增决定 / 保留争议 / 删除内容”三个小节。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "prd_v2",
            "PRD V2",
            "输出 Markdown 完整 PRD V2，修复已知问题并保留必要的待确认项。",
          ),
          markdownArtifact(
            "change_log_v2",
            "V2 变更日志",
            "输出 Markdown，严格包含“新增决定 / 保留争议 / 删除内容”三个小节，并说明对应修复点。",
          ),
          markdownArtifact(
            "open_items_v2",
            "V2 未决事项",
            "输出 Markdown，列出仍无法落定的事项及其影响。",
          ),
        ],
      },
      {
        id: "node_review_v2",
        label: "V2 审稿委员会",
        displayName: "V2 审稿委员会",
        systemPromptTemplate: buildSystemPrompt("V2 审稿委员会"),
        stepDescription: "多模型并行审稿，收敛到最终定稿简报",
        modelMode: "compare",
        compareModelCount: 4,
        promptTemplate: buildRolePrompt({
          role: "V2 审稿委员会",
          mission: "请评估 PRD V2 是否已具备定稿条件，并输出最终定稿的修改要求。",
          sections: [
            promptSection(
              "评审对象",
              lines(
                "### PRD V2\n{{node_prd_v2.prd_v2}}",
                "### V2 变更日志\n{{node_prd_v2.change_log_v2}}",
                "### V2 未决事项\n{{node_prd_v2.open_items_v2}}",
              ),
            ),
            promptSection(
              "历史约束",
              lines(
                "### V1 问题清单\n{{node_review_v1.issue_list_v1}}",
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 范围矩阵\n{{node_scope.scope_matrix}}",
                "### 版本切分\n{{node_scope.release_cut}}",
              ),
            ),
          ],
          extraRules: [
            "issue_list_v2 只保留仍未解决或新暴露的问题，不得把已关闭问题重新打开，除非明确说明回归原因。",
            "rewrite_brief_v2 必须可直接驱动最终定稿。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "review_v2",
            "V2 评审结论",
            "输出 Markdown，说明是否建议进入最终定稿，以及仍需修正的重点。",
          ),
          jsonArtifact(
            "issue_list_v2",
            "V2 问题清单",
            "输出 JSON 数组，每项包含 issue_id, severity, category, description, suggestion, regression(boolean)。",
          ),
          markdownArtifact(
            "rewrite_brief_v2",
            "V2 改写简报",
            "输出 Markdown，给出最终定稿应完成的修改动作、删改边界和保留项。",
          ),
          buildPrdProgressGateArtifact("quality_gate_v2", "V2 质量门"),
        ],
      },
      {
        id: "node_final_prd",
        label: "Final PRD 合成委员会",
        displayName: "Final PRD 合成委员会",
        systemPromptTemplate: buildSystemPrompt("Final PRD 合成委员会"),
        stepDescription: "吸收两轮评审后生成最终 PRD 包",
        modelMode: "compare",
        compareModelCount: 4,
        promptTemplate: buildRolePrompt({
          role: "Final PRD 合成委员会",
          mission: "请结合两轮评审结果生成最终可交付的 PRD，并补齐交接材料。",
          sections: [
            promptSection(
              "定稿输入",
              lines(
                "### PRD V2\n{{node_prd_v2.prd_v2}}",
                "### V2 变更日志\n{{node_prd_v2.change_log_v2}}",
                "### V2 未决事项\n{{node_prd_v2.open_items_v2}}",
                "### V2 问题清单\n{{node_review_v2.issue_list_v2}}",
                "### V2 改写简报\n{{node_review_v2.rewrite_brief_v2}}",
                "### V2 质量门\n{{node_review_v2.quality_gate_v2}}",
              ),
            ),
            promptSection(
              "基线回看",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 术语表\n{{node_facts.glossary}}",
                "### 边界约束\n{{node_facts.boundary_constraints}}",
              ),
            ),
          ],
          extraRules: [
            "必须落实上一轮 issue_list 与 rewrite_brief，不允许遗漏。",
            "final_change_log 必须包含“新增决定 / 保留争议 / 删除内容”三个小节。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "prd_final",
            "最终 PRD",
            "输出 Markdown 完整最终 PRD，章节完整、口径统一、缺失事实明确标注待确认。",
          ),
          markdownArtifact(
            "final_change_log",
            "最终变更日志",
            "输出 Markdown，严格包含“新增决定 / 保留争议 / 删除内容”三个小节，并给出对应影响。",
          ),
          markdownArtifact(
            "handoff_notes",
            "交接说明",
            "输出 Markdown，说明研发交接要点、依赖清单、风险、未决项与后续建议。",
          ),
        ],
      },
      {
        id: "node_governance",
        label: "最终治理门",
        displayName: "最终治理门",
        systemPromptTemplate: buildSystemPrompt("最终治理门"),
        stepDescription: "给最终 PRD 做导出前门控",
        modelMode: "compare",
        compareModelCount: 4,
        promptTemplate: buildRolePrompt({
          role: "最终治理门",
          mission:
            "请作为发版前治理评审，对最终 PRD 包做最后一次完整检查并给出是否允许导出的结论。",
          sections: [
            promptSection(
              "治理对象",
              lines(
                "### 最终 PRD\n{{node_final_prd.prd_final}}",
                "### 最终变更日志\n{{node_final_prd.final_change_log}}",
                "### 交接说明\n{{node_final_prd.handoff_notes}}",
              ),
            ),
            promptSection(
              "门控依据",
              lines(
                "### 事实基线\n{{node_facts.baseline_facts}}",
                "### 待确认问题\n{{node_facts.missing_questions}}",
                "### 范围矩阵\n{{node_scope.scope_matrix}}",
                "### 非目标\n{{node_scope.non_goals}}",
                `### 合规约束\n${inputVar("compliance_constraints")}`,
                `### 技术约束\n${inputVar("technical_constraints")}`,
              ),
            ),
          ],
          extraRules: ["只要存在会影响导出的重大缺口，qa_gate.can_export 必须为 false。"],
        }),
        namedOutputs: buildPrdFinalQaArtifacts(),
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_final_prd",
        outputId: "prd_final",
        displayName: "Final PRD 合成委员会 · 最终 PRD",
      },
      {
        sourceNodeId: "node_final_prd",
        outputId: "final_change_log",
        displayName: "Final PRD 合成委员会 · 最终变更日志",
      },
      {
        sourceNodeId: "node_final_prd",
        outputId: "handoff_notes",
        displayName: "Final PRD 合成委员会 · 交接说明",
      },
      {
        sourceNodeId: "node_governance",
        outputId: "qa_report",
        displayName: "最终治理门 · 最终治理报告",
      },
    ],
    exportRule: buildBlockingExportGateRule("node_governance"),
    exportContentMapping: [
      restoreContentRef("node_final_prd", "prd_final"),
      restoreContentRef("node_final_prd", "final_change_log"),
      restoreContentRef("node_final_prd", "handoff_notes"),
      restoreContentRef("node_governance", "qa_report"),
    ],
  };

  return buildWorkflowDefinition({
    documentTypeCode: "requirement_design",
    name: "产品经理 PRD 多模型评审流程",
    description:
      "14 节点旗舰流程，展示 PRD 的事实基线、洞察、竞品、范围、双轮起草评审和最终治理门控。",
    isDefault: false,
    category: "flagship",
    blueprint,
    models,
  });
}

function buildTechnicalFlagship(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("analysis_title", "分析主题", true),
      textareaField("business_goal", "业务目标", true),
      multiselectField("decision_drivers", "决策驱动因素", [
        "性能",
        "成本",
        "交付速度",
        "可维护性",
        "安全合规",
        "国产化",
        "扩展性",
      ]),
      textareaField("current_stack", "现有技术栈"),
      textareaField("candidate_options", "候选方案"),
      textField("expected_scale", "预估规模"),
      dateField("target_deadline", "目标时间"),
      textareaField("required_capabilities", "关键能力要求"),
      textareaField("cost_constraints", "成本约束"),
      textareaField("compliance_constraints", "合规约束"),
      fileField("benchmark_material", "评测材料", false, "unlimited"),
      fileField("architecture_notes", "架构笔记", false, "unlimited"),
      fileField("reference_cases", "参考案例", false, "unlimited"),
    ],
    preRestoreStages: [
      {
        id: "node_baseline",
        label: "基线分析官",
        displayName: "基线分析官",
        systemPromptTemplate: buildSystemPrompt("基线分析官"),
        stepDescription: "识别决策标准和现状基线",
        promptTemplate: buildRolePrompt({
          role: "基线分析官",
          mission: "请提炼技术决策所需的评估标准、当前现状和关键未知项。",
          sections: [
            promptSection(
              "主题信息",
              lines(
                `- 分析主题：${inputVar("analysis_title")}`,
                `- 业务目标：${inputVar("business_goal")}`,
                `- 决策驱动：${inputVar("decision_drivers")}`,
                `- 预估规模：${inputVar("expected_scale")}`,
                `- 目标时间：${inputVar("target_deadline")}`,
              ),
            ),
            promptSection(
              "输入材料",
              lines(
                `### 现有技术栈\n${inputVar("current_stack")}`,
                `### 候选方案\n${inputVar("candidate_options")}`,
                `### 关键能力要求\n${inputVar("required_capabilities")}`,
                `### 架构笔记\n${inputVar("architecture_notes")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "decision_criteria",
            "决策标准",
            "输出 JSON 数组，每项包含 criterion, weight_hint, reason, must_have。",
          ),
          markdownArtifact(
            "current_state_summary",
            "现状摘要",
            "输出 Markdown，概括现状约束、已有能力和关键问题。",
          ),
          markdownArtifact(
            "assumptions_and_unknowns",
            "假设与未知项",
            "输出 Markdown，列出评估中需要验证的假设、边界和未知风险。",
          ),
        ],
      },
      {
        id: "node_evaluation",
        label: "方案评估官",
        displayName: "方案评估官",
        systemPromptTemplate: buildSystemPrompt("方案评估官"),
        stepDescription: "输出候选方案对比与技术权衡",
        promptTemplate: buildRolePrompt({
          role: "方案评估官",
          mission: "请依据决策标准比较候选方案，形成技术权衡与风险判断。",
          sections: [
            promptSection(
              "输入基线",
              lines(
                "### 决策标准\n{{node_baseline.decision_criteria}}",
                "### 现状摘要\n{{node_baseline.current_state_summary}}",
                "### 假设与未知项\n{{node_baseline.assumptions_and_unknowns}}",
                `### 候选方案\n${inputVar("candidate_options")}`,
                `### 评测材料\n${inputVar("benchmark_material")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "option_matrix",
            "方案对比矩阵",
            "输出 JSON 数组，每项包含 option, strengths, weaknesses, fit_score, blocker。",
          ),
          markdownArtifact(
            "technical_tradeoffs",
            "技术权衡",
            "输出 Markdown，说明各方案的利弊、适用边界和推荐理由。",
          ),
          markdownArtifact(
            "risk_map",
            "风险图谱",
            "输出 Markdown，列出主要风险、触发条件和缓解建议。",
          ),
        ],
      },
      {
        id: "node_cost",
        label: "成本资源分析官",
        displayName: "成本资源分析官",
        systemPromptTemplate: buildSystemPrompt("成本资源分析官"),
        stepDescription: "评估资源投入和 TCO",
        promptTemplate: buildRolePrompt({
          role: "成本资源分析官",
          mission: "请基于技术方案对资源投入、TCO 和运营约束进行判断。",
          sections: [
            promptSection(
              "评估基础",
              lines(
                "### 方案对比矩阵\n{{node_evaluation.option_matrix}}",
                "### 技术权衡\n{{node_evaluation.technical_tradeoffs}}",
                "### 风险图谱\n{{node_evaluation.risk_map}}",
              ),
            ),
            promptSection(
              "成本与约束",
              lines(
                `### 成本约束\n${inputVar("cost_constraints")}`,
                `### 合规约束\n${inputVar("compliance_constraints")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "resource_estimate",
            "资源估算",
            "输出 JSON 对象，字段包含 people, timeline, environment, cost_band, confidence。",
          ),
          markdownArtifact(
            "tco_summary",
            "TCO 摘要",
            "输出 Markdown，说明建设成本、运维成本和长期影响。",
          ),
          markdownArtifact(
            "operating_constraints",
            "运营约束",
            "输出 Markdown，说明落地过程中的环境、组织和制度限制。",
          ),
        ],
      },
      {
        id: "node_poc",
        label: "PoC 规划师",
        displayName: "PoC 规划师",
        systemPromptTemplate: buildSystemPrompt("PoC 规划师"),
        stepDescription: "输出验证计划与上线前检查项",
        promptTemplate: buildRolePrompt({
          role: "PoC 规划师",
          mission: "请设计用于验证候选方案的 PoC 计划和验收指标。",
          sections: [
            promptSection(
              "规划输入",
              lines(
                "### 决策标准\n{{node_baseline.decision_criteria}}",
                "### 方案对比矩阵\n{{node_evaluation.option_matrix}}",
                "### 资源估算\n{{node_cost.resource_estimate}}",
                "### TCO 摘要\n{{node_cost.tco_summary}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "poc_plan",
            "PoC 方案",
            "输出 Markdown，描述目标、范围、样本、步骤、交付物和责任分工。",
          ),
          jsonArtifact(
            "validation_metrics",
            "验证指标",
            "输出 JSON 数组，每项包含 metric, target, method, owner。",
          ),
          markdownArtifact(
            "rollout_readiness",
            "上线准备建议",
            "输出 Markdown，说明正式落地前需要补齐的准备项。",
          ),
        ],
      },
      {
        id: "node_conclusion",
        label: "正式结论官",
        displayName: "正式结论官",
        systemPromptTemplate: buildSystemPrompt("正式结论官"),
        stepDescription: "输出正式推荐结论和导出门控",
        promptTemplate: buildRolePrompt({
          role: "正式结论官",
          mission: "请给出正式技术结论，形成推荐栈、落地路线与最终导出门控。",
          sections: [
            promptSection(
              "结论基础",
              lines(
                "### 决策标准\n{{node_baseline.decision_criteria}}",
                "### 技术权衡\n{{node_evaluation.technical_tradeoffs}}",
                "### 风险图谱\n{{node_evaluation.risk_map}}",
                "### TCO 摘要\n{{node_cost.tco_summary}}",
                "### PoC 方案\n{{node_poc.poc_plan}}",
                "### 验证指标\n{{node_poc.validation_metrics}}",
              ),
            ),
          ],
          extraRules: ["当方案缺少落地前提、指标不可验证或推荐理由不充分时，必须阻断导出。"],
        }),
        namedOutputs: [
          markdownArtifact(
            "recommendation_stack",
            "推荐技术栈",
            "输出 Markdown，给出推荐方案、适用范围和不推荐条件。",
          ),
          markdownArtifact(
            "landing_roadmap",
            "落地路线",
            "输出 Markdown，说明实施阶段、关键里程碑和依赖项。",
          ),
          markdownArtifact(
            "executive_summary",
            "管理摘要",
            "输出 Markdown，面向管理层说明推荐原因、风险和下一步动作。",
          ),
          ...buildQaArtifacts(),
        ],
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_baseline",
        outputId: "current_state_summary",
        displayName: "基线分析官 · 现状摘要",
      },
      {
        sourceNodeId: "node_baseline",
        outputId: "assumptions_and_unknowns",
        displayName: "基线分析官 · 假设与未知项",
      },
      {
        sourceNodeId: "node_evaluation",
        outputId: "technical_tradeoffs",
        displayName: "方案评估官 · 技术权衡",
      },
      {
        sourceNodeId: "node_evaluation",
        outputId: "risk_map",
        displayName: "方案评估官 · 风险图谱",
      },
      {
        sourceNodeId: "node_cost",
        outputId: "tco_summary",
        displayName: "成本资源分析官 · TCO 摘要",
      },
      {
        sourceNodeId: "node_cost",
        outputId: "operating_constraints",
        displayName: "成本资源分析官 · 运营约束",
      },
      { sourceNodeId: "node_poc", outputId: "poc_plan", displayName: "PoC 规划师 · PoC 方案" },
      {
        sourceNodeId: "node_poc",
        outputId: "rollout_readiness",
        displayName: "PoC 规划师 · 上线准备建议",
      },
      {
        sourceNodeId: "node_conclusion",
        outputId: "recommendation_stack",
        displayName: "正式结论官 · 推荐技术栈",
      },
      {
        sourceNodeId: "node_conclusion",
        outputId: "landing_roadmap",
        displayName: "正式结论官 · 落地路线",
      },
      {
        sourceNodeId: "node_conclusion",
        outputId: "executive_summary",
        displayName: "正式结论官 · 管理摘要",
      },
    ],
    postRestoreStages: [
      {
        id: "node_compare",
        label: "专家复核对比",
        displayName: "专家复核对比",
        systemPromptTemplate: buildSystemPrompt("专家复核对比"),
        stepDescription: "双模型复核技术结论并给出最终报告",
        modelMode: "compare",
        outputFormat: "markdown",
        promptTemplate: buildRolePrompt({
          role: "专家复核对比",
          mission:
            "请综合恢复后的技术分析材料，直接输出一份适合内部评审与采购决策的最终技术分析报告。",
          sections: [
            promptSection(
              "恢复后的分析材料",
              lines(
                `### 现状摘要\n${restoreVar("node_baseline", "current_state_summary")}`,
                `### 假设与未知项\n${restoreVar("node_baseline", "assumptions_and_unknowns")}`,
                `### 技术权衡\n${restoreVar("node_evaluation", "technical_tradeoffs")}`,
                `### 风险图谱\n${restoreVar("node_evaluation", "risk_map")}`,
                `### TCO 摘要\n${restoreVar("node_cost", "tco_summary")}`,
                `### 运营约束\n${restoreVar("node_cost", "operating_constraints")}`,
                `### PoC 方案\n${restoreVar("node_poc", "poc_plan")}`,
                `### 上线准备建议\n${restoreVar("node_poc", "rollout_readiness")}`,
                `### 推荐技术栈\n${restoreVar("node_conclusion", "recommendation_stack")}`,
                `### 落地路线\n${restoreVar("node_conclusion", "landing_roadmap")}`,
                `### 管理摘要\n${restoreVar("node_conclusion", "executive_summary")}`,
              ),
            ),
            promptSection(
              "复核参考",
              lines(
                "### 质检报告\n{{node_conclusion.qa_report}}",
                "### 问题清单\n{{node_conclusion.issue_list}}",
              ),
            ),
          ],
          extraRules: ["不要输出比较点评，直接给出修订后的最终报告正文。"],
        }),
      },
    ],
    exportRule: buildExportGateRule("node_conclusion"),
  };

  return buildWorkflowDefinition({
    documentTypeCode: "technical_analysis",
    name: "技术选型与 PoC 结论 Agent 流程",
    description: "10 节点旗舰流程，展示技术决策标准、对比矩阵、PoC 规划和双模型结论复核。",
    isDefault: true,
    category: "flagship",
    blueprint,
    models,
  });
}

function buildImplementationFlagship(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("project_name", "项目名称", true),
      textField("customer_name", "客户名称", true),
      selectField("delivery_mode", "交付模式", ["onsite", "hybrid", "remote"], true),
      selectField("hardware_installation", "是否涉及硬件安装", ["yes", "no"], true),
      textareaField("project_scope", "项目范围", true),
      textareaField("current_site_summary", "现场情况"),
      dateField("start_date", "计划启动日期"),
      dateField("go_live_date", "计划上线日期"),
      numberField("team_size", "投入人数"),
      textareaField("deployment_constraints", "部署约束"),
      textareaField("training_audience", "培训对象"),
      fileField("acceptance_standard", "验收标准"),
      fileField("site_survey_file", "现场调研材料"),
      fileField("dependency_docs", "依赖资料", false, "unlimited"),
    ],
    preRestoreStages: [
      {
        id: "node_planning",
        label: "交付规划官",
        displayName: "交付规划官",
        systemPromptTemplate: buildSystemPrompt("交付规划官"),
        stepDescription: "形成 WBS 和里程碑计划",
        promptTemplate: buildRolePrompt({
          role: "交付规划官",
          mission: "请根据交付范围和目标时间形成执行层面的工作分解与项目治理建议。",
          sections: [
            promptSection(
              "项目基础",
              lines(
                `- 项目名称：${inputVar("project_name")}`,
                `- 客户名称：${inputVar("customer_name")}`,
                `- 交付模式：${inputVar("delivery_mode")}`,
                `- 是否涉及硬件安装：${inputVar("hardware_installation")}`,
                `- 计划启动日期：${inputVar("start_date")}`,
                `- 计划上线日期：${inputVar("go_live_date")}`,
                `- 投入人数：${inputVar("team_size")}`,
              ),
            ),
            promptSection(
              "范围与输入",
              lines(
                `### 项目范围\n${inputVar("project_scope")}`,
                `### 现场情况\n${inputVar("current_site_summary")}`,
                `### 依赖资料\n${inputVar("dependency_docs")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "wbs",
            "WBS",
            "输出 JSON 数组，每项包含 phase, task, owner, duration, dependency。",
          ),
          jsonArtifact(
            "milestone_plan",
            "里程碑计划",
            "输出 JSON 数组，每项包含 milestone, target_date, deliverable, risk_note。",
          ),
          markdownArtifact(
            "governance_mechanism",
            "治理机制",
            "输出 Markdown，说明例会、升级路径、角色职责和沟通机制。",
          ),
        ],
      },
      {
        id: "node_deployment",
        label: "部署工程师",
        displayName: "部署工程师",
        systemPromptTemplate: buildSystemPrompt("部署工程师"),
        stepDescription: "输出部署手册和回滚策略",
        promptTemplate: buildRolePrompt({
          role: "部署工程师",
          mission: "请根据交付计划和环境约束形成部署手册、环境清单和回滚策略。",
          sections: [
            promptSection(
              "上游规划",
              lines(
                "### WBS\n{{node_planning.wbs}}",
                "### 里程碑计划\n{{node_planning.milestone_plan}}",
                "### 治理机制\n{{node_planning.governance_mechanism}}",
              ),
            ),
            promptSection(
              "部署输入",
              lines(
                `### 部署约束\n${inputVar("deployment_constraints")}`,
                `### 现场调研材料\n${inputVar("site_survey_file")}`,
                `### 依赖资料\n${inputVar("dependency_docs")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "deployment_runbook",
            "部署手册",
            "输出 Markdown，描述环境准备、安装步骤、验收检查和责任人。",
          ),
          jsonArtifact(
            "environment_checklist",
            "环境检查表",
            "输出 JSON 数组，每项包含 item, expected_state, owner, blocking_risk。",
          ),
          markdownArtifact(
            "rollback_strategy",
            "回滚策略",
            "输出 Markdown，说明回滚触发条件、执行步骤和影响范围。",
          ),
        ],
      },
      {
        id: "node_onsite",
        label: "现场实施官",
        displayName: "现场实施官",
        systemPromptTemplate: buildSystemPrompt("现场实施官"),
        stepDescription: "规划现场实施与协同安排",
        executionRule: skipWhenAll([
          {
            sourceRef: conditionRef("node_input", "delivery_mode"),
            operator: "equals",
            value: "remote",
          },
          {
            sourceRef: conditionRef("node_input", "hardware_installation"),
            operator: "equals",
            value: "no",
          },
        ]),
        promptTemplate: buildRolePrompt({
          role: "现场实施官",
          mission: "请围绕现场实施、到场配合、设备进场和跨团队协调形成执行建议。",
          sections: [
            promptSection(
              "输入信息",
              lines(
                `- 交付模式：${inputVar("delivery_mode")}`,
                `- 是否涉及硬件安装：${inputVar("hardware_installation")}`,
                `### 现场情况\n${inputVar("current_site_summary")}`,
                "### 部署手册\n{{node_deployment.deployment_runbook}}",
              ),
            ),
          ],
          closing: "若系统判定本节点不适用将自动跳过；若执行，请返回全部产物。",
        }),
        namedOutputs: [
          markdownArtifact(
            "onsite_plan",
            "现场实施方案",
            "输出 Markdown，描述现场实施步骤、注意事项和资源安排。",
          ),
          markdownArtifact(
            "coordination_requirements",
            "现场协同要求",
            "输出 Markdown，说明需要客户、施工、网络、供应商配合的事项。",
          ),
        ],
      },
      {
        id: "node_training",
        label: "培训切换官",
        displayName: "培训切换官",
        systemPromptTemplate: buildSystemPrompt("培训切换官"),
        stepDescription: "形成培训、切换和沟通计划",
        promptTemplate: buildRolePrompt({
          role: "培训切换官",
          mission: "请结合上线阶段制定培训计划、切换安排和沟通节奏。",
          sections: [
            promptSection(
              "上游输入",
              lines(
                "### 里程碑计划\n{{node_planning.milestone_plan}}",
                "### 部署手册\n{{node_deployment.deployment_runbook}}",
                `### 培训对象\n${inputVar("training_audience")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "training_plan",
            "培训计划",
            "输出 Markdown，说明对象、内容、节奏、产出和考核方式。",
          ),
          markdownArtifact(
            "cutover_plan",
            "切换方案",
            "输出 Markdown，说明上线窗口、切换步骤、确认点和回退预案。",
          ),
          markdownArtifact(
            "communication_plan",
            "沟通计划",
            "输出 Markdown，说明周会、日报、升级沟通和关键提醒事项。",
          ),
        ],
      },
      {
        id: "node_acceptance",
        label: "验收经理",
        displayName: "验收经理",
        systemPromptTemplate: buildSystemPrompt("验收经理"),
        stepDescription: "输出验收矩阵和交接清单",
        promptTemplate: buildRolePrompt({
          role: "验收经理",
          mission: "请根据范围、部署方案和培训切换安排形成验收与交接建议。",
          sections: [
            promptSection(
              "输入基础",
              lines(
                "### WBS\n{{node_planning.wbs}}",
                "### 部署手册\n{{node_deployment.deployment_runbook}}",
                "### 培训计划\n{{node_training.training_plan}}",
                "### 切换方案\n{{node_training.cutover_plan}}",
                `### 验收标准\n${inputVar("acceptance_standard")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "acceptance_matrix",
            "验收矩阵",
            "输出 JSON 数组，每项包含 acceptance_item, evidence, owner, timing, blocker。",
          ),
          jsonArtifact(
            "handover_checklist",
            "交接清单",
            "输出 JSON 数组，每项包含 deliverable, receiver, prerequisite, due_date。",
          ),
          markdownArtifact(
            "readiness_summary",
            "验收准备摘要",
            "输出 Markdown，说明是否具备验收条件及需要补齐的事项。",
          ),
        ],
      },
      {
        id: "node_risk_qa",
        label: "风险质检官",
        displayName: "风险质检官",
        systemPromptTemplate: buildSystemPrompt("风险质检官"),
        stepDescription: "交付前风险审查与导出门控",
        promptTemplate: buildRolePrompt({
          role: "风险质检官",
          mission: "请审查交付计划、部署方案和验收安排是否存在阻断性交付风险。",
          sections: [
            promptSection(
              "审查对象",
              lines(
                "### WBS\n{{node_planning.wbs}}",
                "### 里程碑计划\n{{node_planning.milestone_plan}}",
                "### 部署手册\n{{node_deployment.deployment_runbook}}",
                "### 回滚策略\n{{node_deployment.rollback_strategy}}",
                "### 培训计划\n{{node_training.training_plan}}",
                "### 切换方案\n{{node_training.cutover_plan}}",
                "### 验收矩阵\n{{node_acceptance.acceptance_matrix}}",
                "### 验收准备摘要\n{{node_acceptance.readiness_summary}}",
              ),
            ),
          ],
          extraRules: ["当计划缺少验收闭环、回滚预案或关键依赖不可控时，必须阻断导出。"],
        }),
        namedOutputs: buildQaArtifacts(),
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_planning",
        outputId: "governance_mechanism",
        displayName: "交付规划官 · 治理机制",
      },
      {
        sourceNodeId: "node_deployment",
        outputId: "deployment_runbook",
        displayName: "部署工程师 · 部署手册",
      },
      {
        sourceNodeId: "node_deployment",
        outputId: "rollback_strategy",
        displayName: "部署工程师 · 回滚策略",
      },
      {
        sourceNodeId: "node_onsite",
        outputId: "onsite_plan",
        displayName: "现场实施官 · 现场实施方案",
      },
      {
        sourceNodeId: "node_onsite",
        outputId: "coordination_requirements",
        displayName: "现场实施官 · 现场协同要求",
      },
      {
        sourceNodeId: "node_training",
        outputId: "training_plan",
        displayName: "培训切换官 · 培训计划",
      },
      {
        sourceNodeId: "node_training",
        outputId: "cutover_plan",
        displayName: "培训切换官 · 切换方案",
      },
      {
        sourceNodeId: "node_training",
        outputId: "communication_plan",
        displayName: "培训切换官 · 沟通计划",
      },
      {
        sourceNodeId: "node_acceptance",
        outputId: "readiness_summary",
        displayName: "验收经理 · 验收准备摘要",
      },
    ],
    postRestoreStages: [
      {
        id: "node_assembly",
        label: "装配师",
        displayName: "装配师",
        systemPromptTemplate: buildSystemPrompt("装配师"),
        stepDescription: "形成最终实施交付与验收文档",
        modelMode: "compare",
        outputFormat: "markdown",
        promptTemplate: buildRolePrompt({
          role: "装配师",
          mission: "请把恢复后的交付内容装配成一份适合内部展示的实施交付与验收策划文档。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 项目名称：${inputVar("project_name")}`,
                `- 客户名称：${inputVar("customer_name")}`,
                `- 交付模式：${inputVar("delivery_mode")}`,
                `- 是否涉及硬件安装：${inputVar("hardware_installation")}`,
              ),
            ),
            promptSection(
              "恢复后的正文材料",
              lines(
                `### 治理机制\n${restoreVar("node_planning", "governance_mechanism")}`,
                `### 部署手册\n${restoreVar("node_deployment", "deployment_runbook")}`,
                `### 回滚策略\n${restoreVar("node_deployment", "rollback_strategy")}`,
                `### 现场实施方案\n${restoreVar("node_onsite", "onsite_plan")}`,
                `### 现场协同要求\n${restoreVar("node_onsite", "coordination_requirements")}`,
                `### 培训计划\n${restoreVar("node_training", "training_plan")}`,
                `### 切换方案\n${restoreVar("node_training", "cutover_plan")}`,
                `### 沟通计划\n${restoreVar("node_training", "communication_plan")}`,
                `### 验收准备摘要\n${restoreVar("node_acceptance", "readiness_summary")}`,
              ),
            ),
          ],
          extraRules: ["请输出一份正式的交付计划正文，不要包含审查结论。"],
        }),
      },
    ],
    exportRule: buildExportGateRule("node_risk_qa"),
  };

  return buildWorkflowDefinition({
    documentTypeCode: "implementation_delivery",
    name: "实施交付与验收策划 Agent 流程",
    description: "11 节点旗舰流程，展示交付计划、部署、现场实施、培训切换、验收和风险门控。",
    isDefault: true,
    category: "flagship",
    blueprint,
    models,
  });
}

function buildProcurementFlagship(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("procurement_title", "采购主题", true),
      textField("buyer_department", "采购部门", true),
      selectField(
        "procurement_type",
        "采购类型",
        ["software", "hardware", "integrated", "service"],
        true,
      ),
      numberField("budget_cap", "预算上限"),
      dateField("target_deadline", "目标决策日期"),
      textareaField("mandatory_brands", "限定品牌/条件"),
      multiselectField("evaluation_focus", "评估重点", [
        "价格",
        "性能",
        "实施周期",
        "售后服务",
        "兼容性",
        "国产化",
        "安全合规",
      ]),
      textareaField("service_requirements", "服务要求"),
      fileField("candidate_vendor_docs", "候选厂商资料", false, "unlimited"),
      fileField("bom_file", "BOM 清单"),
      fileField("spec_docs", "规格书", false, "unlimited"),
      fileField("compliance_docs", "合规资料", false, "unlimited"),
      fileField("negotiation_notes", "议价记录"),
    ],
    preRestoreStages: [
      {
        id: "node_normalize",
        label: "规格归一官",
        displayName: "规格归一官",
        systemPromptTemplate: buildSystemPrompt("规格归一官"),
        stepDescription: "统一采购需求和评估维度",
        promptTemplate: buildRolePrompt({
          role: "规格归一官",
          mission: "请把采购需求、规格和服务要求归一化，形成可比较的基线。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 采购主题：${inputVar("procurement_title")}`,
                `- 采购部门：${inputVar("buyer_department")}`,
                `- 采购类型：${inputVar("procurement_type")}`,
                `- 预算上限：${inputVar("budget_cap")}`,
                `- 目标决策日期：${inputVar("target_deadline")}`,
                `- 评估重点：${inputVar("evaluation_focus")}`,
              ),
            ),
            promptSection(
              "输入材料",
              lines(
                `### 服务要求\n${inputVar("service_requirements")}`,
                `### 限定品牌/条件\n${inputVar("mandatory_brands")}`,
                `### BOM 清单\n${inputVar("bom_file")}`,
                `### 规格书\n${inputVar("spec_docs")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "spec_baseline",
            "规格基线",
            "输出 JSON 对象，字段包含 must_have, nice_to_have, hard_limit, evaluation_scope。",
          ),
          markdownArtifact(
            "normalized_requirements",
            "归一化需求",
            "输出 Markdown，说明统一后的需求口径、范围边界和不纳入项。",
          ),
          jsonArtifact(
            "evaluation_dimensions",
            "评估维度",
            "输出 JSON 数组，每项包含 dimension, why_it_matters, scoring_hint。",
          ),
        ],
      },
      {
        id: "node_supplier_score",
        label: "供应商评分官",
        displayName: "供应商评分官",
        systemPromptTemplate: buildSystemPrompt("供应商评分官"),
        stepDescription: "形成厂商评分和澄清路由信号",
        promptTemplate: buildRolePrompt({
          role: "供应商评分官",
          mission: "请基于统一规格和候选厂商资料输出评分卡、适配差距和是否需要澄清。",
          sections: [
            promptSection(
              "上游输入",
              lines(
                "### 规格基线\n{{node_normalize.spec_baseline}}",
                "### 归一化需求\n{{node_normalize.normalized_requirements}}",
                "### 评估维度\n{{node_normalize.evaluation_dimensions}}",
                `### 候选厂商资料\n${inputVar("candidate_vendor_docs")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "vendor_scorecard",
            "厂商评分卡",
            "输出 JSON 数组，每项包含 vendor, price_fit, technical_fit, service_fit, overall_score, key_gap。",
          ),
          markdownArtifact(
            "fit_gap_summary",
            "适配差距总结",
            "输出 Markdown，概述主要差距、短板和需重点关注的项。",
          ),
          clarificationSignalArtifact(),
        ],
      },
      {
        id: "node_tco",
        label: "TCO 分析官",
        displayName: "TCO 分析官",
        systemPromptTemplate: buildSystemPrompt("TCO 分析官"),
        stepDescription: "形成推荐 BOM、TCO 和合同风险",
        promptTemplate: buildRolePrompt({
          role: "TCO 分析官",
          mission: "请在评分结果基础上形成推荐 BOM、总体成本和合同风险判断。",
          sections: [
            promptSection(
              "分析输入",
              lines(
                "### 厂商评分卡\n{{node_supplier_score.vendor_scorecard}}",
                "### 适配差距总结\n{{node_supplier_score.fit_gap_summary}}",
                `### BOM 清单\n${inputVar("bom_file")}`,
                `### 议价记录\n${inputVar("negotiation_notes")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "recommended_bom",
            "推荐 BOM",
            "输出 JSON 数组，每项包含 category, item, vendor, quantity, rationale。",
          ),
          markdownArtifact(
            "tco_summary",
            "TCO 摘要",
            "输出 Markdown，概述一次性投入、持续成本和预算匹配情况。",
          ),
          markdownArtifact(
            "contract_risks",
            "合同风险",
            "输出 Markdown，说明采购合同、交付条款和售后条款方面的风险点。",
          ),
        ],
      },
      {
        id: "node_clarification",
        label: "议价澄清官",
        displayName: "议价澄清官",
        systemPromptTemplate: buildSystemPrompt("议价澄清官"),
        stepDescription: "在需要时输出澄清与议价要点",
        executionRule: skipWhenAll([
          {
            sourceRef: conditionRef("node_supplier_score", "clarification_signal", "needed"),
            operator: "equals",
            value: "false",
          },
        ]),
        promptTemplate: buildRolePrompt({
          role: "议价澄清官",
          mission: "请在需要澄清或谈判时，整理应对问题、澄清话术和议价策略。",
          sections: [
            promptSection(
              "输入基础",
              lines(
                "### 澄清路由信号\n{{node_supplier_score.clarification_signal}}",
                "### 厂商评分卡\n{{node_supplier_score.vendor_scorecard}}",
                "### 适配差距总结\n{{node_supplier_score.fit_gap_summary}}",
                `### 议价记录\n${inputVar("negotiation_notes")}`,
              ),
            ),
          ],
          closing: "若系统判定不需要澄清则自动跳过；若执行，请返回全部产物。",
        }),
        namedOutputs: [
          markdownArtifact(
            "clarification_points",
            "澄清要点",
            "输出 Markdown，说明需要澄清的问题、原因和希望获得的回复。",
          ),
          markdownArtifact(
            "negotiation_playbook",
            "议价打法",
            "输出 Markdown，说明可用的议价路径、底线和换取条件。",
          ),
        ],
      },
      {
        id: "node_committee",
        label: "推荐委员会",
        displayName: "推荐委员会",
        systemPromptTemplate: buildSystemPrompt("推荐委员会"),
        stepDescription: "形成推荐结论和决策理由",
        promptTemplate: buildRolePrompt({
          role: "推荐委员会",
          mission: "请综合评分、成本和风险结论，形成推荐意见、决策理由和候选名单。",
          sections: [
            promptSection(
              "决策输入",
              lines(
                "### 厂商评分卡\n{{node_supplier_score.vendor_scorecard}}",
                "### TCO 摘要\n{{node_tco.tco_summary}}",
                "### 合同风险\n{{node_tco.contract_risks}}",
                "### 澄清要点\n{{node_clarification.clarification_points}}",
                "### 议价打法\n{{node_clarification.negotiation_playbook}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "recommendation_conclusion",
            "推荐结论",
            "输出 Markdown，明确推荐对象、适用前提和放弃其他方案的理由。",
          ),
          markdownArtifact(
            "decision_rationale",
            "决策理由",
            "输出 Markdown，面向管理层说明为什么做出该推荐。",
          ),
          jsonArtifact(
            "supplier_shortlist",
            "候选名单",
            "输出 JSON 数组，每项包含 vendor, rank, role, fallback_plan。",
          ),
        ],
      },
      {
        id: "node_compliance_qa",
        label: "合规质检官",
        displayName: "合规质检官",
        systemPromptTemplate: buildSystemPrompt("合规质检官"),
        stepDescription: "对采购推荐结论做合规审查和导出门控",
        promptTemplate: buildRolePrompt({
          role: "合规质检官",
          mission: "请审查采购推荐文档是否满足规格、合规和演示可交付要求。",
          sections: [
            promptSection(
              "审查输入",
              lines(
                "### 规格基线\n{{node_normalize.spec_baseline}}",
                "### 厂商评分卡\n{{node_supplier_score.vendor_scorecard}}",
                "### 推荐 BOM\n{{node_tco.recommended_bom}}",
                "### 合同风险\n{{node_tco.contract_risks}}",
                "### 推荐结论\n{{node_committee.recommendation_conclusion}}",
                "### 决策理由\n{{node_committee.decision_rationale}}",
                `### 合规资料\n${inputVar("compliance_docs")}`,
              ),
            ),
          ],
          extraRules: ["若推荐结论与规格基线不一致或合规风险无法接受，必须阻断导出。"],
        }),
        namedOutputs: buildQaArtifacts(),
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_normalize",
        outputId: "normalized_requirements",
        displayName: "规格归一官 · 归一化需求",
      },
      {
        sourceNodeId: "node_supplier_score",
        outputId: "fit_gap_summary",
        displayName: "供应商评分官 · 适配差距总结",
      },
      { sourceNodeId: "node_tco", outputId: "tco_summary", displayName: "TCO 分析官 · TCO 摘要" },
      {
        sourceNodeId: "node_tco",
        outputId: "contract_risks",
        displayName: "TCO 分析官 · 合同风险",
      },
      {
        sourceNodeId: "node_clarification",
        outputId: "clarification_points",
        displayName: "议价澄清官 · 澄清要点",
      },
      {
        sourceNodeId: "node_clarification",
        outputId: "negotiation_playbook",
        displayName: "议价澄清官 · 议价打法",
      },
      {
        sourceNodeId: "node_committee",
        outputId: "recommendation_conclusion",
        displayName: "推荐委员会 · 推荐结论",
      },
      {
        sourceNodeId: "node_committee",
        outputId: "decision_rationale",
        displayName: "推荐委员会 · 决策理由",
      },
    ],
    postRestoreStages: [
      {
        id: "node_assembly",
        label: "推荐书装配师",
        displayName: "推荐书装配师",
        systemPromptTemplate: buildSystemPrompt("推荐书装配师"),
        stepDescription: "输出最终软硬件采购推荐书",
        modelMode: "compare",
        outputFormat: "markdown",
        promptTemplate: buildRolePrompt({
          role: "推荐书装配师",
          mission: "请把恢复后的采购比选内容装配成一份适合内部展示和决策沟通的推荐书。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 采购主题：${inputVar("procurement_title")}`,
                `- 采购部门：${inputVar("buyer_department")}`,
                `- 采购类型：${inputVar("procurement_type")}`,
                `- 预算上限：${inputVar("budget_cap")}`,
              ),
            ),
            promptSection(
              "恢复后的正文材料",
              lines(
                `### 归一化需求\n${restoreVar("node_normalize", "normalized_requirements")}`,
                `### 适配差距总结\n${restoreVar("node_supplier_score", "fit_gap_summary")}`,
                `### TCO 摘要\n${restoreVar("node_tco", "tco_summary")}`,
                `### 合同风险\n${restoreVar("node_tco", "contract_risks")}`,
                `### 澄清要点\n${restoreVar("node_clarification", "clarification_points")}`,
                `### 议价打法\n${restoreVar("node_clarification", "negotiation_playbook")}`,
                `### 推荐结论\n${restoreVar("node_committee", "recommendation_conclusion")}`,
                `### 决策理由\n${restoreVar("node_committee", "decision_rationale")}`,
              ),
            ),
          ],
          extraRules: ["请输出最终推荐书正文，不要附带审查解释。"],
        }),
      },
    ],
    exportRule: buildExportGateRule("node_compliance_qa"),
  };

  return buildWorkflowDefinition({
    documentTypeCode: "procurement_selection",
    name: "软硬件采购比选与推荐 Agent 流程",
    description:
      "11 节点旗舰流程，展示规格归一、厂商评分、TCO 分析、澄清路由、推荐结论和合规门控。",
    isDefault: true,
    category: "flagship",
    blueprint,
    models,
  });
}

function buildMeetingMedium(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("meeting_topic", "会议主题", true),
      datetimeField("meeting_datetime", "会议时间", true),
      textField("organizer", "组织人"),
      textareaField("attendees", "参会人"),
      textareaField("extra_notes", "补充说明"),
      dateField("followup_deadline", "跟进截止日期"),
      fileField("meeting_minutes", "会议记录文件"),
      fileField("background_material", "背景材料", false, "unlimited"),
    ],
    preRestoreStages: [
      {
        id: "node_minutes",
        label: "纪要整理官",
        displayName: "纪要整理官",
        systemPromptTemplate: buildSystemPrompt("纪要整理官"),
        stepDescription: "整理纪要、结论和待确认问题",
        promptTemplate: buildRolePrompt({
          role: "纪要整理官",
          mission: "请把会议原始记录整理成结构化纪要，包含摘要、结论和待确认问题。",
          sections: [
            promptSection(
              "会议信息",
              lines(
                `- 会议主题：${inputVar("meeting_topic")}`,
                `- 会议时间：${inputVar("meeting_datetime")}`,
                `- 组织人：${inputVar("organizer")}`,
                `- 参会人：${inputVar("attendees")}`,
                `- 跟进截止日期：${inputVar("followup_deadline")}`,
              ),
            ),
            promptSection(
              "会议材料",
              lines(
                `### 会议记录文件\n${inputVar("meeting_minutes")}`,
                `### 背景材料\n${inputVar("background_material")}`,
                `### 补充说明\n${inputVar("extra_notes")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "meeting_summary",
            "会议摘要",
            "输出 Markdown，概括会议目标、重点讨论和当前共识。",
          ),
          jsonArtifact(
            "decision_list",
            "决议清单",
            "输出 JSON 数组，每项包含 decision, owner, due_hint, dependency。",
          ),
          markdownArtifact(
            "open_questions",
            "待确认问题",
            "输出 Markdown，列出仍待确认的事项和建议责任人。",
          ),
        ],
      },
      {
        id: "node_actions",
        label: "行动项抽取官",
        displayName: "行动项抽取官",
        systemPromptTemplate: buildSystemPrompt("行动项抽取官"),
        stepDescription: "抽取行动项和责任风险",
        promptTemplate: buildRolePrompt({
          role: "行动项抽取官",
          mission: "请在会议纪要基础上形成行动项清单，并标出责任和风险。",
          sections: [
            promptSection(
              "输入材料",
              lines(
                "### 会议摘要\n{{node_minutes.meeting_summary}}",
                "### 决议清单\n{{node_minutes.decision_list}}",
                "### 待确认问题\n{{node_minutes.open_questions}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "action_items",
            "行动项",
            "输出 JSON 数组，每项包含 action, owner, due_date, status_hint, dependency。",
          ),
          markdownArtifact(
            "owner_risks",
            "责任风险",
            "输出 Markdown，指出行动项推进时最容易遗漏或失责的点。",
          ),
        ],
      },
      {
        id: "node_send",
        label: "发送稿生成官",
        displayName: "发送稿生成官",
        systemPromptTemplate: buildSystemPrompt("发送稿生成官"),
        stepDescription: "生成会后邮件与同步摘要",
        promptTemplate: buildRolePrompt({
          role: "发送稿生成官",
          mission: "请根据纪要和行动项，输出会后同步邮件草稿和管理摘要。",
          sections: [
            promptSection(
              "输入材料",
              lines(
                "### 会议摘要\n{{node_minutes.meeting_summary}}",
                "### 决议清单\n{{node_minutes.decision_list}}",
                "### 行动项\n{{node_actions.action_items}}",
                "### 责任风险\n{{node_actions.owner_risks}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "followup_mail",
            "会后邮件稿",
            "输出 Markdown，面向参会成员同步会议纪要、行动项和截止日期。",
          ),
          markdownArtifact(
            "sync_brief",
            "同步摘要",
            "输出 Markdown，面向管理者简述本次会议结论和后续动作。",
          ),
        ],
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_minutes",
        outputId: "meeting_summary",
        displayName: "纪要整理官 · 会议摘要",
      },
      {
        sourceNodeId: "node_minutes",
        outputId: "decision_list",
        displayName: "纪要整理官 · 决议清单",
      },
      {
        sourceNodeId: "node_minutes",
        outputId: "open_questions",
        displayName: "纪要整理官 · 待确认问题",
      },
      {
        sourceNodeId: "node_actions",
        outputId: "action_items",
        displayName: "行动项抽取官 · 行动项",
      },
      {
        sourceNodeId: "node_actions",
        outputId: "owner_risks",
        displayName: "行动项抽取官 · 责任风险",
      },
      {
        sourceNodeId: "node_send",
        outputId: "followup_mail",
        displayName: "发送稿生成官 · 会后邮件稿",
      },
      { sourceNodeId: "node_send", outputId: "sync_brief", displayName: "发送稿生成官 · 同步摘要" },
    ],
  };

  return buildWorkflowDefinition({
    documentTypeCode: "meeting-notes",
    name: "会议纪要→行动项流程",
    description: "7 节点中型流程，展示纪要整理、行动项抽取、邮件发送稿生成与恢复导出。",
    isDefault: true,
    category: "medium",
    blueprint,
    models,
  });
}

function buildSolutionClarificationMedium(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("opportunity_name", "商机名称", true),
      textField("customer_name", "客户名称", true),
      textField("department", "客户部门"),
      selectField(
        "current_stage",
        "当前阶段",
        ["首次沟通", "方案确认", "技术澄清", "商务推进"],
        true,
      ),
      textareaField("known_requirements", "已知需求", true),
      textareaField("blockers", "当前阻塞"),
      dateField("desired_timeline", "期望时间点"),
      fileField("meeting_notes", "会议纪要"),
      fileField("requirement_doc", "需求材料"),
    ],
    preRestoreStages: [
      {
        id: "node_need",
        label: "需求归纳官",
        displayName: "需求归纳官",
        systemPromptTemplate: buildSystemPrompt("需求归纳官"),
        stepDescription: "总结需求现状与优先级假设",
        promptTemplate: buildRolePrompt({
          role: "需求归纳官",
          mission: "请将客户输入整理成需求摘要、范围假设和优先级建议。",
          sections: [
            promptSection(
              "输入信息",
              lines(
                `- 商机名称：${inputVar("opportunity_name")}`,
                `- 客户名称：${inputVar("customer_name")}`,
                `- 客户部门：${inputVar("department")}`,
                `- 当前阶段：${inputVar("current_stage")}`,
                `- 期望时间点：${inputVar("desired_timeline")}`,
                `### 已知需求\n${inputVar("known_requirements")}`,
                `### 当前阻塞\n${inputVar("blockers")}`,
                `### 会议纪要\n${inputVar("meeting_notes")}`,
                `### 需求材料\n${inputVar("requirement_doc")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "need_digest",
            "需求要点",
            "输出 Markdown，提炼当前目标、痛点和关键信息。",
          ),
          markdownArtifact(
            "scope_hypothesis",
            "范围假设",
            "输出 Markdown，说明当前对范围边界、交付对象和限制的判断。",
          ),
          markdownArtifact(
            "priority_advice",
            "优先级建议",
            "输出 Markdown，说明短期优先事项和原因。",
          ),
        ],
      },
      {
        id: "node_clarify",
        label: "澄清问答官",
        displayName: "澄清问答官",
        systemPromptTemplate: buildSystemPrompt("澄清问答官"),
        stepDescription: "输出澄清问题清单和下一步建议",
        promptTemplate: buildRolePrompt({
          role: "澄清问答官",
          mission: "请基于需求摘要输出高价值澄清问题，并给出下一轮沟通建议。",
          sections: [
            promptSection(
              "输入基础",
              lines(
                "### 需求要点\n{{node_need.need_digest}}",
                "### 范围假设\n{{node_need.scope_hypothesis}}",
                "### 优先级建议\n{{node_need.priority_advice}}",
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "clarification_questions",
            "澄清问题清单",
            "输出 JSON 数组，每项包含 question, why_it_matters, expected_answer, owner_hint。",
          ),
          markdownArtifact(
            "next_step_suggestion",
            "下一步建议",
            "输出 Markdown，建议下一轮沟通目标、准备材料和推进动作。",
          ),
        ],
      },
    ],
    restoreSources: [
      { sourceNodeId: "node_need", outputId: "need_digest", displayName: "需求归纳官 · 需求要点" },
      {
        sourceNodeId: "node_need",
        outputId: "scope_hypothesis",
        displayName: "需求归纳官 · 范围假设",
      },
      {
        sourceNodeId: "node_need",
        outputId: "priority_advice",
        displayName: "需求归纳官 · 优先级建议",
      },
      {
        sourceNodeId: "node_clarify",
        outputId: "clarification_questions",
        displayName: "澄清问答官 · 澄清问题清单",
      },
      {
        sourceNodeId: "node_clarify",
        outputId: "next_step_suggestion",
        displayName: "澄清问答官 · 下一步建议",
      },
    ],
  };

  return buildWorkflowDefinition({
    documentTypeCode: "solution_docs",
    name: "客户需求澄清问答单流程",
    description: "6 节点中型流程，展示售前需求归纳、澄清问题抽取和会后推进建议。",
    isDefault: false,
    category: "medium",
    blueprint,
    models,
  });
}

function buildWeeklyReportMedium(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("project_name", "项目名称", true),
      textField("week_range", "周报周期", true),
      textareaField("progress_inputs", "本周进展", true),
      textareaField("blockers", "当前阻塞"),
      textareaField("change_requests", "变更请求"),
      textareaField("next_week_focus", "下周重点"),
      fileField("weekly_logs", "周内记录"),
    ],
    preRestoreStages: [
      {
        id: "node_progress",
        label: "进展汇总官",
        displayName: "进展汇总官",
        systemPromptTemplate: buildSystemPrompt("进展汇总官"),
        stepDescription: "汇总周内进展和里程碑状态",
        promptTemplate: buildRolePrompt({
          role: "进展汇总官",
          mission: "请把本周输入整理成项目周报所需的进展总结和里程碑状态。",
          sections: [
            promptSection(
              "输入信息",
              lines(
                `- 项目名称：${inputVar("project_name")}`,
                `- 周报周期：${inputVar("week_range")}`,
                `### 本周进展\n${inputVar("progress_inputs")}`,
                `### 周内记录\n${inputVar("weekly_logs")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "weekly_progress",
            "本周进展",
            "输出 Markdown，按主题总结本周完成事项和产出。",
          ),
          jsonArtifact(
            "milestone_status",
            "里程碑状态",
            "输出 JSON 数组，每项包含 milestone, status, evidence, impact。",
          ),
        ],
      },
      {
        id: "node_risk",
        label: "风险识别官",
        displayName: "风险识别官",
        systemPromptTemplate: buildSystemPrompt("风险识别官"),
        stepDescription: "识别风险与阻塞分析",
        promptTemplate: buildRolePrompt({
          role: "风险识别官",
          mission: "请识别本周风险、阻塞和变更影响，并给出管理提示。",
          sections: [
            promptSection(
              "输入基础",
              lines(
                "### 本周进展\n{{node_progress.weekly_progress}}",
                "### 里程碑状态\n{{node_progress.milestone_status}}",
                `### 当前阻塞\n${inputVar("blockers")}`,
                `### 变更请求\n${inputVar("change_requests")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "risk_register",
            "风险台账",
            "输出 JSON 数组，每项包含 risk, severity, owner, mitigation, due_hint。",
          ),
          markdownArtifact(
            "blockage_analysis",
            "阻塞分析",
            "输出 Markdown，说明阻塞来源、影响面和解法建议。",
          ),
        ],
      },
      {
        id: "node_report",
        label: "周报生成官",
        displayName: "周报生成官",
        systemPromptTemplate: buildSystemPrompt("周报生成官"),
        stepDescription: "生成正式周报与管理摘要",
        promptTemplate: buildRolePrompt({
          role: "周报生成官",
          mission: "请根据进展和风险输入生成正式项目周报正文和管理摘要。",
          sections: [
            promptSection(
              "输入材料",
              lines(
                "### 本周进展\n{{node_progress.weekly_progress}}",
                "### 里程碑状态\n{{node_progress.milestone_status}}",
                "### 风险台账\n{{node_risk.risk_register}}",
                "### 阻塞分析\n{{node_risk.blockage_analysis}}",
                `### 下周重点\n${inputVar("next_week_focus")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "weekly_report",
            "项目周报",
            "输出 Markdown，包含本周进展、风险阻塞、变更和下周计划。",
          ),
          markdownArtifact(
            "manager_summary",
            "管理摘要",
            "输出 Markdown，面向管理层给出关键风险和决策提醒。",
          ),
        ],
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_progress",
        outputId: "weekly_progress",
        displayName: "进展汇总官 · 本周进展",
      },
      {
        sourceNodeId: "node_progress",
        outputId: "milestone_status",
        displayName: "进展汇总官 · 里程碑状态",
      },
      {
        sourceNodeId: "node_risk",
        outputId: "risk_register",
        displayName: "风险识别官 · 风险台账",
      },
      {
        sourceNodeId: "node_risk",
        outputId: "blockage_analysis",
        displayName: "风险识别官 · 阻塞分析",
      },
      {
        sourceNodeId: "node_report",
        outputId: "weekly_report",
        displayName: "周报生成官 · 项目周报",
      },
      {
        sourceNodeId: "node_report",
        outputId: "manager_summary",
        displayName: "周报生成官 · 管理摘要",
      },
    ],
  };

  return buildWorkflowDefinition({
    documentTypeCode: "implementation_delivery",
    name: "项目周报与风险追踪流程",
    description: "7 节点中型流程，展示项目进展汇总、风险识别和正式周报生成。",
    isDefault: false,
    category: "medium",
    blueprint,
    models,
  });
}

function buildPostmortemMedium(models: DemoModelSelection): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textField("incident_title", "故障主题", true),
      datetimeField("incident_datetime", "故障时间", true),
      textField("system_scope", "影响系统"),
      textareaField("impact_summary", "影响摘要", true),
      textareaField("timeline_notes", "时间线补充"),
      textareaField("temporary_actions", "临时处理动作"),
      fileField("incident_report", "故障报告"),
      fileField("logs_and_evidence", "日志与证据", false, "unlimited"),
    ],
    preRestoreStages: [
      {
        id: "node_event",
        label: "事件还原官",
        displayName: "事件还原官",
        systemPromptTemplate: buildSystemPrompt("事件还原官"),
        stepDescription: "还原时间线和影响面",
        promptTemplate: buildRolePrompt({
          role: "事件还原官",
          mission: "请还原故障时间线、影响面和现场处置经过。",
          sections: [
            promptSection(
              "基础信息",
              lines(
                `- 故障主题：${inputVar("incident_title")}`,
                `- 故障时间：${inputVar("incident_datetime")}`,
                `- 影响系统：${inputVar("system_scope")}`,
                `### 影响摘要\n${inputVar("impact_summary")}`,
                `### 时间线补充\n${inputVar("timeline_notes")}`,
                `### 临时处理动作\n${inputVar("temporary_actions")}`,
              ),
            ),
            promptSection(
              "输入材料",
              lines(
                `### 故障报告\n${inputVar("incident_report")}`,
                `### 日志与证据\n${inputVar("logs_and_evidence")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "incident_timeline",
            "事件时间线",
            "输出 Markdown，按时间顺序还原事件经过、关键动作和状态变化。",
          ),
          markdownArtifact(
            "impact_assessment",
            "影响评估",
            "输出 Markdown，说明影响对象、持续时间、业务后果和恢复情况。",
          ),
        ],
      },
      {
        id: "node_root_cause",
        label: "根因分析官",
        displayName: "根因分析官",
        systemPromptTemplate: buildSystemPrompt("根因分析官"),
        stepDescription: "识别根因树和促成因素",
        promptTemplate: buildRolePrompt({
          role: "根因分析官",
          mission: "请在事件时间线基础上识别根因链路和促成因素。",
          sections: [
            promptSection(
              "输入材料",
              lines(
                "### 事件时间线\n{{node_event.incident_timeline}}",
                "### 影响评估\n{{node_event.impact_assessment}}",
                `### 日志与证据\n${inputVar("logs_and_evidence")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "root_cause_tree",
            "根因树",
            "输出 Markdown，说明直接原因、根因和传播路径。",
          ),
          jsonArtifact(
            "contributing_factors",
            "促成因素",
            "输出 JSON 数组，每项包含 factor, category, evidence, mitigation_gap。",
          ),
        ],
      },
      {
        id: "node_improve",
        label: "改进措施官",
        displayName: "改进措施官",
        systemPromptTemplate: buildSystemPrompt("改进措施官"),
        stepDescription: "沉淀改进项和复盘结论",
        promptTemplate: buildRolePrompt({
          role: "改进措施官",
          mission: "请根据根因和促成因素提出改进项，并形成复盘结论。",
          sections: [
            promptSection(
              "输入材料",
              lines(
                "### 根因树\n{{node_root_cause.root_cause_tree}}",
                "### 促成因素\n{{node_root_cause.contributing_factors}}",
                `### 临时处理动作\n${inputVar("temporary_actions")}`,
              ),
            ),
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "improvement_items",
            "改进项",
            "输出 JSON 数组，每项包含 item, owner, priority, target_date, verification。",
          ),
          markdownArtifact(
            "postmortem_conclusion",
            "复盘结论",
            "输出 Markdown，概括本次事件的主要教训、长期改进方向和跟踪建议。",
          ),
        ],
      },
    ],
    restoreSources: [
      {
        sourceNodeId: "node_event",
        outputId: "incident_timeline",
        displayName: "事件还原官 · 事件时间线",
      },
      {
        sourceNodeId: "node_event",
        outputId: "impact_assessment",
        displayName: "事件还原官 · 影响评估",
      },
      {
        sourceNodeId: "node_root_cause",
        outputId: "root_cause_tree",
        displayName: "根因分析官 · 根因树",
      },
      {
        sourceNodeId: "node_root_cause",
        outputId: "contributing_factors",
        displayName: "根因分析官 · 促成因素",
      },
      {
        sourceNodeId: "node_improve",
        outputId: "improvement_items",
        displayName: "改进措施官 · 改进项",
      },
      {
        sourceNodeId: "node_improve",
        outputId: "postmortem_conclusion",
        displayName: "改进措施官 · 复盘结论",
      },
    ],
  };

  return buildWorkflowDefinition({
    documentTypeCode: "technical_analysis",
    name: "故障复盘与改进项流程",
    description: "7 节点中型流程，展示事件还原、根因分析、改进项沉淀与恢复导出。",
    isDefault: false,
    category: "medium",
    blueprint,
    models,
  });
}

export function buildDemoCatalog(models: DemoModelSelection): {
  documentTypes: DemoDocumentTypeDefinition[];
  workflows: DemoWorkflowDefinition[];
} {
  return {
    documentTypes: DEMO_DOCUMENT_TYPES,
    workflows: [
      buildSolutionFlagship(models),
      buildRequirementFlagship(models),
      buildPrdReviewFlagship(models),
      buildTechnicalFlagship(models),
      buildImplementationFlagship(models),
      buildProcurementFlagship(models),
      buildMeetingMedium(models),
      buildSolutionClarificationMedium(models),
      buildWeeklyReportMedium(models),
      buildPostmortemMedium(models),
    ],
  };
}
