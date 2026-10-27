# 视频提示词优化独立绑定修复（2026-10-27）

已发布 `20261027-video-prompt-binding`，范围 `server,admin`。正式制品从干净的 `main` 提交 `956960227cd8355add1d74c8f36d7cd027c42691` 构建；修复提交 `bed1f20b`，配套迁移提交 `95696022`。未发布 web-aiavatar，原工作区与既有 main 工作区的未提交内容均未改动。

## 故障与最终行为

截图任务 `IPR-814fe90307104842bec2`、logId `RRWXLKJXF89Q` 的优化调用实际走 Studio 剧本默认 DeepSeek Flash，4096 completion tokens 耗尽且正式 content 为空，finish_reason=length。任务未提交 H3；冻结的 275 积分已释放，持久化 cost=0。

画布和创作助手原先取剧本默认模型；导演台原先跟随作品文字模型。现在三处都通过现有 `AiAppBinding` 能力解析独立用途 `DAP_VIDEO_PROMPT`（后台显示“视频提示词优化”），不跟随用户文字模型，也不跟随 Studio 剧本默认值。端点未绑定、停用或未配置 Token 售价时明确报错，不回落其他模型。普通文字任务保留原有模型选择。

运行代码不固定 Qwen 端点 ID。V69.1 迁移仅首次将新用途绑定到现存、启用的 `ai-studio-jusuan-qwen38`，并确保候选记录；已有绑定不覆盖。以后后台绑成哪个端点就用哪个。报价、冻结、付款授权、输出预算、实际结算读取同一绑定及其费率，受理时保存用途和端点快照；已受理旧任务继续按原用途处理。后台 AI 模型管理的 AiAvatar / AI IP 工作台分组已加入这个用途，调用统计也按该用途归属 AiAvatar。

## 迁移与检查

- 新 Java 迁移 `V69_1__video_prompt_binding`，Flyway 版本 69.1：显式扩展 MySQL 两张绑定表的 native ENUM，初始化绑定及候选。现存工作区有未提交 V70，因此使用 69.1，不修改任何既有迁移。H2 测试确认版本识别、幂等和保留后续后台改绑。
- 相关服务端回归 86 项通过，新增迁移测试 1 项通过，共 87 项；覆盖画布 review、助手 auto、导演台、改绑后的端点与费率、不可用时不扣费、普通文字模型选择和优化交接。
- `pnpm typecheck:all`、`pnpm typecheck:admin`、Java 离线编译、API 契约通过；server 与 admin 正式构建通过。
- 初次隔离构建因沙箱 Maven 缓存权限和 Turbopack 拒绝工作区外依赖链接失败；正式构建使用独立依赖副本，源代码与 main 均保持干净。

## 制品、备份与生产验收

| 项目 | 结果 |
|---|---|
| server/app.jar SHA-256 | `1b55e25e7bf37117e4d33ad6777290e5572c9479fd68c511418843e1c56863e9`，与线上运行文件一致 |
| admin.tar.gz SHA-256 | `038fbaf35da8aeb0c009252564c35e055adfe93e9f21c19ab52c55a88127a7c8`，与线上发布库存档一致 |
| 生产制品目录 | `/opt/ai-star-eco/releases/20261027-video-prompt-binding` |
| 发布前备份 | `/opt/ai-star-eco/backups/20261027-video-prompt-binding`：server-before.jar、admin-before.tar.gz、binding-before.tsv |
| 在途检查 | 备份前 ip_run 无 running 任务 |
| Flyway | 2026-10-27 16:18:09 CST，69.1 success=1，执行约 0.095 秒 |
| 新用途绑定 | `DAP_VIDEO_PROMPT → ai-studio-jusuan-qwen38 → qwen38-27b`，端点和候选均启用 |
| 服务 | server / admin active/running，NRestarts=0；后端约 17.6 秒启动，无新增 ERROR |
| 后台资源 | 公网 `/admin/_next/static/chunks/0zzz0.vyhnwsl.js` 可读取且包含 `DAP_VIDEO_PROMPT` |
| 健康检查 | 生产主机 LOCAL_MODE=1 执行 verify.sh：公开首页、登录、API、后台登录，以及所有服务、nginx、本地 API 均 ALL GREEN |
| 原故障任务 | 仍为 failed，cost=0，未重提 |

本机运行的发布附带 verify 因公网路由请求超时返回 FAILED；随后在生产主机执行同一脚本，公网与本地检查全部通过，未把本机超时当成线上故障。

### 重启期间 HTTP

从生产主机每秒探测公网 API `/api/config` 和后台 `/admin/login`，共 150 组样本：

- API：首次 502 为 16:17:34.269 CST，最后一次 502 为 16:18:21.626，16:18:22.695 恢复 200；46 个 502 样本，约 48 秒中断。
- 后台登录：16:18:05.531 一个 502 样本，16:18:06.595 恢复 200。
- 恢复后持续为 200。当前仍为单实例重启发布，不能称为发布期间无中断。

## 验收边界与回滚

未重放原故障用户的提示词，也未发起真实 H3 视频或修改原任务。自动审批拒绝了“解密生产密钥并将原任务输入重放给外部 Qwen”的操作，因此本次验收包含回归测试、真实生产绑定/迁移/制品/健康证据，未包含原提示词的真实 Qwen 改写与付费出片。

需要回滚时使用备份 JAR 与 admin 压缩包恢复相同服务；枚举扩展为增量变更，不缩减 ENUM，不修改用户资产或积分记录。新用途绑定可保留以便后续恢复修复版；如需撤销初始化配置，先核对 binding-before.tsv，且不得覆盖发布后运营主动做的改绑。
