---
key: scene-brand-story
name: 品牌故事
version: 1
status: active
layer: scene
summary: 视频场景「品牌故事」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: brand-story
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 品牌
    required: true
  - label: 创始人/经历
    required: false
    use: 客户给了才讲
  - label: 用户故事
    required: false
  fiction: story
  avoid:
  - 编年限/测试/销量
---
从一个人物讲起：给了创始人或品牌经历就照着讲，没给就讲一位用户的故事。拍出一个具体的坚持，最后回到品牌。客户没给的年限、测试次数一律不编。
