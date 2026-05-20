# PPT Live Run Handoff (2026-04-17)

仓库：`/Users/dongli/Workspace/intelliflow-docs`

这份文档记录本次 `scripts/ppt-mvp` 线的真实 live 运行结果，以及给下一次 Codex / Claude session 的直接接力 prompt。

## 1. 本次补上的缺口

之前 `build-wireless-ai-mvp.ts` 的 live 路径有两个实际问题：

1. **只会从环境变量读取 `ANTHROPIC_*`**，不会复用数据库里的 provider/model 配置。
2. **即使 `CLAUDE_MOCK=0`，也仍然把完整 `mockProvider` 传入 pipeline**，导致所谓 live run 实际被 canned response 全部短路。

本次已修复：

- 新增 `packages/backend/src/scripts/ppt-mvp/ai-pipeline/live-config.ts`
  - 在未显式提供 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` 时，从数据库里自动选择一个可用的 `claude_agent_sdk` cloud 模型
  - 支持 `--model-id <provider-model-id>` 指定模型
- 修正 `build-wireless-ai-mvp.ts`
  - `CLAUDE_MOCK=1` 才注入 canned mock provider
  - `CLAUDE_MOCK=0` 时完全走真实模型调用
- 把 `wireless-asset-plan` 正式接进 `ai-pipeline`
  - Layer 3/4 prompt 现在能拿到每页可用素材
  - `cover/comparison/timeline/process/device_overview` 都有硬资产约束
  - Layer 4 缺少必需图片引用会触发 retry
- 新增 6 页扩展版 AI deck
  - 新页型：`process_flow_5`
  - 新页型：`device_triptych_3`
- 新增 6 页 native-editable build baseline
  - `packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts`
  - 用正式 family renderer 直接输出真实 PPT 元素，不走整页截图

新增测试：

- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/live-config.test.ts`

回归：

- `bun test packages/backend/src/scripts/ppt-mvp/page-plan-schema.test.ts`
- `bun test packages/backend/src/scripts/ppt-mvp/ai-pipeline/*.test.ts`
- 共 30/30 通过

## 2. 数据库可用模型确认

已确认数据库里存在激活的 cloud provider/model，且 provider 连通性测试成功：

- Provider: `火山方舟 Coding Plan (Agent SDK)`
- Provider type: `claude_agent_sdk`
- Host: `ark.cn-beijing.volces.com`
- 可用模型示例：
  - `kimi-k2.5`
  - `deepseek-v3.2`
  - `glm-4.7`
  - `minimax-m2.5`
  - `doubao-seed-2.0-pro`

## 3. 本次真实 live 命令

```bash
CLAUDE_MOCK=0 \
bun --env-file=.env packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --model-id doubao-seed-2.0-pro \
  /tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v2.pptx
```

后续在接入资产和扩页后，真实 6 页命令为：

```bash
CLAUDE_MOCK=0 \
bun --env-file=.env packages/backend/src/scripts/ppt-mvp/build-wireless-ai-mvp.ts \
  --model-id doubao-seed-2.0-pro \
  /tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v4.pptx
```

## 4. Live 运行结果

### 4.1 第一轮 live（4 页、无真实资产接入）

产物：

- PPTX:
  - `/tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v2.pptx`
- Session dir:
  - `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776401098735`

关键日志摘要：

- Layer 0: `live · 7885ms`
- Layer 1: `live · 5467ms`
- Layer 2: `live · 8443ms`
- Layer 3:
  - `p1 · live · 4473ms`
  - `p2 · live · 5460ms`
  - `p3 · live · 6831ms`
  - `p4 · live · 9224ms`
- Layer 4:
  - `p1 · live · 7586ms · 2110B`
  - `p2 · live · 13687ms · 4551B`
  - `p3 · live · 11577ms · 3753B`
  - `p4 · live · 15946ms · 5053B`
- Retry: `0`
- Placeholder fallback: `0`

包体与结构：

- `00-template-genes.json`: `1.7K`
- `01-style-genes.json`: `1.0K`
- `02-global-constitution.json`: `1.8K`
- `03-page-briefs.json`: `4.7K`
- 最终 PPTX: `345K`
- `unzip -t` 校验通过，无损坏

### 4.2 第二轮 live（4 页、真实资产接入）

产物：

- PPTX:
  - `/tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v3.pptx`
- Session dir:
  - `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776401901178`

结果：

- 4 页全部 `retry=0`
- `p1/p2/p3/p4` 已真实引用本地素材
- PPTX 包体从 `345K` 增长到 `2.0M`

结论：

- “图片都没有插进去”这个问题已经被修掉
- 资产接入有效，live 输出不再是纯文字卡片页

### 4.3 第三轮 live（6 页扩展版）

产物：

- PPTX:
  - `/tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v4.pptx`
- Session dir:
  - `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776402373149`

关键日志摘要：

- Layer 3：`p1..p6` 全部 `live`
- Layer 4：
  - `p1 · live · 10989ms · 2326B`
  - `p2 · live · 18298ms · 5117B`
  - `p3 · live · 18682ms · 4518B`
  - `p4 · live · 20348ms · 4492B`
  - `p5 · live · 18893ms · 5388B`
  - `p6 · live · 15528ms · 4123B`
- 所有页面：`retry=0`

包体与结构：

- 最终 PPTX: `3.1M`
- `unzip -t` 校验通过，无损坏

新增页型实际落地：

- `p5.html`：流程页，使用 `process_illustration` + 5 步步骤卡
- `p6.html`：设备页，使用 `device_image_1/2/3` + `scenario_bg`

### 4.4 第四轮与第五轮 live（v7 / v8）

继续围绕 6 页 deck 收紧 page-family recipe 后，又补跑了两轮 live：

- `v7`:
  - `/tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v7.pptx`
  - `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776406635705`
- `v8`:
  - `/tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v8.pptx`
  - `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776406942793`

其中：

- `v7` 修复了目录页误杀问题，所有 6 页再次 `retry=0`
- `v8` 继续微调 `toc / device_overview` 的 recipe，所有 6 页仍 `retry=0`
- `v8` 当前可以视为最新稳定基线

## 5. 对 live 输出的初步判断

### 已成立

- **链路真实可用**：不是 mock 假跑，四层 prompt 到 HTML 都是真调用。
- **稳定性够用**：4 页全部一次通过，无 retry / fallback。
- **结构清晰**：TemplateGenes / StyleGenes / PageBriefs 都是合法、可读、风格一致的 JSON。
- **HTML 质量过线**：输出都具备 `.slide` 结构和页面级样式，不是散乱片段。

### 仍然明显不足

- **视觉保守**：live 输出更像“干净的企业说明页 HTML”，还不是豆包/Kimi 那种更强的 page family 结果。
- **图片资产已接上**：封面、目录、对比、时间轴、流程、设备页都已经能真实引用本地素材。
- **family 语言偏薄**：虽然有统一 token，但页面之间仍然更像同一套 CSS 下的普通组件页，而不是更成熟的模板家族。
- **目录页尤其常规**：2x4 卡片网格很规整，但缺少更强的视觉层次和节奏控制。
- **对比页和时间轴页 too safe**：内容准确，但不够“像成品演示”，更像排版正确的文档页。
- **新页型已可运行**：流程页和设备页都能一次过，不是只停在 schema 设计阶段。
- **校验已经更可靠**：内容不可隐藏、必需素材必须真实引用，目录页不会再悄悄丢卡片。

### 直接证据

- `v3/v4 p1.html`: 已使用 hero image，但仍偏“左文右图”的安全排法
- `v4 p2.html`: 有了背景纹理，但目录仍偏整齐卡片墙
- `v4 p3.html`: 左右插图已接入，但对比层级仍较常规
- `v4 p4.html`: 图标时间轴已接入，但编排仍偏基础信息图
- `v4 p5.html`: 流程页成立，但目前是“左图右步骤”标准结构，惊喜度一般
- `v4 p6.html`: 设备页成立，三图三卡清晰，但还缺更强的场景叙事
- `v7 p2.png`: 8 个目录项已全部保住，但 still 偏“featured card + 普通列表”
- `v7 p4.png`: 时间轴比 v4 更成熟，已接近可用基线
- `v8 p6.png`: 设备页标签关系更清楚，但产品图白底仍偏重

## 5.1 Native Editable Baseline

除了 image-backed live 验证线，现在也已经有 6 页 native-editable baseline：

- 脚本：
  - `packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts`
  - `packages/backend/src/scripts/ppt-mvp/render-native-page-preview.ts`
  - `packages/backend/src/scripts/ppt-mvp/build-native-from-page-plan.ts`
- 输出：
  - `/tmp/intelliflow-ppt-mvp-wireless-v2r.pptx`
  - `/tmp/intelliflow-ppt-mvp-wireless-v2r.deck.json`

当前状态：

- 6 页 native PPT 已经可以直接输出
- `unzip -t` 通过
- `quality-gates.ts /tmp/intelliflow-ppt-mvp-wireless-v2r.deck.json` 通过
- 已修掉 native 路线中 `addImage()` 的 sizing 用法问题，构建时不再出现 path type warning
- 已把 native 路线中的 SVG 图标统一栅格化为 PNG，`comparison / timeline` 预览不再出现图标占位符
- 当前接入的 native 页型：
  - `cover_hero_image`
  - `toc_card_grid_8`
  - `comparison_dual_image`
  - `timeline_horizontal_5`
  - `process_flow_5`
  - `device_triptych_3`

单页原生预览调试入口：

- `/tmp/intelliflow-ppt-mvp-native-p2.pptx`
- `/tmp/intelliflow-ppt-mvp-native-p6c.pptx`

当前观察：

- 原生 `toc` 已从简单双列列表升级为 featured + secondary card 结构
- 原生 `comparison` 已修复大图空白问题，当前可用
- 原生 `timeline` 图标兼容问题已解决，且图标尺寸已恢复正常
- 原生 `device_overview` 可用，且比早期 image-backed 版本更接近正式交付
- 原生单页预览工具已经可用，可直接输出某页 PNG 以加快调试
- 原生 `cover` 已从旧的整页暗图模式升级到更接近当前 family 的分区封面结构
- 原生 `process` 已从标准清单页升级到更像实施蓝图的结构
- native 正式路线现在已经有了通用 `buildNativeFromPagePlan()` 基础设施，不再只是无线专用脚本
- 原生 `cover` 右侧信息栏已改成 guide track + audience panel，不再是空白占位
- 原生 `toc` 已减少重复大圆章，secondary/footer 卡片切到更紧凑的索引 pill 结构
- 原生 `device_overview` 已加场景 tag 与说明卡，白底产品图不再只是单独悬空
- 原生 `comparison` 已加对立导向标签与中轴 `VS` 锚点，不再只是左右两块并排白卡
- 原生 `timeline` 已改成上下交错里程碑结构，年份、图标、节点卡的关系更清楚
- 当前推荐 native 正式基线为 `v2r`
- `native template` 这一层已开始落地，不再只是路线图：
  - `docs/design/ppt-mvp/native-template-contract.md`
  - `docs/design/ppt-mvp/templates/doubao-light-tech-v1.native-template.json`
  - `packages/backend/src/scripts/ppt-mvp/native-template-schema.ts`
  - `packages/backend/src/scripts/ppt-mvp/validate-native-template.ts`
- `ingested template -> native template` 的第一版转换器也已落地：
  - `packages/backend/src/scripts/ppt-mvp/convert-ingested-template-to-native.ts`
  - 已对真实 ingest 产物 `/tmp/ppt-research/ingest-out/doubao-wireless_1384bb/template.json` 成功生成并校验 `/tmp/ppt-research/ingest-out/doubao-wireless_1384bb/native-template.json`
- native builder 现在已经支持 `--template` / `nativeTemplatePath`：
  - `packages/backend/src/scripts/ppt-mvp/build-native-from-page-plan.ts`
  - `packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts`
  - `packages/backend/src/scripts/ppt-mvp/render-native-page-preview.ts`
- 已用导入模板生成的 native template 成功跑出第二套完整 6 页 deck：
  - `/tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/native-template.json`
  - `/tmp/intelliflow-ppt-mvp-wireless-v2u-bluebiz.pptx`
  - `quality-gates` 通过
  - `unzip -t` 通过
- 从单页预览看，模板切换现在已经能影响封面和目录页的主强调色与标题区风格，不再只是 metadata 变化
- 模板层现在不只影响 theme：
  - primitive 默认 radius / stroke / shadow 已进入 renderer
  - builder 会校验 template 声明的 required asset slots
  - `variantBindings` 已开始控制部分可选结构是否渲染
  - `cover / toc / timeline` 已开始根据 template defaults 走不同 recipe 分支
- 但用户指出的关键问题是对的：
  - 这些仍然主要是“模板信号驱动”
  - 还不是“真正复用导入 PPT 模板的原始布局”
- 现在已经切到正确方向：
  - 新增 `packages/backend/src/scripts/ppt-mvp/extract-template-layout-presets.ts`
  - 可从原始 PPT 抽出 `slide -> layout -> shape geometry` 结果
  - 已对 `622eee2ab7e6e.pptx` 生成：
    - `/tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/layout-presets.json`
- 基于这份 layout preset，蓝色商务模板的 `cover / toc / comparison / process` 已开始直接复用原模板的真实节奏：
  - `cover`：原模板封面背景图 + 标题区 + 底部标签
  - `toc`：原模板目录页背景 + 左侧标题区 + 条目节奏
  - `comparison`：原模板双图 + 底部说明区
  - `process`：原模板四列流程节奏 + footer 尾步
  - 最新基线：
    - `/tmp/intelliflow-ppt-mvp-wireless-v2w-bluebiz.pptx`
  - `quality-gates` 通过
  - `unzip -t` 通过

意义：

- image-backed 线继续承担“AI 视觉验证”
- native 线已经开始承担“正式路线的对象级导出基线”
- 这两条线现在不再混为一谈

## 6. 当前最值得推进的方向

优先级建议：

1. **继续强化 prompt / design contract，不先接 runtime 主链**
   - 现在最大问题仍然是“family 厚度”和“页面戏剧性不足”。
2. **围绕 6 页 deck 做一轮 page-family 提纯**
   - 尤其是 `toc / comparison / timeline / process / device_overview`
   - 当前优先级最高仍是 `toc`
3. **并行维护 native-editable baseline**
   - 新页型先在 native 线稳定下来，避免 image-backed 线与正式路线脱节
3. **补更强的页面级视觉约束**
   - 例如：目录页必须有一级视觉主导，不允许均匀卡片墙
   - 对比页必须出现更明确的对比区分带，而不是双白卡平铺
   - 设备页必须有场景锚点，不只是三张产品图
4. **等 family 厚度明显改善后，再考虑接 `runtime/export.service.ts`**

## 7. 下一次 Session 要读什么

按顺序：

1. `docs/research/ppt-live-run-handoff-2026-04-17.md`
2. `docs/research/ppt-handoff-for-claude-code.md`
3. `docs/design/ppt-mvp/ai-pipeline.md`
4. `docs/research/template-generation-paradigms.md`
5. `docs/design/ppt-mvp/family-design-contract.md`
6. `docs/design/ppt-mvp/wireless-page-plan-ai.prompt.md`

再看这三次 live session 产物：

- `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776401098735`
- `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776401901178`
- `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776402373149`
- `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776406635705`
- `/tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776406942793`

## 8. 可直接粘贴给新 Session 的 Prompt

```text
接手 IntelliFlow 的 AI PPT 生成实验线，不要重复从头探索。

先读这些文件：
1. docs/research/ppt-live-run-handoff-2026-04-17.md
2. docs/research/ppt-handoff-for-claude-code.md
3. docs/design/ppt-mvp/ai-pipeline.md
4. docs/research/template-generation-paradigms.md
5. docs/design/ppt-mvp/family-design-contract.md
6. docs/design/ppt-mvp/wireless-page-plan-ai.prompt.md

再检查这几次真实 live 运行产物：
- /tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776401098735
- /tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776401901178
- /tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776402373149
- /tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776406635705
- /tmp/intelliflow-ppt-mvp-ai-session-wireless-v1-1776406942793
- /tmp/intelliflow-ppt-mvp-wireless-ai-live-doubao-v8.pptx
- /tmp/intelliflow-ppt-mvp-wireless-v2.pptx
- /tmp/intelliflow-ppt-mvp-wireless-v2.deck.json

已知事实：
- `build-wireless-ai-mvp.ts` 现在已经支持在 `CLAUDE_MOCK=0` 时从数据库自动选择 `claude_agent_sdk` cloud 模型，不需要手工提供火山 key
- 本次 live run 使用的是 `doubao-seed-2.0-pro`
- 现在已经有 6 页扩展版 deck，不再只有 4 页
- 图片资产已经真实接入，不是纯文本页
- 所有 live 页面都没有 retry / fallback
- 当前主要问题不是调用链路，也不是“图片没接上”，而是 page family 仍偏安全、成熟度还不够
- 当前推荐基线是 `v8`
- 同时，6 页 native-editable baseline 已可生成，说明正式路线已经不再只是概念
- 从单页预览看，native 的 `toc` 和 `device_overview` 已经具备继续打磨到正式交付的基础

你的目标不是接 runtime 主链，而是：
1. 基于这次 live 产物，分析哪些 prompt / page-brief / layout grammar 导致页面过于保守
2. 提出并实施一轮高价值改进，让 cover / toc / comparison / timeline / process / device_overview 更接近成熟产品级演示页，而不是普通网页卡片
3. 优先改 prompt、design contract、page family 约束；谨慎改核心 pipeline
4. 跑新的 live 对比，输出明确的改进结论

限制：
- 不要回到 `ppt_scene / free-scene-first` 主路线
- 不要默认把整页图片 fallback 当主路
- 不要把目标简化成“更像豆包”，而是提炼出更强的 IntelliFlow 自己的 family system
- 不要退回 4 页范围里反复磨细节，要把 6 页 deck 当作最小有效 family 验证集

先给出你对这次 live 结果的具体诊断，再开始修改。
```

## 9. 当前工作区注意事项

- `packages/backend/src/modules/runtime/export.service.ts`
- `packages/backend/src/modules/runtime/background.service.ts`
- `packages/backend/src/modules/runtime/ppt-scene.ts`
- `packages/backend/src/modules/runtime/ppt-scene.test.ts`

这些文件都处于未提交状态，但它们和 `scripts/ppt-mvp` 主线不是同一层次的问题。

如果下一次 session 的目标仍是“提升 AI PPT live 质量”，优先只动：

- `packages/backend/src/scripts/ppt-mvp/*`
- `docs/design/ppt-mvp/*`
- `docs/research/*`
