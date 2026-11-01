---
key: scene-local-groupbuy
name: 同城团购
version: 1
status: active
layer: scene
summary: 视频场景「同城团购」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: local-groupbuy
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 位置
    required: true
  - label: 套餐内容与团购价
    required: true
  - label: 怎么买、怎么用
    required: true
  - label: 原价
    required: false
    use: 客户写了才比较
  - label: 排队/人气
    required: false
    use: 客户写了才必须出现
  fiction: story
  avoid:
  - 环境空镜占主体
  - 泛泛夸好吃
  - 编服务细节（堂食/打包/几人份）
---
开头亮出团购价格和包含的内容，逐项展示套餐里的东西，结尾提醒怎么买、怎么到店用。购买闭环拆两段：先讲领券入口（在哪里买），再讲到店核销（怎么用）。客户写的排队 / 老字号等氛围事实必须做成画面或台词出现。
