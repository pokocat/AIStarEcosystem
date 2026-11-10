---
key: scene-ecom-promo
name: 促销转化
version: 1
status: active
layer: scene
summary: 视频场景「促销转化」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: ecom-promo
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 优惠力度
    required: true
  - label: 商品是什么
    required: true
  - label: 原价对比
    required: false
    use: 客户写了才比较
  fiction: story
  avoid:
  - 编限量/限时
  - 编销量
---
开头三秒直接亮出优惠力度（原价和现价的反差），中间用两三个画面证明商品值这个价，结尾讲怎么买并引导下单。客户写了截止时间才写「限时」，没写就不提。不编限量限时、不编销量。
