---
key: stage-recreation-video-check
name: 爆款复刻 · 每段成片检查要点
version: 1
status: active
layer: stage
target: message
callPoints:
- "AI 视频页的爆款复刻：每段成片出完后的检查要点，逐镜的是非题（StudioRecreationTaskPlan）"
summary: "逐个镜头对照提示词和参考图：开场画面对不对、人和商品是不是点名的那张图、前后是不是同一个人、动作和结束画面有没有做出来。修改意见只写这一镜应该是什么画面，不合格重出时会接到视频提示词里。"
---
对照上面的提示词，逐个镜头检查成片{{#hasRefs}}，人和物对照参考图{{/hasRefs}}：
{{#keyframes}}
- 第 {{shot}} 镜（约 {{at}} 秒起）：开头的画面是不是和{{label}}一致（人和物的位置、远近、大小，前景的手）。
{{/keyframes}}
- 每个镜头里要换的人和商品，是不是提示词这一镜点名的那张图里的样子；镜头推近或切近后手里拿的、桌上摆的，是不是这一镜点名的那一件，不能是别的镜头的那一件（subject-replaced）。
- 同一个人在各个镜头里是不是同一张脸、同一个发型、同一身衣服，有没有留着原片人物的帽子、衣服和配饰，画面里有没有水印和多余的文字（character-consistency、old-subject-residue）。
- 提示词每一镜写的动作、镜头运动和结束画面有没有做出来，镜头的先后顺序对不对（scene-and-action）。
哪一镜不对，suggestion 里一行写一镜，直接写这一镜应该是什么画面，格式「第N镜：……」（例如「第3镜：推近后女生手里端的是图3 的炒饭」），不写「建议」「请修改」「重新生成」这类话。
