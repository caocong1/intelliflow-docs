# PPT Scene Single-Slide Prompt: Timeline

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量时间轴页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：timeline
- 主题：无线网络建设全流程指南
- 语言：zh-CN

时间轴内容：
- 802.11a/b/g：基础无线接入
- 802.11n（Wi-Fi 4）：MIMO 与规模化商用
- 802.11ac（Wi-Fi 5）：千兆无线时代
- 802.11ax（Wi-Fi 6）：高密场景优化
- Wi-Fi 7：多链路与低时延体验

质量目标：
- 必须像“进化历程带状页 / 时间展带”
- 不能像普通 PPT 横向五节点时间线
- 必须更像品牌展板而不是教程图

视觉方向：
- banded timeline
- evolution poster
- premium
- technical editorial

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 禁止普通五个圆点连线时间线。
4. 必须有一个时间主带或主轴结构。
5. 至少要有 5 个阶段节点，但不能等距等样式机械重复。
6. 必须体现“技术升级”的节奏变化。
7. 必须有大标题和辅助说明区。
8. 可以使用数字/年份/阶段编号作为强视觉锚点。

禁止事项：
- 不要教程图
- 不要默认 timeline 模板
- 不要五个一模一样气泡
- 不要纯文本平铺

只输出 JSON，不要 Markdown，不要解释。
```

