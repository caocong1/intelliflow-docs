# Wireless Page Plan AI Prompt

目标：

只生成 `page_plan/v1`，不生成任何低层坐标，不生成 scene，不生成 pptx。

## Prompt

```text
请输出一个严格符合 `page_plan/v1` schema 的 JSON。

主题：无线网络建设全流程指南
受众：企业与公共机构采购负责人、IT负责人
语言：zh-CN

只允许以下 pageType / variantHint：
- cover -> cover_hero_image
- toc -> toc_card_grid_8
- comparison -> comparison_dual_image
- timeline -> timeline_horizontal_5

要求：
1. 只输出 JSON
2. 不要输出 Markdown
3. 不要输出任何坐标
4. 目录最多 8 项
5. comparison 左右各最多 3 条 bullet
6. timeline 必须正好 5 个节点
7. 文案必须适合 PPT，短句化
8. 不允许长段文本

输出结构：
- version
- pages
```
