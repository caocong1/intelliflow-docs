# Claude Agent SDK 集成方案 — 可行性分析与实施计划

> 编写日期：2026-03-21
> 状态：待评审
> 关联需求：v4-current.md 模块五（AI 模型配置）、模块四（流程编排配置 — 模型调用引擎）

---

## 一、背景与目标

### 1.1 现状分析

IntelliFlow 当前的模型调用架构支持两种 Provider 类型：

| Provider 类型 | 实现状态 | 调用协议 | 认证方式 |
|---|---|---|---|
| `openai_compatible` | ✅ 已实现 | OpenAI Chat Completions API (`/chat/completions`) | Bearer Token |
| `opencode` | ⚠️ 仅连通性测试 | OpenCode Serve (`/global/health`) | Basic Auth |

**当前实际执行层**（`model-call.service.ts`）只实现了 `openai_compatible` 一种调用方式——所有模型调用统一走 `POST {baseUrl}/chat/completions`，使用 OpenAI 兼容的请求/响应格式和 SSE 流式输出。

### 1.2 目标

新增第三种 Provider 类型 `claude_agent_sdk`，通过 Anthropic 官方的 **Claude Agent SDK**（`@anthropic-ai/claude-agent-sdk`）进行模型调用。同时支持通过**火山方舟 Coding Plan** 提供的 Anthropic 兼容端点作为底层 API 接入点，降低直接使用 Anthropic API 的成本。

---

## 二、技术可行性分析

### 2.1 Claude Agent SDK 是什么

Claude Agent SDK（原 Claude Code SDK）是 Anthropic 官方发布的 AI Agent 框架，提供 TypeScript 和 Python 两种 SDK。核心特点：

- **自主 Agent 循环**：Claude 自主调用内置工具（Read、Write、Edit、Bash、Glob、Grep、WebSearch 等），无需手动实现 tool loop
- **流式消息输出**：`query()` 函数返回 `AsyncGenerator<SDKMessage>`，天然支持流式
- **子 Agent**：支持定义和调用子 Agent（subagents）处理专项子任务
- **MCP 协议**：支持接入 MCP Server 扩展外部能力
- **Session 管理**：支持会话持久化、恢复、分叉
- **Hooks**：在 Agent 生命周期关键节点执行自定义逻辑

### 2.2 核心 API

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// 基本用法 — 流式输出
for await (const message of query({
  prompt: "你的提示词",
  options: {
    allowedTools: ["Read", "Write", "Bash"],  // 允许的内置工具
    model: "claude-sonnet-4-6",                // 可指定模型
    cwd: "/data/generations/...",              // 工作目录
    env: {                                      // 环境变量
      ANTHROPIC_API_KEY: "your-api-key",
      ANTHROPIC_BASE_URL: "https://ark.cn-beijing.volces.com/api/coding"
    },
    permissionMode: "bypassPermissions",       // 自动化场景跳过权限确认
    allowDangerouslySkipPermissions: true,
    maxTurns: 10,                              // 最大交互轮数
    maxBudgetUsd: 1.0,                         // 预算上限
  }
})) {
  // 处理流式消息
  if (message.type === "assistant" && message.subtype === "text") {
    console.log(message.content); // 文本输出
  }
  if ("result" in message) {
    console.log(message.result);  // 最终结果
  }
}
```

### 2.3 与火山方舟 Coding Plan 的兼容性

火山方舟 Coding Plan 提供两个兼容端点：

| 协议 | Base URL | 适用场景 |
|---|---|---|
| Anthropic 兼容 | `https://ark.cn-beijing.volces.com/api/coding` | Claude Agent SDK / Claude Code |
| OpenAI 兼容 | `https://ark.cn-beijing.volces.com/api/coding/v3` | 已有的 `openai_compatible` Provider |

**关键结论**：Claude Agent SDK 底层通过 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_API_KEY`（或 `ANTHROPIC_AUTH_TOKEN`）环境变量指定 API 端点。火山方舟的 Anthropic 兼容端点完全可以作为 Agent SDK 的后端使用。

验证方式（配置到 Agent SDK 的 `env` 选项中）：
```typescript
env: {
  ANTHROPIC_AUTH_TOKEN: "<ARK_API_KEY>",
  ANTHROPIC_BASE_URL: "https://ark.cn-beijing.volces.com/api/coding",
  ANTHROPIC_MODEL: "doubao-seed-2.0-code"  // 或其他支持的模型
}
```

### 2.4 可行性结论

| 维度 | 评估 | 说明 |
|---|---|---|
| SDK 成熟度 | ✅ 可行 | Anthropic 官方维护，TypeScript 原生支持，与项目 Bun 运行时兼容 |
| 火山方舟兼容性 | ✅ 可行 | 提供 Anthropic 兼容端点，已被 Claude Code CLI 验证可用 |
| 流式输出 | ✅ 可行 | Agent SDK 原生流式 `AsyncGenerator`，可转换为现有 SSE 格式 |
| 文件系统操作 | ✅ 高度契合 | Agent SDK 内置 Read/Write/Edit 工具，天然适配 v4 的"文件系统驱动"架构 |
| 工作目录隔离 | ✅ 可行 | 通过 `cwd` 选项指定工作目录，Agent 只在指定目录下操作 |
| 权限控制 | ✅ 可行 | 通过 `allowedTools` + `disallowedTools` 精确控制 Agent 能力边界 |
| 成本控制 | ✅ 可行 | `maxBudgetUsd` + `maxTurns` 双重限制 |
| 与现有架构兼容 | ⚠️ 需适配 | 需要新增 Provider 类型、适配 SSE 消息格式、处理 Agent 异步特性 |

**总结：技术可行，且与 v4 需求文档中"CLI 命令行调用"的设计理念高度一致。Agent SDK 方式可视为 CLI 调用的"SDK 化"升级——从 `Bun.spawnSync("claude -p ...")` 进化为 `query({ prompt: ... })`。**

---

## 三、架构设计

### 3.1 三种调用方式对比

```
┌─────────────────────────────────────────────────────────────────┐
│                    统一模型调用抽象层                               │
│              model-call.service.ts                               │
├──────────────┬────────────────────┬─────────────────────────────┤
│  openai_compatible  │     opencode        │   claude_agent_sdk       │
│  (API 直接调用)      │  (OpenCode Serve)   │   (Agent SDK 调用)        │
│                     │                     │                          │
│  POST /chat/        │  POST /chat/        │  query({ prompt, opts }) │
│  completions        │  completions        │                          │
│  Bearer Token       │  Basic Auth         │  ANTHROPIC_AUTH_TOKEN    │
│  SSE 流式            │  SSE 流式            │  AsyncGenerator 流式      │
│                     │                     │                          │
│  适用：通用 OpenAI    │  适用：OpenCode      │  适用：Claude 系列模型      │
│  兼容模型             │  自建服务             │  + 火山方舟 Coding Plan    │
└──────────────┴────────────────────┴─────────────────────────────┘
```

### 3.2 Agent SDK 调用的两种模式

根据 IntelliFlow 的业务场景，Agent SDK 调用支持两种运行模式：

#### 模式 A：简单对话模式（Simple Chat）

仅使用 Agent SDK 的对话能力，不启用内置工具。行为类似 `openai_compatible`，但走 Anthropic 协议：

```typescript
for await (const message of query({
  prompt: resolvedPrompt,
  options: {
    allowedTools: [],  // 不启用任何工具
    model: model.modelId,
    env: { ANTHROPIC_AUTH_TOKEN: provider.apiKey, ANTHROPIC_BASE_URL: provider.baseUrl },
    maxTurns: 1,
  }
})) { /* 收集文本输出 */ }
```

**适用场景**：纯文本生成、质检、合规检查等不需要文件操作的节点。

#### 模式 B：Agent 自主模式（Autonomous Agent）

启用内置工具，让 Agent 自主读写工作目录中的文件。这是 Agent SDK 的核心价值所在：

```typescript
for await (const message of query({
  prompt: `请阅读 ${inputDir} 下的文件，根据以下要求生成报告，并将结果写入 ${outputFile}。\n\n${taskDescription}`,
  options: {
    allowedTools: ["Read", "Write", "Glob", "Grep"],  // 精确控制工具
    disallowedTools: ["Bash", "Edit"],                  // 禁止危险操作
    cwd: workspaceDir,                                  // 限定工作目录
    model: model.modelId,
    env: { ANTHROPIC_AUTH_TOKEN: provider.apiKey, ANTHROPIC_BASE_URL: provider.baseUrl },
    maxTurns: 15,
    maxBudgetUsd: 2.0,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
  }
})) { /* 监控 Agent 执行过程，转发 SSE */ }
```

**适用场景**：复杂文档生成、多文件交叉对比、需要中间推理步骤的任务。**这与 v4 需求中"CLI 命令行调用"的设计意图完全一致**——Agent 直接读写服务器文件，上层流程无需手动拼接文件内容到请求体。

### 3.3 SSE 消息格式映射

Agent SDK 的 `SDKMessage` 需要映射为现有的 `SSEEvent` 格式：

```typescript
// Agent SDK SDKMessage → IntelliFlow SSEEvent 映射
function mapAgentMessage(msg: SDKMessage, modelId: string): SSEEvent | null {
  // 文本增量
  if (msg.type === "assistant" && msg.subtype === "text") {
    return { type: "delta", modelId, data: msg.content, timestamp: new Date().toISOString() };
  }
  // 工具调用（可选：转为特殊 SSE 事件供前端展示 Agent 思考过程）
  if (msg.type === "assistant" && msg.subtype === "tool_use") {
    return { type: "status", modelId, data: `agent_tool:${msg.tool_name}`, timestamp: new Date().toISOString() };
  }
  // 最终结果
  if ("result" in msg) {
    return { type: "complete", modelId, data: msg.result, timestamp: new Date().toISOString() };
  }
  // 错误
  if (msg.type === "error") {
    return { type: "error", modelId, data: msg.error?.message ?? "Unknown error", timestamp: new Date().toISOString() };
  }
  return null; // 跳过系统消息等
}
```

---

## 四、实施计划

### Phase 1：基础设施层（Provider + Model 扩展）

**目标**：在 Provider 管理中新增 `claude_agent_sdk` 类型，支持配置 Anthropic/火山方舟端点。

#### 1.1 数据库 Schema 变更

**文件**：`packages/backend/src/db/schema.ts`

```typescript
// 修改 providerTypeEnum
export const providerTypeEnum = pgEnum("provider_type", [
  "openai_compatible",
  "opencode",
  "claude_agent_sdk",  // 新增
]);
```

**迁移 SQL**：
```sql
ALTER TYPE provider_type ADD VALUE 'claude_agent_sdk';
```

#### 1.2 共享类型扩展

**文件**：`packages/shared/src/types.ts`

```typescript
// 修改 ProviderType
export type ProviderType = "openai_compatible" | "opencode" | "claude_agent_sdk";

// 新增 Agent SDK 相关类型
export type AgentMode = "simple_chat" | "autonomous_agent";

// 扩展 Model 接口
export interface Model extends BaseEntity {
  // ... 现有字段
  agentMode?: AgentMode;         // Agent SDK 专用：运行模式
  maxTurns?: number;             // Agent SDK 专用：最大交互轮数
  maxBudgetUsd?: number;         // Agent SDK 专用：预算上限（美元）
  allowedTools?: string[];       // Agent SDK 专用：允许的内置工具
}
```

#### 1.3 Provider 连通性测试

**文件**：`packages/backend/src/modules/providers/providers.service.ts`

在 `testProviderConnection()` 中新增分支：

```typescript
case "claude_agent_sdk": {
  // 方式：使用 Agent SDK 的 query() 发送简单测试
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const testQuery = query({
    prompt: "Reply with exactly: OK",
    options: {
      allowedTools: [],
      maxTurns: 1,
      env: {
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_MODEL: "doubao-seed-2.0-code", // 默认测试模型
      },
    }
  });
  let gotResult = false;
  for await (const msg of testQuery) {
    if ("result" in msg) { gotResult = true; break; }
  }
  // 返回测试结果
}
```

#### 1.4 安装依赖

```bash
bun add @anthropic-ai/claude-agent-sdk
```

> **注意**：Agent SDK 依赖 Node.js 18+，Bun 对此兼容良好。需验证 `@anthropic-ai/claude-agent-sdk` 在 Bun 运行时下的完整兼容性。如遇问题，可通过 `executable: "bun"` 选项指定运行时。

---

### Phase 2：调用执行层

**目标**：在 `model-call.service.ts` 中实现 `claude_agent_sdk` 类型的模型调用逻辑。

#### 2.1 重构 `executeModelCall` — 策略模式

当前 `executeModelCall` 内部硬编码了 OpenAI 兼容的调用逻辑。重构为策略模式：

**新建文件**：`packages/backend/src/modules/runtime/strategies/`

```
strategies/
├── index.ts                    # 策略注册与分发
├── base.strategy.ts            # 基础策略接口
├── openai-compatible.strategy.ts  # 现有逻辑提取
└── claude-agent-sdk.strategy.ts   # 新增
```

**策略接口**：

```typescript
// base.strategy.ts
export interface ModelCallStrategy {
  execute(params: {
    model: ModelRow;
    resolvedPrompt: string;
    workspaceDir?: string;        // Agent 模式需要
    sendEvent: (event: SSEEvent) => void;
  }): Promise<{ content: string; status: "completed" | "failed"; errorMessage?: string }>;
}
```

**策略分发**：

```typescript
// index.ts
export function getStrategy(providerType: ProviderType): ModelCallStrategy {
  switch (providerType) {
    case "openai_compatible": return new OpenAICompatibleStrategy();
    case "opencode":          return new OpenAICompatibleStrategy(); // OpenCode 复用 OpenAI 协议
    case "claude_agent_sdk":  return new ClaudeAgentSDKStrategy();
    default: throw new Error(`Unsupported provider type: ${providerType}`);
  }
}
```

#### 2.2 Agent SDK 策略实现

**文件**：`strategies/claude-agent-sdk.strategy.ts`

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { ModelCallStrategy } from "./base.strategy";

export class ClaudeAgentSDKStrategy implements ModelCallStrategy {
  async execute({ model, resolvedPrompt, workspaceDir, sendEvent }) {
    const startTime = Date.now();
    let fullContent = "";

    const agentMode = model.agentMode ?? "simple_chat";
    const isAutonomous = agentMode === "autonomous_agent";

    const options = {
      allowedTools: isAutonomous
        ? (model.allowedTools ?? ["Read", "Write", "Glob", "Grep"])
        : [],
      disallowedTools: ["Bash"],  // 安全考量：默认禁止 Bash
      model: model.modelId,
      cwd: isAutonomous ? workspaceDir : undefined,
      env: {
        ANTHROPIC_AUTH_TOKEN: model.apiKey,
        ANTHROPIC_BASE_URL: model.baseUrl,
        ANTHROPIC_MODEL: model.modelId,
      },
      maxTurns: model.maxTurns ?? (isAutonomous ? 15 : 1),
      maxBudgetUsd: model.maxBudgetUsd ?? 2.0,
      ...(isAutonomous && {
        permissionMode: "bypassPermissions" as const,
        allowDangerouslySkipPermissions: true,
      }),
    };

    try {
      for await (const msg of query({ prompt: resolvedPrompt, options })) {
        // 文本增量
        if (msg.type === "assistant" && msg.subtype === "text") {
          fullContent += msg.content;
          sendEvent({
            type: "delta",
            modelId: model.id,
            data: msg.content,
            timestamp: new Date().toISOString(),
          });
        }
        // Agent 工具调用状态（可选，供前端展示）
        if (msg.type === "assistant" && msg.subtype === "tool_use") {
          sendEvent({
            type: "status",
            modelId: model.id,
            data: `thinking:${msg.tool_name}`,
            timestamp: new Date().toISOString(),
          });
        }
        // 最终结果
        if ("result" in msg) {
          if (!fullContent) fullContent = msg.result;
        }
      }

      // Autonomous 模式：Agent 可能直接写文件而非返回文本
      // 此时 fullContent 可能为空，需要从输出文件读取
      if (isAutonomous && !fullContent && workspaceDir) {
        // 从 Agent 写入的输出文件读取内容
        fullContent = await readAgentOutputFile(workspaceDir, model);
      }

      sendEvent({
        type: "complete",
        modelId: model.id,
        data: fullContent,
        timestamp: new Date().toISOString(),
      });

      return { content: fullContent, status: "completed" as const };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      sendEvent({
        type: "error",
        modelId: model.id,
        data: errorMessage,
        timestamp: new Date().toISOString(),
      });
      return { content: fullContent, status: "failed" as const, errorMessage };
    }
  }
}
```

#### 2.3 修改 `executeModelCall` 主函数

在 `model-call.service.ts` 中，查询模型时额外获取 `providerType`，然后调用对应策略：

```typescript
// 查询时增加 providerType
const modelRows = await db
  .select({
    // ...现有字段
    providerType: providers.type,  // 新增
    agentMode: models.agentMode,   // 新增（如果 model 表扩展了此字段）
  })
  .from(models)
  .innerJoin(providers, eq(models.providerId, providers.id))
  .where(inArray(models.id, modelIds));

// 执行时分发策略
const strategy = getStrategy(model.providerType);
const result = await strategy.execute({
  model,
  resolvedPrompt,
  workspaceDir,  // 从 document 执行上下文获取
  sendEvent,
});
```

---

### Phase 3：前端适配

#### 3.1 Provider 管理页面

- 新增 `claude_agent_sdk` Provider 类型选项
- 配置表单字段：
  - Base URL（默认填入 `https://ark.cn-beijing.volces.com/api/coding`）
  - API Key（火山方舟 API Key）
  - 部署类型（cloud / local）

#### 3.2 Model 管理页面

当 Provider 类型为 `claude_agent_sdk` 时，展示额外配置项：
- Agent 运行模式：`simple_chat` / `autonomous_agent`
- 最大交互轮数（`maxTurns`，默认 15）
- 预算上限（`maxBudgetUsd`，默认 2.0）
- 允许的内置工具（多选：Read、Write、Glob、Grep）
- Model Name（火山方舟支持的模型名，如 `doubao-seed-2.0-code`、`kimi-k2.5` 等）

#### 3.3 模型调用节点 — Agent 状态展示

当模型使用 Agent SDK 时，前端在流式输出区域额外展示：
- Agent 思考过程（工具调用状态，如"正在读取文件..."、"正在搜索..."）
- Agent 当前轮次 / 最大轮次
- 预算使用情况

---

### Phase 4：数据库迁移与模型表扩展

#### 4.1 models 表新增字段

```sql
ALTER TABLE models ADD COLUMN agent_mode VARCHAR(20) DEFAULT 'simple_chat';
ALTER TABLE models ADD COLUMN max_turns INTEGER DEFAULT 15;
ALTER TABLE models ADD COLUMN max_budget_usd DECIMAL(10,2) DEFAULT 2.00;
ALTER TABLE models ADD COLUMN allowed_tools JSONB DEFAULT '[]'::jsonb;
```

#### 4.2 model_call_logs 表扩展

```sql
-- 记录 Agent SDK 调用的额外信息
ALTER TABLE model_call_logs ADD COLUMN agent_turns_used INTEGER;
ALTER TABLE model_call_logs ADD COLUMN agent_tools_called JSONB;  -- ["Read", "Write", ...]
ALTER TABLE model_call_logs ADD COLUMN budget_used_usd DECIMAL(10,4);
```

---

### Phase 5：安全与运维

#### 5.1 安全考量

| 风险 | 缓解措施 |
|---|---|
| Agent 读写任意文件 | `cwd` 限定工作目录；`disallowedTools: ["Bash"]` 禁止命令执行 |
| Agent 执行时间过长 | `maxTurns` + `maxBudgetUsd` 双重限制；`AbortController` 超时取消 |
| API Key 泄露 | 现有加密存储机制复用，Key 仅在调用时注入 `env` |
| 脱敏数据安全 | 与现有机制一致——提示词只注入类型描述，不含真实值 |
| Agent 自主操作不可预测 | 通过 `allowedTools` 白名单精确控制；通过 Hooks 审计所有工具调用 |

#### 5.2 Hooks 审计

```typescript
// 使用 Agent SDK Hooks 记录所有工具调用
hooks: {
  PostToolUse: [{
    matcher: ".*",
    hooks: [async (input) => {
      await db.insert(agentToolLogs).values({
        toolName: input.tool_name,
        filePath: input.tool_input?.file_path,
        timestamp: new Date(),
      });
      return {};
    }]
  }]
}
```

---

## 五、实施顺序与时间估算

| 阶段 | 任务 | 预估工时 | 依赖 |
|---|---|---|---|
| **P1** | Schema 变更 + 类型扩展 + 安装依赖 | 0.5 天 | 无 |
| **P2** | 策略模式重构（提取现有逻辑） | 1 天 | P1 |
| **P3** | Agent SDK 策略实现 + 单元测试 | 1.5 天 | P2 |
| **P4** | Provider 连通性测试实现 | 0.5 天 | P1 |
| **P5** | 前端 Provider/Model 管理页面适配 | 1 天 | P1 |
| **P6** | 前端 Agent 状态展示 | 1 天 | P3 |
| **P7** | 数据库迁移 + Log 扩展 | 0.5 天 | P1 |
| **P8** | 集成测试 + 火山方舟端到端验证 | 1 天 | P3, P5 |
| **P9** | 安全审计 + Hooks 审计实现 | 0.5 天 | P3 |
| **合计** | | **7.5 天** | |

---

## 六、火山方舟 Coding Plan 接入配置速查

### 6.1 支持的模型

| Model Name | 说明 |
|---|---|
| `doubao-seed-2.0-code` | 豆包编码模型 |
| `doubao-seed-2.0-pro` | 豆包专业模型 |
| `doubao-seed-2.0-lite` | 豆包轻量模型 |
| `doubao-seed-code` | 豆包编码模型（旧版） |
| `minimax-m2.5` | MiniMax M2.5 |
| `glm-4.7` | 智谱 GLM-4.7 |
| `deepseek-v3.2` | DeepSeek V3.2 |
| `kimi-k2.5` | Kimi K2.5 |
| `ark-code-latest` | 自动模式（控制台切换） |

### 6.2 端点配置

```
Anthropic 兼容端点（Agent SDK 使用）：
  ANTHROPIC_BASE_URL = https://ark.cn-beijing.volces.com/api/coding
  ANTHROPIC_AUTH_TOKEN = <ARK_API_KEY>

OpenAI 兼容端点（openai_compatible Provider 使用）：
  baseUrl = https://ark.cn-beijing.volces.com/api/coding/v3
  apiKey = <ARK_API_KEY>

⚠️ 勿使用 https://ark.cn-beijing.volces.com/api/v3（不走 Coding Plan 额度）
```

### 6.3 API Key 获取

访问 [火山引擎 API Key 管理](https://console.volcengine.com/ark/region:ark+cn-beijing/apikey) 获取。

---

## 七、与现有架构的关系总结

```
v4 需求文档定义的调用方式            本项目实际实现
─────────────────────            ──────────────
CLI 命令行调用 (v1)    ────→    claude_agent_sdk (Autonomous Agent 模式)
                                 └─ Agent 自主读写文件，与 CLI 方式异曲同工
                                 └─ 但无需 spawn 子进程，更可控、可监控

API 直接调用 (v2)      ────→    openai_compatible (已实现)
                                 └─ 标准 OpenAI Chat Completions 协议

新增调用方式            ────→    claude_agent_sdk (Simple Chat 模式)
                                 └─ Anthropic 原生协议，适配 Claude 系列模型
                                 └─ 通过火山方舟 Coding Plan 降低成本
```

---

## 八、待确认事项

1. **Bun 兼容性验证**：需在项目实际环境中验证 `@anthropic-ai/claude-agent-sdk` 在 Bun 运行时下的完整兼容性。SDK 底层 spawn 子进程时默认检测 Node.js，可能需要通过 `executable: "bun"` 或 `executable: "node"` 显式指定。

2. **火山方舟 Anthropic 端点对 Agent SDK 的支持程度**：火山方舟的 Anthropic 兼容端点主要为 Claude Code CLI 设计，Agent SDK 的某些高级特性（如 extended thinking、tool_use 中间结果）可能存在兼容性差异，需实际测试确认。

3. **Agent 模式下的 Token 统计**：Agent 自主执行多轮时，Token 消耗跨多次 API 调用。需要确认 Agent SDK 是否提供汇总的 usage 数据，还是需要从 Hooks 中自行统计。

4. **并发 Agent 实例数**：多模型并行时，每个 Agent SDK 实例会 spawn 一个子进程。需评估服务器可同时运行的 Agent 实例数上限。

5. **火山方舟 Coding Plan 额度**：Coding Plan 为订阅制套餐，需确认额度是否满足项目使用量，以及超额后的处理策略。

---

## 九、Claude Code 读取本计划的快速指引

在项目根目录执行 Claude Code 时，可参考以下 prompt 启动实施：

```
请阅读 docs/design/claude-agent-sdk-integration-plan.md，这是为 IntelliFlow 新增 Claude Agent SDK 调用方式的实施计划。请按照计划中的 Phase 顺序逐步实施：

1. 先执行 Phase 1（基础设施层），修改 schema、类型定义、安装依赖
2. 然后执行 Phase 2（调用执行层），重构为策略模式并实现 Agent SDK 策略
3. 接着处理前端适配和数据库迁移

每个 Phase 完成后暂停，等待我确认后再继续下一个 Phase。
```
