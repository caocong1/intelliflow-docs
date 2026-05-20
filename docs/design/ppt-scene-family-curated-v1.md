# PPT Scene Family Curated V1

## Summary

当前已将分散生成的最佳页面收敛为一套可复用的 family bundle：

- family JSON: `docs/design/ppt-scene-family-curated-v1.json`
- family id: `wireless_editorial_curated_v1`
- page count: `15`

这份 bundle 的定位不是最终风格锁定稿，而是：

- 作为第一版完整模板家族骨架
- 作为后续 `ppt_scene -> pptx` 适配的输入候选
- 作为下一轮 family-level 主题统一的基础资产

## Selected Pages

- `cover_editorial` -> `ppt-scene-cover-v1.json`
- `comparison_exhibition` -> `ppt-scene-comparison-v2.json`
- `summary_closure` -> `ppt-scene-summary-v2.json`
- `section_break_monument` -> `ppt-scene-section-break-v1.json`
- `image_focus_story` -> `ppt-scene-image-focus-v2.json`
- `toc_mosaic` -> `ppt-scene-toc-v1.json`
- `feature_grid_editorial` -> `ppt-scene-feature-grid-v2.json`
- `timeline_band` -> `ppt-scene-timeline-v1.json`
- `process_route` -> `ppt-scene-process-v1.json`
- `kpi_poster` -> `ppt-scene-kpi-poster-v1.json`
- `table_premium` -> `ppt-scene-table-premium-v2.json`
- `matrix_decision` -> `ppt-scene-matrix-decision-v1.json`
- `quote_poster` -> `ppt-scene-quote-poster-v1.json`
- `icon_strip` -> `ppt-scene-icon-strip-v2.json`
- `closing_statement` -> `ppt-scene-closing-statement-v1.json`

## Coverage

这套 family 已覆盖：

- 封面
- 目录
- 章节过渡
- 特性拼贴
- 图像主导
- 对比页
- 时间轴
- 流程路线
- KPI 海报
- 高级表格
- 决策矩阵
- 观点海报
- 图标能力条带
- 总结页
- 收尾页

## Current Limitation

当前 bundle 采用 `themeMode = scene-local`。

这意味着：

- 每页结构已经可用
- 但 family 级别的统一视觉语言还未锁定
- 字体、色板、边框、图片语言仍可能跨页不一致

这不是 bug，而是当前阶段的设计选择：

- 先把页面类型完整做出来
- 再做 family-level 统一

## Current Best Pages

当前最强页面：

- `cover_editorial`
- `comparison_exhibition`
- `quote_poster`
- `process_route`
- `image_focus_story`

当前合格但仍可优化页面：

- `timeline_band`
- `kpi_poster`
- `table_premium`
- `closing_statement`

## Next Step

下一步最有价值的工作：

1. 基于这 15 页抽取一个统一的 family brief
2. 做 family-level 主题统一
3. 开始最小 `ppt_scene/v1 -> pptx` 渲染适配

建议先做第 3 步前的一个小过渡：

- 新建 `ppt-scene-family-lock-v1.prompt`
- 让 Gemini 在“保留当前页面骨架”的前提下统一 theme、字体、边框、图标与图片语言
