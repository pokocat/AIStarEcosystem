---
key: scene-local-discovery
name: 门店发现
version: 1
status: active
layer: scene
summary: 视频场景「门店发现」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: local-discovery
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 店名和位置
    required: true
  - label: 最有特色的东西
    required: true
  - label: 排队/人气
    required: false
    use: 客户写了才必须出现
  fiction: story
  avoid:
  - 编地址
  - 编排队（没给）
  - 编人均
---
像路过发现宝藏小店一样开场，带观众看门头、环境和最有特色的东西，结尾说清在哪里。位置用客户原话；客户没提排队就别写排队。
