/**
 * Seed script: bid_response document type + 8-node workflow.
 *
 * Usage:
 *   bun run packages/backend/src/scripts/seed-bid-workflow.ts          # seed
 *   bun run packages/backend/src/scripts/seed-bid-workflow.ts --teardown  # cleanup
 *
 * Requires DATABASE_URL env var.
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  documentTypes,
  workflows,
  models,
  providers,
} from "../db/schema";
import { validateWorkflow } from "../modules/workflows/validation";
import type {
  WorkflowNodeDef,
  WorkflowEdgeDef,
  OutputDef,
  NodeConfig,
  FormFieldDef,
  NamedOutputDef,
} from "@intelliflow/shared";

// ─── Constants ──────────────────────────────────────────────────────────────

const DOC_TYPE_CODE = "bid_response";
const WORKFLOW_NAME = "招投标通用生成流程";

// ─── deriveOutputs (inlined from frontend) ──────────────────────────────────

function deriveOutputs(nodeId: string, config: NodeConfig): OutputDef[] {
  switch (config.type) {
    case "input_transform": {
      const outputs: OutputDef[] = [];
      for (const field of config.formFields) {
        if (field.type === "file") {
          if (field.fileSlotId) {
            outputs.push({
              id: `${nodeId}-fileslot-${field.fileSlotId}`,
              name: field.fileSlotLabel || field.label || "文件槽位",
              description: `文件槽位: ${field.fileSlotLabel || field.label}`,
              segmentKey: field.fileSlotId,
            });
          }
        } else {
          const key = field.machineKey || field.id;
          outputs.push({
            id: `${nodeId}-field-${key}`,
            name: field.label || "未命名",
            description: `用户输入项: ${field.label}`,
            segmentKey: key,
          });
        }
      }
      const hasFileField = config.formFields.some((f) => f.type === "file");
      if (hasFileField) {
        outputs.push({
          id: `${nodeId}-file-upload`,
          name: "文件输出 (合并)",
          description: "所有文件合并文本",
          segmentKey: "text",
        });
      }
      return outputs;
    }
    case "model_call":
      if (config.namedOutputs && config.namedOutputs.length > 0) {
        return config.namedOutputs.map((no) => ({
          id: `${nodeId}-namedoutput-${no.id}`,
          name: no.name,
          description: `命名产物: ${no.name}`,
          segmentKey: no.id,
        }));
      }
      return config.modelIds.map((modelId) => ({
        id: `${nodeId}-model-${modelId}`,
        name: config.modelNames?.[modelId] ?? modelId,
        description: "模型生成输出",
        segmentKey: modelId,
      }));
    case "desensitize":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-desensitized-${src.outputId}`,
          name: `${src.displayName}.脱敏`,
          description: `脱敏后文本: ${src.displayName}`,
          segmentKey: src.outputId,
        }));
      }
      return [{ id: `${nodeId}-desensitized`, name: "脱敏后文本", segmentKey: "desensitized" }];
    case "restore":
      if (config.inputSources && config.inputSources.length > 0) {
        return config.inputSources.map((src) => ({
          id: `${nodeId}-restored-${src.sourceNodeId}-${src.outputId}`,
          name: `${src.displayName}.恢复`,
          description: `恢复后文本: ${src.displayName}`,
          segmentKey: `${src.sourceNodeId}.${src.outputId}`,
        }));
      }
      return [{ id: `${nodeId}-restored`, name: "恢复后文本", segmentKey: "restored" }];
    case "export":
    case "ppt":
      return [];
  }
}

// ─── Form fields ────────────────────────────────────────────────────────────

const formFields: FormFieldDef[] = [
  { id: "f1", machineKey: "project_name", label: "项目名称", type: "text", required: true },
  { id: "f2", machineKey: "tender_number", label: "招标编号", type: "text", required: false },
  { id: "f3", machineKey: "tender_org", label: "招标方名称", type: "text", required: false },
  { id: "f4", machineKey: "bidder_name", label: "投标方名称", type: "text", required: true },
  { id: "f5", machineKey: "legal_rep", label: "法定代表人", type: "text", required: true },
  { id: "f6", machineKey: "authorized_agent", label: "授权代理人", type: "text", required: false },
  { id: "f7", machineKey: "deadline", label: "投标截止日期", type: "datetime", required: false },
  { id: "f8", machineKey: "delivery_location", label: "交货地点", type: "text", required: false },
  { id: "f9", machineKey: "company_intro", label: "公司简介", type: "textarea", required: true },
  { id: "f10", machineKey: "qualification_list", label: "资质清单", type: "textarea", required: false },
  { id: "f11", machineKey: "tender_doc", label: "招标文件", type: "file", required: false, fileSlotId: "tender_doc", fileSlotLabel: "招标文件", fileCountMode: "single" },
  { id: "f12", machineKey: "product_selection", label: "产品选型表", type: "file", required: false, fileSlotId: "product_selection", fileSlotLabel: "产品选型表", fileCountMode: "single" },
  { id: "f13", machineKey: "supplementary", label: "补充材料", type: "file", required: false, fileSlotId: "supplementary", fileSlotLabel: "补充材料", fileCountMode: "unlimited" },
  { id: "f14", machineKey: "evidence_pack", label: "证据附件包", type: "file", required: false, fileSlotId: "evidence_pack", fileSlotLabel: "证据附件包", fileCountMode: "unlimited" },
  { id: "f15", machineKey: "reference_docs", label: "参考资料", type: "file", required: false, fileSlotId: "reference_docs", fileSlotLabel: "参考资料", fileCountMode: "unlimited" },
];

// ─── Prompt templates ───────────────────────────────────────────────────────

const PROMPT_ANALYZE = `你是一位资深的投标文件分析专家。请根据以下项目信息和材料，分析招标要求并生成投标蓝图。

## 项目基本信息
- 项目名称：{{node_input.project_name}}
- 招标编号：{{node_input.tender_number}}
- 招标方：{{node_input.tender_org}}
- 投标方：{{node_input.bidder_name}}
- 投标截止日期：{{node_input.deadline}}

## 招标文件内容
{{node_input.tender_doc}}

## 补充材料
{{node_input.supplementary}}

## 产品选型信息
{{node_input.product_selection}}

---

请按以下格式输出 5 个命名产物，用分隔符 ===NAMED_OUTPUT:xxx=== 分隔：

===NAMED_OUTPUT:bid_blueprint===
输出投标蓝图（Markdown 格式），包含：
1. 采购方式判断
2. 投标文件目录大纲，每章标注处理方式（规则填充/证据挂载/AI生成/人工确认）
3. 如无招标文件，输出建议性框架并标注"待确认"

===NAMED_OUTPUT:clause_list===
输出技术要求条款清单（JSON 数组格式），每条含：
- clause_id, clause_text, priority (★必须/重要/普通), category
如无招标文件，输出空数组 []

===NAMED_OUTPUT:scoring_matrix===
输出评分标准矩阵（JSON 格式），含：
- categories (评分大类), items (评分项), weights
如无招标文件，输出空对象 {}

===NAMED_OUTPUT:missing_info===
输出缺失信息提示清单（Markdown），列出用户需要补充的材料和信息。

===NAMED_OUTPUT:mode===
输出模式判断（JSON），格式：{"mode": "normal"} 或 {"mode": "degraded"}
有招标文件时为 normal，仅有需求文档等时为 degraded。`;

const PROMPT_TECHRESP = `你是一位专业的投标技术文档编写专家。请根据招标分析结果和项目资料，生成技术响应文件。

## 项目基本信息
- 项目名称：{{node_input.project_name}}
- 投标方：{{node_input.bidder_name}}
- 公司简介：{{node_input.company_intro}}
- 资质清单：{{node_input.qualification_list}}

## 招标分析结果
### 投标蓝图
{{node_analyze.bid_blueprint}}

### 条款清单
{{node_analyze.clause_list}}

### 评分矩阵
{{node_analyze.scoring_matrix}}

### 模式
{{node_analyze.mode}}

## 产品选型
{{node_input.product_selection}}

---

请按以下格式输出 5 个命名产物：

===NAMED_OUTPUT:technical_response===
逐条生成技术应答表（JSON 数组），每条含：
clause_id, clause_text, is_met (boolean), deviation_note, response_summary, evidence_ref
降级模式下输出空数组。

===NAMED_OUTPUT:deviation_table===
生成偏差表（JSON 数组），每条含：
item, requirement, actual_response, deviation_type, explanation
降级模式下输出空数组。

===NAMED_OUTPUT:equipment_list===
生成设备清单（JSON 数组），每条含：
category, name, brand, model, specs, quantity, unit_price
降级模式下输出空数组。

===NAMED_OUTPUT:form_fills===
基于公司信息和项目数据，生成规则填充型内容（Markdown 格式），包含：
- 投标函草稿
- 授权委托书草稿
- 资格审查表
- 商务偏差表
要求：
1. 必须直接填入已知真实信息，不得输出 [COMPANY_NAME_1]、[ADDRESS_7]、双花括号变量引用之类占位符；
2. 信息确实缺失时，明确写“待补充（人工确认）”，不要编造新的占位符或方括号模板；
3. 不要输出“草稿模板说明”“示例”“请填写”等元提示。 

===NAMED_OUTPUT:evidence_index===
生成证据附件索引（JSON 数组），每条含：
clause_id, evidence_file, evidence_location, match_basis
降级模式下输出空数组。`;

const PROMPT_SOLUTION = `你是一位资深的投标方案撰写专家。请根据投标蓝图和前序分析结果，分组生成方案正文。

## 项目信息
- 项目名称：{{node_input.project_name}}
- 投标方：{{node_input.bidder_name}}
- 公司简介：{{node_input.company_intro}}

## 投标蓝图
{{node_analyze.bid_blueprint}}

## 模式
{{node_analyze.mode}}

## 技术响应（如有）
{{node_techresp.technical_response}}

## 规则填充内容
{{node_techresp.form_fills}}

---

请按蓝图中标注为"AI 生成"的章节，分组生成方案正文。每组用分隔符分隔：

全局要求：
1. 直接使用上游已知真实项目/公司/人员/金额/地址/电话信息；
2. 禁止生成 [COMPANY_NAME_1]、[PERSON_NAME_9]、[ADDRESS_7]、双花括号变量引用等任何占位符；
3. 信息缺失时写“待补充（人工确认）”，不要编造新占位符；
4. 禁止输出 HTML 注释、章节锚点或 <!-- chapter:... --> / <!-- /chapter:... --> 标记；
5. 输出面向最终标书正文，不要写“模板”“示例”“以下为”之类说明语。

===NAMED_OUTPUT:group1_delivery===
组1：供货与交付方案（供货方案、交货计划、运输保险等）。

===NAMED_OUTPUT:group2_implementation===
组2：实施与部署方案（项目实施方案、系统安装部署、集成调试等）。

===NAMED_OUTPUT:group3_service===
组3：运维与售后方案（售后服务、运维方案、故障响应、备品备件等）。

===NAMED_OUTPUT:group4_training===
组4：培训与组织方案（培训方案、项目组织架构、团队成员安排）。

===NAMED_OUTPUT:group5_quality===
组5：质量与安全措施（质量保证、安全措施、保密措施）。

===NAMED_OUTPUT:group6_construction===
组6：工程建设方案（建设方案、施工方案、进度计划），仅工程类项目生成。
非工程类项目输出"本项目非工程建设类，此部分不适用。"

===NAMED_OUTPUT:group7_extras===
组7：增值内容（重点难点分析、合理化建议、技术优势说明）。

===NAMED_OUTPUT:chapter_map===
输出章节索引（JSON 数组），每条含：
chapter_id, title, source_file (group*.md), volume (single)`;

const PROMPT_QA = `你是一位严格的投标文件质量审核专家。请对以下投标文件进行全面质检。

## 项目信息
- 项目名称：{{node_input.project_name}}
- 投标方：{{node_input.bidder_name}}

## 投标蓝图
{{node_analyze.bid_blueprint}}

## 条款清单
{{node_analyze.clause_list}}

## 评分矩阵
{{node_analyze.scoring_matrix}}

## 模式
{{node_analyze.mode}}

## 技术响应
{{node_techresp.technical_response}}

## 偏差表
{{node_techresp.deviation_table}}

## 规则填充
{{node_techresp.form_fills}}

## 方案正文
### 供货与交付
{{node_solution.group1_delivery}}

### 实施与部署
{{node_solution.group2_implementation}}

### 运维与售后
{{node_solution.group3_service}}

### 培训与组织
{{node_solution.group4_training}}

### 质量与安全
{{node_solution.group5_quality}}

### 工程建设
{{node_solution.group6_construction}}

### 增值内容
{{node_solution.group7_extras}}

---

请执行以下质检并输出 3 个命名产物：

===NAMED_OUTPUT:qa_report===
输出质检报告（Markdown），包含：
A. 合规检查结果（★必须项覆盖、评分项覆盖率）
B. 一致性检查结果（产品型号/数量/金额跨章节一致性）
C. 完整性检查结果（各章节生成完整度）
每项标注 PASS/FAIL/WARNING。

===NAMED_OUTPUT:issue_list===
输出问题清单（JSON 数组），每条含：
issue_id, severity (critical/major/minor), category (合规/一致性/完整性), description, affected_section, suggestion

===NAMED_OUTPUT:qa_gate===
输出质检门控（JSON），格式：
{"can_export": true/false, "blocking_count": N, "reason": "..."}
当存在 critical 问题时 can_export=false。`;

const PROMPT_MERGE = `你是一位专业的文档排版编辑。请将以下各章节内容按顺序组装成一份完整的投标文件正文。

## 严格要求
1. **禁止改写**：不得修改、删减或增加任何实质内容
2. **禁止占位符**：不得输出 [COMPANY_NAME]、{{变量}} 等占位符
3. **仅做排版**：添加章节标题编号、确保格式统一
4. 每个章节之间用分页符标记 ---

## 章节内容

### 第一部分 投标函与资格审查
{{node_restore.node_techresp.form_fills}}

### 第二部分 供货与交付方案
{{node_restore.node_solution.group1_delivery}}

### 第三部分 实施与部署方案
{{node_restore.node_solution.group2_implementation}}

### 第四部分 运维与售后方案
{{node_restore.node_solution.group3_service}}

### 第五部分 培训与组织方案
{{node_restore.node_solution.group4_training}}

### 第六部分 质量与安全措施
{{node_restore.node_solution.group5_quality}}

### 第七部分 工程建设方案
{{node_restore.node_solution.group6_construction}}

### 第八部分 增值内容
{{node_restore.node_solution.group7_extras}}

---

请直接输出组装后的完整文档正文，不要输出任何说明或元提示。`;

// ─── Seed ───────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Querying compatible model...");

  // Find any active model from an active provider
  const compatibleModels = await db
    .select({ id: models.id, displayName: models.displayName, providerType: providers.type })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.isActive, true),
        eq(models.isProviderDisabled, false),
        eq(providers.isActive, true),
      ),
    )
    .limit(1);

  if (compatibleModels.length === 0) {
    console.error("错误：未找到可用的模型。请先在管理后台配置模型和 Provider。");
    process.exit(1);
  }

  const defaultModelId = compatibleModels[0].id;
  console.log(`Using model: ${compatibleModels[0].displayName} (${defaultModelId})`);

  // ── 1. Upsert document type ───────────────────────────────────────────────

  const existing = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, DOC_TYPE_CODE))
    .limit(1);

  let docTypeId: string;

  if (existing.length > 0) {
    docTypeId = existing[0].id;
    console.log(`Document type '${DOC_TYPE_CODE}' already exists (${docTypeId}), reusing.`);
  } else {
    const [inserted] = await db
      .insert(documentTypes)
      .values({
        name: "招投标响应文件",
        code: DOC_TYPE_CODE,
        description: "基于招标文件或项目材料，分析要求并生成投标响应文件。支持完整流程和降级流程。",
        isActive: true,
      })
      .returning({ id: documentTypes.id });
    docTypeId = inserted.id;
    console.log(`Created document type '${DOC_TYPE_CODE}' (${docTypeId})`);
  }

  // ── 2. Build nodes ───────────────────────────────────────────────────────

  const X_STEP = 300;

  function makeNode(
    id: string,
    label: string,
    type: WorkflowNodeDef["type"],
    config: NodeConfig,
    index: number,
  ): WorkflowNodeDef {
    const outputs = deriveOutputs(id, config);
    return {
      id,
      type,
      label,
      position: { x: index * X_STEP, y: 0 },
      config,
      outputs,
    };
  }

  // Desensitize categories
  const desensCategories = [
    { name: "公司名", description: "公司/企业名称" },
    { name: "人名", description: "法定代表人、联系人等人名" },
    { name: "金额", description: "报价、合同金额等" },
    { name: "地址", description: "公司地址、交货地址等" },
    { name: "联系方式", description: "电话号码、邮箱等" },
    { name: "身份证号", description: "身份证号码" },
    { name: "银行账号", description: "银行账号信息" },
  ];

  // namedOutputs definitions
  const analyzeNamedOutputs: NamedOutputDef[] = [
    { id: "bid_blueprint", name: "投标蓝图", format: "markdown" },
    { id: "clause_list", name: "条款清单", format: "json" },
    { id: "scoring_matrix", name: "评分矩阵", format: "json" },
    { id: "missing_info", name: "缺失信息", format: "markdown" },
    { id: "mode", name: "模式判断", format: "json" },
  ];

  const techrespNamedOutputs: NamedOutputDef[] = [
    { id: "technical_response", name: "技术应答表", format: "json" },
    { id: "deviation_table", name: "偏差表", format: "json" },
    { id: "equipment_list", name: "设备清单", format: "json" },
    { id: "form_fills", name: "规则填充", format: "markdown" },
    { id: "evidence_index", name: "证据索引", format: "json" },
  ];

  const solutionNamedOutputs: NamedOutputDef[] = [
    { id: "group1_delivery", name: "供货与交付", format: "markdown" },
    { id: "group2_implementation", name: "实施与部署", format: "markdown" },
    { id: "group3_service", name: "运维与售后", format: "markdown" },
    { id: "group4_training", name: "培训与组织", format: "markdown" },
    { id: "group5_quality", name: "质量与安全", format: "markdown" },
    { id: "group6_construction", name: "工程建设", format: "markdown" },
    { id: "group7_extras", name: "增值内容", format: "markdown" },
    { id: "chapter_map", name: "章节索引", format: "json" },
  ];

  const qaNamedOutputs: NamedOutputDef[] = [
    { id: "qa_report", name: "质检报告", format: "markdown" },
    { id: "issue_list", name: "问题清单", format: "json" },
    { id: "qa_gate", name: "质检门控", format: "json" },
  ];

  const nodes: WorkflowNodeDef[] = [
    // ① 输入转换
    makeNode("node_input", "输入转换", "input_transform", {
      type: "input_transform",
      formFields: formFields,
    }, 0),

    // ② 信息脱敏
    makeNode("node_desens", "信息脱敏", "desensitize", {
      type: "desensitize",
      categories: desensCategories,
      localModelId: defaultModelId,
      skippable: true,
      executionRule: {
        action: "skip",
        logic: "and",
        conditions: [
          {
            sourceRef: {
              nodeId: "node_input",
              outputId: "tender_doc",
              variableName: "node_input.tender_doc",
            },
            operator: "not_exists",
          },
          {
            sourceRef: {
              nodeId: "node_input",
              outputId: "product_selection",
              variableName: "node_input.product_selection",
            },
            operator: "not_exists",
          },
          {
            sourceRef: {
              nodeId: "node_input",
              outputId: "supplementary",
              variableName: "node_input.supplementary",
            },
            operator: "not_exists",
          },
          {
            sourceRef: {
              nodeId: "node_input",
              outputId: "evidence_pack",
              variableName: "node_input.evidence_pack",
            },
            operator: "not_exists",
          },
          {
            sourceRef: {
              nodeId: "node_input",
              outputId: "reference_docs",
              variableName: "node_input.reference_docs",
            },
            operator: "not_exists",
          },
        ],
      },
      inputSources: [
        { sourceNodeId: "node_input", outputId: "node_input-fileslot-tender_doc", displayName: "招标文件" },
        { sourceNodeId: "node_input", outputId: "node_input-fileslot-product_selection", displayName: "产品选型表" },
        { sourceNodeId: "node_input", outputId: "node_input-fileslot-supplementary", displayName: "补充材料" },
        { sourceNodeId: "node_input", outputId: "node_input-fileslot-evidence_pack", displayName: "证据附件包" },
        { sourceNodeId: "node_input", outputId: "node_input-fileslot-reference_docs", displayName: "参考资料" },
      ],
    }, 1),

    // ③ 分析招标要求
    makeNode("node_analyze", "分析招标要求", "model_call", {
      type: "model_call",
      displayName: "分析招标要求",
      modelIds: [defaultModelId],
      promptTemplate: PROMPT_ANALYZE,
      inputRefs: [],
      outputFormat: "text",
      namedOutputs: analyzeNamedOutputs,
    }, 2),

    // ④ 技术响应
    makeNode("node_techresp", "生成技术响应", "model_call", {
      type: "model_call",
      displayName: "生成技术响应与表格",
      modelIds: [defaultModelId],
      promptTemplate: PROMPT_TECHRESP,
      inputRefs: [],
      outputFormat: "text",
      namedOutputs: techrespNamedOutputs,
    }, 3),

    // ⑤ 方案正文
    makeNode("node_solution", "生成方案正文", "model_call", {
      type: "model_call",
      displayName: "生成方案正文",
      modelIds: [defaultModelId],
      promptTemplate: PROMPT_SOLUTION,
      inputRefs: [],
      outputFormat: "markdown",
      namedOutputs: solutionNamedOutputs,
    }, 4),

    // ⑥ 质检
    makeNode("node_qa", "投标文件质检", "model_call", {
      type: "model_call",
      displayName: "投标文件质检",
      modelIds: [defaultModelId],
      promptTemplate: PROMPT_QA,
      inputRefs: [],
      outputFormat: "text",
      namedOutputs: qaNamedOutputs,
    }, 5),

    // ⑦ 信息恢复
    makeNode("node_restore", "信息恢复", "restore", {
      type: "restore",
      pairedDesensitizeNodeId: "node_desens",
      inputSources: [
        { sourceNodeId: "node_techresp", outputId: "form_fills", displayName: "生成技术响应 · 规则填充" },
        { sourceNodeId: "node_solution", outputId: "group1_delivery", displayName: "生成方案正文 · 供货与交付" },
        { sourceNodeId: "node_solution", outputId: "group2_implementation", displayName: "生成方案正文 · 实施与部署" },
        { sourceNodeId: "node_solution", outputId: "group3_service", displayName: "生成方案正文 · 运维与售后" },
        { sourceNodeId: "node_solution", outputId: "group4_training", displayName: "生成方案正文 · 培训与组织" },
        { sourceNodeId: "node_solution", outputId: "group5_quality", displayName: "生成方案正文 · 质量与安全" },
        { sourceNodeId: "node_solution", outputId: "group6_construction", displayName: "生成方案正文 · 工程建设" },
        { sourceNodeId: "node_solution", outputId: "group7_extras", displayName: "生成方案正文 · 增值内容" },
      ],
    }, 6),

    // ⑧ 正文合并
    makeNode("node_merge", "正文合并", "model_call", {
      type: "model_call",
      displayName: "正文合并排版",
      modelIds: [defaultModelId],
      promptTemplate: PROMPT_MERGE,
      inputRefs: [],
      outputFormat: "markdown",
    }, 7),

    // ⑨ 文件导出
    makeNode("node_export", "文件导出", "export", {
      type: "export",
      formats: ["word", "pdf"],
      templateId: null,
      contentMapping: [
        { nodeId: "node_merge", outputId: defaultModelId, variableName: `node_merge.${defaultModelId}` },
      ],
    }, 8),
  ];

  // ── 3. Build edges (linear chain) ─────────────────────────────────────────

  const nodeIds = nodes.map((n) => n.id);
  const edges: WorkflowEdgeDef[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    edges.push({
      id: `edge-${nodeIds[i]}-${nodeIds[i + 1]}`,
      source: nodeIds[i],
      target: nodeIds[i + 1],
    });
  }

  // ── 4. Validate ───────────────────────────────────────────────────────────

  console.log("Validating workflow...");
  const errors = validateWorkflow(nodes, edges);
  const realErrors = errors.filter((e) => e.severity === "error");
  const warnings = errors.filter((e) => e.severity === "warning");

  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  [warn] ${w.nodeId ?? ""}: ${w.message}`);
  }

  if (realErrors.length > 0) {
    console.error(`Validation FAILED with ${realErrors.length} error(s):`);
    for (const e of realErrors) console.error(`  [error] ${e.nodeId ?? ""}: ${e.message}`);
    process.exit(1);
  }

  console.log("Validation passed (0 errors).");

  // ── 5. Upsert workflow ────────────────────────────────────────────────────

  const existingWf = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.documentTypeId, docTypeId),
        eq(workflows.name, WORKFLOW_NAME),
      ),
    )
    .limit(1);

  let workflowId: string;

  if (existingWf.length > 0) {
    workflowId = existingWf[0].id;
    await db
      .update(workflows)
      .set({
        nodes: nodes as any,
        edges: edges as any,
        status: "active",
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId));
    console.log(`Updated workflow '${WORKFLOW_NAME}' (${workflowId}) → active`);
  } else {
    const [inserted] = await db
      .insert(workflows)
      .values({
        documentTypeId: docTypeId,
        name: WORKFLOW_NAME,
        description: "投标文件生成9节点流程：输入→脱敏→分析→技术响应→方案→质检→恢复→合并→导出",
        status: "active",
        isDefault: true,
        nodes: nodes as any,
        edges: edges as any,
      })
      .returning({ id: workflows.id });
    workflowId = inserted.id;
    console.log(`Created workflow '${WORKFLOW_NAME}' (${workflowId}) → active`);
  }

  console.log("\nSeed completed successfully.");
  console.log(`  Document type: ${DOC_TYPE_CODE} (${docTypeId})`);
  console.log(`  Workflow: ${WORKFLOW_NAME} (${workflowId})`);
  console.log(`  Nodes: ${nodes.length}, Edges: ${edges.length}`);
  console.log(`  Model: ${compatibleModels[0].displayName}`);
}

// ─── Teardown ───────────────────────────────────────────────────────────────

async function teardown() {
  console.log("Teardown: removing bid_response seed data...");

  // Find the doc type
  const [docType] = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, DOC_TYPE_CODE))
    .limit(1);

  if (!docType) {
    console.log("Document type not found, nothing to teardown.");
    process.exit(0);
  }

  // Delete workflows first (FK: documentTypeId → documentTypes)
  const deletedWf = await db
    .delete(workflows)
    .where(eq(workflows.documentTypeId, docType.id))
    .returning({ id: workflows.id });
  console.log(`  Deleted ${deletedWf.length} workflow(s)`);

  // Delete document type
  await db
    .delete(documentTypes)
    .where(eq(documentTypes.id, docType.id));
  console.log(`  Deleted document type '${DOC_TYPE_CODE}'`);

  console.log("Teardown completed.");
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes("--teardown")) {
  teardown().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else {
  seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
