# Studio 视频节点铺满与抽帧 · 生产发布记录（2026-10-21）

## web 发布 `20261021-studio-video-fit-frames`（2026-10-21 23:50 CST，只发 web-aiavatar）

### 内容（main `13553ee7`，合并 `feat/studio-video-fit-frames`）

- **视频节点按视频比例铺满**（`1c87702f`）：知道真实尺寸的视频节点保宽改高，媒体区超过 640 时连宽度一起缩（不低于 220），比例对上后 `object-fit:cover` 铺满；上传替换、附件 / 素材库导入当场定形；拖大小保持比例，与拖动同一个撤销步骤。图片节点不变。规则见 AGENTS.md「视频节点铺满与抽帧」。
- **抽帧**（同上）：视频节点操作条（第二个主按钮）与右键菜单「抽帧」→ 截首帧 / 截尾帧 / 截当前帧（显示时间）→ 右侧生成连着视频的图片节点。免费、纯前端：经 `fetchAssetBlob` 取 Blob 截帧（线上 OSS 无 CORS），JPEG 走 `uploadImage`；「处理中」占位只是画布本地状态，不写任何任务字段。截到全黑会重试（本地走查见过一次）。
- **右键「素材拆解」点了报错**（`911adaa8`）：菜单是平铺按钮、逐项调 `onClick`，带 `children` 的项没有 `onClick`；拆成「解析视频」「拉片」两项。
- 只改前端：无接口、无迁移，server 不动（仍 `20261021-model-usage-attribution`，`3782da88`）。

### 门禁

- 在 `AIStarEcosystem-main-release`（main `13553ee7`）：`pnpm --filter @ai-star-eco/web-aiavatar typecheck` 通过；`pnpm check:api-contract` `OK.`；web-aiavatar vitest 全量 148 个文件 1142 条，1141 过、1 条失败：`select-field-wiring.test.ts` 报 `apps/admin/src/app/ai/audit/page.tsx`，来自已上线的 `63884b70`，与本次无关（合并前即失败，未在本次修）。
- 本地浏览器走查（开发分支，本地后端 + 复制的开发库）：横屏 1280×720 节点媒体区 318×180、竖屏 720×1280 媒体区 318×565；拖大小 320×218 → 448×289 后撤销 / 重做正常；截当前帧 00:05 生成 720×1280 图片节点、连线与 `origin: derived` 已存；与 ffmpeg 逐帧比对最接近 5.2 秒。

### 制品与发布

```bash
cd ../AIStarEcosystem-main-release
RELEASE_ID=20261021-studio-video-fit-frames NEXT_PUBLIC_ENTERPRISE_ENABLED=1 \
  NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn \
  ./infra/scripts/build-release.sh web-aiavatar
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
  PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-video-fit-frames web-aiavatar
```

- 发布前基线：web-aiavatar `20261021-studio-restore-fix`（`e184a8dd`），server `20261021-model-usage-attribution`（`3782da88`），两者都在 main 里。
- `manifest.env`：`GIT_SHA=13553ee7…`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、`NEXT_PUBLIC_USE_MOCK=0`；包内 `apps/web-aiavatar/server.js` 路径正确。
- `deploy-release.sh` 结束 `[verify] ALL GREEN`；`aistareco-web-aiavatar` 23:50:22 CST 重启、Ready；线上静态包含 `video-frames` / 「截当前帧」/「解析视频」，不再含「素材拆解」；`https://aiavatar.aibuzz.cn/projects` 200。

### 没验证的

- 没有登录线上账号在浏览器里实走（抽帧经线上 OSS 取 Blob、真实视频节点铺满）；演示模式、手机宽度、同时截两张只有单测。

### 回滚

```bash
cd ../AIStarEcosystem-main-release
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
  PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261021-studio-restore-fix web-aiavatar
```

纯前端，回滚无数据影响：已经按视频比例改过的节点尺寸、抽帧生成的图片节点都是普通画布内容，旧版照常显示。
