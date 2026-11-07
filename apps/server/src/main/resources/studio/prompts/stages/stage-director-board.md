---
key: stage-director-board
name: 导演台分镜图
version: 2
status: active
layer: stage
target: image-model
callPoints:
- "导演台分镜出图 task=board（DirectorService）"
summary: "一个片段的单张分镜画面或 2×2 分镜板（§8 #20）。直接交给画图模型，不拼底座；已生成的图按生成时的版本核对是否需更新。"
---
{{#single}}
{{style}}风格的剧情分镜画面，画幅 {{aspect}}。
{{/single}}
{{^single}}
{{style}}风格，生成 2×2 分镜板：四个等大无间隙的格子，整板 {{aspect}}，每格 {{aspect}}，按左上、右上、左下、右下的顺序阅读。
{{/single}}
{{#refs}}
{{label}} 提供{{#isScene}}场景{{/isScene}}{{#isProp}}道具{{/isProp}}{{#isProduct}}商品{{/isProduct}}{{#isCharacter}}角色{{/isCharacter}}「{{name}}」的{{#isScene}}空间布局与光源方向{{/isScene}}{{#isProp}}外观{{/isProp}}{{#isProduct}}外形、颜色、包装和标签{{/isProduct}}{{#isCharacter}}身份与造型{{/isCharacter}}。
{{/refs}}
{{#hasRefs}}
参考图里的多视角或资料排版代表同一个资产，不要复制资料排版、背景，也不要把同一个角色画成多个人。参考图只确定人物身份、造型、道具外观和空间，画面里按镜头重新给人物布光，参考图本身偏暗或偏色的地方不照搬。
{{/hasRefs}}
{{#hasProduct}}
商品和参考图保持一致：外形、比例、颜色和包装都不改，不换牌子，包装上原有的图案和文字照参考图保留，主要部分不被手或其他东西遮住。
{{/hasProduct}}
{{#cells}}
{{#single}}画面：{{/single}}{{^single}}{{position}}格：{{/single}}{{size}}，{{camera}}。{{still}}
{{/cells}}
{{#blanks}}
没有用到的格子保持纯灰色留白。
{{/blanks}}
布光与调色：{{#live}}默认按影视人像布光，主光塑造五官，适度补光，让肤色自然、有气色，保留皮肤质感和场景氛围。{{/live}}{{^live}}默认让人物面部受光清楚、五官可辨，配色干净，保留场景氛围。{{/live}}画面风格写明的布光和调色照风格来；画面描述里明确写的剪影、暗面或特殊光色优先，只作用于写到的人物或区域，其他部分沿用默认布光。
{{#single}}只描绘这一个静态时刻，{{/single}}{{^single}}各格沿用同一身份、造型、空间和光源，人物的肤色和整体色调保持一致，明暗和光色只随画面描述的布光变化；机位变化可以让人物在画面左右位置合理变化。每格只画一个静态时刻，{{/single}}不画动作残影。图内不画文字、字幕、镜号或水印。
