---
key: scene-ecom-demo
name: 功能演示
version: 1
status: active
layer: scene
summary: 视频场景「功能演示」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: ecom-demo
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 功能点
    required: true
    use: 客户给几个演示几个
  - label: 商品是什么
    required: true
  fiction: story
  avoid:
  - 漏演示客户给的功能
  - 编功能
---
按功能逐个演示，每个镜头只讲一个功能，特写操作和效果，效果大胆拍出来，最后一个镜头展示商品全貌。客户没写的功能不演示。
