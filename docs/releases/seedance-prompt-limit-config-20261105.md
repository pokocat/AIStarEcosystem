# Seedance 提示词上限调到 5000 字（生产配置，2026-11-05）

只改线上配置，没有发版、没有重启。用户查过厂商文档后没有查到硬限制，要求放宽到 5000。

## 改了什么

北京时间 2026-11-05 08:06，通过模型配置服务（`endpointSave`，操作人记 `claude-code-donis`）把下面四条端点的 `video_request_spec_json.contract.promptMaxChars` 从 2000 改成 5000：

| 端点 | 名称 |
|---|---|
| `ai-1fb0d9ce-d74` | 火山方舟 · Seedance 2.0 Fast |
| `ai-d91e6ae3-6df` | 火山方舟 · Seedance 2.0 Mini |
| `ai-98b369eb-b59` | OneToken · Seedance 2.0 |
| `ai-onetoken-seedance25` | OneToken · Seedance 2.5 |

## 依据与未验证的部分

- 2000 这个数只在配置里，上线时就记了「未核实方舟的上限」。
- 火山方舟文档只有建议：中文提示词不超过 500 字、英文不超过 1000 词，太长时模型可能只抓重点，漏掉部分内容。文档没有写超长会被拒。
- OneToken 文档需要登录，没有看到。
- **没有真调过超过 2000 字的提示词。** 改之前 14 天内线上 seedance-2.5 最长提交过 1888 字。厂商是否接受、长提示词的内容是否都进了成片，都要等第一条真实任务才知道。

## 验收

- 改前改后逐字段对比四条规格：只有 `/contract/promptMaxChars` 从 2000 变成 5000，其它字段没变。
- 线上 `GET /api/v1/ip-studio/studio/video-models`（已登录的 Studio 页面发出的真实请求）：四个 Seedance 都返回 `promptMaxChars: 5000`，H3 仍是 7000。
- 改后 10 分钟内 `aistareco-server` 没有 ERROR 日志。

已受理的任务不受影响。服务端的超长校验读同一份配置（`VideoStudioService`），所以 5000 字以内不会再被我们自己挡下；超过 5000 仍会被挡。

## 回滚

备份在生产 root-only 目录 `/opt/ai-star-eco/backups/seedance-prompt-limit-20261105T000616Z/`（`video_request_spec.before.tsv` / `.after.tsv`，只含这四条规格，不含密钥）。回滚时用同一个 `endpointSave` 把 `before` 的规格写回去，或者只把这个数改回 2000。

前端「超出多少字、可换哪个模型」的提示是另一件事，提交在 `main`，还没有发布；线上画布超过 5000 字时看到的仍是旧提示。
