# Studio 操作失败统一错误弹窗、导演台资产解除关联（2026-10-27 生产发布）

| 发布编号 | 服务 | main 提交 | 重启时间（CST） |
|---|---|---|---|
| `20261027-studio-error-dialogs` | server、web-aiavatar | `4a9b5f18` | 22:28:24 |

构建工作区是仓外的 `AIStarEcosystem-release-director`。从 origin/main `4a9b5f18` 新开分支 `release/studio-error-dialogs-20261027`，工作区干净。构建参数带 `NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，manifest 已核对。

修复内容、根因和本地验收见 [本地验收记录](director-error-dialog-unlink-validation-20261027.md)：第一轮是导演台，第二轮是 Studio 其他页面、慢供应商、main 上两条红测试。

## 发布范围

- **`9f1f3f2b`：导演台**
  - 操作失败改用错误弹窗。
  - 资产详情列出「用在哪些片段」；删除被挡时列出这些片段，并能前往。
  - 片段「关联资产」里加「解除关联」（新编辑操作 `clip.unlinkAsset`）；台词说话人也算引用。
- **`4a9b5f18`：Studio 统一错误出口**
  - 用户刚做的操作没做成就弹错误弹窗；后台失败照旧右上角提示。
  - 画布、手机账号页、官方示例管理、企业页等原来绕开出口的地方都接上了。
  - 修了 main 上两条红测试的根因。
  - 导演台服务端文案补空格。
- **数据库**：没有迁移，线上仍是 69.1。

## 发布前核对

- **线上版本**：server 是 `20261027-director-storyboard-rewrite`（`e6e5a2ea`），web-aiavatar 是 `20261027-director-rewrite-credit-copy`（`a0481b1c`）。之前的 `studio-h3-optimize`（`384dfe31`）、`director-endpoint-output`（`0cd70d44`）、`video-prompt-binding`（`95696022`）也都在 main 里。从 main 构建不会回退线上改动，也没有别的会话在这之后发过版。
- **合并**：修复分支直接基于当时的 origin/main `c3978d92`，快进推到 main，没有冲突。本机另一个工作区的 main 落后于远端，而且有别的会话未提交的改动，没有动它。
- **检查**（合并结果就是验收用的提交）：
  - `pnpm typecheck:all`、`pnpm typecheck:admin`、server 编译、接口契约检查全部通过。
  - web-aiavatar 全量 1348 项通过，包括 main 上原来红的两条。
  - 导演台后端测试 108 项通过。
- **在途任务**：发布前两次查生产库，都没有 running 的 `ip_run`；近 24 小时的视频任务 7 条，全部 succeeded。

## 部署

- **server**：22:28:24 重启，17.2 秒起来。Flyway 校验 70 个迁移，schema 69.1，不需要迁移。线上 `app.jar` 校验和前缀 `cc629262c7331458`，与本地构建一致。
- **web-aiavatar**：22:28:25 重启。`verify.sh` ALL GREEN。
- **日志**：重启后到线上验收结束，server 0 条 ERROR。grep 用的是 `' -ERROR | ERROR [0-9]+ ---'`。
- **重启窗口**：发布期间每秒探测一次公网，共 58 次。
  - `https://aiavatar.aibuzz.cn/projects` 全程 200。
  - 需要登录的接口 `/api/v1/ip-studio/director/works` 在 22:28:22–22:28:41 返回 502（第一次是超时）。时长约 20 秒，对应后端停机到起来；22:28:42 起恢复为未登录的 401。
  - 这段时间用户的读取和保存会失败。单实例重启的已知限制，见 TODO。

## 线上验收

在已登录的浏览器里操作，测试数据都是专门建的，验收后已全部删除。没有改动用户的作品，没有调用任何生成模型，没有扣积分：建作品、加资产、作为一集都不调模型。

| 页面 | 操作 | 结果 |
|---|---|---|
| 导演台（测试作品「验收临时作品（可删除）」） | 资产详情 | 新的「用在哪些片段」区块在，写「没有片段在用」 |
| 导演台 | 在资产详情里改描述；保存前在别处改同一项（真实冲突） | 弹「保存「验收临时场景」的修改没有完成」。原因是服务端原话；下一步写「页面已经刷新到最新内容」「改过的内容还在编辑框里」。页面里输入的内容还在，后面的列表已刷新到别处改的版本（`online-director-conflict`） |
| 导演台 | 关掉弹窗再点保存 | 保存成功，没有残留弹窗 |
| 项目列表（桌面） | 测试画布在别处删掉后，在页面里确认删除（真实 404） | 弹「删除画布没有完成」，原因「这张画布不存在，或者已经删了」，下一步「这项内容已经不在了……不用再重试」。右上角没有重复提示；刷新后列表里没有它 |
| 项目列表（手机 375） | 同上，另一张测试画布 | 同样的弹窗，完整显示在屏幕内（8–367px），页面不横向溢出 |

项目列表的截图里有用户自己的画布缩略图，没有放进仓库。

**线上没验证的**：

- 「解除关联」按钮、删除被片段引用的资产、片段出视频时解除被拒：都需要作品里有片段，而拆分剧本、写分镜脚本要调模型、扣积分。这三项在本地真实页面上验过（见验收记录）。
- 后台失败只在右上角提示（不弹窗）：在本地验过。

## 回滚

```bash
cd /Users/donis/dev/AIStarEcosystem-release-director
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261027-director-storyboard-rewrite server
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261027-director-rewrite-credit-copy web-aiavatar
```

两个回滚包都在本地 `dist/deploy` 下，线上 releases 目录也有。回滚后：

- 旧版不认识 `clip.unlinkAsset`，页面上没有「解除关联」。已经解除的关联不会恢复，作品内容里那一项已经去掉了。
- 删除被引用的资产时，旧版只在页面顶部挂横幅，也不把台词说话人算作引用。
- 其他页面的操作失败回到右上角提示框。
