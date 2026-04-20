# PPT 三线重构续做计划（供新 Session 直接接手）

> **Session 1 已交付（2026-04-19）**：preserve mode 跑通 `p1 cover`（`622eee2ab7e6e.pptx` → 原地替换 5 个文本槽位，保留背景/几何/装饰）。合同、builder、测试、legacy 冻结均已落地。
>
> **Session 1.1 已追加（2026-04-19）**：加入 **每槽位硬字符宽度/行数限制 + 超限 LLM 自愈改写**。实测 LLM 把 "无线网络建设科普方案"(20 宽度单位) 自动改成 "无线网建科普"(11)、"汇报人：IT 基础设施团队"(23) 改成 "汇报：IT基建"(11)，不再溢出槽位。
>
> **Session 1.2 已追加（2026-04-19）**：加入 **pptx 输出的低保真 HTML 预览工具** (`preserve/render-slide-preview.ts`)，支持 grouped shape 变换递归。用于 Claude 自验证，不必每次依赖 PowerPoint。
>
> **Session 2 已交付（2026-04-19）**：p2 TOC 跑通（8→4 压缩，24 shapes，4 行 title 槽位，每行 2 个 wireless 条目）。
>
> **Session 3 已交付（2026-04-19）**：p3 comparison 跑通。同时修复一个 preserve mode 里潜藏的选择器 bug：slide 15 有两个 `name="1"` 的 shape，automizer 的 `findByCreationId` 要求 creationId 带 `{...}` 花括号，bare UUID 会 fallback 到 name 查询并选中第一个同名 shape，导致第二个槽位 silently 失败。修法：builder 在调 modifyElement 前统一包 `{...}`；slot-map 文件保留 bare UUID。
>
> **Session 3.1 已追加（2026-04-20）**：用户发现 p3 左栏文字换行过密。加入 **A+B+C 组合缓解**：
> - A. `widthStretchEmu`：物理加宽槽位 bbox（+500000 EMU on slide15 left_description）
> - B. `minFontPt`：per-slot 字号缩放（14pt on slide15 left_description）
> - C. LLM 压缩 fill-plan 内容（已有）
> - 三者叠加，单独任何一个都不够用。
>
> 下一个 session 直接跑 `bunx vitest run packages/backend/src/scripts/ppt-mvp/preserve/ --config packages/backend/vitest.config.ts` 验证 27 个 test pass 基线后，从 p4 timeline (slide 22) 开始。

## 摘要

当前要明确改成 **三条线并行，但优先级不同**：

1. **模板保真线（最高优先级）**
   - 目标不是重建模板，而是**保留原 `.pptx` 模板结构并原地替换内容**
   - 这是解决 `622eee2ab7e6e.pptx` “看起来不像原模板”问题的主线

2. **HTML 保真线（第二优先级）**
   - 按模板样式生成 HTML 页面
   - 再让 AI 把整页 HTML **高保真转成 editable PPT**
   - 这条线是“模板保真”的备选/增强路线，不依赖手写 native renderer 复刻全部几何

3. **AI-native 通用线（第三优先级）**
   - 继续做我们自己的可编辑、可扩展 native family 系统
   - 但**不再承担复刻具体商业模板**的目标

默认决策：
- **暂停继续打磨当前 `native renderer 复刻模板` 路线**
- 保留现有成果，但它只作为通用 native 系统基线，不再作为模板保真主路
- 下一个 session 的主工作全部围绕 **模板保真线** 展开

## 关键改动

### 1. 新增“模板保真线”专用合同和产物

新增两种正式 artifact：

- `template_slot_map/v1`
  - 作用：描述原模板中哪些文本框、图片框、分组、装饰元素是可替换槽位
  - 关键字段：
    - `templatePath`
    - `slideIndex`
    - `slotId`
    - `slotType`：`title` / `subtitle` / `body` / `pill_label` / `image` / `footer_note`
    - `shapeId`
    - `kind`：`text` / `image`
    - `bbox`
    - `styleHints`
    - `preserveGeometry`: `true`
    - `replaceStrategy`: `replace_text` / `replace_image` / `append_runs` / `grouped_merge`
- `template_fill_plan/v1`
  - 作用：描述“无线网络内容”如何填入指定模板页
  - 关键字段：
    - `templatePath`
    - `pages`
      - `pageId`
      - `sourceSlideIndex`
      - `mode`: `preserve`
      - `slotAssignments`
      - `contentReducer`
      - `assetAssignments`

默认映射关系固定如下，不留给实现者再判断：

- `p1 cover` -> `slide1`
- `p2 toc` -> `slide2`
- `p3 comparison` -> `slide15`
- `p4 timeline` -> `slide22`
- `p5 process` -> `slide21`
- `p6 device_overview` -> `slide24`

### 2. 模板保真线的实现方式

新增一条独立脚本链，不复用当前 `build-native-from-page-plan.ts` 作为主实现：

- `extract-template-fillable-slots.ts`
  - 输入：原 `.pptx`
  - 输出：`template-slot-map.json`
  - 复用现有 `extract-template-layout-presets.ts` 的 XML/shape 解析能力，但新增“槽位语义识别”
- `build-from-template-preserve.ts`
  - 输入：
    - 原 `.pptx`
    - `template_fill_plan/v1`
    - 目标内容
    - 目标素材
  - 输出：新的 `.pptx`
  - 行为：
    - 复制原模板
    - 原地替换文本和图片
    - 保留原 slide master / layout / shape geometry / crop / decoration / grouping
    - 不做整页截图 fallback
- `build-wireless-template-preserve.ts`
  - 针对无线网络样例的 thin wrapper
  - 只负责把固定 page plan / asset plan 适配到保真模板构建脚本

关键限制：
- **不允许**在 preserve mode 里“重新发明布局”
- **不允许**把 preserve mode 再退化成当前 renderer 坐标重画
- **只允许**：
  - 替换内容
  - 替换图片
  - 对模板允许的重复卡片做最小复制/最小合并

### 3. 各页的内容压缩与填充策略

这些策略在 `template_fill_plan/v1` 里固定，不留实现者再决定：

- `p1 cover`
  - 替换：
    - 英文小标题
    - 中文主标题
    - 副标题
    - 两个底部 pill
  - 保留：
    - 原人物背景
    - 蓝绿几何块
    - 原标题区大结构
- `p2 toc`
  - 原模板只有 4 段目录
  - 无线内容 8 项压成 4 组：
    - `01+02`
    - `03+04`
    - `05+06`
    - `07+08`
  - 每组：
    - 主标题 = 第一项标题
    - 次标题 = 第二项标题
    - 下方说明 = 两项 subtitle 用 ` | ` 拼接
- `p3 comparison`
  - 使用原模板双图 + 下方说明区
  - 左右各保留：
    - 1 个标题
    - 3 条 bullet
  - 不新增第三层卡片
- `p4 timeline`
  - 使用原模板 2x2 内容块
  - 5 个节点压成：
    - 前 4 节点 -> 4 个面板
    - 第 5 节点 -> 底部 takeaway strip
- `p5 process`
  - 使用原模板 4 个步骤块
  - 前 4 步 -> 4 块
  - 第 5 步 -> 底部总结条
- `p6 device_overview`
  - 使用原模板 4 列结构
  - 前 3 列 -> 3 个设备
  - 第 4 列 -> 部署摘要/场景汇总

### 4. HTML 保真线的具体落法

这条线不替代 preserve mode，但要单独建起来，避免只有一种方案：

新增：

- `template-style-html-contract.md`
- `build-template-style-html.ts`
- `html_to_ppt_fill_plan/v1`
- `build-wireless-html-fidelity.ts`

流程固定为：

1. 从模板抽出一页视觉风格合同
   - 背景图
   - 分区比例
   - 标题区位置
   - 装饰几何
   - 卡片节奏
2. 用这个合同生成 HTML 页面
3. 把 HTML 和页面内容一起交给 AI
4. 要求 AI 输出：
   - editable PPT object plan
   - 或者直接生成中间 PPT scene/native object JSON
5. 再编译成 PPT

HTML 保真线只先做 **1 页 POC**：
- 先做 `cover`
- 如果 `cover` 保真明显好于当前 native 重建线，再扩到 `toc`

默认目标：
- **不是**生成整套 deck
- 而是证明“模板风格 HTML -> AI editable PPT”在高保真上优于当前 renderer 复刻

### 5. AI-native 线的边界调整

AI-native 线继续保留，但从下个 session 开始，目标要写死成：

- 通用 editable family
- 不要求像 `622eee2ab7e6e.pptx`
- 不再拿它和模板保真线做同一个验收标准

执行规则：
- 当前 `build-native-from-page-plan.ts` 只做通用系统
- 模板保真需求一律走 preserve mode 或 HTML fidelity mode
- 不再把“模板复刻效果差”当作 AI-native 线的问题

## 测试与验收

### 单元测试

新增测试覆盖：

- `extract-template-fillable-slots.ts`
  - 能识别 text/image slot
  - 能保留 shapeId / bbox / media rel
- `build-from-template-preserve.ts`
  - 替换文本后 shape 数不变
  - 替换图片后 rel 正确更新
  - 不破坏 slide layout/master 关系
- `template_fill_plan/v1`
  - 分组逻辑正确
  - `p2` 的 8 -> 4 压缩规则固定不漂移

### 端到端测试

必须新增并通过：

- 用 `622eee2ab7e6e.pptx` 原模板原地生成无线网络 deck
- 输出 PPT：
  - PowerPoint 打开无修复提示
  - `unzip -t` 通过
  - `quality-gates` 通过
- 自包含版本也要通过：
  - 不依赖外部 `layout-presets.json`
  - 只靠模板文件和 fill plan 就能构建

### 人工验收标准

新 session 的验收不要再用“颜色像不像”这种模糊标准，而要逐页看：

- `cover`
  - 第一眼必须明显像原模板封面
  - 左图右文、蓝绿斜切块、底部 pill 节奏保持
- `toc`
  - 第一眼必须明显像原模板目录页
  - 左侧大“目录”区 + 右侧 4 段结构必须保留
- `comparison/process/timeline/device`
  - 看起来必须属于同一模板家族，而不是通用卡片页套模板色

如果某页看起来仍像“自己的版式换皮”，那页视为不通过。

## 假设与默认值

- 继续以 `622eee2ab7e6e.pptx` 为模板保真主 benchmark（Session 1 已固化到仓库 `packages/backend/test-fixtures/ppt-mvp/`，通过 `fetch-template-fixture.ts` 从 `/tmp` 自动复制）
- 当前 repo 里的 `scripts/ppt-mvp` 和 `docs/design/ppt-mvp` 继续作为唯一工作区
- 暂不接 `runtime/export.service.ts`
- 暂不继续为模板保真目标扩当前 generic native renderer（Session 1 已通过 `USE_LAYOUT_PRESET_RENDER` 环境变量冻结）
- HTML 保真线只做 `cover` 单页 POC，不与 preserve mode 并行抢主进度

## Session 1 交付概要（2026-04-19）

**Gate 1 — automizer 去风险**：`pptx-automizer@0.8.1` 在 `622eee2ab7e6e.pptx` 上 `loadRoot + setCreationIds` 返回稳定 UUID（所有目标 slide 1/2/15/21/22/24 的 shape creationId 均非空）。`modify.setImage` 不存在，图片替换走 `automizer.loadMedia(file)` + `modify.setRelationTarget(file)`。Round-trip 输出 `unzip -t` 通过。详见 `.workflow/.scratchpad/gate-1-report.md`。

**Gate 2 — 合同层**：

- [packages/backend/src/scripts/ppt-mvp/preserve/template-slot-map-schema.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/template-slot-map-schema.ts)（Ajv，匹配 `page-plan-schema.ts` 风格）
- [packages/backend/src/scripts/ppt-mvp/preserve/template-fill-plan-schema.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/template-fill-plan-schema.ts)
- [docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide1.slot-map.json](ppt-mvp/slot-maps/622eee2ab7e6e/slide1.slot-map.json)（8 个 slot：title/eyebrow/body/pill_1/pill_2 可替换，hero_bg/brand_icon/decoration_pill_group 保留）
- [docs/design/ppt-mvp/templates/wireless-template-fill-plan.json](ppt-mvp/templates/wireless-template-fill-plan.json)（p1 only）

**Gate 3 — Builder**：

- [packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.ts)（CLI：`--fill-plan --out [--template] [--slot-map-dir]`，strategies：`replace_text` / `replace_runs` / `preserve`，`replace_image` 和 `grouped_merge` 留到 Session 2）
- [packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts)（无线 deck thin wrapper）
- [packages/backend/src/scripts/ppt-mvp/preserve/fetch-template-fixture.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/fetch-template-fixture.ts)（把 `.pptx` 从 `/tmp/ppt-research/batch-input/` 复制到 `packages/backend/test-fixtures/ppt-mvp/`）
- 运行：`bun packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts /tmp/preserve-p1.pptx`
- 输出：sldIdLst 只保留 slide26（替换后的封面），25 个原模板 slide XML 虽在 zip 中但从 sldIdLst 移除，不显示

**Gate 4 — 验证 + 冻结**：

- [packages/backend/src/scripts/ppt-mvp/preserve/verify-pptx-relationships.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/verify-pptx-relationships.ts)（独立关系完整性检查）
- [packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.test.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/build-from-template-preserve.test.ts)（8 tests：schemas、文本替换、shape 数不变、sldIdLst 单页、关系完整、tripwire、co-location 边界）
- `USE_LAYOUT_PRESET_RENDER` 环境变量冻结了 variant-library.ts 的 6 个 `renderExtractedTemplate*` 分支（默认关闭 → `layoutPresetRuntime` 为 undefined，fall back to generic）

### Session 2 的起跑线

直接从“扩 p2 slot-map”开始即可。依次：

1. `docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide2.slot-map.json`（p2 TOC，24 个 shapes，4 段目录 → 需引入 `grouped_merge` strategy 实现 8→4 压缩）
2. `slide15.slot-map.json`（p3 comparison，含双图 → 需实现 `replace_image` strategy：`automizer.loadMedia + modify.setRelationTarget`）
3. `slide22.slot-map.json`（p4 timeline 2×2）
4. `slide21.slot-map.json`（p5 process 4 步 + footer）
5. `slide24.slot-map.json`（p6 device 4 列，51 shapes 中需筛内容承载 shape）
6. 扩 fill-plan 到 6 页，跑 `build-wireless-template-preserve.ts /tmp/preserve-all.pptx`
7. 人工验收：在 PowerPoint 中逐页看，是否“明显像原模板”

所有 strategy / slot-map / fill-plan 合同已固化，Session 2 不需要再改合同层。

## Session 1.1 追加：字符宽度/行数硬约束 + LLM 自愈改写（2026-04-19）

### 问题

Session 1 的 p1 输出在 PowerPoint 里打开时，虽然不弹修复，但视觉上有两处溢出：标题 "无线网络建设科普方案"（10 个 CJK 字符）比原模板 "部门复盘总结"（6 个）长 67%，直接超宽；`pill_1` "汇报人：IT 基础设施团队" 也换行成两行。本质：**preserve mode 只负责在槽位里塞文本；槽位本身的几何是原模板的，不能改宽；因此内容必须先被压到槽位能容纳的长度**。

### 模型

每个文本槽位在 slot-map 里增加两个字段：

- `maxWidthUnits` — 每行上限，CJK 字符算 2 单位、ASCII 算 1 单位（fullwidth 标点也算 2）。作者凭 `textSample` 校准，不依赖字体度量。
- `maxLines` — 总可见行数上限（默认 1，表示单行槽）。多行槽使用 `ceil(width / maxWidthUnits)` 估算自动换行。

校验走 [text-width.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/text-width.ts)：
- `validateSingleLine(value, max)` — 单行槽
- `validateParagraphs(paragraphs, maxW, maxLines)` — 多行槽，每段独立校验宽度 + 总行数求和

### LLM 自愈

Builder 在 `addSlide` 之前就对每个 text 分派做校验。超限时默认走 [rewrite-with-llm.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/rewrite-with-llm.ts)：

- 复用 `ai-pipeline/claude-client.ts`（跟现有 AI 线同一条路径）
- Prompt 写死硬约束（maxWidthUnits、maxLines、CJK=2/ASCII=1 规则、语言保持一致）
- 最多两次 retry；还不 fit 就抛错
- `--strict` flag 跳过 LLM，直接报错（CI/debug 用）
- 测试通过 `rewriteMocks: Record<slotId, cannedJson>` 注入确定性答复

### slide1 calibration

```
eyebrow  maxWidthUnits=40, maxLines=1
title    maxWidthUnits=12, maxLines=1
body     maxWidthUnits=40, maxLines=2
pill_1   maxWidthUnits=14, maxLines=1
pill_2   maxWidthUnits=14, maxLines=1
```

### 已知局限 + Phase 2 TODO

- **不做自动字号缩放**（用户明确要求先不做）。当 LLM 无法压到限制时直接报错，不降字号硬塞。
- **TODO(Phase 2)**：给文本槽位加 `minFontPt` 字段作为兜底。LLM 改写仍超限时，builder 逐步降字号（直到 `minFontPt`）再验一遍，仍不行才报错。入口已经在 `rewrite-with-llm.ts` 的头部注释里留。
- **宽度估算是启发式**。精确的 per-font-per-size 测量需要接 fontkit/harfbuzz。当前每个槽位的 `maxWidthUnits` 由作者基于 `textSample` 手动校准——加新 slide 的 slot-map 时，**拿原模板最长的那行当基准**是最安全的。
- **LLM 调用需要 API**。`build-wireless-template-preserve.ts` 已接 `ensureLiveClaudeEnvFromDb` 从 DB 里取凭证；如果环境里既没 `ANTHROPIC_*` env 也没 DB，过了 3 次 retry 就会报 "Live Claude call requires ANTHROPIC_BASE_URL..."。CI 里用 `--strict` 或 `CLAUDE_MOCK=1`。

### 测试基线

`bunx vitest run packages/backend/src/scripts/ppt-mvp/preserve/ --config packages/backend/vitest.config.ts` — 22 tests pass（11 for text-width, 11 for builder 包括 rewrite/strict/retry-fail 三条路径）。

## Session 1.2 追加：低保真 HTML 预览（2026-04-19）

问题：每次让用户在 Parallels PowerPoint 里打开 .pptx 截图发来，反馈循环太慢。

方案：写 [render-slide-preview.ts](../../packages/backend/src/scripts/ppt-mvp/preserve/render-slide-preview.ts)：

- 解压 .pptx，正则提取目标 slide 的 shape 树（含 `<p:grpSp>` 嵌套）
- 递归累积 group 变换（`off + (local - chOff) * (ext/chExt)`）
- 用 Chrome headless 把绝对坐标的 div/img 渲染成 1600×900 PNG
- 用途：看 **文本是否溢出槽位**（不保证字号/字体精确）

```bash
bun packages/backend/src/scripts/ppt-mvp/preserve/render-slide-preview.ts <pptx> --slide <N> --out <png>
```

已知局限（不修）：
- 字体与实际 PowerPoint 不同（用 PingFang SC 兜底）
- 旋转、渐变、阴影都忽略
- 字号是 bbox 高度的启发式估算
- **所以这是 directional 预览**，有疑问的页仍需真机验收

## Session 2 已交付：p2 TOC（2026-04-19）

- Slot-map：[slide2.slot-map.json](ppt-mvp/slot-maps/622eee2ab7e6e/slide2.slot-map.json)，24 shapes，其中 4 个 row_N_title 是 `replace_runs`（`maxWidthUnits: 25, maxLines: 2`），其余 20 个 shape 全部 preserve（含 4 个 number pill bg、4 个 number text "01"-"04"、9 个 group 装饰容器）。
- Fill-plan 扩展了 p2 部分：`grouped_merge` 策略由**作者在 fill-plan 侧完成**（不需要 builder 新增 strategy），每个 row 直接提供 2 段 paragraphs，对应 wireless TOC 的 `01+02`、`03+04`、`05+06`、`07+08`。
- 测试新增：slide2 schema 解析 + slide27 8 个 wireless 条目文本 + 4 个 number 保留 + 原模板占位文本被清除。
- 预览：`bun packages/backend/src/scripts/ppt-mvp/preserve/render-slide-preview.ts /tmp/preserve-p1p2-v1.pptx --slide 27 --out /tmp/preserve-p2.png`

## Session 3 已交付：p3 comparison（2026-04-19）

### 发现的模板现实

Slide 15 实际不是经典的"左右双栏比较"布局——它是**单栏文字 + 双图 + 装饰**：

- LEFT 区：1 个 sub-title + 1 段多行描述 + 图标 + 圆角大矩形 bg
- MIDDLE-RIGHT：2 张 illustration image（图片 15 + 图片 16）
- 顶部：section title + eyebrow pill + 一条横贯宽描述

Wireless p3 的内容（leftTitle/leftBullets + rightTitle/rightBullets）没法 1:1 对应到左右两栏。所以做了务实的权衡：

- LEFT 栏 = wireless leftTitle（sub-title 槽）+ leftBullets（description 槽的 3 段 paragraphs）
- 顶部横幅 top_description = wireless "有线网络主要局限" 一句话摘要（compressed 版）
- 顶部 section_title + eyebrow 都正常替换
- 图片暂时 preserve（模板原图留着），image 替换推迟到后续 session

### 修掉的 bug：creationId 必须带花括号

Session 3 跑 p3 时发现 `left_description` 的替换 silent fail。根因：

```js
// pptx-automizer/dist/classes/has-shapes.js
if (selector.creationId) {
  strategies.push({ mode: "findByElementCreationId", selector: selector.creationId, ... });
}
strategies.push({ mode: "findByElementName", ... });  // 回退

// pptx-automizer/dist/helper/xml-helper.js
static findByCreationId(doc, creationId) {
  // getAttribute('id') === creationId
  // XML 里 id="{UUID}"，必须字面等于
}
```

- Automizer 的 `setCreationIds()` 返回 bare UUID（没花括号）
- 但 `findByCreationId` 做 literal 字符串匹配，XML 里是 `id="{UUID}"`
- Bare UUID 匹配失败 → fallback 到 name 查询
- Slide 15 有 **两个** shape 都叫 `name="1"`（LEFT sub-title + LEFT desc）→ name 查询只选第一个 → LEFT desc silent 失败

修法：builder 在组装 selector 时统一 `${rawId}.startsWith("{") ? rawId : \`{\${rawId}}\``，slot-map 文件保留 bare UUID（不要求作者熟悉 automizer 的字面匹配）。

### slide15 calibration

```
section_title    maxWidthUnits=26, maxLines=1   # "无线与有线网络核心优势对比"=26 正好 fit
eyebrow_pill     maxWidthUnits=23, maxLines=1   # "ARCHITECTURE COMPARISON"=23
top_description  maxWidthUnits=75, maxLines=1   # 一句话摘要
left_sub_title   maxWidthUnits=20, maxLines=1   # "无线网络 · 核心优势"=14 余量
left_description maxWidthUnits=28, maxLines=4   # 3 bullets + 余量
```

所有 5 个 text 槽位都能 fit 不触发 LLM 改写（只 p1 的 title + pill_1 仍需 LLM）。这加快了 build 的速度，也提高了可预测性。

### 经验：calibration 要看 wireless 内容的实际宽度来调，不要死守"textSample 有多少单位就设多少"

前几次调整踩了坑：先按 textSample 长度设（比如 12），LLM 每次 build 都要改写；改写是串行的，网络慢时会 timeout。把 fill-plan 里**知道一定溢出的内容**直接精简，只留下需要 LLM 兜底的**边界情况**，构建稳定性上一个台阶。

## Session 3.1 追加：A+B+C 组合缓解文字溢出（2026-04-20）

真机验收 p3 发现左栏 3 条 wireless bullet 换行过密，直观体验差。单独任何一招都不够：

- **C 单用（LLM 压缩）**：文案已经很短，再压丢语义；wireless bullets 原本就是精炼的一句话
- **A 单用（加宽槽位）**：可能撞到右侧图片；破坏 preserve 几何
- **B 单用（缩字号）**：字号差得太明显会视觉不平衡

组合最稳：加宽一点 + 缩一点字号 + LLM 再精简一点。每个量都不大，叠加后空间够了。

### Schema 扩展

Slot-map slot 新增 3 个可选字段（都是 text 槽位才用）：

```json
{
  "widthStretchEmu": 500000,    // A: 物理 cx 加宽（EMU，delta，builder 用 modify.updatePosition 叠加）
  "heightStretchEmu": 0,        // A: 物理 cy 加高（EMU，delta）
  "minFontPt": 14               // B: 字号覆盖到这个 pt（builder 直接写所有 a:rPr 的 sz 属性）
}
```

三个字段是**独立 opt-in**的。没设 → 行为不变（pure preserve）。作者按槽位需要叠加。

### Builder 实现

- 在 `modifyElement(selector, [callbacks])` 里把多个 callback 用数组传入
- Callback 顺序：
  1. `modify.setText(v)` 或 `modify.setMultiText(paragraphs)` — 主文字替换
  2. `modify.updatePosition({cx, cy})` — 物理加宽/加高（delta 语义）
  3. 自定义 `setShapeFontSize(pt)` callback — 直接遍历 shape 内所有 `<a:rPr>` 和 `<a:endParaRPr>`，把 `sz` 属性设成 `pt * 100`（automizer 自带的 `ModifyTextHelper.setSize` 只改单个 rPr，不覆盖 shape）

### slide15 校准结果

```
left_description: maxWidthUnits=28, maxLines=4, minFontPt=14, widthStretchEmu=500000
```

其它槽位无 A/B，纯 C。

### 用 preview 工具验证 A+B 真的作用

升级了 `render-slide-preview.ts` 使它读取实际的 `<a:rPr sz="...">` 而不是靠 bbox 高度估字号，1pt ≈ 1.6px 折算。现在 preview 能直观看到字号差异。不能做到 PowerPoint 像素精确，但能区分 "这个槽位字更小了" 和 "这个槽位加宽了"。

### 已知局限

- **Preview 字体不是模板的实际字体**（PingFang SC vs 思源宋体 CN），同字号下 PingFang 更宽，所以 preview 还是比真机略溢出。不会改进这一点——真机验收仍是最终标杆。
- **widthStretchEmu 不检查碰撞**。如果加宽超过了相邻 shape，preserve mode 会静默让文字覆盖到图片上。不做碰撞检测——作者负责不撞车。Session 2 起跑前先目测邻近 shape 的 x 坐标。

### 测试

新增一个 test 直接读 slide28.xml，断言 `<a:ext cx="3245350">`（验 A）+ 所有 `<a:rPr sz="1400">`（验 B）。

## Session 3.2 追加：page_type ↔ topology 强约束（2026-04-20）

### 问题

Session 3 的 p3 → slide 15 映射是盲选的。slide 15 实际是 `single_col_with_dual_image` 拓扑（单栏文字 + 2 张辅助图），而 wireless `comparison` 页内容是对称 2 路（左/右各 1 个标题 + 3 bullet）。强塞进单栏布局就只能委屈内容（把右侧 bullets 压缩成 1 行摘要塞到顶部横幅），真机看就是"能看但不好看"。

### 修法

1. **拓扑分类 at ingest**：所有 25 张 slide 已分类（见 [slot-maps/622eee2ab7e6e/README.md](ppt-mvp/slot-maps/622eee2ab7e6e/README.md)）。
2. **每个 wireless page_type 必须绑定明确的 topology**（下表），不再允许拍脑袋选 slide。
3. **Pre-flight check**：builder 在 build 前校验 `slot-map.topology === expected_topology[fill-plan.page_type]`，不匹配就报错。

### page_type → expected topology

| wireless page_type | 要求的 topology | 为什么 |
|---------|-----------------|------|
| `cover_hero_image` | `cover_hero` | 封面只有一个，全局唯一 |
| `toc_card_grid_8` | `toc_list_4`（+ grouped_merge 压缩 8→4） | N 项编号列表 |
| `comparison_dual_image` | `grid_2x2_symmetric` 或 `col_2_symmetric` | 真对称 2 路对比，左右视觉等权 |
| `timeline_horizontal_5` | `row_4_cells`（+ footer 5→4+1）或 `row_5_flow` | 横向线性顺序关键 |
| `process_flow_5` | `row_4_cells`（+ footer 5→4+1）或 `row_5_flow` | 同 timeline 但带流程箭头 |
| `device_triptych_3` | `row_3_cells`（A/B/C 三列） | 3 路并列 |
| `summary_v1` | `single_col` 或 `repeat_2` | 单点总结/两段回顾 |
| `closing_statement_v1` | `closing` | THANKS 页全局唯一 |

### 修正后的 slide 绑定

| page | 旧 | 新 | 拓扑 | 状态 |
|------|----|----|------|------|
| p1 | 1 | 1 | cover_hero | ✅ |
| p2 | 2 | 2 | toc_list_4 | ✅ |
| p3 | ~~15~~ | **17** | grid_2x2_symmetric | ✅ (Session 3.2 修) |
| p4 | ~~22~~ | **21** | row_4_cells | 🟡 改为 21 是为了横向线性流（22 也是 grid_2x2 会跟 p3 结构雷同） |
| p5 | 21 | 21 | row_4_cells | 🟡 p4 + p5 共用 slide 21 会内容错乱，**p5 另选**：slide 21 让给 p4，p5 用 **row_5_flow 没有合适的**, 考虑 `row_4_cells` 另一张或承认压缩 |
| p6 | ~~24~~ | **13** | row_3_cells (A/B/C) | 🟢 换到 13 为真 3-cell 三联图；24 是 repeat_4 不合 |

**p4/p5 冲突**：两者都想要 `row_4_cells`，但 slide 21 只有一个。

**Session 4 决策**：p4 占 slide 21（timeline 用 row_4_cells 最贴切）。p5 process 另想办法——slide 22 的 grid_2x2 可以压 5→4，但跟 p3 结构雷同。留给 Session 5 再定。

## Session 4 已交付：p4 timeline（2026-04-20）

- Slot-map：[slide21.slot-map.json](ppt-mvp/slot-maps/622eee2ab7e6e/slide21.slot-map.json) — topology=`row_4_cells`，5 个 slot：section_title + 4 个 cell
- 5→4 压缩：把 wireless 的 2009/2014 两代 Wi-Fi 合并成 "2009·2014 · Wi-Fi 4/5" 1 个 cell（相邻早期代；"前 4 节点 → 4 面板，第 5 下沉 footer" 用不上因为 slide 21 没 footer 槽位）
- 每 cell 用 `replace_runs` 3 段 paragraphs：year / Wi-Fi 代号 / detail
- Calibration：cell `maxWidthUnits: 16, maxLines: 4`（4 段一行都在 8-15 units 内），section_title `minFontPt: 22`
- 无 LLM 改写触发，纯 strict build 成功（fill-plan 预先精简到 fit）
- Quality gate：`ok=True`, 4 pages × 19 slots replaced, 0 silent-fail, 0 drift
- 29/29 tests passing

## Session 5 已交付：p5 process（2026-04-20）

- Slot-map：[slide22.slot-map.json](ppt-mvp/slot-maps/622eee2ab7e6e/slide22.slot-map.json) — topology=`grid_2x2_symmetric`，9 slot（section_title + 4 对 step_N_title + step_N_desc）
- 5→4 压缩：wireless 5 步合并成 4（步骤 4 "参数调优" + 步骤 5 "测试验收" 合并为 "调优验收"）
- 跟 p3 同拓扑（grid_2x2）但内容语义不同（process steps vs comparison sides），接受视觉结构相似的妥协
- Calibration：cell title `maxWidthUnits: 16, maxLines: 1`；desc `maxWidthUnits: 36, maxLines: 2`
- Quality gate：5 pages × 28 slots, 0 silent-fail

## Session 6 已交付：p6 device_triptych（2026-04-20）

- Slot-map：[slide13.slot-map.json](ppt-mvp/slot-maps/622eee2ab7e6e/slide13.slot-map.json) — topology=`row_3_cells`，4 slot（section_title + 3 个 cell A/B/C）
- 完美 3:3 对应：wireless 3 个 AP 设备（面板/吸顶/室外）→ slide 13 的 A/B/C 三列
- 每 cell 3 段 paragraphs：device name / scenario / note
- Calibration：`maxWidthUnits: 24, maxLines: 4`
- Quality gate：6 pages × 32 slots, 0 silent-fail
- 33/33 tests passing

## 整个 wireless deck 就位

`/tmp/preserve-all6.pptx` 是最终产物：

| slide | page | topology | content |
|-------|------|----------|---------|
| 26 | p1 | cover_hero | 封面 |
| 27 | p2 | toc_list_4 | TOC 8→4 |
| 28 | p3 | grid_2x2_symmetric | wireless vs 有线对比 |
| 29 | p4 | row_4_cells | Wi-Fi 演进 4 era |
| 30 | p5 | grid_2x2_symmetric | 建设实施 4 步骤 |
| 31 | p6 | row_3_cells | AP 形态 3 种 |

验收工具：
```bash
# 完整 build
bun packages/backend/src/scripts/ppt-mvp/preserve/build-wireless-template-preserve.ts /tmp/out.pptx --strict

# Quality gate
bun packages/backend/src/scripts/ppt-mvp/preserve/quality-gate.ts /tmp/out.pptx \
  --template packages/backend/test-fixtures/ppt-mvp/622eee2ab7e6e.pptx \
  --fill-plan docs/design/ppt-mvp/templates/wireless-template-fill-plan.json

# 单页 preview
bun packages/backend/src/scripts/ppt-mvp/preserve/render-slide-preview.ts /tmp/out.pptx --slide <N>

# 测试
bunx vitest run packages/backend/src/scripts/ppt-mvp/preserve/ --config packages/backend/vitest.config.ts
```

- Slide 22 shape 数：31（比 p3 的 19 更多，需要仔细枚举装饰元素做 preserve）
- Wireless p4 内容：5 个 timeline node（year/title/detail）→ 需要压成 4 节点 + 底部 takeaway strip
- 按 ppt-three.md 规则：前 4 节点 → 4 个面板；第 5 节点 → 底部 takeaway strip
- 第一步 `python3 -c` 读 slide 22 shape 列表 + 按 y 排序理解视觉结构
- 第二步手写 slot-map，先不做 image 替换
- 预期 max LLM 调用 ≤ 2（title + 一个被强制压的槽）——把 fill-plan 预先精简到 fit 硬约束
