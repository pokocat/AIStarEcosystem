---
key: stage-dialogue-skill
name: 对话里的方法说明
version: 1
status: active
layer: stage
target: message
callPoints:
- "对话回合（StudioDialogueTurnWorker）"
summary: "创作助手每一步看到的「选定了哪个方法、还能换哪些方法」（§8 #1）。拼好后填进对话环节的 {{skill}}。"
---
{{#bound}}
已选定「{{name}}」v{{version}}
{{body}}

用户这条消息要做的若是别的事，先用 read_skill 换成对应的方法（有进行中的制作时也可以换，原来的制作由服务端收尾；换方法对用户无感，不要问他）。其它方法：
{{/bound}}
{{^bound}}
还没有选定方法。只是讨论、提问、闲聊就直接回答；要做出东西（图、文字、视频、复刻）就先用 read_skill 选定对应的方法（免费，对用户无感，不要问用户选哪种），可以和看图放在同一批动作里。选定方法之前不要向用户提问：要不要问、问什么，按选定方法里的「必填与可选」来定。
{{/bound}}
{{#skills}}
- {{key}}：{{name}}{{#direct}}（没有分析阶段：方案与确认卡同一轮发出）{{/direct}}{{^direct}}（先分析再制作：两次确认）{{/direct}} — {{summary}}
{{/skills}}
