---
key: scene-recreation
name: 爆款复刻
version: 1
status: active
layer: scene
summary: 视频场景「爆款复刻」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: recreation
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 参考视频结构
    required: true
    use: 从原片拆
    inferable: true
  - label: 替换内容/卖点
    required: true
  fiction: story
  avoid:
  - 照搬原片台词/内容
  - 人物不一致
---
先拆解参考视频的镜头、节奏和文案结构，再按同样的结构换成我的内容重新拍。保留原片节奏和镜头顺序，台词换成我的卖点，人物换成我的 IP。不照搬原片台词。
