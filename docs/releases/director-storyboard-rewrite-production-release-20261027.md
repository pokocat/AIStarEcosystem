# AI 导演台：分镜页重写入口、一键制作无事可做、本集摘要多行（2026-10-27 生产发布）

两次发布，都从干净的 main 构建，构建工作区为仓外的 `AIStarEcosystem-release-director`：

| 发布编号 | 服务 | main 提交 | 时间（CST） |
|---|---|---|---|
| `20261027-director-storyboard-rewrite` | server、web-aiavatar | `e6e5a2ea` | 19:35 重启 |
| `20261027-director-rewrite-credit-copy` | 只发 web-aiavatar | `a0481b1c` | 19:39 重启，server 没动 |

修复内容、根因和本地验收（测试模式 13 步、真模型重写、摘要与窄屏）见 [本地验收记录](director-storyboard-rewrite-validation-20261027.md)。

## 发布前核对

- **线上版本**：server 是 `20261027-director-endpoint-output`（`0cd70d44`），web-aiavatar 是 `20261027-studio-h3-optimize`（`384dfe31`）。两者都已包含在 main 里，从 main 构建不会回退线上改动。
  - 这次 server 包里只多了本次修复（以及与 `0cd70d44` 的合并），web 包里也只多了本次修复。
- **数据库迁移**：没有新增，线上仍是 69.1。
- **合并 main 时的冲突**：`0cd70d44` 去掉了导演台各类文字任务按类型设的输出上限，改为跟随接入点设置。重写任务（`reshoot`）随之不再单独设上限，对应测试改成了新的调用方式。合并后在合并结果上重跑了检查：typecheck:all / admin、server 编译、接口契约，以及导演台相关后端测试 144 项、前端测试 51 项，全部通过。
- **在途任务**：发布前查生产库，没有 running 的 `ip_run`，近 24 小时的视频任务全部是 succeeded。

## 部署

- **server**：19:35:15 重启，16.8 秒起来；从重启到核对时 0 条 ERROR。Flyway 校验 70 个迁移，schema 仍为 69.1。线上 `app.jar` 校验和前缀 `e0535a3d7350c7c7`，与本地构建一致。
- **web-aiavatar**：先在 19:35:16 随 server 一起发布，19:39:05 又单独发了一次。两次 `verify.sh` 都是 ALL GREEN，`/director` 返回 200。
- **为什么补发一次前端**：第一版上线后做只读验收，发现整集重写弹窗写着「最多 275 积分」。这违反了文字任务不展示不确定积分数字的规则（2026-10-26 定）。改成只写「按实际用量结算」：单段确认框同样改掉，企业付款选择也不再带上限；测试里加了断言，AGENTS.md 也记下了这条教训和对应的 grep 门禁。
- **两次重启期间**：server 只重启了一次。按单实例的惯例，重启的十几秒里用户的读取和保存可能报 502；这段时间的公网 5xx 没有另外统计。

## 线上验收

用已登录的浏览器只读查看。打开、取消弹窗都没有写请求，只发了两次一键制作的估价请求（只读，不建任务、不扣积分）。

查看的是作品《敦煌飞仙的玄幻故事》第 1 集《掉漆》：4 个片段，片段 1、2 已有分镜图或视频。这正是用户反馈截图里的那一集。

- **分镜页**：工具栏有「重写分镜脚本」按钮，4 个片段的标题栏都有「重写」。
- **整集重写弹窗**：
  - 「保留现有 4 个片段，逐段重写」默认选中。
  - 「重新切分片段」不可选，并说明原因：「片段 1、片段 2 已有分镜图或视频，重新切分会丢掉它们」。
  - 列出「片段 1 手改过的视频提示词会换成新写的」。
  - 费用只写「按实际用量结算」。这是补发前端之后再次查看的结果。
- **单段确认框**（片段 3）：写明只改这一段、不出图、不生成视频，费用写「按实际用量结算」。
- **一键制作**：选「分镜脚本」后，弹窗写明「全部 3 集的分镜脚本都已写好。一键制作只补还没做的步骤，不会重写已有的分镜脚本……」，没有预算卡，主按钮是「前往分镜」。
- **本集摘要**：剧本页展开后是多行框（textarea），84 个字完整显示，没有横向滚动。

**没验证**：线上没有真的点「开始重写」，因为那会扣用户积分、改动用户的作品。重写的真模型调用已在本地，用线上同款聚算 Qwen 走通（整集约 1.5 分钟、3 积分，单段约 1 分钟、2 积分，见本地验收记录）。等用户第一次在线上重写后，再查该任务的结果。

## 回滚

```bash
cd /Users/donis/dev/AIStarEcosystem-release-director
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261027-director-endpoint-output server
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261027-studio-h3-optimize web-aiavatar
```

server 的回滚包是从线上 releases 目录取回来的，checksums 已校验。

回滚后：
- 旧版不认识 `reshoot` 任务。还在跑的重写，结果会落在一个旧版不处理的任务节点上，不会写回作品。冻结的积分由原任务按用量结算。
- 片段上挂着的 `pendingShots` 旧版会忽略。
