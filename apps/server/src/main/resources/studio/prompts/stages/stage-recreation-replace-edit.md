---
key: stage-recreation-replace-edit
name: 爆款复刻 · 元素替换的视频提示词
version: 1
status: active
layer: stage
target: video-model
callPoints:
- "AI 视频页的元素替换：原片按切镜切成几段，每段直接交给视频模型编辑，所有段用这同一段提示词（StudioRecreationTaskPlan.replacementAnswer）"
summary: "以视频1为基础，只替换用户要换的东西，其余画面、镜头、动作、口型、字幕和声音照原片。开头的「编辑视频」和要求里的「替换」不能删：厂商的编辑任务要在提示词里看到这类词才按编辑处理。"
---
编辑视频：以视频1为基础，{{requirement}}
{{#refs}}
{{label}}：{{what}}。
{{/refs}}
除了要替换的内容，视频1的画面、构图、镜头运动、人物动作、表情、口型、字幕和声音都保持不变，时长和节奏也不变。
