# PPT Scene Single-Slide Prompt: Table Premium V2

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量、高级数据感的表格页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

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
- 必须像“品牌对照数据板”
- 不是 Excel
- 不是后台表格
- 不是默认 PPT 表格页

视觉方向：
- premium data board
- editorial table
- asymmetrical information layout
- refined border language

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 可以使用 `table`，但它不能是唯一视觉主体。
4. 必须有一个额外的洞察/标签/摘要区。
5. 必须有品牌标签或品牌徽章系统。
6. 必须有边框、框体、引导线、高亮列或高亮行中的至少两种。
7. 页面必须有明显的主次结构，不能是一个满版表。
8. 表格外必须存在设计层，不允许孤零零地摆表格。
9. 文本密度要适中，优先精炼。

推荐构图：
- 左上标题，右上洞察卡，中央偏下表格
- 表格外加品牌标签带或总结标签
- 用 shape 做 framing，不只是 table container

禁止事项：
- 不要满屏表格
- 不要默认蓝表头
- 不要 Excel 风
- 不要后台列表感

只输出 JSON，不要 Markdown，不要解释。
```

