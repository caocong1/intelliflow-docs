import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { documentTypes, models, providers, workflows } from "../db/schema";
import { validateWorkflow } from "../modules/workflows/validation";
import type { AvailableModel } from "./demo-workflows/builders";
import { resolveDemoModels } from "./demo-workflows/builders";
import {
  PRESENTATION_DOCUMENT_TYPE,
  PRESENTATION_WORKFLOW_NAME,
  buildPresentationWorkflowDefinition,
} from "./ppt-generation-workflow-definition";

async function loadAvailableModels(): Promise<AvailableModel[]> {
  return db
    .select({
      id: models.id,
      displayName: models.displayName,
      deploymentType: providers.deploymentType,
      providerType: providers.type,
      providerName: providers.name,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(
      and(
        eq(models.isActive, true),
        eq(models.isProviderDisabled, false),
        eq(providers.isActive, true),
      ),
    );
}

function selectPresentationModels(availableModels: AvailableModel[]) {
  try {
    return resolveDemoModels(availableModels);
  } catch {
    const cloudModels = availableModels.filter((model) => model.deploymentType === "cloud");
    if (cloudModels.length < 2) {
      throw new Error("未找到足够的云端模型，PPT 生成流程至少需要 2 个 cloud 模型");
    }

    const compareClouds = cloudModels.slice(0, Math.min(4, cloudModels.length));

    return {
      desensitize: compareClouds[0],
      primaryCloud: compareClouds[0],
      secondaryCloud: compareClouds[1] ?? compareClouds[0],
      compareClouds,
    };
  }
}

export async function seedPresentationWorkflow() {
  const availableModels = await loadAvailableModels();
  const selectedModels = selectPresentationModels(availableModels);
  const workflow = buildPresentationWorkflowDefinition(selectedModels);

  const errors = validateWorkflow(workflow.nodes, workflow.edges).filter(
    (item) => item.severity === "error",
  );
  if (errors.length > 0) {
    const detail = errors.map((item) => `${item.nodeId ?? "workflow"}: ${item.message}`).join("\n");
    throw new Error(`工作流校验失败：\n${detail}`);
  }

  const existingDocType = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, PRESENTATION_DOCUMENT_TYPE.code))
    .limit(1);

  let documentTypeId: string;

  if (existingDocType.length > 0) {
    documentTypeId = existingDocType[0].id;
    await db
      .update(documentTypes)
      .set({
        name: PRESENTATION_DOCUMENT_TYPE.name,
        description: PRESENTATION_DOCUMENT_TYPE.description,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(documentTypes.id, documentTypeId));
  } else {
    const [created] = await db
      .insert(documentTypes)
      .values({
        code: PRESENTATION_DOCUMENT_TYPE.code,
        name: PRESENTATION_DOCUMENT_TYPE.name,
        description: PRESENTATION_DOCUMENT_TYPE.description,
        isActive: true,
      })
      .returning({ id: documentTypes.id });

    documentTypeId = created.id;
  }

  const existingWorkflow = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.documentTypeId, documentTypeId),
        eq(workflows.name, PRESENTATION_WORKFLOW_NAME),
      ),
    )
    .limit(1);

  let workflowId: string;

  await db
    .update(workflows)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(workflows.documentTypeId, documentTypeId));

  if (existingWorkflow.length > 0) {
    workflowId = existingWorkflow[0].id;
    await db
      .update(workflows)
      .set({
        description: workflow.description,
        status: "active",
        isDefault: true,
        nodes: workflow.nodes,
        edges: workflow.edges,
        schemaVersion: 1,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId));
  } else {
    const [created] = await db
      .insert(workflows)
      .values({
        documentTypeId,
        name: workflow.name,
        description: workflow.description,
        status: "active",
        isDefault: true,
        nodes: workflow.nodes,
        edges: workflow.edges,
        schemaVersion: 1,
      })
      .returning({ id: workflows.id });

    workflowId = created.id;
  }

  return {
    documentTypeId,
    workflowId,
    workflowName: workflow.name,
  };
}

export async function teardownPresentationWorkflow() {
  const existingDocType = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, PRESENTATION_DOCUMENT_TYPE.code))
    .limit(1);

  if (existingDocType.length === 0) {
    return { deletedWorkflows: 0, deletedDocumentType: false };
  }

  const documentTypeId = existingDocType[0].id;
  const deletedWorkflows = await db
    .delete(workflows)
    .where(eq(workflows.documentTypeId, documentTypeId))
    .returning({ id: workflows.id });

  await db.delete(documentTypes).where(eq(documentTypes.id, documentTypeId));

  return {
    deletedWorkflows: deletedWorkflows.length,
    deletedDocumentType: true,
  };
}

async function main() {
  if (process.argv.includes("--teardown")) {
    const result = await teardownPresentationWorkflow();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await seedPresentationWorkflow();
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
