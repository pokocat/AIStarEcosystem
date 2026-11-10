---
key: scene-local-visit
name: 到店实录
version: 1
status: active
layer: scene
summary: 视频场景「到店实录」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: local-visit
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 店名和位置
    required: true
  - label: 体验了什么
    required: true
  fiction: none
  avoid:
  - 编排队
---
按这家店的品类设计观众最想看的体验过程：把服务或出品的关键步骤拍细，把最有说服力的过程和效果放在中段，拍出人在体验时的真实反应，结尾说一句自己的感受。开头直接抛钩子，不必从进门拍起。套餐内容和份量只写客户给过的。
