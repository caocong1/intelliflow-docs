# IntelliFlow PPT 优化实施计划

> **输入**：阶段 7 `CODE-REVIEW.md` 的 11 个缺口分级 + Tier 1/2/3 路线
> **本文件**：实施进度跟踪 + 每次 PR 的 diff 摘要 + 测试结果

---

## 进度概览

| Tier | 范围 | 状态 | 提交 |
|---|---|:---:|---|
| **Tier 1.1** | C2 NEVER-list 扩展 | ✅ 已实施 | 待提交 |
| **Tier 1.2** | C7 curated palettes 注入 Layer 0 prompt | ✅ 已实施 | 待提交 |
| **Tier 1.3** | C9 font stack Windows 兜底 | ✅ 已实施 | 待提交 |
| Tier 1 总体测试 | css-from-genes 单元 + pipeline 集成 | ⏳ 等待 deps | — |
| Tier 2 | C1/C4/C5/C8/C10 | 待开始 | — |
| Tier 3 | C3/C6/C11 | 待开始 | — |

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
- 在 css-from-genes 新增 ensureWindowsFallback + 单元测试（C9）
- 测试运行受 deps 问题阻塞中（vite + fdir 缺）；deps 完成后即可验证
