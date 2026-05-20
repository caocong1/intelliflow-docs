# AI Agent PPT 生成研究

本目录记录"为何 IntelliFlow PPT 生成视觉质量不佳"的全面研究及其优化路线。

## 目录结构

| 阶段 | 目录 | 产物 |
|---|---|---|
| 1 | `01-raw-sources/` | 各资料源原始抓取内容 |
| 2 | `02-individual-reports/` | 每个资料源的独立分析报告 |
| 3 | `03-horizontal-analysis/` | 横向对比报告 |
| 4 | `04-finalized-report/` | 定版综合报告 |
| 5 | `05-deep-dive/` | 对定版报告引用项目的深度挖掘 |
| 6 | `06-final/` | 终版报告 / Claude Code Skill |
| 7 | `07-code-review/` | 现有代码审查报告 |
| 8 | `08-optimization-plan/` | 优化实施计划 |

## 研究问题

IntelliFlow PPT 生成（4 层 LandPPT 风格 pipeline + 生产 archetype renderer）的视觉质量痛点：
- 布局不一致
- 文字层级薄弱
- 背景/图标/图片不连贯
- 跨页样式不延续

问题根因究竟是模型能力不足，还是 AI agent 各环节设计有可优化空间？本研究通过对 16 个资料源（10 个 skills.sh skill + AionUi + 5+ 外部 PPT 项目）的分析，给出定论与可落地的优化方案。

## 资料源清单

### Skills.sh (10 项)
1. anthropics/skills/pptx — 官方 PPTX skill（核心参考）
2. anthropics/skills/frontend-design
3. anthropics/skills/canvas-design
4. pbakaus/impeccable/polish
5. pbakaus/impeccable/critique
6. pbakaus/impeccable/bolder
7. pbakaus/impeccable/distill
8. vercel-labs/agent-skills/web-design-guidelines
9. leonxlnx/taste-skill/design-taste-frontend
10. leonxlnx/taste-skill/high-end-visual-design

### AionUi（专项研究）
11. iOfficeAI/AionUi — PPT Creator / Morph PPT / OfficeCLI 集成

### 外部项目（5+ 项）
12. icip-cas/PPTAgent — 学术 reflective agent + PPTEval（Content/Design/Coherence 三维评测）
13. hugohe3/ppt-master — IDE workflow 原生可编辑 PPTX
14. presenton/presenton — 开源 Gamma alternative
15. allweonedev/presentation-ai — ALLWEONE 开源 Gamma alternative
16. ai-forever/slides_generator — 单 prompt 框架
17. arcsin1/oh-my-ppt — HTML 本地优先
18. barun-saha/slide-deck-ai — 多 LLM 协作
19. danny0926/ppt-skills — Claude Code skill 格式参考

## 当前 IntelliFlow PPT 架构（背景）

详见 `docs/design/ppt-mvp/ai-pipeline.md`。简述：

- **MVP 实验路径**：4 层 LandPPT pipeline（TemplateGenes → StyleGenes → GlobalConstitution → PageBrief → RenderedPage HTML）→ headless Chrome PNG → pptxgenjs image-backed PPTX
- **生产路径**：内容 → 单次 AI 调用 → SlidePresentation JSON → archetype-aware 渲染器 / scene_canvas / html_fidelity
- **6 个 style packs**：corporate_blue / minimal_gold / tech_dark / warm_review / high_contrast / consulting_gray
- **6 个 archetype**：cover / toc / comparison / timeline / process / device_overview
