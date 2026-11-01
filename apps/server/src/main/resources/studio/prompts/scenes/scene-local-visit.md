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
  - 编服务细节
  - 编排队
---
第一视角从进门开始，点单、上菜或体验服务，拍吃到、用到时的反应和细节，结尾说一句自己的感受。服务细节（堂食 / 打包 / 几人份）只写客户给过的。
