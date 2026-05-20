# Gemini Prompt: PPT Scene Family Brief V1

Model:

`gemini-3.1-pro-preview`

Goal:

从当前 `ppt_scene_family/v1` 中抽取一份更紧凑的 family-level 设计 brief。

## Purpose

直接对 15 页做完整 `family lock` 容易因为容量不足失败。

因此先让模型输出一份更小的 `family brief`，用于：

- 统一 palette
- 统一字体系统
- 统一边框语言
- 统一图标语言
- 统一图片与 caption 语言
- 保留页面家族差异的前提下建立统一约束

## Prompt

```text
你将收到一个 `ppt_scene_family/v1` JSON。

你的任务不是重写页面，而是抽取一份更紧凑的 family-level 设计 brief。

请输出一个 JSON，结构如下：

{
  "version": "ppt_scene_family_brief/v1",
  "familyId": "string",
  "familyLabel": "string",
  "designIntent": ["string"],
  "palette": {
    "bg": "#xxxxxx",
    "surface": "#xxxxxx",
    "text": "#xxxxxx",
    "muted": "#xxxxxx",
    "primary": "#xxxxxx",
    "secondary": "#xxxxxx",
    "accent": "#xxxxxx",
    "border": "#xxxxxx"
  },
  "fonts": {
    "display": "string",
    "heading": "string",
    "body": "string",
    "mono": "string"
  },
  "shapeLanguage": {
    "cornerRadius": "low | medium | high",
    "borderWeight": "light | medium | strong",
    "frameStyle": "none | subtle | editorial | architectural",
    "shadowUsage": "none | sparse | moderate"
  },
  "imageLanguage": {
    "imageMode": "poster | editorial crop | framed photo | cinematic crop",
    "captionMode": "none | minimal | editorial | technical",
    "insetUsage": "none | rare | moderate"
  },
  "iconLanguage": {
    "iconMode": "line | filled | geometric | badge-based",
    "iconContainer": "none | circle | square | badge | mixed"
  },
  "decorativeSystem": {
    "lineUsage": "none | sparse | moderate | strong",
    "numberSystem": "none | subtle | strong",
    "labelSystem": "none | sparse | moderate",
    "watermarkUsage": "none | rare | moderate"
  },
  "pageRules": {
    "cover": ["rule", "rule"],
    "comparison": ["rule", "rule"],
    "summary": ["rule", "rule"],
    "section_break": ["rule", "rule"],
    "image_focus": ["rule", "rule"],
    "toc": ["rule", "rule"],
    "feature_grid": ["rule", "rule"],
    "timeline": ["rule", "rule"],
    "process": ["rule", "rule"],
    "kpi_poster": ["rule", "rule"],
    "table": ["rule", "rule"],
    "matrix": ["rule", "rule"],
    "quote": ["rule", "rule"],
    "icon_strip": ["rule", "rule"],
    "closing": ["rule", "rule"]
  }
}

要求：
- 只输出 JSON
- 不输出解释
- 不输出 Markdown
- brief 必须简洁，但足以驱动下一轮 family lock
- 目标是保留现有 family 中最强页面的气质，不要把它降级成普通商务模板
```
