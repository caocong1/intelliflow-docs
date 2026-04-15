import { slidePresentationJsonSchema } from "../../../shared/src/slide-types";
import type {
  DemoDocumentTypeDefinition,
  DemoModelSelection,
  DemoWorkflowDefinition,
  WorkflowBlueprint,
} from "./demo-workflows/builders";
import {
  buildBlockingExportGateRule,
  buildRolePrompt,
  buildSystemPrompt,
  buildWorkflowFromBlueprint,
  conditionRef,
  fileField,
  inputVar,
  jsonArtifact,
  lines,
  markdownArtifact,
  promptSection,
  templateVar,
  textareaField,
} from "./demo-workflows/builders";

export const PRESENTATION_DOCUMENT_TYPE: DemoDocumentTypeDefinition = {
  code: "presentation_deck",
  name: "PPT演示文稿",
  description: "面向汇报、方案演示、培训宣讲等场景的结构化幻灯片生成流程。",
};

export const PRESENTATION_WORKFLOW_NAME = "通用 PPT 生成与质检 Agent 流程";

const deckSpecJsonSchema = {
  type: "object",
  properties: {
    audience: { type: "string", minLength: 1 },
    goal: { type: "string", minLength: 1 },
    use_case: { type: "string", minLength: 1 },
    tone: { type: "string", minLength: 1 },
    page_budget: { type: "string", minLength: 1 },
    must_sections: { type: "array", items: { type: "string" } },
    optional_sections: { type: "array", items: { type: "string" } },
    visual_style: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
  },
  required: [
    "audience",
    "goal",
    "use_case",
    "tone",
    "page_budget",
    "must_sections",
    "optional_sections",
    "visual_style",
    "assumptions",
    "open_questions",
  ],
  additionalProperties: false,
} as const;

const requestBriefJsonSchema = {
  type: "object",
  properties: {
    topic: { type: "string", minLength: 1 },
    target_audience: { type: "string", minLength: 1 },
    primary_goal: { type: "string", minLength: 1 },
    desired_outcome: { type: "string", minLength: 1 },
    known_constraints: { type: "array", items: { type: "string" } },
    missing_inputs: { type: "array", items: { type: "string" } },
    suggested_direction: { type: "string", minLength: 1 },
  },
  required: [
    "topic",
    "target_audience",
    "primary_goal",
    "desired_outcome",
    "known_constraints",
    "missing_inputs",
    "suggested_direction",
  ],
  additionalProperties: false,
} as const;

const qaGateJsonSchema = {
  type: "object",
  properties: {
    can_export: { type: "boolean" },
    blocking_count: { type: "number", minimum: 0 },
    reason: { type: "string", minLength: 1 },
  },
  required: ["can_export", "blocking_count", "reason"],
  additionalProperties: false,
} as const;

const slideOutlineJsonSchema = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          title: { type: "string", minLength: 1 },
          layout: {
            type: "string",
            enum: ["title", "content", "two_column", "table", "image", "blank"],
          },
          purpose: { type: "string", minLength: 1 },
          key_points: { type: "array", items: { type: "string" }, minItems: 1 },
          evidence_basis: { type: "array", items: { type: "string" } },
          presenter_note: { type: "string" },
        },
        required: ["page_no", "title", "layout", "purpose", "key_points", "evidence_basis"],
        additionalProperties: false,
      },
    },
    pacing_notes: { type: "array", items: { type: "string" } },
    omission_notes: { type: "array", items: { type: "string" } },
  },
  required: ["slides", "pacing_notes", "omission_notes"],
  additionalProperties: false,
} as const;

const pageBlueprintsJsonSchema = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          narrative_role: { type: "string", minLength: 1 },
          visual_focus: { type: "string", minLength: 1 },
          blocks: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                kind: { type: "string", minLength: 1 },
                objective: { type: "string", minLength: 1 },
                content_source: { type: "string", minLength: 1 },
                emphasis: { type: "string", minLength: 1 },
              },
              required: ["kind", "objective", "content_source", "emphasis"],
              additionalProperties: false,
            },
          },
          speaker_note_hint: { type: "string" },
          risk_flags: { type: "array", items: { type: "string" } },
        },
        required: [
          "page_no",
          "narrative_role",
          "visual_focus",
          "blocks",
          "speaker_note_hint",
          "risk_flags",
        ],
        additionalProperties: false,
      },
    },
    global_layout_rules: { type: "array", items: { type: "string" } },
  },
  required: ["pages", "global_layout_rules"],
  additionalProperties: false,
} as const;

const visualAssetPlanJsonSchema = {
  type: "object",
  properties: {
    page_assets: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          asset_type: {
            type: "string",
            enum: ["text_only", "chart", "table", "image", "diagram", "timeline", "comparison"],
          },
          asset_goal: { type: "string", minLength: 1 },
          source_requirement: { type: "array", items: { type: "string" } },
          fallback_rendering: { type: "string", minLength: 1 },
          visual_priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: [
          "page_no",
          "asset_type",
          "asset_goal",
          "source_requirement",
          "fallback_rendering",
          "visual_priority",
        ],
        additionalProperties: false,
      },
    },
    global_asset_rules: { type: "array", items: { type: "string" } },
  },
  required: ["page_assets", "global_asset_rules"],
  additionalProperties: false,
} as const;

const chartSpecsJsonSchema = {
  type: "object",
  properties: {
    charts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          chart_type: {
            type: "string",
            enum: ["bar", "line", "pie", "scatter", "funnel", "matrix", "none"],
          },
          title_hint: { type: "string", minLength: 1 },
          x_axis: { type: "string" },
          y_axis: { type: "string" },
          data_fields: { type: "array", items: { type: "string" } },
          fallback_if_no_data: { type: "string", minLength: 1 },
        },
        required: ["page_no", "chart_type", "title_hint", "data_fields", "fallback_if_no_data"],
        additionalProperties: false,
      },
    },
  },
  required: ["charts"],
  additionalProperties: false,
} as const;

const pageFindingsJsonSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          severity: { type: "string", enum: ["critical", "major", "minor"] },
          issue_type: {
            type: "string",
            enum: [
              "density",
              "duplication",
              "weak_conclusion",
              "title_quality",
              "layout_balance",
              "visual_noise",
            ],
          },
          description: { type: "string", minLength: 1 },
          suggestion: { type: "string", minLength: 1 },
        },
        required: ["page_no", "severity", "issue_type", "description", "suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
} as const;

const draftChangeFocusJsonSchema = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["P0", "P1", "P2"] },
          action: { type: "string", minLength: 1 },
          target_pages: { type: "array", items: { type: "number" } },
          rationale: { type: "string", minLength: 1 },
        },
        required: ["priority", "action", "target_pages", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["actions"],
  additionalProperties: false,
} as const;

const compressionNotesJsonSchema = {
  type: "object",
  properties: {
    merged_pages: { type: "array", items: { type: "string" } },
    removed_pages: { type: "array", items: { type: "number" } },
    rationale: { type: "array", items: { type: "string" } },
    remaining_long_pages: { type: "array", items: { type: "number" } },
  },
  required: ["merged_pages", "removed_pages", "rationale", "remaining_long_pages"],
  additionalProperties: false,
} as const;

const keyPageNotesJsonSchema = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          page_role: {
            type: "string",
            enum: ["cover", "agenda", "transition", "conclusion", "cta"],
          },
          enhancement_goal: { type: "string", minLength: 1 },
          headline_direction: { type: "string", minLength: 1 },
          emphasis_hint: { type: "string", minLength: 1 },
        },
        required: [
          "page_no",
          "page_role",
          "enhancement_goal",
          "headline_direction",
          "emphasis_hint",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["pages"],
  additionalProperties: false,
} as const;

const pageAuditGateJsonSchema = {
  type: "object",
  properties: {
    has_blocking_page_issues: { type: "boolean" },
    blocking_pages: { type: "array", items: { type: "number" } },
    reason: { type: "string", minLength: 1 },
  },
  required: ["has_blocking_page_issues", "blocking_pages", "reason"],
  additionalProperties: false,
} as const;

const claimMapJsonSchema = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page_no: { type: "number", minimum: 1 },
          claim: { type: "string", minLength: 1 },
          evidence_source: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          needs_confirmation: { type: "boolean" },
        },
        required: ["page_no", "claim", "evidence_source", "confidence", "needs_confirmation"],
        additionalProperties: false,
      },
    },
  },
  required: ["claims"],
  additionalProperties: false,
} as const;

const budgetGateJsonSchema = {
  type: "object",
  properties: {
    within_budget: { type: "boolean" },
    actual_pages: { type: "number", minimum: 1 },
    target_budget: { type: "string", minLength: 1 },
    overflow_pages: { type: "number", minimum: 0 },
    reason: { type: "string", minLength: 1 },
  },
  required: ["within_budget", "actual_pages", "target_budget", "overflow_pages", "reason"],
  additionalProperties: false,
} as const;

function manualFeedbackVar(nodeId: string) {
  return templateVar(nodeId, "manual_feedback");
}

export function buildPresentationWorkflowDefinition(
  models: DemoModelSelection,
): DemoWorkflowDefinition {
  const blueprint: WorkflowBlueprint = {
    inputFields: [
      textareaField("ppt_request", "PPT生成需求", true),
      fileField("reference_files", "参考文件", false, "unlimited", [
        ".pdf",
        ".doc,.docx",
        ".ppt,.pptx",
        ".xls,.xlsx",
        ".md",
        ".txt",
        ".png,.jpg,.jpeg",
      ]),
    ],
    includePrivacyChain: false,
    preRestoreStages: [
      {
        id: "node_intake",
        label: "需求解构委员会",
        displayName: "需求解构委员会",
        systemPromptTemplate: buildSystemPrompt("需求解构委员会"),
        stepDescription: "多模型并行解构需求、识别边界和缺口",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "需求解构委员会",
          mission:
            "请先把用户的原始请求和参考材料整理成一个清晰的任务定义，重点找出目标、对象、约束、缺失信息和建议推进方向，为后续所有阶段建立统一基线。",
          sections: [
            promptSection(
              "输入",
              lines(
                `### 用户原始需求\n${inputVar("ppt_request")}`,
                `### 参考文件内容\n${inputVar("reference_files")}`,
              ),
            ),
          ],
          extraRules: [
            "这是通用 PPT 流程，不要把具体行业词当成固定模板。",
            "禁止编造参考资料中不存在的事实或数据。",
            "若信息不足，必须显式写入 missing_inputs，不要假装已知。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "request_brief",
            "需求简报",
            "输出 JSON，对象字段固定为 topic, target_audience, primary_goal, desired_outcome, known_constraints, missing_inputs, suggested_direction。",
            undefined,
            requestBriefJsonSchema,
          ),
          markdownArtifact(
            "material_inventory",
            "材料清单",
            "输出 Markdown，总结已上传资料的类别、可用程度、能支撑的论点和明显空白。",
          ),
          markdownArtifact(
            "intake_open_questions",
            "前置疑问",
            "输出 Markdown，列出需要用户在后续人工选择时重点关注的歧义、冲突和待确认点。",
          ),
        ],
      },
      {
        id: "node_research",
        label: "资料提炼委员会",
        displayName: "资料提炼委员会",
        systemPromptTemplate: buildSystemPrompt("资料提炼委员会"),
        stepDescription: "多模型并行提炼证据、洞察和可讲述素材",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "资料提炼委员会",
          mission:
            "请把输入材料和需求简报中真正有价值的证据、洞察和可复用素材抽出来，供后续叙事和页面编排使用。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 需求简报\n{{node_intake.request_brief}}",
                "### 材料清单\n{{node_intake.material_inventory}}",
                `### 需求解构阶段的人工意见\n${manualFeedbackVar("node_intake")}`,
                `### 用户原始需求\n${inputVar("ppt_request")}`,
                `### 参考文件内容\n${inputVar("reference_files")}`,
              ),
            ),
          ],
          extraRules: [
            "重点抽取可讲述、可对比、可转成页面的证据，而不是重复原文。",
            "若材料不足以支持强结论，必须写成风险提示或待确认项。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "source_digest",
            "资料提炼摘要",
            "输出 Markdown，总结关键事实、可引用依据、风险和不宜直接使用的材料。",
          ),
          markdownArtifact(
            "evidence_map",
            "证据映射",
            "输出 Markdown，将可用证据按主题或章节方向整理，说明 each evidence supports what。",
          ),
          markdownArtifact(
            "insight_cards",
            "洞察卡片",
            "输出 Markdown，整理可以支撑叙事的关键洞察、对比点和结论素材。",
          ),
        ],
      },
      {
        id: "node_strategy",
        label: "策略委员会",
        displayName: "策略委员会",
        systemPromptTemplate: buildSystemPrompt("策略委员会"),
        stepDescription: "多模型并行生成受众、页数预算、内容优先级和成稿标准",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "策略委员会",
          mission:
            "请基于需求简报和资料提炼结果，输出一份真正可执行的 PPT 策略，约束页数、优先级、表现方式和成功标准，让后续流程不再发散。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 需求简报\n{{node_intake.request_brief}}",
                "### 材料清单\n{{node_intake.material_inventory}}",
                "### 资料提炼摘要\n{{node_research.source_digest}}",
                "### 证据映射\n{{node_research.evidence_map}}",
                "### 洞察卡片\n{{node_research.insight_cards}}",
                `### 上游人工意见\n${manualFeedbackVar("node_intake")}\n${manualFeedbackVar("node_research")}`,
              ),
            ),
          ],
          extraRules: [
            "这是通用 PPT 流程，不要被任何具体行业、品牌、产品名限制。",
            "如果用户没有明确页数，page_budget 默认写成“12-18页”。",
            "只有确有必要时，page_budget 才能超过 18 页，并在 assumptions 中说明原因。",
            "禁止编造资料中不存在的事实，缺失信息必须进入 assumptions 或 open_questions。",
            "输出只面向后续流程节点，不要写给最终用户看的寒暄或解释。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "deck_spec",
            "演示策略",
            "输出 JSON，对象字段固定为 audience, goal, use_case, tone, page_budget, must_sections, optional_sections, visual_style, assumptions, open_questions。",
            undefined,
            deckSpecJsonSchema,
          ),
          markdownArtifact(
            "success_criteria",
            "成功标准",
            "输出 Markdown，定义这份 PPT 在内容、结构、节奏、信息密度和可编辑性上的通过标准。",
          ),
        ],
      },
      {
        id: "node_storyline",
        label: "叙事架构委员会",
        displayName: "叙事架构委员会",
        systemPromptTemplate: buildSystemPrompt("叙事架构委员会"),
        stepDescription: "多模型并行生成叙事主线、章节骨架和标题方向",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "叙事架构委员会",
          mission:
            "请根据策略和证据，为这份 PPT 设计一条清晰的叙事主线，让读者知道为什么看、按什么顺序看、最后带走什么。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                "### 证据映射\n{{node_research.evidence_map}}",
                "### 洞察卡片\n{{node_research.insight_cards}}",
                "### 前置疑问\n{{node_intake.intake_open_questions}}",
                `### 上游人工意见\n${manualFeedbackVar("node_strategy")}\n${manualFeedbackVar("node_research")}\n${manualFeedbackVar("node_intake")}`,
              ),
            ),
          ],
          extraRules: [
            "不要直接写逐页文案，这一阶段只解决‘讲什么、先后顺序、如何推进说服力’。",
            "章节顺序必须服务于最终目标，而不是机械照搬原始材料。",
            "若上游人工意见已经明确否定某个方向，不要在本阶段重新引入。",
          ],
        }),
        namedOutputs: [
          markdownArtifact(
            "narrative_arc",
            "叙事主线",
            "输出 Markdown，描述开场切入、核心转折、重点论证和结尾落点。",
          ),
          markdownArtifact(
            "section_plan",
            "章节骨架",
            "输出 Markdown，按章节说明该章目标、核心信息和与前后章节的承接关系。",
          ),
          markdownArtifact(
            "title_options",
            "标题方向",
            "输出 Markdown，给出整份 PPT 的标题候选、目录命名风格和关键页标题方向。",
          ),
        ],
      },
      {
        id: "node_outline",
        label: "结构委员会",
        displayName: "结构委员会",
        systemPromptTemplate: buildSystemPrompt("结构委员会"),
        stepDescription: "多模型并行生成结构化逐页大纲、样张与视觉约束",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "结构委员会",
          mission:
            "请基于策略和叙事主线，把整份 PPT 拆成逐页结构，明确每页的存在理由、布局形式和证据归属。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                "### 叙事主线\n{{node_storyline.narrative_arc}}",
                "### 章节骨架\n{{node_storyline.section_plan}}",
                "### 标题方向\n{{node_storyline.title_options}}",
                "### 资料提炼摘要\n{{node_research.source_digest}}",
                `### 上游人工意见\n${manualFeedbackVar("node_storyline")}\n${manualFeedbackVar("node_strategy")}\n${manualFeedbackVar("node_research")}`,
              ),
            ),
          ],
          extraRules: [
            "slide_outline 必须输出结构化 JSON，不允许输出自然语言大纲替代。",
            "sample_script 只需要覆盖首页、目录页、关键分析页、结论页样张，不要输出整份终稿。",
            "visual_guardrails 重点约束信息密度、表格使用、图片策略、避免“堆字”和重复页。",
            "若证据不足以支撑某页内容，必须明确标记“待确认”，不能自行补事实。",
            "如果人工意见要求删页、合页或调整顺序，必须在 slide_outline 中显式体现。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "slide_outline",
            "逐页大纲",
            "输出 JSON，对象字段固定为 slides, pacing_notes, omission_notes。slides 中每页都必须包含 page_no, title, layout, purpose, key_points, evidence_basis, presenter_note。",
            undefined,
            slideOutlineJsonSchema,
          ),
          markdownArtifact(
            "sample_script",
            "关键页样张",
            "输出 Markdown，给出首页、目录页、关键分析页、结论页的示例文案。",
          ),
          markdownArtifact(
            "visual_guardrails",
            "视觉约束",
            "输出 Markdown，约束风格、信息密度、表格使用、图片策略、动效克制与排版禁忌。",
          ),
        ],
      },
      {
        id: "node_layout",
        label: "页面编排委员会",
        displayName: "页面编排委员会",
        systemPromptTemplate: buildSystemPrompt("页面编排委员会"),
        stepDescription: "多模型并行补充结构化页面蓝图、讲稿提示和风险清单",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "页面编排委员会",
          mission:
            "请把逐页结构进一步转成可执行的页面编排建议，重点解决关键页的信息层级、视觉重心和讲述方式。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 叙事主线\n{{node_storyline.narrative_arc}}",
                "### 逐页大纲\n{{node_outline.slide_outline}}",
                "### 关键页样张\n{{node_outline.sample_script}}",
                "### 视觉约束\n{{node_outline.visual_guardrails}}",
                `### 上游人工意见\n${manualFeedbackVar("node_outline")}\n${manualFeedbackVar("node_storyline")}\n${manualFeedbackVar("node_strategy")}`,
              ),
            ),
          ],
          extraRules: [
            "page_blueprints 必须输出结构化 JSON，不允许用散文描述替代。",
            "speaker_notes_brief 只给出演讲提示和过渡句，不要写成长篇讲稿。",
            "risk_watchlist 要明确指出容易导致 PPT 质量下降的页、段落或素材问题。",
            "如果人工意见指出某些页面不符合用户预期，必须在 page_blueprints 和 risk_watchlist 中显式修正。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "page_blueprints",
            "页面蓝图",
            "输出 JSON，对象字段固定为 pages, global_layout_rules。pages 中每个页面都必须包含 page_no, narrative_role, visual_focus, blocks, speaker_note_hint, risk_flags。",
            undefined,
            pageBlueprintsJsonSchema,
          ),
          markdownArtifact(
            "speaker_notes_brief",
            "讲述提示",
            "输出 Markdown，为关键章节提供演讲过渡句、强调点和口播提示。",
          ),
          markdownArtifact(
            "risk_watchlist",
            "风险观察",
            "输出 Markdown，指出当前大纲和材料里最可能影响最终质量的问题与规避建议。",
          ),
        ],
      },
      {
        id: "node_visual",
        label: "视觉资产委员会",
        displayName: "视觉资产委员会",
        systemPromptTemplate: buildSystemPrompt("视觉资产委员会"),
        stepDescription: "多模型并行规划图表、图片、表格和素材降级策略",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "视觉资产委员会",
          mission:
            "请在出初稿前，把哪些页面适合使用图表、图片、表格、对比组件或纯文字的决策结构化下来，并明确素材不足时的降级策略。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 逐页大纲\n{{node_outline.slide_outline}}",
                "### 页面蓝图\n{{node_layout.page_blueprints}}",
                "### 证据映射\n{{node_research.evidence_map}}",
                "### 洞察卡片\n{{node_research.insight_cards}}",
                "### 风险观察\n{{node_layout.risk_watchlist}}",
                `### 上游人工意见\n${manualFeedbackVar("node_layout")}\n${manualFeedbackVar("node_outline")}`,
              ),
            ),
          ],
          extraRules: [
            "asset_plan 必须输出结构化 JSON，逐页说明最适合的资产形式。",
            "chart_specs 只为真正适合图表表达的页面给出配置，不要强行图表化。",
            "如果缺少数据或图片，必须给出 fallback_rendering / fallback_if_no_data，而不是假设素材存在。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "asset_plan",
            "视觉资产计划",
            "输出 JSON，对象字段固定为 page_assets, global_asset_rules。逐页说明 asset_type, asset_goal, source_requirement, fallback_rendering, visual_priority。",
            undefined,
            visualAssetPlanJsonSchema,
          ),
          jsonArtifact(
            "chart_specs",
            "图表规格",
            "输出 JSON，对象字段固定为 charts。只为适合图表表达的页面给出 chart_type, title_hint, data_fields, fallback_if_no_data。",
            undefined,
            chartSpecsJsonSchema,
          ),
          markdownArtifact(
            "asset_risks",
            "视觉资产风险",
            "输出 Markdown，指出图片、图表、表格和对比组件最容易失真的页面与原因。",
          ),
        ],
      },
      {
        id: "node_draft",
        label: "初稿委员会",
        displayName: "初稿委员会",
        systemPromptTemplate: buildSystemPrompt("初稿委员会"),
        stepDescription: "多模型并行生成结构化幻灯片初稿和初稿问题摘要",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "初稿委员会",
          mission:
            "请先生成一版结构完整、逻辑连贯的 PPT 初稿 JSON，同时主动指出仍需精修的问题，为后续精修阶段提供明确靶点。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 需求简报\n{{node_intake.request_brief}}",
                "### 材料清单\n{{node_intake.material_inventory}}",
                "### 资料提炼摘要\n{{node_research.source_digest}}",
                "### 证据映射\n{{node_research.evidence_map}}",
                "### 洞察卡片\n{{node_research.insight_cards}}",
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                "### 叙事主线\n{{node_storyline.narrative_arc}}",
                "### 章节骨架\n{{node_storyline.section_plan}}",
                "### 标题方向\n{{node_storyline.title_options}}",
                "### 逐页大纲\n{{node_outline.slide_outline}}",
                "### 关键页样张\n{{node_outline.sample_script}}",
                "### 视觉约束\n{{node_outline.visual_guardrails}}",
                "### 页面蓝图\n{{node_layout.page_blueprints}}",
                "### 视觉资产计划\n{{node_visual.asset_plan}}",
                "### 图表规格\n{{node_visual.chart_specs}}",
                "### 视觉资产风险\n{{node_visual.asset_risks}}",
                "### 讲述提示\n{{node_layout.speaker_notes_brief}}",
                "### 风险观察\n{{node_layout.risk_watchlist}}",
                `### 上游人工意见\n${manualFeedbackVar("node_visual")}\n${manualFeedbackVar("node_layout")}\n${manualFeedbackVar("node_outline")}\n${manualFeedbackVar("node_storyline")}\n${manualFeedbackVar("node_strategy")}`,
              ),
            ),
          ],
          extraRules: [
            "slides_draft 必须严格符合 SlidePresentation JSON Schema。",
            "这一阶段重点是先成稿，不要把所有保守判断都拖到待确认，除非确实缺证据。",
            "draft_risks 必须明确指出页数失控、重复页、信息堆积、证据不足和叙事跳跃的问题。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "slides_draft",
            "幻灯片初稿",
            "输出 JSON，严格遵循 SlidePresentation 结构，作为终稿精修的输入。",
            undefined,
            slidePresentationJsonSchema,
          ),
          markdownArtifact(
            "draft_risks",
            "初稿风险",
            "输出 Markdown，指出当前初稿在叙事、页数、信息密度、重复页和证据支撑上的主要问题。",
          ),
          jsonArtifact(
            "draft_change_focus",
            "精修焦点",
            "输出 JSON，对象字段固定为 actions。每项包含 priority, action, target_pages, rationale。",
            undefined,
            draftChangeFocusJsonSchema,
          ),
        ],
      },
      {
        id: "node_polish",
        label: "精修委员会",
        displayName: "精修委员会",
        systemPromptTemplate: buildSystemPrompt("精修委员会"),
        stepDescription: "多模型并行将初稿打磨成可导出的最终幻灯片版本",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "精修委员会",
          mission:
            "请把 PPT 初稿打磨成真正适合导出的最终版本，重点修复页数、重复、结构密度、关键信息表达和视觉节奏问题。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 幻灯片初稿\n{{node_draft.slides_draft}}",
                "### 初稿风险\n{{node_draft.draft_risks}}",
                "### 精修焦点\n{{node_draft.draft_change_focus}}",
                "### 视觉资产计划\n{{node_visual.asset_plan}}",
                "### 图表规格\n{{node_visual.chart_specs}}",
                "### 视觉资产风险\n{{node_visual.asset_risks}}",
                "### 页面蓝图\n{{node_layout.page_blueprints}}",
                "### 视觉约束\n{{node_outline.visual_guardrails}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                `### 上游人工意见\n${manualFeedbackVar("node_draft")}\n${manualFeedbackVar("node_visual")}\n${manualFeedbackVar("node_layout")}\n${manualFeedbackVar("node_outline")}`,
              ),
            ),
          ],
          extraRules: [
            "slides_final 必须严格符合 SlidePresentation JSON Schema。",
            "必须把流程中形成的用户意见和取舍痕迹体现在最终结构中，而不是回退到最初发散状态。",
            "如果初稿问题已修复，polish_notes 必须明确说明修复了什么。",
            "最终内容必须可直接转成 PPT，避免长段落、重复页、过载表格和无依据结论。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "slides_final",
            "最终幻灯片",
            "输出 JSON，严格遵循 SlidePresentation 结构，供 PPT 导出节点直接渲染。",
            undefined,
            slidePresentationJsonSchema,
          ),
          markdownArtifact(
            "polish_notes",
            "精修说明",
            "输出 Markdown，说明初稿阶段哪些问题已修复、哪些仍需用户确认。",
          ),
        ],
      },
      {
        id: "node_dedup",
        label: "去重压缩委员会",
        displayName: "去重压缩委员会",
        systemPromptTemplate: buildSystemPrompt("去重压缩委员会"),
        stepDescription: "多模型并行压缩重复页、重复表达和超长内容",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "去重压缩委员会",
          mission:
            "请在不破坏主线和事实表达的前提下，压缩重复页、重复表述和明显冗长的内容，让后续页级审校面对的是更紧凑的版本。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 当前最终幻灯片\n{{node_polish.slides_final}}",
                "### 精修说明\n{{node_polish.polish_notes}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 视觉资产计划\n{{node_visual.asset_plan}}",
                `### 上游人工意见\n${manualFeedbackVar("node_polish")}\n${manualFeedbackVar("node_draft")}`,
              ),
            ),
          ],
          extraRules: [
            "slides_compact 必须严格符合 SlidePresentation JSON Schema。",
            "优先处理重复页、目录与正文重复、结论页与正文重复、同义反复的 bullet。",
            "如果合并了页面或删掉了页面，compression_notes 必须明确说明页码变化。",
            "不能为了压缩而删除关键结论或关键证据。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "slides_compact",
            "压缩后幻灯片",
            "输出 JSON，严格遵循 SlidePresentation 结构，作为页级审校和关键页强化的输入。",
            undefined,
            slidePresentationJsonSchema,
          ),
          jsonArtifact(
            "compression_notes",
            "压缩说明",
            "输出 JSON，对象字段固定为 merged_pages, removed_pages, rationale, remaining_long_pages。",
            undefined,
            compressionNotesJsonSchema,
          ),
        ],
      },
      {
        id: "node_page_audit",
        label: "页级审校委员会",
        displayName: "页级审校委员会",
        systemPromptTemplate: buildSystemPrompt("页级审校委员会"),
        stepDescription: "多模型并行逐页检查信息过载、重复页、弱结论和版式失衡",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "页级审校委员会",
          mission:
            "请逐页审查最终幻灯片，定位信息过载、重复表达、空洞结论、标题无辨识度和版式失衡的问题，为最终治理提供页级诊断。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 最终幻灯片\n{{node_dedup.slides_compact}}",
                "### 压缩说明\n{{node_dedup.compression_notes}}",
                "### 精修说明\n{{node_polish.polish_notes}}",
                "### 页面蓝图\n{{node_layout.page_blueprints}}",
                "### 视觉资产计划\n{{node_visual.asset_plan}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                `### 上游人工意见\n${manualFeedbackVar("node_dedup")}\n${manualFeedbackVar("node_polish")}\n${manualFeedbackVar("node_visual")}`,
              ),
            ),
          ],
          extraRules: [
            "page_findings 必须逐页给出问题诊断，问题类型至少覆盖信息密度、重复、结论力度、标题质量、布局平衡。",
            "只有真正影响导出的页面问题才进入 blocking_pages。",
            "如果没有阻断页，也要在 page_audit_summary 说明整体页级质量状态。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "page_findings",
            "页级问题清单",
            "输出 JSON，对象字段固定为 findings。每项包含 page_no, severity, issue_type, description, suggestion。",
            undefined,
            pageFindingsJsonSchema,
          ),
          markdownArtifact(
            "page_audit_summary",
            "页级审校总结",
            "输出 Markdown，总结最典型的页级问题、共性模式和优先修正建议。",
          ),
          jsonArtifact(
            "page_audit_gate",
            "页级审校门",
            "输出 JSON，对象字段固定为 has_blocking_page_issues, blocking_pages, reason。",
            [
              {
                name: "has_blocking_page_issues",
                type: "boolean",
                required: true,
                description: "是否存在阻断导出的页面级问题",
              },
              {
                name: "reason",
                type: "string",
                required: true,
                description: "页级门控结论",
              },
            ],
            pageAuditGateJsonSchema,
          ),
        ],
      },
      {
        id: "node_keypage",
        label: "关键页强化委员会",
        displayName: "关键页强化委员会",
        systemPromptTemplate: buildSystemPrompt("关键页强化委员会"),
        stepDescription: "多模型并行强化封面、目录、结论和 CTA 等高影响页面",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "关键页强化委员会",
          mission:
            "请在不破坏整体结构的前提下，专门强化封面、目录、关键转场页、结论页和行动建议页，让整份 PPT 的首因、尾因和记忆点更强。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 当前最终幻灯片\n{{node_dedup.slides_compact}}",
                "### 压缩说明\n{{node_dedup.compression_notes}}",
                "### 精修说明\n{{node_polish.polish_notes}}",
                "### 页级问题清单\n{{node_page_audit.page_findings}}",
                "### 页级审校总结\n{{node_page_audit.page_audit_summary}}",
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 标题方向\n{{node_storyline.title_options}}",
                "### 关键页样张\n{{node_outline.sample_script}}",
                `### 上游人工意见\n${manualFeedbackVar("node_page_audit")}\n${manualFeedbackVar("node_dedup")}\n${manualFeedbackVar("node_polish")}\n${manualFeedbackVar("node_storyline")}`,
              ),
            ),
          ],
          extraRules: [
            "slides_ready 必须严格符合 SlidePresentation JSON Schema。",
            "重点强化封面、目录、结论、行动建议和章节过渡页，不要对普通内容页做无谓重写。",
            "若页级审校指出弱结论或标题不清，必须优先在关键页修正。",
            "不能为了强化关键页而破坏页数预算、主线顺序和事实表达。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "slides_ready",
            "关键页强化版幻灯片",
            "输出 JSON，严格遵循 SlidePresentation 结构，作为治理门和最终导出的输入。",
            undefined,
            slidePresentationJsonSchema,
          ),
          jsonArtifact(
            "key_page_notes",
            "关键页强化说明",
            "输出 JSON，对象字段固定为 pages。每项包含 page_no, page_role, enhancement_goal, headline_direction, emphasis_hint。",
            undefined,
            keyPageNotesJsonSchema,
          ),
        ],
      },
      {
        id: "node_governance",
        label: "治理门委员会",
        displayName: "治理门委员会",
        systemPromptTemplate: buildSystemPrompt("治理门委员会"),
        stepDescription: "多模型并行做导出前门控和交付说明",
        modelMode: "compare",
        compareModelCount: 4,
        enableUserSelectionOutput: true,
        promptTemplate: buildRolePrompt({
          role: "治理门委员会",
          mission: "请对最终幻灯片做导出前门控，判断它是否足以进入正式导出，并给出最终交付说明。",
          sections: [
            promptSection(
              "输入",
              lines(
                "### 最终幻灯片\n{{node_keypage.slides_ready}}",
                "### 关键页强化说明\n{{node_keypage.key_page_notes}}",
                "### 精修说明\n{{node_polish.polish_notes}}",
                "### 页级问题清单\n{{node_page_audit.page_findings}}",
                "### 页级审校总结\n{{node_page_audit.page_audit_summary}}",
                "### 页级审校门\n{{node_page_audit.page_audit_gate}}",
                "### 证据映射\n{{node_research.evidence_map}}",
                "### 洞察卡片\n{{node_research.insight_cards}}",
                "### 演示策略\n{{node_strategy.deck_spec}}",
                "### 成功标准\n{{node_strategy.success_criteria}}",
                "### 视觉资产风险\n{{node_visual.asset_risks}}",
                "### 风险观察\n{{node_layout.risk_watchlist}}",
                `### 上游人工意见\n${manualFeedbackVar("node_keypage")}\n${manualFeedbackVar("node_page_audit")}\n${manualFeedbackVar("node_polish")}\n${manualFeedbackVar("node_draft")}\n${manualFeedbackVar("node_visual")}\n${manualFeedbackVar("node_layout")}`,
              ),
            ),
          ],
          extraRules: [
            "qa_gate.can_export 只有在结构、页数、事实表达和信息完整度都可接受时才能为 true。",
            "如果 page_audit_gate.has_blocking_page_issues=true，除非你能明确论证已在治理层化解，否则 qa_gate.can_export 不得为 true。",
            "claim_map 必须逐页给出关键结论及其证据来源；如果某页结论支撑不足，needs_confirmation 必须为 true，confidence 不能写 high。",
            "budget_gate 必须明确给出 within_budget, actual_pages, target_budget, overflow_pages, reason。",
            "如果显著超出预算且不是必要例外，within_budget 必须为 false。",
            "如果 budget_gate.within_budget=false，除非有充分业务理由，否则 qa_gate.can_export 不得为 true。",
            "如果 claim_map 中仍存在较多 needs_confirmation=true 的关键页面，必须在 qa_report 和 handoff_notes 中明确指出风险。",
            "如果存在影响导出的重大缺口，blocking_count 必须大于 0 且 can_export=false。",
            "如果上游人工意见与当前终稿仍有冲突，必须在 qa_report 和 handoff_notes 中明确指出，不能静默忽略。",
          ],
        }),
        namedOutputs: [
          jsonArtifact(
            "claim_map",
            "事实锚点图",
            "输出 JSON，对象字段固定为 claims。每项包含 page_no, claim, evidence_source, confidence, needs_confirmation。",
            undefined,
            claimMapJsonSchema,
          ),
          markdownArtifact(
            "factual_risks",
            "事实风险说明",
            "输出 Markdown，总结哪些页面的结论支撑最弱、哪些页需要用户二次确认。",
          ),
          markdownArtifact(
            "budget_report",
            "页数预算报告",
            "输出 Markdown，说明当前页数与策略预算的差异、超出原因和建议压缩方向。",
          ),
          jsonArtifact(
            "budget_gate",
            "页数预算门",
            "输出 JSON，对象字段固定为 within_budget, actual_pages, target_budget, overflow_pages, reason。",
            [
              {
                name: "within_budget",
                type: "boolean",
                required: true,
                description: "当前页数是否在预算范围内",
              },
              {
                name: "actual_pages",
                type: "number",
                required: true,
                description: "当前实际页数",
              },
              {
                name: "overflow_pages",
                type: "number",
                required: true,
                description: "超出预算的页数",
              },
              {
                name: "reason",
                type: "string",
                required: true,
                description: "预算门结论",
              },
            ],
            budgetGateJsonSchema,
          ),
          markdownArtifact(
            "qa_report",
            "终稿质检报告",
            "输出 Markdown，包含 PASS/WARNING/FAIL 结论、问题归因、修正建议和可导出判断。",
          ),
          jsonArtifact(
            "qa_gate",
            "终稿门控",
            "输出 JSON，对象字段固定为 can_export, blocking_count, reason。",
            [
              {
                name: "can_export",
                type: "boolean",
                required: true,
                description: "是否允许进入 PPT 导出",
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
                description: "导出结论说明",
              },
            ],
            qaGateJsonSchema,
          ),
          markdownArtifact(
            "handoff_notes",
            "交付说明",
            "输出 Markdown，说明未决项、建议替换素材、二次编辑风险和交付注意事项。",
          ),
        ],
      },
    ],
    restoreSources: [],
    postRestoreStages: [],
    exportRule: buildBlockingExportGateRule("node_governance"),
    exportContentMapping: [conditionRef("node_keypage", "slides_ready")],
    exportFormats: ["pptx"],
  };

  const { nodes, edges } = buildWorkflowFromBlueprint(blueprint, models);

  return {
    documentTypeCode: PRESENTATION_DOCUMENT_TYPE.code,
    name: PRESENTATION_WORKFLOW_NAME,
    description:
      "15 节点旗舰流程，覆盖需求解构、资料提炼、策略、叙事、结构化规划、视觉资产规划、初稿生成、精修、去重压缩、页级审校、关键页强化、治理门控与 PPT 导出。",
    isDefault: true,
    category: "flagship",
    nodes,
    edges,
  };
}
