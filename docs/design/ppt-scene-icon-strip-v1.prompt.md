# PPT Scene Single-Slide Prompt: Icon Strip

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量图标条带页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：icon strip
- 主题：无线网络建设全流程指南
- 语言：zh-CN

内容主题：
无线网络建设中的四类核心能力

能力点：
- 覆盖设计
- 容量规划
- 安全合规
- 运维自动化

质量目标：
- 必须像图标条带页 / 能力带页
- 不能像普通四个小功能点
- 必须有品牌图形感

视觉方向：
- icon system
- strip layout
- premium
- structured

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须为每个能力点提供图标或图标占位结构。
4. 图标与文本必须形成统一系统。
5. 不能是 4 个一样的小卡片。
6. 必须有明显条带或系统化承载结构。

禁止事项：
- 不要四个普通 feature card
- 不要后台功能介绍页
- 不要模板站图标列表页

只输出 JSON，不要 Markdown，不要解释。
```

