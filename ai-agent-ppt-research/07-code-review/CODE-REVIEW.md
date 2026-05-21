# IntelliFlow PPT 代码审查报告

> **审查方法**：以 `06-final/SKILL.md`（editorial-ppt skill v1.0）为标尺，对照 IntelliFlow 现有 PPT 生成代码逐项检查。
> **审查范围**：`packages/backend/src/scripts/ppt-mvp/ai-pipeline/`（MVP 4 层流水线，~2580 行）+ `packages/backend/src/modules/runtime/ppt-*.ts`（生产路径，~4745 行）
> **审查时间**：2026-05-20
> **输入**：19 份个案报告 + 13 个借鉴 primitive

---

## Executive Summary（≤ 300 字）

IntelliFlow PPT 生成有两条独立路径：(1) MVP 实验 4 层 LandPPT 流水线（AI 生 HTML → Chrome 截图 → image-backed PPTX），(2) 生产路径（单 AI 调用 → SlidePresentation JSON → archetype 确定性渲染）。**两条路径都缺机器契约层和视觉 QA 闭环**，导致跨页一致性弱、视觉单薄。

具体识别 **11 个缺口**，对照 19 个业界项目均有成熟方案：

| 严重 | 缺口数 | 集中位置 |
|---|---|---|
| 🔴 高 | 4 | `prompts.ts` SYSTEM_DESIGN / `types.ts` schema |
| 🟠 中 | 4 | `pipeline.ts` 重试与 fallback / `types.ts` PageBrief |
| 🟢 低 | 3 | `css-from-genes.ts` / style packs |

**最高 ROI 修复路径**：Tier 1 prompt-only 改造（5 项），预期解决 60-70% 视觉痛点，零代码风险。详见 §3 Tier 表 + §4 逐项分析 + §5 实施 PR 拆分。

**结论确认**：用户原疑问"是不是模型能力不足"**否定**——根因在 agent 设计的 prompt 密度、机器契约缺失、QA 闭环缺失。模型升级能边际改善，但结构性问题不解决，再强的模型也跨不过 30% 痛点天花板。

---

## 1. 审查的代码全景

### 1.1 MVP 实验路径（`scripts/ppt-mvp/ai-pipeline/`）

| 文件 | 行数 | 角色 |
|---|---|---|
| pipeline.ts | 391 | Layer 0-4 编排，validateHtml，placeholder fallback |
| prompts.ts | 516 | SYSTEM_DESIGN（30 行）+ Layer 0-4 prompt builders + variant recipes |
| types.ts | 138 | TemplateGenes/StyleGenes/GlobalConstitution/PageBrief/RenderedPage schemas |
| css-from-genes.ts | 155 | 确定性 CSS 生成 |
| render-html.ts | 73 | headless Chrome 截图（无 visual QA hook）|
| pack-pptx.ts | 63 | image-backed PPTX 打包 |
| claude-client.ts | 146 | LLM 调用 + mock |
| build-from-page-plan.ts | 166 | 通用 driver |
| **+测试** | 619 | pipeline.test.ts (420) + 3 unit tests |

**主要入口**：`build-wireless-ai-mvp.ts` → `buildFromPagePlan` → `runPipeline`

### 1.2 生产路径（`modules/runtime/`）

| 文件 | 行数 | 角色 |
|---|---|---|
| ppt.service.ts | 200+ | 主入口 + style 推荐 + OfficeCLI 质检 wrapper |
| ppt-export-ai.service.ts | 215 | 单次 AI 调用 → SlidePresentation JSON |
| ppt-deck-composition.ts | 468 | 启发式 inferSemanticRole / inferArchetype（无 LLM）|
| ppt-archetype-renderer.ts | 901 | 14 archetype 确定性 PptxGenJS 渲染 |
| ppt-style-packs.ts | 303 | 6 个 hardcoded style pack |
| ppt-scene.ts | 812 | scene_canvas 渲染（visual_premium_v1）|
| ppt-visual-premium.ts | 1024 | visual_premium_v1 主入口 |

**主要入口**：`generatePpt` → `generateVisualPremiumBuffer`（三路：visual_premium_v1 → html_fidelity → archetype）

---

## 2. 对照 Skill 的 11 个缺口审查（逐项）

### 🔴 C1 — 缺机器契约 spec_lock 层

**Skill 要求**：`references/spec-lock-schema.md`——每个 deck 必须有 verbatim 锁定的 palette/fonts/icon library/imageLock，Layer 4 prompt 必须重读。

**现状**：
- `types.ts:46-76` `TemplateGenes`：是机器友好（HEX + 字体字符串），但**没有 imageLock 字段、没有 iconLibrary 字段、没有 constraints 字段**
- `types.ts:82-88` `StyleGenes`：**完全是自然语言**（"colorDna: string", "typographyDna: string"），LLM 解释空间大
- `pipeline.ts:120-131` Layer 1 调用：把 TemplateGenes → StyleGenes 自然语言转化，丢失了机器可校验信号
- Layer 4 prompt（`prompts.ts:275-340`）：把 styleGenes 全 attach，但**仅作为参考**，没有"verbatim quote only"或"do not invent values"的强约束

**修复**：
```typescript
// types.ts 新增
export type SpecLock = {
  version: "spec_lock/v1";
  palette: { primary, secondary, accents[], neutrals[], bg, surface, text, textMuted, allValues[] };
  typography: { titleStack, bodyStack, monoStack, titleSize, bodySize, sizeRatio, allFamilies[] };
  iconLibrary: "tabler-outline" | "tabler-filled" | "chunk-filled" | "phosphor-duotone";
  iconStrokeWidth: 1.5 | 2 | 3;
  imageLock: { rendering, palette: {dom/sup/acc}, types: Record<slot, ImageType> };
  constraints: { maxBulletsPerSlide: 5, maxWordsHeadline: 8, minVisualRatio: 0.6, contrastMinRatio: 4.5, colorEconomyMax: 4, layoutVarianceWindow: 5, maxNestingDepth: 4 };
  rhythm: { density, pagePadding, preferredLayoutGrammar, decorationMotif };
  shapes: { cornerRadius, shadow, borderWidth, borderColor };
};

// pipeline.ts 新增 Layer 1.5
const specLock = await buildSpecLockFromGenes(templateGenes, styleGenes);
await writeFile(join(sessionDir, "01-spec-lock.json"), JSON.stringify(specLock, null, 2));

// prompts.ts Layer 4 加首块（强制重读）
buildLayer4Prompt(...) {
  return [
    "## Locked Design Contract (spec_lock — verbatim, do not invent)",
    buildSpecLockAnchorBlock(specLock),  // 包含所有 verbatim 值 + "do not invent" 警告
    "",
    ...existingSections,
  ];
}
```

**ROI**: ★★★★★（直接解决跨页 color/font drift 问题）

---

### 🔴 C2 — 缺 NEVER-list 密度

**Skill 要求**：`references/never-list.md` 32 条具体禁令。

**现状**：`prompts.ts:21-29` SYSTEM_DESIGN 仅 **4 条宽泛禁令**：
```
- no hero photo backgrounds with white-text overlay
- no rainbow gradients
- no decorative emoji
- (隐含: no generic AI-PPT aesthetics)
```

`prompts.ts:333-334` Layer 4 末尾再加：
```
- Avoid generic AI-PPT aesthetics: no hero photo backgrounds, no rainbow
  gradients, no emoji, no decorative photo overlays
```

**完全没有**：禁默认蓝、禁居中正文、禁字号 <16pt、禁纯文字 slide、禁字体 fallback 缺失、禁 4+ 色彩、LILA BAN（紫蓝渐变）等。

**修复**：把 `references/never-list.md` 的 32 条直接 inline 到 SYSTEM_DESIGN，按视觉/排版/布局/对比度/结构 5 类分组。

**ROI**: ★★★★★（最低成本最大收益）

---

### 🔴 C3 — 缺视觉 QA 闭环

**Skill 要求**：`references/visual-qa-checklist.md` 11 项 + `references/rubric.md` 10×10。Subagent 评审 + detector 双轨。

**现状**：
- `pipeline.ts:259-287` `validateHtml` 仅做 **静态 HTML 检查**：
  - HTML > 600 bytes
  - 有 `<body>`
  - 有 `slide` class
  - 无 `display:none` / `visibility:hidden`
  - 必含 page content 文本
  - 必含 required asset URL
- `pipeline.ts:213-232` 重试逻辑：仅 1 次 retry，第二次失败 fall back 到 placeholder。**完全没有视觉级评审**。
- `quality-gates.ts:1-81`（独立脚本，未挂到 pipeline 链路上）：检查 slot text 长度、asset 数量、speaker notes 存在。仍是结构级。

**修复**：在 `build-from-page-plan.ts` PNG 渲染后增加 `runVisualQa` 阶段：
```typescript
// 新文件: ai-pipeline/visual-qa.ts
export async function runVisualQa(opts: {
  pages: RenderedPage[];     // includes pngPath
  specLock: SpecLock;
  qaThreshold?: number;       // default 75
  maxIterations?: number;     // default 2
}): Promise<QaResult> {
  // 1. Track B detector script: scan PNG for color drift, contrast, overlap, banned content
  const detectorIssues = await runDetector(pages, specLock);

  // 2. Track A subagent: spawn separate LLM with 11-item checklist + rubric
  const subagentResult = await callQaSubagent({
    pngs: pages.map(p => p.pngPath),
    specLock,
    detectorContext: detectorIssues,  // pass after Track A starts (impeccable Independence rule)
  });

  // 3. Score + regenerate weakest if < threshold
  if (subagentResult.total < (opts.qaThreshold ?? 75)) {
    return { needsRegenerate: subagentResult.weakest3.map(d => d.slideId) };
  }
  return { passed: true, scores: subagentResult.scores };
}
```

**ROI**: ★★★★（最高视觉提升，但工程量中等：需新增 1 subagent prompt + detector 脚本）

---

### 🟠 C4 — 缺三维度图像锁

**Skill 要求**：`spec_lock.imageLock = { rendering, palette, types }`。

**现状**：
- `wireless-visual-brief.json` 仅 `imageLanguage: "technical_illustration_plus_real_photo"` — 单一抽象字段
- `types.ts:46-76` `TemplateGenes` 无 image 相关字段
- Layer 4 prompt（`prompts.ts:356-364`）`buildPageAssetPromptSection` 只描述 asset slot 位置，不约束 image style

**结果**：6 页 wireless deck 中，如果用 AI 生图，cover hero image / process illustration / device images 各自漂移（不同 rendering 风格、不同 palette、不同 composition），整 deck 视觉松散。

**修复**：
1. 升级 `VisualBrief` schema 加 3 字段：
```typescript
imageRendering: "vector-illustration" | "editorial-photography" | "3d-isometric" | ...
imagePalette: { dominantUsage: 0.6, supportingUsage: 0.3, accentUsage: 0.1 }
imageTypes: Record<string /* slot */, ImageType>
```
2. Layer 0 `buildLayer0PromptFromBrief` 把这 3 字段加入 TemplateGenes 派生
3. Layer 4 `buildPageAssetPromptSection` 引用 imageLock 字段

**ROI**: ★★★★

---

### 🟠 C5 — retry 反馈不结构化

**Skill 要求**：仿 PPTAgent REPL，结构化错误对象注入下次 prompt。

**现状**：`pipeline.ts:205-212` retry 仅在 system prompt 末尾追加：
```typescript
system: isRetry
  ? `${SYSTEM_DESIGN}\n\nThe previous attempt failed validation
     (HTML structure, missing asset usage, or page completeness).
     Produce a complete page now.`
  : SYSTEM_DESIGN,
```

**没有告诉模型具体哪里失败了**——LLM 又重新生成一遍，可能重犯同一错误。

**修复**：
```typescript
// pipeline.ts validateHtml 改为返回结构化对象
type ValidationError = {
  code: "missing_body" | "missing_slide_class" | "missing_content" | "missing_asset" | "size_too_small" | ...;
  slot?: string;
  expected?: string;
  actual?: string;
  suggestion: string;  // 具体 fix 指引
};

function validateHtml(...): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!html) errors.push({ code: "empty_html", suggestion: "Output a complete HTML doc with <!DOCTYPE html>" });
  if (html.length < 600) errors.push({ code: "size_too_small", actual: `${html.length}B`, expected: ">600B", suggestion: "Add visual element + body content" });
  // ...
  return errors;
}

// retry prompt 改为
const retryPrompt = `${SYSTEM_DESIGN}

Your previous attempt failed validation. Here are the specific issues:

${errors.map(e => `- [${e.code}] ${e.suggestion}` +
  (e.slot ? ` (slot: ${e.slot})` : '') +
  (e.expected ? ` (expected: ${e.expected}, got: ${e.actual})` : '')
).join('\n')}

Fix THESE specific issues. Do not change other working sections.`;
```

**ROI**: ★★★

---

### 🟠 C6 — placeholder fallback 是 anti-pattern

**Skill 要求**：`references/never-list.md` #26 "NEVER fall back to placeholder slide without explicit failure logging".

**现状**：`pipeline.ts:226-232`:
```typescript
if (retryValidationError) {
  stamp(`  ${page.pageId} retry also failed (...); emitting placeholder`);
  html = renderPlaceholder(page, cssHref);  // 静默降级
  retryCount = 2;
}
```

`pipeline.ts:289-310` `renderPlaceholder` 渲染一个 "FALLBACK" 标签 + 标题 + "AI 生成失败" 文字。**生产链路不会感知到失败**——最终 PPTX 包含一个看起来正常但其实是占位的页面。

**修复**：
1. 短期：保留 placeholder，但增加 metrics + 严重 warning：
```typescript
if (retryValidationError) {
  stamp(`  ${page.pageId} ❌ CRITICAL: retry also failed (${retryValidationError})`);
  await metrics.record({
    type: "ppt_layer4_fallback",
    pageId: page.pageId,
    error: retryValidationError,
    sessionDir,
  });
  // 仍渲染 placeholder 但加大警告
  html = renderPlaceholder(page, cssHref);
  retryCount = 2;
}
```
2. 中期：取消 placeholder，throw error。让上游决定要不要 fail the whole deck 或 retry the deck。

**ROI**: ★★★

---

### 🔴 C7 — 缺 curated palette 池

**Skill 要求**：`references/curated-palettes.md` 10 套配色 + 8 套字体对作为 fallback。

**现状**：`prompts.ts:35-95` `buildLayer0PromptFromBrief`：完全让 LLM 推断 HEX：
```typescript
"## Output schema",
"Return ONE JSON object matching this TypeScript type:",
"```ts",
`{
  designTokens: {
    colors: {
      primary: string;        // hex like "#0E8B5A"
      ...
    }
  }
}`,
```

如果 brief 是 "modern green editorial"，LLM 可能产 `#3FBF7D` / `#1E8E55` / `#10A763` 等任意绿——**无 anchoring**。

**修复**：在 Layer 0 prompt 末尾追加 fallback 节：
```typescript
"## Fallback to curated palettes (use when brief is ambiguous)",
"If you cannot derive a primary color from the brief with high",
"confidence, SELECT one of these 10 curated palettes verbatim:",
"",
"1. Midnight Executive — primary #1E2761, secondary #CADCFC, accent #FFFFFF",
"2. Forest & Moss — primary #2C5F2D, secondary #97BC62, accent #F5F5F5",
"3. Coral Energy — primary #F96167, secondary #F9E795, accent #2F3C7E",
// ... (10 套)
"",
"Set source.kind = 'preset' and source.presetId = '<chosen_id>'.",
"Do NOT invent intermediate HEX values when the brief is vague.",
```

**ROI**: ★★★★★（成本极低，立即可见效）

---

### 🟠 C8 — PageBrief 缺 visualElement 硬字段

**Skill 要求**：PageBrief.visualElement 枚举 + 渲染后校验。

**现状**：`types.ts:103-112` `PageBrief`:
```typescript
export type PageBrief = {
  version: "page_brief/v1";
  pageId, pageType, intent, primaryFocal, composition, whatToAvoid, tone;
  // 全部自然语言；primaryFocal 字段是 LLM 自由描述
};
```

`prompts.ts:253-264` Layer 3 output schema 把 primaryFocal 描述为："single visual focal element" —— **不约束类型**。

`pipeline.ts:259-287` validateHtml 不检查 visual element 是否实际存在。

**修复**：
```typescript
// types.ts
export type PageBrief = {
  // ...existing
  visualElement: "icon_in_colored_circle" | "colored_block" | "large_stat_number"
                 | "chart" | "shape_composition" | "hero_image" | "diagram";
  visualElementRequired: boolean;  // exceptions: cover, section_break, closing, quote
};

// prompts.ts Layer 3 output schema 改
visualElement: "..."; // pick one of the 7 enums based on page content type

// pipeline.ts validateHtml 新增
function validateVisualElement(html: string, brief: PageBrief): ValidationError | null {
  if (!brief.visualElementRequired) return null;
  const patterns: Record<string, RegExp> = {
    icon_in_colored_circle: /<(div|span)[^>]*class="[^"]*(icon-circle|circle-icon)/,
    colored_block: /<(div|span)[^>]*class="[^"]*(colored-block|block-fill)/,
    large_stat_number: /<(div|span)[^>]*class="[^"]*(large-stat|stat-number|kpi)|font-size:\s*[5-9]\dp/,
    chart: /<(canvas|svg)[^>]*class="[^"]*(chart|graph)/,
    shape_composition: /<svg[^>]*(viewBox|class)/,
    hero_image: /<img|background-image\s*:\s*url/,
    diagram: /<svg|class="[^"]*(mermaid|diagram)/,
  };
  return patterns[brief.visualElement].test(html)
    ? null
    : { code: "missing_visual_element", suggestion: `Must include a ${brief.visualElement}; got none` };
}
```

**ROI**: ★★★★

---

### 🟢 C9 — font stack 无兜底

**Skill 要求**：`references/never-list.md` #14 + `curated-palettes.md` font stacks 都必须以 Windows 预装字体结尾。

**现状**：`css-from-genes.ts:47-49`:
```typescript
--font-display: "${f.titleEa}", "${f.titleLatin}", -apple-system, sans-serif;
--font-body: "${f.bodyEa}", "${f.bodyLatin}", -apple-system, sans-serif;
--font-mono: "${f.mono}", "JetBrains Mono", monospace;
```

如果 LLM 产 `titleEa: "PingFang SC"` + `titleLatin: "Georgia"`，CSS 是：
`"PingFang SC", "Georgia", -apple-system, sans-serif` — Mac 优先，**Windows 下 PingFang SC + Georgia 都没有**，回退到 `-apple-system`（Mac 系统字体），再回退到 sans-serif（系统默认）。**整 deck 在 Windows 用户机器上字体回退乱套**。

**修复**：`css-from-genes.ts` 加 Windows-preinstalled 兜底：
```typescript
function ensureWindowsFallback(stack: string[]): string[] {
  const windowsSafe = ["Microsoft YaHei", "SimHei", "SimSun", "Arial", "Calibri", "Segoe UI", "Times New Roman", "Cambria", "Georgia", "Consolas", "Trebuchet MS", "Impact"];
  const hasWindowsFallback = stack.some(f => windowsSafe.includes(f.replace(/^["']|["']$/g, '')));
  if (!hasWindowsFallback) {
    stack.push('"Microsoft YaHei"');  // 默认 CJK 兜底
  }
  return stack;
}

--font-display: ${ensureWindowsFallback([`"${f.titleEa}"`, `"${f.titleLatin}"`, `-apple-system`, `sans-serif`]).join(', ')};
```

**ROI**: ★★

---

### 🟢 C10 — Icon library 未锁定

**Skill 要求**：spec_lock.iconLibrary + iconStrokeWidth 锁定单一库。

**现状**：完全没有 icon library 概念。`prompts.ts` Layer 4 prompt 不约束 icon 来源——LLM 可能用 emoji、可能用 inline SVG、可能用不同库 SVG。

**修复**：作为 C1 spec_lock 改造的一部分。

**ROI**: ★★

---

### 🟢 C11 — Style packs 仅 6 套

**Skill 要求**：参考 anthropics 10 套 + AionUi 10 套（重叠）。

**现状**：`ppt-style-packs.ts:1-303` 6 套：corporate_blue / minimal_gold / tech_dark / warm_review / high_contrast / consulting_gray。

**修复**：扩到 10 套，对齐 anthropics + AionUi。低优先级，可以后续做。

**ROI**: ★★

---

## 3. 修复方案分级（最终版）

### Tier 1 — Prompt-only（零代码风险，立即可发）
- **C2** 扩充 NEVER-list（直接编辑 `prompts.ts` SYSTEM_DESIGN）
- **C7** 注入 curated palette 池（编辑 `prompts.ts` `buildLayer0PromptFromBrief`）
- **C9** font stack 兜底（编辑 `css-from-genes.ts`）

预期：60-70% 视觉痛点缓解。代码改动 < 200 行。

### Tier 2 — Schema + Validation 增强
- **C1** 新增 spec_lock 层（types.ts + pipeline.ts + 新文件 `spec-lock.ts`）
- **C4** visual brief schema 加 3 维度（`shared/src/types`）
- **C5** 结构化 retry 反馈（pipeline.ts + prompts.ts）
- **C8** PageBrief.visualElement enum + validator（types.ts + pipeline.ts）
- **C10** iconLibrary 进入 spec_lock

预期：再 15-20% 痛点缓解。代码改动 < 600 行 + 测试。

### Tier 3 — 架构升级
- **C3** Visual QA subagent + detector（新文件 `visual-qa.ts` ~300 行 + subagent prompt）
- **C6** 取消 placeholder fallback（pipeline.ts 改）
- **C11** Style packs 扩到 10 套（ppt-style-packs.ts）

预期：再 10-15% 痛点缓解。代码改动 < 800 行 + subagent 集成测试。

---

## 4. 实施 PR 拆分建议

| PR | 范围 | 测试 | 估时 |
|---|---|---|---|
| **#1** Tier 1 (C2/C7/C9) | prompts.ts + css-from-genes.ts | 单元测试 + 1 端到端 smoke | 0.5d |
| **#2** Tier 2 schema (C4) | types.ts + visual brief | schema 单元 | 0.5d |
| **#3** Tier 2 spec_lock (C1/C10) | + spec-lock.ts + pipeline.ts | spec_lock 校验单元 + pipeline 集成 | 1.5d |
| **#4** Tier 2 validation (C5/C8) | pipeline.ts + types.ts | retry test + visualElement test | 1d |
| **#5** Tier 3 visual QA (C3) | visual-qa.ts + subagent prompt | mock subagent test + 1 live smoke | 2d |
| **#6** Tier 3 cleanup (C6/C11) | pipeline.ts + ppt-style-packs.ts | metrics 校验 | 0.5d |

总：~6 天工作量。Tier 1 单独可在半天内出 PR，立即解决最大痛点。

---

## 5. 风险与回退策略

| 风险 | 缓解 |
|---|---|
| Tier 1 改动 SYSTEM_DESIGN 后已有 mock 测试失败 | 用 `--update-snapshot` 重跑；视觉对照差异 |
| 新 spec_lock schema 与历史 session 文件不兼容 | spec_lock 是新文件，不影响历史；旧 session 不带 spec_lock 时降级旧 prompt |
| visual QA subagent 增加显著 latency（每 deck +30-60s）+ token | 提供 `enableVisualQa: boolean` 配置，默认开但可关 |
| Layer 4 retry 改造可能减少成功率 | 灰度发布，先在 wireless 6 页样本对照 retry rate 是否下降 |
| 取消 placeholder fallback 后用户体验下降 | 不一次性取消；先记录 placeholder 触发率，等观察 2 周再决策 |

---

## 6. 结论

**11 个缺口 × 19 个项目验证的解决方案 = 可信的优化路径**。

最高优先级：**先做 Tier 1（半天工作）→ 观察 1-2 周 retry rate / 用户反馈 → 再决定 Tier 2/3 的优先级**。

下一步：阶段 8 实施 Tier 1（C2 + C7 + C9）并跑 vitest 验证。
