# 风格驱动的 AI PPT 生成系统重构

## Summary
- 放弃“任意下载站 `pptx` 模板逐页自动套用”作为主路径，改成“结构化内容 + 内置风格包 + AI 微调 + 稳定渲染”。
- 最终用户只做一件事：在导出时手动选择一个内置风格，然后下载；不参与模板创建、模板编辑、页面校正。
- 外部产品只作为 benchmark，不接入第三方生成服务。
- 现有 `ppt_templates` 上传/管理能力退出主流程，数据保留但默认不再暴露给用户使用。

## Key Changes
- 新增内部 `PresentationBlueprint` 作为 PPT 专用内容协议，替代当前仅靠 `SlidePresentation.layout` 的粗粒度结构。
  - 每页至少包含：`pageRole`、`archetype`、`contentBlocks`、`density`、`speakerNotes?`
  - `pageRole` 固定枚举：`cover`、`toc`、`section_break`、`content`、`comparison`、`timeline`、`kpi`、`table`、`summary`、`qna`、`closing`
  - `archetype` 固定首批内置原型：`cover_hero`、`toc_4`、`toc_6`、`section_break_numbered`、`comparison_2`、`timeline_5`、`feature_grid_4`、`kpi_grid_4`、`bullet_story`、`table_clean`、`summary_cards`、`qna_list`、`closing_minimal`
- 后端 PPT 生成链路重构为 4 段：
  - `内容规划`：上游内容先转成 `PresentationBlueprint`
  - `风格选择`：按用户所选风格包加载视觉 token
  - `AI 微调`：只允许在风格包边界内微调配色层级、封面语气、图表强调、装饰密度，不允许改变页面 archetype
  - `渲染输出`：统一用 `PptxGenJS` 生成，不再把普通 `pptx` 作为主渲染来源
- 内置风格包改为代码内置，不落数据库。
  - 首批固定 6 套，放在仓库内的 style manifest 中
  - 每套风格包定义：`id`、`label`、`palette`、`fontPair`、`backgroundSystem`、`shapeLanguage`、`chartStyle`、`tableStyle`、`archetypeVariants`
  - 推荐首批风格方向：`商务深蓝`、`极简白金`、`科技深色`、`咨询灰蓝`、`高对比演示`、`暖色复盘`
- 当前 `SlidePresentation` 保留兼容，但只作为 legacy 输入。
  - 若上游仍输出旧结构，后端先做 `SlidePresentation -> PresentationBlueprint` 归一化
  - PPT 专用 workflow 后续改为直接输出 `PresentationBlueprint`
- 导出节点运行时 UI 改造：
  - 将现有 “PPT 模板” 选择器替换为 “演示风格” 选择器
  - 风格选择发生在导出时，不在流程配置中绑定模板文件
  - 默认展示固定风格包列表，首个风格为默认值，但用户必须显式可改
- 当前 `/admin/ppt-templates` 和上传入口退出主流程。
  - V1 先从导航和用户可见导出路径中隐藏
  - 旧表 `ppt_templates`、旧接口先不删，只保留为 legacy/internal，不再作为正式生成路径依赖
- 现有普通 `pptx` 上传能力不再继续扩展识别逻辑。
  - 如果未来保留上传，只作为“风格参考提取”的二期能力
  - 风格参考提取仅允许抽取：主辅色、字体、封面氛围、背景纹理、装饰形状语言
  - 不再尝试逐页映射或逐页匹配
- 外部 AI PPT 产品仅作产品与审美 benchmark。
  - Beautiful.ai：参考 `Smart Slides` 思路
  - Canva：参考 `Magic Design for Presentations` 的风格一致性与品牌化流程
  - Gamma / Plus AI：参考生成工作流与导出体验
  - 不做 API 接入，不依赖第三方生成结果

## Implementation Changes
- 新增共享类型与 schema：
  - 新建 `PresentationBlueprint` 类型与 JSON Schema
  - 新建 `StylePackManifest` 类型与运行时校验
  - 旧 `SlidePresentation` 只做兼容桥接
- 新建后端模块：
  - `ppt-blueprint-normalizer`：将 legacy 内容归一化
  - `ppt-style-pack-registry`：加载内置风格包
  - `ppt-style-tuner`：AI 微调风格 token
  - `ppt-archetype-renderer`：按 archetype 渲染页面
  - `ppt-chart-and-table-renderer`：统一图表/表格风格输出
- 现有 `export.service.ts` 中的 `native_pptx` 主逻辑降级为 legacy/internal fallback，不再作为默认主路径。
- 当前 PPT workflow 重构：
  - 各委员会输出目标从 `SlidePresentation` 升级为 `PresentationBlueprint`
  - 要求模型先决定页面角色和内容块，再填充内容，不再让模型猜模板页
- 前端只保留“风格选择 + 下载结果反馈”。
  - 导出完成后显示：`stylePackId`、`renderMode=style_pack_v1`、`pageCount`
  - 不再显示模板画像/模板匹配信息给普通用户

## Test Plan
- 本地快速回归命令（PPT Agent 服务链路 + SVG 模板渲染）：
  - 仓库根目录：`bun run test:ppt-agent:svg`
  - backend 目录：`bun run test:ppt-agent:svg`
  - 覆盖文件：
    - `packages/backend/src/modules/ppt-agent/service.test.ts`
    - `packages/backend/src/modules/ppt-agent/svg-templates.test.ts`
  - 变更记录：`docs/design/ppt-agent-regression-log.md`
- 单元测试
  - `SlidePresentation -> PresentationBlueprint` 归一化正确
  - `pageRole/archetype` 校验和补全正确
  - 风格包加载与 token 合并稳定
  - `toc_4`、`feature_grid_4`、`comparison_2`、`timeline_5` 等 archetype 正确填充固定数量内容块
- 结构完整性测试
  - 导出的 `.pptx` 为合法 zip
  - 所有 `presentation.xml`、`slide*.rels`、`media`、`theme`、`layout` 引用完整
  - 不再出现 PowerPoint “修复演示文稿”提示对应的缺失依赖
- 视觉回归测试
  - 固定样例内容在 6 套风格包下导出，校验封面、目录、章节、表格、总结页的布局与密度
  - 重点验证不会出现“4 主题页只填 1 项”“封面套到多项列表页”这类错位
- 端到端测试
  - 选择不同风格包导出同一文档，文件可打开、页数正确、结果 metadata 正确
  - 风格切换不影响内容结构，只影响视觉表达
- Benchmark 检查
  - 用 2 到 3 套高质量参考稿件手工对比 Beautiful.ai / Canva / Gamma 的输出风格，校验我们的风格包是否达到可接受审美水位

## Assumptions
- V1 的核心目标是“稳定、好看、不中断”，不是“高保真复刻上传模板”。
- V1 只支持系统内置风格包，用户上传模板默认退出主流程。
- `ppt_templates` 相关数据库与接口先保留但隐藏，不在正式用户流程中继续使用。
- Word、PDF、Markdown 导出链路不改。
- AI 微调只调 token，不生成任意新布局；布局始终受控于内置 archetype 库。
- 上线策略采用渐进切换：
  - 优先在 PPT 专用 workflow 和 `pptx` 导出节点启用 `style_pack_v1`
  - 旧模板路径仅保留内部回退开关，不对用户暴露
