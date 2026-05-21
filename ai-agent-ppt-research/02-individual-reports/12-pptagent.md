# PPTAgent — 反思式 PPT 生成的学术框架

> 项目：icip-cas/PPTAgent
> 论文：*PPTAgent: Generating and Evaluating Presentations Beyond Text-to-Slides*（EMNLP 2025）
> 后继：*DeepPresenter: Environment-Grounded Reflection for Agentic Presentation Generation*（ACL 2026）
> GitHub stars：≈ 4.4k

## 1. 项目概览

PPTAgent 出自中国科学院计算技术研究所（icip-cas），是首个把"PPT 生成"显式建模为**两阶段、编辑式、可反思**智能体框架的学术工作，并于 EMNLP 2025 发表。区别于"Text-to-Slides"思路（让 LLM 直接产出 slide json/xml），PPTAgent 模仿人类工作流：先**学习**一份参考 PPT 的版式 DNA，再**编辑**它来承载新内容。论文同时提出了 PPTEval —— 一个三维评估框架（Content / Design / Coherence），不仅是 benchmark，也是反思循环的信号源。

PPTAgent 在公开测试集上 Coherence 维度 4.48 vs 基线 3.24–3.36，显著领先；总均分 3.67 vs DocPres 2.85、KCTV 2.95；成功率 95% vs 88%。2025 年底开源后，团队推出 DeepPresenter（9B fine-tuned model）和带沙箱、20+ 工具的 v2 框架，正在从"编辑参考 slide"扩展到"自由设计 + 自主资产创建 + 环境接地反思"。

## 2. 核心架构

### 2.1 两阶段 pipeline

**Stage I — Presentation Analysis（归纳，`induct.py`）**

输入：一份参考 PPT。输出：slide-level 功能类型 + 内容 schema。

- **结构性 slide 识别**：用规则+LLM 区分四类骨架页（Opening / Table of Contents / Section Outline / Ending）。判定依据：位置（首页/末页）、内容（最少元信息 / 章节标题逐字匹配 TOC）。
- **内容性 slide 聚类**：把 slide 渲染为图像，用层次聚类（Algorithm 1，cosine 相似度阈值 θ=0.65）合并相似版式。MLLM 为每个聚类生成一句话 layout pattern 描述（如 "Two Landscape Images with Descriptive Text Below Each"）。
- **Schema 提取**：每个元素表示为 `{category, description, content}` 三元组。例如 `{Title, Main title, "Sample Library"}`。

**Stage II — Presentation Generation（`pptgen.py`）**

输入：目标文档 + Stage I 产物（结构骨架 + 版式聚类 + schema）。输出：新 PPT。

- **大纲生成（outline）**：在文档的 section 层面规划，每一项指定一个"参考 slide ID"（来自 Stage I）。
- **逐页生成**：对每页，LLM 把"参考 slide 的 HTML 表示"+"目标内容"作为输入，输出一串**编辑动作**（见下文 5 个原子 API）。
- **REPL 执行 + 自纠正**：动作在 REPL 沙箱里 apply 到参考 slide。失败则回传执行错误，LLM 改写动作，最多 2 轮迭代。

### 2.2 多 Role 协作（`/pptagent/roles/`）

8 个 YAML 定义的 agent 角色：`planner`（大纲）、`doc_extractor`（文档解析）、`content_organizer`（内容编排）、`schema_extractor`（schema 抽取）、`layout_selector`（版式选择）、`editor`（编辑动作生成）、`coder`（代码生成）、`agent`（主调度）。Role 切换通过 prompt 模块化加载实现，避免单一 prompt 承担多种模式而出现 mode-mixing 病态。

## 3. 关键创新点

### 3.1 编辑式 vs 生成式（Edit-Based Generation）

PPTAgent 不让 LLM 凭空生成 slide。它把 PPT 生成转化为"在已验证版式上做内容替换"：

- **5 个原子编辑动作**（操作 HTML 渲染层，不操作 OOXML）：
  - `del_span` — 删除文本 span
  - `del_image` — 删除图片元素
  - `clone_paragraph` — 复制段落（用于列表多项扩展）
  - `replace_span` — 替换 span 内容
  - `replace_image` — 替换图片源

这一抽象化是关键：LLM 不需要懂 DrawingML，只需在已渲染的 HTML 上做 DOM-like 操作。"最小充分动作集"覆盖任意文本/图片编辑。

### 3.2 反思循环（Reflective Loop）

最受关注的设计是**REPL 反馈驱动的自纠正机制**：

> "Generated editing actions execute within a REPL environment. When actions fail to apply to reference slides, the REPL provides execution feedback to assist LLMs in refining their actions. The LLM then analyzes this feedback to adjust its editing actions, enabling iterative refinement until a valid slide is generated or the maximum retry limit is reached."

实验设置：每页最多 2 轮自纠正。这把"编辑动作合法性"问题从静态校验变成动态对话——LLM 不需要事先知道所有 HTML 选择器都存在，REPL 会告诉它哪一步失败了。

### 3.3 PPTEval 三维评估

不只是 benchmark，也是 RLHF 风格的反思信号源：Content / Design / Coherence 三个独立 1-5 分维度，每维有锚定 rubric，配合 per-slide 描述器+presentation-level extractor，使 LLM-as-judge 能稳定打分（Fleiss' κ ≈ 0.59）。

### 3.4 结构骨架的显式建模

Coherence 维度领先（4.48 vs 3.24-3.36）正是因为 PPTAgent **显式区分结构页和内容页**。基线方法把每页都当内容页生成，结果常缺 TOC、章节分隔、致谢页等"presentation 体感"元素。

## 4. Prompt 工程要点

### 4.1 结构页识别（`category_split.txt`）

> "You are an expert presentation analyst specializing in categorizing PowerPoint slides, focusing on structural slides (Opening, Table of Contents, Section Outline, and Ending) that guide the presentation's flow."
>
> Section Outline slides **must be multiple slides**, each interleave several slides to detail the content of the section. Contains a section title that **strictly matches** the Table of Contents (identical wording).

这条 prompt 工程化了 PPT 体感的核心规则——Section Outline 与 TOC 必须**逐字匹配**。

### 4.2 版式命名（`ask_category.txt`）

> "Focus on HOW content is structured and presented, not WHAT the content is. Describe the number, visual arrangement, and interaction between different elements."
>
> Example: "One Central Square Chart with a explanatory paragraph", "Picture and three illustrative key points".

聚类后的版式不能用"小米 SU7 介绍页"这种话题词命名，必须用结构词。这是版式可复用性的关键。

### 4.3 PPTEval rubric（验证 reflective loop）

**Design（`ppteval_style.txt`）**：

| 分 | 标准 |
|----|------|
| 3 | "Basic color scheme; lacks supplementary visual elements such as icons, backgrounds, images, or geometric shapes (like rectangles), making it look plain." |
| 4 | "Harmonious color scheme + some visual elements; minor flaws may exist." |
| 5 | "Harmonious and engaging style; supplementary visual elements (images, geometric shapes) enhance overall visual appeal." |

注意 rubric 把"是否使用了 icon / 背景 / 几何形状"作为 3→4 的分水岭——这恰好直击我们 IntelliFlow 现在的痛点。

**Coherence（`ppteval_coherence.txt`）**：

| 分 | 标准 |
|----|------|
| 3 | "Clear logical structure + smooth transitions, but lacks essential background information." |
| 4 | "Well-organized + basic background (speaker, date, institution)." |
| 5 | "Engaging narrative + detailed background (speaker/institution, date, acknowledgments/conclusion)." |

Coherence 直接奖励"presentation metadata"完整度——这是显式骨架页设计的回报。

### 4.4 内容描述器（`ppteval_describe_content.txt`）

> 1. Information Density — too lengthy / too little → large white space
> 2. Content Quality — grammatical errors / unclear expressions
> 3. Images and Relevance — presence of visuals, relevance to theme

PPTEval 不让 LLM 直接看 slide 图打分，而是先描述再评分。这种"描述 → 评分"两步法降低 LLM-as-judge 的方差。

## 5. 质量保证 / 反思机制

PPTAgent 的反思在**两个时间尺度**生效：

**5.1 短反思（per-slide，自动）**：编辑动作 REPL 校验失败 → 反馈错误 → LLM 重写 → 最多 2 轮。这是工程级、强制执行的反思，不依赖 LLM 自主判断。

**5.2 长反思（per-presentation，评估驱动）**：PPTEval 给三维分数+原因（每个 rubric 都要求 `{"reason": "xx", "score": int}`）。论文中 PPTEval 作为离线评估指标，但其 rubric 完全可以作为生成时的 critic 信号——这正是 DeepPresenter v2 引入"Environment-Grounded Reflection"的延伸方向。

**5.3 PPTEval 设计哲学的可借鉴性**：
- **三维正交**：Content（文字+图）、Design（颜色+形状+图标）、Coherence（结构+元信息）——三者独立打分，避免一个维度好就拉高另一个的"光环效应"。
- **per-slide × per-presentation 二层评估**：Content/Design 是 per-slide 平均（捕捉局部缺陷），Coherence 是 per-presentation 单点（捕捉全局连贯）。
- **描述-评分两步法**：先 LLM 描述（盲化分数）再 LLM 评分（盲化原文）。

## 6. 对 IntelliFlow 的可迁移点

IntelliFlow 当前痛点：跨页视觉一致性弱、背景/图标/图片薄、缺少 presentation 体感。PPTAgent 的设计直接对症。

### 6.1 引入 PPTEval-like critic 作为第二层反思

我们的 4 层 pipeline（TemplateGenes → StyleGenes → GlobalConstitution → PageBrief → RenderedPage）目前止于"渲染即结束"。可在 RenderedPage 后插一道 **PPTEval-style critic**：
- 用三维 rubric（Content / Design / Coherence）对每页打分；
- Design 分 ≤3 的页（无图标/无背景/无几何形状）触发自动 regenerate；
- Coherence 整体分 ≤3 触发 GlobalConstitution 级别的回退（例如补 TOC 或 Ending）。

这是**最低成本、最大收益**的迁移项——不用改 pipeline 拓扑，只新增一道闸门。

### 6.2 显式 archetype 与"参考 slide 选择"对齐

我们已有 6 种固定 archetype（cover / toc / comparison / timeline / process / device）。PPTAgent 把这种结构骨架显式建模成 Stage I 产物，并在 Stage II 让 outline 显式绑定参考 slide。我们可以把这条思路用在反方向：**把 6 种 archetype 各做一组"参考实例库"（每 archetype 5-10 个高质量人造样板）**，让 PageBrief 阶段从样板池里选最近邻，然后用类似 `replace_span` / `replace_image` 的编辑动作做内容注入，而不是从空白布局开始生成。

这能直接提升视觉一致性——因为版式 DNA 是固定的人工样板。

### 6.3 编辑动作 API 设计借鉴

我们当前 RenderedPage 是"白板模式"。可以引入 PPTAgent 的 5 动作思路：在 archetype 模板里预留命名 slot（`{{title}}`、`{{image_hero}}`、`{{list_item_*}}`），LLM 只输出 slot 填充动作（`set_text`、`set_image`、`clone_list_item`、`drop_item`）。这把"自由生成 PPT"降级为"在已验证模板上填空"——大幅降低视觉走样。

### 6.4 REPL 反馈短反思

我们当前若渲染失败（图标不存在、字号过大溢出、颜色对比度不足）通常没有自动恢复机制。PPTAgent 的 REPL 反馈模式可以直接复用：渲染器抛出结构化错误（`IconNotFound: phosphor-duotone/rocket`、`OverflowError: title 32px exceeds 28px max`）→ 回传 LLM → 最多 N=2 轮重写。这能把"渲染失败"从静默 bug 变成自纠正问题。

### 6.5 描述-评分两步评估

如果我们用 LLM 评判页面质量（视觉一致性、配图相关性），强烈建议**先描述再评分**，参考 `ppteval_describe_style.txt` 的三维度（Visual Consistency / Color Scheme / Use of Visual Elements）。直接打分会被 LLM 的 sycophancy（高估倾向）污染。

## 7. 风险 / 局限

**7.1 依赖参考 PPT 的质量**：PPTAgent 的核心是"学习并编辑参考 slide"。如果参考库本身视觉差或语义对不上，输出质量天花板被锁死。这要求构建+维护一个高质量参考库——IntelliFlow 若走这条路，archetype 样板库的策展工作量会很大。

**7.2 HTML 抽象的损失**：把 OOXML 渲染为 HTML 再编辑，会损失 PPT 特性（动画时序、备注、母版继承）。PPTAgent 的输出最终需要回写 PPTX，DeepPresenter v2 才补全 PPTX export & offline mode。

**7.3 REPL 反思的成本**：每页 ≤2 轮自纠正意味着每页可能 3 次 LLM 调用。20 页 PPT 最坏 60 次调用，token 成本和延迟显著。需要做缓存（参考 slide 不变 → prompt 前缀可 KV 缓存）。

**7.4 PPTEval 自评的 reward hacking 风险**：如果同一族 LLM 既生成又评分，会优化"评分 prompt 的浅层关键词"而非真实质量。最好用更强的 LLM 评判（GPT-4o judge 评估弱 LLM 输出），且周期性 sample 人工复评。

**7.5 PPTAgent 的视觉天花板仍是参考 slide**：DeepPresenter v2 转向 free-form visual design 正是因为意识到这点——纯编辑式生成无法产出超越参考的设计。我们若引入编辑式生成，应同时保留 free-form fallback。

**7.6 学术 codebase 的工程化成本**：PPTAgent 不是开箱即用——需要 LiteLLM、playwright、html2pptx、docker sandbox 等多组件。直接拿来当 IntelliFlow 后端不现实，但其架构思路（两阶段、5 动作、REPL、PPTEval）完全可移植。

---

**结论**：PPTAgent 给我们提供的不只是一个 codebase，而是一套**"先归纳版式 DNA、再编辑式承载内容、最后多维反思评估"**的方法论。三项可立即迁移的高价值实践——**(1) PPTEval-style 三维 critic 作为 RenderedPage 后置闸门、(2) archetype 转参考实例库 + 编辑动作填空、(3) 渲染 REPL 反馈短反思**——预期能直接缓解 IntelliFlow 的视觉一致性与设计单薄问题，且与现有 4 层 pipeline 兼容。

