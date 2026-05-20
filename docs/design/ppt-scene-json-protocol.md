# PPT Scene JSON Protocol

## Purpose

这份协议用于让外部设计型 AI 直接生成一份可渲染为 PPT 的结构化 JSON。

目标不是生成 HTML 页面，也不是生成传统模板配置，而是生成一份 **PPT 场景图**：

- 每页是一个 1600 x 900 的画布
- 画布上放置绝对定位元素
- 元素类型限制在当前 PPT 生成链路稳定支持的范围内
- 保持高自由度，同时不退化成截图式 PPT

这份协议适合：

- Gemini
- Stitch
- 其他偏视觉设计型模型

不适合：

- 让模型直接输出 HTML/CSS 再转 PPT
- 让模型自由输出 PowerPoint XML
- 让模型自由定义动画、滤镜、混合模式等不稳定能力

## Design Principles

1. 高自由度，但只用稳定能力。
2. 每个元素必须显式定位，不能依赖 DOM 自动流式布局。
3. 不把“风格”限制成换配色，而是允许整页构图真正变化。
4. 输出必须适合后续映射到 `pptxgenjs` / 自定义 PPT renderer。
5. 不以“复刻原始模板”为目标，而是以“生成好看的成品 PPT”为目标。

## Stable Capability Boundary

当前协议只覆盖 PPT 生成链路中最稳定的一层：

- `text`
- `shape`
- `image`
- `table`
- `group`

可安全支持的表现能力：

- 绝对定位
- 字体、字号、字重、颜色
- 段落对齐
- 圆角矩形、椭圆、线条、多边形等常见形状
- 纯色填充
- 简单阴影
- 边框
- 图片裁切为 cover / contain / stretch
- 表格

明确不纳入协议：

- 动画
- 视频
- 任意 CSS
- 滤镜
- mask
- blend mode
- SVG filter
- 自动分页
- 自动换列
- 任意复杂渐变背景

说明：

渐变视觉仍可做，但建议通过 1-3 个大形状叠加实现，而不是依赖 PPT 背景渐变。

## Top-Level Schema

```json
{
  "version": "ppt_scene/v1",
  "meta": {
    "title": "string",
    "subject": "string",
    "language": "zh-CN",
    "canvas": {
      "width": 1600,
      "height": 900,
      "unit": "canvas"
    }
  },
  "theme": {
    "palette": {},
    "fonts": {},
    "textStyles": {},
    "shapeStyles": {}
  },
  "assets": {},
  "slides": []
}
```

## Coordinate System

- 全部坐标基于 `1600 x 900`
- 单位统一为 `canvas`
- 原点在左上角
- `x / y / w / h` 必填

后续渲染时，可把：

- `1600 x 900`
- 映射到 PPT 16:9 画布

## Theme Schema

### palette

```json
{
  "bg": "#F6F3EE",
  "surface": "#FFFDF8",
  "text": "#1E1B18",
  "muted": "#6B645C",
  "primary": "#B2452F",
  "secondary": "#D88C2E",
  "accent": "#2B6CB0",
  "success": "#2F855A",
  "warning": "#C05621",
  "border": "#E7DED2"
}
```

### fonts

```json
{
  "display": "Alibaba PuHuiTi 3.0 75 SemiBold",
  "heading": "Alibaba PuHuiTi 3.0 65 Medium",
  "body": "Alibaba PuHuiTi 3.0 45 Light",
  "mono": "JetBrains Mono"
}
```

### textStyles

```json
{
  "display": {
    "font": "display",
    "size": 34,
    "bold": true,
    "color": "{palette.text}",
    "lineHeight": 1.05,
    "align": "left",
    "valign": "mid"
  },
  "h1": {
    "font": "heading",
    "size": 24,
    "bold": true,
    "color": "{palette.text}",
    "lineHeight": 1.15
  },
  "h2": {
    "font": "heading",
    "size": 18,
    "bold": true,
    "color": "{palette.text}",
    "lineHeight": 1.15
  },
  "body": {
    "font": "body",
    "size": 12,
    "color": "{palette.text}",
    "lineHeight": 1.45
  },
  "caption": {
    "font": "body",
    "size": 10,
    "color": "{palette.muted}",
    "lineHeight": 1.35
  },
  "eyebrow": {
    "font": "heading",
    "size": 10,
    "bold": true,
    "tracking": 120,
    "uppercase": true,
    "color": "{palette.primary}"
  },
  "kpi": {
    "font": "display",
    "size": 40,
    "bold": true,
    "color": "{palette.text}",
    "lineHeight": 1.0
  }
}
```

### shapeStyles

```json
{
  "card": {
    "fill": "#FFFDF8",
    "stroke": "#E7DED2",
    "strokeWidth": 1,
    "radius": 24,
    "shadow": {
      "color": "#000000",
      "opacity": 0.08,
      "blur": 18,
      "distance": 4,
      "angle": 90
    }
  },
  "pill": {
    "fill": "#F0E7DB",
    "stroke": "#00000000",
    "strokeWidth": 0,
    "radius": 999
  }
}
```

## Slide Schema

```json
{
  "id": "slide_cover",
  "name": "封面",
  "designIntent": "editorial",
  "compositionTags": ["asymmetric", "premium", "poster"],
  "density": "low",
  "notes": "演讲备注",
  "background": {
    "fill": "#F6F3EE"
  },
  "elements": []
}
```

### slide fields

- `id`: 唯一 ID
- `name`: 页名
- `designIntent`: 设计意图，可选
- `compositionTags`: 构图标签，可选
- `density`: `low | medium | high`
- `notes`: 演讲备注，可选
- `background.fill`: 页背景纯色
- `elements`: 元素数组

## Common Element Fields

所有元素必须带这些字段：

```json
{
  "id": "string",
  "type": "text | shape | image | table | group",
  "x": 0,
  "y": 0,
  "w": 100,
  "h": 100,
  "z": 0,
  "rotate": 0,
  "opacity": 1
}
```

## Element Types

### 1. text

```json
{
  "id": "title_1",
  "type": "text",
  "x": 120,
  "y": 120,
  "w": 620,
  "h": 180,
  "z": 20,
  "styleRef": "display",
  "paragraphs": [
    {
      "align": "left",
      "valign": "mid",
      "runs": [
        {
          "text": "无线网络建设",
          "color": "{palette.text}"
        },
        {
          "text": "全流程指南",
          "color": "{palette.primary}"
        }
      ]
    }
  ],
  "fit": "shrink"
}
```

#### text fields

```json
{
  "styleRef": "display | h1 | h2 | body | caption | eyebrow | kpi",
  "paragraphs": [
    {
      "align": "left | center | right | justify",
      "valign": "top | mid | bottom",
      "spaceBefore": 0,
      "spaceAfter": 8,
      "bullet": {
        "type": "bullet",
        "indent": 18,
        "hanging": 6
      },
      "runs": [
        {
          "text": "string",
          "font": "display | heading | body | mono",
          "size": 16,
          "bold": true,
          "italic": false,
          "underline": false,
          "color": "#111111",
          "highlight": "#FFF2CC",
          "tracking": 0,
          "uppercase": false
        }
      ]
    }
  ],
  "padding": {
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0
  },
  "fit": "shrink | clip"
}
```

### 2. shape

```json
{
  "id": "bg_block_1",
  "type": "shape",
  "shape": "rect",
  "x": 0,
  "y": 0,
  "w": 1600,
  "h": 900,
  "z": 0,
  "fill": "#F6F3EE",
  "stroke": "#00000000",
  "strokeWidth": 0,
  "radius": 0
}
```

#### supported shape values

```json
[
  "rect",
  "roundRect",
  "ellipse",
  "line",
  "triangle",
  "rtTriangle",
  "diamond",
  "hexagon",
  "chevron"
]
```

#### shape fields

```json
{
  "fill": "#FFFFFF",
  "stroke": "#111111",
  "strokeWidth": 1,
  "strokeDash": "solid | dash | dot",
  "radius": 24,
  "shadow": {
    "color": "#000000",
    "opacity": 0.1,
    "blur": 18,
    "distance": 4,
    "angle": 90
  }
}
```

### 3. image

```json
{
  "id": "hero_img",
  "type": "image",
  "assetRef": "hero_1",
  "x": 980,
  "y": 110,
  "w": 480,
  "h": 620,
  "z": 10,
  "fit": "cover",
  "radius": 28,
  "stroke": "#FFFFFF",
  "strokeWidth": 0,
  "shadow": {
    "color": "#000000",
    "opacity": 0.12,
    "blur": 24,
    "distance": 8,
    "angle": 90
  }
}
```

#### image fields

```json
{
  "assetRef": "string",
  "src": "https://example.com/image.jpg",
  "fit": "cover | contain | stretch",
  "radius": 24
}
```

### 4. table

```json
{
  "id": "compare_table",
  "type": "table",
  "x": 110,
  "y": 220,
  "w": 1380,
  "h": 420,
  "z": 10,
  "columns": [260, 370, 370, 380],
  "header": [
    {
      "text": "维度",
      "fill": "{palette.primary}",
      "color": "#FFFFFF",
      "align": "center"
    },
    {
      "text": "方案 A",
      "fill": "{palette.primary}",
      "color": "#FFFFFF",
      "align": "center"
    }
  ],
  "rows": [
    [
      { "text": "成本" },
      { "text": "低" },
      { "text": "预算敏感优先 A" }
    ]
  ],
  "cellStyle": {
    "font": "body",
    "size": 11,
    "color": "{palette.text}",
    "padding": 10,
    "fill": "#FFFDF8",
    "borderColor": "{palette.border}",
    "borderWidth": 1,
    "align": "left",
    "valign": "mid"
  },
  "stripe": {
    "enabled": true,
    "fill": "#F8F3EA"
  }
}
```

### 5. group

`group` 只是逻辑分组，渲染时可以展平。

```json
{
  "id": "kpi_cluster",
  "type": "group",
  "x": 920,
  "y": 180,
  "w": 520,
  "h": 260,
  "z": 30,
  "children": [
    {
      "id": "card_a",
      "type": "shape",
      "shape": "roundRect",
      "x": 0,
      "y": 0,
      "w": 240,
      "h": 120,
      "fill": "#FFFDF8",
      "stroke": "#E7DED2",
      "strokeWidth": 1,
      "radius": 24
    },
    {
      "id": "num_a",
      "type": "text",
      "x": 20,
      "y": 24,
      "w": 200,
      "h": 48,
      "styleRef": "kpi",
      "paragraphs": [
        {
          "runs": [
            { "text": "87%" }
          ]
        }
      ]
    }
  ]
}
```

## Recommended Deck-Level Rules

把这些规则一起发给 AI：

```text
1. 只输出 JSON，不输出解释。
2. 使用 1600x900 画布坐标。
3. 不要输出 HTML、CSS、SVG、Markdown。
4. 不要依赖自动布局、flex、grid、DOM 流式排版。
5. 每个元素必须显式给出 x/y/w/h。
6. 背景层请用 full-canvas shape 实现，不要使用复杂背景特效。
7. 每页必须有明显不同的构图，不允许整套 PPT 只是同一布局换颜色。
8. 同一 deck 至少使用 4 种不同构图方法，例如 editorial cover、asymmetric cards、timeline band、comparison split、magazine quote、data poster。
9. 正文字号尽量 >= 22px 的视觉感知密度，避免过密。
10. 文本不要溢出，fit 只能用 shrink 或 clip。
11. 图片只作为 image 元素，不要嵌入 base64 超长字符串，优先 assetRef。
12. 不要使用插件难稳定支持的能力：动画、视频、任意 CSS filter、mask、blend mode、复杂 SVG filter、自动分页。
13. 如果内容密集，优先拆页，不要把所有内容塞进一页。
14. 同一页最多只保留一个主叙事焦点。
```

## Example Deck

下面给一个 3 页最小示例，只示范结构，不追求完整内容。

```json
{
  "version": "ppt_scene/v1",
  "meta": {
    "title": "无线网络建设全流程指南",
    "subject": "无线网络",
    "language": "zh-CN",
    "canvas": {
      "width": 1600,
      "height": 900,
      "unit": "canvas"
    }
  },
  "theme": {
    "palette": {
      "bg": "#F6F3EE",
      "surface": "#FFFDF8",
      "text": "#1E1B18",
      "muted": "#6B645C",
      "primary": "#B2452F",
      "secondary": "#D88C2E",
      "accent": "#2B6CB0",
      "success": "#2F855A",
      "warning": "#C05621",
      "border": "#E7DED2"
    },
    "fonts": {
      "display": "Alibaba PuHuiTi 3.0 75 SemiBold",
      "heading": "Alibaba PuHuiTi 3.0 65 Medium",
      "body": "Alibaba PuHuiTi 3.0 45 Light",
      "mono": "JetBrains Mono"
    },
    "textStyles": {
      "display": {
        "font": "display",
        "size": 34,
        "bold": true,
        "color": "{palette.text}",
        "lineHeight": 1.05,
        "align": "left",
        "valign": "mid"
      },
      "h1": {
        "font": "heading",
        "size": 24,
        "bold": true,
        "color": "{palette.text}",
        "lineHeight": 1.15
      },
      "body": {
        "font": "body",
        "size": 12,
        "color": "{palette.text}",
        "lineHeight": 1.45
      }
    },
    "shapeStyles": {}
  },
  "assets": {},
  "slides": [
    {
      "id": "cover",
      "name": "封面",
      "designIntent": "editorial",
      "compositionTags": ["poster", "asymmetric"],
      "density": "low",
      "background": {
        "fill": "#F6F3EE"
      },
      "elements": [
        {
          "id": "bg_left",
          "type": "shape",
          "shape": "rect",
          "x": 0,
          "y": 0,
          "w": 980,
          "h": 900,
          "z": 0,
          "fill": "#F6F3EE",
          "stroke": "#00000000",
          "strokeWidth": 0
        },
        {
          "id": "bg_right",
          "type": "shape",
          "shape": "rect",
          "x": 1040,
          "y": 0,
          "w": 560,
          "h": 900,
          "z": 1,
          "fill": "#B2452F",
          "stroke": "#00000000",
          "strokeWidth": 0
        },
        {
          "id": "cover_title",
          "type": "text",
          "x": 120,
          "y": 180,
          "w": 720,
          "h": 180,
          "z": 10,
          "styleRef": "display",
          "paragraphs": [
            {
              "align": "left",
              "runs": [
                { "text": "无线网络建设" },
                { "text": "全流程指南", "color": "{palette.primary}" }
              ]
            }
          ],
          "fit": "shrink"
        }
      ]
    },
    {
      "id": "comparison",
      "name": "对比页",
      "designIntent": "magazine",
      "compositionTags": ["split", "contrast"],
      "density": "medium",
      "background": {
        "fill": "#FFFDF8"
      },
      "elements": [
        {
          "id": "title",
          "type": "text",
          "x": 100,
          "y": 80,
          "w": 1400,
          "h": 60,
          "z": 10,
          "styleRef": "h1",
          "paragraphs": [
            {
              "runs": [
                { "text": "无线 vs 有线：建设方式对比" }
              ]
            }
          ],
          "fit": "shrink"
        }
      ]
    },
    {
      "id": "summary",
      "name": "总结页",
      "designIntent": "poster",
      "compositionTags": ["cards", "takeaway"],
      "density": "medium",
      "background": {
        "fill": "#F6F3EE"
      },
      "elements": []
    }
  ]
}
```

## Prompt Pack

下面给出可以直接投喂模型的 prompt。

### 1. System Prompt

```text
你是一个 PPT 场景图设计器，不是 HTML 页面生成器，也不是传统模板配置器。

你的任务是输出一个完全符合 `ppt_scene/v1` 协议的 JSON，用于后续渲染为可编辑的 PPT。

你必须遵守：
- 只输出 JSON
- 不输出解释
- 不输出 Markdown
- 不输出 HTML
- 不输出 CSS
- 不输出 SVG
- 不输出动画
- 不输出视频
- 所有元素必须显式给出 x/y/w/h
- 只允许元素类型：text, shape, image, table, group
- 背景效果必须使用 shape 分层表达
- 不允许整套 PPT 只是同一布局换颜色
- 必须让每页构图真正不同

你的输出目标不是“像网页”，而是“像优秀设计师做的 PPT 页面”。
```

### 2. Universal User Prompt Template

```text
请基于以下内容，生成一个完全符合 `ppt_scene/v1` 协议的 JSON。

主题：{{TOPIC}}
语言：{{LANGUAGE}}
页数：{{SLIDE_COUNT}}
目标受众：{{AUDIENCE}}
设计气质：{{DESIGN_INTENT}}
内容密度：{{DENSITY}}

内容原文：
{{CONTENT}}

硬性要求：
1. 画布固定为 1600x900。
2. 不允许输出 HTML / CSS / Markdown / SVG。
3. 同一 deck 至少使用 4 种不同构图。
4. 每页必须有明确视觉焦点。
5. 不要把所有信息塞成咨询风 bullet page。
6. 可以使用大色块、留白、卡片、数字海报、杂志式标题、分栏、时间带、引用墙、数据海报。
7. 如果内容太多，优先拆页。
8. 图片使用 assetRef 或 src，不要输出 base64。
9. 只输出 JSON，不解释。

输出协议：
[在这里粘贴 ppt_scene/v1 协议]
```

### 3. Gemini Prompt

```text
你现在是“PPT 视觉编排设计师”。

请输出一个 `ppt_scene/v1` JSON，用于生成一份高设计感、可编辑的 PPT。
不要输出任何解释，只输出 JSON。

设计目标：
- 不要像模板站 PPT
- 不要像网页后台
- 不要每页都同一版式换颜色
- 要有真正变化的构图
- 适合中文商业演示，但更像 editorial presentation / brand deck

页面要求：
- 封面：必须强构图
- 目录：不能只是普通列表
- 中间页：混合使用 split layout、band layout、poster layout、card cluster、table layout
- 总结页：要有强收束感

内容：
{{CONTENT}}

输出协议：
[粘贴本协议]
```

### 4. Stitch Prompt

```text
Design a presentation scene deck as structured JSON, not HTML.

Return only a valid `ppt_scene/v1` JSON object.

Visual direction:
- bold
- editorial
- asymmetric
- premium
- high contrast hierarchy
- strong whitespace
- card clusters
- poster-like slides

Rules:
- canvas 1600x900
- absolute positioning only
- element types only: text, shape, image, table, group
- no HTML
- no CSS
- no animation
- no SVG filters
- every slide must have a distinct composition
- preserve editability for final PPT generation

Content:
{{CONTENT}}

Protocol:
[paste ppt_scene/v1 spec]
```

## Recommended First Experiment

不要一开始就让模型生成 20 页。

建议先生成 3 页：

1. cover
2. comparison
3. summary

这三页最容易判断它到底是在“换设计”，还是只是在“换配色”。

## Workflow Recommendation

建议采用这个流程：

1. 先让 AI 只生成 `3 slides`
2. 人看 JSON 是否真的有不同构图
3. 如果构图合格，再扩展为整份 deck
4. 再把这份协议接到本地 renderer

## What To Avoid

不要让模型这样做：

- 让每页都变成标题 + 两栏 + 文本块
- 把所有风格变化都压缩成配色变化
- 用超多小卡片硬塞内容
- 模仿网页 dashboard
- 用“渐变背景 + 大标题 + 三个卡片”无限重复

## Local File

本文件路径：

`docs/design/ppt-scene-json-protocol.md`
