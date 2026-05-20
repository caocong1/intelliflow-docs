# PPT Research Index

这份目录用于沉淀 IntelliFlow 在 AI PPT 方向上的长期研究结论，避免后续再次从零开始。

## 已沉淀文档

### 总览与对比
- [oss-ai-ppt-landscape.md](./oss-ai-ppt-landscape.md)
  - 6 个开源项目的分层定位和逐项分析
- [oss-ai-ppt-comparison-matrix.md](./oss-ai-ppt-comparison-matrix.md)
  - 按能力维度横向比较各项目
- [intelliflow-ppt-optimal-architecture.md](./intelliflow-ppt-optimal-architecture.md)
  - 面向 IntelliFlow 的最优组合路线建议
- [deep-report-synthesis.md](./deep-report-synthesis.md)
  - 对 `gpt-5.4-pro` 深度研究报告的本地吸收与修正
- [template-generation-paradigms.md](./template-generation-paradigms.md)
  - 视觉模板/风格从哪里来：5 种范式 + 豆包/Kimi 拆解 + LandPPT 4 层 AI 流水线 + IntelliFlow 决策选项

### 当前实现方向
- [../design/staged-ai-ppt-protocol.md](../design/staged-ai-ppt-protocol.md)
  - 分阶段 AI PPT 正式协议草案
- [../design/ppt-mvp/README.md](../design/ppt-mvp/README.md)
  - 当前隔离 MVP 说明
- [../design/ppt-mvp/family-design-contract.md](../design/ppt-mvp/family-design-contract.md)
  - 当前 family-first 设计约束

### 实验路线
- [../design/ppt-scene-json-protocol.md](../design/ppt-scene-json-protocol.md)
  - 已降级为实验格式的 `ppt_scene/v1` 协议

## 后续使用建议

### 做架构决策时先看
1. `oss-ai-ppt-landscape.md`
2. `oss-ai-ppt-comparison-matrix.md`
3. `intelliflow-ppt-optimal-architecture.md`

### 做实现时先看
1. `staged-ai-ppt-protocol.md`
2. `family-design-contract.md`
3. `ppt-mvp/README.md`

## 注意

- 研究过程中拉到本地的 `/tmp/oss-ai-ppt/*` 仓库副本是**临时目录**，不应作为长期知识存储依赖。
- 持久结论应继续补充到本目录。
- 如果后续要继续深入某个开源项目，应优先把关键结论写入新文档，而不是只留在会话里。
