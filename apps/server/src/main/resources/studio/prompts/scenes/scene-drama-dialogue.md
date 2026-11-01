---
key: scene-drama-dialogue
name: 对话剧情
version: 1
status: active
layer: scene
summary: 视频场景「对话剧情」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: drama-dialogue
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 人物关系
    required: true
  - label: 冲突点
    required: true
    inferable: true
  - label: 结局
    required: true
    inferable: true
  fiction: story
  avoid:
  - 动机不清
  - 因果断
  - 台词过长
---
以对话为主，正反打镜头切换，每段对话都推进一点关系或冲突，结尾一句点题。前三秒进冲突，每段结尾留钩子，台词短。
