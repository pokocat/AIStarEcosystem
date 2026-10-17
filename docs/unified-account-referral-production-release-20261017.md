# 统一账号邀请 · 生产发布与验收

2026-10-17 UTC。**本次范围已完成：Studio 品牌邀请页直接短信注册、ID 首次绑定邀请关系、注册后进入 Studio，以及双方邀请视图的真实线上闭环。** 用户已用指定测试手机号亲自完成短信注册；不是固定码、假注册或人工插入关系。

## 当前发布真值

| 项目 | 当前结果 |
|---|---|
| Studio 功能提交 | `9ef94a80`；运营查看保护 `e7a10b83c88fb0c4c14d280d5f36cb2b75ed2753` |
| Studio 发布 | `20261017-direct-sms-e7a10b83`，仅 `web-aiavatar`；包 SHA256 `6d9b0718e3158b9a91e429d8c3f5261c9785a449ed5cee6e3ddee5cb17c7478b` |
| Studio 活跃 BUILD_ID | `tJXpWcGZfAQv1J4jZGcxw` |
| 并行发布兼容 | 干净制品合入原声提取 `f8d8cf1b`，等待其发布完成后再更新 Studio，没有把该功能回退；本任务不再发布产品 server |
| ID 当前代码 | `65798860454adb6443f16e17e818ac685a540ff2`，main；公共邀请接口错误文案不含产品品牌 |
| ID 当前 release | `/opt/aistareco/id-server/releases/20261017-145748/app.jar`；SHA256 `cf1a2ed3521268c62a36d67c9d868db478a5e52ebc625ee911b13f29805c2f46` |
| ID CI | [39042719631](https://github.com/pokocat/aibuzz-id/actions/runs/39042719631)，77 类、543 项，无失败无跳过，含 MySQL/Redis |
| 本地与构建门 | 前端 11 项、共享客户端最终 80 项；全仓 10 个项目类型检查（含 admin）、Java 17 离线编译及 API 契约检查通过；正式 Next 构建通过 |

Studio 真实 API、正式 ID issuer、企业入口开关沿用线上设置，mock/dev-login 关闭；制品排除工作区未提交的页面和图片压缩改动，不含本地身份库或固定码配置。两端官方发布脚本健康检查通过，Studio verify ALL GREEN。

## 真实线上验收

1. 邀请人已有会话打开 `/invitations`，分享地址已改为当前 Studio 域名下 `/invite/{code}`。旧的通用 ID `/i/{code}` 继续独立保留。
2. 匿名邀请页展示真实邀请人“皎洁月轮363”、品牌和创作示意，直接显示手机号、短信验证码表单，没有“接受邀请”中间点击。
3. 向用户指定 `131****6583` 发送真实短信，页面返回发送成功；用户亲自在页面输入验证码完成注册。浏览器落到 `https://aistar.aibuzz.cn/dashboard`，显示实际 Studio 首页。
4. 新身份 UID `CFSZ8MD4PK0ZCZ571XVRJGMWJR`，ACTIVE，手机号已验证。完整手机号账号与 PHONE 凭据各只有 1 份；旧关闭 UID 未复活。产品 JIT 新档案 `07e8cee8-ad5a-4abb-abd7-682354e0514d` 正确映射该 UID，手机号副本及验证标记核对一致。
5. ID 仅有 1 条 `id_referral`，新 UID 的邀请人为 `HRT7W3B8P5ZPX3QHEA0QE1H11M`。邀请人的线上计数 0→1，列表新增“丰饶琴弦001”；被邀请人界面显示“皎洁月轮363”，自己的直属邀请数为 0。
6. 新账号再次生成本人邀请码成功，得到 Studio 品牌链接；复制后用浏览器剪贴板读取并与完整链接精确比对，通过。发布后整页重载，登录与邀请数据保持。
7. 邀请人积分始终为 295；新账号验收时没有钱包行，邀请链未发积分、返佣或手工改动钱包。数据库未人工插入注册关系。
8. 公开预览只返回展示名，`no-store`、精确 CORS 且无 credentials；匿名本人 API 401、非允许来源预检 403、失效邀请 404。最终 ID 失效文案为“这份邀请已失效。”，不含 Studio 品牌。

[生产邀请人视图](prototypes/studio-invitation-live-preview/production-inviter.png)。本地桌面/手机视觉、读取失败和错误验证码状态见[实施对照](prototypes/studio-invitation-design-system-check.md)。老账号不重绑、并发唯一关系、运营查看状态不发码/不注册等由对应自动化覆盖；不把这些全部表述为生产短信重复注册实测。真实微信网关与跨设备扫码不在本次短信交付范围内。

## 既有产品开通策略（独立于邀请）

验收新用户在产品侧产生了五个 `ACTIVE/GRANT_ALL` 开通。原因是现网既有 `aep.platform.dev-grant-all` 默认策略（env 未显式覆盖），由产品 JIT 执行；邀请代码没有新增或调用开通逻辑。本任务没有改变该策略、产品 server 配置或钱包。因而“邀请不赋予产品权益”指邀请事实与 ID 写入边界，不能据此误称当前现网普通新用户不会被产品既有策略自动开通。

## 备份、配置与回退

- root 私有备份 `/var/backups/aistareco/invitation-direct-sms-20261017`：修改前 ID SQL/JAR/客户端清单；注册完成后另存 `id-after-registration-before-neutral.sql`，SHA256 `591f64530f070885878a8fe11a53194681f76e37d76e28c26e715478a8ec8c61`。
- 无新迁移，沿用 V12。外部客户端全集仅给 `web-aiavatar` 增加现有 SMS grant，scope/audience/其他客户端和密钥不变；清单 SHA256 `776a8d89fd38367ad6150c5884fddffef4bdeace057d54826da38292250f48df`。
- ID env SHA256 `d03e634c2bc49621600a374fd8ed1d849642d42930370793f9848becb9e4284a`、Studio env `6a1eeaa79b4901093887b41b7a00756fbb4eaefdae9da60c093daf26d1cf3c89`，与发布前一致。未新增产品机器客户端运营查询权限。
- 如需回退，使用官方脚本重发保留的、包含原声功能的前端制品；ID 公共预览与 SMS grant 向后兼容，无需回退 V12 或删除任何注册/邀请事实。不得通过删除本次用户或关系冒充回退。
- 本地持久 ID 已同步新接口与客户端授权并重新就绪；现有 dev 账号 UID 保持。生产代码与原仓未提交资料编辑改动分别构建/保留。

## 首版历史记录（以下为当时状态，不代表当前状态）

2026-10-17 UTC。**ID 与 Studio 首版已提交、推送并发布，但线上首次注册闭环尚未完成验收。** 用户指出通用 ID 邀请页脱离 Studio，当前按“先设计”要求，先审阅 [Studio 品牌邀请页](prototypes/studio-invitation-design.md)；应用入口与认证回跳修正尚未发布。不能据本记录宣称整体功能已通过用户验收。

### 发布真值

| 项目 | 结果 |
|---|---|
| ID 代码 | `e473022454b42ed1327eb87a52460a9d53c68f5f`，已推送 `pokocat/aibuzz-id` 的 `main` |
| ID CI | [39033506944](https://github.com/pokocat/aibuzz-id/actions/runs/39033506944)，对应上述 SHA，success，含真实 MySQL |
| ID 当前制品 | `/opt/aistareco/id-server/releases/20261017-124839/app.jar`；SHA256 `d8e909740e5c6151d4342d9b9fbc0acb76e371b0d4918e477a03ba8751322bfe` |
| ID 数据库 | V12 `success=1`，V11 保持成功；`id_referral` 建成，首版检查 0 条关系 |
| Studio 代码 | `d88e94a5b3c94ddf0bec671d3988ee495f47d768`，已推送 `codex/unified-ip-studio` |
| Studio 制品 | release `20261017-invitations-d88e94a5`；包 SHA256 `1f266bd2d76b5fa1f94df3b473d32884fac53db4b07bb78b8fbd7dca980acac9` |
| Studio 活跃构建 | `/opt/ai-star-eco/web-aiavatar/apps/web-aiavatar/.next/BUILD_ID` = `a-WP7MVR-pVTA2PHoQnkT` |
| 发布范围 | 只发布 ID、web-aiavatar；未发布产品 server、admin 或其他产品应用 |

ID 使用干净提交 worktree 构建，排除原仓已有资料编辑改动。Studio 使用独立干净 worktree 正式构建；`NEXT_PUBLIC_AUTH_MODE=id`、正式 ID issuer、mock/dev-login 关闭，包内没有 `.env`、本地身份数据或 fixture。

### 备份与运行检查

发布前在服务器 root 私有目录 `/var/backups/aistareco/invitations-20261017` 备份身份库、旧 JAR 与旧 Studio 包。完整 SQL 备份为 `id-before-v12.sql`，SHA256 `ffe24e5cd94929182b015335fed2ee9a2bb2bc9267a42b47a6e9ee5b1b714bac`，完成标记存在。应用数据库账号无 event 导出权限，首轮部分文件单独标记为 `.partial.sql`，随后使用本机 root 权限完成全量逻辑备份并清理不完整文件；未将部分文件当成可恢复备份。

跨迁移发布关闭自动旧 JAR 回滚。首次 SSH 传输遇到默认网络接口超时，服务尚未切换；随后通过本机 `en0` 重新执行官方发布脚本成功。ID、Studio 均 active，发现文档 issuer 正确。Studio 发布自检 ALL GREEN，包含站点路由、其余服务 active、产品 API、CJK、sau health 和 nginx 配置。

生产 env、外部客户端清单均未修改，发布前后校验一致。未为普通产品机器客户端添加 `referral.read`。

### 已完成的线上验证

- 正式 `https://aistar.aibuzz.cn/invitations` 页面可打开，现有账号真实显示昵称和余额。
- 使用既有本人会话生成邀请码，ID 落库；页面显示真实邀请人数 0、空邀请人和空直属记录。生成前后页面余额均 295，没有邀请奖励或消费。
- 点击复制显示成功反馈；Chrome 自动化的 clipboard 读取返回空，故未把该读取作为剪贴板内容通过的证据。
- 匿名访问邀请码落地页显示正确邀请人，接受后注册页显示该邀请上下文。
- 匿名本人邀请 API 返回 401 JSON；无效公开邀请码显示“邀请链接暂不可用”，不展示假关系。
- 部署后只读复查：一个邀请码、0 条邀请关系，未伪造生产注册或关系数据。

### 指定测试账号处理

用户明确要求释放 `131****6583` 以重新注册。先核对 ID 原 UID `0ZZ4D69GS11Q1WWPW7TBRVPMP3` 与唯一产品链接，并完成上述备份，再执行限定该 UID、手机号和 ACTIVE 状态的维护事务，遵循既有注销语义：CLOSED、归档凭据并让号、撤销 OAuth 授权、抬高凭据水位、写持久/Redis denylist、广播和定向 `USER_CLOSED`。此处是授权维护事务，并非声称调用了不存在的管理端注销 API。

核验手机号占用和精确手机号凭据均为 0，ID 用户总数保持 30，原账号行与产品数据保留。两个注销事件获发布序号 33、34；产品已消费，旧本地账号为 DELETED/CLOSED。不手改钱包、开通、作品或其他账号。最后只读检查尚未用该手机号完成新注册。

### 待完成

1. 审阅本次 Studio 品牌邀请页设计。
2. 正式分享地址改为 Studio 应用入口，ID 仍保存邀请与绑定规则；通过正常认证流程返回 Studio，不能接受任意回跳地址。
3. 更新两边应用并完成真实短信首次注册，核对新 UID、唯一邀请关系、Studio 邀请人/计数与已有账号不重绑。
4. 真微信网关和真实跨设备扫码验收仍未完成；本地测试不替代生产证明。
