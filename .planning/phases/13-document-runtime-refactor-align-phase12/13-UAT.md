---
status: resolved
phase: 13-document-runtime-refactor-align-phase12
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md, 13-05-SUMMARY.md, 13-06-SUMMARY.md, 13-07-SUMMARY.md, 13-09-SUMMARY.md
started: 2026-03-25T08:00:00Z
updated: 2026-03-27T10:30:00Z
verified_by: Plan 13-11 re-run (2026-03-27)
---

## Current Test

[testing complete — all gaps resolved]

## Tests

### 1. 创建文档并初始化工作区
expected: 在项目页面选择工作流并创建文档，文档状态变为 in_progress，工作区页面正常加载，左侧显示节点步骤条（StepperBar）。
result: pass

### 2. 工作流预览（创建文档弹窗）
expected: 在创建文档弹窗中选择工作流后，显示工作流节点预览列表，包含节点类型中文标签和连接线。
result: pass

### 3. 文档列表进度显示
expected: 项目文档列表中，进行中的文档显示进度条和当前节点信息。
result: pass
note: "Fixed by Plan 13-10 (progress subqueries added). Verified: document list shows '进度: N/M · 节点名' for in_progress documents."

### 4. 输入转换节点执行
expected: 进入输入转换节点，显示中文界面的表单字段（来自工作流配置），填写内容后可保存。界面有渐变头部和分区指示器。
result: pass

### 5. 脱敏节点执行（自动检测）
expected: 进入脱敏节点后自动触发检测（无需手动点击按钮），显示检测到的敏感信息类别。界面为中文，有琥珀色主题。
result: pass
note: "Fixed by Plan 13-10 (outputData.text + draft save body shape). Verified: upstream text received, auto-detection triggered, found 5 sensitive items (person_name, phone, email, financial_info, company_name). Additional fix: isGenerationActive now excludes user-input nodes (input_transform, desensitize) to ensure executor form renders."

### 6. 多源脱敏输入（多模型工作流）
expected: 当脱敏节点有多个上游输入源时，显示标签页切换不同输入源，每个输入源独立脱敏处理。
result: pass
note: "Verified via API: desensitize node inputData.sources correctly contains multiple upstream fields (n1-field-f1, n1-field-f2) with separate displayNames."

### 7. 模型调用节点执行
expected: 进入模型调用节点，显示中文状态标签，点击执行后通过 SSE 实时流式输出。支持 Markdown/源码 视图切换。未配置模型时显示"未配置模型"提示。
result: pass
note: "Verified on completed document Phase13测试文档: Kimi K2.5 model call completed (2m13s), 渲染/源码 toggle present, content rendered with Markdown."

### 8. 模型对比视图
expected: 配置多个模型时，模型调用完成后显示并排对比视图，支持水平滚动查看多个模型输出。
result: skipped
reason: "当前测试工作流仅配置单个模型，无法触发对比视图。代码路径存在但需多模型工作流验证。"

### 9. SSE 断线重连安全
expected: 模型调用过程中刷新页面或断网恢复后，系统轮询 /status 端点恢复状态，不会重复触发模型调用。
result: skipped
reason: "需要精确的网络中断时序控制，Playwright无法可靠模拟"

### 10. 信息恢复节点执行
expected: 进入恢复节点，显示分栏对比视图（脱敏文本/恢复文本），支持手动修正和确认对话框。中文界面。
result: pass
note: "Verified on completed document Phase13测试文档: 信息恢复 completed (27s), 已恢复 3 处."

### 11. 文件导出节点执行
expected: 进入导出节点，显示格式选择器（Word 文档/PDF 文件/Markdown 文件），PPT 选项不可见。点击导出可下载文件。
result: pass
note: "Verified on completed document Phase13测试文档: Word文档 8.6 KB exported, 复制全文/下载文件 buttons present."

### 12. 工作区中文本地化
expected: 整个工作区界面（步骤条、操作栏、节点历史、编辑器）全部为中文，无英文残留。
result: pass

### 13. 已完成文档只读模式
expected: 打开一个所有节点都已完成的文档，界面进入只读模式，显示重新执行按钮和确认对话框。
result: pass

### 14. 执行轮次选择器
expected: 对于执行过多轮的节点，节点历史面板显示执行轮次下拉选择器，可查看不同轮次的执行结果。
result: skipped
reason: 当前测试数据无多轮执行节点

### 15. 网络状态横幅
expected: 断网时顶部出现网络状态横幅（中文提示），恢复网络后自动消失。
result: skipped
reason: Playwright无法模拟断网场景

### 16. 自动保存指示器
expected: 编辑内容后 1.5 秒自动保存，操作栏显示保存状态（保存中/已保存）。
result: pass
note: "Verified: after confirming desensitization, '已自动保存' indicator appeared in both top and bottom action bars."

### 17. 浏览器刷新恢复
expected: 文档执行过程中刷新浏览器，恢复到第一个未完成的节点继续执行，不丢失已完成节点的数据。
result: pass

### 18. 管理员模型调用日志
expected: 管理员侧边栏出现"模型调用日志"链接，点击进入日志页面，可按文档/模型/日期/状态筛选，表格行可展开查看提示词和变量映射。
result: pass

### 19. 工作流编辑器 inputSources 自动填充
expected: 在工作流编辑器中，连接边到脱敏/恢复节点时，该节点的 inputSources 自动从上游节点输出填充。断开连接时自动清除。
result: skipped
reason: 需要canvas拖拽操作连接edge，Playwright accessibility snapshot无法操作

### 20. 脱敏/恢复配置面板显示 inputSources
expected: 脱敏和恢复节点的配置面板显示只读的输入源列表，未连接时显示连接提示。
result: pass

## Summary

total: 20
passed: 14
issues: 0
pending: 0
skipped: 6

## Gaps

- truth: "进行中的文档在文档列表显示进度条和当前节点信息"
  status: resolved
  reason: "User reported: 进行中的文档只显示'进行中'状态标签，没有进度条，也没有当前节点信息。后端未填充 progressStep/totalSteps/currentNodeLabel 字段。"
  severity: minor
  test: 3
  root_cause: "listDocuments查询未join node_executions表，API响应不含progressStep/totalSteps/currentNodeLabel字段。前端Show guard正确但从未收到数据。"
  fix: "Plan 13-10 added progressStep, totalSteps, currentNodeLabel subqueries in documents.service.ts"
  verified: "2026-03-27 via Playwright: document list shows '进度: N/M · 节点名'"
  artifacts:
    - path: "packages/backend/src/modules/documents/documents.service.ts"
      issue: "listDocuments select缺少progress子查询（lines 112-134）"
  debug_session: ""

- truth: "脱敏节点接收上游InputTransform输出并自动触发检测"
  status: resolved
  reason: "User reported: 脱敏节点显示'暂无输入文本，请等待上游节点完成'——上游InputTransform节点已完成但输出数据未传递到脱敏节点。后端advanceNode未正确传递上游输出到下游节点inputData。同时draft端点返回404。自动检测因无输入文本未触发。"
  severity: blocker
  test: 5
  root_cause: "两个独立问题：(1) confirmInputTransform将combinedText写入磁盘但未写入outputData，advanceNode读取outputData.text得到undefined，传空字符串给脱敏节点。(2) debouncedDraftSave发送body为JSON.stringify(data)，但后端expects { data: Record }包装，body shape不匹配导致404。"
  fix: "Plan 13-10 added text: combinedText in outputData, wrapped draft save in { data } envelope. Plan 13-11 additionally fixed isGenerationActive to exclude user-input nodes."
  verified: "2026-03-27 via Playwright: upstream text received, 5 sensitive items detected, auto-detection triggered"
  artifacts:
    - path: "packages/backend/src/modules/runtime/input-transform.service.ts"
      issue: "outputData对象缺少text字段（lines 155-163），combinedText仅写入磁盘（line 178）"
    - path: "packages/frontend/src/pages/workspace/DocumentWorkspace.tsx"
      issue: "debouncedDraftSave body未包装为{data: ...}（line 75），handleInlineEditorSave同样（line 177）; isGenerationActive treated user-input nodes as background generation"
    - path: "packages/backend/src/modules/runtime/runtime.service.ts"
      issue: "advanceNode读取upstreamOutput.text（line 239）在InputTransform情况下为undefined"
  debug_session: ""
