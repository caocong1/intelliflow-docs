# 存储架构设计

> 基于 2026-03-19 技术讨论，确定 IntelliFlow Docs 的数据存储架构。

## 一、设计决策

**推荐方案：PostgreSQL + 服务器文件系统（混合存储 + 临时工作区模式）**

- **PostgreSQL**：存储元数据、文本内容、脱敏映射（加密）、执行记录、文件索引
- **服务器文件系统**：存储二进制文件（用户上传的原文件、导出的 .docx/.pdf）、CLI 执行的临时工作区
- **后续可选升级**：文件系统部分按需升级为 MinIO/S3 对象存储（多服务器部署时）

## 二、核心设计：临时工作区模式

**DB 是唯一数据源**，文件系统仅作为 CLI agent 的临时工作区：

```
执行前（物化）：
  DB 文本内容 → 写入 /tmp/workspace/{taskId}/s1/, s2/...
  文件系统二进制 → 复制到临时目录

CLI 执行：
  claude -p "...读取 /tmp/.../s1/需求清单.md → 输出 /tmp/.../s2/报告.md"

执行后（回收）：
  扫描输出目录 → 文本写入 DB → 更新文件索引 → 清理临时目录

API 模式（v2）：
  直接 DB 读写，完全绕过文件系统，零额外开销
```

## 三、存储职责划分

| 存储位置 | 存储内容 | 设计考量 |
| ------- | ------- | ------- |
| **PostgreSQL** | 生成任务记录（任务ID、状态、创建人、时间）；节点执行状态与流转记录；脱敏映射关系（pgcrypto 加密）；文件索引（路径、名称、类型、大小、所属节点）；节点输出的文本内容（TEXT 字段）；模型调用日志（调用方式、耗时、Token、状态）；版本记录与快照索引 | 结构化查询、事务一致性、权限控制（RLS）、审计统计 |
| **文件系统** | 用户上传的原始文件（.docx/.pdf 等）；导出的最终文件；CLI 执行的临时工作区；命令行 stdout/stderr 日志文件 | 大二进制不适合存 DB；CLI agent 天然读写文件 |

**协作关系**：
- 文件系统中的每个文件在 DB 中有对应的**文件索引记录**
- 节点执行状态、流转逻辑、权限判断通过 DB 查询，不依赖文件系统状态
- 脱敏映射加密存储在 DB 中，临时工作区中的 `mapping.json` 是运行时副本

## 四、模型调用双引擎

| 执行引擎 | invoke_type | 版本 | 工作方式 |
| ------- | ----------- | --- | ------- |
| **CLI 命令行** | `cli` | v1（首选） | 系统物化文件到临时目录 → CLI agent 读写文件 → 系统回收结果到 DB |
| **API 直接调用** | `api` | v2（扩展） | 系统从 DB 读内容 → 组装 API 请求 → 接收响应 → 写入 DB |

**统一结果处理**（无论哪种引擎）：
1. 检查输出是否成功生成
2. DB 记录：调用方式、模型、耗时、Token 消耗、状态
3. 更新文件索引
4. 更新节点状态，触发下游流转

## 五、关键数据模型（概念）

```sql
-- 版本快照
CREATE TABLE version_snapshots (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  step_number INT,
  execution_id UUID,
  snapshot_type VARCHAR(20),  -- 'auto' / 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 节点输出（不可变，每次执行产生新行）
CREATE TABLE node_outputs (
  id UUID PRIMARY KEY,
  snapshot_id UUID REFERENCES version_snapshots(id),
  task_id UUID,
  step_number INT,
  filename VARCHAR(255),
  content_type VARCHAR(20),   -- 'text' / 'binary'
  text_content TEXT,           -- 文本内容直接存储
  file_path VARCHAR(500),      -- 二进制文件在文件系统的路径
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 脱敏映射（加密存储）
CREATE TABLE desensitization_mappings (
  id UUID PRIMARY KEY,
  task_id UUID,
  encrypted_mapping BYTEA,    -- pgp_sym_encrypt(mapping_json, key)
  created_at TIMESTAMPTZ,
  created_by UUID
);
```

## 六、方案对比（评估过程记录）

评估了三种方案后选定当前方案：

| 维度 | A: PG 全存 | **B: PG + 文件系统（选定）** | C: MongoDB |
|------|----------|-------------------------|------------|
| 二进制存储 | 差（BYTEA 膨胀） | **好（文件系统原生）** | 中（GridFS） |
| 事务一致性 | 最强 | **强** | 弱 |
| CLI 兼容 | 需桥接 | **需桥接（临时工作区）** | 需桥接 |
| API 模式 | 优 | **优** | 优 |
| 运维复杂度 | 低 | **低** | 中 |
| 扩展性 | 中 | **高（可升级 MinIO）** | 高 |

**排除 MongoDB 理由**：事务弱、关系查询差（权限/审计场景需要 JOIN）、与已有技术选型不匹配。

**未选 PG 全存理由**：二进制（.docx/.pdf）存 DB 会导致 WAL 膨胀，DB 体积快速增长。

## 七、后续升级路径

当需要多服务器部署或文件量增大时：
1. 文件系统部分升级为 MinIO/S3 对象存储
2. 迁移成本低（本质是文件从本地目录搬到 MinIO bucket）
3. DB 中的文件索引 `file_path` 改为 `object_key`
4. 临时工作区模式不变，WorkspaceManager 改为从 MinIO 下载文件
