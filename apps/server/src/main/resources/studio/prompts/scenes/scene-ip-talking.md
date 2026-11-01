---
key: scene-ip-talking
name: 数字人口播
version: 1
status: active
layer: scene
summary: 视频场景「数字人口播」的拍法与要用到的信息（docs/studio-prompt-architecture.md §9.6）
sceneId: ip-talking
sceneKind: video
importFrom: scene-catalog
scene:
  facts:
  - label: 主题
    required: true
  - label: 要点
    required: true
    use: 客户给几点讲几点
  fiction: story
  avoid:
  - 人物形象与素材不一致
  - 超时讲不完要点
---
人物面对镜头讲解，中间穿插和内容相关的画面，重点词放慢强调（不在画面中生成文字，字幕由后期配音词对齐），结尾一句总结。开头先抛一个问题，分成几点讲，每点一个画面。人物长相、声音与素材严格一致。
