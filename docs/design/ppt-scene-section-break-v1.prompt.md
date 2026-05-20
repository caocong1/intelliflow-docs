# PPT Scene Single-Slide Prompt: Section Break

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量章节过渡页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：section break
- 主题：无线网络建设全流程指南
- 当前章节：场景选型与品牌判断
- 语言：zh-CN

质量目标：
- 必须像章节碑文 / 过渡海报
- 必须有强编号或强结构锚点
- 必须像“翻到新章节”，而不是普通标题页

视觉方向：
- monumental
- numbered
- editorial
- atmospheric
- premium

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须有大编号或大章节代号。
4. 必须有大尺度 shape 或背景结构。
5. 文字总量必须少。
6. 必须有章节感和停顿感。
7. 不允许像普通内容页。
8. 不允许只是居中标题。

内容要点：
- 章节号：03
- 标题：场景选型与品牌判断
- 小标签：SCENARIO & BRAND DECISION

只输出 JSON，不要 Markdown，不要解释。
```

