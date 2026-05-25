# IntelliFlow PPT 优化实施计划

> **输入**：阶段 7 `CODE-REVIEW.md` 的 11 个缺口分级 + Tier 1/2/3 路线
> **本文件**：实施进度跟踪 + 每次 PR 的 diff 摘要 + 测试结果

---

## 进度概览

| Tier | 范围 | 状态 | 提交 |
|---|---|:---:|---|
| **Tier 1.1** | C2 NEVER-list 扩展 | ✅ 已实施 | 31daad5 |
| **Tier 1.2** | C7 curated palettes 注入 Layer 0 prompt | ✅ 已实施 | 31daad5 |
| **Tier 1.3** | C9 font stack Windows 兜底 | ✅ 已实施 | 31daad5 |
| **Tier 2.1** | C1 spec_lock 层（types + builder + validator + renderer） | ✅ 已实施 | d64af39 |
| **Tier 2.2** | C4 三维度图像锁（VisualBrief 扩展 + spec_lock.imageLock） | ✅ 已实施 | d64af39 |
| **Tier 2.3** | C5 结构化 retry 反馈（ValidationError[]） | ✅ 已实施 | d64af39 |
| **Tier 2.4** | C8 PageBrief.visualElement enum + 渲染校验 + Variance Mandate | ✅ 已实施 | d64af39 |
| **Tier 2.5** | C10 iconLibrary 锁定 + iconStrokeWidth | ✅ 已实施 | d64af39 |
| **Tier 3.1** | C3 视觉 QA 子 agent + detector 双轨闭环 | ✅ 已实施 | d64af39 |
| **Tier 3.2** | C6 placeholder fallback 可观测（log warning + count） | ✅ 已实施 | d64af39 |
| **Tier 3.3** | C11 Style packs 6 → 10（对齐 editorial-ppt curated palettes） | ✅ 已实施 | d64af39 |
| **测试总览** | ai-pipeline 52/52 通过 (was 30/30) | ✅ 全绿 | — |

**Tier 1 + 2 + 3 全部完成。** 11/11 缺口闭环。新增覆盖：
- **spec-lock.test.ts** 16 个测试（builder / validator H1H2 / Windows font fallback / image-lock sum / brief override / anchor render）
- **visual-qa.test.ts** 8 个测试（detector: color drift / font drift / banned features / placeholder residue / fallback skip; subagent: mocked scoring / regen synthesis / parse-failure graceful degradation）
- **pipeline.test.ts** 7 个原集成测试全部继续通过（spec_lock 路径被覆盖）

**Tier 1 完成。** 30/30 ai-pipeline 测试通过，3 项手工渲染验证全部正确：
- SYSTEM_DESIGN 包含 23 条 NEVER-list 项
- Layer 0 prompt 包含 10 套 palette + 8 套 font pairing + Windows 兜底硬规则
- ensureWindowsFallback 行为正确（Mac-only 注入 Microsoft YaHei；已含 Windows 字体不变；YaHei 不重复）

唯一未通过的 live-config.test.ts 是因为缺 drizzle-orm 包（本地 deps 解析问题，与改动无关——该文件读 DB schema）。

---

## Tier 1 实施详情

### Tier 1.1 — C2 NEVER-list 扩展

**改动文件**：`packages/backend/src/scripts/ppt-mvp/ai-pipeline/prompts.ts`

**改动摘要**：
- 在 `SYSTEM_DESIGN` 上方新增 `NEVER_LIST` 常量，含 23 条具体反模式禁令
- 按 5 类组织：视觉 / 排版 / 布局 / 色彩对比 / 流程
- `SYSTEM_DESIGN` 改为多行结构（之前是单段 join），包含 NEVER_LIST + 输出格式约束

**来源依据**：
- anthropics/skills/pptx（accent line / blue default / center body / 4+ colors / rainbow gradient）
- iOfficeAI/AionUi officecli-pptx（accent line under title / dark bg contrast）
- design-taste-frontend (skills.sh)（LILA BAN — 紫蓝 AI 渐变）
- oh-my-ppt（CSS 限制 — 禁 text-xs / opacity:0 / vw vh / iframe）
- danny0926/ppt-skills（≤8 word headline / ≤3 bullets / 60-40 visual ratio）

**预期效果**：
- 大幅降低 LLM 默认的"accent line under title"、"默认蓝"、"居中正文"、"纯文字 slide"等典型 AI-PPT 失败模式发生率
- 触发 Layer 4 LLM 显式工作绕开这些禁令，提升视觉特异性

**风险**：
- SYSTEM_DESIGN 变长（30 字符 → 约 1500 字符）；token 开销增加
- 现有 mock pipeline 测试用真 Layer 4 prompt 字符串匹配可能需调整

---

### Tier 1.2 — C7 Curated Palettes 注入

**改动文件**：`packages/backend/src/scripts/ppt-mvp/ai-pipeline/prompts.ts`

**改动摘要**：
- 新增 `CURATED_PALETTES_REMINDER` 常量（10 套配色 + 60-30-10 dominance 规则 + 特异性测试）
- 新增 `CURATED_FONT_PAIRINGS_REMINDER` 常量（8 套字体对 + CJK 引导 + Windows 兜底硬规则）
- `buildLayer0PromptFromBrief` 在"visual brief"段后、"output schema"段前插入两个 reminder
- `buildLayer0PromptFromIngestedTemplate` **未修改**——ingested template 已经提供 verbatim 锁定值，不需要 fallback

**来源依据**：
- anthropics/skills/pptx 10 配色 + 8 字体对
- iOfficeAI/AionUi morph-ppt-3d（同一 10 配色 + 8 字体对，独立趋同）
- PPT Master Strategist Eight Confirmations §e（行业 palette 速查）

**预期效果**：
- 当 brief 模糊时（如 "modern green editorial"），LLM 不再凭空推断 HEX，而是 verbatim 引用预设
- 跨 deck 视觉特异性提升（10 个明确特征，而不是无穷"中间色"）
- CJK 字体回退一致性强（不再发生 PingFang SC + Georgia 在 Windows 上失效）

**风险**：
- Layer 0 prompt 显著变长（~3000 字符）；首次 token 调用成本增加约 30-40%
- 若用户 brief 已经很具体，LLM 仍可能滑向 preset。预期 LLM 会忽略 fallback 节当 brief 充分时

---

### Tier 1.3 — C9 Font Stack Windows 兜底

**改动文件**：
- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/css-from-genes.ts`
- `packages/backend/src/scripts/ppt-mvp/ai-pipeline/css-from-genes.test.ts`

**改动摘要**：
- 新增导出函数 `ensureWindowsFallback(stack: string[]): string[]`
- 检测 stack 是否已含 20 个 Windows 预装字体之一（Microsoft YaHei / Arial / Calibri / Georgia / ...）
- 若否，在最后一个 generic family（serif/sans-serif/monospace/system-ui）之前插入 `"Microsoft YaHei"`
- 若无 generic family，直接 append 在末尾
- `generateDesignSystemCss` 用此函数包裹 3 个字体栈（display/body/mono）
- 新增 6 个单元测试覆盖：已含 YaHei / 已含其他 Windows 字体（Georgia/Calibri/Consolas）/ 缺失需注入 / 无 generic family / 空字符串过滤

**来源依据**：
- PPT Master spec_lock typography 兜底栈
- editorial-ppt skill `references/never-list.md` #14
- editorial-ppt skill `references/curated-palettes.md` font stacks

**预期效果**：
- 即使 LLM 产 Mac-only 字体名（PingFang SC / Helvetica Neue / Menlo），最终 CSS 在 Windows 用户 PowerPoint 中仍有正确字体回退
- 消除"Windows 客户打开 PPTX 字体崩盘"的 P0 客诉

**风险**：极低。只是确保性插入；已含 Windows 字体的栈完全不变

---

## 测试计划

### 已有测试
- `css-from-genes.test.ts`：原 6 个 + 新增 8 个（6 个 ensureWindowsFallback + 2 个 generateDesignSystemCss 字体兜底场景）
- `pipeline.test.ts`：保持不变（mock provider 走 canned responses，不依赖 prompt 字符串）
- `claude-client.test.ts`：保持不变
- `live-config.test.ts`：保持不变

### 待跑
```bash
bunx vitest run packages/backend/src/scripts/ppt-mvp/ai-pipeline/ \
  --config packages/backend/vitest.config.ts
```

### 验收标准
- 所有 ai-pipeline 测试通过
- 不引入 lint 错误（biome check）
- mock pipeline 仍能跑通 wireless 6 页样本（不需要 live API）

---

## Tier 2 / Tier 3 后续路线

详见 `07-code-review/CODE-REVIEW.md` §3 + §4。

下一步建议：
1. Tier 1 完成后观察 1-2 周生成质量数据（retry rate / placeholder fallback rate / 用户视觉反馈）
2. 数据收敛后启动 Tier 2 spec_lock（C1） + 3 维度图像锁（C4）—— 这两个是 C1 改造的两个面
3. Tier 3 visual QA subagent（C3）作为最后一个 PR

---

## 实施日志

### 2026-05-20

- 阅读现有代码 `prompts.ts` / `css-from-genes.ts` / `pipeline.ts`
- 修改 SYSTEM_DESIGN 引入 NEVER_LIST（C2）
- 在 buildLayer0PromptFromBrief 注入 CURATED_PALETTES_REMINDER + CURATED_FONT_PAIRINGS_REMINDER（C7）
- 在 css-from-genes 新增 ensureWindowsFallback + 8 单元测试（C9）
- 解决 deps 问题（手工 link `fdir@6.5.0` 到 node_modules）
- 跑 `bunx vitest run packages/backend/src/scripts/ppt-mvp/ai-pipeline/` → 30/30 通过
- 手工验证 SYSTEM_DESIGN / Layer 0 prompt / ensureWindowsFallback 渲染输出
- Tier 1 已合并到 31daad5
- **Tier 2 实施**：
  - VisualBrief schema 扩展 `imageRendering / imagePalette / imageTypes / iconLibrary / iconStrokeWidth`（C4 + C10），向后兼容（全为可选）
  - 新增 ai-pipeline/types.ts 中 `SpecLock` / `ValidationError` / `VisualElementType` / `LayoutArchetype` 类型（C1, C5, C8）
  - 新建 `ai-pipeline/spec-lock.ts`：buildSpecLockFromGenes + validateSpecLock + renderSpecLockAnchor（C1）
  - prompts.ts：
    - Layer 4 prompt 顶置 spec_lock anchor（接收可选 specLock 参数）
    - Layer 3 prompt 增加 visualElement + layoutArchetype output schema + 收到 previousArchetype 做 Variance Mandate
    - 新加 buildRetrySystemSuffix(errors) + describeVisualElement 工具（C5）
  - pipeline.ts：
    - Layer 1 后调用 buildSpecLockFromGenes，写 `01b-spec-lock.json`
    - Layer 3 循环传递 previousArchetype，每页后更新
    - Layer 4 retry 用 buildRetrySystemSuffix 注入结构化错误
    - validateHtml 返回 ValidationError[]（结构化），新增 validateVisualElement（C8）
    - placeholder fallback 加 `❌ CRITICAL` 日志 + 计数 + RenderedPage.fallback 字段（C6）
    - PipelineArtifacts 加 specLock + placeholderFallbackCount 输出字段
- **Tier 3 实施**：
  - 新建 `ai-pipeline/visual-qa.ts`：runVisualQa(pages, specLock, opts)（C3）
    - Track A：subagent prompt 含 11-item checklist + 10-dim rubric，返回 scores + violations + weakestDimensions
    - Track B：detector 检测 color drift / font drift / banned features (text-xs, opacity:0, iframe, vw font) / placeholder residue (lorem / xxxx / [insert ...])
    - 合成 needsRegenerate 集合 + 整体 passed
  - build-from-page-plan.ts 接入 `opts.visualQa`（boolean | RunVisualQaOptions），渲染后跑 QA，持久化 `05-visual-qa.json`
  - ppt-style-packs.ts 扩到 10 套（C11）：新增 forestMoss / oceanGradient / tealTrust / cherryBold
- **测试增量**：
  - spec-lock.test.ts 16 测试
  - visual-qa.test.ts 8 测试（修正一处 font-family 正则：允许带引号字体名）
  - **52/52 测试通过**（30 → 52，新增 22 个测试）
- 已 push 到 d64af39


## 2026-05-21 补充：Auto/Template/Styleized 三模式重构建议（针对“同质化”）

### 现状复盘（为什么看起来像“只换颜色”）

当前链路虽然引入了 style DNA、spec-lock 和 pageType 约束，但在 **layout 生成层**仍偏向“受控模板填充”：

1. `layoutPattern` 主要作为文本标签存在，缺少可执行的几何约束与差异度目标。
2. `style=auto` 仍通过同一套保守规则收敛，导致生成器倾向重复采用安全布局骨架。
3. 风格包扩展（palette/icon/background）解决了“皮肤层”问题，但没有实质放大“结构层”变化。

这会导致你看到的结果：整体版式近似，仅颜色/背景/图标变化。

---

### 产品语义澄清：必须拆成 3 种模式

建议把前后端契约从单一 `style` 字段升级为 `generationMode` + `styleProfile`：

- **A. auto_dynamic（真正 AI 自动排版）**
  - 目标：每页布局由 AI 生成，不依赖固定模板槽位。
  - 约束：只保留硬规则（可读性、对齐、安全边距、品牌色上限、信息密度）。
  - 输出：`layoutDsl`（可执行几何）+ `designTokens`（颜色/字体/间距）。

- **B. template_locked（完全写死模板）**
  - 目标：结构 100% 固定，只做文本/图片填充。
  - 适用：企业标准宣讲、强合规模板。

- **C. template_stylized（风格化模板）**
  - 目标：结构大体固定，允许局部替换（颜色、背景、插画、图标、装饰）。
  - 适用：效率优先且要保持一定品牌稳定。

> 结论：`auto` 不应复用模板填充逻辑；若复用，只能命名为 stylized/template，不可对外叫 auto。

---

### 技术路线建议：Auto 模式优先走“HTML 中间层”

对于 `auto_dynamic`，推荐采用 **HTML/CSS 先生成，再映射 PPT JSON** 的双阶段：

1. **Stage 1: 生成 HTML 布局**
   - AI 直接输出单页 HTML（受 design-system token + 硬规则约束）。
   - 在浏览器引擎中可快速做视觉 QA（overlap、对比度、文本溢出、留白节奏）。

2. **Stage 2: HTML → PPT JSON 转译**
   - 将 DOM 盒模型映射为 `shape/text/image` 的绝对坐标。
   - 抽取字体、边框、圆角、阴影、渐变并落盘为 native template JSON。

3. **Stage 3: 结构保真校验**
   - 对比 HTML 截图与 PPT 渲染截图，做像素差/元素对齐差检测。
   - 超阈值自动触发局部修正（文字重排、容器拉伸、图文互换）。

为什么这条路更适合 auto：
- HTML 的排版表达力更强，AI 更容易“创造新结构”。
- 可以复用现有 `render-html.ts`、visual QA、spec-lock 体系，减少重复造轮子。
- PPT 端只负责“保真转译”，将创造性前置到更擅长的媒介。

---

### 实施优先级（两周内可执行）

1. **协议升级（P0）**
   - 新增请求字段：`generationMode: auto_dynamic | template_locked | template_stylized`。
   - 旧 `style=auto` 自动映射到 `auto_dynamic`，并保留向后兼容。

2. **路由分流（P0）**
   - `auto_dynamic`：走 ai-pipeline HTML-first。
   - `template_locked/template_stylized`：走 native-template fill。

3. **差异度指标（P0）**
   - 新增 deck-level `layoutDiversityScore`（网格占用、视觉重心、组件组合、阅读路径）。
   - 低于阈值时，强制重采样 page layout（不是重上色）。

4. **模板库扩容（P1）**
   - stylized 家族至少扩到 20+（按行业/情绪/信息密度维度分桶），降低重复感。

5. **观测与回归（P1）**
   - 每次导出记录：mode、layoutDiversityScore、重试次数、用户二次编辑率。

---

### 验收标准（针对“auto 不可接受”问题）

`auto_dynamic` 必须满足：

- 相邻页禁止复用同一布局骨架（不仅是名字不同）。
- 全 deck 至少出现 6 种结构范式（hero、split、matrix、timeline、process、data+insight 等）。
- 视觉差异主要来自版式结构，而非仅颜色替换。
- 用户主观评分（样式满意度）较当前基线提升明显（建议先以 +30% 为阶段目标）。

---

### 与当前重构的关系

现有 spec-lock / visual-QA / curated-palettes 并非无效，它们解决的是“质量下限”和“稳定性”；
你指出的问题是“创造性上限”。

下一阶段的核心不是再加更多配色包，而是把 `auto` 从“模板填充”中解耦出来，建立独立的 **动态排版生成路径**。

---

### 2026-05-21 实施日志：三模式契约 + auto 动态版式差异度门控

本次完成 P0 的可执行底座：

- 后端 `/ppt-agent/jobs` 请求协议新增 `generationMode` 与 `styleProfile`：
  - `auto_dynamic`
  - `template_locked`
  - `template_stylized`
- 保留旧字段兼容：
  - 旧 `style=auto` 自动映射为 `generationMode=auto_dynamic`
  - 旧非 auto 风格自动映射为 `template_stylized`
- `auto_dynamic` prompt 明确要求：
  - 内容驱动动态几何
  - 不复用固定模板槽位
  - 不允许只靠 palette/background/icon 变化制造差异
- 新增 `layout-diversity.ts`，计算 deck-level `layoutDiversityScore`：
  - layoutPattern 去重
  - pageType 去重
  - structural paradigm 去重
  - 相邻重复惩罚
- `auto_dynamic` 模式下 `validateDeckPlan` / `critiqueDeckPlan` 强制门控：
  - `layoutDiversityScore >= 72`
  - 6 页及以上至少 6 种 structural paradigm
  - 不达标时把结构化失败原因反馈给 Design Director / evaluator-optimizer，触发重新采样版式结构
- 前端 PPT 生成页新增三段式模式选择：
  - 自动排版
  - 模板锁定
  - 模板风格化
- 任务 trace 记录：
  - `generationMode`
  - `styleProfile`
  - `layoutDiversityScore`
  - structural paradigm 覆盖数

新增/更新测试：

- `layout-diversity.test.ts`：覆盖多结构通过、低结构失败、template_stylized 不触发 auto 门控
- `service.test.ts`：覆盖旧 `style=auto` 到 `auto_dynamic` 映射、显式 `template_stylized` 映射
- `PptGenerator.test.tsx`：覆盖前端提交 `generationMode/styleProfile`

验证结果：

```bash
bunx vitest run packages/backend/src/modules/ppt-agent/layout-diversity.test.ts packages/backend/src/modules/ppt-agent/service.test.ts
# 2 files, 27 tests passed

bunx vitest run packages/frontend/src/pages/PptGenerator.test.tsx
# 1 file, 2 tests passed

bunx vitest run packages/backend/src/scripts/ppt-mvp/ai-pipeline/ --config packages/backend/vitest.config.ts
# 6 files, 63 tests passed

bunx biome check --write <touched files>
# passed
```

仍需后续单独落地：

- 将生产 `/ppt-agent` 的 `auto_dynamic` 渲染器从当前 DeckPlan/PptxGenJS 路径进一步切到 `ai-pipeline` HTML-first 路径，需要补齐 `DeckPlan -> PresentationOutline/VisualBrief/PagePlan` 适配层。
- `template_locked/template_stylized` 与 native-template/preserve fill 的真实渲染分流仍需接入模板输入与模板选择上下文；当前先完成协议和门控，不做无模板的伪锁定。
