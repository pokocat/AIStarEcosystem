# Studio 静态版导出

把 Studio（`apps/web-aiavatar`）导出成一个压缩包，发给产品或设计在本地打开。不连后端，不用登录，数据都是示例数据。

```bash
/Users/donis/.local/bin/devq run --name studio-static --cwd "$PWD" -- pnpm export:studio-static
```

在仓库根目录运行，产物默认在 `.studio-e2e/static-export/Studio静态版-YYYYMMDD.zip`（已被 git 忽略）。整个导出只包一层 devq。

| 参数 | 作用 |
|---|---|
| `--ref <提交>` | 导出哪个版本，默认 `origin/main` |
| `--out <目录>` | 压缩包放哪 |
| `--no-fetch` | 不先拉取远端 |
| `--no-verify` | 跳过验收（包没被打开过，发出去之前别用） |
| `--keep` | 保留临时工作区，方便排查 |

依赖：`git`、`pnpm`、`ffmpeg`、`zip`、`unzip`、`python3`、Chrome（路径不同时设 `CHROME_PATH`），能访问字体所在的 OSS。

## 它做了什么

脚本在 `--ref` 上新建一个临时工作区，只改那里，不读也不动当前工作区，结束后删除。

1. `transforms.mjs` 改源码：`output: export`、带参数的页面改成读地址栏的外壳、补示例数据的入口。每处改动都按原文匹配，**源码变了就报错退出并指出文件**，不会悄悄漏改。报错后更新这个文件。
2. `overlay/` 复制到 `src/static-export/`：导演台示例作品（`director-fixture.ts`）和普通演示模式里缺的接口（`mock-routes.ts`）。
3. 构建、打包，`package/` 里是发给对方的启动脚本、页面目录和使用说明。
4. `verify.mjs` 把压缩包解压后逐页打开，再走新建画布、助手、AI 图片、AI 视频、导演台、新版界面、手机版。缺接口、脚本报错或页面崩溃都算失败，脚本以非 0 退出，压缩包留着供排查，**不要发出去**。

## 新功能进来时

新页面调了没有示例数据的接口，验收会报 `404 /api/...`。在 `overlay/mock-routes.ts` 里 `registerMock` 补一条，形状照服务端 DTO 写。新增的页面记得加进 `verify.mjs` 的 `pages` 和 `package/pages.html`。

`overlay/` 不参与 `pnpm typecheck`（已在 `tsconfig.json` 排除），这样示例数据不会挡住日常提交；形状不对由验收发现。
