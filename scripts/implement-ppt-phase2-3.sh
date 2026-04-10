#!/bin/bash
# PPT 导出 Phase 2-3 实施脚本
# Phase 2: 模板系统 | Phase 3: 结构化幻灯片输出
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESIGN_DOC="docs/design/ppt-export-design.md"
LOG_DIR="$PROJECT_ROOT/.ppt-export-impl/phase2-3"
mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TOTAL_STEPS=6
STEP_START=${1:-1}
STEP_END=${2:-$TOTAL_STEPS}

run_step() {
  local step=$1
  local desc=$2
  local prompt=$3
  local logfile="$LOG_DIR/step-${step}.log"

  echo -e "${GREEN}[$(date '+%H:%M:%S')] Step $step/$TOTAL_STEPS: $desc${NC}"
  echo "--- Step $step: $desc --- Started: $(date)" >> "$LOG_DIR/summary.log"

  if claude -p "$prompt" --output-format text > "$logfile" 2>&1; then
    echo -e "${GREEN}  ✓ Step $step completed${NC}"
    echo "Status: SUCCESS — Ended: $(date)" >> "$LOG_DIR/summary.log"
  else
    echo -e "${RED}  ✗ Step $step failed — see $logfile${NC}"
    echo "Status: FAILED — Ended: $(date)" >> "$LOG_DIR/summary.log"
    return 1
  fi
  echo "" >> "$LOG_DIR/summary.log"
}

echo "==========================================="
echo " PPT Export Phase 2-3 Implementation"
echo " Steps: $STEP_START → $STEP_END"
echo " Logs: $LOG_DIR/"
echo "==========================================="
echo "Started: $(date)" > "$LOG_DIR/summary.log"
echo "" >> "$LOG_DIR/summary.log"

# ─── Step 1: Phase 2a — DB schema for ppt_templates ─────────────────────────
if [ "$STEP_START" -le 1 ] && [ "$STEP_END" -ge 1 ]; then
run_step 1 "Phase 2a: ppt_templates DB schema + service" "
你在 $PROJECT_ROOT 工作。读取 $DESIGN_DOC 第六节模板系统设计。

任务：创建 PPT 模板的数据库表和 CRUD 服务。

操作：
1. 读取 packages/backend/src/db/schema.ts 了解现有表定义模式
2. 在 schema.ts 末尾新增 pptTemplates 表：
   - id: uuid PK
   - name: varchar(100) notNull
   - description: varchar(500)
   - type: varchar(20) notNull — 'code_theme' 或 'native_pptx'
   - aspectRatio: varchar(10) default '16:9'
   - themeConfig: jsonb — 代码主题的 theme.json 内容
   - templateFilePath: varchar(500) — 原生模板文件路径
   - availableLayouts: jsonb — 解析缓存（字符串数组）
   - isActive: boolean default true
   - isDefault: boolean default false
   - createdBy: uuid references users(id)
   - createdAt, updatedAt: timestamp

3. 创建 packages/backend/src/modules/ppt-templates/ppt-templates.service.ts：
   - listTemplates(page, limit, type?) — 分页查询
   - getTemplate(id) — 单个查询
   - createTemplate(data) — 创建
   - updateTemplate(id, data) — 更新
   - deleteTemplate(id) — 删除
   - getDefaultTemplate() — 获取默认模板
   - setDefault(id) — 设为默认

4. 创建 packages/backend/src/modules/ppt-templates/ppt-templates.routes.ts：
   - GET /api/ppt-templates — 列表
   - GET /api/ppt-templates/:id — 详情
   - POST /api/ppt-templates — 创建
   - PUT /api/ppt-templates/:id — 更新
   - DELETE /api/ppt-templates/:id — 删除
   - POST /api/ppt-templates/:id/set-default — 设为默认
   全部需要 requireAuth 和管理员权限

5. 在 packages/backend/src/index.ts 中注册路由

6. 运行 bun run db:push 推送 schema 到数据库

7. git commit: 'feat(templates): add ppt_templates schema, service, and routes'
"
fi

# ─── Step 2: Phase 2b — pptx-automizer + template validation ────────────────
if [ "$STEP_START" -le 2 ] && [ "$STEP_END" -ge 2 ]; then
run_step 2 "Phase 2b: pptx-automizer + 模板校验" "
你在 $PROJECT_ROOT 工作。读取 $DESIGN_DOC 第六节 6.3（原生 .pptx 模板契约）。

任务：安装 pptx-automizer，实现模板文件上传和校验逻辑。

操作：
1. cd packages/backend && bun add pptx-automizer

2. 读取现有的文件上传处理方式（看 packages/backend/src/modules/files/ 目录）

3. 在 ppt-templates.service.ts 中新增：
   a. uploadTemplate(file: File, name, description, createdBy) 函数：
      - 保存 .pptx 文件到 uploads/ppt-templates/ 目录
      - 使用 pptx-automizer 解析 .pptx：
        * 提取 Slide Layout 名称列表
        * 扫描占位符文本框匹配 {{XXX}} 命名
      - 校验：至少有含 {{TITLE}} 的 layout，至少有含 {{BODY}} 的 layout
      - 无任何占位符 → 抛错拒绝
      - 将校验结果（availableLayouts）存入 DB
      - 创建 type='native_pptx' 的模板记录
   b. validateThemeConfig(config: unknown) 函数：
      - 校验 colors 是合法 hex
      - 校验 aspectRatio 是 16:9 或 4:3
      - 校验 layouts 的 key 是合法 layout 类型

4. 在 ppt-templates.routes.ts 新增：
   - POST /api/ppt-templates/upload — 文件上传（multipart/form-data）
   - POST /api/ppt-templates/create-theme — 创建代码主题（JSON body）

5. git commit: 'feat(templates): add pptx-automizer template upload and validation'

注意：如果 pptx-automizer 的 API 用法不确定，先实现基础的文件保存+占位符扫描，automizer 解析部分可以用 try-catch 包裹并在失败时 fallback 为只保存文件。
"
fi

# ─── Step 3: Phase 2c — Admin template management page ──────────────────────
if [ "$STEP_START" -le 3 ] && [ "$STEP_END" -ge 3 ]; then
run_step 3 "Phase 2c: 管理后台模板管理页面" "
你在 $PROJECT_ROOT 工作。

任务：创建管理后台的 PPT 模板管理页面。

操作：
1. 读取现有管理页面了解 UI 风格（如 packages/frontend/src/pages/admin/ModelConfiguration.tsx 或 DocumentTypeManagement.tsx）

2. 创建 packages/frontend/src/pages/admin/PptTemplateManagement.tsx：
   - 页面标题：PPT 模板管理
   - 模板列表表格：名称、类型（代码主题/原生模板）、比例、状态、默认、创建时间、操作
   - 新建代码主题按钮 → 弹窗表单（name, description, aspectRatio, colors JSON editor）
   - 上传原生模板按钮 → 文件上传 + 名称描述
   - 操作：编辑、启用/停用、设为默认、删除
   - 使用与其他管理页面一致的 UI 风格

3. 创建 packages/frontend/src/lib/api/ppt-templates.ts：
   - API 调用封装（list, get, create, update, delete, upload, setDefault）

4. 在 packages/frontend/src/App.tsx 中添加路由 /admin/ppt-templates

5. 在 packages/frontend/src/components/nav/Sidebar.tsx 管理区域添加 'PPT 模板' 导航项

6. git commit: 'feat(ui): add PPT template management admin page'

保持与现有管理页面一致的设计风格，使用相同的表格、按钮、弹窗组件模式。
"
fi

# ─── Step 4: Phase 2d — Export node template integration ────────────────────
if [ "$STEP_START" -le 4 ] && [ "$STEP_END" -ge 4 ]; then
run_step 4 "Phase 2d: Export 节点模板集成" "
你在 $PROJECT_ROOT 工作。读取 $DESIGN_DOC 第三节 3.3 的 templateBindings 设计。

任务：将 PPT 模板集成到 Export 节点的配置和运行时。

操作：
1. 读取 packages/frontend/src/components/workflow/config/ExportConfig.tsx
   - 当 formats 包含 'pptx' 时，在模板区域新增 'PPT 模板' 下拉
   - 下拉数据从 /api/ppt-templates?isActive=true 加载
   - 选择后存入 config.templateBindings.pptx = templateId
   - Word/PDF 模板保持原有 templateId 字段（兼容）

2. 读取 packages/backend/src/modules/runtime/export.service.ts
   - 修改 generateExport() 或 generatePptBuffer()：
     * 从 config.templateBindings?.pptx 或 config.templateId 获取 templateId
     * 如果有 templateId，从 ppt_templates 表加载模板
     * code_theme 类型：用 themeConfig 中的颜色/字体覆盖 PPT_THEME 默认值
     * native_pptx 类型：使用 pptx-automizer 加载模板文件，按占位符替换内容
     * 加载失败 → 回退到默认主题 + 记录警告日志
   - 保持 generatePptBuffer 的签名兼容，新增可选 templateId 参数

3. git commit: 'feat(export): integrate PPT templates into export node config and runtime'
"
fi

# ─── Step 5: Phase 3a — JSON Schema validation gate ─────────────────────────
if [ "$STEP_START" -le 5 ] && [ "$STEP_END" -ge 5 ]; then
run_step 5 "Phase 3: 结构化幻灯片 JSON Schema + ajv 校验" "
你在 $PROJECT_ROOT 工作。读取 $DESIGN_DOC 第四节 Slide Schema 和第五节 5.2 路径选择逻辑。

任务：实现 Path A 的 JSON Schema 校验闸门，让 AI 输出的结构化幻灯片 JSON 可以直接渲染为 PPT。

操作：
1. 后端已安装 ajv（package.json 确认）

2. 在 packages/backend/src/modules/runtime/ 创建 slide-schema.ts：
   - 定义 SlidePresentation 的 JSON Schema（ajv 格式）
   - 包含所有 layout 类型的约束（title max 60 chars、bullets max 8 items 等）
   - 导出 validateSlidePresentation(data: unknown): { valid: boolean; errors?: string[] }

3. 修改 export.service.ts 的 tryParseSlideJson()：
   - JSON.parse 成功后，调用 validateSlidePresentation() 进行 schema 校验
   - 校验通过 → 返回 SlidePresentation 对象（路径 A）
   - 校验失败 → 返回 null（降级到路径 B）
   - 校验失败时在 console.warn 记录警告

4. 在 packages/shared/src/ 创建 slide-schema.json（或 .ts）供前端参考：
   - 导出 SlidePresentation 的 TypeScript 类型（如果尚未在 types.ts 中）
   - 这个 schema 可以在模型调用节点配置中作为 JSON Schema 预设使用

5. git commit: 'feat(export): add ajv schema validation for structured slide JSON (Path A)'

6. 运行 bun test packages/backend/src/modules/runtime/export-ppt.test.ts 确认现有测试仍然通过
"
fi

# ─── Step 6: Final tests + report ───────────────────────────────────────────
if [ "$STEP_START" -le 6 ] && [ "$STEP_END" -ge 6 ]; then
run_step 6 "Final: 全量测试 + 更新测试报告" "
你在 $PROJECT_ROOT 工作。

任务：运行所有测试，使用 Playwright MCP 插件做 E2E 验证，更新测试报告。

操作：
1. 运行后端单元测试：bun test packages/backend/src/modules/runtime/export-ppt.test.ts
   记录结果

2. 验证前端构建：cd packages/frontend && bunx vite build
   记录结果

3. 使用 Playwright MCP 插件（mcp__plugin_playwright_playwright__browser_*）做 E2E 测试：
   a. 打开 http://localhost:4000 确认系统可访问
   b. 导航到流程管理，新建一个测试流程（选择任意文档类型）
   c. 拖拽添加：输入转换 → 模型调用 → 文件导出 三个节点
   d. 点击文件导出节点，验证 PPT 选项存在并可勾选
   e. 导航到管理后台侧栏，验证 PPT 模板管理入口存在
   f. 进入 PPT 模板管理页面，验证页面正常加载
   g. 每步截图到 .ppt-export-impl/e2e-screenshots/
   h. 测试完成后删除测试流程（清理）

4. 更新 docs/design/ppt-export-test-report.md，补充 Phase 2-3 测试结果

5. git commit: 'docs: update test report with Phase 2-3 results'
"
fi

echo ""
echo "==========================================="
echo " Phase 2-3 Implementation Complete!"
echo " Logs: $LOG_DIR/"
echo "==========================================="
cat "$LOG_DIR/summary.log"
