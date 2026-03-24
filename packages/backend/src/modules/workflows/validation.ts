import type { WorkflowEdgeDef, WorkflowNodeDef, WorkflowValidationError } from "@intelliflow/shared";

/**
 * Validate a workflow graph.
 * Returns a (possibly empty) list of structured validation errors.
 */
export function validateWorkflow(
  nodes: WorkflowNodeDef[],
  edges: WorkflowEdgeDef[],
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  if (nodes.length === 0) {
    errors.push({ message: "工作流不能为空", severity: "error" });
    return errors;
  }

  // ── Rule 1: Must have at least one input_transform node ───────────────────
  const hasInputTransform = nodes.some((n) => n.type === "input_transform");
  if (!hasInputTransform) {
    errors.push({
      message: "工作流必须包含至少一个【输入转换】节点",
      severity: "error",
    });
  }

  // ── Rule 2: Must have at least one export node ────────────────────────────
  const hasExport = nodes.some((n) => n.type === "export");
  if (!hasExport) {
    errors.push({
      message: "工作流必须包含至少一个【文件导出】节点",
      severity: "error",
    });
  }

  // ── Rule 3: Orphan nodes (every node must be connected, except single node) ─
  if (nodes.length > 1) {
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    for (const node of nodes) {
      if (!connectedNodeIds.has(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `节点 "${node.label}" 未连接到任何其他节点`,
          severity: "error",
        });
      }
    }
  }

  // ── Rule 4: No cycles (topological sort via Kahn's algorithm) ─────────────
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      adjacency.get(edge.source)?.push(edge.target);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (visited < nodes.length) {
    errors.push({
      message: "工作流存在循环依赖，请检查节点连接",
      severity: "error",
    });
  }

  // ── Rule 9: Max 1 desensitize node per workflow ────────────────────────────
  const desensitizeNodeCount = nodes.filter((n) => n.type === "desensitize").length;
  if (desensitizeNodeCount > 1) {
    errors.push({
      message: "工作流最多只能包含一个【信息脱敏】节点",
      severity: "error",
    });
  }

  // ── Rule 5: desensitize/restore pairing ────────────────────────────────────
  // Build reachability map (BFS/DFS downstream from each node)
  function getDownstreamIds(startId: string): Set<string> {
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const edge of edges) {
        if (edge.source === current && !visited.has(edge.target)) {
          visited.add(edge.target);
          stack.push(edge.target);
        }
      }
    }
    return visited;
  }

  const desensitizeNodes = nodes.filter((n) => n.type === "desensitize");
  const restoreNodes = nodes.filter((n) => n.type === "restore");
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Every desensitize node must have a restore node reachable downstream
  for (const dNode of desensitizeNodes) {
    const downstream = getDownstreamIds(dNode.id);
    const hasDownstreamRestore = restoreNodes.some((r) => downstream.has(r.id));
    if (!hasDownstreamRestore) {
      errors.push({
        nodeId: dNode.id,
        message: `【信息脱敏】节点 "${dNode.label}" 下游缺少对应的【信息恢复】节点`,
        severity: "error",
      });
    }
  }

  // Every restore node must have pairedDesensitizeNodeId set and pointing to existing desensitize node
  for (const rNode of restoreNodes) {
    if (rNode.config.type !== "restore") continue;
    const pairedId = rNode.config.pairedDesensitizeNodeId;
    if (!pairedId) {
      errors.push({
        nodeId: rNode.id,
        field: "pairedDesensitizeNodeId",
        message: `【信息恢复】节点 "${rNode.label}" 未配置对应的脱敏节点`,
        severity: "error",
      });
    } else {
      const pairedNode = nodeMap.get(pairedId);
      if (!pairedNode || pairedNode.type !== "desensitize") {
        errors.push({
          nodeId: rNode.id,
          field: "pairedDesensitizeNodeId",
          message: `【信息恢复】节点 "${rNode.label}" 引用的脱敏节点不存在`,
          severity: "error",
        });
      }
    }
  }

  // ── Rule 6: Required fields per node type ─────────────────────────────────
  for (const node of nodes) {
    if (node.config.type === "input_transform") {
      const fields = node.config.formFields;
      if (!fields || fields.length === 0) {
        errors.push({
          nodeId: node.id,
          field: "formFields",
          message: `【输入转换】节点 "${node.label}" 至少需要一个表单字段`,
          severity: "error",
        });
      } else {
        const hasValidField = fields.some(
          (f: { label?: string }) => f.label && f.label.trim() !== "",
        );
        if (!hasValidField) {
          errors.push({
            nodeId: node.id,
            field: "formFields",
            message: `【输入转换】节点 "${node.label}" 的表单字段标签不能为空`,
            severity: "error",
          });
        }
      }
    }

    if (node.config.type === "desensitize") {
      const categories = node.config.categories;
      if (!categories || categories.length === 0) {
        errors.push({
          nodeId: node.id,
          field: "categories",
          message: `【信息脱敏】节点 "${node.label}" 至少需要一个脱敏类别`,
          severity: "error",
        });
      } else {
        const hasValidCategory = categories.some(
          (c: { name?: string }) => c.name && c.name.trim() !== "",
        );
        if (!hasValidCategory) {
          errors.push({
            nodeId: node.id,
            field: "categories",
            message: `【信息脱敏】节点 "${node.label}" 的脱敏类别名称不能为空`,
            severity: "error",
          });
        }
      }
      if (!node.config.localModelId) {
        errors.push({
          nodeId: node.id,
          field: "localModelId",
          message: `【信息脱敏】节点 "${node.label}" 未选择本地模型`,
          severity: "error",
        });
      }
    }

    if (node.config.type === "model_call") {
      if (!node.config.promptTemplate || node.config.promptTemplate.trim() === "") {
        errors.push({
          nodeId: node.id,
          field: "promptTemplate",
          message: `【模型调用】节点 "${node.label}" 的提示词模板不能为空`,
          severity: "error",
        });
      }
      if ((!node.config.modelIds || node.config.modelIds.length === 0) && !node.config.modelId) {
        errors.push({
          nodeId: node.id,
          field: "modelIds",
          message: `【模型调用】节点 "${node.label}" 未选择任何模型`,
          severity: "warning",
        });
      }
    }

    if (node.config.type === "export") {
      if (!node.config.formats || node.config.formats.length === 0) {
        errors.push({
          nodeId: node.id,
          field: "formats",
          message: `【文件导出】节点 "${node.label}" 未指定导出格式`,
          severity: "error",
        });
      }
    }
  }

  // ── Rule 7: Broken variable references (nodeId or outputId no longer exists) ─
  const outputIdSet = new Set<string>();
  for (const n of nodes) {
    for (const o of n.outputs) {
      outputIdSet.add(`${n.id}.${o.id}`);
    }
  }

  for (const node of nodes) {
    if (node.config.type === "model_call") {
      const template = node.config.promptTemplate ?? "";
      const regex = /\{\{([^}]+)\}\}/g;
      let m: RegExpExecArray | null;
      m = regex.exec(template);
      while (m !== null) {
        const varKey = m[1].trim();
        // Skip system variables
        if (!varKey.includes(".")) { m = regex.exec(template); continue; }
        const dotIdx = varKey.indexOf(".");
        const refNodeId = varKey.slice(0, dotIdx);
        const refNode = nodeMap.get(refNodeId);
        if (!refNode) {
          errors.push({
            nodeId: node.id,
            field: "promptTemplate",
            message: `【模型调用】节点 "${node.label}" 的提示词引用了已删除的节点`,
            severity: "error",
          });
        } else if (!outputIdSet.has(varKey)) {
          errors.push({
            nodeId: node.id,
            field: "promptTemplate",
            message: `【模型调用】节点 "${node.label}" 的提示词引用了节点 "${refNode.label}" 中不存在的输出`,
            severity: "error",
          });
        }
        m = regex.exec(template);
      }
    }

    if (node.config.type === "export") {
      for (const ref of node.config.contentMapping ?? []) {
        const refNode = nodeMap.get(ref.nodeId);
        if (!refNode) {
          errors.push({
            nodeId: node.id,
            field: "contentMapping",
            message: `【文件导出】节点 "${node.label}" 引用了已删除的节点`,
            severity: "error",
          });
        } else if (!outputIdSet.has(`${ref.nodeId}.${ref.outputId}`)) {
          errors.push({
            nodeId: node.id,
            field: "contentMapping",
            message: `【文件导出】节点 "${node.label}" 引用了节点 "${refNode.label}" 中不存在的输出`,
            severity: "error",
          });
        }
      }
    }
  }

  // ── Rule 8: Linear flow constraint (max 1 input + 1 output per node) ────
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
  }
  for (const node of nodes) {
    const incoming = incomingCount.get(node.id) ?? 0;
    if (incoming > 1) {
      errors.push({
        nodeId: node.id,
        message: `节点 "${node.label}" 有多条输入连接，流程必须为线性`,
        severity: "error",
      });
    }
    const outgoing = outgoingCount.get(node.id) ?? 0;
    if (outgoing > 1) {
      errors.push({
        nodeId: node.id,
        message: `节点 "${node.label}" 有多条输出连接，流程必须为线性`,
        severity: "error",
      });
    }
  }

  // ── Rule 10: Validate inputSources on desensitize/restore nodes ────────────
  // Build upstream reachability for each node via BFS
  function getUpstreamIds(startId: string): Set<string> {
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) break;
      for (const edge of edges) {
        if (edge.target === current && !visited.has(edge.source)) {
          visited.add(edge.source);
          stack.push(edge.source);
        }
      }
    }
    return visited;
  }

  for (const node of nodes) {
    if (node.config.type !== "desensitize" && node.config.type !== "restore") continue;
    const inputSources = node.config.inputSources;
    if (!inputSources || inputSources.length === 0) continue;

    const upstreamIds = getUpstreamIds(node.id);

    for (const src of inputSources) {
      const srcNode = nodeMap.get(src.sourceNodeId);
      if (!srcNode) {
        errors.push({
          nodeId: node.id,
          field: "inputSources",
          message: `节点 "${node.label}" 的输入来源引用了不存在的节点`,
          severity: "error",
        });
        continue;
      }

      if (!upstreamIds.has(src.sourceNodeId)) {
        errors.push({
          nodeId: node.id,
          field: "inputSources",
          message: `节点 "${node.label}" 的输入来源 "${src.displayName}" 不在上游路径中`,
          severity: "error",
        });
        continue;
      }

      const srcOutputExists = srcNode.outputs.some((o) => o.id === src.outputId);
      if (!srcOutputExists) {
        errors.push({
          nodeId: node.id,
          field: "inputSources",
          message: `节点 "${node.label}" 的输入来源 "${src.displayName}" 引用了不存在的输出`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}
