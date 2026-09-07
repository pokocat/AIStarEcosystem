# canvas-bridge —— 画布与本仓之间的胶水

`src/canvas/` 是从 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)
搬来的画布（MIT）。上游把模型 Key 放浏览器、图存 IndexedDB、提示词走它自己的接口 ——
这几层跟本仓的规矩不一样，于是在这里换掉。

**换的是调用层，不是画布。** 画布上的模型选择器要留着：用户能选模型，
只是候选来自后台配好的端点（`AiAppBinding` + `ai_app_endpoint_candidate`），
不是自己填 Key。这跟短剧线 `GET /me/drama/render/models` 是同一个形态。

| 这里的文件 | 顶替上游的 | 干什么 |
|---|---|---|
| `i18n.ts` | `@/i18n` | 只装中文一种语言（§4.6 禁的是维护双语字典，不是禁这个库）；保留 i18next 是为了不改那 40 个 `useTranslation` 调用点，将来还能跟上游合并 |
| `config-store.ts` | `@/stores/use-config-store` | 模型候选从服务端拉，**没有任何 API Key 输入** |
| `generation.ts` | `@/services/api/image` | 出图 / 出片走服务端，积分服务端 hold/commit |
| `image-storage.ts` / `file-storage.ts` | 同名 | 上传落 OSS，存 cdnKey，URL 出 wire 派生 |
| `prompts.ts` / `prompt-sources.ts` | `@/services/api/prompts` 等 | 接本仓提示词库 |
| `agent-url.ts` | `@/lib/agent/agent-url-bootstrap` | 上游的本地代理引导，本仓不需要，恒 false |

改 `src/canvas/` 里的文件要克制；胶水都放这儿。
