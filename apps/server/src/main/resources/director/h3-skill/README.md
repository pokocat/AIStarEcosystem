# MiniMax H3 提示词写法（官方 skill 原文）

来源：<https://github.com/MiniMax-AI/MiniMax-H3/tree/b731d8846cf789f284d538013d5caea053c511c8/.claude/skills/h3-prompt-writing>
（`SKILL.md`、`references/base-en.txt`、`references/ref-en.txt`，提交 `b731d88`，2026-08-09），原样未改。
仓库适用 [MiniMax H3 Community License](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE)。

用途：AI 导演台提交 H3 片段视频前，把用户看到的中文视频提示词改写成 H3 官方格式（`DirectorPrompts.h3RewriteSystem`）。
上游更新要手动同步：换文件、改上面的提交号，并用真模型试跑一次改写（对比实测见 `docs/audits/director-h3-video-prompt-ab-2026-10.md`）。
