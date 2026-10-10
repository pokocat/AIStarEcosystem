# AiAvatar 账号与旧 Studio 界面统一

v0.230 · 2026-10-10。目标是让桌面账号管理和画布属于同一个产品，保留已接通的资产业务与真人确认回调。

`/me` 现在是账号总览，使用当前登录身份，提供积分、存储、资产任务和账号安全入口。账号工具共享工作台顶栏、192px 导航和白色内容区，采用现有 Studio 色彩。旧 Studio 的 480px 手机取景框及分步流程说明已删除；手机仍使用原有布局。

| 入口 | 行为 |
|---|---|
| `/studio`、`/#studio` | 转到 `/projects` 自由画布 |
| 旧 `#/home`、`#/library`、`#/me`、`#/licenses` | 分别转到 `/dashboard`、`/assets`、`/me`、`/licenses` |
| `/studio#/tasks`、`membership`、`storage`、`realmaterials`、`trash`、`settings`、`security` | 在共享账号外壳内打开原业务内容，菜单选中同步 |
| `?start=sheet|real|ai|compose`、`?create=1` | 保留创建流程参数 |
| `#/real-auth/{sessionId}` 与资产详情深链 | 原样保留并恢复原流程 |

旧 SPA 的内部导航发布事件更新外壳；外部 hash 变化和浏览器前进后退恢复实际目标页。账号工具的根返回进入 `/me`，创建流程仍保持原上下文。回调与创建参数不参与旧根入口重定向。

会员页继续使用现有 AccountApi/WalletApi：正式模式不展示静态演示订阅套餐，套餐查询有加载、空列表、失败重试状态；无选中套餐时不能充值。积分政策、支付通道和账本未改变。

本地验收使用真实隔离后端，账号总览、菜单切换/选中、浏览器前进后退、根返回、两个旧 Studio 入口、真人创建入口及 707px 强选桌面形态通过；36 项入口/布局定向用例、工作区类型检查、后台类型检查、后端离线编译和 API 契约通过。桌面首轮视觉检查后统一修正一次并完成确认，未反复出图。证据在忽略目录 `.studio-e2e/account-unification/`。

边界：这是外壳与入口整合，未重写全部 proto 业务页面。任务中心仍展示资产生成任务，画布任务在各画布历史中。旧设置中的部分开关没有持久化，旧 AccountDto 的 PRO 标签仍来自后台固定值，已记录 TODO；不把它们描述为本轮实现的新功能。发布结果追加至 `docs/ip-studio-production-release.md`。
