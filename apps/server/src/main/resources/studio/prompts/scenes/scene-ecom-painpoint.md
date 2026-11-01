---
key: scene-ecom-painpoint
name: 痛点解决
version: 1
status: active
layer: scene
summary: 视频场景「痛点解决」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: ecom-painpoint
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 痛点
    required: true
    inferable: true
  - label: 商品怎么解决
    required: true
    inferable: true
  fiction: story
  avoid:
  - 编前后差异
  - 编功效数据
---
开头放大一个用户熟悉的烦恼，接着商品出场解决问题，用前后对比展示效果，最后一句总结。对比画面只拍客户描述过的差异，不编未验证的效果。
