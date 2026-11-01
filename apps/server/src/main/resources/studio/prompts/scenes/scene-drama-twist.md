---
key: scene-drama-twist
name: 反转剧情
version: 1
status: active
layer: scene
summary: 视频场景「反转剧情」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: drama-twist
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 人物/场景
    required: true
  - label: 反转点
    required: true
    inferable: true
  fiction: story
  avoid:
  - 为反转而反转
  - 伏笔突兀
---
前半段按观众预期铺垫，埋一个不起眼的伏笔，结尾揭开反转，让伏笔说得通。反转方式按选项走。
