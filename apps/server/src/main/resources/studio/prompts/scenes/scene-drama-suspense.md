---
key: scene-drama-suspense
name: 悬疑剧情
version: 1
status: active
layer: scene
summary: 视频场景「悬疑剧情」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: drama-suspense
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 谜团
    required: true
    inferable: true
  - label: 线索
    required: false
  fiction: story
  avoid:
  - 线索乱
  - 结局无意义
---
开头抛出一个谜团，中间逐步给线索、制造紧张，结尾揭晓或留下更大的悬念。
