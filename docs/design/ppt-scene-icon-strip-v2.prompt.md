# PPT Scene Single-Slide Prompt: Icon Strip V2

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量、品牌化的图标能力条带页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

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
- 必须像“能力条带系统页”
- 不能像四个功能卡片
- 必须有统一图标语言和承载结构

视觉方向：
- icon system
- capability strip
- premium
- brand system page
- structured but not repetitive

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须有一个连续的主条带或主承载结构。
4. 禁止四个相同 group 均匀排成一排。
5. 必须有至少一个主能力点，不能四项完全等权。
6. 必须为每个能力点提供统一图标或图标占位结构。
7. 必须有编号、标签、连接线、边框系统中的至少两种。
8. 页面必须像“品牌能力带”，而不是产品功能介绍。

推荐构图：
- 一条长主带 + 4 个不同节点
- 中间主节点 + 两侧次节点
- 条带上叠加编号和图标徽章

禁止事项：
- 不要四功能卡
- 不要后台模块列表
- 不要模板站图标页
- 不要平均排列

只输出 JSON，不要 Markdown，不要解释。
```

