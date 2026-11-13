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
  - 编套餐内容和份量
---
首屏把已给的核心价格和「适合谁、能一起做什么」配到同一组画面，让人当场判断值不值。中间拍最能证明所含服务或权益的环节；每项给定的关键信息都要可听懂，商家没给的细则省略。
把价格/包含内容、限制条件、购买和预约分配到相邻的短句或镜头，各句各说一件事。画外音可以承载限制。说清在哪买、买完如何用；已给的日期、金额、时长和限制不自行更改。

按行业把权益拍成观众能核对的东西：餐饮拍已知的几人份和包含菜品，护理拍已确认的项目及用时，活动体验拍提供的装备或带练。首屏优先让价格和最有用的一项已知权益同时出现，剩下的限制和预约留到后面的独立镜头。

## 先排一条购买到使用的动线
餐饮优先解决人数与份量的判断，再交代套餐的主要内容；护理优先说明付费包含哪个具体项目、哪些条件影响能否用；亲子或手作优先说明购买单位是按人、按组还是按作品，以及已知由谁带练、有什么可用。主镜头拍真正包含的内容，额外服务不要混进套餐镜头。关键信息缺失时不能从画面反推赠品、价格或预约规则；只讲已确认的部分，关键限制与价格放在相邻位置。
