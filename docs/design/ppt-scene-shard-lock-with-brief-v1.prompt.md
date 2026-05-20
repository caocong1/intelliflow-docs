# Gemini Prompt: PPT Scene Shard Lock With Brief V1

Model:

`gemini-3.1-pro-preview`

Goal:

对单个 shard 做 theme lock，但不要求模型再次从页面集合里自己抽取完整 family 语言。

## Inputs

你将收到两段 JSON：

1. `ppt_scene_family_brief/v1`
2. 一个较小的 `ppt_scene_family/v1` shard

## Purpose

让模型直接根据 brief 执行锁定，而不是边读页面边重新归纳主题。

这样可以：

- 降低 token 压力
- 降低容量压力
- 提高 shard lock 的稳定性

## Prompt

```text
你将收到两个 JSON：

第一段是 `ppt_scene_family_brief/v1`
第二段是一个较小的 `ppt_scene_family/v1` shard

你的任务是：

基于 brief 中定义的统一视觉语言，
对 shard 中的页面做一次 theme lock。

你必须输出一个新的 `ppt_scene_family/v1` JSON。

要求：
- pageType 不变
- 页面数量不变
- 主构图骨架尽量不变
- 页面差异必须保留
- theme 必须尽量统一到 brief 规定的方向
- 不允许把强页面改普通

你必须优先统一：
1. palette
2. fonts
3. border / frame language
4. icon language
5. image + caption language
6. decorative rhythm

禁止事项：
- 不要删除页面
- 不要改 pageType
- 不要重做页面骨架
- 不要只改配色
- 不要把所有页面变成同一种模板

输出要求：
- 只输出 JSON
- 不输出解释
- 不输出 Markdown
```
