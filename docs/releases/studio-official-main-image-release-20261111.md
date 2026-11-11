# Studio 选用官方人物主图发布

2026-11-11 12:57:57–12:58:17（北京时间）发布 `20261111-studio-official-main-fa3104e6`，范围为 `web-aiavatar`。构建使用 `main` 提交 `fa3104e6c7a36ea61cd03ad4de0280d772a6aa78`，线上后端继续运行 `20261111-recreation-checks-e39e8776`。

AI 图片和 AI 视频的「官方形象」按人物展示。选中免费人物后点击「使用」，每人带入一张主图。需要授权的人物在选择框中不可选用。

## 构建与发布

- Mac mini 隔离快照通过全工作区类型检查、管理端类型检查、后端编译、接口契约扫描及选择框 12 项测试。正式包从干净的 `main` 快照构建。
- `web-aiavatar.tar.gz` 的 SHA-256 为 `313fa7f2196806ba5ac9ad42090b038cb465968cad53a511ac952ffcf0b89189`。线上包校验通过，运行中的 `BUILD_ID` 为 `WgGnSDEWEJVBBDqnqnaiO`。
- `env-check` 和 `verify.sh` 均为 `ALL GREEN`。Studio 的 `/image`、`/video`、`/assets` 和 `/api/config` 均返回 200。`aistareco-web-aiavatar` 已就绪，后端进程自北京时间 07:46:09 持续运行。

## 线上验收

- 在资产页记录 Annie 安妮的主图、右侧脸和左侧脸，确认三张图的路径各不相同。
- [AI 图片](https://aistar.aibuzz.cn/image)「参考图」中，安妮仅有一张人物卡。选中后点击「使用」，参考图位显示一张已加载的图片，路径与官方主图一致。
- [AI 视频](https://aistar.aibuzz.cn/video)「角色」中，安妮仅有一张人物卡。选中后点击「使用」，角色位显示安妮，图片路径与官方主图一致。确认选择按页面原有流程自动创建验收草稿 `IPP-b6777e8a`。两处均未提交生成。

## 回滚

Studio 前端可使用生产发布 `20261110-official-avatars-3992f750` 的 `web-aiavatar.tar.gz` 回滚，发布目标仍为 `web-aiavatar`。
