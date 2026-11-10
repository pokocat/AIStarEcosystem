---
key: stage-recreation-keyframe
name: 爆款复刻 · 改开场画面
version: 1
status: active
layer: stage
target: image-model
callPoints:
- "AI 视频页的爆款复刻：把原片每个镜头的开场画面改成用户的人物和商品，再交给视频模型从这张图开始拍（StudioRecreationTaskPlan）"
summary: "以原片截图为构图基准，只换人和物，机位、透视、远近和大小关系都不变，去掉平台水印和文字。原片的借位（例如手指捏住远处很小的人）靠这张图保住。"
---
以图1为构图基准：机位、视角、镜头畸变（广角、鱼眼）、景深、透视、光线和色调都和图1一致；画面里每个人和物件的位置、离镜头的远近、在画面里的大小都不变，前景的手和手势保持原样。
{{#layout}}
原片这一刻的构图：{{layout}}。照这个保持大小和位置，不要把远处的人或物放大、拉近。
{{/layout}}
{{#trick}}
这个镜头的看点：{{trick}}。这张图要把它摆出来。
{{/trick}}
{{#refs}}
{{label}}：{{what}}。
{{/refs}}
要改的：{{instruction}}
去掉画面上所有的平台水印、账号、文字和标识。写实照片质感，画面里不要加任何文字。
