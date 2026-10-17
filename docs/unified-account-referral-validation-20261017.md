# 统一账号注册邀请 · 本地实施与验收

> 本文保留 2026-10-17 发布前的本地验证事实；后续两仓已配套发布并完成真实短信注册闭环，最新状态见[生产发布与验收](unified-account-referral-production-release-20261017.md)。本文末尾“Studio 应用内视图增量”是最新范围，替代早期仅跳转入口的边界。方案见 [v0.5](unified-account-referral-plan.md)，页面见 [前端设计](unified-account-referral-frontend.md)。

## 实施范围

| 位置 | 实际改动 |
|---|---|
| `../aibuzz-id` | V12 邀请码/邀请表；新建 UID 同事务写入；短信、微信网页、公众号扫码及小程序 grant 传递；本人查询、运营专用查询；账号入口与两类邀请页面；本体定义与映射 |
| `apps/web-aiavatar` | `AccountOverview` 在统一账号模式下增加“邀请朋友”，地址由共享 issuer 配置生成，打开中心 `/account/invitations` |
| 本仓后端 | 无邀请逻辑、接口或迁移；现有企业邀请、开通、积分不改动 |

邀请码按需生成，一名新注册账号最多一位原始邀请人。没有登录后补绑接口；已有账号正常登录不会新增关系。换绑和合并不改写邀请边，不合计“有效团队”。分佣、奖励、图形运营页及全生态可视化仍属后续能力，没有收益占位数据或提现入口。

本体已定义 `Account` / `RegistrationInvitation` / `registrationInvitedBy` / `mergedInto`；实际事实仍存 MySQL/H2 的一张关系表，本期没有 RDF 实例库、推理或第二份图存储。Turtle 经 rdflib 解析通过，共 37 条定义三元组。

账号仓原先已有资料编辑相关未提交改动，本轮保留；邀请功能仅在账号概览插入独立分区，不把原有资料调整算作本轮功能。

## 自动测试

账号仓使用 Java 17、现有 Maven `full-test` 配置和真实 Testcontainers MySQL 8.0.36 / Redis 7。未改依赖版本或放宽测试门禁。

1. 全量执行 `./mvnw -q -Pfull-test test -Dapi.version=1.44`，覆盖 77 类 543 项。初轮仅一条旧的 MySQL 外键数量断言失败：新表正确增加两个外键，旧断言只允许原三项。
2. 更新断言以验证新增邀请双方外键，并将真实机器令牌的 `referral.read` 签发与查询加入邀请专项；最后仅定向复测 `ReferralTest,MySqlSchemaIT`，29 项全部通过。
3. `scripts/check-test-reports.py` 汇总同一工作区测试报告：**77 类、543 项，0 失败、0 错误、0 跳过**。这是全量执行加定向复测后的累计结果，不宣称再次重复跑了全套。

| 测试 | 结果与覆盖 |
|---|---|
| `ReferralTest` | 15 项；真实注册事务、无邀请码/失效码、旧账号不改绑、会话及双标签页隔离、CSRF、短信表单/OAuth 换令牌、微信网页/扫码与两种 grant、专用权限、并发与合并历史 |
| `MySqlSchemaIT` | 14 项；V12 真 MySQL 迁移/validate、二进制排序、双方外键、并发首登与邀请失败整体回滚，以及原有模式检查 |
| `RedisKeyValueStoreIT` | 9 项，真实 Redis CAS/计数/退票 |
| `RedisHttpSessionIT` | 1 项，真实会话存储及跨重启恢复 |
| 其他账号回归 | 现有登录、授权、资料、绑定、合并、注销与限频等回归无失败 |

全量初次尝试还遇到宿主默认 JDK 25 与既有 Mockito 兼容问题、Docker API 协商问题；最终按项目要求切换现有 JDK 17，指定本机 OrbStack socket/API 后执行，无需修改项目依赖。

Studio 入口通过 `pnpm --filter @ai-star-eco/web-aiavatar typecheck`。邀请/登录脚本的 `node --check`、部署脚本 `bash -n`、两仓 `git diff --check` 均通过。Studio 本次只有配置派生的外链，未重复构建和全仓运行无关用例。

## 真实页面

使用本地账号中心 `http://localhost:18090`，dev H2 与日志短信网关，合成账号；无真实短信、付费调用或生产数据写入。

- 账号概览能发现“邀请朋友”；本人首次访问没有隐式生成邀请码。
- 点击生成后得到固定本人链接；点击复制后检查剪贴板内容与页面链接一致，显示真实成功反馈。
- 主动退出后打开公开链接，能看到邀请人、统一账号用途、记录规则及普通登录入口。
- 点击/键盘确认后进入现有登录表单，邀请人提示保留；完成新账号注册后，页面回显“注册完成，邀请关系已记录”。
- 受邀者“我的邀请人”显示原邀请人和时间；原邀请人重新登录后显示 **1 条**直接受邀记录及对方昵称、时间。
- 自己打开本人链接显示“这是你自己的邀请链接”；不会出现第二次接受或补绑动作。
- 390px 和 320px 下本人记录页的 `documentElement.scrollWidth == innerWidth`；390px 公开落地页同样通过。长链接仍在可选中的只读框中，窄屏复制按钮独占一行。
- 临时禁用 JavaScript 后，邀请链接、邀请人、记录和手动复制说明仍可见；复制按钮隐藏。接受/生成/分页使用服务端表单和链接，不依赖客户端保存关系。键盘确认已实际通过。

截图均为真实本地页面：

| 页面 | 证据 |
|---|---|
| 桌面 · 邀请人查看新增记录 | [截图](validation/account-referrals-20261017/desktop-records.jpg) |
| 390px · 本人邀请记录 | [截图](validation/account-referrals-20261017/mobile-records.jpg) |
| 320px · 受邀者查看邀请人 | [截图](validation/account-referrals-20261017/mobile-inviter.jpg) |
| 390px · 公开邀请落地页 | [截图](validation/account-referrals-20261017/mobile-landing.jpg) |

## 后续发布边界

当前只交付本地工作区。真实微信授权使用现有假网关作服务端回归，尚未用真机微信/生产 appid 验收；Safari、Firefox 未单独验收。Studio 的实际 OIDC 跨应用回跳和生产入口需部署配套中心后验证，本轮没有把类型检查表述为真实跨应用验收。

发布时先确认对应提交的 CI，备份身份库并迁移 V12，按运营需要在外部客户端清单显式授予 `referral.read`，然后发布中心与 Studio 入口。旧产品的 `product.link` 不因此获得邀请链读取权。V12 不允许只换回旧 JAR 作为回滚。生产上线、提交/推送不在本次操作范围。

## Studio 应用内视图增量（2026-10-17）

按最新要求，Studio 已从单纯跳转扩展为应用内邀请管理。前文“Studio 只有外链”“实际 OIDC 跳转未验收”仅描述首次实现，此节取代这两项范围限制；生产发布和真微信仍未执行。

### 已实现

- `/invitations` 使用现有账号工作区，桌面侧栏/账号总览与手机“我的”均有“邀请朋友”入口。
- Studio 内展示邀请链接、本人邀请人、直接受邀记录、真实总数和时间；支持生成、复制、预览、刷新及服务端分页。已有记录不可在应用内改绑。
- `InvitationApi` 使用共享 `idApiFetch`，带当前用户令牌直连固定 ID issuer；不经过产品 API，不发送产品头或 Cookie。401 复用既有单次刷新；暂时刷新失败保留令牌，旧登录/附身状态不发送不适用令牌。
- ID 的 `Overview` 增加 `canInvite`，由 ID 依据账号现状决定；应用据此显示操作，写接口继续校验。无新接口、迁移或新表。
- 邀请是账号级能力，`useRequireAuth` 可关闭产品开通检查，此页只检查登录，不请求产品开通后才展示邀请记录。
- 读取失败有重试，刷新失败保留上次列表，复制失败选中链接供手动复制；没有假空态、临时邀请码或收益配置。

链接管理本次为生成、复制、预览；停用/重置没有纳入实现，分佣与奖励仍属后续业务能力。前端承载管控界面，规则、操作权限和存储继续归 ID。

### 本轮验证

| 检查 | 结果 |
|---|---|
| Studio 前端回归 | 100 个文件、778 项通过，含邀请视图 8 项和账号级登录守卫检查；收尾空态文案修改后只复测邀请视图 8 项，通过 |
| 共享 api-client | 7 个文件、77 项通过，含 ID 与产品请求隔离、Cookie/请求头、刷新重放、临时刷新故障、旧模式/附身和请求路径保护 |
| ID 专项 | `ReferralTest` 15 项通过，含普通账号/体验账号 `canInvite` 返回；本轮无迁移变更，因此未重复真 MySQL 全量 |
| 编译与契约 | `pnpm typecheck:all`、`pnpm check:api-contract`、Studio 生产构建通过，制品包含 `/invitations` |

真实浏览器使用现有本地持久化 ID 8098、产品后端 18080 和隔离 Studio 3016，无生产操作、真实短信或模型消费：

1. 从 Studio `/invitations` 发起真实 OIDC+PKCE，使用既有本地账号登录后回到同一路由，正确读取本人 ID 邀请数据。
2. 在 Studio 内显式生成邀请码，复制后核对剪贴板与真实 ID 分享地址一致，预览页显示正确邀请人。
3. 受邀合成账号在中心接受并完成日志短信注册，中心反馈“邀请关系已记录”；Studio 原账号刷新立即读取到 **1 条**记录，昵称/时间来自 ID。ID 浏览器会话切到受邀者时，Studio 的本人 Bearer 查询仍只返回邀请人自己的记录，符合无 Cookie 的接口约定。
4. 邀请人产品积分在操作前后均显示 **1,500**，未修改产品余额、开通或资料。
5. 390px、320px 下 `html[data-layout=mobile]` 且 `scrollWidth == innerWidth`；复制与预览并列、只读链接独占一行，记录可换行。手机返回“我的”后可找到同名邀请入口。

截图：[Studio 桌面](validation/account-referrals-20261017/studio-desktop.jpg)、[390px](validation/account-referrals-20261017/studio-mobile-390.jpg)、[320px](validation/account-referrals-20261017/studio-mobile-320.jpg)。页面时间按当前浏览器本地时区显示，此次为 America/Los_Angeles；中心旧模板的固定时区不作为邀请记录的存储真值。

临时浏览器视口已恢复，Next 自动加入的验收专用 tsconfig 路径已清理。生产仍需先发布 ID API，再发布 Studio 前端，并做真实域名/CORS、微信与存量账号验收。
