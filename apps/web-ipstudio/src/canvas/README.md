# 画布 —— vendored from basketikun/infinite-canvas

**这不是我们写的代码。** 上游是 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)（MIT，
版权见 `LICENSE.upstream`），v0.157 整体搬进本仓。搬而不是引依赖，因为上游是独立的
Vite 应用、不发 npm 包；搬进来的代价是**从此由我们维护，上游更新要手动合**。

## 为什么用它

自己手写画布做不到它的完成度。它的画布层意外地好搬：核心 `infinite-canvas.tsx` 只依赖
react + 主题 + 类型，整个 canvas 目录里 0 处 Vite 专有写法（`import.meta`）、1 处路由耦合，
而且技术栈跟本仓一模一样（React 19 + Tailwind 4 + zustand + lucide）。

## 剥掉了什么，为什么

上游把**模型 API Key 存在浏览器 IndexedDB 里直连上游**（它的 `canvas-proxy` 只是个转发 CORS
的壳，README 明写「不校验 API Key、不落盘日志」）。本仓的模型端点配在后台
（`AiAppBinding` + `ai_app_endpoint_candidate`），积分在服务端 hold/commit，资产只落 OSS ——
所以这一层必须换掉，换的是**调用层，不是画布**。

| 上游文件 | 我们的替代 |
|---|---|
| `services/api/image.ts` / `video.ts` / `model-plugin.ts` | 走本仓服务端生成端点 |
| `stores/use-config-store.ts`（存 API Key / 渠道） | 模型候选从服务端拉（同短剧线 `render/models` 形态） |
| `services/{file,image}-storage.ts`（localforage → IndexedDB） | OSS 上传，DB 存 cdnKey、URL 出 wire 派生 |
| `services/api/prompts.ts` | 本仓 `PromptService` |
| `i18n/` 双语 | 中文单语（§4.6），文案内联 |

**注意**：画布上的模型选择器要留着 —— 用户能选模型，只是选项来自后台白名单而不是自己填 Key。

## 改动纪律

搬进来的文件尽量少改，改了就在改动处留注释说明原因（方便日后跟上游对比）。
新增的胶水层放在 `src/canvas-bridge/`，不要混进这个目录。
