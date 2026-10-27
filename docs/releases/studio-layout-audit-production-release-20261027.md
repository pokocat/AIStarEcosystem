# Studio 桌面页面布局与交互审计修复（2026-10-27 生产发布）

| 发布编号 | 服务 | main 提交 | 重启时间（CST） |
|---|---|---|---|
| `20261027-studio-layout-audit` | server、web-aiavatar | `7feed0ab`（改动提交 `272163bc`） | 23:59:18 |

构建工作区是仓外的 `AIStarEcosystem-release-director`，从 origin/main `7feed0ab` 新开 `release/studio-layout-audit-20261027`，工作区干净，构建参数带 `NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。

## 发布范围

改动来自工作区 `dev/page-layout-interaction-audit-92f7ad`（基于 `4a9b5f18`），合进 main 时只多了上一次发布的文档，没有冲突。明细见 `apps/web-aiavatar/README.md` 版本日志同名一节：

- **画布**：创作浮层按停靠助手让出的宽度收窄，不再压住助手；助手拉宽也给画布留至少 480；AI 圆钮悬停颜色；React Flow 角标关闭（致谢写在 `src/canvas/README.md`）。
- **导演台**：去掉和剧本页步骤卡重复的「下一步」横幅；「一键制作」固定在标题栏；结果提示改右下角浮层（纯确认 6 秒消失，警告保留到关闭）；页面框与其它工作页一致；新建作品弹窗两种方式同高；「写分镜脚本」不能用时点了说原因；没填作品名时跳过「第N集」标题取第一句（服务端）。
- **首页与入口**：英雄区下重复的四个入口删掉；「数字人形象」打开画布里的「制作个人 IP」填空卡；「短剧创作」「从形象到短剧」进 AI 导演台；「导演执导」改叫「分镜讨论」；项目页加「AI 导演台作品」最近四条。
- **场景 / 发行**：标题统一「场景·专项创作」；【待建设】改「敬请期待」。
- **成片高级编辑**：Twick 样式不再引外站字体（国内打不开时会拖住样式）。
- **V69.1 迁移**：只在 H2（本地老库）分支先把 ENUM 列放宽再插值；Java 迁移没有校验和（只有 V67 / V68 覆写了 `getChecksum`），生产 MySQL 路径不变，已执行过的库不受影响。这是对已执行迁移文件的改动，按 AGENTS 原则本不该改，这里因为只影响本地 H2 且没有校验和才放行，记在这里。
- 没有新的数据库迁移，线上仍是 69.1。

## 发布前核对

- **线上版本**：发布前 server 与 web-aiavatar 都是 `20261027-studio-error-dialogs`（`4a9b5f18`），已在 main 里；之后没有别的会话发过版。
- **检查**（在改动工作区，合并前；合并只多了上一次发布的文档）：
  - `pnpm typecheck:all`、`pnpm typecheck:admin`、接口契约检查、server 编译全部通过。第一次跑 typecheck 报 `tsc: command not found`，是那个工作区只装了 web-aiavatar 的依赖；`pnpm install --frozen-lockfile` 之后通过。
  - web-aiavatar 全量 167 个文件 1352 项通过。
  - 服务端导演台测试与 `VideoPromptBindingMigrationTest` 共 112 项通过，包括新加的 `DirectorDefaultTitleTest` 和 H2 老库放宽 ENUM 的用例。
- **本地冒烟**（测试模式，可丢弃的库副本，不调模型）：
  - 首页「数字人形象」只有一个，点了进画布、打开「制作个人 IP」填空卡；「短剧创作」进 AI 导演台。
  - 1024 宽时停靠助手 480px，React Flow 角标隐藏。
  - 导演台默认作品名跳过「第1集 夜班」，「一键制作」在标题栏。
  - 项目页「AI 导演台作品」列出「全部作品」和最近 4 部。
  - 场景页标题、发行页「敬请期待」正确。
  - 手机首页不横向溢出；桌面和手机都没有前端报错。
- **在途任务**：发布前两次查生产库，没有 running 的 `ip_run`，近 24 小时 8 条视频任务全部 succeeded。

## 部署

- **server**：23:59:18 重启，17.9 秒起来。Flyway 校验 70 个迁移，schema 69.1，不需要迁移。线上 `app.jar` 校验和前缀 `1bbef9341afd5534`，与本地构建一致。
- **web-aiavatar**：23:59:19 重启。`verify.sh` ALL GREEN。
- **日志**：重启后到线上验收结束，server 0 条 ERROR。
- **重启窗口**：发布期间每秒探测一次公网，共 58 次。
  - `https://aiavatar.aibuzz.cn/projects` 全程 200。
  - 需要登录的接口 `/api/v1/ip-studio/director/works` 在 23:59:18–23:59:35 返回 502，约 18 秒；23:59:36 起恢复为未登录的 401。
  - 单实例重启的已知限制，见 TODO。

## 线上验收

在已登录的浏览器里操作。测试数据是专门建的，验收后已删除；没有改动用户的作品，没有调用生成模型，没有扣积分。

| 页面 | 结果 |
|---|---|
| 首页 | 「数字人形象」只有一个，英雄区那排重复入口没有了，「短剧创作」在 |
| 首页 →「数字人形象」 | 新建测试画布，进入 `?start=ip`，助手打开「制作个人 IP」填空卡，React Flow 角标隐藏；测试画布已删除 |
| 画布 1024 宽 | 停靠助手 480px（上限 488），给画布留够宽度 |
| 导演台（测试作品） | 剧本以「第1集 验收」开头，作品名取正文第一句「验收用的临时作品，不生成任何内容」；「一键制作」在标题栏；剧本页不再有重复的「下一步」横幅；测试作品已删除 |
| 项目页 | 「AI 导演台作品」区块在，「全部作品」和最近 4 部都链到导演台 |
| 场景页 / 发行页 | 标题「场景·专项创作」；发行页 4 处「敬请期待」，没有【待建设】 |

**没验证的**：
- 导演台结果提示浮层的自动消失：需要有结果提示的作品。
- 「写分镜脚本」不可用时的说明弹窗：线上有可用视频模型，触发不了。
- 成片高级编辑的字体：要打开 Twick 编辑器。

以上三项都只有本地和测试覆盖。

## 回滚

```bash
cd /Users/donis/dev/AIStarEcosystem-release-director
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261027-studio-error-dialogs server,web-aiavatar
```

回滚后首页的「数字人形象」回到普通出图入口、项目页没有导演台作品区；`start=ip` 的画布链接在旧版里不会打开填空卡（画布照常打开）。
