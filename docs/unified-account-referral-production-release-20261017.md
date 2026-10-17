# 统一账号邀请 · 首版发布记录

2026-10-17 UTC。**ID 与 Studio 首版已提交、推送并发布，但线上首次注册闭环尚未完成验收。** 用户指出通用 ID 邀请页脱离 Studio，当前按“先设计”要求，先审阅 [Studio 品牌邀请页](prototypes/studio-invitation-design.md)；应用入口与认证回跳修正尚未发布。不能据本记录宣称整体功能已通过用户验收。

## 发布真值

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

## 备份与运行检查

发布前在服务器 root 私有目录 `/var/backups/aistareco/invitations-20261017` 备份身份库、旧 JAR 与旧 Studio 包。完整 SQL 备份为 `id-before-v12.sql`，SHA256 `ffe24e5cd94929182b015335fed2ee9a2bb2bc9267a42b47a6e9ee5b1b714bac`，完成标记存在。应用数据库账号无 event 导出权限，首轮部分文件单独标记为 `.partial.sql`，随后使用本机 root 权限完成全量逻辑备份并清理不完整文件；未将部分文件当成可恢复备份。

跨迁移发布关闭自动旧 JAR 回滚。首次 SSH 传输遇到默认网络接口超时，服务尚未切换；随后通过本机 `en0` 重新执行官方发布脚本成功。ID、Studio 均 active，发现文档 issuer 正确。Studio 发布自检 ALL GREEN，包含站点路由、其余服务 active、产品 API、CJK、sau health 和 nginx 配置。

生产 env、外部客户端清单均未修改，发布前后校验一致。未为普通产品机器客户端添加 `referral.read`。

## 已完成的线上验证

- 正式 `https://aistar.aibuzz.cn/invitations` 页面可打开，现有账号真实显示昵称和余额。
- 使用既有本人会话生成邀请码，ID 落库；页面显示真实邀请人数 0、空邀请人和空直属记录。生成前后页面余额均 295，没有邀请奖励或消费。
- 点击复制显示成功反馈；Chrome 自动化的 clipboard 读取返回空，故未把该读取作为剪贴板内容通过的证据。
- 匿名访问邀请码落地页显示正确邀请人，接受后注册页显示该邀请上下文。
- 匿名本人邀请 API 返回 401 JSON；无效公开邀请码显示“邀请链接暂不可用”，不展示假关系。
- 部署后只读复查：一个邀请码、0 条邀请关系，未伪造生产注册或关系数据。

## 指定测试账号处理

用户明确要求释放 `131****6583` 以重新注册。先核对 ID 原 UID `0ZZ4D69GS11Q1WWPW7TBRVPMP3` 与唯一产品链接，并完成上述备份，再执行限定该 UID、手机号和 ACTIVE 状态的维护事务，遵循既有注销语义：CLOSED、归档凭据并让号、撤销 OAuth 授权、抬高凭据水位、写持久/Redis denylist、广播和定向 `USER_CLOSED`。此处是授权维护事务，并非声称调用了不存在的管理端注销 API。

核验手机号占用和精确手机号凭据均为 0，ID 用户总数保持 30，原账号行与产品数据保留。两个注销事件获发布序号 33、34；产品已消费，旧本地账号为 DELETED/CLOSED。不手改钱包、开通、作品或其他账号。最后只读检查尚未用该手机号完成新注册。

## 待完成

1. 审阅本次 Studio 品牌邀请页设计。
2. 正式分享地址改为 Studio 应用入口，ID 仍保存邀请与绑定规则；通过正常认证流程返回 Studio，不能接受任意回跳地址。
3. 更新两边应用并完成真实短信首次注册，核对新 UID、唯一邀请关系、Studio 邀请人/计数与已有账号不重绑。
4. 真微信网关和真实跨设备扫码验收仍未完成；本地测试不替代生产证明。
