# Requirements: IntelliFlow（智文平台）

**Defined:** 2026-03-19
**Core Value:** 用户能跑通完整流程生成高质量文档 — 从输入到多模型并行生成、对比迭代、脱敏恢复、最终导出

## v1 Requirements

Requirements for initial release (M1-M5). Each maps to roadmap phases.

### 认证与用户管理

- [ ] **AUTH-01**: 用户可通过用户名和密码登录系统
- [ ] **AUTH-02**: 管理员可创建、编辑、停用用户账号
- [ ] **AUTH-03**: 用户登录后系统根据角色（系统管理员/普通用户）展示对应功能
- [ ] **AUTH-04**: 用户会话在浏览器刷新后保持登录状态

### AI 模型配置

- [ ] **AIMC-01**: 管理员可创建 Provider 实例（选择类型、填写名称、API 地址、认证信息）
- [ ] **AIMC-02**: 管理员可编辑和删除 Provider 实例
- [ ] **AIMC-03**: 管理员可测试 Provider 连通性
- [ ] **AIMC-04**: 管理员可启用/停用 Provider 实例
- [ ] **AIMC-05**: 管理员可在 Provider 下添加模型（模型 ID、显示名称、部署类型、调用方式、参数配置）
- [ ] **AIMC-06**: 管理员可编辑、启用/停用、删除模型
- [ ] **AIMC-07**: 模型支持标记部署类型（线上云端/本地私有）
- [ ] **AIMC-08**: 模型支持配置 CLI 命令行调用模板（v1 首选）
- [ ] **AIMC-09**: 模型支持配置参数（temperature、max_tokens、top_p 等）

### 文档类型管理

- [ ] **DTYPE-01**: 管理员可创建文档类型（类型名称、类型编码、类型描述）
- [ ] **DTYPE-02**: 管理员可编辑文档类型信息
- [ ] **DTYPE-03**: 管理员可启用/停用文档类型（停用后不可新建该类型文档）
- [ ] **DTYPE-04**: 管理员可删除文档类型（仅无关联文档时可删除）
- [ ] **DTYPE-05**: 管理员可查看文档类型列表并搜索

### 流程编排

- [ ] **FLOW-01**: 管理员可创建流程（选择所属文档类型、填写名称和描述）
- [ ] **FLOW-02**: 管理员可在流程编辑器中从 5 种基础节点类型添加、排列、配置节点
- [ ] **FLOW-03**: 同一节点类型可在流程中多次添加，各实例独立配置
- [ ] **FLOW-04**: 管理员可配置输入转换节点（输入表单字段、文件上传选项、输出文件定义）
- [ ] **FLOW-05**: 管理员可配置信息脱敏节点（脱敏规则类型、占位符格式、本地模型选择）
- [ ] **FLOW-06**: 管理员可配置模型调用节点（显示名称、输入文件、提示词模板、模型选择、输出文件）
- [ ] **FLOW-07**: 管理员可配置信息恢复节点
- [ ] **FLOW-08**: 管理员可配置文件导出节点（导出格式、排版模板、内容映射规则）
- [ ] **FLOW-09**: 提示词模板支持 {{变量名}} 插值（工作目录、输入目录、输出目录、脱敏规则等系统变量）
- [ ] **FLOW-10**: 系统自动校验流程合理性（起止节点、脱敏配对、必填项等）
- [ ] **FLOW-11**: 管理员可启用/停用、编辑、删除、复制流程
- [ ] **FLOW-12**: 管理员可设置文档类型的默认流程
- [ ] **FLOW-13**: 流程可视化预览（展示节点流转图和文件流向）

### 项目管理

- [ ] **PROJ-01**: 用户可创建项目（名称、描述、所属部门）
- [ ] **PROJ-02**: 用户可编辑项目信息
- [ ] **PROJ-03**: 项目负责人可删除项目（软删除）
- [ ] **PROJ-04**: 用户可查看项目列表（我创建的/我参与的/全部项目）并搜索筛选
- [ ] **PROJ-05**: 项目负责人可邀请和移除项目成员
- [ ] **PROJ-06**: 项目成员可自行退出项目（负责人须先移交角色）
- [ ] **PROJ-07**: 项目支持两种角色：项目负责人（全部权限）和项目参与者（限定权限）
- [ ] **PROJ-08**: 项目创建人默认为项目负责人，可添加多个负责人
- [ ] **PROJ-09**: 项目主页根据角色展示不同视图（文档列表、进行中任务、成员管理等）

### 文档创建与工作台

- [ ] **DOC-01**: 用户可在项目内从空白创建文档（选择文档类型→选择流程→填写标题）
- [ ] **DOC-02**: 创建文档时系统自动在服务器创建工作目录
- [ ] **DOC-03**: 工作台展示流程进度导航栏（已完成/进行中/待执行状态标记）
- [ ] **DOC-04**: 工作台展示当前节点操作区（根据节点类型展示对应界面）
- [ ] **DOC-05**: 工作台展示节点历史面板（查看已完成节点的输入输出记录）

### 节点执行 — 输入转换

- [ ] **NODE-01**: 用户可在输入转换节点填写文字、上传文件
- [ ] **NODE-02**: 上传文件支持 Word/PDF/图片/音频/视频，系统自动解析为文本
- [ ] **NODE-03**: 用户可查看文件解析结果并修改
- [ ] **NODE-04**: 确认后输入数据按配置写入步骤子目录

### 节点执行 — 信息脱敏

- [ ] **NODE-05**: 系统使用本地私有模型辅助识别敏感信息并高亮标记
- [ ] **NODE-06**: 用户可逐条确认是否脱敏，可手动标记额外敏感信息
- [ ] **NODE-07**: 脱敏映射关系加密存储在数据库中，工作目录保留本地副本
- [ ] **NODE-08**: 脱敏规则（仅类型描述，不含真实值）自动注入后续模型调用节点提示词

### 节点执行 — 模型调用

- [ ] **NODE-09**: 系统通过统一抽象层执行模型调用（v1 CLI 命令行方式）
- [ ] **NODE-10**: 用户可选择单模型（系统推荐）或多模型对比模式
- [ ] **NODE-11**: 多模型并行调用，各模型输出到同一步骤目录的不同文件
- [ ] **NODE-12**: 模型生成过程通过 SSE 流式输出展示（等待中→思考中→生成中→完成/失败）
- [ ] **NODE-13**: 用户可切换查看不同模型输出（Markdown 渲染/源码视图）
- [ ] **NODE-14**: 单个模型失败可单独重试，已成功的输出保留
- [ ] **NODE-15**: 多模型时支持左右分栏对比
- [ ] **NODE-16**: 用户选定最佳输出作为本节点最终输出

### 节点执行 — 信息恢复

- [ ] **NODE-17**: 系统纯本地处理，读取脱敏映射将占位符替换回真实值
- [ ] **NODE-18**: 页面展示恢复前后对比（高亮已恢复位置）
- [ ] **NODE-19**: 恢复失败的项高亮标记，允许用户手动修正

### 节点执行 — 文件导出

- [ ] **NODE-20**: 用户可选择导出格式（Word/PDF/Markdown）
- [ ] **NODE-21**: 用户可预览导出效果
- [ ] **NODE-22**: 用户可设置文件名并下载，导出文件存储在工作目录 export/ 下

### 节点通用操作

- [ ] **NOPS-01**: 用户可在任意节点点击"确认/下一步"流转到下一个节点
- [ ] **NOPS-02**: 用户可在任意节点展开内联编辑器修改当前节点输出内容
- [ ] **NOPS-03**: 用户可跳过后续可选节点，直接流转至下一个必经节点或文件导出
- [ ] **NOPS-04**: 用户可回退到之前的节点重新执行，后续节点状态重置

### 文档管理

- [ ] **DMGT-01**: 用户可查看项目内文档列表（按创建时间/类型/状态筛选排序）
- [ ] **DMGT-02**: 用户可搜索文档（按标题、描述关键词）
- [ ] **DMGT-03**: 用户可查看文档详情（基本信息、流程执行历史、工作目录浏览）
- [ ] **DMGT-04**: 用户可删除文档（软删除，进入回收站）
- [ ] **DMGT-05**: 文档创建人可设置文档可见性（仅自己/项目成员/指定成员可见）
- [ ] **DMGT-06**: 项目负责人可查看项目内所有文档，不受可见性限制

### 版本管理

- [ ] **VER-01**: 每个节点完成时系统自动生成版本快照
- [ ] **VER-02**: 用户可查看版本列表（时间线形式）
- [ ] **VER-03**: 用户可对比两个版本（Diff 查看）

### 文件系统与工作目录

- [ ] **FSYS-01**: 每次文档生成自动创建规范的工作目录结构
- [ ] **FSYS-02**: 每个节点输出文件写入对应步骤子目录，文件在数据库中有索引记录
- [ ] **FSYS-03**: 节点间通过文件路径引用传递数据
- [ ] **FSYS-04**: 工作目录与文档绑定，文档删除时工作目录归档不立即物理删除

### 失败恢复

- [ ] **RECV-01**: 每个节点操作过程自动保存草稿
- [ ] **RECV-02**: 浏览器关闭后重新进入文档可恢复到上次操作状态
- [ ] **RECV-03**: 支持取消正在进行的 AI 生成任务

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 企业微信集成

- **WCOM-01**: 用户通过企业微信 OAuth 自动登录
- **WCOM-02**: 首次登录自动创建系统账号，同步企业微信用户信息
- **WCOM-03**: 企业微信外部浏览器支持扫码登录
- **WCOM-04**: 邀请成员时通过企业微信通讯录搜索

### 统计与审计

- **STAT-01**: 总览面板（调用次数、Token 消耗、活跃用户数、文档生成数）
- **STAT-02**: 生成记录明细（操作人、文档信息、模型、耗时、Token、对账金额）
- **STAT-03**: 多维度统计（按模型/用户/部门/项目/文档类型/流程）
- **STAT-04**: 时间维度报表（周/月/年）

### 用量与限制

- **QUOT-01**: 按用户/部门/项目/模型设置调用次数限制
- **QUOT-02**: 用量统计面板
- **QUOT-03**: 超限提醒与处理策略

### 增强功能

- **ENHC-01**: 全局搜索（跨项目搜索文档、资料、流程）
- **ENHC-02**: 最近访问 / 收藏功能
- **ENHC-03**: 文档评论与行内批注
- **ENHC-04**: 从已有文档导入创建
- **ENHC-05**: 从历史文档复制创建
- **ENHC-06**: 后台 AI 生成 + 企业微信消息通知
- **ENHC-07**: 引用来源展示（标注引用资料段落）
- **ENHC-08**: Excel 导出格式支持
- **ENHC-09**: AI 辅助内联编辑（模型辅助修改节点内容）
- **ENHC-10**: 条件路由（管理员配置自动条件分支）

### 暂缓节点类型

- **FNODE-01**: 选择资料节点（从资料库 RAG 检索参考资料）
- **FNODE-02**: 大纲确认节点（AI 先生成大纲，用户确认后生成正文）
- **FNODE-03**: 人工审核节点（指定审核人审核，支持审批流转和通知）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 实时多人协同编辑 | 高复杂度（CRDT/OT），业务规则#1 已明确同一文档同一时间只允许一人编辑 |
| 用户自定义节点类型 | 复杂度无上限，安全风险；管理员通过 5 种固定节点类型灵活配置满足需求 |
| 内置 AI 模型托管 | 超出范围，运维负担大；通过外部 Provider 集成 |
| 移动端 App | Web 优先的内部工具，暂无移动端场景 |
| 多租户 SaaS 架构 | 公司内部工具，单租户部署 |
| 插件/扩展市场 | 过度工程化，当前需求通过节点配置满足 |
| 项目资料库（RAG） | 独立且复杂的子系统，涉及文件解析、向量化、检索等，暂不纳入规划 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| DTYPE-01 | Phase 1 | Pending |
| DTYPE-02 | Phase 1 | Pending |
| DTYPE-03 | Phase 1 | Pending |
| DTYPE-04 | Phase 1 | Pending |
| DTYPE-05 | Phase 1 | Pending |
| AIMC-01 | Phase 2 | Pending |
| AIMC-02 | Phase 2 | Pending |
| AIMC-03 | Phase 2 | Pending |
| AIMC-04 | Phase 2 | Pending |
| AIMC-05 | Phase 2 | Pending |
| AIMC-06 | Phase 2 | Pending |
| AIMC-07 | Phase 2 | Pending |
| AIMC-08 | Phase 2 | Pending |
| AIMC-09 | Phase 2 | Pending |
| FLOW-01 | Phase 3 | Pending |
| FLOW-02 | Phase 3 | Pending |
| FLOW-03 | Phase 3 | Pending |
| FLOW-04 | Phase 3 | Pending |
| FLOW-05 | Phase 3 | Pending |
| FLOW-06 | Phase 3 | Pending |
| FLOW-07 | Phase 3 | Pending |
| FLOW-08 | Phase 3 | Pending |
| FLOW-09 | Phase 3 | Pending |
| FLOW-10 | Phase 3 | Pending |
| FLOW-11 | Phase 3 | Pending |
| FLOW-12 | Phase 3 | Pending |
| FLOW-13 | Phase 3 | Pending |
| PROJ-01 | Phase 4 | Pending |
| PROJ-02 | Phase 4 | Pending |
| PROJ-03 | Phase 4 | Pending |
| PROJ-04 | Phase 4 | Pending |
| PROJ-05 | Phase 4 | Pending |
| PROJ-06 | Phase 4 | Pending |
| PROJ-07 | Phase 4 | Pending |
| PROJ-08 | Phase 4 | Pending |
| PROJ-09 | Phase 4 | Pending |
| DMGT-01 | Phase 4 | Pending |
| DMGT-02 | Phase 4 | Pending |
| DMGT-03 | Phase 4 | Pending |
| DMGT-04 | Phase 4 | Pending |
| DMGT-05 | Phase 4 | Pending |
| DMGT-06 | Phase 4 | Pending |
| VER-01 | Phase 4 | Pending |
| VER-02 | Phase 4 | Pending |
| VER-03 | Phase 4 | Pending |
| FSYS-01 | Phase 4 | Pending |
| FSYS-02 | Phase 4 | Pending |
| FSYS-03 | Phase 4 | Pending |
| FSYS-04 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |
| DOC-04 | Phase 5 | Pending |
| DOC-05 | Phase 5 | Pending |
| NODE-01 | Phase 5 | Pending |
| NODE-02 | Phase 5 | Pending |
| NODE-03 | Phase 5 | Pending |
| NODE-04 | Phase 5 | Pending |
| NODE-05 | Phase 5 | Pending |
| NODE-06 | Phase 5 | Pending |
| NODE-07 | Phase 5 | Pending |
| NODE-08 | Phase 5 | Pending |
| NODE-09 | Phase 5 | Pending |
| NODE-10 | Phase 5 | Pending |
| NODE-11 | Phase 5 | Pending |
| NODE-12 | Phase 5 | Pending |
| NODE-13 | Phase 5 | Pending |
| NODE-14 | Phase 5 | Pending |
| NODE-15 | Phase 5 | Pending |
| NODE-16 | Phase 5 | Pending |
| NODE-17 | Phase 5 | Pending |
| NODE-18 | Phase 5 | Pending |
| NODE-19 | Phase 5 | Pending |
| NODE-20 | Phase 5 | Pending |
| NODE-21 | Phase 5 | Pending |
| NODE-22 | Phase 5 | Pending |
| NOPS-01 | Phase 5 | Pending |
| NOPS-02 | Phase 5 | Pending |
| NOPS-03 | Phase 5 | Pending |
| NOPS-04 | Phase 5 | Pending |
| RECV-01 | Phase 5 | Pending |
| RECV-02 | Phase 5 | Pending |
| RECV-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 87 total
- Mapped to phases: 87
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
