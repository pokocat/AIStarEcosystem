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

边界：这是外壳与入口整合，未重写全部 proto 业务页面。任务中心仍展示资产生成任务，画布任务在各画布历史中。旧设置中的部分开关没有持久化，旧 AccountDto 的 PRO 标签仍来自后台固定值，已记录 TODO；不把它们描述为本轮实现的新功能。发布结果追加至 `docs/releases/ip-studio-production-release.md`。

已部署 `20261010-v0230-account`，代码 `379bb440c0d26bf9bf02f1757379a83d7febb6a1`。生产 HTTPS 验收通过，真实充值套餐可见，浏览器脚本错误为零，没有提交充值或模型任务。临时 QA 账号的旧自动月度赠送通过管理端账本调整收回，余额/冻结归零，账号软删除并撤销开通；详情见生产发布记录。

桌面顶栏追加可用积分入口，使用钱包 `totalBalance`，不含冻结余额，不调用旧 AccountApi。页面可见时每 15 秒更新，恢复焦点/页面变化同步刷新；网络错误明确展示并支持重试，加载期间不假设余额为 0。数据仅在内存展示，不写本地缓存；切号/卸载后旧响应丢弃。读取复用既有接口，不更改计费或账本。

## 默认头像与用户修改（2026-10-31，已发布）

注册账号没有自定义头像时，Studio 自动展示 `react-notion-avatar` 的随机默认头像。随机 UID 的完整值作为固定种子（优先 `identityUid`，旧账号回退本地 `id`），同一账号刷新、重新登录、换设备、改昵称都保持相同形象；缩短后的展示 UID 不参与生成。已注册但没有头像的用户也使用相同规则，不批量写入或覆盖账号中心资料。

桌面账号菜单、手机底栏与桌面/手机「我的账号」共用 `AccountAvatar`。`/api/me.avatarUrl` 的自定义头像优先；图片无法加载时回退本账号固定默认头像，未读到身份时使用中性图标。

「我的账号」头像旁的「修改头像」在新标签页打开账号中心既有 `/account/profile`。上传、保存、移除及图片校验仍由 ID 完成；返回 Studio 时只刷新一次 OIDC 资料快照，再作废共享 `/api/me` 缓存，使所有头像同步更新。退出或切号取消等待，旧刷新结果不能影响新会话。演示、旧登录及运营查看状态不显示本人修改入口。

库的 MIT 发布运行时代码保留在 `src/vendor/react-notion-avatar`，与产品适配代码分开；避免安装上游误列在运行依赖中的演示应用及 React 17。此功能没有新服务端路径、数据库迁移或注册写操作。

本地验证：110 项定向及共享界面回归用例、全部工作区串行类型检查（含两个后台）、后端离线编译、API 契约和 web-aiavatar 生产构建通过。无头 Chrome 走查桌面旧版、桌面新版及 390px 手机：默认图跨位置一致、刷新不变、修改入口和键盘焦点可用、返回刷新一次、已有上传图优先且刷新保留、移除后回到原默认图、无页面脚本错误。浏览器使用合成账号与 API 响应，只验证 Studio 消费及返回同步；未重新实测 ID 的真实上传保存、短信注册或生产环境。截图与结果保存在忽略目录 `.studio-e2e/account-avatar-20261031/`。

合并验收（2026-10-31）：以 main `f7f1c12bf` 为基线合入头像功能 `9cd42307`，同时保留新版侧栏、视频/图片场景浮层及现有资产页。21 个文件的 129 项回归、全部工作区串行类型检查、后台类型检查、后端离线编译、API 契约与 Studio 生产构建通过；该次只合并，功能随后随 `20261101-studio-director-spec` 上线。

头像外观修正（2026-10-31，已发布）：人物配置保持原样，底色统一为浅灰 `#f3f4f6`。顶栏与侧栏头像按按钮内容区铺满，用单层细边框；移除旧昵称字母的尺寸规则，避免 34px 头像撑大 30px 内容区后向右下溢出。键盘焦点仍使用工作台原有焦点样式。

外观验收：24 项相关用例、应用类型检查和生产构建通过。生产构建页面的浏览器实测中，修正前侧栏头像圆心相对按钮向右、向下各偏 2px；修正后桌面旧版、新版和 390px 手机均为 0px，背景统一、键盘焦点可见，页面脚本错误为零。截图与测量保存在忽略目录 `.studio-e2e/avatar-alignment-20261031/`。

同次小修保留轮播圆点 7px/选中胶囊 18px 的样式，只对底色做过渡，取消宽度动画，避免切换示例时逐帧触发布局；没有添加检测忽略规则。

生产发布：从干净的 main `0921222f6` 构建 `20261031-studio-avatar-polish`，只更新 web-aiavatar。线上桌面旧版、新版与 390px 手机的头像圆心偏差均为 0px，浅灰底和键盘焦点生效，页面脚本错误为零；发布样式中的圆点为 7px/18px、仅过渡底色。验收使用合成账号 API 响应加载真实线上前端，未操作真实用户资料或付费生成。制品与服务核对见[发布记录](releases/studio-avatar-polish-release-20261031.md)。

## 账号区新版（2026-11-09，已生产发布 `20261109-account-pages-e978bfce`）

按「账号页新版设计稿」把电脑版「我的账号」和 `/studio#/<页>` 的账号页换成新版设计语言（白底、冷色细线、渐变主按钮），不再把旧 SPA 页面套进外壳。

- **外壳**：`src/shell/account-workspace.tsx` 的 `AccountShell`。电脑版是账号卡（头像、昵称、手机号、可用积分、模型赠款、充值）+ 页内标签；左边只留全站导航栏，原来 192px 的账号菜单去掉。手机版是返回栏 + 标题，返回「我的」。邀请页（`/invitations`）仍用 `AccountWorkspace` 这个名字，标签不高亮。
- **标签**：总览、会员与积分、任务历史（原任务中心）、存储用量、真人授权素材、回收站、设置与安全（原「设置」与「账号与安全」合并，`#/security` 也进这一页）。「邀请朋友」「企业积分」从总览进入。
- **页面**：`src/account/*`，`/studio` 遇到上面这些哈希直接渲染新页面；数字人详情、创建向导、刷脸回跳等其余哈希照旧交给旧 SPA，外框不变。给指定真人补素材 / 授权用 `/studio#/create/real/<人物 id>`（旧 SPA 新增的冷启动入口），添加新真人用 `/studio?start=real`。
- **任务历史**：新接口 `GET /api/v1/ip-studio/task-history`（`StudioTaskHistoryService`），把画布、AI 图片 / 视频、导演台、对话（IpRun）和数字人任务（DapJob）按时间合并；每条的积分读 `IpProjectService.toRunDto` 已有的 breakdown，分出已扣、其中模型赠款、待结算和已退回，不新增计费口径。画布上的图片、视频、配音、口型任务和数字人任务可在这里取消（已提交给模型的由接口拒绝并说明原因），数字人失败任务可重试；导演台、对话、写作任务只给「查看」，回原处用各自的停止流程。
- **存储用量**：新接口 `GET /api/v1/ip-studio/storage`（`StudioStorageService`），数字资产按表实时求和（`DapAccountService.storageMb`，与旧页同一份计算）+ 通用存储统计（app=aiavatar 与 studio）；上限读通用存储的 aiavatar 配额，含已购扩容。`FileStorageService` 从这次起把 `ipstudio/gen`、`ipstudio/source` 文件记进统计；历史文件在用户第一次打开存储用量时按资产库补记（`StudioStorageBackfill`，只加统计记录）。后台配了存储空间套餐才显示「购买存储空间」。
- **回收站**：数字人（恢复、彻底删除、30 天清理）、导演台作品和画布（恢复、彻底删除；彻底删除只删作品 / 画布本身，生成记录和文件保留在资产库）。画布接口 `GET /projects/trash`、`POST /projects/{id}/restore`、`DELETE /projects/{id}/purge`，导演台 `DELETE /director/works/{id}/purge`。到期自动清理和存储上限拦截都已实现、默认关闭（`aep.ipstudio.trash-retention-days`、`aep.ipstudio.storage-enforce`），页面按 `GET /trash/policy` 显示实际规则。
- **会员与积分**：充值套餐（存储空间套餐单列）、模型赠款（剩余 / 总额 / 到期）、充值记录（`/api/me/wallet/recharge/orders`，前端只留 aiavatar 发起的）。不再显示后台写死的 PRO 标签和「本月已用」（后者只算数字资产任务）。
- **设置与安全**：生成付款账户改成三个选项卡片（同一套 `studio-billing-preference`）；头像昵称、手机号、微信、密码、注销都跳账号中心对应页面；旧的本产品登录密码表单不再出现。

验证：Mac mini 上 web-aiavatar 与 types 类型检查、契约检查、`src/account`、`src/shell`、`src/app/me`、邀请页共 13 个测试文件 93 项通过；后端新单测 `StudioAccountHistoryTest` 6 项通过。演示数据下在 1440 和 375 宽度逐页看过；再用本地开发库副本（283 条真实生成记录）起真后端，在浏览器里走过任务历史的状态筛选与翻页、画布删除后在回收站恢复、存储用量、付款账户和总览。走查中发现视频任务按「失败」筛不出（状态取自视频子任务），已改为按显示状态筛选。

补充验证（同日）：真后端打开 `aep.ipstudio.storage-enforce` 并把 aiavatar 配额设为 49 MB（已用 49 MB）时，上传图片返回 402 `STORAGE_QUOTA_EXCEEDED`；配额改回 5,120 MB 后同一张图上传成功。画布彻底删除：未进回收站时 409，删除后回收站清空、再恢复 404，任务历史条数不变。

## 账号区第三版：合并页面与统一路由（2026-11-10，本地未发布）

用户要求：没更新设计的页面都按新版做；生成原文这类页面不单独成页；组织方式重排、路由统一；任务历史去掉「已退回」。设计稿「账号页新版设计稿」最下面一行「账号区（三）」。

**7 个标签，地址都在 `/me` 下面**（`shell/account-navigation.ts` 的 `ACCOUNT_PAGES`，页面在 `src/account/account-page.tsx`）：

| 标签 | 地址 | 内容 |
|---|---|---|
| 总览 | `/me` | 账号卡、近 30 天消耗、存储、生成中、最近任务、邀请朋友卡片、资产与名片入口 |
| 任务历史 | `/me/tasks`（`?status=running`、`?raw=all`） | 全部生成任务和消耗；文字任务「查看原文」；「全部原文」按时间看 |
| 积分 | `/me/credits` | 充值、模型赠款、充值记录（原「会员与积分」，没有会员等级，改名） |
| 存储 | `/me/storage`、`/me/storage/trash` | 子标签「用量」「回收站」 |
| 授权 | `/me/authorization`、`/ip`、`/stars` | 子标签「真人授权」（原真人授权素材）、「IP 授权登记」（原授权中心里非真人的那部分）、「明星形象授权」（原授权中心「授权给我的」） |
| 企业 | `/me/enterprise` | 原 `/enterprise`，只在 `NEXT_PUBLIC_ENTERPRISE_ENABLED=1` 时显示 |
| 设置 | `/me/settings` | 设置与安全 |

**合并掉的页面**：
- 生成原文 `/model-results` → 任务历史里的抽屉（`account-model-results.tsx`）。V80（Java 迁移：表由 Hibernate 建，空库跳过）给 `ai_model_usage_record` 加 `task_id`，任务执行时从 `AiModelUsageContext` 记下 IpRun / DapJob 的 id；任务历史接口的 `hasModelResult` 标出哪些任务有原文，`GET /api/me/model-results?taskId=` 按任务取。V80 之前的原文没有任务编号，只能在「全部原文」里按时间看，所以这个入口要留着（模型原文保留规则，AGENTS.md 开头）。
- 邀请朋友 `/invitations` → 电脑版是总览上的卡片 + 邀请记录抽屉（`/me/invitations` 打开总览并展开抽屉），手机版 `/me/invitations` 是一整页。逻辑仍在 `ip/invitation-workspace.tsx`（`useInvitations` + 链接 / 记录两个组件），不以本产品开通为条件。
- 授权中心 `/licenses` → 「授权」的两个子标签。原来真人证书在授权中心和真人授权素材两处都列，现在按真人 / IP 分开，不重复。
- 我的名片 `/cards` → `/assets/cards`（名片按人物发布，归资产）。

**旧地址**：`/studio#/membership|tasks|storage|trash|realmaterials|licenses|settings|security` 由 `/studio` 页转到新地址，带上原查询参数（支付回跳的 `rechargeOrder` 不丢）；`/invitations`、`/enterprise`、`/licenses`、`/model-results`、`/cards`、`/cards/:id/edit` 在 `next.config.mjs` 永久重定向。对外分享的 `/invite/{code}`、`/enterprise/invite`、`/card/p/…` 地址不变。

**「已退回」**：任务历史每条不再写「已退回 N」，顶部去掉「退回积分」；失败且没扣的写「未扣积分」。企业消费流水的「已结算，多余积分已退回」改成「已结算」。冻结后没用完的部分本来就没扣，写「退回」会让人以为先扣了又退。接口里的 `released` 字段保留，前端不再显示。

验证：Mac mini 上 web-aiavatar 类型检查、接口契约、7 个前端测试文件 35 项、后端 `StudioAccountHistoryTest`、`ModelOutputArchiveIntegrationTest`（新增按任务查原文的用例）、`ModelOutputArchiveTest` 通过。演示数据下在电脑版和 375 宽度走过总览、任务历史（查看原文、全部原文）、存储两个子标签、授权三个子标签、旧地址 `/studio#/trash`、`/studio#/membership`、`/licenses` 的跳转。没有用真后端走「查看原文」（需要 V80 之后产生的任务），也没有在统一账号模式下看邀请卡片。
