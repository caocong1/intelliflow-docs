import type {
  ModelCallSnapshotPayload,
  ModelOutput,
  NodeExecutionStatus,
} from "@intelliflow/shared";

function cloneModels(models: Record<string, ModelOutput>): Record<string, ModelOutput> {
  return Object.fromEntries(
    Object.entries(models).map(([modelId, model]) => [modelId, { ...model }]),
  );
}

function hasFinalizedModelCallOutput(outputData: Record<string, unknown>): boolean {
  return typeof outputData.selectedContent === "string" || typeof outputData.text === "string";
}

export function normalizeModelOutputsForCompletedReview(
  models: Record<string, ModelOutput>,
): Record<string, ModelOutput> {
  return Object.fromEntries(
    Object.entries(models).map(([modelId, model]) => {
      if (model.status === "pending" || model.status === "streaming") {
        return [
          modelId,
          {
            ...model,
            status: "completed" as const,
            errorMessage: undefined,
          },
        ];
      }

      return [modelId, { ...model }];
    }),
  );
}

export function normalizeModelOutputsForFailure(
  models: Record<string, ModelOutput>,
  errorMessage: string,
): Record<string, ModelOutput> {
  return Object.fromEntries(
    Object.entries(models).map(([modelId, model]) => {
      if (model.status === "pending" || model.status === "streaming") {
        return [
          modelId,
          {
            ...model,
            status: "failed" as const,
            errorMessage,
          },
        ];
      }

      if (model.status === "failed" && !model.errorMessage) {
        return [
          modelId,
          {
            ...model,
            errorMessage,
          },
        ];
      }

      return [modelId, { ...model }];
    }),
  );
}

export function getModelOutputsForDisplay(params: {
  outputData: Record<string, unknown> | null;
  nodeStatus: NodeExecutionStatus;
  errorMessage?: string | null;
}): Record<string, ModelOutput> {
  const outputData = params.outputData ?? {};
  const modelsData = cloneModels((outputData.models as Record<string, ModelOutput>) ?? {});
  if (Object.keys(modelsData).length === 0) return modelsData;

  if (hasFinalizedModelCallOutput(outputData)) {
    return normalizeModelOutputsForCompletedReview(modelsData);
  }

  if (params.nodeStatus === "failed") {
    return normalizeModelOutputsForFailure(modelsData, params.errorMessage ?? "生成失败");
  }

  return modelsData;
}

export function normalizeModelCallOutputDataForFailure(
  outputData: Record<string, unknown> | null,
  errorMessage: string,
): Record<string, unknown> | null {
  if (!outputData) return outputData;
  const models = (outputData.models as Record<string, ModelOutput>) ?? null;
  if (!models) return outputData;

  return {
    ...outputData,
    models: normalizeModelOutputsForFailure(models, errorMessage),
  };
}

export function buildModelCallSnapshotPayload(params: {
  outputData: Record<string, unknown> | null;
  nodeStatus: NodeExecutionStatus;
  errorMessage?: string | null;
  selectedOutputKey: string | null;
}): ModelCallSnapshotPayload | null {
  const models = getModelOutputsForDisplay({
    outputData: params.outputData,
    nodeStatus: params.nodeStatus,
    errorMessage: params.errorMessage,
  });
  if (Object.keys(models).length === 0) return null;

  return {
    models,
    selectedModelId: params.selectedOutputKey,
    selectedModelIds: ((params.outputData?.selectedModelIds as string[] | undefined) ?? []).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
    done: params.nodeStatus !== "in_progress",
  };
}
