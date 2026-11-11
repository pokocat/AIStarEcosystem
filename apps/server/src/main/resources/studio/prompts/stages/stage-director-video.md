---
key: stage-director-video
name: 导演台片段视频
version: 1
status: active
layer: stage
target: video-model
callPoints:
- "导演台片段视频 task=video（DirectorService），AI 视频页长视频每段（StudioSegmentedRun）"
summary: "一个片段的中文视频提示词，用户在片段上看到、能改的就是这一份；H3 先改写成英文再提交，改写失败或用户选按原文时原样交给视频模型。只写画面里有什么、谁说什么、谁照哪张图，写给系统看的说明一律不写（会被念出来）。以「声音参考：」开头的行和「这一段没有对白。」这句代码会识别，措辞别改。改了模板只影响之后生成的视频，已生成的不会标成需更新。"
---
{{#hasPeople}}
【人物】
{{#refs}}
{{#isScene}}场景「{{name}}」：空间布局和光源位置照参考{{label}}。{{/isScene}}{{#isProp}}道具「{{name}}」：外观照参考{{label}}。{{/isProp}}{{#isProduct}}商品「{{name}}」：外观、包装和标签照参考{{label}}。{{/isProduct}}{{#isCharacter}}{{name}}：长相、发型和衣服照参考{{label}}。{{/isCharacter}}
{{/refs}}
{{#characters}}
{{characters}}在画面里{{#manyCharacters}}各{{/manyCharacters}}只出现一个，长相和衣服从头到尾保持一致。
{{/characters}}

{{/hasPeople}}
【分镜参考】
{{#grid}}
参考图1 是 2×2 分镜：{{#cells}}{{^-first}}，{{/-first}}{{position}}对应第{{no}}镜{{/cells}}{{#blanks}}，其余格子是空的{{/blanks}}{{#second}}。参考图2 是 2×2 分镜：{{#secondCells}}{{^-first}}，{{/-first}}{{position}}对应第{{no}}镜{{/secondCells}}{{#secondBlanks}}，其余格子是空的{{/secondBlanks}}{{/second}}。每格参考构图、机位和人物位置，人物的受光、肤色和画面整体色调也照对应的格子，每一镜都是一个完整的全屏画面。
{{/grid}}
{{^grid}}
参考图1 是这一段的分镜画面，参考它的构图、机位和人物位置，人物的受光、肤色和画面整体色调也照它，视频是一个完整的全屏画面。
{{/grid}}

【画面】
{{style}}风格，画面里没有字幕。
{{#shots}}
第{{no}}镜（{{#-first}}0–{{end}} 秒{{/-first}}{{^-first}}{{start}} 秒切{{/-first}}）：{{framing}}{{still}}{{action}}{{#only}}画面里只有{{only}}。{{/only}}{{#lines}}{{#narrator}}旁白{{/narrator}}{{^narrator}}{{who}}{{/narrator}}{{#offscreen}}在画外说：「{{/offscreen}}{{^offscreen}}说：「{{/offscreen}}{{text}}」{{#mute}}画面里的人嘴闭着。{{/mute}}{{/lines}}{{#listeners}}{{listeners}}听着，嘴闭着。{{/listeners}}{{#-last}}最后保持这个画面到结束。{{/-last}}
{{/shots}}
{{#hasSound}}

【声音】
{{#noDialogue}}
这一段没有对白。
{{/noDialogue}}
{{#voices}}
声音参考：{{name}}的音色、口音照{{label}}。
{{/voices}}
{{#voiceDescs}}
{{name}}的音色：{{desc}}
{{/voiceDescs}}
{{/hasSound}}

【配乐】
无
