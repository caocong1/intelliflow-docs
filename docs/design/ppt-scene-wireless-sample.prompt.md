# Gemini Prompt For `ppt_scene/v1` Sample

Model:

`gemini-3.1-pro-preview`

Execution pattern:

- stdin: `docs/design/ppt-scene-json-protocol.md`
- prompt:

```text
基于上面的协议，输出一个完全合法的 ppt_scene/v1 JSON。主题：无线网络建设全流程指南。仅生成3页：cover、comparison、summary。受众：企业与公共机构的采购负责人、IT负责人。语言：zh-CN。设计气质：editorial、premium、asymmetric、not dashboard。内容要点：1. cover页突出‘无线网络建设全流程指南’；2. comparison页对比无线网络与有线网络，比较部署弹性、建设成本、扩容效率、适用场景；3. summary页总结选型原则：合规优先、场景适配、容量预估、可运维性。必须让三页构图明显不同。只输出JSON，不要Markdown代码块，不要解释。
```

Output file:

`docs/design/ppt-scene-wireless-sample.json`
