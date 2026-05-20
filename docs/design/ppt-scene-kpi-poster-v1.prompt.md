# PPT Scene Single-Slide Prompt: KPI Poster

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量 KPI 海报页，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：kpi poster
- 主题：无线网络建设全流程指南
- 语言：zh-CN

数据主题：
无线网络建设的关键收益

可用指标：
- 部署周期缩短 40%
- 扩容效率提升 3 倍
- 运维复杂度下降 35%
- 终端接入弹性提升 5 倍

质量目标：
- 必须像数字海报
- 不能像 dashboard 指标卡片
- 必须有大数字主导

视觉方向：
- data poster
- bold numeric hierarchy
- premium
- asymmetric

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 禁止四个一样的 KPI 卡片。
4. 必须有一个绝对主 KPI。
5. 其他 KPI 必须形成次级层次，不可等权。
6. 必须使用大数字作为主视觉。
7. 必须包含辅助标签、说明、边框或徽章系统中的至少一种。
8. 页面必须像“数字海报”，不是 BI 面板。

禁止事项：
- 不要 dashboard
- 不要指标宫格
- 不要四卡片
- 不要普通数据页

只输出 JSON，不要 Markdown，不要解释。
```
