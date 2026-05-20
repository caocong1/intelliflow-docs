import type {
  NodeExecutionRule,
  WorkflowEdgeDef,
  WorkflowNodeDef,
  WorkflowValidationError,
} from "@intelliflow/shared";
import { getConfigurableSkipOutputs, getSkipBinding } from "./skip-strategy";

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

  // ── Rule 2: Must have at least one terminal generation node ───────────────
  const hasTerminalGenerationNode = nodes.some((n) => n.type === "export" || n.type === "ppt");
  if (!hasTerminalGenerationNode) {
    errors.push({
      message: "工作流必须包含至少一个【文件导出】或【PPT 生成】节点",
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
    if (node.type !== "export" && node.config.skippable) {
      const skipTargets = getConfigurableSkipOutputs(node.id, node.config);
      for (const output of skipTargets) {
        const outputId = output.segmentKey ?? output.id;
        const binding = getSkipBinding(node.config, outputId);
        if (!binding) {
          errors.push({
            nodeId: node.id,
            field: "skipStrategy",
            message: `【${node.label}】可跳过，但输出 "${output.name}" 未配置跳过映射`,
            severity: "error",
          });
          continue;
        }
        if (binding.mode === "inherit" && !binding.sourceRef?.nodeId) {
          errors.push({
            nodeId: node.id,
            field: "skipStrategy",
            message: `【${node.label}】输出 "${output.name}" 选择了继承上游，但未指定来源`,
            severity: "error",
          });
        } else if (binding.mode === "inherit" && binding.sourceRef) {
          const sourceNode = nodeMap.get(binding.sourceRef.nodeId);
          if (!sourceNode) {
            errors.push({
              nodeId: node.id,
              field: "skipStrategy",
              message: `【${node.label}】输出 "${output.name}" 的跳过来源节点不存在`,
              severity: "error",
            });
          } else if (
            binding.sourceRef.nodeId === node.id ||
            !getDownstreamIds(binding.sourceRef.nodeId).has(node.id)
          ) {
            errors.push({
              nodeId: node.id,
              field: "skipStrategy",
              message: `【${node.label}】输出 "${output.name}" 的跳过来源必须来自上游节点`,
              severity: "error",
            });
          }
        }
      }

      if (!node.config.stepDescription || node.config.stepDescription.trim() === "") {
        errors.push({
          nodeId: node.id,
          field: "stepDescription",
          message: `【${node.label}】可跳过，建议补充步骤说明，帮助运行时用户理解该节点用途`,
          severity: "warning",
        });
      }
    }

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

      // Validate machineKey format, uniqueness, and select/multiselect options
      const MACHINE_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      const seenMachineKeys = new Set<string>();

      for (const field of fields) {
        // machineKey format validation
        if (field.machineKey) {
          if (!MACHINE_KEY_REGEX.test(field.machineKey)) {
            errors.push({
              nodeId: node.id,
              field: "formFields",
              message: `字段 "${field.label}" 的 machineKey "${field.machineKey}" 格式不合法，只允许英文字母、数字和下划线，且不能以数字开头`,
              severity: "error",
            });
          }
          // machineKey uniqueness
          if (seenMachineKeys.has(field.machineKey)) {
            errors.push({
              nodeId: node.id,
              field: "formFields",
              message: `字段 "${field.label}" 的 machineKey "${field.machineKey}" 与其他字段重复`,
              severity: "error",
            });
          }
          seenMachineKeys.add(field.machineKey);
        }

        // select/multiselect options validation
        if (field.type === "select" || field.type === "multiselect") {
          if (!field.options || field.options.length === 0) {
            errors.push({
              nodeId: node.id,
              field: "formFields",
              message: `字段 "${field.label}" 需要至少一个选项`,
              severity: "error",
            });
          } else {
            // No commas in option text
            for (const opt of field.options) {
              if (opt.includes(",")) {
                errors.push({
                  nodeId: node.id,
                  field: "formFields",
                  message: `字段 "${field.label}" 的选项不能包含逗号`,
                  severity: "error",
                });
                break;
              }
            }

            // Default value must be in options
            if (field.type === "select" && field.defaultValue) {
              if (!field.options.includes(field.defaultValue)) {
                errors.push({
                  nodeId: node.id,
                  field: "formFields",
                  message: `字段 "${field.label}" 的默认值不在选项列表中`,
                  severity: "error",
                });
              }
            }
            if (field.type === "multiselect" && field.defaultValues) {
              for (const dv of field.defaultValues) {
                if (!field.options.includes(dv)) {
                  errors.push({
                    nodeId: node.id,
                    field: "formFields",
                    message: `字段 "${field.label}" 的默认值不在选项列表中`,
                    severity: "error",
                  });
                  break;
                }
              }
            }
          }
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

      // Validate namedOutputs
      const NAMED_OUTPUT_ID_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (node.config.namedOutputs && node.config.namedOutputs.length > 0) {
        const seenNamedIds = new Set<string>();
        for (const no of node.config.namedOutputs) {
          if (!NAMED_OUTPUT_ID_REGEX.test(no.id)) {
            errors.push({
              nodeId: node.id,
              field: "namedOutputs",
              message: `【模型调用】节点 "${node.label}" 的命名产物 ID "${no.id}" 格式不合法，只允许英文字母、数字和下划线，且不能以数字开头`,
              severity: "error",
            });
          }
          if (seenNamedIds.has(no.id)) {
            errors.push({
              nodeId: node.id,
              field: "namedOutputs",
              message: `【模型调用】节点 "${node.label}" 的命名产物 ID "${no.id}" 重复`,
              severity: "error",
            });
          }
          seenNamedIds.add(no.id);
        }
      }

      // Validate jsonSchema when outputFormat is json
      if (node.config.outputFormat === "json" && node.config.jsonSchema !== undefined) {
        if (
          node.config.jsonSchema === null ||
          typeof node.config.jsonSchema !== "object" ||
          Array.isArray(node.config.jsonSchema)
        ) {
          errors.push({
            nodeId: node.id,
            field: "jsonSchema",
            message: `【模型调用】节点 "${node.label}" 的 JSON Schema 必须是一个有效的对象`,
            severity: "error",
          });
        }
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

    if (node.config.type === "ppt") {
      if (!node.config.contentMapping || node.config.contentMapping.length === 0) {
        errors.push({
          nodeId: node.id,
          field: "contentMapping",
          message: `【PPT 生成】节点 "${node.label}" 未指定 PPT 内容来源`,
          severity: "warning",
        });
      }
    }
  }

  // ── Rule 11: segmentKey cross-type uniqueness within a node ─────────────────
  for (const node of nodes) {
    const segmentKeys = new Map<string, string>();
    for (const o of node.outputs) {
      const sk = o.segmentKey || o.id;
      if (segmentKeys.has(sk)) {
        errors.push({
          nodeId: node.id,
          message: `节点 "${node.label}" 中存在重复的标识符 "${sk}"`,
          severity: "error",
        });
      } else {
        segmentKeys.set(sk, o.id);
      }
    }

    // Also check namedOutputs IDs against existing segmentKeys
    // Skip outputs derived from namedOutputs themselves (id contains "-namedoutput-")
    if (node.config.type === "model_call" && node.config.namedOutputs) {
      for (const no of node.config.namedOutputs) {
        const existingId = segmentKeys.get(no.id);
        if (existingId && !existingId.includes("-namedoutput-")) {
          errors.push({
            nodeId: node.id,
            message: `节点 "${node.label}" 中命名产物 "${no.id}" 与已有标识符冲突`,
            severity: "error",
          });
        }
      }
    }
  }

  // ── Rule 7: Broken variable references (nodeId or outputId no longer exists) ─
  const outputIdSet = new Set<string>();
  for (const n of nodes) {
    for (const o of n.outputs) {
      outputIdSet.add(`${n.id}.${o.segmentKey || o.id}`);
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
        if (!varKey.includes(".")) {
          m = regex.exec(template);
          continue;
        }
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

    if (node.config.type === "export" || node.config.type === "ppt") {
      for (const ref of node.config.contentMapping ?? []) {
        const refNode = nodeMap.get(ref.nodeId);
        if (!refNode) {
          errors.push({
            nodeId: node.id,
            field: "contentMapping",
            message: `【${node.config.type === "ppt" ? "PPT 生成" : "文件导出"}】节点 "${node.label}" 引用了已删除的节点`,
            severity: "error",
          });
        } else if (!outputIdSet.has(`${ref.nodeId}.${ref.outputId}`)) {
          errors.push({
            nodeId: node.id,
            field: "contentMapping",
            message: `【${node.config.type === "ppt" ? "PPT 生成" : "文件导出"}】节点 "${node.label}" 引用了节点 "${refNode.label}" 中不存在的输出`,
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

      const srcOutputExists = srcNode.outputs.some(
        (o) => o.id === src.outputId || o.segmentKey === src.outputId,
      );
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

  // ── Rule 12: Validate executionRule on each node ──────────────────────────────
  // Build upstream reachability for condition sourceRef validation
  function getUpstreamIdsForCondition(startId: string): Set<string> {
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
    const config = node.config as { executionRule?: NodeExecutionRule };
    const rule = config.executionRule;
    if (!rule) continue;

    // action must be "skip" or "block"
    if (rule.action !== "skip" && rule.action !== "block") {
      errors.push({
        nodeId: node.id,
        field: "executionRule.action",
        message: `节点 "${node.label}" 的执行条件动作必须是 "skip" 或 "block"`,
        severity: "error",
      });
    }

    // logic must be "and" or "or"
    if (rule.logic !== "and" && rule.logic !== "or") {
      errors.push({
        nodeId: node.id,
        field: "executionRule.logic",
        message: `节点 "${node.label}" 的执行条件逻辑必须是 "and" 或 "or"`,
        severity: "error",
      });
    }

    // conditions must be non-empty array
    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push({
        nodeId: node.id,
        field: "executionRule.conditions",
        message: `节点 "${node.label}" 的执行条件至少需要一个条件`,
        severity: "error",
      });
    } else {
      // Validate each condition
      const upstreamIds = getUpstreamIdsForCondition(node.id);

      for (const cond of rule.conditions) {
        // sourceRef.nodeId must exist in workflow nodes
        const sourceNode = nodeMap.get(cond.sourceRef.nodeId);
        if (!sourceNode) {
          errors.push({
            nodeId: node.id,
            field: "executionRule.conditions",
            message: `节点 "${node.label}" 的执行条件引用了不存在的上游节点`,
            severity: "error",
          });
        } else {
          // sourceRef.nodeId must be upstream of the current node
          if (!upstreamIds.has(cond.sourceRef.nodeId)) {
            errors.push({
              nodeId: node.id,
              field: "executionRule.conditions",
              message: `节点 "${node.label}" 的执行条件引用了不在上游路径的节点 "${sourceNode.label}"`,
              severity: "error",
            });
          }
        }

        // When operator is equals/not_equals/contains, value must be non-empty
        if (
          (cond.operator === "equals" ||
            cond.operator === "not_equals" ||
            cond.operator === "contains") &&
          !cond.value
        ) {
          errors.push({
            nodeId: node.id,
            field: "executionRule.conditions",
            message: `节点 "${node.label}" 的执行条件使用了 "${cond.operator}" 运算符但未提供比较值`,
            severity: "error",
          });
        }

        // When operator is exists/not_exists, value should be absent or empty (warn but don't block)
        if ((cond.operator === "exists" || cond.operator === "not_exists") && cond.value) {
          errors.push({
            nodeId: node.id,
            field: "executionRule.conditions",
            message: `节点 "${node.label}" 的执行条件使用了 "${cond.operator}" 运算符但提供了值（将被忽略）`,
            severity: "warning",
          });
        }
      }
    }
  }

  return errors;
}
