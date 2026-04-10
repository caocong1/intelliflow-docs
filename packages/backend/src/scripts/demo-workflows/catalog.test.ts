import { describe, expect, it } from "vitest";
import { validateWorkflow } from "../../modules/workflows/validation";
import type { DemoModelSelection } from "./builders";
import { buildDemoCatalog } from "./catalog";

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

describe("PRD review demo workflow", () => {
  it("builds a valid workflow with four-model compare stages and a blocking export gate", () => {
    const workflow = buildDemoCatalog(mockModels).workflows.find(
      (item) => item.name === "产品经理 PRD 多模型评审流程",
    );

    expect(workflow).toBeDefined();
    if (!workflow) return;

    expect(validateWorkflow(workflow.nodes, workflow.edges)).toEqual([]);

    const v1Draft = workflow.nodes.find((node) => node.id === "node_prd_v1");
    expect(v1Draft?.config.type).toBe("model_call");
    if (v1Draft?.config.type === "model_call") {
      expect(v1Draft.config.modelIds).toHaveLength(4);
      expect(v1Draft.config.namedOutputs?.map((output) => output.id)).toEqual([
        "prd_v1",
        "open_items_v1",
        "decision_log_v1",
      ]);
    }

    const competitor = workflow.nodes.find((node) => node.id === "node_competitor");
    expect(competitor?.config.executionRule).toMatchObject({
      action: "skip",
      conditions: [{ sourceRef: { nodeId: "node_input", outputId: "competitor_material" } }],
    });

    const exportNode = workflow.nodes.find((node) => node.id === "node_export");
    expect(exportNode?.config.type).toBe("export");
    if (exportNode?.config.type === "export") {
      expect(exportNode.config.executionRule).toMatchObject({
        action: "block",
        conditions: [
          { sourceRef: { nodeId: "node_governance", outputId: "qa_gate" }, value: "false" },
        ],
      });
      expect(exportNode.config.contentMapping).toEqual([
        {
          nodeId: "node_restore",
          outputId: "node_final_prd.prd_final",
          variableName: "node_restore.node_final_prd.prd_final",
        },
        {
          nodeId: "node_restore",
          outputId: "node_final_prd.final_change_log",
          variableName: "node_restore.node_final_prd.final_change_log",
        },
        {
          nodeId: "node_restore",
          outputId: "node_final_prd.handoff_notes",
          variableName: "node_restore.node_final_prd.handoff_notes",
        },
        {
          nodeId: "node_restore",
          outputId: "node_governance.qa_report",
          variableName: "node_restore.node_governance.qa_report",
        },
      ]);
    }
  });
});
