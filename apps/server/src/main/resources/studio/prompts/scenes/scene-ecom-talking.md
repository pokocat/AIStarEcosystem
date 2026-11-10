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
  - 编价格
---
开头三秒用一句戳中痛点或反常识的话，配一个让人停下的画面；中间边讲边上手，展示细节和用的过程，至少一个镜头给看得见的证明（对比、测试、效果特写）；结尾讲怎么买并引导下单。优惠信息客户写了才讲，没写就讲使用场景和用法。商品外观和图片一致，按「问题→展示→怎么买」写。
