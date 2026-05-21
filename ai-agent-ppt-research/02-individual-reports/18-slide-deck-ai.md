# 18 · slide-deck-ai

> 项目：barun-saha/slide-deck-ai · MIT · Python 3.10+ · 主要作者 Barun Saha
> Live Demo：Hugging Face Spaces `barunsaha/slide-deck-ai`
> 调研时间：2026-05-20
> RAW 来源：`/home/user/intelliflow-docs/ai-agent-ppt-research/01-raw-sources/others/slide-deck-ai-RAW.md`

## 1. 项目概览

slide-deck-ai 是一个开源、以 **Streamlit Chat + python-pptx + LiteLLM** 为骨架的"AI PPT 助手"。它的产品定位非常明确："**Co-create stunning, professional slide decks**"——不是一次跑完出货，而是用户先描述主题（10–300 字符），LLM 生成结构化 slide JSON，引擎渲染 PPTX，然后用户在**同一个 chat 框**里反复说"加一页"、"slide #3 的 key message 拿掉"、"再啰嗦一点"，模型基于完整对话历史与上一版 JSON 进行 revise。它是少有的把"迭代修订"做进 prompt 设计层的工具，而不是只在 UI 上做一个 chat-with-PPT 外壳。

项目还有几个生产化亮点：
- 2023 Llama 2 Hackathon with Clarifai **第三名**
- 已发到 PyPI（`pip install slidedeckai`），提供 `slidedeckai generate / launch / --list-models` CLI
- 提供 Python API（`from slidedeckai.core import SlideDeckAI`），意味着可以被外部 agent（如作者自己的 KodeAgent）当作工具调用——Medium 文章演示了"用 ArXiv 检索 6 篇论文 → 调 SlideDeck AI 生成讲故事 deck"
- 支持 **PDF 输入**（可指定页码范围）作为生成素材，而不只是输入 topic 字符串
- 离线模式（Ollama）整套链路除图片外不出本机
- 4 套 PPTX 模板（Basic、Ion Boardroom、Minimalist Sales Pitch、Urban Monochrome），用 Git LFS 存储
- 关键技术决策有迹可循：根目录的 `LITELLM_MIGRATION_SUMMARY.md` 显示项目已从 LangChain `ChatXXX` 直连改造为 **LiteLLM 统一抽象层**，当前 requirements.txt 已无 langchain 依赖

## 2. 架构 — Pipeline + Multi-LLM 抽象

整体流水线只有 5 步，是相当典型的"JSON-first"模式：

```
用户 topic / PDF
    │
    ▼
[Prompt 渲染]                              ← prompts/initial_template_v4_two_cols_img.txt
    │   注入 topic、additional_info、PDF 文本
    ▼
[LiteLLM 流式调用]                          ← helpers/llm_helper.py
    │   provider 由 [xx] 前缀决定，统一翻译为 LiteLLM 格式
    ▼
[JSON 解析 + 修复]                          ← json5 + json-repair
    │
    ▼
[图片/图标补充]                              ← helpers/image_search.py（Pexels）
    │                                       ← helpers/icons_embeddings.py（sentence-transformers 语义匹配）
    ▼
[python-pptx 渲染]                          ← helpers/pptx_helper.py（约 43 KB）
    │   按 slide 类型分发：title / content / two-col / icons / process / table / conclusion
    ▼
.pptx + 下载按钮
```

迭代时只换 prompt 模板和入参：`refinement_template_v4_two_cols_img.txt` 接受三块输入——"指令链（从老到新）+ 上一版 slide JSON + topic/附加材料"——同样产出完整 JSON，整个 PPTX 重渲染。这种"全量重写而非 patch"的策略简单可靠，但代价是 token 消耗随历史叠加上升。

**Multi-LLM 抽象**的实现非常薄。`global_config.py` 里有 9 个 provider code（`an / oa / az / gg / co / sn / to / or` + Ollama）和一张 `LITELLM_PROVIDER_MAPPING`。`helpers/llm_helper.py` 暴露 4 个核心函数：`get_provider_model()` 解析 `[xx]name`，`get_litellm_model_name()` 翻译成 LiteLLM 字符串（`openai/gpt-4.1-mini`、`gemini/gemini-2.5-flash-lite`、`anthropic/claude-haiku-4.5`、`azure/...`、`ollama/...`），`stream_litellm_completion()` 走 `litellm.completion(stream=True)`，`get_litellm_llm()` 返回一个**模仿 LangChain BaseChatModel 流式接口的 wrapper**——这样 core.py 不需要重写就能从 LangChain 时代过渡到 LiteLLM 时代。Azure 走 deployment name 而非 model name，Ollama 走本地端点，其他都靠 LiteLLM 的统一协议。**所有 provider 在调用层只有一份代码**，新增 provider 仅需在 mapping 表 + 环境变量映射里加两行。

`core.py` 的 `SlideDeckAI` 类是单文件入口：构造器接 `model / topic / api_key / pdf / page_range / template_index`，`.generate()` 走 initial pipeline，`.revise()` 走 refinement pipeline，`.set_model()` / `.set_template()` / `.reset()` 支持运行时切换。Streamlit 的 `app.py` 用 `_is_it_refinement()` 判断对话历史 ≥2 条就改调 revise——这个判断逻辑很直白，但够用。

## 3. Prompt 工程要点

两个 prompt 模板（initial 8.5 KB / refinement 9 KB）是项目最值得偷的资产，几乎涵盖了高质量 deck 的全部 hard-coded 经验：

**叙事弧（Narrative Arc）是核心**：模板要求 LLM 不要把每一页当成独立信息卡片，而是组合成"establish context or a problem, build tension or complexity, then resolve it. Each slide should feel like it advances this arc, not just adds information."这条规则直接决定了输出的可读性。

**Title 叙事化**：模板用对比示例引导——"Why Most Agile Transformations Fail — And What to Do Instead" 优于 "Agile Transformation"。**Bullet 结果导向**："Prefer 'Costs dropped 40% when teams adopted X' over 'X reduces costs'"。**CTA 具体化**："Run a 2-week pilot on your highest-risk project rather than Consider trying agile"。**图片关键词具体化**："Surgeon operating room is better than healthcare; solar panel rooftop installation better than energy"——这一条直接关系 Pexels 检索质量。

**结构性硬约束**（直接写进 prompt）：
- 10–12 页，最多 20，必须有结论页
- 必含 ≥1 个 table、1 个 icons 页（4–6 icon）、1 个两栏布局、1 个顺序过程（≤3 步）
- table 页不能再加普通 bullet
- icons 用 `[[icon-name]]` 语法，禁止 Unicode emoji
- sequential process slide 第一项以 `>>` 标记
- key_message 整个 deck 最多 3 个
- 结论页 "Distill 3–5 most important insights as memorable, standalone statements"

**Verbosity 滑块写进 prompt**：1–10 默认 7，"sales pitch 3–5、classroom lecture 8–9"，用户在自然语言里说"再啰嗦一点"模型直接拉档。

**JSON schema 嵌套设计很巧**：`bullet_points` 既可以是字符串数组（普通 bullet），也可以是嵌套数组（子 bullet），也可以是对象（两栏对照）。一个字段三种语义，配合 `pptx_helper.py` 的类型分发器，省去了 schema 字段爆炸。

**Refinement 模板的关键约束**："generally preserve the narrative arc and title...unless explicitly instructed to drastically change them"——保留优先原则，避免每次修订把 deck 重写一遍。同时显式禁止"do not add the same table again"、避免 slide 重复。

**安全底线（硬约束）**："MUST NEVER create any content that is illegal, harmful, unsafe, violent, abusive, dangerous, bullying, or violates privacy."

## 4. 可迁移到 IntelliFlow 的点

IntelliFlow 当前的设计是 4 层 LandPPT 风格 + 图片化 PPTX，slide-deck-ai 的几处经验可以直接借鉴：

1. **多 provider 抽象用 LiteLLM 而不是自己写 CLI 包装**。我们 v1 计划用 `claude -p` CLI，v2 扩 API，slide-deck-ai 的 LITELLM 迁移历史正好印证了"CLI → 统一 API 抽象"是必然路径。可以参考 `helpers/llm_helper.py` 把"模型 ID 字符串 + provider 映射 + stream wrapper"做成 30 行就能复用的模块。和我们的"模型调用节点"配合最自然。

2. **Prompt 模板里的"叙事弧 + 角色化 title + 结果导向 bullet + 具体图片关键词"五条规则**可以直接搬进我们的"内容生成层"系统提示词。这五条不依赖任何上下文，是通用规则，且每条都有对比示例，模型遵循度很高。

3. **JSON schema 嵌套技巧**：用 `bullet_points` 一个字段承载普通 / 嵌套 / 两栏三种语义，减小 schema 表面积——比 LandPPT 那种每种 slide 类型一个独立 schema 更适合"基础节点自由编排"场景，因为节点之间传递的是统一 JSON。

4. **Refinement 的"preserve-first"原则 + 历史指令链拼接**：我们的"信息恢复"节点之后必然有用户反馈循环，slide-deck-ai 把"指令从老到新拼接 + 上一版 JSON 同时进 prompt"的做法可以照搬。但要注意我们的脱敏映射会让"上一版完整 JSON"重新进 prompt 时触发二次脱敏，需要在 revise 之前先做"脱敏映射检查"。

5. **图标语义匹配**：用 sentence-transformers + 预算 embeddings 做图标库语义检索，对应到我们"图片化 PPTX"里的图标补全，省掉大量人工对齐工作。`icons_embeddings.py` + bootstrap-icons 子集是一个非常轻的方案。

6. **Verbosity 1–10 滑块**：在我们的"输入转换"节点里，作为统一控制参数注入下游 prompt，比让用户每个节点重复指定详略好用。

7. **生产化经验**：把核心 PPTX 渲染包装成 PyPI 包 + CLI + Python API，让"AI agent 调 PPT 生成"成为可能。我们的 v2 也应该考虑把"基础节点"做成可被外部 agent 调用的 SDK。

## 5. 局限

- **全量重写**：每次 revise 都重新生成完整 JSON 重渲染 PPTX，简单但成本随对话深度线性上升；不存在"只改第 3 页"的局部增量。
- **没有版本对比 / 回滚**：chat history 只是 prompt 注入材料，不构成版本图；用户改坏了只能重述指令。
- **图片来源单一**：Pexels 一家；图片插入是"概率性"的（README 原话"with a certain probability"），不可控。
- **没有真实多模态**：图片关键词靠 LLM 推，而不是基于真实图像理解。对比 PPTAgent 等带 vision-feedback 的项目差一档。
- **模板数量少且固定**：只有 4 套 .pptx 模板，全部需要 Git LFS 才能拉到；用户没有"上传企业模板"通道。
- **缺乏专业排版自适应**：python-pptx 渲染走的是模板 placeholder + 固定形状坐标，长内容溢出风险存在；slide_helper 约 43 KB 里大量是手算 EMU 坐标，难以泛化到新模板。
- **schema 强约束 = 风格趋同**：所有 deck 必须有 table / icons / two-col / process，输出形态固定，对纯叙事场景（如读书会、毕业答辩）有点过度结构化。
- **PDF 输入仍是纯文本抽取**（pypdf），没有图表 / 公式 / 表格的结构化理解。
- **token 浪费**：刷新模板里有 8.5–9 KB 的硬规则，每次调用都全量塞进 system prompt，未做 prompt caching；新模型（Anthropic / OpenAI）支持的 prompt caching 没有利用上。
- **依赖很重**：requirements.txt 引入 `torch ~2.11.0 + torchvision + sentence-transformers + transformers`，主要只是为了 icons 语义检索，对轻量部署不友好。
- **角色定位限制扩展性**：核心是"chat → JSON → PPTX"单一路径，不支持"先做大纲 review → 再分章节扩写"这种 LandPPT 的 4 层流水线；想加阶段对应"信息脱敏 / 模型并行对比"必须改 `core.py`。
