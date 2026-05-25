# Phase 34: PPT SVG-Native Rendering Engine

## Goal
移植 hugohe3/ppt-master 的 SVG-to-DrawingML 引擎到 intelliflow-docs 项目内，作为新增 `svg_native` 生成模式，与现有 PptxGenJS 路径并行运行。

## Motivation
- 现有 PptxGenJS 生成的是程序化形状，视觉完成度有限（色块堆砌、无原生矢量图标）
- ppt-master 可将 SVG 转换为原生 PowerPoint DrawingML 形状，导出后可在 Office 中直接编辑文字和颜色
- 通过 AI 生成 SVG 再转 PPTX 的路径，能显著提升最终 PPT 的排版精度和视觉完成度

## Architecture Decision

### Python 子进程调用（已采纳）
- 将 ppt-master 的 `scripts/svg_to_pptx/` Python 包完整复制到 `packages/backend/scripts/ppt-master/`
- backend 创建临时 SVG 目录后，通过 `Bun.spawn()` 调用 Python 脚本完成转换
- **优势**：无需重写 DrawingML/XML 引擎，100% 复用已验证的转换逻辑
- **依赖**：服务器需安装 Python 3.10+ 及 venv 中的 `python-pptx`、`cairosvg`、`svglib`、`Pillow`、`numpy`、`lxml`

### 渲染流程
```
DeckPlan + VisualAsset[]
  → svg-renderer.ts (TS 生成 SVG 页面)
  → 写入 tmpDir/svg_output/
  → Bun.spawn(python3 svg_to_pptx.py tmpDir -s svg_output -o output.pptx)
  → 读取 output.pptx Buffer
  → 返回 RenderedPpt
```

## Scope

### In Scope
- [x] 复制 Python SVG-to-PPTX 引擎到项目内
- [x] 创建虚拟环境并安装依赖
- [x] 新增 `svg_native` generation mode（前后端类型 + 路由 + UI）
- [x] 创建 `svg-renderer.ts` 渲染服务层
- [x] 集成到现有 pipeline（service.ts 根据 mode 分支）
- [x] 扩展 SVG 模板支持 15 种 pageType
- [x] 确保现有 3 种 mode 完全不受影响

### Out of Scope (Future)
- 复杂图表 SVG 渲染（chart、bar chart 等）
- AI 图片嵌入 SVG（目前 visuals 参数预留但未在模板中使用）
- 背景图片支持（cover/section 等使用纯色渐变）
- 更多 pageType 精细化布局（timeline 分支、metrics 柱状图动画等）

## Files Changed

### Backend
| File | Change |
|---|---|
| `src/modules/ppt-agent/types.ts` | `PPT_GENERATION_MODES` 新增 `"svg_native"` |
| `src/modules/ppt-agent/routes.ts` | body validation 新增 `t.Literal("svg_native")` |
| `src/modules/ppt-agent/service.ts` | renderer 阶段根据 mode 选择渲染器；新增 mode rule |
| `src/modules/ppt-agent/svg-renderer.ts` | **新增**：15 种 pageType SVG 模板 + Python 调用封装 |
| `scripts/ppt-master/` | **新增**：Python 引擎 + venv + requirements.txt |

### Frontend
| File | Change |
|---|---|
| `src/pages/PptGenerator.tsx` | `generationModeOptions` 新增 `"原生矢量"` |
| `src/lib/api/ppt-agent.ts` | `PptGenerationMode` 类型扩展 |

## SVG Template Coverage

| pageType | 模板状态 | 视觉特征 |
|---|---|---|
| cover | ✅ | 深色背景 + 圆形装饰 + 文档图标 + 标题/副标题 |
| agenda | ✅ | 左侧编号列表 + 交替色块 |
| section | ✅ | 左侧竖线强调 + 大标题 |
| closing | ✅ | 深色背景 + 居中感谢文字 |
| content (default) | ✅ | PART 标头 + 卡片列表 |
| problem | ✅ | 红色警示高亮 + 编号问题列表 |
| strategy | ✅ | 双栏对比 + 箭头指示 + 卡片布局 |
| architecture | ✅ | 金字塔层级递减 + 向下箭头 |
| capability | ✅ | 2×3 卡片网格 + 顶部色条 |
| governance / risk | ✅ | 等宽卡片网格 + 边框强调色 |
| scenario | ✅ | 大卡片列表 + 左侧色条 |
| timeline | ✅ | 水平时间线 + 节点上下交替 |
| metrics | ✅ | 2×2 指标卡片 + 大号数字 |
| table | ✅ | 表头 + 斑马纹行 + 边框 |
| summary | ✅ | 大卡片 + 编号圆形 + 要点列表 |

## Verification

### 手动测试步骤
1. 确保 `packages/backend/scripts/ppt-master/.venv` 存在且 Python 依赖已安装
2. 启动前后端 dev server
3. 在 PPT Generator 页面选择"原生矢量"模式
4. 提交生成任务，观察 pipeline 正常走完
5. 下载生成的 PPTX，在 PowerPoint 中打开验证可编辑性

### 代码检查
- `bun run check` 通过
- TypeScript 类型检查通过（通过 IDE diagnostics 验证）

## Risks

| 风险 | 缓解措施 |
|---|---|
| 服务器无 Python 环境 | 部署脚本中增加 `pip install -r scripts/ppt-master/requirements.txt` |
| Python venv 路径在不同环境不一致 | 生产环境使用 `which python3` 动态查找或 Docker 镜像预装 |
| SVG 模板过多导致 TS 文件过大 | 后续可拆分为 `svg-templates/*.ts` 按 pageType 分离 |
| 图片嵌入未实现 | 模板中预留了 `visual` 参数，后续迭代接入 |

## Success Criteria
- [x] `svg_native` mode 前后端类型一致、API 可接收
- [x] Python 引擎在 backend 子进程中运行正常
- [x] 15 种 pageType 均生成有效 XML SVG
- [x] 导出 PPTX 可在 Office 2019+ 中打开并编辑
- [x] 现有 3 种 mode 行为不变
- [x] Biome lint/format 通过

## Definition of Done
1. 代码已合并到 main 分支
2. 手动 end-to-end 测试通过（至少生成 5 页以上 deck）
3. README / 部署文档中记录了 Python 环境依赖
4. 无回归：现有 generation mode 测试用例全部通过
