import { describe, expect, it } from "vitest";
import { validateWorkflow } from "../modules/workflows/validation";
import type { DemoModelSelection } from "./demo-workflows/builders";
import {
  PRESENTATION_DOCUMENT_TYPE,
  PRESENTATION_WORKFLOW_NAME,
  buildPresentationWorkflowDefinition,
} from "./ppt-generation-workflow-definition";

const mockModels: DemoModelSelection = {
  desensitize: {
    id: "local-desensitize",
    displayName: "Local Desensitize",
    deploymentType: "local",
    providerType: "ollama",
    providerName: "Ollama",
  },
  primaryCloud: {
    id: "cloud-primary",
    displayName: "Cloud Primary",
    deploymentType: "cloud",
    providerType: "openai_compatible",
    providerName: "Primary",
  },
  secondaryCloud: {
    id: "cloud-secondary",
    displayName: "Cloud Secondary",
    deploymentType: "cloud",
    providerType: "openai_compatible",
    providerName: "Secondary",
  },
  compareClouds: [
    {
      id: "cloud-a",
      displayName: "Cloud A",
      deploymentType: "cloud",
      providerType: "openai_compatible",
      providerName: "Provider A",
    },
    {
      id: "cloud-b",
      displayName: "Cloud B",
      deploymentType: "cloud",
      providerType: "openai_compatible",
      providerName: "Provider B",
    },
    {
      id: "cloud-c",
      displayName: "Cloud C",
      deploymentType: "cloud",
      providerType: "claude_agent_sdk",
      providerName: "Provider C",
    },
    {
      id: "cloud-d",
      displayName: "Cloud D",
      deploymentType: "cloud",
      providerType: "opencode",
      providerName: "Provider D",
    },
  ],
};

describe("presentation workflow definition", () => {
  it("builds a valid PPT-only workflow with structured planning, dedup compression, page quality controls, and a governance-centered budget/fact gate", () => {
    const workflow = buildPresentationWorkflowDefinition(mockModels);

    expect(workflow.documentTypeCode).toBe(PRESENTATION_DOCUMENT_TYPE.code);
    expect(workflow.name).toBe(PRESENTATION_WORKFLOW_NAME);
    expect(validateWorkflow(workflow.nodes, workflow.edges)).toEqual([]);

    const desensitizeNode = workflow.nodes.find((node) => node.id === "node_desens");
    expect(desensitizeNode).toBeUndefined();

    const restoreNode = workflow.nodes.find((node) => node.id === "node_restore");
    expect(restoreNode).toBeUndefined();

    expect(
      workflow.nodes.filter((node) => node.type === "input_transform").map((node) => node.id),
    ).toEqual([
      "node_input",
      "node_strategy_feedback",
      "node_structure_feedback",
      "node_final_feedback",
    ]);

    expect(
      workflow.nodes.filter((node) => node.type === "model_call").map((node) => node.id),
    ).toEqual([
      "node_intake",
      "node_research",
      "node_strategy",
      "node_storyline",
      "node_outline",
      "node_layout",
      "node_visual",
      "node_draft",
      "node_polish",
      "node_dedup",
      "node_page_audit",
      "node_keypage",
      "node_governance",
    ]);

    for (const nodeId of [
      "node_strategy_feedback",
      "node_structure_feedback",
      "node_final_feedback",
    ]) {
      const node = workflow.nodes.find((item) => item.id === nodeId);
      expect(node?.config.type).toBe("input_transform");
      if (node?.config.type === "input_transform") {
        expect(node.config.skippable).toBe(true);
        expect(node.config.stepDescription).toBeTruthy();
        expect(node.config.skipStrategy?.bindings).toBeTruthy();
        expect(node.config.formFields).toHaveLength(1);
        expect(node.config.formFields[0]?.required).toBe(false);
      }
    }

    for (const nodeId of [
      "node_intake",
      "node_research",
      "node_strategy",
      "node_storyline",
      "node_outline",
      "node_layout",
      "node_visual",
      "node_draft",
      "node_polish",
      "node_dedup",
      "node_page_audit",
      "node_keypage",
      "node_governance",
    ]) {
      const node = workflow.nodes.find((item) => item.id === nodeId);
      expect(node?.config.type).toBe("model_call");
      if (node?.config.type === "model_call") {
        expect(node.config.modelIds).toHaveLength(
          ["node_strategy", "node_draft", "node_keypage"].includes(nodeId) ? 4 : 2,
        );
        expect(node.config.enableUserSelectionOutput).toBe(
          ["node_strategy", "node_draft", "node_keypage"].includes(nodeId),
        );
      }
    }

    const outlineNode = workflow.nodes.find((node) => node.id === "node_outline");
    expect(outlineNode?.config.type).toBe("model_call");
    if (outlineNode?.config.type === "model_call") {
      const slideOutline = outlineNode.config.namedOutputs?.find(
        (output) => output.id === "slide_outline",
      );
      expect(slideOutline?.format).toBe("json");
      expect(slideOutline?.jsonSchema).toBeTruthy();
    }

    const layoutNode = workflow.nodes.find((node) => node.id === "node_layout");
    expect(layoutNode?.config.type).toBe("model_call");
    if (layoutNode?.config.type === "model_call") {
      expect(layoutNode.outputs.some((output) => output.category === "selected_artifact")).toBe(
        false,
      );
      const pageBlueprints = layoutNode.config.namedOutputs?.find(
        (output) => output.id === "page_blueprints",
      );
      expect(pageBlueprints?.format).toBe("json");
      expect(pageBlueprints?.jsonSchema).toBeTruthy();
    }

    const visualNode = workflow.nodes.find((node) => node.id === "node_visual");
    expect(visualNode?.config.type).toBe("model_call");
    if (visualNode?.config.type === "model_call") {
      const assetPlan = visualNode.config.namedOutputs?.find(
        (output) => output.id === "asset_plan",
      );
      const chartSpecs = visualNode.config.namedOutputs?.find(
        (output) => output.id === "chart_specs",
      );
      expect(assetPlan?.format).toBe("json");
      expect(assetPlan?.jsonSchema).toBeTruthy();
      expect(chartSpecs?.format).toBe("json");
      expect(chartSpecs?.jsonSchema).toBeTruthy();
    }

    const pageAuditNode = workflow.nodes.find((node) => node.id === "node_page_audit");
    expect(pageAuditNode?.config.type).toBe("model_call");
    if (pageAuditNode?.config.type === "model_call") {
      const pageFindings = pageAuditNode.config.namedOutputs?.find(
        (output) => output.id === "page_findings",
      );
      const pageAuditGate = pageAuditNode.config.namedOutputs?.find(
        (output) => output.id === "page_audit_gate",
      );
      expect(pageFindings?.format).toBe("json");
      expect(pageFindings?.jsonSchema).toBeTruthy();
      expect(pageAuditGate?.format).toBe("json");
      expect(pageAuditGate?.jsonSchema).toBeTruthy();
    }

    const dedupNode = workflow.nodes.find((node) => node.id === "node_dedup");
    expect(dedupNode?.config.type).toBe("model_call");
    if (dedupNode?.config.type === "model_call") {
      const slidesCompact = dedupNode.config.namedOutputs?.find(
        (output) => output.id === "slides_compact",
      );
      const compressionNotes = dedupNode.config.namedOutputs?.find(
        (output) => output.id === "compression_notes",
      );
      expect(slidesCompact?.format).toBe("json");
      expect(slidesCompact?.jsonSchema).toBeTruthy();
      expect(compressionNotes?.format).toBe("json");
      expect(compressionNotes?.jsonSchema).toBeTruthy();
    }

    const keypageNode = workflow.nodes.find((node) => node.id === "node_keypage");
    expect(keypageNode?.config.type).toBe("model_call");
    if (keypageNode?.config.type === "model_call") {
      const slidesReady = keypageNode.config.namedOutputs?.find(
        (output) => output.id === "slides_ready",
      );
      const keyPageNotes = keypageNode.config.namedOutputs?.find(
        (output) => output.id === "key_page_notes",
      );
      expect(slidesReady?.format).toBe("json");
      expect(slidesReady?.jsonSchema).toBeTruthy();
      expect(keyPageNotes?.format).toBe("json");
      expect(keyPageNotes?.jsonSchema).toBeTruthy();
    }

    const governanceNode = workflow.nodes.find((node) => node.id === "node_governance");
    expect(governanceNode?.config.type).toBe("model_call");
    if (governanceNode?.config.type === "model_call") {
      expect(governanceNode.outputs.some((output) => output.category === "selected_artifact")).toBe(
        false,
      );
      const claimMap = governanceNode.config.namedOutputs?.find(
        (output) => output.id === "claim_map",
      );
      const budgetGate = governanceNode.config.namedOutputs?.find(
        (output) => output.id === "budget_gate",
      );
      expect(claimMap?.format).toBe("json");
      expect(claimMap?.jsonSchema).toBeTruthy();
      expect(budgetGate?.format).toBe("json");
      expect(budgetGate?.jsonSchema).toBeTruthy();
    }

    const exportNode = workflow.nodes.find((node) => node.id === "node_export");
    expect(exportNode?.config.type).toBe("export");
    if (exportNode?.config.type === "export") {
      expect(exportNode.config.stepDescription).toBeTruthy();
      expect(exportNode.config.formats).toEqual(["pptx"]);
      expect(exportNode.config.contentMapping).toEqual([
        {
          nodeId: "node_keypage",
          outputId: "slides_ready",
          variableName: "node_keypage.slides_ready",
        },
      ]);
      expect(exportNode.config.executionRule).toMatchObject({
        action: "block",
        conditions: [
          {
            sourceRef: {
              nodeId: "node_governance",
              outputId: "qa_gate",
              variableName: "node_governance.qa_gate.can_export",
              fieldPath: "can_export",
            },
            value: "false",
          },
        ],
      });
    }

    const strategyNode = workflow.nodes.find((node) => node.id === "node_strategy");
    expect(strategyNode?.outputs.some((output) => output.category === "selected_artifact")).toBe(
      true,
    );
  });
});
