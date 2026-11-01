---
key: scene-drama-placement
name: 剧情植入
version: 1
status: active
layer: scene
summary: 视频场景「剧情植入」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: drama-placement
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 故事
    required: true
  - label: 商品
    required: true
  - label: 商品怎么帮上忙
    required: true
    inferable: true
  fiction: story
  avoid:
  - 打断剧情
  - 硬广口吻
  - 编功效
---
先讲一个完整的小故事，商品在关键情节里自然出现并帮上忙，不打断剧情，结尾轻轻点出商品。商品事实不编。
