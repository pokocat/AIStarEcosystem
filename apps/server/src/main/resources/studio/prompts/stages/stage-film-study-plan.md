---
key: stage-film-study-plan
name: 拉片分段
version: 1
status: active
layer: stage
target: llm
callPoints:
- "拉片分段（StudioFilmStudy）"
summary: "拉片前按叙事或动作阶段给原片分段（§8 #11）。JSON 结构和分段上限由代码给。"
---
{{base}}
将原片按叙事或动作阶段划分为1至8个连续片段，一个片段可包含多个镜头，不按固定秒数均切，闪光不等于切镜。{{format.output}}{{format.cap}}
---
{{material}}
