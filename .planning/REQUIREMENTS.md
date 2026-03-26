# Requirements: IntelliFlow v1.1 运营增强与智能编辑

**Defined:** 2026-03-25
**Core Value:** 用户能跑通完整流程生成高质量文档 — 从输入到多模型并行生成、对比迭代、脱敏恢复、最终导出

## v1.1 Requirements

### 后台生成与通知 (Background Generation & Notifications)

- [x] **BGND-01**: 用户可将文档生成任务提交到后台执行，关闭页面后任务继续运行
- [ ] **BGND-02**: 后台任务状态（排队中/执行中/已完成/失败）在文档列表和详情页可见
- [ ] **BGND-03**: 用户可查看后台任务列表，了解所有进行中和已完成的任务
- [ ] **BGND-04**: 后台生成完成后，用户在应用内收到通知（通知列表+未读徽标）
- [ ] **BGND-05**: 后台生成完成后，用户收到企业微信 TextCard 推送通知，点击可跳转到文档
- [x] **BGND-06**: 后台生成失败时，通知包含失败原因和重试入口

### 统计审计 (Statistics & Audit)

- [ ] **STAT-01**: 管理员可查看总览面板：总调用次数、总 Token 消耗、活跃用户数、文档生成数、总成本估算
- [ ] **STAT-02**: 管理员可按模型查看使用统计：调用次数、Token 消耗、成功率、成本、趋势图
- [ ] **STAT-03**: 管理员可按用户查看使用统计：使用频率、文档生成数、Token 消耗、成本
- [ ] **STAT-04**: 管理员可查看生成记录审计明细：谁、用什么流程、哪些节点、哪些模型、耗时、Token 数、成本
- [ ] **STAT-05**: 管理员可按部门/项目/文档类型/流程多维度交叉查看统计数据
- [ ] **STAT-06**: 管理员可按流程查看使用统计：使用次数、用户分布、文档数、趋势
- [ ] **STAT-07**: 所有统计面板支持自定义日期范围和时间粒度（日/周/月）筛选

### 全局搜索与效率 (Search & Productivity)

- [ ] **SRCH-01**: 用户可通过全局搜索框跨项目搜索文档（标题、描述）
- [ ] **SRCH-02**: 用户可通过全局搜索框搜索项目（名称、描述）和流程（名称）
- [ ] **SRCH-03**: 搜索结果遵守文档可见性权限，用户只能搜到有权访问的内容
- [ ] **SRCH-04**: 用户可收藏/取消收藏项目和文档，在"我的收藏"视图快速访问
- [ ] **SRCH-05**: 系统自动记录用户最近访问的项目和文档，在"最近访问"视图展示

### AI 辅助内联编辑 (AI-Assisted Inline Editing)

- [ ] **AIED-01**: 用户在节点输出编辑器中选中文本时，出现 AI 浮动工具栏
- [ ] **AIED-02**: 浮动工具栏提供预置操作：重写、简化、扩展、修正语法、翻译、自定义指令
- [ ] **AIED-03**: AI 生成结果以内联差异预览展示（删除红色/新增绿色），支持逐项接受/拒绝
- [ ] **AIED-04**: AI 编辑使用流式响应（SSE streaming），实时展示生成过程
- [ ] **AIED-05**: 信息恢复节点之前的编辑可使用在线模型；之后的编辑仅可使用本地/私有模型（安全约束）
- [ ] **AIED-06**: 用户可选择用于 AI 编辑的模型（模型列表根据安全约束自动过滤）

### Tech Debt 修复

- [x] **DEBT-01**: 文档类型删除时检查关联文档，有关联则阻止删除并提示（DTYPE-04 守卫）

## v2 Requirements (Deferred)

### 配额管理

- **QUOT-01**: 按用户设置日/月调用次数和 Token 限制
- **QUOT-02**: 超限处理策略（警告/阻止/允许+提醒）
- **QUOT-03**: 按部门/项目分层配额

### 增强功能

- **RECV-03**: 支持取消正在进行的 AI 生成任务
- **ENHC-03**: 文档评论与行内批注
- **ENHC-04**: 从已有文档导入创建
- **ENHC-05**: 从历史版本复制创建
- **ENHC-08**: Excel 导出格式支持
- 模型调用改为 API 直接调用（替代 CLI）
- 脱敏映射加密存储

## Out of Scope

| Feature | Reason |
|---------|--------|
| 实时协同编辑 | 业务规则明确单人编辑，CRDT/OT 复杂度过高 |
| 自定义分析仪表盘 | 内部工具，固定布局即可 |
| Copilot 式自动补全 | 高延迟打断写作流，选中触发更可控 |
| Email/SMS 通知 | 全员企微，无需额外渠道 |
| 统计导出 Excel/PDF | 先做在线面板，后续按需求加 |
| Elasticsearch | 用户规模不需要，PostgreSQL pg_trgm 足够 |
| 按 Token 计费/部门结算 | 内部工具，展示成本即可，不做真实计费 |
| AI 编辑侧边栏/聊天面板 | 研究表明内联编辑是主流模式 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01 | Phase 17 | Complete |
| BGND-01 | Phase 18 | Complete |
| BGND-02 | Phase 18 | Pending |
| BGND-03 | Phase 18 | Pending |
| BGND-04 | Phase 18 | Pending |
| BGND-05 | Phase 18 | Pending |
| BGND-06 | Phase 18 | Complete |
| STAT-01 | Phase 19 | Pending |
| STAT-02 | Phase 19 | Pending |
| STAT-03 | Phase 19 | Pending |
| STAT-04 | Phase 19 | Pending |
| STAT-05 | Phase 19 | Pending |
| STAT-06 | Phase 19 | Pending |
| STAT-07 | Phase 19 | Pending |
| SRCH-01 | Phase 20 | Pending |
| SRCH-02 | Phase 20 | Pending |
| SRCH-03 | Phase 20 | Pending |
| SRCH-04 | Phase 20 | Pending |
| SRCH-05 | Phase 20 | Pending |
| AIED-01 | Phase 21 | Pending |
| AIED-02 | Phase 21 | Pending |
| AIED-03 | Phase 21 | Pending |
| AIED-04 | Phase 21 | Pending |
| AIED-05 | Phase 21 | Pending |
| AIED-06 | Phase 21 | Pending |

**Coverage:**
- v1.1 requirements: 25 total
- Mapped to phases: 25/25
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
