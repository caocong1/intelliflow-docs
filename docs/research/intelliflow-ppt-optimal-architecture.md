# IntelliFlow PPT Optimal Architecture

日期：2026-04-16

---

## 1. 目标

IntelliFlow 要做的不是“再造一个模板页选择器”，也不是“让 AI 自由生成每页绝对坐标”，而是：

**在内容规划、页面 family、画布模型、导出质量和讲稿体系之间找到一个工程上最稳、体验上最强、可持续演进的组合方案。**

---

## 2. 核心判断

基于对以下 5 个开源项目的代码级研究：

- `banana-slides`
- `ai-to-pptx`
- `ppt-master`
- `AiPPT`
- `LandPPT`
- `PPTist`

我们判断：

### 2.1 正式主路线

应该是：

`Outline -> PagePlan -> AssetPlan -> Variant/SlotSchema -> CanvasRenderModel -> PptCompile`

而不是：

`AI -> 自由坐标 scene -> 直接导出`

### 2.2 导出不能只走单一路

必须支持两类导出：

1. `Native Editable PPTX`
   - 用于稳定结构页
   - 强约束页面 family

2. `High-Fidelity Fallback / Hybrid PPTX`
   - 用于复杂视觉页
   - 当页面效果明显超出 native editable 能力边界时切换

### 2.3 Notes 不是附属功能

讲稿 / speaker notes 应当是一等产物。

原因：
- benchmark 产品已经证明讲稿和备注是成品体验的一部分
- notes 还能显著降低页面正文密度
- 它让页面“可讲”，不是只可看

---

## 3. 推荐吸收的 5 条技术路线

## 3.1 从 LandPPT 吸收工作流骨架

推荐吸收：
- outline workflow
- slide workflow
- template selection / free template generation
- image service
- narration / speech script
- export infra

不推荐直接照搬：
- 整个平台化工程体量
- 先上数据库、缓存、任务系统全家桶

对 IntelliFlow 的落地方式：
- 先抽出轻量版本的服务边界
- 后端保持模块化而不是平台化

---

## 3.2 从 ai-to-pptx 吸收强约束页面族

推荐吸收：
- 页面类型强约束
- 固定槽位
- 模板资产化

对 IntelliFlow 的落地方式：
- 定义 `PageFamily`
- 定义 `Variant`
- 定义 `SlotSchema`

例如：

- `cover_hero`
- `toc_grid_8`
- `comparison_dual_panel`
- `timeline_5`
- `device_overview`
- `device_detail`
- `brand_matrix`
- `faq_cards`
- `closing_statement`

而不是让 AI 每次自由决定页面结构。

---

## 3.3 从 AiPPT 吸收中间画布模型

推荐吸收：
- `PPT/JSON/Canvas` 的中间编辑模型
- slide master / layout / children / property 的继承思路
- 编辑器与渲染器围绕 JSON 而不是直接围绕 `.pptx`

对 IntelliFlow 的落地方式：
- 正式引入 `CanvasRenderModel`
- 所有编辑、预览、检查都围绕 `CanvasRenderModel`
- 不让 `.pptx` 结构成为主编辑语义

---

## 3.3.1 从 PPTist 吸收成熟编辑器能力

推荐吸收：
- page / node type labels
- notes、模板、导出、放映围绕同一数据模型组织
- 高成熟 Web PPT 编辑器的交互边界

对 IntelliFlow 的落地方式：
- `CanvasRenderModel` 不只服务渲染
- 它还应服务：
  - 预览
  - 编辑
  - 局部重入
  - 演示
  - 导出

`PPTist` 强化的不是“如何生成 PPT”，而是：

> 如果没有稳定的编辑器/画布中间层，生成、修改、预览、导出最终都会割裂。

---

## 3.4 从 ppt-master 吸收原生可编辑导出边界

推荐吸收：
- 为什么不能让 AI 直接生成 DrawingML
- 为什么 HTML 不是最终语义源
- 为什么 SVG/矢量中间层在某些场景下是更好桥梁

对 IntelliFlow 的落地方式：
- 不必完全照搬 SVG 全流程
- 但必须尊重它的结论：
  - 不要直接让 AI 生成低层 ppt 对象
  - 要有受控中间表示

---

## 3.5 从 banana-slides 吸收 AI-native 修改体验

推荐吸收：
- 自然语言局部修改
- 参考图/风格参考
- 高保真图片 fallback

对 IntelliFlow 的落地方式：
- 在 `CanvasRenderModel` 上支持页级/区块级重入
- 不直接修改 `.pptx`
- 允许部分复杂页面转为 high-fidelity export

---

## 4. IntelliFlow 正式分层建议

## 4.1 L0: Source Understanding

输入：
- 主题
- 文档
- 参考 PPT / 参考图片

输出：
- `PresentationOutline`

职责：
- 文档解析
- 章节抽取
- 页数估算

---

## 4.2 L1: Planning Layer

输出：
- `PagePlan`

职责：
- 每页 pageType
- 每页变体建议
- 每页标题 / 副标题 / 关键信息
- notes 初稿

注意：
- AI 只输出结构化内容
- 不输出低层坐标

---

## 4.3 L2: Asset Planning Layer

输出：
- `AssetPlan`

职责：
- 这页是否需要图片
- 图片是背景图、插图、图标还是图表
- 参考图来源
- fallback 策略

---

## 4.4 L3: Variant System

输出：
- `LayoutVariantDefinition`
- `SlotSchema`

职责：
- family grammar
- 组件比例
- 标题区、图片区、卡片区、安全边界
- 文本上限与 fitting 规则

这层是系统真正的“页面语法”。

---

## 4.5 L4: Canvas Layer

输出：
- `CanvasRenderModel`

职责：
- 预览
- 检查
- 局部重入
- 用户编辑

这是 IntelliFlow 后续所有在线编辑能力的基础。

---

## 4.6 L5: Export Layer

输出：
- `NativeEditablePptx`
- `Hybrid/ImageBackedPptx`

职责：
- 根据页面复杂度选择导出策略
- 写入 notes
- 保证文件结构稳定

---

## 5. Page Family 设计原则

这一层是当前 IntelliFlow 最缺的。

### 5.1 Family-first
- 页面必须共享同一套 family grammar
- 不是逐页“像 benchmark”

### 5.2 Notes-first compression
- 页面只放视觉化短句
- 讲稿下沉到 notes

### 5.3 Variant over free layout
- 让 AI 选 `variant`
- 不让 AI 自由定坐标

### 5.4 Dual export by complexity
- 简单结构页：native editable
- 复杂视觉页：fallback/hybrid

---

## 6. 近期落地建议

## Stage A

目标：
- 先验证 family-driven route

做法：
- 保留 4 页 MVP
- 但从“仿单页”彻底切到“仿 family system”

必须产出：
- `PageFamily`
- `Variant`
- `SlotSchema`
- `Notes schema`

---

## Stage B

目标：
- 接入 AI `PagePlan`

做法：
- AI 只输出：
  - page type
  - title
  - short bullets
  - notes
- 由 variant 层决定页面结构

---

## Stage C

目标：
- 引入 `CanvasRenderModel`

做法：
- 先做内部预览和重入
- 再做在线编辑

---

## Stage D

目标：
- 双路导出

做法：
- native editable
- image-backed / hybrid

---

## 7. 当前应停止的事

- 继续扩 `ppt_scene` 自由场景协议作为正式主路线
- 继续围绕单页截图磨“更像豆包”
- 继续把 benchmark 的某一页当成目标，而不是把 family grammar 当目标

---

## 8. 最终建议

IntelliFlow 最优路线不是从某一个开源项目里抄出来，而是：

**LandPPT 的工作流骨架**
+ **ai-to-pptx 的强约束 variant**
+ **AiPPT 的 JSON/Canvas 中间模型**
+ **ppt-master 的原生可编辑导出边界**
+ **banana-slides 的 AI-native 修改体验和高保真 fallback**

如果只能压缩成一句话：

> **正式主路线应该是“AI 决策 + family/variant 系统 + canvas 中间层 + 双路导出”，而不是“AI 自由生成页面坐标”。**
