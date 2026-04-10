import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { documentTypes, models, providers, workflows } from "../db/schema";
import { validateWorkflow } from "../modules/workflows/validation";
import type {
  AvailableModel,
  DemoDocumentTypeDefinition,
  DemoWorkflowDefinition,
} from "./demo-workflows/builders";
import { resolveDemoModels } from "./demo-workflows/builders";
import { buildDemoCatalog } from "./demo-workflows/catalog";

type UpsertedDocumentType = DemoDocumentTypeDefinition & { id: string };

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

function validateCatalog(workflowsToValidate: DemoWorkflowDefinition[]) {
  for (const workflow of workflowsToValidate) {
    const errors = validateWorkflow(workflow.nodes, workflow.edges).filter(
      (item) => item.severity === "error",
    );
    if (errors.length > 0) {
      const detail = errors
        .map((item) => `${item.nodeId ?? "workflow"}: ${item.message}`)
        .join("\n");
      throw new Error(`工作流「${workflow.name}」验证失败：\n${detail}`);
    }
  }
}

async function upsertDocumentTypes(
  definitions: DemoDocumentTypeDefinition[],
): Promise<Map<string, UpsertedDocumentType>> {
  const result = new Map<string, UpsertedDocumentType>();

  for (const definition of definitions) {
    const existing = await db
      .select({ id: documentTypes.id })
      .from(documentTypes)
      .where(eq(documentTypes.code, definition.code))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(documentTypes)
        .set({
          name: definition.name,
          description: definition.description,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(documentTypes.id, existing[0].id))
        .returning({
          id: documentTypes.id,
          code: documentTypes.code,
          name: documentTypes.name,
          description: documentTypes.description,
        });

      result.set(definition.code, {
        code: updated.code,
        name: updated.name,
        description: updated.description ?? definition.description,
        id: updated.id,
      });
      continue;
    }

    const [created] = await db
      .insert(documentTypes)
      .values({
        code: definition.code,
        name: definition.name,
        description: definition.description,
        isActive: true,
      })
      .returning({
        id: documentTypes.id,
        code: documentTypes.code,
        name: documentTypes.name,
        description: documentTypes.description,
      });

    result.set(definition.code, {
      code: created.code,
      name: created.name,
      description: created.description ?? definition.description,
      id: created.id,
    });
  }

  return result;
}

async function upsertWorkflows(
  workflowDefinitions: DemoWorkflowDefinition[],
  documentTypeMap: Map<string, UpsertedDocumentType>,
): Promise<Map<string, string>> {
  const workflowIdMap = new Map<string, string>();

  for (const definition of workflowDefinitions) {
    const documentType = documentTypeMap.get(definition.documentTypeCode);
    if (!documentType) {
      throw new Error(`未找到文档类型：${definition.documentTypeCode}`);
    }

    const existing = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(eq(workflows.documentTypeId, documentType.id), eq(workflows.name, definition.name)),
      )
      .limit(1);

    let workflowId: string;

    if (existing.length > 0) {
      const [updated] = await db
        .update(workflows)
        .set({
          description: definition.description,
          status: "active",
          nodes: definition.nodes,
          edges: definition.edges,
          schemaVersion: 1,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, existing[0].id))
        .returning({ id: workflows.id });
      workflowId = updated.id;
    } else {
      const [created] = await db
        .insert(workflows)
        .values({
          documentTypeId: documentType.id,
          name: definition.name,
          description: definition.description,
          status: "active",
          isDefault: false,
          nodes: definition.nodes,
          edges: definition.edges,
          schemaVersion: 1,
        })
        .returning({ id: workflows.id });
      workflowId = created.id;
    }

    workflowIdMap.set(`${definition.documentTypeCode}:${definition.name}`, workflowId);
  }

  return workflowIdMap;
}

async function enforceDefaultWorkflows(
  workflowDefinitions: DemoWorkflowDefinition[],
  documentTypeMap: Map<string, UpsertedDocumentType>,
  workflowIdMap: Map<string, string>,
) {
  const defaults = workflowDefinitions.filter((workflow) => workflow.isDefault);

  for (const definition of defaults) {
    const documentType = documentTypeMap.get(definition.documentTypeCode);
    const workflowId = workflowIdMap.get(`${definition.documentTypeCode}:${definition.name}`);
    if (!documentType || !workflowId) continue;

    await db
      .update(workflows)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(workflows.documentTypeId, documentType.id));

    await db
      .update(workflows)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(workflows.id, workflowId));
  }
}

function logSelectedModels(modelsSelection: ReturnType<typeof resolveDemoModels>) {
  console.log("Selected models:");
  console.log(
    `  Desensitize(local): ${modelsSelection.desensitize.displayName} / ${modelsSelection.desensitize.providerName}`,
  );
  console.log(
    `  Primary cloud: ${modelsSelection.primaryCloud.displayName} / ${modelsSelection.primaryCloud.providerName}`,
  );
  console.log(
    `  Secondary cloud: ${modelsSelection.secondaryCloud.displayName} / ${modelsSelection.secondaryCloud.providerName}`,
  );
  console.log(
    `  Review cloud pool: ${modelsSelection.compareClouds
      .map((model) => model.displayName)
      .join(", ")}`,
  );
}

async function seed() {
  console.log("Loading active models...");
  const availableModels = await loadAvailableModels();
  const selectedModels = resolveDemoModels(availableModels);
  logSelectedModels(selectedModels);

  const catalog = buildDemoCatalog(selectedModels);
  validateCatalog(catalog.workflows);

  console.log(`Upserting ${catalog.documentTypes.length} document types...`);
  const documentTypeMap = await upsertDocumentTypes(catalog.documentTypes);

  console.log(`Upserting ${catalog.workflows.length} demo workflows...`);
  const workflowIdMap = await upsertWorkflows(catalog.workflows, documentTypeMap);
  await enforceDefaultWorkflows(catalog.workflows, documentTypeMap, workflowIdMap);

  console.log("\nDemo workflow seed completed.");
  console.log(`  Document types processed: ${documentTypeMap.size}`);
  console.log(`  Workflows processed: ${catalog.workflows.length}`);
  console.log(
    `  Flagship workflows: ${catalog.workflows.filter((workflow) => workflow.category === "flagship").length}`,
  );
  console.log(
    `  Medium workflows: ${catalog.workflows.filter((workflow) => workflow.category === "medium").length}`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
