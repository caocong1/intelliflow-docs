# PPT Scene Family Brief V1

## What It Is

文件：

`docs/design/ppt-scene-family-brief-v1.json`

这是一份 family-level 设计 brief，用于把当前已经生成完成的 15 类页面收敛到一套统一视觉语言下。

它不是：

- 最终渲染结果
- 最终 family lock 成果
- 新一轮页面生成结果

它是：

- 下一轮 `family lock` 的输入基线
- 下一轮 renderer 适配的统一设计依据

## Why It Exists

直接对完整 `ppt_scene_family/v1` 做 Gemini `family lock` 时，当前反复被：

- `429 MODEL_CAPACITY_EXHAUSTED`

阻断。

这说明当前阶段的真实瓶颈是：

- 模型容量

而不是：

- prompt 质量

因此先手工收敛出一份可执行的 `family brief`，可以避免工作停在外部容量限制上。

## What It Locks

这份 brief 明确锁定了：

- palette
- fonts
- shape language
- image language
- icon language
- decorative system
- 15 类页面的 page rules

## Current Family Direction

当前统一方向是：

- editorial
- premium
- asymmetric
- poster-driven
- brand deck
- 非 dashboard
- 非咨询模板

## Next Step

基于这份 brief，下一步有两条路径：

1. 再次调用 Gemini 做完整 `family lock`
2. 直接进入 `ppt_scene/v1 -> pptx` renderer 适配，并将 brief 作为 renderer 的 family-level token 来源

当前更推荐：

- 先进入 renderer 适配

原因：

- 页面家族已经够完整
- family brief 已经够明确
- 继续等待 Gemini 容量恢复的边际收益不高
