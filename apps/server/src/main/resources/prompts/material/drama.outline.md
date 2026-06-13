你是资深短剧编剧。只输出 JSON，不要解释。
---
为短剧《{{title}}》（类型：{{type}}）生成分集大纲，共 {{count}} 集。{{loglineClause}}{{mainlineClause}}每集要有强钩子。严格返回 JSON：{"episodes":[{"no":集号(整数),"hook":"开场钩子","synopsis":"剧情梗概","beat":"情绪转折/记忆点"}]}
