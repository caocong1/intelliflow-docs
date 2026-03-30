#!/bin/bash
# PPT 导出功能分步实施脚本
# 每步使用独立的 claude -p 会话，天然清除上下文
# 用法: bash scripts/implement-ppt-export.sh [step_number]
#   不传参数 = 从头执行全部步骤
#   传参数 N = 只执行第 N 步

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESIGN_DOC="docs/design/ppt-export-design.md"
LOG_DIR="$PROJECT_ROOT/.ppt-export-impl"
mkdir -p "$LOG_DIR"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TOTAL_STEPS=7
STEP_START=${1:-1}
STEP_END=${2:-$TOTAL_STEPS}

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')] Step $1/$TOTAL_STEPS: $2${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] $1${NC}"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] FAILED: $1${NC}"; exit 1; }

run_step() {
  local step=$1
  local desc=$2
  local prompt=$3
  local logfile="$LOG_DIR/step-${step}.log"

  log "$step" "$desc"
  echo "--- Step $step: $desc ---" >> "$LOG_DIR/summary.log"
  echo "Started: $(date)" >> "$LOG_DIR/summary.log"

  if claude -p "$prompt" --output-format text > "$logfile" 2>&1; then
    echo -e "${GREEN}  ✓ Step $step completed${NC}"
    echo "Status: SUCCESS" >> "$LOG_DIR/summary.log"
  else
    echo -e "${RED}  ✗ Step $step failed — see $logfile${NC}"
    echo "Status: FAILED" >> "$LOG_DIR/summary.log"
    echo "Ended: $(date)" >> "$LOG_DIR/summary.log"
    echo "" >> "$LOG_DIR/summary.log"
    return 1
  fi

  echo "Ended: $(date)" >> "$LOG_DIR/summary.log"
  echo "" >> "$LOG_DIR/summary.log"
}

echo "=========================================="
echo " PPT Export Implementation"
echo " Design: $DESIGN_DOC"
echo " Steps: $STEP_START → $STEP_END"
echo " Logs: $LOG_DIR/"
echo "=========================================="
echo ""
echo "Implementation started: $(date)" > "$LOG_DIR/summary.log"
echo "" >> "$LOG_DIR/summary.log"

# ─────────────────────────────────────────────────────────────────────
# Step 1: Phase 0 — 前置 Bug 修复
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 1 ] && [ "$STEP_END" -ge 1 ]; then
run_step 1 "Phase 0: 修复 background.service.ts export dispatch bug" "
你在 $PROJECT_ROOT 工作。

读取 $DESIGN_DOC 的第八节（分阶段实施计划）中 Phase 0 的内容。

任务：修复 background.service.ts 中的 export dispatch bug。

具体操作：
1. 读取 packages/backend/src/modules/runtime/background.service.ts
2. 找到 switch case 中的 \"file_export\" 字符串，改为 \"export\" 以对齐 shared/types.ts 中 WorkflowNodeType 的枚举定义
3. 确认修改正确
4. 用 git 提交这个修复，commit message: 'fix(runtime): align export node type in background service dispatch'

只做这一个修改，不要动其他文件。
"
fi

# ─────────────────────────────────────────────────────────────────────
# Step 2: Phase 1a — 安装依赖 + 扩展类型定义
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 2 ] && [ "$STEP_END" -ge 2 ]; then
run_step 2 "Phase 1a: 安装 pptxgenjs + 扩展 ExportConfig 类型" "
你在 $PROJECT_ROOT 工作。

读取 $DESIGN_DOC 的第三节（架构决策）中 3.3 ExportConfig 类型变更的内容。

任务：安装 PPT 生成依赖并扩展类型定义。

具体操作：
1. 在 packages/backend 目录执行 bun add pptxgenjs
2. 读取 packages/shared/src/types.ts，找到 ExportConfig interface
3. 修改 formats 的类型，新增 \"pptx\" 选项：Array<\"word\" | \"pdf\" | \"markdown\" | \"pptx\">
4. 将 templateId 标记为 @deprecated，新增 templateBindings 字段：
   templateBindings?: Partial<Record<\"word\" | \"pdf\" | \"pptx\", string>>;
5. 读取 export.routes.ts，在 format 的 body 校验中新增 t.Literal(\"pptx\")
6. 用 git 提交，commit message: 'feat(export): add pptx format type and templateBindings to ExportConfig'

不要修改其他文件，不要实现生成逻辑。
"
fi

# ─────────────────────────────────────────────────────────────────────
# Step 3: Phase 1b — 后端 PPT 生成核心逻辑
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 3 ] && [ "$STEP_END" -ge 3 ]; then
run_step 3 "Phase 1b: 实现 generatePptBuffer() 后端核心逻辑" "
你在 $PROJECT_ROOT 工作。

读取 $DESIGN_DOC 的第四节（Slide Schema 与约束规则）和第五节（Markdown → PPT 转换策略）。

任务：在 export.service.ts 中实现 PPT 生成。

具体操作：
1. 读取 packages/backend/src/modules/runtime/export.service.ts，理解现有的 generateWordBuffer 和 generatePdfBuffer 实现模式
2. 在文件中新增以下内容：
   a. 引入 pptxgenjs：import PptxGenJS from 'pptxgenjs'
   b. 定义 SlidePresentation 接口和各种 slide 类型（TitleSlide, ContentSlide, TwoColumnSlide, TableSlide 等），参考设计文档第四节的定义
   c. 实现 markdownToSlides(content: string): Slide[] 函数（路径 B：Markdown 自动分页）：
      - # H1 → TitleSlide
      - ## H2 → 新 ContentSlide 分页
      - ### H3 → 加粗 bullet
      - - 或 * → bullets
      - |表格| → TableSlide
      - \`\`\` 代码块 → 等宽字体文本框
      - --- → 强制分页
      - 普通段落 → ContentSlide bullets
      - 单页 bullets 超过 8 项自动拆页，第 2 页标题加 \"(续)\"
      - 表格超 6 列拆多表、超 8 行拆多页
   d. 实现 tryParseSlideJson(content: string): SlidePresentation | null 函数（路径 A 入口）：
      - JSON.parse 尝试，失败返回 null
      - 检查是否有 slides 数组且每项有 layout 字段，否则返回 null
      - 后续 Phase 3 再加 ajv schema 校验
   e. 实现 renderSlidesToPptx(slides: Slide[]): Promise<Buffer> 函数：
      - 创建 PptxGenJS 实例，设置 16:9 比例
      - 定义默认主题颜色和字体（微软雅黑为主，参考设计文档 theme.json）
      - 遍历 slides，按 layout 类型分别创建幻灯片
      - 处理溢出：标题截断+…、bullet 超长用 autoFit、字体回退链
      - 返回 Buffer
   f. 实现 generatePptBuffer(content: string): Promise<Buffer>：
      - 先尝试路径 A（tryParseSlideJson），成功则用结构化 slides
      - 否则用路径 B（markdownToSlides）
      - 调用 renderSlidesToPptx 生成最终 Buffer
   g. 在 generateExport() 函数的 switch(format) 中新增 case \"pptx\"
   h. 在 downloadExport() 中新增 pptx 的 mimeType 映射
3. 用 git 提交，commit message: 'feat(export): implement PPT generation with markdown auto-pagination'

保持代码风格与现有 generateWordBuffer/generatePdfBuffer 一致。注意中文字体支持。
"
fi

# ─────────────────────────────────────────────────────────────────────
# Step 4: Phase 1c — 前端变更
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 4 ] && [ "$STEP_END" -ge 4 ]; then
run_step 4 "Phase 1c: 前端新增 PPT 格式选项" "
你在 $PROJECT_ROOT 工作。

读取 $DESIGN_DOC 的第三节 3.3 中关于前端变更的说明。

任务：前端 Export 配置和执行器支持 PPT 格式。

具体操作：
1. 读取 packages/frontend/src/components/workflow/config/ExportConfig.tsx
   - 在 FORMAT_OPTIONS 数组中新增 PPT 选项：{ value: \"pptx\", label: \"PPT\", desc: \".pptx 格式，适合演示汇报\" }
   - ExportFormat 类型新增 \"pptx\"

2. 读取 packages/frontend/src/components/workspace/nodes/ExportExecutor.tsx
   - 确认导出格式下拉/选择器已经从 config.formats 动态生成（应该已经是）
   - 确认 pptx 格式能正常触发后端 generate 接口
   - 如果有 mimeType 或文件扩展名的硬编码映射，新增 pptx 对应项

3. 读取 packages/frontend/src/components/workspace/completed/ExportCompleted.tsx
   - 如果有格式展示的映射，新增 pptx 的显示标签

4. 读取 packages/frontend/src/lib/format-utils.ts
   - 如果有文件格式相关的 helper 函数，确保支持 pptx

5. 用 git 提交，commit message: 'feat(ui): add PPT format option to export node configuration and executor'

只修改与 PPT 格式选项相关的内容，不要改样式或布局。
"
fi

# ─────────────────────────────────────────────────────────────────────
# Step 5: Phase 1d — 后端单元测试
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 5 ] && [ "$STEP_END" -ge 5 ]; then
run_step 5 "Phase 1d: PPT 生成单元测试" "
你在 $PROJECT_ROOT 工作。

任务：为 PPT 生成逻辑编写单元测试。

具体操作：
1. 读取 packages/backend/src/modules/runtime/export.service.ts 中新增的 PPT 相关函数
2. 读取 packages/frontend/src/lib/format-utils.test.ts 了解项目测试风格（使用 bun:test）
3. 在 packages/backend/src/modules/runtime/ 目录创建 export-ppt.test.ts，测试内容：

   a. markdownToSlides 测试：
      - 基础 H1 标题页生成
      - H2 分页
      - bullets 列表
      - 表格转 TableSlide
      - 代码块处理
      - --- 强制分页
      - 超过 8 个 bullet 自动拆页
      - 表格超 8 行自动拆页
      - 空内容处理
      - 混合内容（标题+列表+表格+代码块）

   b. tryParseSlideJson 测试：
      - 合法 SlidePresentation JSON → 返回对象
      - 非 JSON 字符串 → 返回 null
      - JSON 但无 slides 字段 → 返回 null
      - JSON 有 slides 但项无 layout → 返回 null

   c. generatePptBuffer 集成测试：
      - Markdown 输入 → 生成非空 Buffer
      - JSON slide 输入 → 生成非空 Buffer
      - 验证输出是合法的 PPTX（ZIP 格式，解压后含 [Content_Types].xml）

4. 运行 bun test packages/backend/src/modules/runtime/export-ppt.test.ts 确保全部通过
5. 用 git 提交，commit message: 'test(export): add unit tests for PPT generation and markdown-to-slides conversion'
"
fi

# ─────────────────────────────────────────────────────────────────────
# Step 6: Playwright MCP E2E 测试
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 6 ] && [ "$STEP_END" -ge 6 ]; then
run_step 6 "E2E: 使用 Playwright MCP 插件测试 PPT 导出流程" "
你在 $PROJECT_ROOT 工作。

任务：使用 Claude Code 内置的 Playwright MCP 插件（mcp__plugin_playwright_playwright__* 工具）直接操控浏览器，模拟真实用户操作测试 PPT 导出功能。不需要安装任何 Playwright 包。

重要前提：
- 前端运行在 http://localhost:4000
- 后端运行在 http://localhost:14001
- 前端通过 Vite proxy /api → 后端
- 开发环境应该已经启动（如果没有，先用 Bash 在后台启动 bun run dev）
- 直接调用 mcp__plugin_playwright_playwright__browser_* 系列工具操作浏览器

测试执行步骤：

===== 测试 1: 登录系统 =====
- 使用 browser_navigate 打开 http://localhost:4000
- 使用 browser_snapshot 查看页面状态
- 如果需要登录，使用 browser_fill / browser_click 完成登录流程
- 使用 browser_snapshot 确认进入主界面

===== 测试 2: PPT 格式在 Export 节点配置中可见 =====
- 导航到管理后台的工作流编辑器（找一个现有的工作流或文档类型）
- 使用 browser_snapshot 查看当前页面
- 找到并点击一个 export 节点打开其配置面板
- 使用 browser_snapshot 截图确认配置面板已打开
- 验证「PPT」格式选项存在（.pptx 格式，适合演示汇报）
- 勾选 PPT 选项，使用 browser_snapshot 确认勾选成功
- 使用 browser_take_screenshot 保存截图到 $PROJECT_ROOT/.ppt-export-impl/e2e-screenshots/test2-export-config.png

===== 测试 3: PPT 导出 API 功能测试 =====
- 使用 browser_evaluate 在浏览器中直接调用后端 API：
  fetch('/api/runtime/{documentId}/export/{nodeExecutionId}/preview')
  验证 preview 接口返回正常
- 使用 browser_evaluate 调用导出生成 API：
  fetch('/api/runtime/{documentId}/export/{nodeExecutionId}/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer {token}' },
    body: JSON.stringify({ format: 'pptx', filename: 'test-export.pptx' })
  })
  验证返回包含 format: 'pptx' 和 fileSize > 0
- 注意：documentId 和 nodeExecutionId 需要先通过页面交互或 API 查找一个真实存在的已完成流程

===== 测试 4: 通过 UI 完成 PPT 导出（如果找到可导出的文档）=====
- 导航到一个已完成执行的文档工作空间
- 找到 export 节点
- 如果有格式选择，选择 PPT 格式
- 点击导出/下载按钮
- 使用 browser_take_screenshot 保存截图

===== 测试结果记录 =====
将测试结果写入 $PROJECT_ROOT/.ppt-export-impl/e2e-results.md：

# E2E 测试结果

## 测试环境
- 日期: [当前日期时间]
- 前端: http://localhost:4000
- 后端: http://localhost:14001

## 测试结果
| # | 测试场景 | 状态 | 截图 | 说明 |
|---|----------|------|------|------|
| 1 | 系统登录 | ✅/❌ | - | ... |
| 2 | Export 配置面板 PPT 选项 | ✅/❌ | test2-*.png | ... |
| 3 | PPT 导出 API 调用 | ✅/❌ | - | ... |
| 4 | UI 完成 PPT 导出 | ✅/❌/⏭️ | test4-*.png | ... |

## 发现的问题
[列出测试中遇到的任何问题]

注意：
- 如果开发服务器未运行，先记录为 ⏭️ 跳过，并在报告中说明原因
- 如果登录失败，后续测试都标记为 ⏭️ 跳过
- 截图保存到 .ppt-export-impl/e2e-screenshots/ 目录
- 每一步都用 browser_snapshot 观察页面状态再决定下一步操作
- 不要 git commit 测试结果，这些是运行时产物
"
fi

# ─────────────────────────────────────────────────────────────────────
# Step 7: 生成测试报告
# ─────────────────────────────────────────────────────────────────────
if [ "$STEP_START" -le 7 ] && [ "$STEP_END" -ge 7 ]; then
run_step 7 "生成最终测试报告" "
你在 $PROJECT_ROOT 工作。

任务：运行后端单元测试，读取 E2E 测试结果，生成最终测试报告。

具体操作：
1. 运行后端单元测试：
   bun test packages/backend/src/modules/runtime/export-ppt.test.ts
   记录输出结果（通过/失败/用例数/耗时）

2. 读取 .ppt-export-impl/e2e-results.md（Step 6 用 Playwright MCP 插件产出的 E2E 测试结果）
   如果文件不存在，在报告中标注 E2E 未执行

3. 查看 .ppt-export-impl/e2e-screenshots/ 目录下的截图文件列表

4. 创建 docs/design/ppt-export-test-report.md 测试报告：

# PPT 导出功能 — 测试报告

## 概述
- 测试日期: [当前日期]
- 实施版本: Phase 1 基础 PPT 生成
- 测试范围: 后端单元测试 + Playwright MCP E2E 测试

## 单元测试结果
| 测试套件 | 用例数 | 通过 | 失败 | 耗时 |
|----------|--------|------|------|------|
| markdownToSlides | N | N | 0 | Xms |
| tryParseSlideJson | N | N | 0 | Xms |
| generatePptBuffer | N | N | 0 | Xms |

### 测试用例明细
[从 bun test 输出中提取每个用例名称和结果]

## E2E 测试结果（Playwright MCP）
[从 .ppt-export-impl/e2e-results.md 中提取结果表格]

| # | 测试场景 | 状态 | 说明 |
|---|----------|------|------|
| 1 | 系统登录 | ✅/❌/⏭️ | ... |
| 2 | Export 配置 PPT 选项 | ✅/❌/⏭️ | ... |
| 3 | PPT 导出 API | ✅/❌/⏭️ | ... |
| 4 | UI PPT 导出 | ✅/❌/⏭️ | ... |

### E2E 截图
[列出 e2e-screenshots/ 下的文件]

## 兼容性测试（手动）
| 软件 | 状态 | 说明 |
|------|------|------|
| Microsoft PowerPoint | ⏳ 待测 | |
| WPS | ⏳ 待测 | |
| LibreOffice Impress | ⏳ 待测 | |

## 已知问题
[合并单元测试和 E2E 中发现的问题]

## 结论与下一步
- Phase 0 + Phase 1 完成情况
- 测试通过率
- 下一步：Phase 2 模板系统

5. 用 git 提交，commit message: 'docs: add PPT export test report'

6. 输出最终总结
"
fi

# ─────────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo " All steps completed!"
echo " Logs: $LOG_DIR/"
echo " Summary: $LOG_DIR/summary.log"
echo "=========================================="
cat "$LOG_DIR/summary.log"
