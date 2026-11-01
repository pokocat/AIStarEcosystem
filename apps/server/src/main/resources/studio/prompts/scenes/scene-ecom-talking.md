---
key: scene-ecom-talking
name: 口播带货
version: 1
status: active
layer: scene
summary: 视频场景「口播带货」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: ecom-talking
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 商品是什么
    required: true
  - label: 解决什么问题
    required: true
    inferable: true
  - label: 价格优惠
    required: false
    use: 客户写了才说
  fiction: story
  avoid:
  - 空夸功效
  - 编使用场景
  - 编价格
---
开头一句话说清商品解决什么，中间边讲边展示商品细节和使用过程，结尾讲怎么买并引导下单；优惠信息客户写了才讲，没写就讲使用场景和用法。拿到客户的商品和卖点后，先核对商品细节与图片一致，再按「问题→展示→怎么买」写。
