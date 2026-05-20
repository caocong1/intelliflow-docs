# PPT Scene Single-Slide Prompt: Summary

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量总结页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：summary
- 主题：无线网络建设全流程指南
- 受众：企业与公共机构的采购负责人、IT负责人
- 语言：zh-CN

内容目标：
总结四个选型原则：
- 合规优先
- 场景适配
- 容量预估
- 可运维性

质量目标：
- 必须像“结论海报 / 收束页”
- 必须让人感觉已经收尾，而不是继续展开内容
- 必须更像品牌 deck 的 closing summary，而不是普通四卡片总结

视觉方向：
- poster
- takeaway
- asymmetric
- ribbons or pillars
- strong closure

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 禁止输出四等分卡片。
4. 禁止输出楼梯式重复卡片。
5. 必须采用以下之一作为主结构：
   - 单张结论海报 + 多条原则丝带
   - 单张结论海报 + 多根原则立柱
   - 单张结论海报 + 不同长度原则条带
6. 必须有一个“大结论区”，不能四个原则权重完全一样。
7. 四条原则必须有节奏变化，不能机械重复。
8. 必须看起来像最后一页。
9. 必须以 shape + text 为主。
10. 文字必须短、狠、结论化。

禁止事项：
- 不要四卡片
- 不要 bullet list
- 不要普通总结页
- 不要像中间内容页
- 不要输出多余说明

只输出 JSON，不要 Markdown，不要解释。
```
