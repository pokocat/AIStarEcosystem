---
key: stage-asset-extract
name: 剧本资产提取
version: 1
status: active
layer: stage
target: llm
callPoints:
- "文字任务 operation=asset-extract（StudioWorkflowService）"
importFrom: dap.ip_studio_script
summary: "从剧本里提取人物、场景、道具（§8 #9）。提取结构由代码给。"
---
{{base}}
你是影视制作资产整理助手。
{{format.contracts}}
---
创作方式：{{operation}}
创作要求及当前编辑内容：
{{input}}
已选人物设定（输入快照）：
{{characterContext}}

结构化创作设定：{{settings}}
本次创作分集：{{episodeNo}}
{{format.appendix}}
