# Studio 图片输入上限与运营发布模板（2026-11-04）

状态：已生产发布 `20261104-image-prompt-operator-template`，范围 `server,web-aiavatar`，构建自干净的 main `e1605fd34fd4a51c5f8e2796c83bca47162f434e`。用户指定账号已在生产通过后台「平台运营」设为 OPERATOR；发布后再次只读核对为 OPERATOR / ACTIVE。

## 规则

- AI 图片场景页「补充要求」从 500 字放宽至 3000 字，计数与提交校验同步；完整描述和自由出图仍遵循所选模型限制。
- 运营和超级管理员可从本人画布的「更多 → 存为官方内容」发布版本化官方模板，所有用户可查看。
- 发布入口、表单可见范围与 `POST /v1/ip-studio/projects/{id}/template-versions` 均使用运营权限。普通用户保留个人模板；停用账号不能通过消费者登录态发布官方模板。
- 沿用本人画布、本人模板更新、不可变版本、媒体归属与快照复制规则。旧全局示例、封面、上下架及删除维持各自原权限。

## 验证与发布

- 本机验证通过 devq 串行执行，任务 `ef38975122a1`，退出码 0。workspace（串行）及 admin 类型检查、Maven 离线编译、API 契约检查通过；契约工具保留既有缺 handler / 孤立路径提示。
- 后端 44 项测试通过、0 失败/跳过：发布 HTTP 权限 7 项（真实 InAppOperatorGuard，含 ACTIVE 运营/超管放行，普通/停用/不存在账号拒绝，个人模板保留），模板服务 17 项，官方内容管理 13 项，角色闸门 7 项。前端发布弹窗、管理页、入口连线共 18 项通过。未调用供应商、未提交真实官方模板。
- main `26791494f` 的 3000 字调整与 `e1605fd34` 的运营发布权限一起发布。devq 构建任务 `c4ceb7d4075b` 退出码 0，生产前端构建及制品校验通过。仓库打包脚本以 `-DskipTests clean package` 打包后端，本次未重跑已通过的上述测试；未以跳过测试的打包代替验证。
- 发布前 server 为 `20261104-inspiration-hover-video`（`c3dc6750b`），web-aiavatar 为 `20261104-director-split-preview`（`44edadaeb`）。从该服务端提交到本次变更前 main 无 DTO/OpenAPI 差异；本次契约仅更改模板发布角色与错误码，没有删改响应字段。
- 按用户「现在就发」指令执行。13:13:40 UTC 重启前再次检查，排队/运行中的 `ip_run`、素材视频任务、生成队列均为 0。13:16:02 / 13:16:03 UTC 两个服务进入 active；后端 13:16:21 UTC 启动完成。

## 线上验收与制品

- `deploy-release.sh` 退出码 0，运行配置预检与 `verify.sh` 均 ALL GREEN。首页、登录、图片页、项目页、`/api/config` 均 HTTP 200；后端本机 API、nginx 配置及相关服务检查通过。
- server 与 web-aiavatar 均 active/running、NRestarts=0、ExecMainStatus=0。线上 JAR SHA256 与本机制品一致：`926440da06410bd6152b991cf5e2016b9546242ea11871701e79526e25be0f71`。
- web-aiavatar tar SHA256：`b5090af15df18ddc7eabd97f0ce58358a49dd7611fa47c20f26efca5740409c7`。本地与线上 BUILD_ID 均为 `2B9YJjH-WzzAZ_OtqidSB`。
- Chrome 新标签打开线上 `/image?scene=ip-sheet`，已登录页面显示「补充要求」与 `0 / 3000`，无须重新登录。未提交付费生成。
- 运营权限由前述真实 HTTP 角色回归、实际部署 JAR 哈希与编译字节码的 `InAppOperatorGuard.require` 调用、线上账号 OPERATOR / ACTIVE 三处核对。未使用目标用户真实登录态公开发布客户画布。
- 从 nginx access.log 第 2475978 行起统计至 13:17:29 UTC：148 个 200、13 个 502、1 个 401、1 个 308；502 首末为 13:16:03–13:16:21 UTC。历史区间可检出 4472 个 5xx，确认统计规则有效。旧 JVM 1343752 在关闭期间有 1 条响应已提交的 error-page ERROR；新 JVM 1504388 的启动及恢复检查通过。此次单实例重启有短暂中断，不能描述为无停机发布。
- 本地制品保留于 `dist/deploy/20261104-image-prompt-operator-template`，生产保留于 `/opt/ai-star-eco/releases/20261104-image-prompt-operator-template`。回滚分别使用上述两个上一版服务的 release 制品，通过 `deploy-release.sh` 选择对应服务执行。
