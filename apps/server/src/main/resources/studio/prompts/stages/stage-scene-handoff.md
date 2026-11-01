---
key: stage-scene-handoff
name: 场景交给助手的话
version: 1
status: active
layer: stage
target: message
callPoints:
- AI 视频页把场景交给画布创作助手（StudioSceneCatalog.compose，kind=video）：爆款复刻、超过模型单段上限的长视频
summary: 拼成一段话作为助手对话的第一条用户消息；它本身不调模型，助手那一轮会拼上底座（docs/studio-prompt-architecture.md §8 #13）。
---
帮我做一条 {{duration}} 秒的{{orientation}}短视频，类型是「{{sceneTitle}}」。
{{#ask}}
我的要求：{{ask}}
{{/ask}}
{{#options}}
{{label}}：{{prompt}}
{{/options}}
{{#hasMaterials}}
画布上的素材：{{#materials}}{{#isVideo}}「{{title}}」是要复刻的参考视频{{/isVideo}}{{#isImages}}{{#titles}}「{{.}}」{{/titles}}是上传的{{label}}，画面里出现时要和它一致{{/isImages}}{{#isCharacter}}「{{title}}」是出镜人物，长相和穿着保持一致{{/isCharacter}}{{#isVoice}}「{{title}}」是配音要用的声音{{/isVoice}}{{^-last}}；{{/-last}}{{/materials}}。
{{/hasMaterials}}
{{#noAsk}}
我没写具体要求，先看素材，再按下面的拍法出方案。
{{/noAsk}}
{{^hasBrief}}
拍法里要讲但我没给的，就只引导关注或下单。
{{/hasBrief}}
{{#hasBrief}}
{{#goal}}
这一条要做到：{{goal}}。
{{/goal}}
{{#hasFacts}}
要用到这些信息，只用我给的原话：{{#facts}}{{label}}{{#use}}（{{use}}）{{/use}}{{^-last}}；{{/-last}}{{/facts}}。
{{/hasFacts}}
{{#hasRequired}}
其中{{#required}}{{.}}{{^-last}}、{{/-last}}{{/required}}是必须有的：我没给的先问我，不要编，也不要换别的说法糊过去。
{{/hasRequired}}
{{^hasRequired}}
拍法里要讲但我没给的，就只引导关注或下单。
{{/hasRequired}}
{{#ending}}
结尾：{{ending}}。
{{/ending}}
{{#noFiction}}
这条不编故事：不要编人物经历，不要把出镜的人写成真实顾客、店员的亲身评价。
{{/noFiction}}
{{/hasBrief}}
拍法：{{scene}}
下面这些我没写就不要出现：价格、优惠、地址；有效期和使用限制（要不要预约、节假日能不能用、是否通用）；品牌创立年份、有多少年历史；检测、测试、实验的次数和画面；销量、排名、获奖、认证、门店数、用户数；功效和其他数据。也不要写「有优惠」「限时」「十年老店」「经过上千次测试」这类话。可以虚构人物和情节来讲故事，但不要写成品牌的真实经历，也不要给编出来的内容配上年份、次数、数量。
要的是做好的视频，不只是脚本：把文案、分镜和每段视频一起排进方案，报总共要花的积分，我确认后一次生成。
