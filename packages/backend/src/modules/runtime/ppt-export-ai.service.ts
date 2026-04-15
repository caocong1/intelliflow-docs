import { and, desc, eq } from "drizzle-orm";
import type { SlidePresentation } from "../../../../shared/src/slide-types";
import { db } from "../../db";
import { modelCallLogs, models, providers } from "../../db/schema";
import type { NativeTemplateProfile } from "../ppt-templates/native-template-profile";
import { buildTemplatePromptSummary } from "./ppt-deck-composition";
import { validateSlidePresentation } from "./slide-schema";
import { getStrategy } from "./strategies";
import type { ModelCallInput } from "./strategies";

type PlanningModel = ModelCallInput & {
  providerId: string;
  providerName: string;
  deploymentType: "cloud" | "local";
};

function extractJsonCandidate(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

async function selectPlanningModel(): Promise<PlanningModel | null> {
  const rows = await db
    .select({
      id: models.id,
      modelId: models.modelId,
      displayName: models.displayName,
      temperature: models.temperature,
      maxTokens: models.maxTokens,
      topP: models.topP,
      baseUrl: providers.baseUrl,
      apiKey: providers.apiKey,
      providerType: providers.type,
      providerId: providers.id,
      providerName: providers.name,
      deploymentType: providers.deploymentType,
      agentMode: models.agentMode,
      agentMaxTurns: models.agentMaxTurns,
      agentMaxBudgetUsd: models.agentMaxBudgetUsd,
      agentAllowedTools: models.agentAllowedTools,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.isActive, true),
        eq(models.isProviderDisabled, false),
        eq(providers.isActive, true),
        eq(providers.deploymentType, "cloud"),
      ),
    )
    .orderBy(desc(models.createdAt));

  if (rows.length === 0) return null;
  return rows.find((row) => row.providerType !== "ollama") ?? rows[0];
}

function buildPlanningPrompt(content: string, templateProfile?: NativeTemplateProfile | null): {
  systemPrompt: string;
  resolvedPrompt: string;
} {
  const templateSummary =
    templateProfile && templateProfile.slides.length > 0
      ? `\n\n可用模板画像摘要：\n${buildTemplatePromptSummary(templateProfile.slides)}`
      : "\n\n当前未提供可用的模板画像，按通用商务演示结构编排。";

  return {
    systemPrompt:
      "你是一个专业 PPT 编排器。请把输入内容整理为可直接渲染的 SlidePresentation JSON。只输出 JSON，不要加解释。",
    resolvedPrompt: [
      "请将以下内容整理为适合导出的幻灯片结构。",
      "必须严格输出 SlidePresentation JSON。",
      "每页都尽量补全 semanticRole、sectionKey、visualIntent。",
      "semanticRole 只能使用以下枚举：cover、toc、section_break、bullet_list、comparison、timeline、table、image_focus、summary、qna、closing。",
      "优先保证封面、目录、过渡页、总结页、结尾页的叙事完整。",
      "bullets 需要控制在适合 PPT 阅读的密度，不要长段落。",
      templateSummary,
      "\n原始内容如下：\n",
      content,
    ].join("\n"),
  };
}

export async function composeDeckWithAi(params: {
  content: string;
  templateProfile?: NativeTemplateProfile | null;
  documentId: string;
  nodeExecutionId: string;
  userId: string;
}): Promise<{
  presentation: SlidePresentation | null;
  warning?: string;
  modelDisplayName?: string;
}> {
  const model = await selectPlanningModel();
  if (!model) {
    return {
      presentation: null,
      warning: "未找到可用 cloud 模型，已跳过 AI 编排。",
    };
  }

  const { systemPrompt, resolvedPrompt } = buildPlanningPrompt(
    params.content,
    params.templateProfile,
  );
  const startTime = Date.now();

  try {
    const strategy = getStrategy(model.providerType);
    const result = await strategy.execute({
      model,
      resolvedPrompt,
      resolvedSystemPrompt: systemPrompt,
      sendEvent: () => {},
    });

    const responseContent = result.content ?? "";
    const jsonCandidate = extractJsonCandidate(responseContent);
    let presentation: SlidePresentation | null = null;
    let warning: string | undefined;

    try {
      const parsed = JSON.parse(jsonCandidate);
      const validation = validateSlidePresentation(parsed);
      if (validation.valid) {
        presentation = parsed as SlidePresentation;
      } else {
        warning = `AI 编排输出未通过幻灯片 Schema 校验：${validation.errors?.join("；") ?? "未知错误"}`;
      }
    } catch {
      warning = "AI 编排输出不是合法 JSON，已降级为规则分页模式。";
    }

    await db.insert(modelCallLogs).values({
      documentId: params.documentId,
      nodeExecutionId: params.nodeExecutionId,
      userId: params.userId,
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.displayName,
      callSource: "ppt_export_planning",
      promptTemplate: null,
      systemPrompt,
      resolvedPrompt,
      variableMapping: null,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      responseStatus: presentation ? "completed" : "format_error",
      responseContent,
      contentLength: responseContent.length,
      tokenUsage: null,
      duration: Date.now() - startTime,
      errorMessage: warning ?? null,
    });

    return {
      presentation,
      warning,
      modelDisplayName: model.displayName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(modelCallLogs).values({
      documentId: params.documentId,
      nodeExecutionId: params.nodeExecutionId,
      userId: params.userId,
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.displayName,
      callSource: "ppt_export_planning",
      promptTemplate: null,
      systemPrompt,
      resolvedPrompt,
      variableMapping: null,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      responseStatus: "failed",
      responseContent: null,
      contentLength: 0,
      tokenUsage: null,
      duration: Date.now() - startTime,
      errorMessage: message,
    });

    return {
      presentation: null,
      warning: `AI 编排调用失败：${message}`,
      modelDisplayName: model.displayName,
    };
  }
}
