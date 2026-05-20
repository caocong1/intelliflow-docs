# OSS AI PPT Source Map

这份文档记录本轮研究中每个项目最关键的源码入口，后续继续分析时可以直接从这里开始。

## 1. banana-slides

仓库：
- `https://github.com/Anionex/banana-slides`

本轮关键入口：
- `backend/README.md`
  - 后端职责与技术栈
- `backend/services/export_service.py`
  - `PPTX/PDF` 导出逻辑
- `backend/services/image_editability/*`
  - 可编辑导出、OCR、结构提取、背景修复
- `scripts/export_editable_pptx.py`
  - 可编辑 PPTX 导出 CLI

研究结论：
- 强在 AI-native 修改体验和高保真 fallback
- 可编辑导出是增强路径，不是天然主干

## 2. ai-to-pptx

仓库：
- `https://github.com/SmartSchoolAI/ai-to-pptx`

本轮关键入口：
- `README_Make_Template.md`
  - 模板制作规范，最关键
- `src/views/AiPPTX/StepTwoThreeGenerateOutline.tsx`
  - 大纲生成与编辑流
- `src/views/AiPPTX/StepFourSelectTemplate.tsx`
  - 模板选择流程
- `src/views/AiPPTX/StepFiveGeneratePpt.tsx`
  - PPT 生成与前端渲染

研究结论：
- 强在模板驱动和强约束页面结构
- 最值得借鉴的是 `variant / slot schema`

## 3. ppt-master

仓库：
- `https://github.com/hugohe3/ppt-master`

本轮关键入口：
- `docs/technical-design.md`
  - 核心技术路线说明
- `docs/why-ppt-master.md`
  - 对比其他路线的边界说明
- `skills/ppt-master/SKILL.md`
  - 实际工作流
- `skills/ppt-master/scripts/svg_to_pptx.py`
  - 导出入口
- `skills/ppt-master/templates/layouts/*`
  - layout 模板族
- `skills/ppt-master/templates/charts/*`
  - 图表/图形模板族

研究结论：
- 强在原生可编辑导出的技术边界和中间表示选择
- 不是完整产品平台，但对导出哲学最有参考价值

## 4. AiPPT

仓库：
- `https://github.com/veasion/AiPPT`

本轮关键入口：
- `README.md`
- `server/README.md`
  - 明确服务端核心未开源
- `ppt2json.html`
  - `PPT <-> JSON` 在线入口
- `static/ppt2canvas.js`
  - JSON 到 canvas 渲染
- `static/ppt2svg.js`
  - JSON 到 SVG 渲染/编辑

研究结论：
- 真正强项是解析/编辑/渲染内核
- 对 IntelliFlow 的价值主要在中间模型和编辑层

## 5. LandPPT

仓库：
- `https://github.com/sligter/LandPPT`

本轮关键入口：
- `README.md`
  - 全链路产品能力总览
- `src/landppt/services/outline/*`
  - 大纲工作流
- `src/landppt/services/slide/*`
  - 幻灯片生成、HTML 校验、修复、创意设计
- `src/landppt/services/template/*`
  - 模板选择与自由模板
- `src/landppt/web/route_modules/export_routes.py`
  - 导出路由
- `src/landppt/services/speech_script_exporter.py`
  - 讲稿导出
- `src/landppt/services/export_infra/*`
  - 浏览器渲染 / 导出基础设施
- `template_examples/*.json`
  - HTML 模板样例

研究结论：
- 当前最像完整平台的方案
- 最值得借鉴的是工作流分层、讲稿/备注和双路导出思路

## 6. PPTist

仓库：
- `https://github.com/pipipi-pikachu/PPTist`

本轮关键入口：
- `README.md`
  - 对自身定位说得最清楚
- `doc/AIPPT.md`
- `doc/DirectoryAndData.md`
- `src/store/slides.ts`
- `src/types/slides.ts`
- `src/hooks/useAIPPT.ts`
- `src/hooks/useExport.ts`
- `src/hooks/useLoadSlides.ts`

研究结论：
- 不是完整 AI 生成器
- 是高成熟 Web PPT 编辑器内核
- 强化了 `CanvasRenderModel` 必须成为主架构核心这一判断

## 7. 后续分析建议

如果未来要继续深挖，建议优先顺序：

1. `LandPPT`
2. `PPTist`
3. `ppt-master`
4. `ai-to-pptx`
5. `AiPPT`
6. `banana-slides`

原因：
- `LandPPT` 负责工作流骨架
- `PPTist` 负责编辑器中间层
- `ppt-master` 负责导出边界
- `ai-to-pptx` 负责 variant/slot 约束
- `AiPPT` 补 JSON/render 机制
- `banana-slides` 补 AI-native 修改体验与 fallback

