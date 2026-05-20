# PPT Scene Single-Slide Prompt: Cover

Model:

`gemini-3.1-pro-preview`

Goal:

生成一页高质量封面，输出完整 `ppt_scene/v1` JSON，但 `slides` 数组中只能有 1 页。

Prompt:

```text
基于已提供的 `ppt_scene/v1` 协议，输出一个完全合法的 JSON。

任务：
- 只生成 1 页
- 页类型：cover
- 主题：无线网络建设全流程指南
- 受众：企业与公共机构的采购负责人、IT负责人
- 语言：zh-CN

质量目标：
- 必须像一张“封面海报”，不是普通 PPT 标题页
- 必须具有高级感、品牌感、编辑感
- 必须让人一眼感到这不是模板站成品

视觉方向：
- editorial
- premium
- asymmetric
- poster-like
- dramatic whitespace
- high contrast hierarchy
- bold typography

强制要求：
1. 只输出一个完整的 `ppt_scene/v1` JSON。
2. `slides` 中必须且只能有 1 页。
3. 这一页必须有一个超大信息锚点，且锚点不能只是普通标题文字。
4. 标题至少拆成两层，形成明显尺度差。
5. 页面必须明显偏一侧构图，不能居中保守。
6. 必须出现 1 个以上大尺度 shape，用来定义画面结构。
7. 允许出现旋转文字、标签柱、编号、角标，但必须克制且有设计目的。
8. 不允许“背景 + 居中大标题 + 副标题”这种普通模板页。
9. 不允许使用图片占主导，必须以 shape + text 为核心。
10. 文字总量必须少。

内容要点：
- 主标题：无线网络建设
- 副标题：全流程指南
- 一句说明：面向企业与公共机构的采购与 IT 负责人

禁止事项：
- 不要像启动页
- 不要像网页 hero banner
- 不要像咨询公司模板封面
- 不要做成左右简单二分栏
- 不要输出多余说明

只输出 JSON，不要 Markdown，不要解释。
```

