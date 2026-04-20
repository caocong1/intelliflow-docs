# PPT MVP Family Design Contract

## Purpose
当前 MVP 的核心问题不是兼容性，也不是素材数量，而是：

- 仍然按“单页函数”在写版式
- 仍然在追求“长得像 benchmark”
- 还没有真正建立 `family-first` 的页面语法

这份 contract 用来约束后续所有 MVP 页面改造，避免继续做“学到皮毛”的 slide imitation。

## Root Diagnosis
Kimi / 豆包成品的完成度，主要来自 4 个根因层：

1. `Family Grammar`
   - 所有页共享同一套背景、标题区、白卡、图像容器、说明带、notes 逻辑
   - 不是每页都重新设计

2. `Content Compression`
   - 页面只承载适合视觉化的短句
   - 讲解说明下沉到 notes，而不是塞进版面

3. `Component Hierarchy`
   - 标题区、主模块、支撑模块、总结带、页下注释，各自有稳定角色
   - 不是形状和文本框的自由拼装

4. `Ratio Discipline`
   - 留白、卡片大小、图片占比、字号级差都一致
   - 不是“素材接进来之后再找位置”

## Family Identity
当前 benchmark family 命名为：`doubao_light_tech_v1`

### Visual DNA
- 背景：浅灰暖白 + 极轻电路底纹
- 标题：大号深色中文标题，英文只做弱辅助
- 主色：亮绿色
- 辅色：深蓝灰 / 橙色
- 卡片：白色、统一圆角、轻阴影
- 图片：插画 / 说明型图像，放进稳定的白卡容器
- Notes：每页有一段完整讲解说明

## Universal Page Grammar
所有页都必须共享下面 5 层：

1. `Background Layer`
   - 统一浅色纹理背景
   - 不允许每页换背景风格

2. `Title Block`
   - 左上标题区
   - 大中文标题
   - 英文或副标只做弱辅助，不抢层级

3. `Primary Module`
   - 每页唯一主结构
   - 目录页是双列目录卡
   - 对比页是双白卡 + 双图 + 要点
   - 时间轴页是主视觉带 + 节点卡

4. `Support Module`
   - 页面下半区或侧边的信息块
   - 必须服务主结构，不得另起一套视觉语言

5. `Narration Layer`
   - 页面讲解说明进入 notes
   - 页面本体只保留视觉化内容

## Content Rules

### Title
- 中文标题控制在 8-16 字优先
- 英文副标只作辅助，不作为主信息

### Card Text
- 每条 bullet 最佳长度：12-24 汉字
- 卡片正文不超过 2 行
- 同一页不允许既有长段正文又有多块卡片

### Timeline
- 节点数量固定 4-5 个
- 每节点只保留：
  - 年份
  - 标题
  - 1 句说明
- 趋势总结放入独立总结带

### Notes
- 每页必须有完整讲解说明
- notes 才承载“口语化阐释”
- 页面正文不重复 notes 内容

## Variant Constraints

### `toc_card_grid_8`
- 双列 8 卡
- 所有卡同一族，不做主卡/强调卡变体
- 目录页不追求花样，只追求稳定秩序

### `comparison_dual_image`
- 双白卡对称
- 上图区、下方标题、下方 3 条要点
- 左右只允许配色不同，不允许结构不同

### `timeline_horizontal_5`
- 主视觉带只承载“演进感”
- 节点卡独立排列在下方
- 底部总结带必须是完整一句核心趋势

## What To Stop Doing
- 不再为了“像 benchmark”去一页一页抄位置
- 不再在同一页同时引入两套层级
- 不再把 notes 内容再塞回页面正文
- 不再用组件局部花哨感替代整体秩序

## Next Refactor Direction
代码层下一步必须做：

1. 把当前 variant 从“每页一个大函数”重构成：
   - family background
   - family title block
   - family card primitives
   - family note policy

2. 把 `page plan` 的页面正文进一步压缩

3. 重新生成 4 页 MVP，目标不是更像，而是：
   - 同一家族
   - 更稳
   - 更能讲
