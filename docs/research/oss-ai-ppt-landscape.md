# OSS AI PPT Landscape

日期：2026-04-16  
范围：

- `Anionex/banana-slides`
- `SmartSchoolAI/ai-to-pptx`
- `hugohe3/ppt-master`
- `veasion/AiPPT`
- `sligter/LandPPT`
- `pipipi-pikachu/PPTist`

本研究不是 README 摘要，而是基于本地代码与目录结构做的分层分析。目标只有一个：

**判断 IntelliFlow 要想把 PPT 生成功能做到接近 Kimi / 豆包水准，最优的系统组合应该是什么。**

---

## 1. 先讲结论

这 6 个项目并不在解决同一个问题。

它们分别落在 6 个不同的层：

1. `banana-slides`
   - 更像 AI-native 创作产品
   - 核心价值是自然语言局部重绘、风格跟随、交互体验

2. `ai-to-pptx`
   - 更像模板驱动产品
   - 核心价值是强结构模板和固定内容槽位

3. `ppt-master`
   - 更像可编辑导出编译器
   - 核心价值是 `SVG -> DrawingML/PPTX`

4. `AiPPT`
   - 更像 PPT 解析/编辑/渲染引擎
   - 核心价值是 `PPT <-> JSON` 和在线编辑模型

5. `LandPPT`
   - 更像全链路平台
   - 核心价值是工作流编排、模板系统、研究、讲稿、导出、分享的一体化

6. `PPTist`
   - 更像高成熟 Web PPT 编辑器本体
   - 核心价值是：页面/元素编辑、演示、JSON/画布模型、导出和 notes 支持

**因此不能“抄某一个项目”。**

如果要做最优方案，方向应该是：

- 学 `LandPPT` 的工作流分层
- 学 `ai-to-pptx` 的强约束 variant / slot schema
- 学 `AiPPT` 的编辑器 JSON 模型
- 学 `PPTist` 的高成熟编辑器和 canvas 交互能力
- 学 `ppt-master` 的可编辑导出边界
- 学 `banana-slides` 的 AI-native 修改体验和高保真 fallback 思路

---

## 2. 当前 IntelliFlow 的关键误区

我们前面已经踩过一次：

- 让 AI 直接生成自由 `ppt_scene` 低层坐标
- 再把它硬渲染为 `.pptx`

这个路线的问题不是“调得不够像”，而是**方向不对**。

根因有三类：

1. AI 不擅长长期稳定地产出低层绝对坐标
2. 页面 family、组件比例、文本裁剪没有系统化约束
3. 生成系统缺少中间画布模型和重入能力

这 6 个开源项目恰恰证明：

**真正成熟的 AI PPT 系统，不是“AI 直接吐 PPT 对象”，而是“AI 决策 + 程序化页面系统 + 受控导出”。**

---

## 3. 项目逐个分析

## 3.1 banana-slides

仓库定位：
- 一个基于 `nano banana pro` 的原生 AI PPT 生成产品
- 明确强调 `Vibe PPT`
- 支持“想法 / 大纲 / 页面描述”三种起步方式
- 支持自然语言局部修改、框选区域修改、参考图风格跟随

从代码和目录看：
- 前后端分离
- `backend/` 使用 Flask + SQLite + SQLAlchemy
- `frontend/` 是完整产品前端
- 后端有：
  - `services/ai_service.py`
  - `services/export_service.py`
  - `services/image_editability/*`
  - `services/file_parser_service.py`
- 导出脚本：
  - `scripts/export_editable_pptx.py`

### 它真正擅长什么

1. **AI-native 创作体验**
- 支持从一句话、大纲、页面描述起步
- 支持“口头修改”大纲和页面
- 支持局部重绘
- 这是一个非常强的产品交互优势

2. **参考图/风格跟随**
- 项目强调 nano banana pro 对文字、风格、参考图遵循很好
- 它明显把“图像生成质量”放在系统核心

3. **可编辑导出不是基础能力，而是 Beta 增强能力**
- README 写得很明确：可编辑 `pptx` 仍在 Beta 迭代中
- 相关入口：
  - `scripts/export_editable_pptx.py`
  - `services/image_editability/*`
- 这个模块本质是在做：
  - 图片结构分析
  - OCR / MinerU / hybrid extractor
  - 背景修复 / inpainting
  - 再拼可编辑 PPT

### 它不擅长什么

1. 它不是稳定的原生 PPT 页面系统
- 更接近“高保真图像优先，再往可编辑逼近”
- 这对成品感有帮助，但对**稳定、原生、结构化可编辑**不一定最优

2. 它对 AI 模型质量有强依赖
- README 核心卖点几乎都基于 `nano banana`
- 说明它更依赖图像生成模型本身，而不是确定性版式系统

### 对 IntelliFlow 的可借鉴点

值得学：
- AI-native 创作体验
- 自然语言局部改页
- 参考图/风格跟随
- 高保真导出 fallback

不该直接照搬：
- 把主路线押在“高保真图片先行，再反解可编辑”
- 对单一图像模型强绑定

### 结论

`banana-slides` 适合作为：

- **交互体验参考**
- **高保真图像 fallback 参考**

不适合作为 IntelliFlow 正式主链路的唯一基础。

---

## 3.2 ai-to-pptx

仓库定位：
- AI 自动生成 PPTX
- 支持在线修改和导出 PPTX
- 前端开源，后端是 PHP

最关键的文件：
- `README_Make_Template.md`
- `src/views/AiPPTX/StepTwoThreeGenerateOutline.tsx`
- `src/views/AiPPTX/StepFourSelectTemplate.tsx`
- `src/views/AiPPTX/StepFiveGeneratePpt.tsx`

### 它真正擅长什么

1. **强模板约束**

`README_Make_Template.md` 的模板制作要求非常说明问题：

- 首页：必须两个文本元素
- 目录页：必须 13 个文本元素
- 章节标题页：必须两个文本元素
- 内容页按：
  - `标题+2*2`
  - `标题+2*3`
  - `标题+3*2`
  - `标题+3*3`
  - `标题+4*2`
  - `标题+4*3`

这说明它的根基是：

**固定页面结构 + 固定槽位 + AI 只填内容**

2. **模板资产化**

它的模板不是抽象风格，而是：

- 先做一个 PPTX 示例
- 再转成 JSON
- 再接进系统

这和我们之前讨论的 `variant asset` 非常接近。

3. **流程很清楚**

从前端步骤看：

- 输入内容
- 生成大纲
- 编辑大纲
- 选模板
- 生成 PPTX

这是一条非常标准的产品链。

### 它的局限

1. 模板结构非常死
- 对稳定生成友好
- 对自由度和设计变化不友好

2. 很容易落成“模板站”
- 如果没有足够多的高质量模板族
- 最终就只是在选模板而已

3. 页面 family 不是 AI 学出来的
- 而是人工先定义好的

### 对 IntelliFlow 的可借鉴点

值得学：
- `variant / slot schema`
- 页面结构强约束
- 模板资产化流程

不该直接照搬：
- 把模板做成“文本元素计数驱动”的刚性系统
- 缺少 AI-native 改写和自由调节能力

### 结论

`ai-to-pptx` 对我们最有价值的不是产品界面，而是：

**它证明了强约束 variant 才是稳定生成的基础。**

---

## 3.3 ppt-master

仓库定位：
- 从 PDF / DOCX / URL / Markdown 生成 **原生可编辑 PPTX**
- 明确强调：不是截图、不是 HTML 截图、不是简单 `python-pptx` 文本框

关键文档：
- `docs/technical-design.md`
- `docs/why-ppt-master.md`
- `skills/ppt-master/SKILL.md`
- `skills/ppt-master/scripts/svg_to_pptx.py`

### 它真正擅长什么

1. **清晰的技术边界**

它把路线讲得非常清楚：

- 不直接让 AI 生成 DrawingML
- 不直接用 HTML/CSS 当最终语义源
- 不直接把 SVG 当图片嵌入

而是：

`AI 生成 SVG -> 脚本把 SVG 转为 DrawingML/PPTX`

2. **对“为什么这么做”有扎实论证**

它的核心论点：

- HTML 是 document flow，不是 slide canvas
- DrawingML 太底层，AI 训练数据和可调试性都不适合
- SVG 和 DrawingML 是更接近的一对中间表示

3. **原生可编辑导出目标明确**

它最在乎的是：

- 元素能点
- 能改色
- 能选中
- 不是平面图像

### 它的局限

1. 它自己也不承诺一遍 AI 直接出最终精品

技术设计文档说得很诚实：

- 输出是设计 draft，不是最终 polished deck
- 仍然期待人工 finishing

2. 它更像“生成编译器”，不太像完整产品系统

它有项目工作流，但不是一个强在线编辑平台。

3. 速度慢

它是顺序生成，强调一致性，天然不快。

### 对 IntelliFlow 的可借鉴点

值得学：
- 中间表示选择的严谨性
- 原生可编辑导出边界
- 讲稿 / speaker notes 作为独立产物
- 不把 HTML 当最终编辑语义源

不该直接照搬：
- 完全依赖 SVG 作为唯一页面模型
- 期待它直接解决产品交互和模板管理问题

### 结论

`ppt-master` 是 IntelliFlow 最值得学习的**导出哲学和编译边界**参考，
但不是完整产品架构答案。

---

## 3.4 AiPPT

仓库定位：
- AI 生成 PPT
- PPT 解析成 JSON
- JSON 反渲染为 PPT

但实际开源出来的重点是：

- `ppt2json.html`
- `static/ppt2canvas.js`
- `static/ppt2svg.js`
- 在线编辑器 / JSON 视图 / 渲染逻辑

并且 `server/README.md` 明确写了：

> 当前仅开源前端 PPT 渲染引擎代码，服务端代码暂未开放

### 它真正擅长什么

1. **PPT <-> JSON 的中间数据模型**

从 `ppt2json.html` 和静态脚本看，它有成熟的：

- `pptxObj.pages`
- `slideMasters`
- `slideLayouts`
- `children`
- `extInfo.property`

这是一套相当完整的中间层。

2. **在线编辑和渲染能力**

`ppt2canvas.js`：
- 把 JSON 渲染到 canvas
- 支持 slide master / layout / placeholder 继承

`ppt2svg.js`：
- 把 JSON 渲染成 SVG
- 支持 view / edit 模式
- 支持交互式选择与编辑

### 它的局限

1. 生成链核心没有开源
- 没法直接学它的 AI 生成策略

2. 它的价值主要在编辑器引擎，而不是生成策略

### 对 IntelliFlow 的可借鉴点

值得学：
- 中间 JSON 模型
- 在线编辑和预览能力
- `PPT -> JSON -> 编辑 -> 再导出` 这条链

不该直接照搬：
- 指望它告诉我们“如何生成好看的 PPT”

### 结论

`AiPPT` 对 IntelliFlow 的价值主要是：

**中间画布 / 编辑器数据模型参考。**

---

## 3.5 LandPPT

仓库定位：
- 基于 LLM 的智能演示文稿生成平台
- 支持：
  - 大纲生成
  - 幻灯片内容生成
  - 深度研究
  - 图像系统
  - 模板系统
  - 在线编辑
  - 讲稿生成
  - 备注导出
  - 双路 PPTX 导出
  - 分享与播放

它是目前 5 个里最接近**完整产品系统**的一套。

### 我读到的关键模块

Outline：
- `services/outline/outline_workflow_service.py`
- `project_outline_*`

Slide：
- `services/slide/slide_generation_service.py`
- `creative_design_service.py`
- `slide_html_service.py`
- `slide_html_validation_service.py`
- `layout_repair_service.py`

Template：
- `services/template/template_selection_service.py`
- `global_master_template_service.py`

Export：
- `web/route_modules/export_routes.py`
- `services/export_infra/html_render_service.py`
- `services/ppt_service.py`

Narration / Notes：
- `services/speech_script_service.py`
- `services/speech_script_exporter.py`

### 它真正擅长什么

1. **工作流分层非常完整**

它不是“一次生成 PPT”，而是清楚拆成：

- outline
- slide
- template
- research
- image
- narration
- export

2. **模板系统很强**

模板既支持：

- 全局主模板
- 参考 PPTX 抽模板
- 项目级自由模板

`template_selection_service.py` 还能看到：
- free template generation
- template html
- style genes / creative constitution / current page brief

这说明它不是只选模板，而是做：

**项目级模板生成 + 页面级创意控制**

3. **双路导出非常现实**

README 明确写：

- 标准 PPTX 导出（Apryse）
- 图片型 PPTX 导出（复杂 HTML/CSS 更高保真）
- 备注导出到 PPT 备注栏

这点非常重要，因为它承认了一个现实：

**不是所有页面都适合强行变成完全原生可编辑对象。**

4. **讲稿和备注是一等公民**

不是“有了再说”，而是：

- 独立讲稿生成
- DOCX / Markdown 导出
- 备注栏写入

这和你前面强调豆包每页 notes 很一致。

### 它的局限

1. 系统非常重
- 数据库
- 缓存
- 任务系统
- 多 provider
- 大量服务分层

2. 它大量依赖 HTML 模板与浏览器渲染
- 这在产品层面强大
- 但也意味着原生可编辑 PPTX 不会是唯一中心

### 对 IntelliFlow 的可借鉴点

值得学：
- 服务分层
- outline / slide / template / export 的工作流架构
- 双路导出
- 讲稿和备注体系
- 项目级模板生成

不该直接照搬：
- 整套重平台化工程体量
- 在还没验证核心页面系统前，就先做全平台能力

### 结论

`LandPPT` 是 IntelliFlow 在**工作流和产品架构层**最值得参考的项目。

---

## 3.6 PPTist

仓库定位：
- 一个 Web 端演示文稿编辑/放映应用
- 明确强调它的定位是 `Web Slide Editing/Presentation App`
- 提供 AI PPT 基础能力，但作者明确说明这不是它的核心定位

关键文档与代码：
- `README.md`
- `doc/AIPPT.md`
- `doc/DirectoryAndData.md`
- `src/store/slides.ts`
- `src/types/slides.ts`
- `src/hooks/useAIPPT.ts`
- `src/hooks/useExport.ts`
- `src/hooks/useLoadSlides.ts`
- `src/components/OutlineEditor.vue`

### 它真正擅长什么

1. **高成熟度编辑器能力**
- 支持文本、图片、形状、线条、图表、表格、视频、音频、公式
- 支持 notes、模板、动画、导出、放映
- 说明它不是简单预览器，而是一个成熟的编辑器内核

2. **中间模型意识很强**
- 支持导出 `PPTX / JSON / 图片 / PDF`
- 支持 page 和 node type labels
- 这说明系统中心不是 `.pptx` 文件，而是中间编辑/渲染模型

3. **作者自己明确限制了它的定位**
- 作为 AI PPT generation tool：只给 `⭐⭐`
- 作为 Web Slide Editing/Presentation App：给 `⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐`

这非常重要，因为它直接说明：

> `PPTist` 最适合做编辑器层，而不是直接拿来当完整 AI 生成链。

### 它的局限

1. 不是完整 AI 生成系统
- 不适合作为从内容到页面到导出的完整答案

2. Office 兼容并非最终目标
- 更适合做独立 slide product
- 不适合把它等同为“高保真 PPTX 兼容层”

3. AGPL 风险高
- 对商业闭源集成不友好

### 对 IntelliFlow 的可借鉴点

值得学：
- `Canvas / JSON / editor` 中间层设计
- 页面/节点类型标签体系
- notes、模板、导出、演示围绕同一数据模型组织

不该直接照搬：
- 编辑器本体
- AGPL 代码直接并入主产品

### 结论

`PPTist` 不是“又一个 AI PPT 生成器”，它真正强化的是：

**如果 IntelliFlow 要走长期正确的路线，`CanvasRenderModel` 必须是主架构核心，而不是附属层。**

---

## 4. 横向总结

## 4.1 如果按能力层来分

### 内容规划 / 大纲工作流
- 最强：`LandPPT`
- 次强：`banana-slides`
- 简化版：`ai-to-pptx`

### 模板 / variant / slot schema
- 最强：`ai-to-pptx`
- 次强：`LandPPT`
- `ppt-master` 也有 layout templates，但更偏导出工作流

### 在线画布 / JSON 编辑模型
- 最强：`AiPPT`
- 次强：`PPTist`
- 再次强：`LandPPT`

### 原生可编辑 PPTX 编译
- 最强：`ppt-master`
- `banana-slides` 也在做，但仍偏 Beta / image-editability

### 高保真图片型 fallback
- 最强：`banana-slides`
- 次强：`LandPPT`

### 讲稿 / notes
- 最强：`LandPPT`
- 次强：`ppt-master`

---

## 4.2 对 IntelliFlow 的最大启发

如果把这 5 个项目归纳成一句话：

> **好用的 AI PPT 产品，不是靠 AI 直接生成低层页面坐标，而是靠分层系统。**

这个分层系统至少要有：

1. 内容规划层
2. 页面 family / variant 层
3. 画布/中间模型层
4. 导出层
5. 讲稿 / notes 层
6. 高保真 fallback 层

---

## 5. 不该怎么做

基于这些项目，可以明确排除几条路线：

### 5.1 不要继续把主路线押在自由 scene 坐标
- 这是我们已经验证过的问题路线
- 开源项目里也没有一个成熟系统是靠它当主路

### 5.2 不要把“模板选择器”误当成完整架构
- `ai-to-pptx` 的强模板是基础
- 但它不是最终答案

### 5.3 不要幻想一种导出模式覆盖所有页面
- `LandPPT` 和 `banana-slides` 都在用双路思维
- 原生可编辑和高保真图像导出都需要

---

## 6. 应该怎么做

IntelliFlow 的最优路线应该是：

### 主路线
- `Outline / PagePlan / AssetPlan`
- `Variant / SlotSchema`
- `CanvasRenderModel`
- `NativeEditablePptCompile`

### 备用高保真路线
- 当页面复杂度超出 native editable 能力边界时
- 自动切到：
  - image-backed
  - 或 hybrid page export

### 编辑能力
- 中间层采用 JSON/Canvas 模型
- 允许局部页重入
- 允许 notes 独立生成与导出

---

## 7. 下一步研究建议

下一阶段建议继续做两件事：

1. 产出一份结构化对比矩阵
- 每个项目逐项打分和归类

2. 产出一份 IntelliFlow 最优架构建议
- 明确应该吸收的模块组合
- 明确第一阶段该做什么，不该做什么
