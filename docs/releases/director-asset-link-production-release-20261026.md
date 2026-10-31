# AI 导演台资产：关联已有资产、上传图片、添加资产选集发布（2026-10-26）

发布编号 `20261026-director-asset-link`，服务 `server,web-aiavatar`，构建自远端 `main` `2735628984c236000b1d433bbeae0fda5a58d0a0`（分支 `fix/director-asset-link-upload` 三个提交，快进合入）。

## 变更

按用户定的流程：资产从剧本提取，每项资产再「关联已有资产」或「上传图片」。

- **关联已有资产**（新 edit op `asset.link`，替代 `asset.import`）：在资产详情里选个人资产库里同类型的一项。图和描述由服务端按本人资产库读，类型不一致或那项没有图都拒绝并说明原因。所选版本的图直接采用（`source=library`，不因设置改动过期），记 `libraryObjectId`，描述空着才补，名字保留剧本里的叫法，资产修订号 +1。
- **角色也上传即用**：角色接受 `asset.upload`，也能采用历史里的上传图 / 资产库图。10-24 的「角色图只能由系统生成」作废，`DIRECTOR_CHARACTER_UPLOAD_NOT_ALLOWED` 已删除。代价是普通照片没有设定集的多视角，人物一致性可能变差，由用户取舍。形象参考保留，只剩上传 / 移除，只在生成设定图时用。
- **去掉批量「从资产库导入」**（它会凭空新建资产）。「添加资产」保留作提取漏项的兜底，必须选「出现在」哪几集，默认全剧，至少一集；编辑资产时也能改。此前添加 / 导入会悄悄挂到分镜页当前选中的那一集（没选过就是第 1 集），之后没有地方改。
- **用词**：作品自己的资产不再叫「资产库」（确认弹窗按钮改「保存资产」，提示改「资产已保存」），免得和个人资产库混淆。

无迁移。线上已有作品里的旧资产不受影响；`episodeIds` 为空的旧资产编辑时不强制选集。

## 评审

Codex 只读评审：无 P0 / P1，4 项 P2，发布前全部修掉（提交 `27356289`），未再复审：

1. 编辑资产时集数选择没进草稿：重新提取补上的集会被旧编辑覆盖回去，关掉详情再打开选择丢失。改为草稿，没改过就跟服务端走、不提交。
2. `asset.link` 补描述后没递增修订号，拿着旧版本的页面能把补上的描述悄悄清掉。已 +1。
3. `episodeIds=[]` 的旧资产编辑时保存按钮被禁用（本次引入的回归）。没改过集数就不拦。
4. 资产库图的 key 恰好和以前的生成图相同时，关联后仍按生成图判过期。改为按资产库图处理。

另外自查一处：「出现在」按钮组原本放在 `Field` 的 `<label>` 里，点标题文字会误触第 1 集，改成 `div`。

## 检查

- `typecheck:all`、`typecheck:admin`、API 契约、server 编译通过。
- 服务端导演台测试 61 项通过，新增 `DirectorLibraryLinkTest`（9 项：主版本 / 指定版本、角色直接采用、类型不符、没有图、重新关联、同 key 生成图、修订号）和 `DirectorAssetEditTest`（选集按顺序去重、不存在的集拒绝、角色上传直接采用）。
- 导演台前端测试 36 项通过，新增 `director-assets-link.test.tsx` 7 项。web-aiavatar 全量有 3 项失败：`personal-asset-library`、`studio-template-source` 两项 main 上本来就红；`library-extraction-panel` 一项全量并发时超时，单独跑 3 次都过，文件未改动。
- 本地真实路径走查（库副本 + 测试响应，后端 18181、前端 3113）：确认提取 → 角色「林夏」关联资产库林夏（资产库图直接采用、显示「全剧 · 已关联资产库」）→ 给林夏上传图（直接采用为第 2 版）→ 场景关联角色被拒（「「林夏」是角色，不能关联到场景「旧书店」」，资产不变）→ 添加道具只勾第 1、3 集（卡片显示「第 1、3 集」）。

## 构建与发布

- 仓外干净工作区 `AIStarEcosystem-release-director`，参数 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。直推 main，没有 CI 结果。
- 制品 SHA-256：`server/app.jar` `6052d7c7cc2c5d2b3d6a49909af563c04dafd792f7e4a02c27a061a774b5b945`（与线上运行一致），`web-aiavatar.tar.gz` `124bb14b40412d10f8adcc1b4f5ec641b0302485548517874d7957867c27d18c`。
- 发布前只读查库：没有进行中的 `ip_run` 和视频任务。server 23:36:48 CST 重启，18.5 秒启动；Flyway 69 个迁移无变化；重启后 0 条 ERROR。`verify.sh` 全绿。

## 线上验收

已登录浏览器只读操作，没有关联、上传或新增任何资产。

- 作品资产页顶部只有「重新提取全剧资产 / 添加资产 / 生成全部参考图」，没有「从资产库导入」。
- 角色「陈砚生」详情：「重新生成 / 关联已有资产 / 上传图片」；形象参考只有「上传」。
- 关联、上传、添加选集的真实写入只在本地验过。

## 回滚

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261026-director-text-model server,web-aiavatar
```

制品在 `AIStarEcosystem-release-director/dist/deploy/`。回滚后旧版不认识 `asset.link`；本版写入的 `libraryObjectId`、`source=library` 候选和 `episodeIds` 旧版都能读。回滚后角色又不能上传，但已采用的上传图仍在。
