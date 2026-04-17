import type { NamedOutputDef } from "@intelliflow/shared";

export type ModelArtifactValue = {
  content: string;
  format: string;
  modelId?: string;
  modelDisplayName?: string;
};

export type ModelArtifactIssue = {
  kind: "fallback_only" | "partial";
  sourceMeta: string;
  selectionMessage: string;
};

export type ModelArtifactDiagnostic = {
  parsedArtifacts: Array<[string, ModelArtifactValue]>;
  rawArtifact?: {
    artifactId: string;
    artifactName: string;
    content: string;
    format: string;
  };
  issue?: ModelArtifactIssue;
  isSelectable: boolean;
};

export const RAW_RESPONSE_ARTIFACT_ID = "__raw_response__";

export function diagnoseModelArtifacts(params: {
  namedOutputDefs: NamedOutputDef[];
  outputs?: Record<string, ModelArtifactValue>;
  rawContent?: string;
}): ModelArtifactDiagnostic {
  const expectedCount = params.namedOutputDefs.length;
  const outputs = params.outputs ?? {};
  const parsedArtifacts = Object.entries(outputs).filter(
    ([artifactId]) => artifactId !== "_default",
  );
  const hasDefaultArtifact = "_default" in outputs;
  const rawContent = params.rawContent?.trim() ?? "";

  if (expectedCount === 0) {
    return {
      parsedArtifacts,
      isSelectable: true,
    };
  }

  const missingCount = Math.max(expectedCount - parsedArtifacts.length, 0);
  const hasPartialParse = missingCount > 0;

  if (!hasDefaultArtifact && !hasPartialParse) {
    return {
      parsedArtifacts,
      isSelectable: true,
    };
  }

  const rawArtifactContent =
    typeof outputs._default?.content === "string" && outputs._default.content.trim().length > 0
      ? outputs._default.content
      : rawContent;

  const issue: ModelArtifactIssue = hasDefaultArtifact
    ? parsedArtifacts.length === 0
      ? {
          kind: "fallback_only",
          sourceMeta: "命名产物解析异常，仅保留原始响应",
          selectionMessage: "命名产物解析异常，当前仅保留原始响应，暂不可加入选择。",
        }
      : {
          kind: "partial",
          sourceMeta: `命名产物不完整（${parsedArtifacts.length}/${expectedCount}），已保留原始响应`,
          selectionMessage: `命名产物仅解析出 ${parsedArtifacts.length}/${expectedCount} 个，暂不可加入选择。`,
        }
    : {
        kind: "partial",
        sourceMeta: `命名产物仅解析出 ${parsedArtifacts.length}/${expectedCount} 个`,
        selectionMessage: `命名产物仅解析出 ${parsedArtifacts.length}/${expectedCount} 个，暂不可加入选择。`,
      };

  return {
    parsedArtifacts,
    rawArtifact: rawArtifactContent
      ? {
          artifactId: RAW_RESPONSE_ARTIFACT_ID,
          artifactName: "原始响应（解析异常）",
          content: rawArtifactContent,
          format: "text",
        }
      : undefined,
    issue,
    isSelectable: false,
  };
}
