# PPT Scene Single-Slide Prompt: Image Focus

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量图片主导页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：image focus
- 主题：无线网络建设全流程指南
- 语言：zh-CN

内容目标：
页面要表达：无线网络建设不是“买设备”，而是“场景、容量、运维”三者协同。

质量目标：
- 必须是大图主导页
- 必须像品牌演示中的图文叙事页
- 不能像“左图右文”的普通模板

视觉方向：
- cinematic
- editorial
- image-led
- premium
- strong caption system

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须有大图区域。
4. 必须有文字层与图像层的明显关系。
5. 必须有图注 / 观点 / 局部强调结构之一。
6. 不允许退化成普通图文双栏。
7. 必须有一定氛围感和留白。

建议：
- 可用 1 个大 image 元素 + 2-4 个 shape/text 元素完成
- 可以加边框、标签、图注、引导线

只输出 JSON，不要 Markdown，不要解释。
```
