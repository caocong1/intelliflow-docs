# PPT Scene Single-Slide Prompt: Process

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量流程页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：process
- 主题：无线网络建设全流程指南
- 语言：zh-CN

流程内容：
- 现场工勘
- 方案设计
- 项目实施
- 验收测试
- 日常运维

质量目标：
- 必须像“路线图 / 过程地图 / 实施路线带”
- 不能像普通箭头流程图
- 必须让流程有前进感

视觉方向：
- route map
- premium process
- directional
- editorial systems diagram

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 禁止普通 chevron 流程图。
4. 必须有清晰路线结构，例如路径、站点、带状线路、转折节点之一。
5. 至少 5 个步骤，但不能机械重复 5 个相同容器。
6. 必须体现阶段推进，而不是简单枚举。
7. 必须有编号或站点系统。
8. 必须包含至少一个辅助说明区。

禁止事项：
- 不要五个箭头
- 不要五个同样的框
- 不要后台 onboarding 风
- 不要纯编号列表

只输出 JSON，不要 Markdown，不要解释。
```

