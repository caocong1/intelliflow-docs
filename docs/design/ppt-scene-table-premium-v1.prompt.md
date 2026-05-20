# PPT Scene Single-Slide Prompt: Table Premium

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量高级表格页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：table premium
- 主题：无线网络建设全流程指南
- 语言：zh-CN

内容主题：
主流品牌综合对比

表格维度：
- 品牌
- 适用场景
- 优势
- 注意事项

候选品牌：
- 华为
- 新华三
- 锐捷
- Aruba

质量目标：
- 必须像高级表格页
- 允许使用 table 元素
- 但不能像 Excel 截图，也不能像普通 PPT 表格

视觉方向：
- premium table
- editorial data layout
- controlled hierarchy
- refined border language

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 可以使用 table 元素，但必须配合 shape/text 装饰层。
4. 必须有清晰的标题区。
5. 必须有至少一个边框/高亮/标签系统。
6. 表格不能孤零零占满全页。
7. 必须像设计过的数据页，不是工具输出页。

禁止事项：
- 不要满屏纯表格
- 不要默认表头蓝条模板
- 不要像后台表格
- 不要像 Excel

只输出 JSON，不要 Markdown，不要解释。
```

