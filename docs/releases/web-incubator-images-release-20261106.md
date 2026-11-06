# AI 艺人孵化演示换图发布（2026-11-06）

## 发布了什么

- **地址**：https://incubator.aibuzz.cn
- **服务**：只发 `web-incubator`，13:35 CST 重启。其他服务没有重启，`aistareco-server` 的启动时间仍是 10:52。
- **制品**：`20261106-incubator-images`，从 main `2898a4966` 在仓外干净工作区 `../AIStarEcosystem-release-incubator` 构建。
- **内容**：125 张 Unsplash 外链换成 136 张生成图，放在 `apps/web-incubator/public/images/`，共 6.6MB。
  人物都是虚构的，图里没有文字和品牌标识；同一个人全站用同一张图，原来共用一张的不同艺人各有自己的图。
  出图要求在 `apps/web-incubator/docs/image-manifest.json`。

## 检查

- 发布前：`pnpm install --frozen-lockfile`、`pnpm typecheck:all`、`pnpm typecheck:admin`、`pnpm check:api-contract` 通过。
  这次没有改服务端，没有重新编译服务端。
- 直推 main，没开 PR，所以没有 CI 结论。

## 线上验收

用无头 Chrome 按真实域名访问：

- 桌面 1440 走了各端入口、全部方案页、工作台主要菜单和页签；手机 375 走了 7 个页面。没有裂图、页面报错、外部图片请求，手机宽度没有横向滚动。
- 走查实际加载了 114 张。另外 22 张在更深的页面里（形象锻造模板、创业者小程序艺人、市场列表靠后的艺人等），只确认了文件请求返回 200、代码引用都对得上。
- 图片响应是 `image/webp`，缓存一天；celebrity、star、aiavatar 域名返回 200，admin 返回 302。
- `/favicon.ico` 仍是 404，应用没配图标，不影响使用。

## 发布时的一次误报

部署命令我把 `PUBLIC_BASE` 填成了 `https://incubator.aibuzz.cn`，脚本最后的 `verify.sh` 因此报 FAILED：它要在这个地址上探测 `/login`、`/admin`、`/api/config`，演示站没有这些路径。
服务本身没问题，用默认的 `http://47.98.162.120` 重跑 ALL GREEN。**发 `web-incubator` 也要用默认的 `PUBLIC_BASE`，不要填演示站域名。**

## 回滚

服务器上的上一版制品是 `20261106-web-incubator`，本地制品在同一工作区的 `dist/deploy/` 下：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 \
  REMOTE_ROOT=/opt/ai-star-eco ./infra/scripts/deploy-release.sh dist/deploy/20261106-web-incubator web-incubator
```

回滚后页面重新依赖 Unsplash 外链。
