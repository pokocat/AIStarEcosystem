---
key: stage-scene-image
name: 场景出图描述
version: 2
status: active
layer: stage
target: image-model
callPoints:
- "AI 图片页按场景出图（StudioSceneCatalog.compose，kind=image）"
summary: "场景的出图描述加上选中的选项和用户的补充要求，直接交给画图模型（docs/studio-prompt-architecture.md §8 #14）。"
---
{{#free}}{{extra}}{{#options}}
{{label}}：{{prompt}}{{/options}}{{/free}}{{^free}}{{#custom}}{{custom}}{{/custom}}{{^custom}}{{scene}}{{/custom}}{{#samePerson}}
{{photos}}和{{target}}是同一个人的其他照片，只用来确认长相：以这几张共同的五官和脸型为准，不照搬它们的姿势、服装和背景。{{/samePerson}}{{#options}}
{{label}}：{{prompt}}{{/options}}{{#extra}}
补充要求：{{extra}}{{/extra}}{{/free}}
