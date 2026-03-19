# Phase 2: AI Provider and Model Configuration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员可配置 AI 提供商（Provider）和模型（Model），验证连通性，为后续流程编排准备可用模型。v1 仅实现 OpenAI 兼容协议调用方式，不实现 CLI 命令行调用、自定义 HTTP 等其他 Provider 类型。

</domain>

<decisions>
## Implementation Decisions

### 调用协议
- v1 仅实现 **OpenAI 兼容协议**（Chat Completions 格式），不实现 CLI 命令行调用
- 开发阶段使用火山方舟 Coding Plan（Base URL: `https://ark.cn-beijing.volces.com/api/coding/v3`）
- 生产环境切换为火山方舟正式 API（Base URL: `https://ark.cn-beijing.volces.com/api/v3`）
- 两者接口格式完全一致，切换只需改 Base URL
- 认证方式：API Key（请求头 Bearer Token）

### 可用模型（Coding Plan 套餐）
- `doubao-seed-2.0-pro` — 字节跳动，通用能力强，文档生成首选
- `doubao-seed-2.0-lite` — 字节跳动，轻量快速
- `deepseek-v3.2` — DeepSeek，推理能力强
- `kimi-k2.5` — 月之暗面，长上下文，中文好
- `glm-4.7` — 智谱 AI，中文理解好
- `minimax-m2.5` — MiniMax，通用型
- `doubao-seed-2.0-code` / `doubao-seed-code` — 编程专用，文档生成不推荐

### 页面结构
- Provider 和 Model 在同一页面，**卡片布局**
- 每个 Provider 是一张卡片，卡片内直接展示其下所有 Model 列表（不做收起/展开）
- Model 的新增/编辑使用**弹窗表单**（Modal），复用现有 Modal 组件
- Provider 的新增/编辑同样使用弹窗表单

### 连通性测试
- Provider 卡片上有"测试连接"按钮
- 后端发送一个简单的 Chat Completions 请求（如发送 "hi"）验证配置
- 测试结果用 **Toast 通知**展示（成功/失败 + 错误信息）

### 级联状态
- 停用 Provider 时，其下所有 Model **自动级联停用**，界面置灰
- 重新启用 Provider 后，Model 恢复各自原状态

### 模型参数
- **v1 不做参数配置**（temperature、max_tokens、top_p 等）
- 全部使用 API 默认值，后续有需要再加

### Claude's Discretion
- Provider 卡片的具体视觉样式和布局细节
- Model 列表在卡片内的排列方式
- 测试连接按钮的具体位置和加载状态展示
- 错误提示信息的措辞

</decisions>

<specifics>
## Specific Ideas

- Model 在界面上直接显示名称，程序里根据 ID 调用
- Provider 数量不会很多（初期可能就 1-2 个），不需要复杂的搜索/分页

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Modal` 组件：Provider/Model 的新增编辑弹窗可直接复用
- `Table` 组件：Model 列表展示可复用
- `Badge` 组件：Provider/Model 的启用/停用状态标记
- `Toast` 组件：连通性测试结果通知
- `SearchInput` 组件：如需搜索可复用

### Established Patterns
- Admin 页面模式：`UserManagement.tsx` 和 `DocumentTypeManagement.tsx` 已建立 CRUD 管理页面的交互模式
- 后端模块结构：`packages/backend/src/modules/` 下按功能分模块（auth, users, document-types）
- 共享类型：`packages/shared/types.ts` 定义前后端共享类型
- Indigo 主题 + 中文本地化已统一

### Integration Points
- 后端新增 `modules/providers` 和 `modules/models` 模块
- 前端新增 `pages/admin/ModelConfiguration.tsx`（或类似命名）
- 侧边栏需新增"AI 模型配置"导航项（仅管理员可见）
- 数据库新增 providers 和 models 表

</code_context>

<deferred>
## Deferred Ideas

- CLI 命令行调用方式（原需求 v1 首选）— 暂缓，先用 OpenAI 兼容 API
- 其他 Provider 类型（DashScope 原生、自定义 HTTP）— 暂缓
- 模型参数配置（temperature、max_tokens、top_p、自定义 JSON）— 后续按需添加
- 用量与限制（AIMC 需求中的 2.5.3 节）— v2 范围

</deferred>

---

*Phase: 02-ai-provider-and-model-configuration*
*Context gathered: 2026-03-19*
