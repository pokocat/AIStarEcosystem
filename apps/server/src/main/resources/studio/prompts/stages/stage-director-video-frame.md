---
key: stage-director-video-frame
name: 导演台首帧出片
version: 1
status: active
layer: stage
target: video-model
callPoints:
- "导演台片段视频 task=video，视频模型只按首帧出片时（DirectorService），AI 视频页长视频的首帧模式（StudioSegmentedRun）"
summary: "只支持首帧出片的视频模型用的提示词：视频从采用的分镜画面开始动，只有这一张图，不带角色、场景、道具参考图和声音参考，所以不写「图N」「音频N」。改了模板只影响之后生成的视频，已生成的不会标成需更新。"
---
以首帧画面为起点，生成 {{seconds}} 秒、{{aspect}}、{{style}}风格的剧情片段。保持首帧里的人物、服装、场景和道具不变，不切换到别的画面。
{{#shots}}
{{size}}，{{camera}}。{{action}}
{{#lines}}
  {{#narrator}}旁白{{/narrator}}{{^narrator}}{{speaker}}{{/narrator}}说：“{{text}}”
{{/lines}}
{{/shots}}
{{#voiceDescs}}
{{name}} 的音色：{{desc}}
{{/voiceDescs}}
只说上面列出的台词，不增加人物或剧情，不生成字幕。
