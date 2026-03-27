# IntelliFlow Docs — 智能文档流程平台（智文平台）

## 产品简介

面向公司内部多部门使用的 AI 文档生成平台。用户通过 5 种基础节点（输入转换、信息脱敏、模型调用、信息恢复、文件导出）自由编排文档生成流程，驱动多模型并行生成、对比、迭代，快速产出高质量文档。

## 项目目录结构

```
docs/
├── requirements/                  # 需求文档
│   ├── v1.md                     # 初始版本
│   ├── v2.md                     # v2
│   ├── v3.md                     # v3（基础节点自由编排）
│   └── v4-current.md             # ★ 当前最终版（以此为准）
├── design/                        # 设计文档
│   ├── storage-architecture.md   # 存储架构设计（DB+文件系统混合方案）
│   └── material-context-design.md # 素材上下文设计
└── meeting-notes/                 # 会议记录
    ├── 需求大纲审批0317.md
    ├── 需求大纲审批0318.md
    └── 需求大纲沟通会0318.md
```

## 关键技术决策

1. **存储架构**：PostgreSQL（元数据+文本+脱敏映射）+ 服务器文件系统（二进制文件+临时工作区），详见 `docs/design/storage-architecture.md`
2. **模型调用**：统一抽象层，v1 用 CLI 命令行（`claude -p "提示词"`），v2 扩展 API 直接调用
3. **脱敏机制**：脱敏映射 DB 加密存储，脱敏规则（仅类型描述，不含真实值）自动注入后续模型调用的提示词
4. **用户认证**：首选企业微信 OAuth，备选独立账号体系

## 开发规范

1. **包管理器**：全面使用 Bun（`bun install`、`bun run`、`bun add`），不使用 pnpm/npm/yarn，除非遇到 Bun 不支持的场景再讨论
2. **Monorepo**：使用 Bun workspaces（package.json 中的 `workspaces` 字段），不使用 pnpm-workspace.yaml
3. **代码规范**：使用 Biome 进行代码格式化和 lint，不使用 ESLint/Prettier
4. **认证方案**：Bearer Token + localStorage，不使用 JWT 或 Cookie Session

## 服务端口（重要）

**禁止混淆前后端端口：**
- **4000** — Frontend (Vite dev server)，配置文件：`packages/frontend/vite.config.ts`
- **14001** — Backend (Elysia API)，配置文件：`packages/backend/src/index.ts`
- Frontend 通过 Vite proxy（`/api` → `http://127.0.0.1:14001`）访问后端，无需前端跨域配置

## 需求文档阅读指引

- **只看最终版**：`docs/requirements/v4-current.md` 是唯一有效的需求文档
- 历史版本（v1-v3）仅作为决策演变的参考，不作为开发依据
- 会议记录记录了关键决策的背景和讨论过程

## 项目管理

本项目使用 GSD (Get Shit Done) 进行项目管理，`.planning/` 目录由 GSD 自动维护。
