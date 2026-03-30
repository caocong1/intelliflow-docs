# PPT 导出能力设计

> 基于 2026-03-30 技术调研，为 IntelliFlow Docs 平台设计 PPT (.pptx) 导出能力。

## 一、背景与需求

当前 Export 节点支持 Word (.docx)、PDF、Markdown 三种导出格式。业务场景中（尤其招投标、方案汇报）对 PPT 格式有强需求：
- 方案汇报、竞品分析等需要幻灯片演示格式
- 招标响应中的技术方案概要需要 PPT 呈现
- 用户期望从 AI 生成内容直接导出为可编辑的 PPT

**核心目标：**
1. 在现有 Export 节点中新增 PPT (.pptx) 格式
2. 设计 PPT 模板/样式系统
3. 评估在线 PPT 编辑可行性
4. 分阶段实施，Phase 1 最快可用

---

## 二、技术选型

### 2.1 候选方案对比

| 维度 | PptxGenJS | pptx-automizer | nodejs-pptx | Marp CLI |
|------|-----------|----------------|-------------|----------|
| GitHub Stars | ~3,500 | ~400 | ~100 | ~8,000 |
| npm 周下载 | ~80k | ~3k | ~1k | ~15k |
| 维护状态 | 活跃（ESM+CJS 双构建） | 活跃 | 低频 | 活跃 |
| 加载 .pptx 模板 | ❌ | ✅ 核心能力 | ✅ 基础 | ❌ |
| 代码创建 Slide Master | ✅ 完整 | 借助 PptxGenJS | ⚠️ 有限 | ❌ |
| 表格 | ✅ 丰富样式 | ✅ 继承模板 | ⚠️ 基础 | ❌ |
| 图表 | ✅ 柱/折/饼/散 | ✅ 数据替换 | ❌ | ❌ |
| 图片 | ✅ 本地+URL+Base64 | ✅ 替换 | ✅ | ✅ |
| 中文/亚洲字体 | ✅ | ✅ 继承 | ⚠️ | ✅ |
| 零依赖 | ✅ | ❌ (依赖 PptxGenJS) | ❌ | ❌ (需 Chromium) |
| 许可证 | MIT | MIT | MIT | MIT |

### 2.2 选型结论

**PptxGenJS（主力生成）+ pptx-automizer（Phase 2 模板加载）**

- **Phase 1**：仅用 `pptxgenjs`。零依赖、API 成熟、与项目现有 `docx` 库使用模式一致（代码生成 Buffer）
- **Phase 2**：引入 `pptx-automizer`。当需要加载企业 .pptx 品牌模板时，automizer 加载母版 + PptxGenJS 创建动态内容
- **排除 Marp**：依赖 Chromium 运行时，服务端部署成本高。输出的 PPTX 本质是图片幻灯片，不可编辑，不适合企业需要二次编辑的场景
- **排除 nodejs-pptx**：社区小、功能弱、无突出优势

---

## 三、架构决策：扩展 Export 节点

### 3.1 现状调研

| 层 | 文件 | 现状 |
|----|------|------|
| 类型定义 | `shared/types.ts` L226-238 | `formats: Array<"word"\|"pdf"\|"markdown">`, `templateId: string\|null`, `contentMapping: VariableRef[]` |
| 前端配置 | `ExportConfig.tsx` | 格式多选 checkbox，模板下拉（空壳），contentMapping 变量选择器 |
| 前端执行器 | `ExportExecutor.tsx` | 从 formats 中用户选一个 → POST 后端生成 → 下载 |
| 后端路由 | `export.routes.ts` | POST generate(format+filename), GET preview, GET download |
| 后端服务 | `export.service.ts` | switch(format) → 生成 Buffer → 写文件 → 记 DB |
| 流程校验 | `validation.ts` | 流程必须以 export 节点结尾 |
| 后台执行 | `background.service.ts` | **已知 bug**: `case "file_export"` 应为 `"export"` |

**关键发现：**
1. 运行时是**单格式选择**：`formats` 配置是数组（管理员多选允许），但用户运行时只选一种导出
2. `contentMapping` 统一适用所有格式：返回 Markdown 文本，switch(format) 分别渲染
3. `templateId` 已预留但未实现

### 3.2 决策结论：扩展现有 Export 节点

| 维度 | 扩展 Export 节点 | 新增 PPT 节点 |
|------|-----------------|--------------|
| 改动范围 | 小（switch 新增分支） | 大（全链路新节点） |
| 用户认知 | 一致（"导出"选格式） | 复杂（多一种节点） |
| 配置复用 | contentMapping/templateBindings 直接复用 | 需重建 |
| 后续扩展 | 再加 Excel 只需扩 formats | 每种格式一个节点 |
| 流程校验 | 无影响 | 需修改校验规则 |

**结论**：扩展 Export 节点。PPT 只是新增一种格式选项，与 Word/PDF 共享运行时模型。

### 3.3 ExportConfig 类型变更

```typescript
export interface ExportConfig {
  type: "export";
  formats: Array<"word" | "pdf" | "markdown" | "pptx">;  // ← 新增 "pptx"
  /** @deprecated 保留向后兼容，新配置使用 templateBindings */
  templateId?: string | null;
  /** 按格式绑定模板。key = 格式名，value = 模板 ID */
  templateBindings?: Partial<Record<"word" | "pdf" | "pptx", string>>;
  contentMapping: VariableRef[];
  autoAdvance?: boolean;
  allowEdit?: boolean;
  skippable?: boolean;
  executionRule?: NodeExecutionRule;
}
```

**templateBindings 行为规则：**

| 场景 | templateBindings | templateId (旧) | 后端行为 |
|------|-----------------|-----------------|----------|
| 新配置 | `{ pptx: "tpl-1", word: "tpl-2" }` | — | 按选定格式从 bindings 查模板 |
| 旧配置迁移 | 未设置 | `"tpl-old"` | templateId 视为 word 模板（兼容） |
| 无模板 | 未设置 | null | 所有格式用默认样式 |
| 格式无绑定 | `{ word: "tpl-2" }` 但选 pptx | — | pptx 用默认 PPT 主题 |

**前端 ExportConfig 面板变更：**
- 模板配置区按已勾选的 formats 动态展示
- 勾选 word/pdf → 显示"文档模板"下拉
- 勾选 pptx → 显示"PPT 模板"下拉
- Markdown 无模板配置

**后端模板加载逻辑：**
```
generateExport(format, ...) →
  templateId = config.templateBindings?.[format] ?? config.templateId ?? null
  → 按 format 调用对应的模板加载器
```

---

## 四、Slide Schema 与约束规则

### 4.1 Canonical Slide Schema

所有幻灯片内容（无论 AI JSON 输出还是 Markdown 自动转换）最终映射为以下结构：

```typescript
interface SlidePresentation {
  metadata?: {
    aspectRatio?: "16:9" | "4:3";  // 默认 "16:9"
    language?: string;              // 默认 "zh-CN"
  };
  slides: Slide[];
}

type Slide =
  | TitleSlide
  | ContentSlide
  | TwoColumnSlide
  | TableSlide
  | ImageSlide
  | BlankSlide;

interface TitleSlide {
  layout: "title";
  title: string;           // max 60 chars
  subtitle?: string;       // max 120 chars
  notes?: string;          // max 500 chars
}

interface ContentSlide {
  layout: "content";
  title: string;           // max 50 chars
  bullets: string[];       // max 8 items, each max 120 chars
  notes?: string;          // max 500 chars
}

interface TwoColumnSlide {
  layout: "two_column";
  title: string;           // max 50 chars
  left: { title?: string; bullets: string[] };   // max 5 items, 80 chars/item
  right: { title?: string; bullets: string[] };  // max 5 items, 80 chars/item
  notes?: string;
}

interface TableSlide {
  layout: "table";
  title: string;           // max 50 chars
  headers: string[];       // max 6 columns, 30 chars/col
  rows: string[][];        // max 8 rows, 50 chars/cell
  notes?: string;
}

interface ImageSlide {
  layout: "image";
  title: string;
  imageRef?: string;       // VariableRef 或 URL
  caption?: string;        // max 100 chars
  notes?: string;
}

interface BlankSlide {
  layout: "blank";
  elements?: PlaceholderElement[];
  notes?: string;
}
```

### 4.2 溢出处理规则

| 场景 | 检测条件 | 处理策略 |
|------|----------|----------|
| 标题超长 | title > maxChars | 截断 + "…" |
| Bullet 项数超限 | bullets.length > 8 | 自动拆为多页，第 2 页标题加 "(续)" |
| Bullet 单项超长 | item > 120 chars | autoFit 缩小字号至 min 10pt，仍超则截断 |
| 表格列数超限 | headers.length > 6 | 拆为多表，每 6 列一页 |
| 表格行数超限 | rows.length > 8 | 拆为多页，续页带表头 |
| 单元格超长 | cell > 50 chars | 自动换行，超 3 行截断 |
| 备注超长 | notes > 500 chars | 截断 + "[…更多内容请查看原文]" |
| 代码块 | Markdown ``` | 降级为等宽字体文本框（Courier New + 灰背景），max 15 行/页 |
| 嵌套列表 | 缩进列表 | 展平为单层 bullets，子项加 "- " 前缀 |
| 图片缺失 | imageRef 解析失败 | 灰色占位矩形 + "[图片未加载]" |
| 字体缺失 | 模板字体不可用 | 回退链：微软雅黑 → Arial → sans-serif |

---

## 五、Markdown → PPT 转换策略

### 5.1 双路径设计

#### 路径 A：结构化 JSON（推荐，AI 直接输出）

在模型调用节点配置 `outputFormat: "json"` + SlidePresentation JSON Schema，AI 直接输出符合 schema 的幻灯片结构。Export 节点检测到合法 slide JSON 后直接映射到 PptxGenJS API。

**优势**：AI 理解幻灯片逻辑，分页天然合理，布局类型可控。

#### 路径 B：Markdown 自动分页（兜底）

当上游内容是纯 Markdown 文本时，自动转换：

| Markdown 元素 | PPT 映射 |
|---------------|----------|
| `# H1` | TitleSlide（title） |
| `## H2` | 新 ContentSlide 分页（title） |
| `### H3` | ContentSlide 内加粗 bullet |
| `- item` / `* item` | bullets 数组项 |
| `1. item` | 编号 bullets |
| `\|表格\|` | TableSlide |
| `> 引用` | 斜体文本框 |
| ` ``` 代码 ``` ` | 等宽字体文本框 |
| 普通段落 | ContentSlide bullets（按句拆分） |
| `---` 分隔线 | 强制分页 |

**分页规则**：
1. 每遇到 `## H2` 开始新一页
2. 单页 bullets 超过 8 项时自动拆页
3. 表格独占一页
4. 首页无 `# H1` 时自动生成标题页（使用文档标题）

### 5.2 路径选择逻辑（含 Schema 校验闸门）

路径 A 的入口要求 JSON.parse 成功 **且** Schema 校验通过：

```
上游内容 →
  1. JSON.parse() 尝试
     → 失败 → 路径 B（Markdown 自动分页）
  2. 使用 ajv 校验 SlidePresentation JSON Schema
     → 通过 → 路径 A（结构化渲染）
     → 失败 → 路径 B + 在导出 outputData 中记录警告：
       "上游输出包含 JSON 但不符合幻灯片 Schema，已降级为 Markdown 分页模式"
```

**说明**：半合法 JSON（parse 成功但 schema 不匹配）不进入路径 A，避免渲染期崩溃。

---

## 六、模板系统设计

### 6.1 模板分类

| 类别 | 说明 | 使用库 | 阶段 |
|------|------|--------|------|
| **代码主题** (Code Theme) | JSON 定义颜色/字体/品牌，PptxGenJS 代码创建 Slide Master | PptxGenJS | Phase 1-2 |
| **原生模板** (Native Template) | 管理员上传 .pptx 文件，automizer 加载母版布局 | pptx-automizer | Phase 2+ |

### 6.2 代码主题契约 (theme.json)

```json
{
  "$schema": "intelliflow://ppt-theme/v1",
  "name": "企业标准",
  "version": 1,
  "aspectRatio": "16:9",
  "colors": {
    "primary": "#1E40AF",
    "secondary": "#3B82F6",
    "accent": "#F59E0B",
    "text": "#1F2937",
    "textLight": "#6B7280",
    "background": "#FFFFFF",
    "tableHeader": "#E8E8E8",
    "tableStripe": "#F5F5F5"
  },
  "fonts": {
    "title": { "face": "微软雅黑", "size": 28, "bold": true },
    "subtitle": { "face": "微软雅黑", "size": 18, "bold": false },
    "body": { "face": "微软雅黑", "size": 14, "bold": false },
    "caption": { "face": "微软雅黑", "size": 10, "bold": false },
    "code": { "face": "Courier New", "size": 10, "bold": false }
  },
  "branding": {
    "logo": "logo.png",
    "logoPosition": "top-right",
    "logoSize": { "w": 1.0, "h": 0.5 },
    "footerText": "© 2026 Company Name",
    "showSlideNumbers": true
  },
  "layouts": {
    "title": { "background": "primary", "titleColor": "#FFFFFF" },
    "content": { "background": "background", "titleColor": "text" },
    "two_column": { "background": "background", "dividerColor": "secondary" },
    "table": { "background": "background" },
    "image": { "background": "background" },
    "blank": { "background": "background" }
  }
}
```

**校验规则：**
- `colors` 中所有值必须是合法 hex 颜色（`/^#[0-9A-Fa-f]{6}$/`）
- `fonts.*.face` 不做服务端校验（字体可用性取决于客户端），提供推荐字体列表
- `branding.logo` 必须是已上传到模板资产目录的图片文件名
- `layouts` 的 key 必须是 Slide Schema 定义的 layout 类型之一
- `aspectRatio` 限定为 `"16:9"` 或 `"4:3"`

### 6.3 原生 .pptx 模板契约

#### 占位符命名规范

模板 .pptx 中的文本占位符使用以下命名约定（在 PowerPoint 编辑器中设置占位符名称）：

| 占位符名 | 说明 | 出现位置 |
|----------|------|----------|
| `{{TITLE}}` | 幻灯片标题 | 所有 layout |
| `{{SUBTITLE}}` | 副标题 | title layout |
| `{{BODY}}` | 正文内容区 | content layout |
| `{{LEFT}}` | 左栏内容 | two_column layout |
| `{{RIGHT}}` | 右栏内容 | two_column layout |
| `{{TABLE}}` | 表格区域 | table layout |
| `{{IMAGE}}` | 图片区域 | image layout |
| `{{NOTES}}` | 讲者备注 | 所有 layout（可选） |
| `{{FOOTER}}` | 页脚 | 所有 layout（可选） |
| `{{PAGE_NUM}}` | 页码 | 所有 layout（可选） |

#### 上传校验流程

```
管理员上传 .pptx →
  1. pptx-automizer 解析
     → 解析失败 → 拒绝上传 + 错误提示
  2. 提取 Slide Layout 名称列表
  3. 扫描占位符文本框，匹配 {{XXX}} 命名
  4. 校验：
     ✅ 至少 1 个含 {{TITLE}} 的 layout → 通过
     ✅ 至少 1 个含 {{BODY}} 的 layout → 通过
     ⚠️ 缺少某些 layout 类型 → 警告（缺少的 layout 用代码主题默认渲染）
     ❌ 无任何 {{XXX}} 占位符 → 拒绝上传（无法动态填充内容）
  5. 存储：.pptx → 模板资产目录，元数据 → DB
```

**模板文件大小限制**：50MB

#### 模板预览（降级方案）

Phase 2 不生成 PNG 缩略图（需 LibreOffice headless 依赖），改为：
- 展示校验结果：可用 layout 列表、占位符清单
- 提供"下载示例 PPT"按钮：用示例数据填充占位符后的 .pptx

PNG 缩略图预览作为独立 spike，可在 Phase 4 集成 OnlyOffice 时一并实现（OnlyOffice 提供渲染能力）。

#### Layout 匹配与回退链

```
生成某张 slide →
  在模板中查找对应 layout →
    找到 → 使用模板 layout + 替换占位符内容
    未找到 → 回退到代码主题默认 layout（PptxGenJS 代码创建）
              + 记录警告日志

加载模板文件 →
  文件损坏/缺失 → 回退到系统默认代码主题 + 警告日志
  加载成功 → 逐 slide 匹配 →
    占位符替换失败 → 跳过该占位符 + 警告
  → 生成 .pptx（部分 slide 降级也不中断导出）
```

### 6.4 模板数据模型

```typescript
interface PptTemplate {
  id: string;
  name: string;
  description?: string;
  type: "code_theme" | "native_pptx";
  aspectRatio: "16:9" | "4:3";
  themeConfig?: object;          // code_theme: theme.json 内容
  templateFilePath?: string;     // native_pptx: 文件路径
  availableLayouts: string[];    // 解析缓存：模板中可用的 layout 类型
  createdBy: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 七、在线 PPT 编辑评估

### 7.1 方案对比

| 方案 | 可行性 | 部署成本 | 许可证 | 编辑体验 | 推荐度 |
|------|--------|---------|--------|---------|--------|
| **OnlyOffice Document Server** | ✅ 成熟 | 中(Docker) | AGPL-3.0 社区版(20并发免费) / Developer Edition($1,911+/年) | 优（接近原生 PPT） | ⭐⭐⭐⭐ |
| **Collabora Online** | ✅ 成熟 | 中(Docker) | MPL-2.0 / 商业 | 良（LibreOffice 级） | ⭐⭐⭐ |
| **自研轻量编辑器** | ⚠️ 可行但成本极高 | 极高 | N/A | 差 | ⭐ |
| **iframe 嵌入 Office Online** | ⚠️ 需 M365 订阅 | 低 | Microsoft 商业 | 优 | ⭐⭐ |

### 7.2 许可证分析

- **OnlyOffice AGPL-3.0 社区版**：IntelliFlow 为企业内部使用（不对外分发），AGPL 传染性不影响。如需 SaaS 对外提供，需购买 Developer Edition（$1,911+/年）
- **Collabora Online MPL-2.0**：许可证更友好，但编辑体验略逊 OnlyOffice

### 7.3 推荐路线

- **当前（Phase 1-3）**：不集成在线编辑。用户下载 .pptx 后在本地 PowerPoint/WPS 中编辑。
- **未来（Phase 4）**：
  - 内部部署 → OnlyOffice 社区版（免费，Docker 一键部署，20 并发限制）
  - SaaS 场景 → 购买 OnlyOffice Developer Edition 或选 Collabora

### 7.4 集成架构（Phase 4 参考）

```
前端                           后端                          OnlyOffice
┌─────────┐   iframe URL    ┌──────────┐   file callback   ┌──────────┐
│ 文档空间  │ ←────────────→ │ API 服务  │ ←───────────────→ │ Doc Server│
│ (iframe) │                │          │                   │ (Docker)  │
└─────────┘                └──────────┘                   └──────────┘
                                ↕
                        文件系统 / MinIO
                        (.pptx 文件存储)
```

集成要点：
- 后端提供 `/api/onlyoffice/config` 返回编辑器配置（文件 URL、回调 URL、用户信息）
- OnlyOffice 编辑保存时回调后端 `/api/onlyoffice/callback`，后端更新文件
- 安全：回调 URL 使用 JWT 签名验证

---

## 八、分阶段实施计划

### Phase 0: 前置 Bug 修复（prerequisite，~0.5 天）

**变更：**
- `background.service.ts`：`case "file_export"` → `case "export"` 对齐 `types.ts` 枚举
- 补充后台执行导出的回归测试（Word/PDF/Markdown 各一条）

**回滚**：单行修复，git revert。

### Phase 1: 基础 PPT 生成（~3-5 天）

**变更：**
- `bun add pptxgenjs`
- `shared/types.ts`：formats 联合类型新增 `"pptx"`，新增 `templateBindings` 字段
- `export.service.ts`：
  - 新增 `generatePptBuffer(content: string): Promise<Buffer>`
  - 实现 Markdown 自动分页（路径 B）
  - switch(format) 新增 `case "pptx"` 分支
  - 模板加载兼容 `templateBindings` 和旧 `templateId`
- `ExportConfig.tsx`：FORMAT_OPTIONS 新增 PPT 选项，模板区按格式动态展示
- `ExportExecutor.tsx`：支持 pptx 格式
- `export.routes.ts`：format 校验新增 `"pptx"`

**环境变量控制**：`ENABLE_PPTX_EXPORT`（默认 false），前端按此控制 pptx 选项可见性。

**回滚**：`ENABLE_PPTX_EXPORT=false` → 功能不可见。仅新增 switch 分支，不影响现有格式。

**测试**：
- 单元：Markdown → Slide[] 转换，溢出场景
- 集成：`generatePptBuffer()` → jszip 解压验证 slide XML
- Golden：固定 fixture → .pptx → 解压比较关键 XML 属性
- 兼容性冒烟：手动在 PowerPoint/WPS/LibreOffice Impress 打开
- 回归：Word/PDF/Markdown 导出不受影响

### Phase 2: PPT 模板系统（~5-7 天）

**变更：**
- DB migration：`ppt_templates` 表
- `bun add pptx-automizer`
- 管理后台：模板管理页面（上传、校验结果展示、示例下载、启用/停用）
- `ExportConfig.tsx`：PPT 模板下拉（从 ppt_templates 加载）
- `export.service.ts`：模板加载 → Slide Master 注入 → 内容渲染

**不含**：PNG 缩略图预览（独立 spike）。

**回滚**：`templateBindings.pptx = undefined` → 默认主题。管理页面可隐藏。

**测试**：
- 模板契约：上传合法/非法 .pptx
- 占位符替换：fixture 模板 + 数据
- 回退：模板缺失 → 降级默认主题

### Phase 3: 结构化幻灯片输出（~3-4 天）

**变更：**
- 定义 SlidePresentation JSON Schema 文件
- `export.service.ts`：路径 A（JSON → PPT 渲染）+ ajv Schema 校验闸门
- 提供 PPT 输出格式预设提示词模板

**回滚**：路径 A 校验失败自动走 B。无破坏性。

**测试**：
- Schema 校验：合法/非法 slide JSON
- 渲染：各 layout 类型 fixture
- 路径选择：JSON → A，纯文本 → B，半合法 JSON → B + 警告

### Phase 4: 在线编辑（可选，长期，~2-3 周）

**前提**：确认许可证方案。

**变更：**
- Docker Compose 新增 OnlyOffice Document Server
- 后端：`/api/onlyoffice/config` + `/api/onlyoffice/callback` + JWT 验证
- 前端：OnlyOffice iframe 嵌入组件
- 附带实现 PNG 预览（利用 OnlyOffice 渲染能力）

**回滚**：停 OnlyOffice Docker → 隐藏在线编辑入口 → 纯下载模式。

---

## 九、依赖清单

| 依赖 | 版本 | 引入阶段 | 许可证 | 用途 |
|------|------|----------|--------|------|
| `pptxgenjs` | latest | Phase 1 | MIT | PPT 生成 |
| `pptx-automizer` | latest | Phase 2 | MIT | .pptx 模板加载 |
| `ajv` | latest | Phase 3 | MIT | JSON Schema 校验 |
| OnlyOffice DocServer | latest | Phase 4 | AGPL-3.0 / 商业 | 在线编辑 |
