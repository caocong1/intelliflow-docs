# Gemini Prompt: PPT Scene Family Lock V1

Model:

`gemini-3.1-pro-preview`

Goal:

在保留现有页面骨架的前提下，对 `ppt_scene_family/v1` 做一次 family-level 主题统一。

## Purpose

这一步不是重新发散设计，而是收口设计系统。

目标：

- 保留每页当前最优构图
- 统一 palette
- 统一字体系统
- 统一边框语言
- 统一图标/符号语言
- 统一图片与图注语言
- 让 15 页看起来像“同一家族”

## Prompt

```text
你将收到一个 `ppt_scene_family/v1` JSON。

你的任务不是重新设计每一页，而是进行一次“family lock”：

在尽量保留每页现有构图骨架、元素层级、页面类型差异的前提下，
统一整套 family 的视觉语言。

你必须输出一个新的 `ppt_scene_family/v1` JSON。

目标：
- family 内部主题统一
- 页面之间仍然保留差异化构图
- 不允许把所有页改成同一版式
- 不允许把好的页面改平庸

必须统一的内容：
1. 统一 palette
2. 统一字体系统
3. 统一边框粗细与圆角逻辑
4. 统一图标/图形语言
5. 统一图片裁切与 caption 语言
6. 统一装饰层节奏

必须保留的内容：
1. pageType 不变
2. 每页主构图骨架尽量不变
3. 页面差异性必须保留
4. cover / comparison / quote / process 等强页面不能被改普通

禁止事项：
- 不要重新发明新的 pageType
- 不要删除页面
- 不要把所有页面变成统一模板
- 不要只做配色替换
- 不要破坏已有的主焦点结构

输出要求：
- 只输出 JSON
- 不输出解释
- 不输出 Markdown
```
