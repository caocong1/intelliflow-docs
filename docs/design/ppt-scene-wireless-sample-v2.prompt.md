# Gemini Prompt For `ppt_scene/v1` Sample V2

Model:

`gemini-3.1-pro-preview`

Execution pattern:

- stdin: `docs/design/ppt-scene-json-protocol.md`
- prompt:

```text
基于上面的协议，输出一个完全合法的 ppt_scene/v1 JSON。主题：无线网络建设全流程指南。仅生成3页：cover、comparison、summary。受众：企业与公共机构的采购负责人、IT负责人。语言：zh-CN。

设计方向必须满足：
- editorial
- premium
- asymmetric
- poster-like
- not dashboard
- not consulting-template
- not generic template site

极其重要的禁止事项：
1. 不要输出普通表格页作为 comparison 页主体。comparison 页禁止使用 table 元素。
2. 不要输出“四等分卡片栅格”作为 summary 页主体。
3. 不要让三页共享同一种骨架。
4. 不要做成标题 + 正文大段文字 + 两栏这种传统咨询版式。
5. 不要只是在配色上变化，构图必须真正变化。

三页必须分别使用以下构图策略：

第一页 cover：
- 采用强海报式封面
- 必须有一个大尺度的结构形状，不是普通矩形背景即可了事
- 标题分成至少两段，形成强节奏
- 必须加入一个“信息锚点”，例如编号、标签、细长竖条、角标、浮动徽标中的一种
- 画面要明显偏一侧，不要居中保守排版

第二页 comparison：
- 禁止 table 元素
- 用“对抗式对比板”构图
- 左右两侧各自形成阵营，中间有维度标签或分隔结构
- 比较维度：部署弹性、建设成本、扩容效率、适用场景
- 要像展板 / 杂志对页，不像 Word 表格
- 可以使用条带、对角切分、交错卡片、中央中轴标签

第三页 summary：
- 不要四等分卡片
- 用“原则海报 / 纵向节奏结构 / 楼梯式结构 / 丝带结构”之一
- 总结四个原则：合规优先、场景适配、容量预估、可运维性
- 必须有明显收束感，像结论页，不像内容继续页

额外要求：
- 尽量以 shape + text 为主
- 可以使用少量 group
- 文本总量控制住，不要过密
- 三页都必须可编辑，不要依赖任何截图化技巧
- 只输出 JSON，不要 Markdown 代码块，不要解释
```

Output file:

`docs/design/ppt-scene-wireless-sample-v2.json`
