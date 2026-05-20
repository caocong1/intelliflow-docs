# PPT Scene Single-Slide Prompt: Feature Grid

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量特性网格页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：feature grid
- 主题：无线网络建设全流程指南
- 语言：zh-CN

内容主题：
主流无线 AP 设备类型及特点

内容点：
- 面板 AP：美观，适合独立房间
- 放装 AP：覆盖范围广，适合开放区域
- 高密度 AP：适合会议、会场、教学场景
- 室外 AP：适合园区、广场、停车场

质量目标：
- 必须像高质量“特性拼贴页”
- 不能是 2x2 普通卡片网格模板
- 必须有图标/符号/几何引导

视觉方向：
- editorial
- modular
- premium
- structured collage

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 禁止四张完全等大等样式卡片。
4. 必须至少有两种不同尺寸的信息容器。
5. 必须包含图标或图标占位结构。
6. 必须有一个主标题区域，不要所有信息等权。
7. 必须体现“模块拼贴”而不是“规则栅格”。
8. 允许 4 个内容点，但布局必须有主次。

禁止事项：
- 不要普通四卡片
- 不要后台产品功能页
- 不要咨询模板方格
- 不要只有文本没有符号

只输出 JSON，不要 Markdown，不要解释。
```

