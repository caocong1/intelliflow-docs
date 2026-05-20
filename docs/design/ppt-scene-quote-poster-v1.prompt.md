# PPT Scene Single-Slide Prompt: Quote Poster

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量观点海报页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：quote poster
- 主题：无线网络建设全流程指南
- 语言：zh-CN

核心观点：
“无线网络建设的关键，不是采购设备，而是建立面向场景、容量与运维的系统能力。”

质量目标：
- 必须像观点海报 / 引言页
- 必须有强情绪和强留白
- 不能像普通引言页

视觉方向：
- quote poster
- editorial
- premium
- dramatic whitespace

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须让核心句子成为唯一主角。
4. 必须包含引言符号、大标点、边框、背景图形等至少一种戏剧化结构。
5. 文本必须有强层级，不要一整段等权。
6. 必须有海报感，而不是内容页感。

禁止事项：
- 不要普通居中文字
- 不要传统 quote 样式
- 不要像感谢页

只输出 JSON，不要 Markdown，不要解释。
```

