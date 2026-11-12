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
用一个附近的人真的会遇到的需求引出「原来这里就有」。第一拍给难题、罕见手艺或一眼认得的现场动作；人的反应像初次发现。给用户提供过的地标和到达方向留一句清楚的话，最好和能看到的参照同时出现，让人听一遍就知道从哪儿找。
进店后只展示最能说明这家有何用途的那一步。尾镜落在解决结果或回扣位置记忆；没给门牌、价目或时间就自然省略。

按顾客为什么找这家店选第一眼：修理铺把损坏物件和能认出的门头放在一起，饭店给一道让人拐进去的出锅动作，预约服务给最能确认项目的实物或现场细节。位置是这条片的目的时，用已给地标和去法做首尾呼应。
