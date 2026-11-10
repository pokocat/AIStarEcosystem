---
key: scene-ecom-seeding
name: 场景种草
version: 1
status: active
layer: scene
summary: 视频场景「场景种草」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: ecom-seeding
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 生活场景
    required: true
    inferable: true
  - label: 商品是什么
    required: true
  fiction: story
  avoid:
  - 硬推销
---
从一个具体的生活场景切入，商品自然出现在场景里被使用，展示用完之后的好状态，不硬推销，结尾轻引导（看主页 / 进店）。
