# PPT Scene Single-Slide Prompt: Image Focus V2

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量、氛围感更强的图片主导页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：image focus
- 主题：无线网络建设全流程指南
- 语言：zh-CN

内容表达：
无线网络建设不是“买设备”，而是“场景、容量、运维”三者协同。

质量目标：
- 必须像品牌视觉页 / 图文海报页
- 不能像普通图文双栏
- 不能像“图片上盖一块毛玻璃卡片”的常规套路

视觉方向：
- cinematic
- editorial
- premium
- image-led
- atmospheric
- layered caption system

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 必须有大图区域。
4. 必须让图片裁切方式本身成为构图一部分，而不是纯背景铺满。
5. 必须包含边框、图注、标记点、引导线、局部说明中的至少两种。
6. 文本层必须与图像区域形成关系，而不是简单叠加卡片。
7. 必须有一个图像细节锚点或局部注释系统。
8. 必须保留较多留白和氛围感。
9. 可以使用一个小 inset image 区或细节框，但不要复杂到无法渲染。

禁止事项：
- 不要普通左图右文
- 不要整页背景图 + 毛玻璃卡片
- 不要网页 hero
- 不要图片只是背景装饰

只输出 JSON，不要 Markdown，不要解释。
```
