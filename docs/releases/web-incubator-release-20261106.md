# AI 艺人孵化全端演示生产发布（2026-11-06）

## 发布了什么

- **地址**：https://incubator.aibuzz.cn ，公开访问，不用登录，不被搜索引擎收录（页面 meta + `X-Robots-Tag`）。
- **服务**：只新增 `web-incubator`（`aistareco-web-incubator`，127.0.0.1:3020），其他服务没有重启。
- **制品**：`20261106-web-incubator`，从 main `7a60835de` 在仓外干净工作区
  `../AIStarEcosystem-release-incubator` 构建，2026-11-06 10:3x CST 发布。
- **内容**：设计方的 Figma Make 原型，含落地页、登录、创业者工作台、明星端、品牌端、运营后台、粉丝端和两个小程序。
  全部是前端示例数据，不调接口、不扣积分，页面底部标「演示数据」，登录页提示不要填真实账号。
- **发布前改的**：原型示例数据里的九位真实艺人和《亮剑》换成虚拟，配着虚构 GMV 和授权状态的真人不能放到公网，
  对照表见 `apps/web-incubator/README.md`。上线后的产物里已搜不到这些名字。

## 服务器上动了什么

- 新文件 `/etc/aistareco/web-incubator.env`（只有 `NODE_ENV`、`PORT`、`HOSTNAME`，无密钥）。
- 新单元 `/etc/systemd/system/aistareco-web-incubator.service`，已 enable。
- 新 vhost `/etc/nginx/conf.d/incubator.aibuzz.cn.conf`（80 跳 443，443 反代 3020），`nginx -t` 通过后 reload。
- DNS 和证书都没动：`aibuzz.cn` 泛解析已指向 47.98.162.120，`*.aibuzz.cn` 证书覆盖一级子域。

## 检查

- 合入前：`pnpm install --frozen-lockfile`、`pnpm typecheck:all`、`pnpm typecheck:admin`、`pnpm check:api-contract` 通过。
  服务端没有改动，这轮没有重新编译服务端（前一轮本地编译通过）。
- 直推 main，没开 PR，所以没有 CI 结论。
- `deploy-release.sh` 自带的 `verify.sh` 全绿。

## 线上验收

用无头 Chrome 按真实域名访问：

- 全部 9 个入口在桌面 1440 和手机 375 下都能打开，无横向滚动，无裂图，无控制台错误。
- 右下角切换器走遍 7 个端，登录进工作台，浏览器后退正常，工作台 14 个菜单都能打开。
- 80 返回 308 跳 HTTPS；字体 200；celebrity、star、aiavatar、admin 域名照常。
- 没逐个点的：品牌端、粉丝端和两个小程序的内部页面只看了入口页。国内访问 `images.unsplash.com` 的速度没有测，图片多的页面可能慢。
- `/favicon.ico` 返回 404：应用没配图标，不影响使用。

## 回滚

这是第一版，没有上一版可回。要下线：

```bash
sudo rm /etc/nginx/conf.d/incubator.aibuzz.cn.conf && sudo nginx -t && sudo systemctl reload nginx
sudo systemctl disable --now aistareco-web-incubator
```

下线后 `verify.sh` 的 `check_unit aistareco-web-incubator` 会失败，要同时从 `infra/scripts/verify.sh` 去掉，
并把 `web-incubator` 从各脚本的 `DEFAULT_SERVICES` 去掉，否则 `all` 仍会部署它。
