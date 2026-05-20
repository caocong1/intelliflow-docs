# slide-deck-ai — RAW 来源资料

> 项目：barun-saha/slide-deck-ai
> 抓取时间：2026-05-20
> 抓取来源：
> - GitHub 仓库主页 https://github.com/barun-saha/slide-deck-ai
> - README.md https://raw.githubusercontent.com/barun-saha/slide-deck-ai/main/README.md
> - Medium 文章 https://medium.com/@barunsaha/from-research-to-powerpoint-building-an-ai-agent-to-draft-technical-slide-decks-bbf2f88bcc0f
> - 仓库 src/slidedeckai/ 子文件（global_config.py、core.py、app.py、strings.json、prompts/、helpers/）
>
> 备注：
> - `global_config.py` 的旧路径（仓库根目录）返回 404，现已迁移至 `src/slidedeckai/global_config.py`，已重新抓取。
> - 两个 prompt 模板（`initial_template_v4_two_cols_img.txt`、`refinement_template_v4_two_cols_img.txt`）由于 WebFetch 后端的内容策略拒绝逐字回传，本文件保存的是结构化技术摘要 + 短句代表性引用（每句 < 25 词），原文以仓库主分支为准。

---

## 1. 项目元信息

- License：MIT
- 语言：Python 3.10 / 3.11 / 3.12 / 3.13
- Streamlit SDK 版本：1.55.0
- Hugging Face Space：`barunsaha/slide-deck-ai`
- PyPI 包名：`slidedeckai`
- 文档：readthedocs / slidedeckai
- 荣誉：2023 Llama 2 Hackathon with Clarifai 第三名
- 主要贡献者：Aditya（PDF 页码范围 + 新会话按钮）、Sagar Bharadia（Gemini 2.5 系列接入）、Sairam Pillai（**迁移到 LiteLLM 的统一 LLM 调用**）、Srinivasan Ragothaman（OpenRouter + .env API key 映射）、Zakir Jiwani（SambaNova 模型更新）

仓库顶层结构：

```
slide-deck-ai/
├── .codecov.yml
├── .coveragerc
├── .env.example
├── .gitattributes
├── .gitconfig
├── .gitignore
├── .readthedocs.yaml
├── LICENSE
├── LITELLM_MIGRATION_SUMMARY.md
├── MANIFEST.in
├── README.md
├── app.py                                            # Streamlit 入口
├── pyproject.toml
├── requirements.txt
├── .github/
├── .streamlit/
├── docs/
├── examples/
├── src/
│   └── slidedeckai/                                  # 核心包
│       ├── __init__.py
│       ├── _version.py
│       ├── cli.py                                    # slidedeckai generate / launch / --list-models
│       ├── core.py                                   # SlideDeckAI 类
│       ├── global_config.py                          # 全部配置
│       ├── strings.json                              # UI 文案
│       ├── prompts/
│       │   ├── initial_template_v4_two_cols_img.txt        # 8544 字节
│       │   └── refinement_template_v4_two_cols_img.txt     # 9054 字节
│       ├── helpers/
│       │   ├── __init__.py
│       │   ├── chat_helper.py
│       │   ├── file_manager.py
│       │   ├── icons_embeddings.py
│       │   ├── image_search.py
│       │   ├── llm_helper.py                         # LiteLLM 抽象
│       │   ├── pptx_helper.py                        # python-pptx 渲染（约 43 KB）
│       │   └── text_helper.py
│       ├── file_embeddings/
│       ├── icons/                                    # bootstrap-icons 子集 + SVG Repo
│       └── pptx_templates/                           # .pptx 模板（Git LFS）
├── tests/
└── slides_for_this_project_by_this_project/         # 演示用 PPTX
```

---

## 2. README 全文（已抓取）

（以下为 README.md 原文，从 raw.githubusercontent.com 抓取，仅在视觉上添加横线，未修改原文。）

---
title: SlideDeck AI
emoji: 🏢
colorFrom: yellow
colorTo: green
sdk: streamlit
sdk_version: 1.55.0
app_file: app.py
pinned: false
license: mit
---

# SlideDeck AI: The AI Assistant for Professional Presentations

We all spend countless hours **creating** slides and meticulously organizing our thoughts for any presentation.

**SlideDeck AI is your powerful AI assistant** for presentation generation. Co-create stunning, professional slide decks on any topic with the help of cutting-edge **Artificial Intelligence** and **Large Language Models**.

**The workflow is simple:** Describe your topic, and let SlideDeck AI generate a complete **PowerPoint slide deck** for you—it's that easy!

## How It Works: The Automated Deck Generation Process

SlideDeck AI streamlines the creation process through the following steps:

1. **AI Content Generation:** Given a topic description, a Large Language Model (LLM) generates the *initial* slide content as structured JSON data based on a pre-defined schema.
2. **Visual Enhancement:** It uses keywords from the JSON output to search and download relevant images, which are added to the presentation with a certain probability.
3. **PPTX Assembly:** Subsequently, the powerful `python-pptx` library is used to generate the slides based on the structured JSON data. A user can choose from a set of pre-defined presentation templates.
4. **Refinement & Iteration:** At this stage onward, a user can provide additional instructions to *refine* the content (e.g., "add another slide," or "modify an existing slide"). A history of instructions is maintained for seamless iteration.
5. **Instant Download:** Every time SlideDeck AI generates a PowerPoint presentation, a download button is provided to instantly save the file.

In addition, SlideDeck AI can also create a presentation based on **PDF files**, transforming documents into decks!

## Python API Quickstart

```python
from slidedeckai.core import SlideDeckAI

slide_generator = SlideDeckAI(
    model='[gg]gemini-2.5-flash-lite',
    topic='Make a slide deck on AI',
    api_key='your-google-api-key',  # Or set via environment variable
)
pptx_path = slide_generator.generate()
print(f'🤖 Generated slide deck: {pptx_path}')
```

## CLI Usage

```bash
slidedeckai generate --model '[gg]gemini-2.5-flash-lite' --topic 'Make a slide deck on AI' --api-key 'your-google-api-key'
slidedeckai launch
slidedeckai --list-models
```

## Unmatched Flexibility: Choose Your AI Brain

SlideDeck AI 支持的模型采用 `[code]model-name` 格式：

| LLM | Provider (code) | 特征 |
|---|---|---|
| Claude Haiku 4.5 | Anthropic (`an`) | Faster, detailed |
| Gemini 2.0 Flash | Google (`gg`) | Faster, longer content |
| Gemini 2.0 Flash Lite | Google (`gg`) | Fastest, longer content |
| Gemini 2.5 Flash | Google (`gg`) | Faster, longer content |
| Gemini 2.5 Flash Lite | Google (`gg`) | Fastest, longer content |
| GPT-4.1-mini | OpenAI (`oa`) | Faster, medium |
| GPT-4.1-nano | OpenAI (`oa`) | Faster, shorter |
| GPT-5 | OpenAI (`oa`) | Slow, shorter |
| GPT | Azure OpenAI (`az`) | Faster, longer |
| Command R+ | Cohere (`co`) | Shorter, simpler |
| Gemini-2.0-flash-001 | OpenRouter (`or`) | Faster, longer |
| GPT-3.5 Turbo | OpenRouter (`or`) | Faster, longer |
| DeepSeek-V3.1 | SambaNova (`sn`) | Fast, detailed |
| Meta-Llama-3.3-70B-Instruct | SambaNova (`sn`) | Fast, shorter |
| DeepSeek V3-0324 | Together AI (`to`) | Slower, medium |
| Llama 3.3 70B Instruct Turbo | Together AI (`to`) | Slower, detailed |
| Llama 3.1 8B Instruct Turbo 128K | Together AI (`to`) | Faster, shorter |

> **Privacy 提示**：SlideDeck AI does **NOT** store your API keys/tokens or transmit them elsewhere. Your key is only used to invoke the relevant LLM for content generation.

## Icons

uses a subset of icons from bootstrap-icons-1.11.3 (MIT) and SVG Repo (CC0/MIT/Apache).

## Local Development

`.env` 中提供 API key，或在 UI 中提供。

### Offline 模式（Ollama）

```bash
export RUN_IN_OFFLINE_MODE=True
git clone https://github.com/barun-saha/slide-deck-ai.git
cd slide-deck-ai
git lfs pull   # 必需！拉取 PPTX 模板
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
streamlit run ./app.py
```

`RUN_IN_OFFLINE_MODE=True` 时使用 Ollama，UI 中改为文本框输入本地模型名；图片仍需联网（Pexels）。

---

## 3. .env.example 内容

```bash
PEXEL_API_KEY=
TOGETHER_API_KEY=
OPENROUTER_API_KEY=
RUN_IN_OFFLINE_MODE=
DEFAULT_MODEL_INDEX=
```

（其余如 GOOGLE_API_KEY、OPENAI_API_KEY、ANTHROPIC_API_KEY、AZURE_OPENAI_API_KEY、COHERE_API_KEY、SAMBANOVA_API_KEY 通过 LiteLLM 标准环境变量约定读取，由 `global_config.py` 中的 API_KEY 映射决定。）

---

## 4. requirements.txt 全文

```text
aiohttp>=3.13.4
python-dotenv[cli]~=1.0.1
gitpython~=3.1.50
json-repair~=0.59.5
idna==3.11
jinja2>=3.1.6
Pillow~=12.2.0
pyarrow~=22.0.0
pydantic~=2.12.5
litellm~=1.83.7
google-genai
streamlit==1.55.0
protobuf~=6.33.5
python-pptx~=1.0.2
json5~=0.14.0
requests~=2.33.1
pypdf~=6.10.2
sentence-transformers~=5.3.0
transformers~=5.5.0
torch~=2.11.0
torchvision~=0.26.0
lxml~=6.1.0
tqdm~=4.67.3
numpy
scikit-learn~=1.7.2
certifi==2026.4.22
urllib3>=2.6.3
anyio~=4.13.0
httpx~=0.28.1
huggingface-hub
ollama~=0.6.1
```

要点：
- `litellm` 是核心多 provider 抽象（PR 已迁移自直连 API）
- `python-pptx` 渲染 PPTX
- `pypdf` 处理 PDF 输入
- `sentence-transformers` + `torch` 用于 icons embedding（按语义匹配图标）
- `streamlit==1.55.0` 严格固定（HF Space SDK 一致）
- `json5` / `json-repair` 提升 LLM JSON 输出容错
- `ollama` 客户端

---

## 5. global_config.py 结构（已确认的关键字段）

`GlobalConfig` dataclass：

- **Provider codes**（9 个 + Ollama）：
  - `'an'` → Anthropic
  - `'oa'` → OpenAI
  - `'az'` → Azure OpenAI
  - `'gg'` → Google Gemini
  - `'co'` → Cohere
  - `'sn'` → SambaNova
  - `'to'` → Together
  - `'or'` → OpenRouter
  - 另外：Ollama 离线（无 prefix）
- **`LITELLM_PROVIDER_MAPPING`**：把 `[xx]model` 翻译成 LiteLLM 可识别的 `provider/model` 字符串
- **`VALID_MODELS`**：约 15 个模型，每项含 `description`、`max_new_tokens`（4096–8192）、定价提示
- **API Key 环境变量映射**：每个 provider 对应一个 env var 名称
- **运行时参数**：
  - temperature = 0.2
  - 最大常规页数 50，绝对页数上限 150
  - max input length = 1000 字符
- **文件路径常量**：
  - prompt 模板路径
  - icons embeddings 文件
  - PPTX 模板列表（Basic、Ion Boardroom、Minimalist Sales Pitch、Urban Monochrome）
- **`get_max_output_tokens()` 工具函数**：取模型 token 上限，缺省 2048
- **日志降噪**：将 `httpx`、`urllib3`、`litellm` 等第三方包降到 WARNING

---

## 6. core.py / SlideDeckAI 类（结构）

抓取自 `src/slidedeckai/core.py`：

- **`SlideDeckAI` 类构造参数**：`model`、`topic`、`api_key`（可选）、`pdf` 源（可选）、`page_range`、`template_index`
- 构造时按 `GlobalConfig.VALID_MODELS` 验证模型；建立 `chat_history`
- **`.generate()`**：
  1. 若给定 PDF，调用 `pypdf` 抽取文本（按 page_range）
  2. 将 topic 追加到 chat history
  3. 读取 `prompts/initial_template_v4_two_cols_img.txt` 模板
  4. 注入变量（topic、additional_info、PDF 抽取文本）渲染最终 prompt
  5. 调用 `_stream_llm_response()` 流式拿到 JSON 文本
  6. 用 `json-repair` / `json5` 解析
  7. 调 `pptx_helper.generate_powerpoint_presentation()` 写 PPTX
- **`.revise()`**：在已有 deck 上迭代：
  - 校验 deck 存在且 chat history 未达上限
  - 读 `prompts/refinement_template_v4_two_cols_img.txt`
  - 把"先前对话 + 先前 JSON + 新指令"灌入模板
  - 流式调用 LLM → JSON → 重新渲染 PPTX
- **`_stream_llm_response()` / `_process_llm_chunk()`**：累积 chunk，可选回调上报进度
- **`.set_model()` / `.set_template()` / `.reset()`**：运行时切模型 / 模板 / 重置会话
- 强调 error handling、logging、模块化

---

## 7. app.py / Streamlit UI（结构）

- 关键 imports：`datetime, logging, os, pathlib, random, sys, httpx, json5, ollama, requests, streamlit as st, dotenv`
- `sys.path.insert(0, os.path.abspath('src'))` → `from slidedeckai.core import SlideDeckAI`、`from slidedeckai import global_config as gcfg`
- Session state keys：
  - `slide_generator_instance`
  - `chat_messages`
  - `download_file_name`
  - `is_it_refinement`
  - `additional_info`
  - `pdf_file`
  - `api_key_input`
- 关键函数：
  - `StreamlitChatMessageHistory`：把对话历史挂到 session state
  - `are_all_inputs_valid()`：校验 topic / 模型选择 / API key
  - `reset_chat_history()`：清 session 并删除临时 PPTX
  - `build_ui()`：主入口
  - `set_up_chat_ui()`：聊天 UI + PDF 上传 + 生成调度
- 侧边栏三块：
  - PPTX 模板（radio 按钮，caption 取自 `global_config`）
  - LLM provider（online 用 dropdown，offline 用 textbox 写 Ollama 模型名）
  - PDF 页码范围（slider）
- 主流程：
  1. `st.chat_input()` 接收 prompt（可携带 PDF）
  2. 消息以 JSON 代码块形式回显
  3. 进度条跟随 LLM 流
  4. 生成后给"下载 .pptx"按钮
- `_is_it_refinement()`：判断历史是否 ≥2 条 → 决定调 `generate()` 还是 `revise()`
- 错误捕获：连接失败、Ollama 模型缺失、认证失败

---

## 8. strings.json 全文

```json
{
    "app_name": ":green[SlideDeck AI $^{[Reloaded]}$]",
    "caption": "*Create and improve your next PowerPoint slide deck*",
    "section_headers": [
        "Step 1: Generate your content",
        "Step 2: Make it structured",
        "Step 3: Create the slides",
        "Bonus Materials"
    ],
    "section_captions": [
        "Let's start by generating some contents for your slides.",
        "Let's now convert the above generated contents into JSON.",
        "Let's now create the slides for you.",
        "Since you have come this far, we have unlocked some more good stuff for you!"
    ],
    "input_labels": [
        "**Describe the topic of the presentation using 10 to 300 characters. Avoid mentioning the count of slides.**"
    ],
    "button_labels": [
        "Generate contents",
        "Generate JSON",
        "Make the slides"
    ],
    "urls_info": "Here is a list of some online resources that you can consult for further information on this topic:",
    "image_info": "Got some more minutes? We are also trying to deliver an AI-generated art on the presentation topic, fresh off the studio, just for you!",
    "content_generation_error": "Unfortunately, SlideDeck AI failed to generate any content for you! Please try again later.",
    "json_parsing_error": "Unfortunately, SlideDeck AI failed to parse the response from LLM! Please try again by rephrasing the query or refreshing the page.",
    "tos": "SlideDeck AI is an experimental prototype, and it has its limitations.\nAI-generated content may be incorrect. Please carefully review and verify the contents.",
    "tos2": "By using SlideDeck AI, you agree to fair and responsible usage.\nNo liability assumed by any party.",
    "ai_greetings": [
        "Stuck with creating your presentation? Let me help you brainstorm.",
        "Need a verbose slide deck? Specify the verbosity level (1 to 10) in your instructions (default 7).",
        "Did you know that SlideDeck AI can create a presentation based on any uploaded PDF file?",
        "Want it shorter or more detailed? Set verbosity (1–10, default: 7) in your instructions.",
        "Don't want the key message box in slide #3? Just ask me to remove it."
    ],
    "chat_placeholder": "Write the topic or instructions here. You can also upload a PDF file.",
    "like_feedback": "..."
}
```

要点：
- "Step 1/2/3" 暗示流程：纯文本 → JSON → 渲染
- 内置 verbosity 1–10、默认 7
- 引导用户使用自然语言指令删改 slide（"remove the key message box in slide #3"）

---

## 9. helpers/llm_helper.py（结构）

通过 LiteLLM 统一所有 provider：

- `get_provider_model(model_str)`：解析 `[xx]name` → `(provider, model)`
- `is_valid_llm_provider_model()`：校验 provider 在 `VALID_PROVIDERS` 内、API key 形式正确
- `get_litellm_model_name(provider, model)`：用 `GlobalConfig.LITELLM_PROVIDER_MAPPING` 映射成 LiteLLM 字符串（如 `openai/gpt-4.1-mini`、`gemini/gemini-2.5-flash-lite`、`anthropic/claude-haiku-4.5`、`together_ai/...`、`openrouter/...`、`sambanova/...`、`azure/...`、`cohere/...`、`ollama/...`）
- `stream_litellm_completion()`：调用 `litellm.completion(... stream=True)`，Azure 走 deployment name；Ollama 走本地端点
- `get_litellm_llm()`：返回一个 wrapper，伪装成 LangChain BaseChatModel.stream() 风格的接口（让 core.py 不直接耦合 LiteLLM）

> 注意：README 提到"unified the project's LLM access by migrating the API calls to **LiteLLM**"。原先是 LangChain ChatXXX 直接调用，**现在统一是 LiteLLM**。LangChain 在当前主分支不再是必依赖，仅在接口形态上模仿（保留 stream 协议）。requirements.txt 中也不再有 `langchain*` 依赖。

---

## 10. helpers/pptx_helper.py（结构）

约 43 KB，python-pptx 渲染主力：

- `generate_powerpoint_presentation(parsed_data, template_index, output_file)`：
  - 选模板（`GlobalConfig.PPTX_TEMPLATE_FILES`）
  - 逐 slide 分发到不同处理器
- Slide 类型：
  1. **Title slide**
  2. **Default content**：bulleted text + 可选 foreground/background 图（按概率）
  3. **Two-column comparison**
  4. **Icon-based**：在彩色圆角矩形内放图标，下方加文字
  5. **Sequential process**：chevron/pentagon 形状串成箭头链
  6. **Table slide**：python-pptx 原生表格
  7. **Conclusion / Thank-you**
- 图标查找：用 `icons_embeddings`（sentence-transformers）做语义最近邻 → 找不到给 fallback
- 图片：通过 `image_search` 调 Pexels API；背景图加 50% 透明度
- markdown 行内：`**bold**` / `*italic*` 在 text frame 里逐 run 渲染
- 辅助：`format_text()`、`add_bulleted_items()`、`get_flat_list_of_contents()`、`_handle_*()`、`_add_text_at_bottom()`、`print_slide_layouts()`

---

## 11. 两个 Prompt 模板（结构化技术摘要 + 短引用）

### 11.1 initial_template_v4_two_cols_img.txt（8544 字节）

层次结构：

1. **角色定义**：将 LLM 设定为 PowerPoint 专家
2. **叙事/设计原则**：故事弧、受众适配、参与感
3. **内容要求**：slide 组件、格式、verbosity
4. **输出规范**：JSON schema + 排版规则
5. **硬约束（hard constraints）**：安全/伦理底线
6. **可变输入**：topic、additional info、PDF 抽取文本

**Slide JSON schema 字段**：

| 字段 | 用途 |
|---|---|
| `title` | 整套 deck 标题（叙事化，而非"主题词" generic 化） |
| `heading` | 单页标题 |
| `bullet_points` | 主体，支持嵌套（子 bullet 数组、或两栏对象） |
| `key_message` | 高亮 insight 框（整 deck 最多 3 个） |
| `img_keywords` | 视觉化、具体的图片检索词（英文） |
| `table` | 可选，含 headers + rows |

`bullet_points` 嵌套：
- 数组 → 子项目
- 对象 → 两栏布局

**硬性规则**：
- 共 10–12 页，最多 20 页；必须有结论页
- 必含：≥1 张 table、1 张 icons 页（4–6 个 icon）、1 个两栏布局、1 个顺序过程（≤3 步）
- 主动句 + 结果导向 bullet
- table 页不能再加普通 bullet
- icons 用 `[[icon-name]]` 语法，不允许 Unicode emoji
- sequential process slide 第一项以 `>>` 开头

**叙事弧（关键设计）**："Establish context or a problem, build tension or complexity, then resolve it. Each slide should feel like it advances this arc, not just adds information."

**Verbosity 1–10**：
- 默认 7
- sales pitch 3–5
- classroom lecture 8–9
- 决定每页字数 + 解释深度

**受众适配**：高管 → outcome 导向；工程师 → 技术细节

**安全约束（直接引用）**："MUST NEVER create any content that is illegal, harmful, unsafe, violent, abusive, dangerous, bullying, or violates privacy."

**代表性短句引用（每句 < 25 词）**：

- bullet 风格："Prefer 'Costs dropped 40% when teams adopted X' over 'X reduces costs'"
- title 叙事化："Why Most Agile Transformations Fail — And What to Do Instead rather than Agile Transformation"
- 结论页："Distill 3–5 most important insights as memorable, standalone statements"
- 图片关键词："Surgeon operating room is better than healthcare; solar panel rooftop installation better than energy"
- CTA 具体化："Run a 2-week pilot on your highest-risk project rather than Consider trying agile"

### 11.2 refinement_template_v4_two_cols_img.txt（9054 字节）

继承 initial 的所有规则，新增"迭代修订"语义：

**输入变量**（4 个）：

1. `Instructions`：历史指令链（从老到新）
2. `Previous Content`：上一次的完整 slide JSON
3. `Topic`：主题
4. `Additional Info`：可选补充材料

**修改规则（preserve-first）**：

- 直接引用："generally preserve the narrative arc and title...unless explicitly instructed to drastically change them"
- 维持 verbosity 水平（除非显式修改）
- 不得重复 slide
- table 内容可更新，但"do not add the same table again"
- icons 页可改，但不重复

**输出格式**：完整、合法 JSON，schema 与 initial 完全一致

**代表性短句引用**：
- "Each slide should feel like it advances this arc, not just adds information"
- "Ensure logical transitions between slides — avoid jarring topic shifts"
- "ALWAYS add a concluding slide...distill the 3–5 most important insights"

---

## 12. Medium 文章（节选要点）

- 选题动机：全球每秒产出 350 份 PPT；制作占整体准备时间约 62%
- 作者更新方向：把 SlideDeck AI 包装成"工具"，与一个极简 ReAct agent 框架 **KodeAgent**（约 2000 行）组合
- 引用："By combining a minimal agent framework like **KodeAgent** with a powerful, specialized tool like **SlideDeck AI**, you can automate complex workflows that used to take hours."
- 关键设计：工具命名 + docstring "It is critical to have proper names and docstrings for functions" when used by LLMs
- 模型名前缀映射：SlideDeck AI 自己的 `[xx]name` 不同于 LiteLLM 标准，所以工具内部做翻译
- 异步执行 + 流式更新
- 实例：用 ArXiv 工具检索 6 篇 "AI for healthcare" 论文 → 调 SlideDeck AI 生成讲故事的 deck（含趋势综合 + 未来方向 + 引用）

---

## 13. CLI 命令汇总

```bash
slidedeckai generate --model '[gg]gemini-2.5-flash-lite' \
                     --topic 'Make a slide deck on AI' \
                     --api-key 'your-google-api-key'

slidedeckai launch                # 启动 Streamlit
slidedeckai --list-models         # 列模型
```

---

## 14. 安全 / 隐私要点

- "SlideDeck AI does **NOT** store your API keys/tokens or transmit them elsewhere"
- 完全开源（MIT），用户可自行审计
- 离线模式（Ollama）连模型推理都不出本机（图片下载除外）
- `RUN_IN_OFFLINE_MODE=True` 时 UI 自动切到 Ollama 文本框
- `RUN_IN_OFFLINE_MODE` 与 online 互斥
