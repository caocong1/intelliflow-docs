# OSS AI PPT Comparison Matrix

日期：2026-04-16

评分说明：

- `5` = 非常强，属于该项目核心优势
- `4` = 很强，可直接借鉴
- `3` = 有能力但不是核心
- `2` = 局部支持
- `1` = 弱或不具代表性

| 维度 | banana-slides | ai-to-pptx | ppt-master | AiPPT | LandPPT | PPTist |
|---|---:|---:|---:|---:|---:|---:|
| 内容规划 / 大纲工作流 | 4 | 3 | 3 | 1 | 5 | 1 |
| 自然语言局部修改 | 5 | 2 | 1 | 2 | 4 | 2 |
| 页面 family / variant 体系 | 2 | 5 | 4 | 2 | 4 | 3 |
| 模板资产化 | 2 | 5 | 4 | 2 | 5 | 3 |
| 在线编辑器 | 4 | 3 | 1 | 5 | 4 | 5 |
| JSON 中间模型 | 2 | 2 | 2 | 5 | 4 | 5 |
| 原生可编辑 PPTX 导出 | 3 | 3 | 5 | 3 | 4 | 3 |
| 高保真图片型导出 | 5 | 2 | 2 | 3 | 5 | 2 |
| 图像系统 / 搜图 / 参考图 | 5 | 2 | 3 | 1 | 5 | 1 |
| 讲稿 / notes / narration | 1 | 1 | 4 | 1 | 5 | 4 |
| 复杂特性（图表/动画/3D） | 2 | 2 | 2 | 4 | 5 | 5 |
| 平台化程度 | 4 | 3 | 2 | 3 | 5 | 4 |
| 工程体量 | 4 | 3 | 3 | 3 | 5 | 4 |
| 可直接借鉴到 IntelliFlow 的价值 | 4 | 5 | 5 | 5 | 5 | 5 |

---

## 1. 每个项目的最佳定位

### banana-slides
最佳定位：
- `AI-native 生成体验参考`
- `高保真图片页 fallback 参考`

不适合承担：
- IntelliFlow 的主导出架构

### ai-to-pptx
最佳定位：
- `variant / slot schema 参考`
- `模板驱动页面结构参考`

不适合承担：
- 最终灵活体验
- 高设计自由度系统

### ppt-master
最佳定位：
- `native editable 导出边界参考`
- `SVG -> DrawingML/PPTX` 编译哲学参考

不适合承担：
- 完整在线产品工作流

### AiPPT
最佳定位：
- `PPT -> JSON -> 编辑 -> 渲染` 内核参考

不适合承担：
- 完整生成链参考

### LandPPT
最佳定位：
- `全链路产品架构参考`
- `outline / slide / template / export / narration` 服务拆分参考

不适合直接照搬：
- 它的完整平台体量

### PPTist
最佳定位：
- `高成熟 Web PPT 编辑器参考`
- `Canvas / JSON / 演示 / 编辑交互参考`

不适合直接照搬：
- 作为完整 AI 生成系统
- 直接并入闭源商业产品（AGPL 风险）

---

## 2. 对 IntelliFlow 最重要的能力映射

| IntelliFlow 需求 | 最值得参考的项目 |
|---|---|
| 稳定的页面家族 | ai-to-pptx, ppt-master |
| 在线中间画布模型 | AiPPT, PPTist, LandPPT |
| 大纲与工作流编排 | LandPPT |
| 原生可编辑导出 | ppt-master |
| 高保真 fallback | banana-slides, LandPPT |
| 讲稿与备注导出 | LandPPT, ppt-master |

---

## 3. 从对比矩阵得到的路线判断

### 错误路线
- 单靠一个项目思路做全套
- 继续走自由 scene 坐标主路线
- 只追求“页面看起来像 benchmark”

### 正确路线

IntelliFlow 应采用**组合式架构**：

1. `LandPPT` 的工作流骨架
2. `ai-to-pptx` 的强约束页面模板思想
3. `AiPPT` 的 JSON/编辑器中间层
4. `PPTist` 的高成熟编辑器与 canvas 交互模型
5. `ppt-master` 的原生可编辑导出研究
6. `banana-slides` 的高保真 fallback 和自然语言修改体验

---

## 4. 第一阶段不该做什么

- 不该继续扩自由 `ppt_scene`
- 不该继续拿 benchmark 单页做外观模仿
- 不该一上来就追全平台能力
- 不该先做复杂图表和高级动画

---

## 5. 第一阶段最值得做什么

1. 定义正式的 `PageFamily / Variant / SlotSchema`
2. 定义 `CanvasRenderModel`
3. 定义 `speaker notes` 作为一等产物
4. 做双路导出设计：
   - native editable
   - image-backed / hybrid
