---
key: scene-drama-emotional
name: 情感剧情
version: 1
status: active
layer: scene
summary: 视频场景「情感剧情」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: drama-emotional
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 关系
    required: true
  - label: 小事/情绪点
    required: true
    inferable: true
  fiction: story
  avoid:
  - 情绪突兀
  - 用力过猛
---
围绕一段关系（亲情、友情、爱情）讲一个小事，情绪慢慢推进，结尾有一个让人动容的瞬间。
