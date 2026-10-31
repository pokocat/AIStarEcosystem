# Studio 修复独立补验收（2026-10-27）

Codex 按用户要求操作真实浏览器页面，对 Claude 的修复补验收。**本轮已执行的检查通过，未发现新的阻塞缺陷。** 这份记录不将 Claude 的既有测试写成本轮独立实测，也不将本地模拟供应商写成真实模型效果验收。

## 版本和环境

- 前端源码：`AIStarEcosystem-director-storyboard` 的 `41616a36b45668ee46185716ef983be2018d5fcb`，修复代码来自 main `4a9b5f18266b3bfe85c812d22cbb4be68ebda14d`。
- 后端：发布包 `20261027-studio-error-dialogs/server/app.jar`，SHA-256 `cc629262c733145876c7556fb3a9fec75ece792decea8bcf243a8f70c5ee3e5b`。本次先前已独立核对生产服务、制品和远端 main。
- 真实 Chrome 页面，本地前端 `3313` → 同一发布 JAR `18381` → 独立 H2 文件库；桌面 1440×900、窄屏 375×812。
- 本地只使用可丢弃的作品、企业和开发账号。真实 worker 调用本地 HTTP 图片供应商，人工控制完成时机，供应商仅返回固定测试图片，不转发外部请求。
- 新建空 H2 时既有 Flyway 迁移依赖尚未创建的表，因此本地库改用 Hibernate 建表、关闭 Flyway。**本轮不验证迁移，也不代表生产 MySQL 和 OIDC 流程重验。** 该版本本身没有新增迁移。
- 本轮没有发起生产写操作、真实模型或真实付费请求。图片任务仅消耗本地测试钱包积分。

## 本轮独立页面实测

| 场景 | 实际操作与结果 | 证据 |
|---|---|---|
| 删除仍被片段引用的资产 | 资产详情显示 3 个引用片段；点击删除弹错误对话框，列出引用和下一步 | [桌面截图](studio-independent-acceptance-20261027/01-asset-delete-blocked.jpg) |
| 从错误进入引用处 | 点「前往」后关闭错误框，切换对应集和片段，打开关联资产并高亮目标 | 同一测试作品的页面操作 |
| 分镜图生成中解除关联 | 从真实页面提交图片任务，真实 worker 进入本地供应商等待；桌面和窄屏实际确认解除，服务端均返回 409，页面弹「分镜图正在生成」错误；关联、候选和视频数据保持不变 | [桌面](studio-independent-acceptance-20261027/02-image-running-unlink-refused.jpg)、[窄屏实际重试](studio-independent-acceptance-20261027/03-image-running-refused-mobile.jpg) |
| 生成结束后解除关联 | 释放本地供应商，任务完成；再从页面解除成功。片段 cl7 仅去掉 as4，as5/as6 顺序不变，两个分镜图候选保留，采用检查为 `outdated`（解除前也已是此状态）；其他片段不变 | [解除后截图](studio-independent-acceptance-20261027/05-image-complete-unlink-success-mobile.jpg)、[状态摘要](studio-independent-acceptance-20261027/evidence.json) |
| 其他片段仍引用时删除 | 回到资产页再次删除，同一资产仍被余下两个片段阻挡，引用数量更新正确 | [截图](studio-independent-acceptance-20261027/06-other-references-still-block-delete.jpg) |
| 企业设置真实冲突（桌面） | UI 编辑并发上限为 3；通过另一个请求把服务器改为 2；UI 保存收到真实 `ENTERPRISE_VERSION_CONFLICT`，显示一个错误弹窗，输入 3 保留。关闭后重新读取为 2，改为 3 保存成功，GET 验证 version=2 | [冲突](studio-independent-acceptance-20261027/07-enterprise-real-conflict-desktop.jpg)、[重试成功](studio-independent-acceptance-20261027/08-enterprise-retry-success.jpg) |
| 企业设置真实冲突（窄屏） | 同样制造真实冲突，输入保留；重新读取后修改保存，GET 验证上限 4、version=4。弹窗 x=8、宽 359，无横向溢出 | [窄屏截图](studio-independent-acceptance-20261027/09-enterprise-real-conflict-mobile.jpg) |
| 长摘要展示、编辑和保存 | 使用 647 字、9 段摘要；页面追加保存标记后为 659 字、10 段，接口核对全文和换行。桌面为多行输入并允许滚动，窄屏实际滚到底，看见最后一段 | [桌面](studio-independent-acceptance-20261027/10-long-summary-desktop.jpg)、[窄屏编辑](studio-independent-acceptance-20261027/11-long-summary-mobile-editable.jpg)、[窄屏末尾](studio-independent-acceptance-20261027/12-long-summary-mobile-tail.jpg) |
| 整集/单片段重写入口 | 分镜页整集重写框和单片段重写确认框均可打开；范围、已有素材影响和「按实际用量结算」说明可见；取消正常 | [整集入口](studio-independent-acceptance-20261027/13-episode-rewrite-entry.jpg) |
| 一键制作已有脚本时的反馈 | 选择「分镜脚本」，估价返回后显示全部 2 集已写好，说明只补缺失内容、重写入口在哪里；不显示无意义预算，「前往分镜」可关闭弹窗并回到分镜页 | [截图](studio-independent-acceptance-20261027/14-oneclick-no-work-feedback.jpg) |

分镜图生成中拒绝解除的窄屏弹窗宽 359、x=8，正文和按钮可见；摘要窄屏输入宽 298，scrollHeight=835、clientHeight=323，实际滚至底部。摘要采用限定高度后滚动的多行输入，不是无限撑高。

## 既有证据与本轮边界

- Claude 的[本地完整验收记录](../releases/director-error-dialog-unlink-validation-20261027.md)包含创作页、画布模板保存、自动保存后台提示、素材文件夹、IP 设定和手机充值错误等逐页检查；这些没有在本轮再次全部重放。
- Claude 的[生产记录](../releases/director-error-dialog-unlink-production-release-20261027.md)包含线上导演台真实编辑冲突、项目列表桌面和窄屏真实 404。它们属于已有验收证据。本轮另行尝试项目页复验，但本地 Next 首次编译持续较慢，未计为通过项。
- 本轮补齐此前缺少真实页面证据的「分镜图生成中解除被拒」和企业页冲突恢复；前者通过真实任务、真实 HTTP 供应商等待和真实后端状态验证，后者通过真实版本冲突和重新保存验证。
- 整集/单片段重写本轮只验证入口和确认说明，没有再次调用真实文本模型；真实文本模型调用见 Claude 原有分镜重写验收记录。真实供应商输出质量、真实视频生成不在本轮通过项内。
- 修复已由 Claude 合入 main 并发布；本轮没有新增功能代码，也没有再次发布。原工作区既有未提交内容保持原状。

截图均为本地测试账号及本地测试作品。状态摘要不包含访问令牌或真实供应商密钥。

验收后已停止本轮专用前后端与图片供应商，确认 3313/18381/18390 不再监听；恢复 Next 开发启动自动改动的 tsconfig，删除临时登录令牌。修复工作区保持干净。
