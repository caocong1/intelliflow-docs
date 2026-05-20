# Gemini PPT Style Template Family

## Goal

目标不是生成几页漂亮示意图，而是构建一套 **由 Gemini 生成的完整 PPT 风格模板家族**。

要求：

- 页面类型完整
- 每页质量高
- 每页都有明确设计目的
- 包含背景图 / 图标 / 边框 / 装饰层
- 支持多种不同内容结构
- 不是“同一骨架换颜色”

这套模板家族要服务于后续 PPT 导出主链路，因此必须兼顾：

- 审美质量
- 渲染可实现性
- 内容适配性
- 可扩展性

## Core Principle

完整模板家族必须满足：

1. 同一风格家族内，视觉语言统一。
2. 不同页面类型之间，构图必须明显不同。
3. 每类页面至少有一个“强版本”。
4. 不能把所有内容都压缩成 bullet page。
5. 不能只依靠颜色变化制造所谓风格差异。

## Page Family Inventory

建议第一批完整覆盖以下页面族。

### A. Narrative Pages

1. `cover_editorial`
- 海报式封面
- 强锚点、强留白、强标题层次

2. `toc_mosaic`
- 目录拼贴页
- 不能只是列表

3. `section_break_monument`
- 章节过渡页
- 大编号、大标题、氛围背景

4. `closing_statement`
- 收尾页
- 感谢页 / 结论页 / CTA 页

### B. Structured Content Pages

5. `bullet_manifesto`
- 强标题 + 宣言式条目
- 适合重点原则

6. `feature_grid_editorial`
- 特性网格
- 适合 3-6 个并列信息点

7. `comparison_exhibition`
- 对抗式对比页
- 禁止 table 退化

8. `timeline_band`
- 时间带 / 发展历程页
- 横向节奏清晰

9. `process_route`
- 流程路线页
- 适合 4-7 步

10. `kpi_poster`
- 数字海报页
- 大数字 + 说明

11. `summary_ribbons`
- 总结丝带页
- 强收束结构

### C. Data/Reference Pages

12. `table_premium`
- 高级表格页
- 允许 table，但必须不是普通 Excel 风

13. `matrix_decision`
- 二维矩阵 / 象限页
- 适合决策框架

14. `qna_stage`
- Q&A / discussion page
- 中心化、舞台感

### D. Visual Pages

15. `image_focus_story`
- 大图主导页
- 图文叙事

16. `quote_poster`
- 引言 / 核心观点页
- 大引号 / 大句子 / 强留白

17. `icon_strip`
- 图标条带页
- 适合能力清单 / 场景条目

18. `brand_board`
- 风格展示页
- 展示图标、材质、边框、配色、图像语言

## Required Visual System Per Family

每套风格家族必须明确生成以下内容。

### 1. Background System

至少包含：

- 纯色背景方案
- 大色块背景方案
- 图形化背景方案
- 含图片背景方案

### 2. Decorative Layer

至少包含：

- 分隔线 / 条带
- 角标 / 标签
- 边框系统
- 装饰点 / 小图形

### 3. Image Language

至少包含一种：

- 大图裁切
- 相片拼贴
- 窗格式图片
- 圆角图片卡片

### 4. Icon Language

至少明确：

- 图标风格：线性 / 面性 / 高对比
- 图标摆放方式
- 图标与文本组合规则

### 5. Border and Frame Language

至少明确：

- 是否有外框
- 卡片边框粗细
- 强调边界样式
- 不同页面的边界密度

## Family-Level Quality Bar

如果一页满足下面任意情况，视为质量不合格：

- 看起来像模板站现成页
- 看起来像网页 dashboard
- 看起来像咨询模板双栏页
- 看起来像 Word 文档排版
- 只是换了背景颜色
- 只是重复卡片
- 没有主焦点

## Generation Strategy

不要一次性让 Gemini 生成整套 deck。

推荐流程：

1. 先生成 `style family brief`
2. 再按页面族逐页生成
3. 每页通过后再合并成完整 family

### Suggested Order

第一批：

1. `cover_editorial`
2. `comparison_exhibition`
3. `summary_ribbons`
4. `section_break_monument`
5. `image_focus_story`

第二批：

6. `toc_mosaic`
7. `feature_grid_editorial`
8. `timeline_band`
9. `process_route`
10. `kpi_poster`

第三批：

11. `table_premium`
12. `matrix_decision`
13. `quote_poster`
14. `icon_strip`
15. `closing_statement`

## Output Structure Recommendation

建议最终生成物不是单一 deck，而是：

```json
{
  "version": "ppt_scene_family/v1",
  "familyId": "editorial_wireless_01",
  "familyLabel": "Editorial Wireless",
  "theme": {},
  "pages": [
    {
      "pageType": "cover_editorial",
      "scene": {}
    },
    {
      "pageType": "comparison_exhibition",
      "scene": {}
    }
  ]
}
```

说明：

- `theme`：家族级统一视觉语言
- `pages[]`：每类页面单独存 scene
- 每个 `scene` 仍使用 `ppt_scene/v1`

## Immediate Working Target

当前阶段的目标不是直接生成 18 类全部页面，而是先把“第一批 5 类关键页”质量拉到可用：

- 封面
- 对比页
- 总结页
- 章节页
- 图片主导页

只要这 5 类页能稳定好看，后续整套 family 就有基础。
