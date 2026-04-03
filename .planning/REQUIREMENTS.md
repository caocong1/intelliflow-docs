# Requirements: IntelliFlow v1.3 Security & Contract Fix Sprint

**Defined:** 2026-04-03
**Core Value:** 用户能跑通完整流程生成高质量文档 — 安全加固确保生产环境无权限越权、路径穿越、XSS 注入风险

## v1.3 Requirements

Requirements for security & contract fix sprint. Each maps to roadmap phases.

### Permission Security

- [x] **PERM-01**: canEditDocument() 权限函数 — owner/creator 可写操作，普通成员仅只读
- [x] **PERM-02**: runtime.routes.ts 所有写端点改用 canEditDocument()（init、advance、rollback、skip、save draft、start-background）
- [x] **PERM-03**: 所有子路由写端点改用 canEditDocument()（desensitize、model-call、restore、inline-edit、input-transform）
- [x] **PERM-04**: export generate 端点改用 canEditDocument()
- [x] **PERM-05**: 只读端点保持 isDocumentProjectMember()

### File Security

- [ ] **FSEC-01**: sanitizeFilename() 工具函数 — basename + 去除 null bytes + 前导点号
- [ ] **FSEC-02**: assertWithinRoot() 工具函数 — resolve 后校验路径前缀
- [ ] **FSEC-03**: POST /files 忽略客户端 storagePath，服务端生成存储路径
- [ ] **FSEC-04**: POST /files 添加 isDocumentProjectMember() 权限校验
- [ ] **FSEC-05**: GET /files 添加 isDocumentProjectMember() 权限校验
- [ ] **FSEC-06**: input-transform.service.ts 写入前净化 file.name
- [ ] **FSEC-07**: export.service.ts 净化导出文件名参数
- [ ] **FSEC-08**: downloadExport 读取前校验 DB 中 storagePath 合法性

### XSS Defense

- [x] **XSS-01**: 安装 DOMPurify 并配置 allowlist（标签+属性白名单）
- [x] **XSS-02**: 新建 sanitizeHtml() 工具函数封装 DOMPurify
- [ ] **XSS-03**: render-markdown.tsx 6 处 innerHTML 包裹 sanitizeHtml()（CRITICAL）
- [ ] **XSS-04**: InlineEditor、ExportExecutor、PromptEditor innerHTML 包裹 sanitizeHtml()（defense-in-depth）

### TypeScript Quality

- [ ] **TSQL-01**: 扩展 client.ts typed wrappers 覆盖所有 runtime API 调用
- [ ] **TSQL-02**: DocumentWorkspace.tsx 8 处 `as any` 替换为 wrapper 调用
- [ ] **TSQL-03**: ExportExecutor.tsx 4 处 `as any` 替换为 wrapper 调用
- [ ] **TSQL-04**: VersionHistory.tsx 1 处 `as any` 替换为 wrapper 调用

### Contract Fixes

- [ ] **CONT-01**: shared types DocumentStatus 补齐 "failed"
- [ ] **CONT-02**: 后端 documents.service.ts filter 接受 status=failed
- [ ] **CONT-03**: InputSource.outputId + VariableRef.outputId 添加 JSDoc
- [ ] **CONT-04**: validation.ts 添加 outputId 比对逻辑注释

### Test Coverage

- [ ] **TEST-01**: sanitize.test.ts — 路径穿越、null bytes、正常文件名、assertWithinRoot 越界测试
- [ ] **TEST-02**: sanitize-html.test.ts — script 标签剥离、onerror 剥离、安全标签保留
- [ ] **TEST-03**: document-status.test.ts — "failed" 是合法 DocumentStatus、filter 接受 failed 参数

## Future Requirements

Deferred to v2+. Tracked but not in current roadmap.

### Security Hardening

- **SEC-01**: 文件上传类型白名单（MIME + 扩展名校验）
- **SEC-02**: 脱敏映射加密存储（v1.0 tech debt）
- **SEC-03**: Rate limiting for API endpoints

## Out of Scope

| Feature | Reason |
|---------|--------|
| RBAC 多角色体系（viewer/editor/admin per project） | v1.3 仅区分 owner/creator vs member；完整 RBAC 留到 v2 |
| CSP headers 配置 | 部署层面配置，非应用代码 |
| 文件上传类型白名单 | 有价值但非 critical，defer to v2 |
| SQL injection audit | Drizzle ORM parameterized queries，风险极低 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERM-01 | Phase 27 | Complete |
| PERM-02 | Phase 27 | Complete |
| PERM-03 | Phase 27 | Complete |
| PERM-04 | Phase 27 | Complete |
| PERM-05 | Phase 27 | Complete |
| FSEC-01 | Phase 28 | Pending |
| FSEC-02 | Phase 28 | Pending |
| FSEC-03 | Phase 28 | Pending |
| FSEC-04 | Phase 28 | Pending |
| FSEC-05 | Phase 28 | Pending |
| FSEC-06 | Phase 28 | Pending |
| FSEC-07 | Phase 28 | Pending |
| FSEC-08 | Phase 28 | Pending |
| XSS-01 | Phase 29 | Complete |
| XSS-02 | Phase 29 | Complete |
| XSS-03 | Phase 29 | Pending |
| XSS-04 | Phase 29 | Pending |
| TSQL-01 | Phase 30 | Pending |
| TSQL-02 | Phase 30 | Pending |
| TSQL-03 | Phase 30 | Pending |
| TSQL-04 | Phase 30 | Pending |
| CONT-01 | Phase 30 | Pending |
| CONT-02 | Phase 30 | Pending |
| CONT-03 | Phase 30 | Pending |
| CONT-04 | Phase 30 | Pending |
| TEST-01 | Phase 31 | Pending |
| TEST-02 | Phase 31 | Pending |
| TEST-03 | Phase 31 | Pending |

**Coverage:**
- v1.3 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation*
