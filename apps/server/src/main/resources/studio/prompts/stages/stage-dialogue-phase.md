---
key: stage-dialogue-phase
name: 对话里的阶段说明
version: 1
status: active
layer: stage
target: message
callPoints:
- "对话回合（StudioDialogueTurnWorker）"
summary: "创作助手每一步看到的当前阶段、本阶段能做的收费操作和后台制作进度（§8 #1）。拼好后填进对话环节的 {{stage}}。"
---
{{^started}}未开始（还没有选定制作方法）{{/started}}{{#started}}{{#production}}制作阶段{{#direct}}（本方法没有分析阶段，propose_plan 的 stage 填 production，方案和确认卡同一轮发出）{{/direct}}{{/production}}{{^production}}分析阶段{{/production}}；本阶段可用的收费操作：{{operations}}（收费步骤需要用户确认方案和预算后才执行）{{/started}}
{{#execution}}后台制作：{{execution}}{{/execution}}
