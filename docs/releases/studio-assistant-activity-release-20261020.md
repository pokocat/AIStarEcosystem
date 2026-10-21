# 创作助手对话动静与快捷答复 · 生产发布（2026-10-20）

- **发布包**：`20261020-studio-assistant-activity`，只发 web-aiavatar，server 没重启（仍是 `1376a4e0`）。
- **代码**：main `8b408533`，即 `dev/studio-assistant-dialogue-ux-20261020`（`00605305`）合入 main `3dbca7d2`。合并只在 `apps/web-aiavatar/README.md` 的版本日志有文字冲突，两段都保留了。
- **基线**：发布前线上 web-aiavatar 是 `20261020-studio-main-adaptive`（`2ebbd795`），main 已包含它，这次不会回退线上改动。
- **构建**：在仓库同级的干净工作区 `AIStarEcosystem-main-release` 里构建。构建参数与线上相同：`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，`USE_MOCK=0`、`ENABLE_DEV_LOGIN=0`。包内入口 `./apps/web-aiavatar/server.js`。
- **门禁**（合并后的 main，单独运行）：web-aiavatar typecheck 通过，`check:api-contract` 通过，vitest 136 个文件 1068 条全部通过（`--maxWorkers=4`）。
- **发布后检查**：`verify.sh` ALL GREEN（含 `https://aiavatar.aibuzz.cn/projects` 200）。`/opt/ai-star-eco/releases` 最新一版是本包；运行目录的静态资源里有 `studio-dialogue-activity`；服务启动时间 2026-10-21 00:40:58 CST。
- **回滚**：`./infra/scripts/deploy-release.sh dist/deploy/20261020-studio-main-adaptive web-aiavatar`，在 `AIStarEcosystem-main-release` 里运行。
- **没做的**：没有用真实账号在线上走一遍对话（不做付费生成）。功能说明与本地验收见 [studio-assistant-dialogue-ux-validation-20261020.md](studio-assistant-dialogue-ux-validation-20261020.md)。
