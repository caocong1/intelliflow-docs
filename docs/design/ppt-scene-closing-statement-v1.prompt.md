# PPT Scene Single-Slide Prompt: Closing Statement

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量收尾页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：closing statement
- 主题：无线网络建设全流程指南
- 语言：zh-CN

收尾信息：
- 主句：感谢聆听
- 辅句：可根据您的场景需求定制专属无线网络建设方案

质量目标：
- 必须像收尾声明页
- 不能像普通 thank you page
- 必须有结束感、停顿感、余韵

视觉方向：
- closing statement
- elegant
- premium
- quiet confidence

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须有一个明显的收束焦点。
4. 必须体现“结束”而不是“继续讲”。
5. 允许极简，但不能空洞。
6. 必须包含至少一个设计性的装饰结构，而不是纯文字。

禁止事项：
- 不要普通感谢页模板
- 不要居中大字就结束
- 不要像封面复用

只输出 JSON，不要 Markdown，不要解释。
```
