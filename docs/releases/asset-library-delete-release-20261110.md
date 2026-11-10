# 资产页删除发布（2026-11-10）

已发布，2026-11-10 12:31（北京时间）。只发 `web-aiavatar`，`server` 没动。

## 内容

- 资产页能删东西了。图片、视频、音频、文字：卡片「更多」菜单里有「删除」，「批量选择」后工具栏也有「删除」。角色、场景、道具：新增「批量选择 → 删除」，单个仍在详情里删。人物页批量时只能勾资产库里的角色，我的 IP 和授权给我的形象灰掉。
- 删除只把资产库这一条标成已删除：文件不动，画布、导演台作品、成片照常能用，自动收录也不会再加回来。规则见 [`docs/ip-studio-personal-asset-library-plan.md`](../ip-studio-personal-asset-library-plan.md) 末节。
- 沿用既有接口 `DELETE /saved-assets/{id}`、`DELETE /library/objects/{id}`，无后端改动、无迁移。

## 发布

- 构建提交：main `2eb4e1d1888448660554e3208747d6bf78c37abf`（PR #186 CI 全绿后快进）。仓外干净工作区 `../AIStarEcosystem-asset-delete`，Mac mini 队列 `9468ea9a6b7c` 构建后 rsync 回本机；制品 `20261110-asset-delete-2eb4e1d1`，参数 `NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，BUILD_ID `hcK3-KTUpx2QXa9LemHcn`。
- 发布前：资产页三个测试文件 24 项、web-aiavatar 类型检查通过（Mac mini）；本地库副本浏览器走查单个删除、批量删除、人物页只能选角色。PR CI 第一次 `studio-effect-library.test.tsx` 的「slow selection…」一条失败，与本次改动无关，本机用同一提交连跑 10 遍全过，重跑通过（已记 TODO）。
- 窗口：Studio 两个域名最近两天每小时只有 2–7 个 IP，午饭时段最低。发布前 5 分钟没有人打开页面，只有停在页面上的轮询和保存；`/api` 由 nginx 直连后端，不经过 Next，web 重启不影响生成、轮询和扣费。
- `deploy-release.sh` 的环境检查与 `verify.sh` 全绿。web-aiavatar 12:31:06 重启即就绪，12:30–12:32 共 0 个 5xx；后端仍是 11:08:58 启动的进程。线上页面 BUILD_ID 与制品一致，资产页代码 `page-2df018fbbdda6f18.js` 含删除功能，`aistar` / `aiavatar` 两个域名 200。

## 没做

- 没有在线上实际点删除（会删真实账号的数据）。
- 「我的 IP」（数字人）在资产页仍不能删，只能在旧版数字人详情页删（进回收站）。

## 回滚

web-aiavatar 回生产机 `/opt/ai-star-eco/releases/20261110-scene-layers-8c43f1d0`，资产页恢复成没有删除入口；已经删掉的条目不会回来（服务端的软删除不随前端回滚）。
