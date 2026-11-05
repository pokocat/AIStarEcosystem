---
key: stage-segmented-board-check
name: AI 视频 · 分镜图检查要点
version: 1
status: active
layer: stage
target: message
callPoints:
- "AI 视频页的长视频，交给成片检查的目标说明（SegmentedVideoService）"
summary: "审分镜图时告诉检查员这张图应该是什么、什么情况算不合格。"
---
这张是分镜图，后面的视频照着它拍。它应当呈现：
{{prompt}}
判 fail 的情况：格子数量不对、格子内容和上面写的明显对不上、同一个人在不同格明显不是同一个人或换了衣服、图上有文字字幕或水印。看不准判 unknown，不判 pass。
