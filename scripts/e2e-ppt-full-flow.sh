#!/bin/bash
# PPT 导出完整 E2E 测试
# 模拟用户完整流程：创建流程→创建文档→填写输入→AI生成→导出PPT→下载验证
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.ppt-export-impl/e2e-full-flow"
mkdir -p "$LOG_DIR"

echo "==========================================="
echo " PPT 导出完整 E2E 测试"
echo "==========================================="

claude -p "
你在 $PROJECT_ROOT 工作。

任务：使用 Playwright MCP 插件完成 PPT 导出的完整用户流程测试。每步操作后都用 browser_snapshot 确认状态再进行下一步。遇到问题截图记录但继续推进。

前提：
- 前端: http://localhost:4000，后端: http://localhost:14001
- 使用 mcp__plugin_playwright_playwright__browser_* 系列工具
- 测试结束后将结果写入 $LOG_DIR/result.md

完整测试步骤：

===== 第1步：登录系统 =====
- browser_navigate 到 http://localhost:4000
- 确认已登录（看到侧栏导航）

===== 第2步：创建PPT专用测试流程 =====
- 导航到流程管理 (/admin/workflows)
- 点击「新建流程」
- 选择文档类型「标书」
- 流程名称填「PPT导出完整E2E测试」
- 创建后进入编辑器
- 拖拽添加3个节点：输入转换 → 模型调用 → 文件导出
- 配置输入转换：添加一个文本字段「主题」（machineKey: topic）
- 配置模型调用：选择一个可用模型（Qwen3 32B），提示词填：
  请根据主题生成一份简短的PPT内容，包含标题和3个要点，使用Markdown格式。主题：{{n1.topic}}
- 配置文件导出：勾选 PPT 和 Word 格式，并配置 contentMapping 引用模型调用的输出
- 保存流程
- 截图保存到 $LOG_DIR/step2-workflow.png

===== 第3步：创建文档并填写输入 =====
- 导航到项目列表 (/projects)
- 进入「test」项目
- 点击「新建文档」
- 选择文档类型「标书」，选择刚创建的流程「PPT导出完整E2E测试」
- 标题填「PPT导出E2E验证」
- 创建文档
- 系统跳转到文档工作空间，显示第一步（输入转换）
- 在「主题」字段输入：人工智能在企业中的应用
- 点击「确认，下一步」
- 截图保存到 $LOG_DIR/step3-input.png

===== 第4步：等待AI模型生成 =====
- 进入模型调用节点
- 等待AI模型生成完成（可能需要30-60秒）
- 如果看到流式输出，等待「完成」状态
- 如果出错，截图记录并尝试重试
- 生成完成后，点击「确认，下一步」或者直接选择一个模型的输出
- 截图保存到 $LOG_DIR/step4-model.png

===== 第5步：PPT导出 =====
- 到达文件导出节点
- 页面应显示导出格式选择
- 选择「PPT 演示文稿」格式
- 输入文件名「AI企业应用方案」
- 点击「下载文件」
- 等待导出完成
- 截图保存到 $LOG_DIR/step5-export.png
- 如果下载触发了，记录成功

===== 第6步：验证导出文件 =====
- 如果可以，检查下载的 .pptx 文件（通过 API 调用下载接口并保存）
- 用 browser_evaluate 调用下载 API 获取文件信息
- 验证 content-type 是 pptx MIME 类型
- 验证文件大小 > 0

===== 第7步：清理（可选）=====
- 如果时间允许，删除测试流程
- 截图保存

===== 结果记录 =====
将完整结果写入 $LOG_DIR/result.md：

# PPT 导出完整 E2E 测试报告

## 测试日期
[当前日期时间]

## 测试步骤结果
| # | 步骤 | 状态 | 说明 |
|---|------|------|------|
| 1 | 登录 | ✅/❌ | ... |
| 2 | 创建流程 | ✅/❌ | ... |
| 3 | 创建文档+填写输入 | ✅/❌ | ... |
| 4 | AI模型生成 | ✅/❌ | ... |
| 5 | PPT导出 | ✅/❌ | ... |
| 6 | 文件验证 | ✅/❌ | ... |
| 7 | 清理 | ✅/⏭️ | ... |

## 截图列表
[列出所有截图文件]

## 发现的问题
[详细列出测试中遇到的所有问题]

## 结论
[总结 PPT 导出功能是否端到端可用]

注意事项：
- 每步操作后一定用 browser_snapshot 看页面状态再决定下一步
- 遇到弹窗/loading/自动刷新等要适当等待
- AI模型生成可能需要较长时间，用 browser_wait_for 等待完成状态
- 如果某步失败，记录截图后继续尝试后续步骤
- 不要修改任何源代码
" --output-format text > "$LOG_DIR/execution.log" 2>&1

echo ""
echo "==========================================="
echo " 测试完成！"
echo " 结果: $LOG_DIR/result.md"
echo " 日志: $LOG_DIR/execution.log"
echo "==========================================="

if [ -f "$LOG_DIR/result.md" ]; then
  echo ""
  cat "$LOG_DIR/result.md"
fi
