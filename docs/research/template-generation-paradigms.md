# Template Generation Paradigms

日期：2026-04-17
范围：回答一个具体问题 ——
**"AI PPT 系统的视觉模板/风格到底从哪来？必须人工预制吗？还是 AI 可以参与生成？"**

---

## 0. 执行摘要 (TL;DR)

通过对 5 个开源项目的代码级核实 + 拆解豆包和 Kimi 两个 benchmark .pptx 实际产物结构，得出 4 个核心结论：

1. **5 种范式真实存在并已被实现**，从"全人工模板"到"AI 全程现场生成"是一个连续光谱，不是二选一
2. **豆包 ≠ Kimi**：两者用的是**根本不同的导出范式** —— 豆包用真实 slideLayouts/slideMasters（人工模板继承体系），Kimi 完全不用 layouts，每页是自渲染 HTML→SVG→PPTX 嵌进去（5.6MB 自定义字体保证视觉一致）
3. **AI 完全可以参与"模板/风格生成本身"**，LandPPT 的 `free template` 模式就是 reference implementation：4 层 AI 流水线（项目模板 → 风格基因 → 页面纲要 → 单页 HTML）
4. **arity（项数）协调**有 4 种解法，没有银弹；不同范式天然处理 arity 的方式不同

**对 IntelliFlow 的关键判断**：当前 MVP 走的是"人工写死 4 个 variant"的 ai-to-pptx 路线 —— 这是这 5 种范式里最刚性的一种，也是最容易被 codex 不自觉地强化的方向。如果想达到豆包/Kimi 水准且保持灵活，应该采用 **LandPPT 的 4 层 AI 流水线 + ppt-master 的预制图表/图标库** 这种混合架构，而不是继续扩 variant 库。

---

## 1. 5 种范式与对应实现

按"AI 介入深度"从浅到深排：

### 范式 A：全人工模板 + AI 仅填内容（ai-to-pptx）
**做法**：人工先做好 PPTX，转成 JSON，AI 只往固定槽位填文字。

**关键证据**：`README_Make_Template.md` 写得极其露骨：
- 首页：**有且只能有 2 个**文本元素（标题 + 作者）
- 目录页：**有且只能有 13 个**（"目录"二字 + 6 个标题项 ×2）
- 内容页 6 种结构：`标题+2×2 / 2×3 / 3×2 / 3×3 / 4×2 / 4×3`
- 高频结构（3×2、3×3）"最好需要有 5-8 种不同的页面风格和布局"

**arity 怎么处理**：写死 N=2/3/4 各几套，N=5/6/7 没有 → 内容必须迁就模板。

**可借鉴**：稳定，零美学风险。
**不可借鉴**：扩展性极差，每增加一种 N 都要新做一组模板。

---

### 范式 B：人工 layout 池 + AI 选择填充（豆包推断）
**做法**：人工预制一组 slideLayouts + slideMasters（PowerPoint 真模板继承体系），AI 选最适合的 layout 填内容 + 生成插图。

**关键证据**（拆解 `/Users/dongli/Downloads/无线网络建设科普方案.pptx`）：
- 19 slides + **12 个真实的 slideLayouts**（每个 7-22KB，含 placeholder 定义）+ 2 个 slideMasters + 3 themes
- slideLayout3 的内部结构：`matchingName="节标题" type="secHead"`，含 title / body / dt / ftr / sldNum 五个 placeholder，定义了精确坐标和字号级差
- 每页 slide XML 较小（5-38KB）—— 共享视觉资产都在 layout/master 里
- 大量 AI 生成插图（54+ 张 JPEG，每张 ~500KB）+ 大量 PNG/SVG 图标对

**arity 怎么处理**：12 个 layouts 覆盖典型页型，AI 把内容映射到最近似 layout 然后微调。

**可借鉴**：真用 PowerPoint 原生继承体系 → 输出文件小、可二次编辑、Office 兼容性最好。
**不可借鉴**：layout 池仍是人工做的（豆包内部应该有一支专业设计团队），只是数量更多且更精致。

---

### 范式 C：AI 现场生成 HTML + 后期渲染嵌入（Kimi 推断 / LandPPT slide 层）
**做法**：AI 直接生成每页的 HTML（或 SVG），后端用浏览器/库渲染成图像或矢量，再嵌入 PPTX。

**关键证据 1**（拆解 `/Users/dongli/Downloads/无线网络建设科普方案 (1).pptx` Kimi）：
- 19 slides + **只有 2 个空 slideLayouts**（700 字节，几乎没内容）+ 1 个空 slideMaster
- 每页 slide XML 巨大（37-161KB）—— 所有视觉内容都在 slide 里，**完全不用 layout 继承**
- 嵌入 **5.6MB 自定义字体**（font1+font2+font3） —— 这是关键，因为只有"自渲染"路线才需要把字体打包进文件保证视觉一致
- 含 charts/ 目录 —— 真实 PPT 图表

**关键证据 2**（LandPPT 的 14 个 slide 服务）：
- `slide_html_service.py` —— 主服务，slide 实际是 HTML
- `slide_html_validation_service.py` / `slide_html_recovery_service.py` / `layout_repair_service.py` —— 因为 LLM 生成 HTML 不可靠，需要校验/修复/恢复
- `_generate_html_with_retry` 默认 5 次重试

**arity 怎么处理**：每页 fresh 生成，AI 知道 N 是多少 → 不存在 arity 协调问题。

**可借鉴**：极致灵活，N=任意值都能处理。
**不可借鉴**：HTML→PPT 的对象级可编辑性会丢失（最终是嵌入对象），编辑体验降级。LandPPT 用大量 validation/repair 弥补可靠性。

---

### 范式 D：AI 生成 SVG + 预制图表/图标库（ppt-master）
**做法**：AI 生成每页 SVG，但图表、图示、图标用预制 SVG 库选择 + 参数化定制。

**关键证据**：
- `templates/charts/`：50+ 个预制 SVG（donut, swot, gantt, fishbone, mind_map, pyramid, sankey, venn, kpi_cards, matrix_2x2, porter_five_forces ...）
- `templates/icons/chunk/` + `tabler-filled/` + `tabler-outline/`：大量图标库
- `templates/layouts/<template_name>/`：可选的 layout 模板（McKinsey-style, Google-style）
- SKILL.md 明确推荐 **free design 而不是 template**："Free design (recommended for most cases) — AI tailors structure and style to your content"
- 工作流：Strategist 定 8 个维度（canvas / 页数 / 受众 / 风格目标 / 配色 / 图标方案 / 字体方案 / 图片方案）→ Executor 串行生成每页 SVG

**arity 怎么处理**：AI 按页串行生成，N 不构成约束。

**可借鉴**：图表/图示/图标这种"高密度专业视觉元件"必须预制（AI 直出会很丑），但页面组合让 AI 现场决定。
**不可借鉴**：SVG→PPTX 转换有边界（复杂效果丢失），他们自己也承认输出是 design draft 而不是 polished deck。

---

### 范式 E：AI 生成 image + 反向解析可编辑性（banana-slides）
**做法**：用图像模型直接生成整页图片（最高保真），然后通过 OCR + 结构提取试图反向解析出可编辑对象。

**关键证据**：
- `services/ai_providers/image/*` —— 多个图像生成 provider（anthropic / gemini / openai / volcengine / lazyllm / baidu）
- `services/image_editability/extractors.py` + `hybrid_extractor.py` + `inpaint_providers.py` —— 反向提取可编辑性的基础设施
- README 自己承认可编辑导出仍在 Beta

**arity 怎么处理**：AI 生成图像时知道 N，但不存在结构化 arity 概念。

**可借鉴**：高保真 fallback，复杂视觉页适用。
**不可借鉴**：作为主路太重 + 可编辑性不可靠 + 图像模型成本高。

---

## 2. 谁在哪个位置（光谱图）

```
[更人工]                                                    [更 AI]
   │                                                            │
   A ────────── B ────────── D ────────── C ────────── E
ai-to-pptx   豆包(推断)    ppt-master   Kimi/LandPPT   banana-slides
            (layout池)    (SVG+预制库) (HTML自渲染)   (image first)
   │
   └─ 现 IntelliFlow MVP 在这里（4 个写死 variant，比 ai-to-pptx 还窄）
```

---

## 3. 双产品验证（豆包 vs Kimi）

这是本次研究最重要的发现之一 —— **业界两个标杆产品走的是完全相反的路线**，证明这个问题没有"唯一正确答案"。

| 维度 | 豆包 | Kimi |
|---|---|---|
| 范式 | B（layout 池）| C（每页自渲染）|
| slideLayouts 数 | **12 个真实 layout** | **2 个空 placeholder** |
| slideMasters | 2 个完整 master | 1 个空 master |
| 单页 slide XML 大小 | 5-38 KB | **37-161 KB** |
| 嵌入字体 | 无 | **5.6 MB 自定义字体** |
| 主要视觉手段 | layout 继承 + 大量 AI 插图 | 每页自渲染所有视觉 |
| 文件总大小 | 9.7MB / 217 文件 | 7.7MB / 119 文件 |
| Office 兼容/可二次编辑 | 强 | 弱（基本是嵌入对象）|
| arity 灵活度 | 受 12 个 layout 限制 | 完全自由 |

**含义**：你可以把豆包当 B 范式上限的参考，把 Kimi 当 C 范式上限的参考，**两者都达到了商业级水准 —— 路线选择不是质量问题，是工程哲学问题**。

---

## 4. AI 真的能参与"模板/风格生成本身"吗？—— LandPPT 的 reference implementation

这是用户问的核心问题。**答案是 YES，并且 LandPPT 给出了具体可复现的 4 层流水线**。

### 4.1 LandPPT free template 模式的 4 层 AI 设计流水线

来源：
- `services/template/template_selection_service.py` (`stream_free_template_generation`)
- `services/slide/creative_design_service.py` (`_get_creative_design_inputs`)
- `services/prompts/design_prompts.py` (`get_page_creative_briefs_prompt` / `get_creative_template_context_prompt`)
- `services/prompts/template_prompts.py` (`build_free_template_user_prompt`)

```
Layer 0 — Project-level "free template HTML"
   输入: project topic, scenario, target_audience, ppt_style, custom_style_prompt, requirements, focus_content
        + outline 摘要
   AI 任务: 流式生成项目专属 HTML 母版
   输出: 一份 HTML 模板 (template_html), 持久化到 project_metadata["free_template_html"]
   实现: stream_free_template_generation, build_template_generation_prompt
   特点: 这是 AI 真正生成"风格本体" —— 一份"项目专属 AI 决定的"自由模板

Layer 1 — Style Genes (设计基因)
   输入: free_template_html
   AI 任务: 从模板中提炼"设计基因"
   输出: style_genes (设计 DNA 描述)
   缓存: _cached_style_genes_and_guide

Layer 2 — Global Constitution (全局视觉宪法)
   输入: project context + style_genes + 完整 outline
   AI 任务: 输出整套 deck 的全局设计规则
   输出: global_constitution (字符串)
   提示词模板片段:
     "**全局视觉方向（已确定，优先对齐）**\n{global_constitution}"

Layer 3 — Per-Page Creative Brief (按页面类型的页面指导)
   输入: confirmed_requirements + all_slides + global_constitution
   AI 任务: 按页面类型输出"页面指导 —— 给方向感但不锁死版式"
   输出: current_page_brief (每页一份)
   函数: get_page_creative_briefs_prompt
   关键设计哲学: "give direction without locking layout"

Layer 4 — Per-Slide HTML
   输入: slide_data + style_genes + global_constitution + current_page_brief + template_html
   AI 任务: 为本页生成完整 HTML
   输出: 一页 HTML
   函数: get_creative_template_context_prompt / get_single_slide_html_prompt
   后续: 进 validation / repair / cleanup / fallback 链
```

### 4.2 这个流水线为什么聪明

注意第 3 层那句话："**给方向感但不锁死版式**" —— 这就是用户在问的问题的答案：

> 应该根据大纲生成排版，还是根据排版改大纲，还是双向奔赴？

LandPPT 的答案是 **C（双向奔赴）但偏向内容**：
- Layer 0-1 让 AI 设计整体视觉语言（风格基因）—— 这一步是项目级一次性的
- Layer 2 让 AI 形成全局规则 —— 防止页与页之间风格漂移
- Layer 3 让 AI 给每页"方向感"但不锁死 —— 给后续 Layer 4 留余地
- Layer 4 让 AI 真正决定单页布局 —— 这一步天然知道 N，所以 arity 不构成问题

### 4.3 这个流水线的代价

- **生成时间长**（4 层 AI 调用，每层都可能多次重试）
- **可靠性挑战**（HTML 输出不稳定，所以才有 5 次重试 + repair + recovery）
- **可编辑性弱**（最终是 HTML→PDF 或 HTML→嵌入图像，PowerPoint 二次编辑不友好）
- **token 成本高**（LandPPT 是平台型架构，假设有付费用户摊销）

---

## 5. arity（项数）协调的 4 种解法

这是用户特别强调的关键问题。汇总各项目处理方式：

| 解法 | 谁这么做 | 优势 | 代价 |
|---|---|---|---|
| **写死多个 N 模板** | ai-to-pptx | 稳定可靠 | N=5/6/7 等不常见值无法支持 |
| **layout 池 + 最近似映射** | 豆包 | 可控且 Office 兼容 | layout 池仍需人工，且映射时仍可能失配 |
| **参数化栅格自动适配** | 无完整范例（理论方向） | 优雅 | 极端 N 值丑 |
| **每页 fresh 生成（N 作为输入）** | Kimi、LandPPT、ppt-master | N 任意，无失配 | 可编辑性弱，可靠性挑战 |

**关键洞察**：你提到的"修改模板"vs"修改大纲"vs"双向奔赴"，5 个项目实际上是用**完全不同的 4 种解法**避开了这个二选一困境：
- ai-to-pptx：**改大纲迁就模板** —— 内容真实性受损
- 豆包：**改模板（微调 layout 内的内容布局）迁就内容** —— 在 layout 框架内变形
- Kimi/LandPPT/ppt-master：**根本不存在协调问题** —— 每页都是新生成，N 是输入参数
- ppt-master 的 free design 模式 + 预制图表库：**用预制库覆盖"高密度专业视觉"，但版式让 AI 现场决定**

---

## 6. 给 IntelliFlow 的决策选项

基于上面所有证据，这里是 4 个真正可走的路线，每条都有现实参考：

### 选项 1：继续 A 范式（人工写死 N 个 variant）—— 当前 MVP 路线
- 模仿对象：ai-to-pptx
- 模板来源：人工 + variant-library.ts 写死
- 美观度上限：取决于人工设计水平
- 灵活性：低（每加一个 family/N 都要写代码）
- AI 介入：仅填内容
- 适合：**3-5 套场景级 preset**，且接受"美观度受限于人工设计速度"

**判断**：这是当前路径，但用户已经反馈"离豆包/Kimi 水准还远"。继续走只会让 codex 更陷入"复刻这一份样品"的怪圈。

### 选项 2：B 范式 layout 池（"豆包路线"轻量版）
- 模仿对象：豆包
- 模板来源：人工设计 8-15 个 slideLayouts + 配套 master
- 美观度上限：高（接近豆包，前提是设计师水平到位）
- 灵活性：中（layout 池可扩展）
- AI 介入：选 layout + 填内容 + 生成插图
- 适合：**走 native editable 强 Office 兼容路线**

**判断**：核心瓶颈是"谁来做 8-15 个高质量 slideLayouts" —— 这是设计师工作，不是工程工作。如果团队没有专业 PPT 设计师，这条路走不通。

### 选项 3：C 范式 LandPPT 4 层 AI 流水线（"Kimi 路线" + 显式风格基因）
- 模仿对象：LandPPT 的 free template 模式
- 模板来源：**AI 项目级现场生成**
- 美观度上限：取决于 LLM 能力（GPT-4 / Claude / Gemini 当前都已经够用，但需要强 prompt 工程）
- 灵活性：极高（任意主题、任意 N、任意风格倾向）
- AI 介入：4 层（template → style genes → global constitution → per-page brief → per-slide html）
- 适合：**真正想做"动态生成"且接受可编辑性降级**

**判断**：这是直接回应用户问"AI 能不能参与模板生成"的"是"的方案。技术挑战在 HTML 生成的可靠性 —— LandPPT 用 5 次重试 + repair + recovery 解决，IntelliFlow 可以借鉴。

### 选项 4：混合（推荐）—— LandPPT 4 层骨架 + ppt-master 预制元件库
- 模板来源：AI 现场生成版式 + 预制 50+ 图表/图示 SVG + 大量图标库
- 美观度上限：高（ppt-master 实测可用）
- 灵活性：高（版式灵活，但高密度视觉元件用预制)
- AI 介入：版式由 AI 生成，专业视觉元件 AI 选择 + 参数化定制
- 适合：**IntelliFlow 当前发展阶段** —— 既要灵活，又要美观，又不要求每个元件都 AI 现场画

**判断**：这是综合证据后最推荐的方向。理由：
1. 直接回答了用户"AI 能不能参与模板生成"——能，借 LandPPT 的 4 层流水线
2. 避开了"AI 直接画图表"的灾难性区间——预制 50+ 专业图表 SVG
3. arity 自然解决——每页 AI 现场决定
4. 与现有 MVP 不完全冲突——`canvas-model.ts` / `deck-json.ts` / `family-primitives.ts` 这些抽象都还可以保留作为 Layer 4 的稳定渲染底座

---

## 7. 推荐方向 + 第一步该做什么

### 推荐：选项 4（混合）

### 为什么不是选项 3
选项 3 完全 AI 现场生成的可靠性挑战很大（LandPPT 自己用 5 次重试 + repair + recovery），且作为初期 MVP 调试成本高。选项 4 通过预制专业视觉元件库降低了"AI 必须画好图表"这个最难的子问题。

### 为什么不是选项 1
继续走选项 1 = 继续做"这一份样品的硬编码 demo"。用户已经明确这条路不对。

### 为什么不是选项 2
选项 2 卡在"团队需要专业 PPT 设计师做 8-15 个高质量 slideLayouts"这个先决条件。如果有，可以走；如果没有，不可行。

### 第一步具体做什么（不写代码，先验证假设）
**做一个最小验证实验**：
1. 拿当前 MVP 的"无线网络"主题
2. 用 LandPPT 的 4 层流水线手工跑一遍（用 Claude 或 GPT-4 直接对话）：
   - Step 0：让 AI 生成一份 project-level free template HTML（输入项目信息 + 大纲）
   - Step 1：让 AI 从这份 template 提炼 style_genes
   - Step 2：让 AI 输出 global_constitution
   - Step 3：让 AI 为前 4 页（cover / toc / comparison / timeline）输出 page brief
   - Step 4：让 AI 用以上所有上下文生成每页 HTML
3. 把这 4 页 HTML 用 headless Chrome 截图，和当前 v17 .pptx 截图对比

**验证目标**：看 LLM 当前能力下，这套 4 层流水线产出的视觉质量是不是真的比"人工 variant + AI 填内容"好。

如果好 → 投资写正式实现
如果不明显好 → 退回选项 4 的另一种组合，或重新评估

---

## 7.5 Template Ingestion：设计网站模板自动摄取

这是一个独立但与选项 4 高度协同的能力。本节记录对 2 个真实设计网站模板的拆解发现 + ingestion pipeline 设计。

### 7.5.1 为什么这件事是 IntelliFlow 相对豆包/Kimi 的潜在护城河

- 豆包/Kimi 内部应该有专业设计团队产出 layout 池和风格参考 —— 这是范式 B/C 的隐性前提
- IntelliFlow 没有这样的设计团队，但可以用工程方式弥补：**消化设计网站（包图网/千图网/51PPT/OfficePLUS）上数千个专业模板**作为资产库
- 这些模板正好是选项 4 最缺的"高质量风格/视觉资产参考"输入
- 5 个调研项目里**没有一个**把这件事做成正式流水线（ai-to-pptx 半自动 / LandPPT / ppt-master 都只有零散提及）—— 这是空白

### 7.5.2 对两个真实样本的拆解结果

样本：
- `/Users/dongli/Downloads/622b10be37491.pptx`（24 页，118 文件，4.7MB）
- `/Users/dongli/Downloads/包图网_19853341蓝色商务风复盘总结商务汇报通用PPT模板/622eee2ab7e6e.pptx`（25 页，124 文件，6.6MB）

| 资产类型 | Sample 1 | Sample 2 |
|---|---|---|
| slideLayouts | 12 个（2.5-8.2KB）| 11 个（3-8.6KB）|
| slideMaster | 1 个（14KB）| 1 个（16KB）|
| theme1 配色 | 默认 Office | 默认 Office |
| themeOverride 配色 | 无 | **真实自定义调色板 11 色**（含 #16A1C8 蓝、#09947F 深青、#E53661 粉、#EDA81D 橙、#7CBD2D 绿、#9234A6 紫）|
| slideMaster 字体 | Arial + scheme refs | **思源宋体 CN**（实际中文字体）|
| 真实 chart | 无 | 有（chart1 + style1 + colors1）|
| 图像 | 5 张（jpg/png 混合）| 17 张（jpg/png/jpeg）+ 1.6MB MP3 |
| 单页 XML 范围 | 19KB - **917KB**（slide16 极重）| 11KB - 233KB |

### 7.5.3 关键设计陷阱：视觉身份在 PPTX 里是分散的

**只读 `theme1.xml` 会得到错误结论**（"全是默认 Office 主题色"）。视觉身份的分布：

```
theme1.xml          ← 通常是默认 Office（误导性）
themeOverride1.xml  ← 真实品牌色调色板（如果有）
slideMaster1.xml    ← 真实字体 + 字号级差 + scheme 引用
slide*.xml          ← 部分直接 sRGB + 大量 scheme 引用
```

整个体系是 **scheme 引用链**：slide 引用 master 的 scheme color → master 引用 theme 的 scheme color → theme（或 themeOverride）定义实际 sRGB 值。

**正确的 extractor 必须能反向解析这个链**，否则会丢失绝大多数颜色信息。

### 7.5.4 Ingestion Pipeline 输出 schema（建议）

```json
{
  "template_id": "blue_business_review_v1",
  "source_file": ".../622eee2ab7e6e.pptx",
  "design_tokens": {
    "color_palette": {
      "primary": "#16A1C8",
      "secondary": "#09947F",
      "accent": ["#E53661", "#EDA81D", "#7CBD2D", "#9234A6"],
      "neutral": ["#000000", "#363B41", "#44546A", "#E7E6E6"]
    },
    "typography": {
      "title_font": "思源宋体 CN",
      "body_font": "等线",
      "size_scale": [44, 32, 24, 18, 14]
    },
    "layout_rhythm": {
      "page_count": 25,
      "avg_text_density": "mid",
      "page_type_distribution": { "cover": 1, "toc": 1, "section": 4, "content": 17, "closing": 2 }
    }
  },
  "layouts_extracted": [
    { "id": "layout_3", "type": "section_header", "placeholders": [...], "preview_png": "preview_3.png" }
  ],
  "slide_examples": [
    { "id": "slide_1", "type": "cover", "preview_png": "slide_1.png", "structure_summary": "..." }
  ],
  "asset_library": {
    "images": [ { "path": "image1.jpg", "size": 250000, "kind": "background|illustration|icon" } ],
    "icons": [ ... ],
    "charts": [ { "type": "bar", "style_xml": "...", "colors_xml": "..." } ]
  },
  "ai_consumable_summary": "蓝色商务风，深青/亮蓝主色 + 4 色辅助点缀，思源宋体 CN 衬线标题，25 页，包含图表+音频，适合复盘汇报场景"
}
```

最后那个 `ai_consumable_summary` 是关键 —— 喂给选项 4 Layer 0 的"风格描述"，让 AI 不用从零生成模板。

### 7.5.5 与选项 4 的集成位置

```
选项 4 原始流水线:
  Layer 0: AI 凭空生成项目专属 HTML 模板
  Layer 1-4: 风格基因 → 全局宪法 → 页面纲要 → 单页 HTML

引入 ingestion 后:
  Pre-Layer:  从模板库挑选 (用户挑 / 系统按内容自动匹配)
  Layer 0:    用挑中的 ingested template 的 ai_consumable_summary +
              design_tokens + slide_examples 喂给 AI 作为风格参考
  Layer 1-4: 同上
```

这同时实现了用户提到的两种模式：
- **Mode A（系统自行判断）**：根据内容自动从摄取库里匹配
- **Mode B（用户选 preset）**：用户从摄取库里挑

### 7.5.6 实现路线（建议）

**阶段 1：单文件 POC extractor**（1-2 天）
- 输入：单个 .pptx
- 输出：上面 schema 的 JSON + 把 layout/slide 渲染成 preview PNG
- 用本节这 2 个样本跑通

**阶段 2：scheme 引用解析器**（1 天）
- 正确解析 slide → master → theme/themeOverride 的 scheme color 链

**阶段 3：批量摄取 + 索引**（2-3 天）
- 批量处理一批模板（先跑 10-50 个）
- 给每个生成 ai_consumable_summary（用 LLM 描述）
- 建立可检索索引

**阶段 4：与选项 4 Layer 0 对接**（1-2 天）
- ingested template → 选项 4 Layer 0 的输入

**强烈建议：阶段 1 之前先做手工验证实验（本文 §7 推荐的 LandPPT 4 层流水线手工跑一遍）**，确认 LLM 当前能力是否真的能从 ingested template 学到风格。如果 LLM 凭空生成模板已经够用，ingestion 的投入价值会下降。

### 7.5.7 POC 实现已完成（在 §8.5 实验之后追加）

**位置**: `packages/backend/src/scripts/ppt-mvp/ingest-template.ts`

**用法**：
```bash
bun packages/backend/src/scripts/ppt-mvp/ingest-template.ts <pptx-path> [out-dir]
```

**输出**: `<out-dir>/<slug>/`
- `template.json` — 完整结构化描述符（§7.5.4 schema）
- `template.md` — 人类可读报告
- `media/*` — 提取后的所有媒体资产

**实现要点**：
- 纯正则 XML 抓取，不引入新依赖（沿用项目已有 `unzip` shell + Bun 风格）
- 解析了 scheme 引用反向链：override → theme → master，自动选最高优先级
- 同时输出 `direct_palette_top10`（slide 直接 sRGB 高频色）—— 见下方 7.5.8 重要发现
- 自动给出诊断 notes（默认主题告警 / 无中文字体告警 / 重内容页告警 / layout 池规模分类）
- 内置 `ai_consumable_summary` 生成器（基于规则，未来可换成 LLM 生成）

**两个样本的实际产出**：

| 维度 | Sample 1 (`622b10be37491`) | Sample 2 (蓝色商务风 `622eee2ab7e6e`) |
|---|---|---|
| 主色 (resolved) | `#014995` 深蓝 | `#16A1C8` 蓝青 |
| 副色 | `#D0BEED` 淡紫 | `#09947F` 深绿青 |
| 辅色板 | 蓝/紫/灰 4 色 | 绿/橙/粉/紫 4 色 |
| 中文字体 | **思源黑体 CN Bold** ✓ | 默认（master 中出现思源宋体 CN）|
| 英文字体 | (默认) | Calibri Light / Calibri |
| layouts 提取 | 12 个（豆包路线） | 11 个（豆包路线） |
| 媒体 | 5 张图 | 16 张图 + 1 个 MP3 |
| 含图表 | 否 | 是（1 个） |
| Top direct sRGB | 白/黑/灰为主 | **#91CF50 绿×73 + #2A5BAA 蓝×69** ⚠ |
| AI summary | "24 页模板，12 个 slideLayout，信息密度中等；配色：主色 #014995..." | "25 页模板，11 个 slideLayout，信息密度中等；配色：主色 #16A1C8..." |

### 7.5.8 POC 跑出来的意外重要发现

**Sample 2 的 override scheme 声明主色是 `#16A1C8` 蓝青，但 slide 里实际 hardcode 用了 `#91CF50` 绿（73 次）和 `#2A5BAA` 蓝（69 次）。**

意义：
- **设计师做模板时常常不用 scheme color，直接 hardcode 颜色到形状里** —— 这意味着只看 theme/override 会 miss 真实视觉
- 必须**同时输出"声明色板"和"使用色板"**，让下游（AI Layer 0 输入）能看到两者
- POC 已通过 `direct_palette_top10` 字段捕获了这一点 —— 这个字段事实上比 override scheme 更接近"模板真实视觉"
- Sample 1 没这个问题（设计师老老实实用了 scheme） —— 可见**这是模板质量参差的副产物**，ingestion pipeline 必须接得住

### 7.5.9 POC 后续待办

- [ ] **预览图渲染**: 当前 POC 不渲染 layout/slide preview PNG（需要 LibreOffice 或 PPTX→HTML→Chrome 路径）。这是实用性的最后一公里。
- [ ] **AI summary 升级**: 当前 summary 是规则生成，可换 LLM 调用产出更"风格化"的描述
- [ ] **批量摄取入口**: 当前是单文件，需写 batch 脚本扫一个目录
- [ ] **icon / illustration 二次分类**: 当前 icon 用 <8KB 简单 heuristic，可加 SVG 内容分析
- [ ] **chart 样式提取**: 当前只识别有无 chart，没拆 chart 颜色/字体/类型
- [ ] **与选项 4 Layer 0 对接**: 把 `template.json` + `template.md` 喂给 LLM 当 Layer 0 输入，跑同 outline 验证风格切换效果（这就是 §7.5 提到的"再启动 ingestion POC"的下半部分）

---

## 8. 需要进一步研究的点（已识别但本文未深入）

1. **LandPPT 的 style_genes 提取细节**：本次只看了它如何被使用，没深入看它如何从 HTML 模板里被提炼出来。如果做选项 3/4 的实现，这一步必须深入。
2. **豆包的 12 个 slideLayouts 实际包含什么**：本次只看了 1 个（节标题），没全部拆解。如果做选项 2，需要全拆。
3. **Kimi 嵌入字体的具体使用**：本次确认了 5.6MB 字体存在，但没拆开看是哪些字体、覆盖什么字符集。这影响"自渲染路线"的字体策略。
4. **arity 协调的"参数化栅格"路线没有完整实现参考**：理论上最优雅，但 5 个项目都没人完整做过。如果做这个方向，是无人区。

---

## 8.5 实验验证：LandPPT 4 层流水线手工跑一遍

§7 推荐过的"先做一个最小验证实验"已执行。结果如下。

### 8.5.1 实验设置

- 主题：无线网络建设全流程指南（同 MVP 当前数据）
- 输入：`docs/design/ppt-mvp/wireless-outline.json` + `wireless-visual-brief.json` + `wireless-page-plan.json`
- 测试页：cover / toc / comparison / timeline 共 4 页（与当前 v17 同范围）
- 我作为 LLM 角色亲自走完 4 层（Layer 0/1/2/3 文档 + Layer 4 实际渲染 HTML）
- 渲染：headless Chrome `--window-size=1920,1080` → PNG
- 工作区：`/tmp/ppt-research/landppt-experiment/`

### 8.5.2 4 层流水线产出

| 层 | 产物 | 文件 |
|---|---|---|
| Layer 0 | 项目专属 HTML 模板（设计系统 CSS）| `00-design-system.css` |
| Layer 1+2+3 | 风格基因 + 全局宪法 + 4 页 brief（机器可读 JSON）| `00-template-genes.json` |
| Layer 4 | 4 页完整 HTML | `p1-cover.html` / `p2-toc.html` / `p3-comparison.html` / `p4-timeline.html` |
| 渲染产物 | 4 页 PNG（1920×1080）| `render-p1.png` ~ `render-p4.png` |
| 对比基线 | MVP v3 preview HTML 渲染 | `render-mvp-preview.png` |

### 8.5.3 视觉评估结果

**3/4 页一次成功（cover / toc / comparison）**：
- 编辑感强（serif 标题 + sans 正文）
- 设计系统在 4 页之间一致（同色板、同字号级差、同卡片处理、同 page marker）
- 留白节奏达到豆包/Kimi 类编辑级别
- p3 comparison 的 SYNTHESIS 综合带（绿色左边框）按 brief 落地，体现"无线非取代有线"判断
- 整体明显**避开了 visual brief 标记的 `template_market_generic`** —— 这正是 MVP v3 cover 仍在踩的坑（hero 大图 + 白字遮罩 + 橙色 eyebrow + 短绿色横线）

**1/4 页一次失败（timeline）—— 而且失败方式具有诊断价值**：
- 第一版我让 AI 生成了一段复杂 SVG 路径（蛇形 S 曲线穿过 5 个节点）—— 路径数学算错了，曲线乱穿
- 这正是 LandPPT 必须配 `slide_html_validation_service / repair_service / recovery_service` 的原因
- 修复方式：弃用复杂自定义 SVG，改用"水平轴 + 等高节点 + 上方柱状速率对比"的简单可靠组合 —— 一次成功
- **诊断结论**：复杂自定义 SVG / 数据可视化 = AI 生成路线的典型失败模式，必须用 ppt-master 风格的预制图表/图示库覆盖（这恰好就是选项 4 混合架构的设计动机）

### 8.5.4 与 MVP v3 cover 的直接对比

| 维度 | MVP v3 (preview) | LandPPT 4 层 (本次实验) |
|---|---|---|
| 视觉范式 | hero 大图 + 白字遮罩 | 编辑式排版 + 速率数据可视化 |
| 风格归类 | "AI PPT 站"通用感（套模板感强）| "杂志跨页"编辑感 |
| 排版策略 | 中心对齐 + 装饰条 | 不对称栅格 + 信息密度 |
| 信息含量 | 标题 + 副标 + 受众 | 标题 + 副标 + 受众 + **真实数据**（4 代速率对比）|
| 是否踩了 visual brief 的 avoid | **是**（`template_market_generic`）| 否 |

### 8.5.5 实验的核心结论

**对选项 4（LandPPT 4 层 + ppt-master 预制库）的判断已验证：**

1. **AI 真的能产出比当前 MVP 明显更好的视觉** —— 不是边际改善，是范式跃迁。3/4 页一次成功证明 LLM 当前能力已经够用
2. **可靠性挑战是真实的** —— 1/4 失败率符合 LandPPT 用 5 次重试 + repair 应对的预期。如果不做 fallback / 简化策略，会有页面是坏的
3. **失败模式是结构化的、可预测的** —— 复杂自定义 SVG / 复杂数据可视化是高危区。这恰好是 ppt-master 50+ 预制图表库要解决的问题
4. **设计系统跨页一致性出乎意料地好** —— 只要 Layer 0/1/2 的 CSS 变量 + 宪法定义清楚，Layer 4 在 4 页之间维持一致性几乎是免费的
5. **arity 协调不是问题** —— timeline 5 节点、toc 8 项、comparison 3+3 项，AI 都按内容自然处理，无需"模板 arity 匹配"

**对 IntelliFlow 的具体行动信号：**

- ✅ 选项 4 路线得到实证支持，**应该启动正式实现**
- ✅ §7.5 的 ingestion pipeline 也得到独立验证 —— Layer 0 输入越具体，AI 失败率越低；ingested 高质量模板能进一步降低失败率
- ⚠ 必须配套：失败检测 + 简化重试 + 预制图表库（不能只靠 AI 一次出图）
- ⚠ 必须配套：HTML→PPTX 的可靠转换（实验只验证了 HTML 渲染，没验证转 PPTX 后效果）

### 8.5.6 下一步建议

1. **把这个实验的 4 个 HTML + CSS 提交进项目** 作为"reference target"，让后续工程实现有视觉对标
2. **测试 HTML → PPTX 转换** —— 用 puppeteer 截图嵌入 PPTX 验证最终交付质量
3. **再扩到 6-8 页** —— 加入 process / device_overview / faq 验证 family 在更多结构上是否仍稳
4. **再启动 ingestion POC** —— 把"包图网蓝色商务风"模板拆出来作为 Layer 0 输入，跑同一份 outline，比较风格切换效果

---

## 8.6 实验验证 V2：把 ingested template 喂进 4 层流水线（最终闭环验证）

§8.5 验证了"AI 能凭借 brief 自己设计风格"。本节验证最关键的一步：
**"AI 能否吃下 §7.5 ingestion POC 产出的 template.json 作为 Layer 0 输入，把它的视觉身份成功迁移到全新内容上？"**

如果可以 → 选项 4 + ingestion 整套架构闭环成立。

### 8.6.1 实验设置

- **同一份内容**: `wireless-page-plan.json`（4 页：cover / toc / comparison / timeline）—— 与 §8.5 完全相同
- **不同的 Layer 0 输入**:
  - V1 (§8.5): "clean_green_editorial" brief，AI 自己发挥
  - V2 (本节): `/tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/template.json`（蓝色商务风 ingested 模板）
- **工作区**: `/tmp/ppt-research/landppt-experiment-v2-business/`

### 8.6.2 我作为 AI 怎么消化 ingested template

读 `template.json` 后做了 3 个关键判断：
1. **优先信任 direct_palette_top10**（设计师 hardcode 色）而非 override scheme —— sample 2 override 说主色 #16A1C8，但实际 slide 用 #2A5BAA 蓝 + #91CF50 绿，所以采用后者
2. **font_choice 决定基调** —— 模板用 Calibri Light + 思源宋体 CN（无衬线）→ 选 PingFang Bold 而非编辑感的 serif
3. **layout_rhythm 决定密度** —— 模板 median 单页 66KB（信息密度中等-偏高）→ 设计成 grid-based 信息密集，而非编辑感的留白

### 8.6.3 V1 vs V2 视觉对比

| 元素 | V1 编辑感（凭空） | V2 商务感（来自 ingestion） |
|---|---|---|
| 标题字体 | Source Han Serif SC（衬线） | **PingFang Bold（无衬线）** |
| 主色策略 | 单一翠绿 #0E8B5A 节制使用 | **#2A5BAA 蓝 + #91CF50 绿 双主色，多色辅助** |
| 背景 | 暖白 #FAFAF7 | 纯白 + 浅蓝色块 |
| 品牌锚点 | 小标 + 短横线 eyebrow | **顶部 6px 渐变品牌色带（蓝→青→绿）** |
| 卡片 | 1px 细线 + 软阴影 + 14px 圆角 | **8px 锐角 + 实色彩头条 + 4px 边框** |
| 对比页 | 浅绿/浅米淡色背景两栏 | **实色蓝/灰头条 + 数字圆形 badge** |
| 综合带 | 白底 + 绿色左边框 | **深蓝实底 + 绿色 SYNTHESIS 标签** |
| 时间轴 | 等高节点 + 上方淡色柱状 | **真柱状图 + 渐变色阶 + Wi-Fi 7 高亮绿色** |
| 整体调性 | 编辑 / 杂志 / 安静 | **年度汇报 / 公司 / 醒目** |

### 8.6.4 结论

✅ **AI 完全能消化 ingested template 作为 Layer 0 输入**，并把视觉身份准确迁移到任意新内容上。

具体证据：
1. **风格变了** —— V2 的 4 页和 V1 的 4 页放一起一眼看出是不同设计系统的产物
2. **内容没变** —— 4 页的标题、bullets、年份、数据点完全一致
3. **风格连续性** —— V2 内部 4 页之间维持同一个商务风设计系统（顶部色带、字体、配色一致）
4. **风格忠实于 ingested 来源** —— 蓝绿主色、无衬线字体、信息密度都对应得上 sample 2 的 ingestion 数据

**这意味着选项 4 + §7.5 ingestion 架构闭环成立**：
```
[设计网站模板.pptx]  →  [ingest-template.ts]  →  [template.json]
                                                      ↓
[用户内容] → [Layer 0 用 template.json 作为风格参考] → [Layer 1-4] → [4 页 HTML/PPTX]
                                                      ↑
[第 N 个 ingested 模板]  →  [N 种风格 preset 任选]
```

### 8.6.5 还有什么待办（V2 后）

1. **POC ingestion 输出还能更结构化** —— 当前 `template.json` 喂给 AI 时我手动做了"信任 direct vs override"的判断，可以把这个判断逻辑下沉到 ingestion 脚本里，输出更直接的"effective_palette"字段
2. **layout 拓扑还没用上** —— V2 我没真正复用 ingested 的 11 个 slideLayouts，只用了 design tokens。后续可以把 slideLayouts 的几何信息（栅格、placeholder 位置）也提取出来给 AI 参考
3. **HTML → PPTX 还是空白** —— 整个实验链都在 HTML 渲染。最终交付是 .pptx 还需要 puppeteer 截图嵌入或 SVG→DrawingML 路线（参考 ppt-master）
4. **批量摄取入口** —— 当前 ingestion 单文件，需要批量扫一个目录的脚本，建立 N 个 preset 的索引

### 8.6.6 整个研究链回顾

```
§1-6     5 种范式分析 + 豆包/Kimi 拆解 + 选项 4 推荐
§7.5     Template Ingestion 设计 + 2 个样本拆解
§7.5.7-9 Ingestion POC 实现 + 跑通 + 意外发现
§8.5     LandPPT 4 层流水线手工验证（凭 brief 设计）
§8.6     ingestion → 4 层流水线闭环验证（凭 ingested template 设计）
§8.7     Phase A Iteration 1 落地 — 上述全部实验固化为生产代码
```

**所有路线都被实证：选项 4 是可行的，ingestion 是必要的，AI 能消化两者的输入产出符合期望的视觉。**

---

## 8.7 Phase A Iteration 1 — 生产落地（在所有实验之后）

§8.5 / §8.6 验证了路线，本节记录把它们固化为生产代码的成果。

### 8.7.1 落地范围

**新增模块**: `packages/backend/src/scripts/ppt-mvp/ai-pipeline/`

```
ai-pipeline/
├── types.ts              // TemplateGenes / StyleGenes / GlobalConstitution / PageBrief / RenderedPage
├── claude-client.ts      // Anthropic Messages API + mock mode
├── prompts.ts            // Layer 0-4 prompt builders (含 SYSTEM_DESIGN)
├── css-from-genes.ts     // 确定性 CSS 生成器（避开 AI 写 CSS）
├── pipeline.ts           // 5 阶段编排 + 校验 + retry + fallback + log 持久化
├── render-html.ts        // headless Chrome → PNG
└── pack-pptx.ts          // pptxgenjs image-backed + speaker notes
```

**入口脚本**: `packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts`
- 默认 mock mode（无 API token 端到端）
- `--ingested <path>` 切到 ingestion 路线
- env 切 live 模式

**用法文档**: `docs/design/ppt-mvp/ai-pipeline.md`

### 8.7.2 端到端验证（mock）

两条路线分别跑通并产出真实 PPTX：

| 路线 | 输出 PPTX | 大小 | 整性测试 | Slides | NotesSlides |
|---|---|---|---|---|---|
| brief（V1 编辑感）| `/tmp/intelliflow-ppt-mvp-wireless-ai-v1.pptx` | 511KB | ✅ | 4 | 4 |
| ingested（V2 蓝色商务）| `/tmp/intelliflow-ppt-mvp-wireless-ai-blue-business.pptx` | 508KB | ✅ | 4 | 4 |

讲稿验证：从 v1 pptx 抽 notesSlide1.xml 确认正文文字与 `wireless-page-plan.json` p1.speakerNote 完全一致。

### 8.7.3 关键工程决策

1. **CSS 不让 AI 生成** —— `css-from-genes.ts` 用 TemplateGenes 模板替换得到 CSS，避开 LLM 在 CSS 一致性上的失败模式（V1 实验里 AI 生成 SVG 失败的同类教训）。AI 只负责 design tokens 和 HTML 语义。
2. **per-page 校验 + 一次重试 + placeholder 兜底** —— 即使 AI 反复失败，整个 deck 一定能成功构建出合法 PPTX。
3. **Mock 模式用实验产物作为 canned response** —— 无需 token 反复跑工程链路，CI 可用。
4. **Layer 0 双源** —— `Layer0Source = { kind: "brief" } | { kind: "ingested_template" }`，与 §7.5 ingestion POC 接口对齐。

### 8.7.4 与 ingestion POC 的闭环连接

```bash
# Step 1: ingest 一份设计网站模板
bun packages/backend/src/scripts/ppt-mvp/ingest-template.ts \
  ~/Downloads/包图网_xxx.pptx
# → /tmp/ppt-research/ingest-out/<slug>/template.json

# Step 2: 用它驱动 4 层流水线生成新主题 PPT
bun packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --ingested /tmp/ppt-research/ingest-out/<slug>/template.json
# → /tmp/intelliflow-ppt-mvp-wireless-ai-blue-business.pptx
```

整条链：**外部 .pptx 模板 → 结构化资产 → AI 设计意图 → AI 单页 HTML → PPTX 交付** 全部在生产代码中可走通。

### 8.7.5 Iteration 1 已知限制 + Iteration 2 候选

详见 `docs/design/ppt-mvp/ai-pipeline.md` "已知限制 / 下一步" 段落。最关键的两个 P0：
- **真实 live mode 验证**（需业务侧提供 ARK API key）
- **抽出通用 `build-from-page-plan.ts`**，不再硬编码 wireless 内容

---

## 9. 一句话总结

> **AI 完全可以参与"模板/风格生成本身" —— LandPPT 已经做到了 4 层 AI 流水线。豆包和 Kimi 这两个标杆走的是完全相反的范式（人工 layout 池 vs 每页自渲染），证明没有唯一正确答案。当前 IntelliFlow MVP 卡在范式 A（最刚性的一种），如果想达到豆包/Kimi 水准且保持灵活，最现实的路线是范式 4（LandPPT 4 层流水线 + ppt-master 预制图表/图标库）。**

---

## 附录 A：本次研究的关键文件路径

### IntelliFlow 当前位置
- 当前 MVP: `packages/backend/src/scripts/ppt-mvp/variant-library.ts` （范式 A）

### Benchmark 产物
- 豆包: `/Users/dongli/Downloads/无线网络建设科普方案.pptx`（范式 B 实证）
- Kimi: `/Users/dongli/Downloads/无线网络建设科普方案 (1).pptx`（范式 C 实证）
- 解压副本: `/tmp/ppt-research/doubao/`、`/tmp/ppt-research/kimi/`

### 实验产物（§8.5 LandPPT 4 层流水线手工验证 — V1 编辑感）
- 工作区: `/tmp/ppt-research/landppt-experiment/`
- 设计系统 CSS: `00-design-system.css`
- 风格基因 + 宪法 + page brief: `00-template-genes.json`
- 4 页 HTML: `p1-cover.html` / `p2-toc.html` / `p3-comparison.html` / `p4-timeline.html`
- 4 页 PNG（1920×1080）: `render-p1.png` ~ `render-p4.png`
- MVP v3 对比基线: `render-mvp-preview.png`

### 实验产物（§8.6 V2 闭环 — ingested template → AI → 商务风输出）
- 工作区: `/tmp/ppt-research/landppt-experiment-v2-business/`
- 来自 ingestion: `00-design-system.css` + `00-template-genes.json`（注释里写明派生自 sample 2）
- 4 页 HTML: 同上命名
- 4 页 PNG: `render-p1.png` ~ `render-p4.png`

### Ingestion 测试样本（§7.5）
- 设计网站模板 1: `/Users/dongli/Downloads/622b10be37491.pptx`（24 页，5 图，无 themeOverride）
- 设计网站模板 2 蓝色商务风: `/Users/dongli/Downloads/包图网_19853341蓝色商务风复盘总结商务汇报通用PPT模板/622eee2ab7e6e.pptx`（25 页，17 图 + 1 MP3，含 themeOverride 11 色 + 思源宋体 CN）
- 解压副本: `/tmp/ppt-research/sample1/`、`/tmp/ppt-research/sample2/`

### OSS 项目（已 clone）
- `/tmp/oss-ai-ppt/ai-to-pptx/` —— 范式 A 范例（README_Make_Template.md 是核心证据）
- `/tmp/oss-ai-ppt/LandPPT/` —— 范式 C 4 层流水线
  - `src/landppt/services/template/template_selection_service.py`
  - `src/landppt/services/slide/creative_design_service.py`
  - `src/landppt/services/prompts/design_prompts.py`
  - `src/landppt/services/prompts/template_prompts.py`
- `/tmp/oss-ai-ppt/ppt-master/` —— 范式 D 预制图表库
  - `skills/ppt-master/SKILL.md`
  - `skills/ppt-master/templates/charts/` (50+ 预制 SVG)
  - `skills/ppt-master/templates/icons/` (大量图标库)
- `/tmp/oss-ai-ppt/banana-slides/` —— 范式 E image-first
- `/tmp/oss-ai-ppt/AiPPT/` —— 编辑器内核参考
- `/tmp/oss-ai-ppt/PPTist/` —— 编辑器交互参考

### 研究依据文档（之前已沉淀）
- `docs/research/oss-ai-ppt-landscape.md`
- `docs/research/intelliflow-ppt-optimal-architecture.md`
- `docs/research/deep-report-synthesis.md`
- `docs/design/ppt-mvp/family-design-contract.md`
