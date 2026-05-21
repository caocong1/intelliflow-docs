# slides_generator (ai-forever) 报告

> 来源: https://github.com/ai-forever/slides_generator
> 作者: Said Azizov (Sber/AI Forever) · License: MIT
> 抓取时间: 2026-05-20

## 1. 项目概览

slides_generator 是 Sber 旗下 AI Forever 团队 Said Azizov 开源的极简 PPT 生成框架，全部用 python-pptx 直接构造 PPTX 文件（无 HTML 中间层）。整个项目用一个 CLI 命令 `python main.py -d "..." -l 'en'` 即可端到端生成一份 16:9 的演示文稿。模型栈完全是 Sber 自家：文本用 **GigaChat-Pro**，图像用 **Kandinsky 3.0**（通过本地 FastAPI server 暴露在 `0.0.0.0:8188`）。支持俄/英双语 prompt config。

定位是 "single-prompt simple framework"：没有 outline 大纲规划阶段、没有 design contract 设计契约、没有迭代编辑模式、没有评估指标。整个生成流程是流水线式的一次性 batch，胜在结构透明、可读性高，适合作为研究/教学样本。

## 2. 架构 — Pipeline Stages

整套流程被 `constructor.py::generate_presentation` 串成 4 个 tqdm 进度步骤，没有 agent loop：

1. **Titles**：用 `title_prompt` 一次性生成全部 slide 标题（numbered list 解析），每个标题 ≤4 词。
2. **Body texts**：对除封面外的每个标题，单独调用 `text_prompt` 生成 ≤20 词的一句正文，依赖 `prompt: ` 前缀作为字符串切割锚点。
3. **Images**：对每页用 `random.choices(weights=[4, 1])` 决定 side-image vs background-only。side-image 用 `image_prompt` 生成视觉描述，调 Kandinsky 出竖图或方图；background-only 用 `background_prompt` 生成关键词，拼上随机抽取的 `background_style` 后送 Kandinsky 出横图。
4. **Slide assembly**：`generate_slide` dispatcher 按 (title, text, picture_path, background_path) 的有无组合，分发到 3 个 slide 构造器之一：`generate_title_slide` / `generate_plain_text_slide` / `generate_image_slide`。

字体在 `main.py` 启动时 `Font.set_random_font()` 一次性抽定，整套幻灯片共用同一字体（须同时存在 basic 和 bold 两个 style）。Background style 同样在生成前 `random.choice(prompt_config.background_styles)` 一次性抽定，整套统一风格。

## 3. Prompt 工程要点

四类 prompt 都封在 `PromptConfig` dataclass，关键设计是 **few-shot examples + prefix 锚点**。摘录核心模板：

**title_prompt** 强制 numbered list 输出，便于 `title.index('. ')` 切割：

```
You are given a presentation description: "{description}".
The title should be brief, no more than 4 words.
Present the response as a numbered list.
Examples:
 Query: Description of a presentation about marketing strategy ...
1. Introduction
2. Marketing Goals
3. Market Analysis
...
```

**text_prompt** 用 `prompt: ` 前缀作为 LLM 输出的可解析锚点：

```
Write one sentence no more than 20 words for a slide with the title "{title}".
Write only the final text, starting with "prompt: ".
Examples:
prompt: The 20% sales increase is attributed to ...
```

**image_prompt** 显式禁止文字/数字/图表/公司名出现在图上，避免 Kandinsky 渲染脏字：

```
Generate a detailed description of an aesthetic image for a slide with the title: "{title}".
Exclude numerical values, text, graphs, company names, and similar content.
Avoid using text on the image.
Start with the word "Description: ".
```

**background_prompt** 先让 LLM 出 4 个关键词，再拼上从 14 种预设里随机抽的 `background_style` 字符串：

```
Use in-context learning to generate 4 key words related to the content of the slide.
Write the key words separated by commas.
Examples:
Input: Presentation about the latest trends in digital marketing.
Title: Emerging Technologies
prompt: innovation, digital, trends, technology
```

14 种 background_styles 是写死的字符串列表，包含 "Gradient. WITHOUT TEXT, Vectors style, ..."、"Corporate. Professional look, Subtle gradients, ..."、"Dark Mode. Deep black tones, ..." 等。最终送 Kandinsky 的 prompt 是 `f'{keywords}, {background_style}'`。俄语 prompt 输出会通过 `googletrans` 翻译成英文再喂 Kandinsky。

## 4. 可迁移到 IntelliFlow 的点

IntelliFlow 走的是 LandPPT-style 4-layer pipeline + 图片化 PPTX，视觉一致性是主要痛点。slides_generator 虽小，但有几个轻量战术值得借鉴：

- **背景风格预设池随机化**：把 14 个写死的 style 字符串改造成可配置的"风格 token 库"。在 design contract 之外，允许用户选/AI 抽一个 mood，整套 deck 共用，能廉价地拉开视觉差异，缓解"每篇都长得一样"。
- **fit_text 自适应字号**：`title_frame.fit_text(font_file=..., max_size=max_size, bold=True)` 配合 `for max_size in range(font.max_size)[::-5]` 倒序探测，是 python-pptx 上经典的"塞不下就降字号"实现。我们在 PPTX 导出阶段可用同一思路保底，防止长标题截断。
- **prefix 锚点 + numbered list 解析**：当后续考虑用更轻的非 JSON 输出协议时，`prompt: ` 这类前缀比纯文本更稳，比 JSON 更省 token，可作为低成本备用解析方式。
- **side-image 4:1 概率与左右随机镜像**：用伪随机引入版式抖动，避免每页一模一样。简单但有效；可在我们 image-focus 类页面里加入此类微扰动。
- **图像 prompt 显式 negative 约束**："Exclude numerical values, text, graphs, company names" 这种 negative phrasing 对文生图模型（无论 Kandinsky 还是其他）都管用，IntelliFlow 的封面/插图阶段可直接复用。

## 5. 局限

1. **无内容大纲概念**：直接出标题列表，没有 narrative arc / 章节层级 / 数据组织。
2. **每页只能 1 句正文**，无 bullet、无表格、无对比双栏、无流程图、无图表。
3. **风格无差异**：整套幻灯片共用一个随机抽到的 background_style，无法逐页变换 mood。
4. **依赖 googletrans**（非官方 Google 翻译库），易被 ban。
5. **不支持迭代/重写**：CLI 单次运行即结束，无 chat-based edit 模式，无版本回退。
6. **模型耦合**：文本仅限 GigaChat，要换模型须改 `main.py` 的 import 行。
7. **图像耗时高**：Kandinsky 50 steps × N 张，CPU 不可行，必须 GPU；好处是通过 FastAPI 解耦，可远程调用。
8. **无评估**：没有显式 metric / regression test / lint，视觉效果完全由 Kandinsky 决定，复现性差。
9. **prefix 解析脆弱**：依赖 LLM 严格按 "1. " 编号或 "prompt: " 前缀输出，遇到偏差就崩。

整体而言，这是一份"教科书式的最小可用 PPT generator"，适合做 baseline 对照，但要用于产品级文档生成，缺的层（outline、design contract、agent loop、validation）全部得补。
