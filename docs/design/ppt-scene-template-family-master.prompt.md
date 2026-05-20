# Gemini Prompt: Full PPT Style Template Family

Model:

`gemini-3.1-pro-preview`

Goal:

让 Gemini 生成一整套风格模板家族，而不是单独几页。

## Master Prompt

```text
你不是在设计一份具体演示稿，而是在设计一整套 PPT 风格模板家族。

请输出一个结构化 JSON，用于定义一套完整的 PPT 页面家族。

目标：
- 高质量
- 高完整度
- 多页面结构
- 强设计语言
- 可编辑
- 可后续映射为 PPT

你必须覆盖：
- cover
- toc
- section break
- bullet/manifesto
- feature grid
- comparison
- timeline
- process
- kpi
- image focus
- table
- summary
- qna
- closing

额外要求：
- 包含背景图思路
- 包含图标使用思路
- 包含边框与装饰层语言
- 每类页面都必须明显不同
- 不能只是同一版式换颜色

风格方向：
- editorial
- premium
- brand deck
- asymmetric
- modern Chinese business presentation
- not dashboard
- not consulting template
- not template market cliché

输出要求：
- 只输出 JSON
- 不输出解释
- 不输出 Markdown

推荐输出结构：
{
  "version": "ppt_scene_family/v1",
  "familyId": "...",
  "familyLabel": "...",
  "theme": {},
  "pages": [
    {
      "pageType": "...",
      "scene": { ...ppt_scene/v1... }
    }
  ]
}
```
