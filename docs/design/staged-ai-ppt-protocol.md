# Staged AI PPT Protocol

## Summary

当前基于自由 `ppt_scene` 坐标协议的主路线，不适合作为正式 PPT 生成主链路。

原因不是单一的：

- 模型不稳定产出高质量绝对坐标
- 页面家族难以统一
- 文本容易重叠、错位、撑爆
- PPTX 对低层对象兼容要求高，容易触发修复
- 仅靠 shape + text 难达到成品级观感

结合对 Doubao/Kimi 等网页端 PPT 生成体验的观察，正式主路线应改为：

**分阶段协议 + 强约束版式变体 + 素材系统 + 稳定编译**

也就是：

1. AI 负责高层决策
2. 程序负责页面结构和稳定排版
3. AI 不直接生成最终低层 PPT 坐标

## Product Goal

用户目标仍然保持简单：

- 输入主题/文档内容
- 选择风格
- 系统自动生成好看的 PPT
- 用户下载

但系统内部不再走“自由 scene 直渲染”作为正式路径，而改为阶段式生成。

## Core Design Principle

AI 在 PPT 链路中的最佳职责不是“精确排版”，而是：

- 提炼结构
- 选择页型
- 压缩文案
- 规划素材
- 控制叙事节奏

程序在 PPT 链路中的最佳职责是：

- 使用固定 variant
- 控制排版安全边界
- 落地文本 fitting
- 插入图片/图标/边框
- 编译为稳定 `.pptx`

## Proposed Pipeline

正式主链路分为 7 个阶段：

1. `PresentationOutline`
2. `VisualBrief`
3. `PagePlan`
4. `AssetPlan`
5. `LayoutVariant`
6. `CanvasRenderModel`
7. `PptCompileModel`

### Phase 1: PresentationOutline

作用：

- 从原始内容中抽取整份演示的章节骨架
- 明确叙事顺序

输出示例：

```json
{
  "version": "presentation_outline/v1",
  "title": "无线网络建设全流程指南",
  "audience": "企业与公共机构采购负责人、IT负责人",
  "language": "zh-CN",
  "sections": [
    {
      "id": "s1",
      "title": "无线与有线的核心差异",
      "intent": "comparison",
      "priority": "high"
    },
    {
      "id": "s2",
      "title": "技术演进与建设流程",
      "intent": "timeline_process",
      "priority": "high"
    }
  ]
}
```

AI 负责：

- 章节抽取
- 页数估计
- 叙事顺序

程序负责：

- 校验结构
- 控制 section 数量

### Phase 2: VisualBrief

作用：

- 定义整套 deck 的视觉方向
- 不做页面排版，只定义统一设计语言

输出示例：

```json
{
  "version": "visual_brief/v1",
  "deckTone": "editorial_premium",
  "colorMode": "light_with_green_accent",
  "imageLanguage": "technical_illustration_plus_real_photo",
  "iconLanguage": "line_icon_with_filled_badge",
  "shapeLanguage": "soft_card_with_subtle_frame",
  "density": "medium",
  "avoid": [
    "dashboard",
    "consulting_template",
    "template_market_generic"
  ]
}
```

AI 负责：

- 定义视觉气质
- 指定图片和图标语言

程序负责：

- 把 brief 映射到可实现的 style system

### Phase 3: PagePlan

作用：

- 决定“每一页是什么类型”
- 但不决定低层坐标

输出示例：

```json
{
  "version": "page_plan/v1",
  "pages": [
    {
      "pageId": "p1",
      "pageType": "cover",
      "variantHint": "cover_hero_image",
      "sectionId": "s1",
      "title": "无线网络建设科普方案",
      "subtitle": "场景选型 · 品牌选择 · 建设运维全指南",
      "importance": "hero"
    },
    {
      "pageId": "p2",
      "pageType": "toc",
      "variantHint": "toc_card_grid_8",
      "sectionId": "s1"
    },
    {
      "pageId": "p3",
      "pageType": "comparison",
      "variantHint": "comparison_dual_image",
      "sectionId": "s1"
    }
  ]
}
```

AI 负责：

- pageType 选择
- 叙事节奏
- 重点页判断

程序负责：

- 限制 pageType 范围
- 控制相邻页面重复度

### Phase 4: AssetPlan

作用：

- 明确每页需要什么图片、图标、背景、插画

输出示例：

```json
{
  "version": "asset_plan/v1",
  "pageAssets": [
    {
      "pageId": "p1",
      "assets": [
        {
          "slot": "hero_bg",
          "kind": "background_photo",
          "query": "wireless network abstract technology green",
          "style": "clean, modern, corporate"
        }
      ]
    },
    {
      "pageId": "p3",
      "assets": [
        {
          "slot": "left_illustration",
          "kind": "illustration",
          "query": "wireless office connectivity illustration"
        },
        {
          "slot": "right_illustration",
          "kind": "illustration",
          "query": "wired office network illustration"
        }
      ]
    }
  ]
}
```

AI 负责：

- 素材需求规划
- 搜索词/素材描述

程序负责：

- 素材检索
- 图片下载/缓存
- 图标映射

### Phase 5: LayoutVariant

作用：

- 用程序维护固定 variant 库
- AI 不直接输出坐标，只能选择或建议 variant

Variant 示例：

- `cover_hero_image`
- `toc_card_grid_8`
- `comparison_dual_image`
- `timeline_horizontal_band`
- `process_route_6`
- `device_overview_atlas`
- `device_detail_split`
- `brand_compare_4col`
- `principles_card_grid`
- `scenario_guide_grid`
- `methods_image_cardgrid`
- `faq_split_cards`
- `closing_image_thanks`

每个 variant 由程序定义：

- 固定槽位
- 固定组件树
- 固定安全边界
- 固定文本密度限制

AI 负责：

- 选择 `variantHint`

程序负责：

- 真正的布局坐标
- 样式细节

### Phase 6: CanvasRenderModel

作用：

- 把 `PagePlan + AssetPlan + LayoutVariant + VisualBrief`
- 组合成最终画布模型

这一步仍然是结构化 JSON，但已经不再自由：

```json
{
  "version": "canvas_render_model/v1",
  "pageId": "p3",
  "pageType": "comparison",
  "variantId": "comparison_dual_image",
  "resolvedTheme": {},
  "slots": {
    "title": "无线与有线网络核心优势对比",
    "left_title": "无线网络 · 核心优势",
    "left_bullets": [
      "终端接入不受物理位置限制",
      "无需大规模布线",
      "扩容只需新增 AP"
    ],
    "right_title": "有线网络 · 主要局限",
    "right_bullets": [
      "终端依赖网口接入",
      "布线改造成本高",
      "IoT 场景适配差"
    ],
    "left_image": "asset://wireless_office_1",
    "right_image": "asset://wired_office_1"
  }
}
```

这一步是：

- 强约束
- 可预览
- 可编辑
- 稳定

### Phase 7: PptCompileModel

作用：

- 把 `CanvasRenderModel`
- 编译为真正的 `pptx`

程序负责：

- 坐标到 PPT 单位映射
- 字体/颜色/边框
- 图片裁切
- 表格构造
- 兼容性控制
- 输出 metadata

## Why This Is Better Than `ppt_scene` As The Main Path

### `ppt_scene` 主路线的问题

- 模型直接负责坐标，稳定性差
- 页面家族难统一
- 文本密度不可控
- PPT 兼容性容易出问题
- 很容易变成“看起来像模板实验，不像成品”

### 分阶段协议的优势

- AI 做擅长的高层决策
- 程序做擅长的稳定排版
- 更容易接素材系统
- 更容易做页面质量控制
- 更接近 Kimi/Doubao 的实际工作流

## System Responsibilities

### AI Responsibilities

- Outline 抽取
- Visual brief 生成
- PagePlan 生成
- AssetPlan 生成
- Variant 选择建议
- 文案压缩与重写

### Program Responsibilities

- Variant 库维护
- Slot schema 校验
- 图片检索和缓存
- 画布编译
- PPT 编译
- 排版安全边界
- 兼容性控制

## Suggested Data Contracts

正式协议建议新增以下类型：

- `PresentationOutline`
- `VisualBrief`
- `PagePlan`
- `AssetPlan`
- `LayoutVariantDefinition`
- `CanvasRenderModel`
- `PptCompileResult`

## Recommended Implementation Order

### Stage A

先做最小可用：

- `PresentationOutline`
- `PagePlan`
- `LayoutVariant`
- `CanvasRenderModel`
- `PptCompileModel`

先不做自由 scene。

### Stage B

再补素材系统：

- `AssetPlan`
- 图片检索
- 图标映射

### Stage C

最后再考虑是否保留 `ppt_scene`：

- 仅作为 R&D 实验格式
- 不再作为正式主链路

## Migration Strategy

当前已经生成的大量 `ppt_scene` 资产不要直接废弃。

处理方式：

- 把它们当成灵感库
- 从中挑出好的页面
- 人工或半人工转为正式 `LayoutVariant`

即：

`ppt_scene` 作为实验资产  
`LayoutVariant` 作为正式资产

## Final Recommendation

正式主路线应当是：

**AI 决定内容结构与页面策略，程序决定稳定版式与最终编译。**

这条路线更像 Kimi / Doubao，也更接近可上线的产品形态。
