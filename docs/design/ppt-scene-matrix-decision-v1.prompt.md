# PPT Scene Single-Slide Prompt: Matrix Decision

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量二维决策矩阵页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：matrix decision
- 主题：无线网络建设全流程指南
- 语言：zh-CN

内容目标：
做一个二维决策矩阵，用于帮助判断不同网络建设策略的适配性。

坐标轴：
- 横轴：建设复杂度（低 -> 高）
- 纵轴：长期价值（低 -> 高）

候选点：
- 基础覆盖型方案
- 成本敏感型方案
- 高密并发型方案
- 园区级统一运维方案

质量目标：
- 必须像决策框架页
- 不能像课堂象限图
- 必须有判断感和策略感

视觉方向：
- decision board
- matrix poster
- strategic
- premium

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须有明确二维坐标结构。
4. 必须有至少 4 个策略点。
5. 每个点不能只是普通文字，必须有视觉载体。
6. 必须有象限解释或区域提示。
7. 必须有标题区和辅助说明区。

禁止事项：
- 不要课堂风
- 不要默认四象限图
- 不要只有坐标轴和4个字
- 不要后台 BI 图

只输出 JSON，不要 Markdown，不要解释。
```

