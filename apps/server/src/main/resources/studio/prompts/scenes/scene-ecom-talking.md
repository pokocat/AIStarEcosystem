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
从人正在做、却被小麻烦打断的一刻开讲。首屏同时看到麻烦和人的真实反应，台词对着这件事接话。整条说清一个购买判断，中间让人亲手做一次与该判断直接相关的演示，镜头拍清商品的作用、适用情境和可见结果。
用一句具体的适用判断收束；用户有下单目标或给了入口，顺势把动作讲清。亲测时长、个人经历、效果和价格只按提供的信息写。

按商品和人群选能当场试的一下：办公小件用一次原本被打断的桌面操作，厨具用实际握持或处理动作，穿戴品用穿上后当下要做的事。首句是人对麻烦的反应，中间演示，尾句给具体的适用判断；明确要成交时再顺着判断交代入口。
