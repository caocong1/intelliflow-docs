# Gemini Prompt For `ppt_scene/v1` Sample V3

Model:

`gemini-3.1-pro-preview`

Execution pattern:

- stdin: `docs/design/ppt-scene-json-protocol.md`
- prompt:

```text
基于上面的协议，输出一个完全合法的 ppt_scene/v1 JSON。主题：无线网络建设全流程指南。仅生成3页：cover、comparison、summary。受众：企业与公共机构的采购负责人、IT负责人。语言：zh-CN。

视觉方向：
- editorial
- premium
- brand deck
- asymmetric
- dramatic whitespace
- poster-like
- not dashboard
- not consulting template

全局硬约束：
1. 三页必须明显像三种不同版式，不允许共享同一骨架。
2. 不允许任何一页退化成“普通表格页”。
3. 不允许任何一页退化成“重复卡片栅格页”。
4. 不允许只靠换颜色制造差异。
5. 每页必须有一个主焦点结构。
6. 尽量使用 shape + text。

第一页 cover：
- 必须有一个超大号“信息锚点”，例如编号 01 / 标签柱 / 竖向大字 / 巨型色块中的一种
- 必须显著不对称
- 标题至少拆成两层，并形成尺度差
- 不能只是背景加标题

第二页 comparison：
- 禁止 table 元素
- 禁止左右对称重复四行卡片
- 用“对角切分 / 中轴标签 / 左右阵营”的组合
- 比较维度：部署弹性、建设成本、扩容效率、适用场景
- 左右两侧必须有不同的视觉重量，不要机械镜像
- 页面看起来要像展板，不像文档

第三页 summary：
- 禁止四张重复卡片
- 禁止楼梯式重复卡片
- 改用“单张结论海报 + 四条原则丝带 / 四根原则立柱 / 四个不同长度条带”之一
- 四个原则：合规优先、场景适配、容量预估、可运维性
- 必须有收束感，像最后结论，不像中间信息页

输出只允许 JSON，不要 Markdown，不要解释。
```

Output file:

`docs/design/ppt-scene-wireless-sample-v3.json`
