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

## 保存与「别处改过了」（2026-10-19）

画布文档整存整取、服务端是唯一真值（`project-sync.ts`）。`PUT` 带加载时的 `baseDocVersion`，
服务端不是这一版就 409 `IP_PROJECT_STALE` —— 典型就是同一张画布开了两个窗口。处理分两层：

- **同一个浏览器里的多个标签页**（`project-channel.ts`，BroadcastChannel）：存成功就广播版本号。
  另一个标签页收到后，没改过内容就悄悄换成最新内容（视口保留，只拖过视口的那笔补存到新基线上）；
  改过内容就立刻进冲突态，不等防抖到点白发一次必然 409 的 PUT。
- **冲突态**（跨设备只能靠 409 进来）：自动保存停掉，顶栏徽标「别处改过了，这里的改动没存上」+
  「处理冲突」按钮，弹窗 `ip/canvas-conflict-dialog.tsx` 给三条出路：另存一份再换最新（推荐，什么都不丢）/
  换成最新内容 / 以这里为准（用户明确选的覆盖，拿服务端此刻的版本号重存）。
  冲突**不弹通知**：`studio-save.ts` 抛的错带 `IP_PROJECT_STALE`，`studio-errors.tsx` 对它不弹 ——
  否则冲突之后助手自动保存、任务轮询回写每一条都弹同一句，就是用户反馈的「页面一直在报错」。
