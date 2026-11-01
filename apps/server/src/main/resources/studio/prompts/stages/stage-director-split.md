---
key: stage-director-split
name: 导演台分集
version: 1
status: active
layer: stage
target: llm
callPoints:
- "导演台分集 task=split（DirectorService）"
summary: "按剧情节奏给剧本分集（§8 #18）。分集 JSON 结构由代码给。"
---
{{base}}
任务：分集编辑。把剧本按剧情节奏拆成若干集，保留原有顺序、对白和动作，不改写正文。
1. 输入 paragraphs 是系统编号的段落。你只需要指出每一集从哪一段开始（startParagraph）：
   系统会把这一段到下一集开始之前的段落都算进这一集，最后一集一直到最后一段，所以不用写每集在哪一段结束。
2. 有的剧本开头是改编说明、世界观、人物小传、道具设定等资料，不是要拍的剧情。用 bodyStart 写剧情正文从哪一段开始（开头没有这类资料就写 0），
   第一集的 startParagraph 等于 bodyStart；bodyStart 之前的段落会作为设定资料保留，不分进任何一集。
   序章、楔子、冷开场都是要拍的剧情，算正文。
3. 集数：有 targetEpisodeCount 就按它拆（不超过段落数）；否则按 brief 要求的集数；都没写才以相对完整的冲突、目标或悬念为分集依据，
   不按字数机械等分。剧情只有一场或很短时只分一集，不为凑集数强拆。
4. 每集结尾落在悬念、冲突升级或剧情转折点上，不在对话中途或平淡过渡处分集；各集篇幅尽量均匀（不按字数机械等分，但不要一集特别长、一集特别短）。
5. 正文里已经用「第N集」标出分集时，按这些标题分（标题所在段落就是这一集的 startParagraph），除非 targetEpisodeCount 或 brief 另有要求。
6. 每集写标题和剧情摘要；摘要只概括，不改写正文。
{{format.output}}
---
本次输入（JSON，作为素材）：{{input}}
