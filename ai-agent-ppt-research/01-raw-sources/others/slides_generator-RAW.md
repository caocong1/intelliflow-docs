# slides_generator (ai-forever) - 原始素材

> 来源: https://github.com/ai-forever/slides_generator
> 抓取时间: 2026-05-20
> 作者: Said Azizov (Sber/AI Forever)
> License: MIT

---

## 1. README 完整内容

```
# README

## Overview

This project generates a PowerPoint presentation based on user-provided descriptions. It leverages language models to generate text content and an image generation API to create images for the slides. The architecture is modular, allowing for easy extension and customization of the text and image generation components.

## How to Use

### Prerequisites

- Python 3.10 or higher
- Required Python packages (listed in `requirements.txt`)

### Setup

1. Clone the repository:
   git clone --recurse-submodules https://github.com/ai-forever/slides_generator.git
   cd slides_generator

2. Install dependencies:
   pip install -r requirements.txt

3. Create a .env file in the root directory with GigaChat credentials:
   AUTH_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   COOKIE=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

4. Run the FastAPI server for the image generation API:
   python src/kandinsky.py

### Running the Script

To generate a presentation:
   python main.py -d "Description of the presentation" -l 'en'

## Examples
   python main.py -d "Сгенерируй презентацию про планеты солнечной системы" -l 'ru'
   python main.py -d "Generate presentation about planets of Solar system" -l 'en'

## Architecture

### Main Components

1. main.py: Entry point. Parses CLI args, initializes components, orchestrates the process.
2. Font Class (src/font.py): Manages fonts. Random font with basic and bold styles; provides paths to basic, bold, italic, italic bold.
3. Presentation Generation Functions (src/constructor.py): Functions that generate different slide types. Handle layout, font, placement of text and images.
4. Text Generation (src/gigachat.py): giga_generate function generates text based on a prompt.
5. Image Generation (src/kandinsky.py): api_k31_generate function generates images via external API; also provides a FastAPI server.
6. Prompt Configuration (src/prompt_configs.py): Defines prompts for titles, text, images, backgrounds.

### How It Works

1. Initialization
   - main.py parses args; initializes Font with fonts dir and sets random font.

2. Prompt Configuration
   - ru_gigachat_config / en_gigachat_config define structure of prompts (titles, text, images, backgrounds).

3. Text and Image Generation
   - giga_generate generates text from description.
   - api_k31_generate generates images via FastAPI server.

4. Slide Generation
   - generate_presentation orchestrates slide creation, calling text/image gens, formats into slides.

## Extending the Project
- Adding New Font Styles: place font files in `fonts` dir; update Font class.
- Changing Text Generation: replace giga_generate in src/gigachat.py; update main.py call.
- Changing Image Generation: modify api_k31_generate or add a new function.

## Acknowledgements
Uses python-pptx for PowerPoint generation, PIL for image processing.

## Authors
Said Azizov: GitHub https://github.com/stazizov, Blog https://t.me/said_azizau

## Citation
@misc{arkhipkin2023kandinsky,
  title={Kandinsky 3.0 Technical Report},
  author={Vladimir Arkhipkin and Andrei Filatov and Viacheslav Vasilev and Anastasia Maltseva and Said Azizov and Igor Pavlov and Julia Agafonova and Andrey Kuznetsov and Denis Dimitrov},
  year={2023}, eprint={2312.03511}, archivePrefix={arXiv}, primaryClass={cs.CV}
}
```

---

## 2. 目录结构

```
slides_generator/
├── .gitignore, .gitmodules
├── LICENSE, README.md
├── app.py                       # 可能是 web demo
├── main.py                      # CLI entry
├── requirements.txt
├── fonts/                       # 字体目录（随机抽取）
├── Kandinsky-3/                 # submodule，Kandinsky 3.0 模型代码
└── src/
    ├── __init__.py
    ├── constructor.py           # 协调函数 generate_presentation
    ├── font.py                  # Font 类
    ├── gigachat.py              # GigaChat API 封装
    ├── kandinsky.py             # Kandinsky FastAPI server + 客户端
    ├── llm_utils.py             # 4 个 prompt-level 工具函数
    ├── prompt_configs/
    │   ├── __init__.py
    │   ├── en_gigachat_config.py
    │   ├── prompt_config.py     # PromptConfig 类
    │   └── ru_gigachat_config.py
    └── slides/
        ├── __init__.py
        ├── generate_slide.py    # 选择 slide 类型 dispatcher
        ├── image_slide.py       # 左/右图 + 文字
        ├── plain_text_slide.py
        ├── slide_utils.py
        └── title_slide.py
```

---

## 3. main.py（完整）

```python
import time
import argparse
from src.constructor import generate_presentation
from src.prompt_configs import en_gigachat_config, ru_gigachat_config
from src.gigachat import giga_generate
from src.kandinsky import api_k31_generate
from src.font import Font

def main():
    parser = argparse.ArgumentParser(description='Generate a presentation.')
    parser.add_argument('-d', '--description', type=str, required=True,
        help='Description of the presentation')
    parser.add_argument('-l', '--language', type=str, choices=['en', 'ru'],
        default='en', help='Language for the presentation.')
    args = parser.parse_args()

    if args.language == 'en':
        prompt_config = en_gigachat_config
    elif args.language == 'ru':
        prompt_config = ru_gigachat_config
    else:
        print("only 'en' and 'ru' configs are available, settings default 'en'")
        prompt_config = en_gigachat_config

    fonts_dir = "./fonts"
    logs_dir = "./logs"
    font = Font(fonts_dir)
    font.set_random_font()
    output_dir = f'{logs_dir}/{int(time.time())}'

    generate_presentation(
        llm_generate=giga_generate,
        generate_image=api_k31_generate,
        prompt_config=prompt_config,
        description=args.description,
        font=font,
        output_dir=output_dir,
    )

if __name__ == "__main__":
    main()
```

---

## 4. PromptConfig dataclass（src/prompt_configs/prompt_config.py）

```python
from typing import List

prefix = "prompt: "

class PromptConfig:
    def __init__(self,
        title_prompt: str,
        text_prompt: str,
        image_prompt: str,
        background_prompt: str,
        background_styles: List[str]):
        self.title_prompt = title_prompt
        self.text_prompt = text_prompt
        self.image_prompt = image_prompt
        self.background_prompt = background_prompt
        self.background_styles = background_styles
```

---

## 5. 英文 Prompt 模板（src/prompt_configs/en_gigachat_config.py — 关键节选）

### title_prompt（few-shot 风格，要求生成编号列表）

```
You are given a presentation description: "{description}".
Based on this description and examples, generate slide titles for the presentation.
The title should be brief, no more than 4 words.
Answer in English only.
Present the response as a numbered list.
Examples:
 Query: Description of a presentation about marketing strategy for a new product.
1. Introduction
2. Marketing Goals
3. Market Analysis
4. Budget
5. Conclusion
 Query: Presentation about company achievements over the past year.
1. Welcome
2. General Achievements
3. Financial Results
...
9. Q&A
 Query: Presentation about new technologies in manufacturing.
1. Introduction
...
7. Discussion
Response:
```

### text_prompt（单句 ≤20 词，带 prefix 标记便于解析）

```
You are given a presentation description: "{description}".
Write one sentence no more than 20 words for a slide with the title "{title}".
Answer in English only.
Write only the final text, starting with "prompt: ".
Examples:
prompt: The 20% sales increase is attributed to the implementation of the new marketing strategy.
prompt: Innovative technologies have improved manufacturing efficiency by 30%.
prompt: New customer engagement approaches have increased satisfaction levels by 15%.
prompt: This year, the company launched three new products that became market leaders.
Response:
```

### image_prompt（生成 Kandinsky 用的视觉描述）

```
You are given a presentation description: "{description}".
Generate a detailed description of an aesthetic image for a slide with the title: "{title}".
The description should be long and highly detailed, covering all aspects of the visual elements.
Exclude numerical values, text, graphs, company names, and similar content.
Avoid using text on the image.
Answer in English only.
Make it visually pleasing and contextually appropriate.
Start with the word "Description: ".
Examples:
prompt: A spacious conference room with a modern design, glass walls letting in plenty of natural light, a long wooden table in the center with laptops and documents, business people in formal attire sitting around, and a cityscape visible through the windows.
prompt: A forest trail surrounded by tall trees with green leaves, fallen leaves on the ground, sunlight filtering through the foliage creating a play of light and shadow, animal tracks visible on the path, and the distant sound of a river.
... (cont.)
Response:
```

### background_prompt（生成关键词，叠加 background_style 后送 Kandinsky）

```
Based on the presentation description: "{description}"
and the current slide title: "{title}".
Use in-context learning to generate 4 key words related to the content of the slide.
Write the key words separated by commas.
Examples:
Input: Presentation about the latest trends in digital marketing.
Title: Emerging Technologies
prompt: innovation, digital, trends, technology

Input: Presentation on strategies for improving customer service.
Title: Enhancing Engagement
prompt: customer, engagement, strategies, improvement
...
Response:
```

### background_styles（14 种预设风格，随机抽 1，拼到 background_prompt 后）

```
- "Gradient. WITHOUT TEXT, Vectors style, Gradient dip, More game with colors, Smooth transition."
- "Abstract. Clean lines, Modern feel, Minimalistic, Soft colors, Elegant look."
- "Nature-inspired. Soft green tones, Earthy feel, Natural textures, Organic look."
- "Technology. Futuristic design, Blue tones, Circuit patterns, Sleek lines, High-tech feel."
- "Corporate. Professional look, Subtle gradients, Clean and polished, Neutral colors, Business-oriented."
- "Retro. Bold colors, Geometric shapes, Vintage feel, Nostalgic design, Playful patterns."
- "Minimalist. White space, Simple shapes, Clean and clear, Monochrome tones, Modern elegance."
- "Art Deco. Rich textures, Metallic accents, Geometric patterns, Glamorous style, 1920s influence."
- "Urban. Graffiti art, Vibrant colors, Street style, Dynamic patterns, Energetic vibe."
- "Watercolor. Soft brush strokes, Blended hues, Artistic feel, Fluid shapes, Subtle transitions."
- "Dark Mode. Deep black tones, Subtle contrasts, Sophisticated look, Modern design, High contrast elements."
- "Elegant. Rich colors, Decorative patterns, Luxurious textures, Classic style, Refined details."
- "Nature-inspired. Earthy colors, Leaf patterns, Wood textures, Tranquil feel, Organic shapes."
- "Dynamic. Bold contrasts, Energetic lines, Motion feel, Vibrant colors, Modern design."
```

俄文 `ru_gigachat_config` 结构相同，prompt 全部俄语，例子也是俄语；background_styles 与英文版完全一致。

---

## 6. llm_utils.py（4 个 prompt-runner 工具）

```python
from typing import List, Callable
from googletrans import Translator   # 注意：依赖 googletrans
import random
from src.prompt_configs import PromptConfig, prefix

translator = Translator()

def get_translation(text: str, dest: str = 'en') -> str:
    return translator.translate(text, dest=dest).text

def llm_generate_titles(llm_generate, description, prompt_config):
    prompt = prompt_config.title_prompt.format(description=description)
    titles_str = llm_generate(prompt)
    titles = []
    for title in titles_str.split("\n"):
        sep_index = title.index('. ') + 1     # 解析 "1. xxx"
        title = title.strip()[sep_index:]
        title = title.replace('.', '').replace('\n', '')
        if prefix in title.lower():
            title = title[title.lower().index(prefix)+len(prefix):]
        titles.append(title)
    return titles

def llm_generate_text(llm_generate, description, titles, prompt_config):
    texts = []
    for title in titles:
        query = prompt_config.text_prompt.format(description=description, title=title)
        text = llm_generate(query)
        if prefix in text.lower():
            text = text[text.lower().index(prefix)+len(prefix):]
            text = text.replace('\n', '')
        texts.append(text)
    return texts

def llm_generate_image_prompt(llm_generate, description, title, prompt_config):
    query = prompt_config.image_prompt.format(description=description, title=title)
    prompt = llm_generate(query)
    if prefix in prompt:
        prompt = prompt[prompt.lower().index(prompt)+len(prompt):]
        prompt = prompt.replace('\n', '')
    return get_translation(prompt)   # 俄语 prompt 翻译为英语再喂 Kandinsky

def llm_generate_background_prompt(llm_generate, description, title, prompt_config, background_style=''):
    query = prompt_config.background_prompt.format(description=description, title=title)
    keywords = llm_generate(query)
    background_prompt = f'{keywords}, {background_style}'
    return get_translation(background_prompt)
```

---

## 7. constructor.py 核心 - generate_presentation

```python
def generate_presentation(llm_generate, generate_image, prompt_config,
        description, font, output_dir) -> Presentation:
    os.makedirs(os.path.join(output_dir, 'backgrounds'), exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'pictures'), exist_ok=True)
    presentation = Presentation()
    presentation.slide_height = Inches(9)
    presentation.slide_width = Inches(16)        # 16:9

    pbar = tqdm.tqdm(total=4, desc="Presentation goes brrr...")

    pbar.set_description("Generating titles for presentation")
    titles = llm_generate_titles(llm_generate, description, prompt_config)
    pbar.update(1)

    pbar.set_description("Generating text for slides")
    texts = [None] + llm_generate_text(llm_generate, description, titles[1:], prompt_config)
    # 第一张为封面（无 body 文字）
    pbar.update(1)

    background_style = random.choice(prompt_config.background_styles)
    # 整套幻灯片共用一个 style 风格

    picture_paths = []
    background_paths = []
    pbar.set_description("Generating images for slides")
    for t_index, (title, text) in enumerate(zip(titles, texts)):
        # 4:1 概率有侧图 vs 仅背景图
        if random.choices([True, False], weights=[4, 1], k=1)[0] and text:
            image_width, image_height = random.choice([(768, 1344), (1024, 1024)])
            caption_prompt = llm_generate_image_prompt(llm_generate, description, title, prompt_config)
            picture = generate_image(prompt=caption_prompt, width=image_width, height=image_height)
            picture_path = os.path.join(output_dir, 'pictures', f'{t_index:06}.png')
            picture.save(picture_path)
        else:
            picture_path = None
        picture_paths.append(picture_path)

        if picture_path is None:
            background_width, background_height = 1344, 768
            background_prompt = llm_generate_background_prompt(
                llm_generate, description, title, prompt_config, background_style)
            background = generate_image(prompt=background_prompt,
                width=background_width, height=background_height)
            background_path = os.path.join(output_dir, 'backgrounds', f'{t_index:06}.png')
            background.save(background_path)
        else:
            background_path = None
        background_paths.append(background_path)
    pbar.update(1)

    pbar.set_description("Packing presentation")
    for index in range(len(titles)):
        generate_slide(
            presentation=presentation,
            title=titles[index],
            text=texts[index],
            picture_path=picture_paths[index],
            background_path=background_paths[index],
            font=font,
        )
    pbar.update(1)

    output_path = os.path.join(output_dir, 'presentation.pptx')
    presentation.save(output_path)
    return presentation
```

---

## 8. slides/generate_slide.py（dispatcher）

```python
def generate_slide(presentation, title, text=None, background_path=None,
        picture_path=None, font=None, text_font_coeff=0.6):
    # 三种 slide 类型按入参组合分发
    if title and text is None and picture_path is None and background_path:
        generate_title_slide(presentation, title, font, background_path)
    elif title and text and background_path and picture_path is None:
        generate_plain_text_slide(presentation, title, text, background_path, font, text_font_coeff)
    elif title and text and picture_path and background_path is None:
        generate_image_slide(presentation, title, text, picture_path, font, text_font_coeff)
```

`generate_image_slide` 随机选择左图或右图 layout（`generate_text_title_image_left` / `_right`）。

---

## 9. Font 类（src/font.py）

```python
class Font:
    def __init__(self, fonts_dir, max_size=66):
        self.fonts_dir = fonts_dir
        self.font_name = None
        self.set_random_font()
        self.max_size = max_size

    def set_random_font(self):
        available_fonts = self._find_available_fonts()
        # 必须有 basic 和 bold 两种 style 才可用
        self.font_name = random.choice(available_fonts)

    @property
    def basic(self):  return self._find_font(f'{self.font_name}')
    @property
    def bold(self):   return self._find_font(f'{self.font_name}Bd')
    @property
    def italic(self): return self._find_font(f'{self.font_name}It')
    @property
    def italic_bold(self): return self._find_font(f'{self.font_name}BdIt')
```

---

## 10. gigachat.py（GigaChat API 客户端）

- `giga_generate(prompt, model_version="GigaChat-Pro", max_tokens=2048)` 主接口
- temperature=0.87, top_p=0.47
- 调用 https://beta.saluteai.sberdevices.ru/v1/chat/completions
- 内置 token 刷新逻辑（缓存到过期）
- 触发 `finish_reason == 'blacklist'` 时返回 "Censored Text"

---

## 11. kandinsky.py（FastAPI + Kandinsky 3）

```python
# 服务端
t2i_pipe = get_T2I_pipeline(device_map, dtype_map)

@app.post("/k31/")
def generate(request: GenerateImageRequest):
    pil_image = t2i_pipe(request.prompt, width=request.width,
                         height=request.height, steps=50)[0]
    # PNG -> base64 -> 返回

# 客户端
def api_k31_generate(prompt, width, height) -> PIL.Image:
    # POST to /k31/ ; decode base64 -> PIL.Image
```

服务端口：`0.0.0.0:8188`（Uvicorn）。

---

## 12. title_slide.py（关键片段）

```python
def generate_title_slide(presentation, title, font, background_path=None):
    slide_layout = presentation.slide_layouts[6]       # blank layout
    slide = presentation.slides.add_slide(slide_layout)
    slide_height, slide_width = 9, 16
    margin = min(slide_height, slide_width) / 18

    if background_path:
        pic = slide.shapes.add_picture(background_path, 0, 0,
            width=presentation.slide_width, height=presentation.slide_height)
        # 把图片移到最底层
        slide.shapes._spTree.remove(pic._element)
        slide.shapes._spTree.insert(2, pic._element)

    title_box = slide.shapes.add_textbox(...)
    title_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    title_frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    title_frame.word_wrap = False
    title_paragraph.text = title

    # 自适应字号：从 max_size 往下试，到能塞下为止
    for max_size in range(font.max_size)[::-5]:
        try:
            title_frame.fit_text(font_file=font.bold, max_size=max_size, bold=True)
            break
        except TypeError:
            pass

    # 半透明白底
    title_fill = title_box.fill
    title_fill.solid()
    title_fill.fore_color.rgb = RGBColor(255, 255, 255)
    set_shape_transparency(title_box, 0.5)
```

---

## 13. image_slide.py（关键片段）

```python
def generate_text_title_image_right(presentation, title, text, picture_path, font, text_font_coeff=0.6):
    slide_layout = presentation.slide_layouts[6]
    slide = presentation.slides.add_slide(slide_layout)
    slide_height, slide_width = 9, 16
    margin = min(slide_height, slide_width) / 18

    x_pixels, y_pixels = Image.open(picture_path).size
    assert x_pixels == y_pixels or x_pixels < y_pixels, \
        'only vertical and square images can be used'
    image_height = slide_height
    image_width = x_pixels / y_pixels * image_height
    image_left = slide_width - image_width

    slide.shapes.add_picture(picture_path, left=Inches(image_left), top=0,
        width=Inches(image_width), height=Inches(image_height))

    # title 放左上 1/6 高
    # text 放左下，自适应字号 = title 字号 * 0.6
    ...

def generate_image_slide(presentation, title, text, picture_path, font, text_font_coeff=0.6):
    gen_func = random.choice([
        generate_text_title_image_right,
        generate_text_title_image_left,
    ])
    gen_func(presentation, title, text, picture_path, font, text_font_coeff)
```

---

## 14. 关键技术决策摘要

| 维度 | 决策 |
|---|---|
| 文本模型 | GigaChat-Pro（Sber 自家 LLM；俄/英双语） |
| 图像模型 | Kandinsky 3.0（Sber 自家文生图） |
| 输出格式 | python-pptx 直接构造 PPTX（无 HTML 中间层） |
| Slide 类型 | 3 种：title / plain-text-with-background / text+image |
| Layout 决策 | 随机 4:1 选 side-image 或 background-only；侧图随机左/右 |
| 字号自适应 | `text_frame.fit_text()` 从 max_size=66 倒序试 |
| 字体 | 从 fonts/ 随机抽 1 套，须同时存在 basic + bold |
| 多语言 | Russian / English 两套 prompt config，俄语 prompt 翻译为英语再喂 Kandinsky |
| Prompt 结构 | 单一模板填槽（description + title），few-shot examples 内嵌 |
| Slide 解析 | LLM 输出 prefix 标记 `prompt: ` 便于字符串切割 |
| 评估 | 无显式评估代码；视觉效果由 Kandinsky 决定 |

---

## 15. 局限和注意点

1. 没有"内容大纲"概念：直接 LLM 出标题列表，无 narrative arc / 章节结构。
2. 每页只 1 句正文，无 bullet points，无表格、流程图、双栏对比等。
3. Background style 整套用同一个（随机一次定下来），不允许逐页变换。
4. 依赖 googletrans（非官方 Google 翻译库，常出 ban）做俄→英 prompt 翻译。
5. 不支持迭代/重写：CLI 单次运行即结束。
6. 文本仅限 GigaChat；要换模型须改 main.py 的 import。
7. 图像生成耗时高（Kandinsky 50 steps × N 张），但通过 FastAPI 暴露成 service，可以远程跑 GPU。
8. 无评估指标，无 prompt regression 测试。
