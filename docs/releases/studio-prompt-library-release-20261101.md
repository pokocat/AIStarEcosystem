# Studio 提示词库 · 生产发布（2026-11-01）

用户 2026-11-01 确认发布。设计真源 [`docs/studio-prompt-architecture.md`](../studio-prompt-architecture.md)，发布前线上库核对与真模型验收见 [`studio-prompt-library-validation-20261101.md`](studio-prompt-library-validation-20261101.md)。

## 用户能看到的变化

- AI 视频页的编导：素材那一行不再出现尖括号占位；价格、优惠、截止时间写进台词，画面里不再安排字幕、价签和文字特效（H3 改写会把画面里的字原样译过去，成片就冒字）；必填信息没给时写【待补】。
- 画布出图和导演台出图换成仓库里的新包装（见下「线上行为变化」）。
- 管理后台「平台 › 提示词与技能」（原「Studio 技能」页）能按分层（底座 / 环节 / 方法 / 场景）看和改提示词，能按调用点预览拼出来的样子；旧「Prompt 管理」里搬走的 8 个键标「已迁走」、2 个标「不再使用」，不能再保存。
- Studio 运营后台场景模板的「要用户给的信息」可以勾「能推断」（痛点、卖点、使用场景这类，没写也不算还缺）。
- 其余对话、画布、导演台的提示词内容和线上一字不差，只是换了存放的地方。

## 线上行为变化：画布出图包装

线上 `prompt_template.dap.ip_canvas_image` 是 2026-09-08 运维脚本写的 v3（`ops:v0.173`），里面写着「只画一个人，不要多视图、不要设定图、不要拼图」。仓库后来改成「按最终指令决定人数、景别、排版和文字」，但线上那一行一直没跟上，导演台的角色设定集（16:9 多视图设定板）也被套着这句话。本次 `stage-image` 不从线上导入这一行，发布后画布出图和导演台出图都用仓库里的新包装。旧行保留在 `prompt_template` 里，不再被读取。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| 构建 main 提交 | `0ffdde36563bed50509ab4275fefb1ce8f9c878c` |
| main 同步 | 分支 `feat/studio-prompt-layers` 先合入 origin/main `bfecfcef0`（企业积分转入，已在线上），快进推到 main，再从仓外干净工作区 `../AIStarEcosystem-release-prompt-library`（detached）构建 |
| 发布包 | `20261101-studio-prompt-library`：server / admin / web-aiavatar / studio-admin |
| 本地生产构建 | 统一队列 `a29050b8e808`，退出码 0；`build-release.sh` 打包阶段按脚本跳过测试（测试已由上面的门禁通过），`build-studio-admin-release.sh` 内 typecheck 与 12 条测试通过 |
| 制品 SHA256 | server JAR `4d862cf5da1383deb0da5447a66035a47118b60dfe34c686141c26450b77cd08`；web-aiavatar `fec20ce9583d8fff40d0964979ab1bbc58f1ac51b512ccebc4bd281d7bfb55ec`；admin `c9e59e0ce47ed0a525f279d56bbdf8dd4090411565088d19cbe9fb7e1b57526a`；studio-admin `2c47d584c9480afccf500af3a9916f6ca3b857602c8088935da5389be97e4447` |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1；mock 与开发登录关闭 |
| 数据库 | 无迁移。启动时提示词库 82 条（底座 2、环节 31、方法 12、场景 37）写进现有 `ip_skill` / `ip_skill_version`，来源 seed |
| 契约核对 | 线上 server `1e3e3f795` → 本次，dto / openapi 只有追加：`PromptTemplateDto.movedTo/retired`、技能后台列表 `layer/kind/target`（提示词库条目没有 `skill`）、run 请求 `scene`、编导 `settingsChanged`、新接口 `POST /admin/studio/skills/preview`。读这些的 admin、web-aiavatar 同包发 |
| 发布顺序 | server 先于 web-aiavatar：新编导页把场景输入放在 run 请求的 `scene` 里交给服务端拼，旧 server 不认这个字段 |
| CI | 直接推 main，现有工作流只在 PR / 手动触发，本次没有远端 CI；不拿本地检查冒充 CI |

## 发布前检查

- 全工作区类型检查、admin 类型检查、接口契约、admin 测试 39 项、web-aiavatar 1571 项、studio-admin 12 项；后端 `**/ipstudio/**/*Test`、`**/enterprise/**/*Test`、`Prompt*Test` 子集退出码 0（统一队列 `6cc39ade2f01`、`38b978f66a92`，补测 `devq run`）。
- 后端全量测试在本机跑不完（见 TODO），本次只跑了上面的子集。
- 合 main 时顺手修了两条 main 上本来就红的测试：`IpRunServiceTest` 没跟上 `require_mirror`（`fa72c50e2`）、顶栏测试的 `next/navigation` mock 缺 `useRouter`（`c5ebee57d`）。只改测试。
- 发布当天线上库复核：10 个相关 `prompt_template` 行和上午核对时相同（`updated_at` 未变），`studio.scene-catalog` 仍没有存过，`ip_skill` 只有 5 个做法、全部 seed；当时没有在途的 `ip_run` 和视频任务。

## 线上验收

时间都是 UTC（本机今天从夏令时切回，北京时间 = UTC+8）。

- **server**：09:04:28 重启，09:04:45 启动完成（16.9 秒），NRestarts=0。启动日志 `[studio-skill] seeded` 82 条、`imported` 0 条（没有从线上导入任何内容，和发布前核对一致）、0 条 ERROR。运行中的 JAR 校验和 `4d862cf5…` 与本地制品一致；`/opt/ai-star-eco/server/release-id.txt`、`release-sha.txt`、`release-manifest.env` 已写成本版（部署脚本不改它们）。
- **数据库**：`ip_skill` 87 行（5 个做法 + 82 条提示词库），全部 `updated_by=seed`；`ip_skill_version` 97 行全部 `source=seed`；5 个做法的当前版本没变（出图 v3、原创创作 v3 已停用、参考视频复刻 v4、写剧本与文案 v1、出视频 v4）。`prompt_template` 里相关行没被写（`dap.ip_canvas_image` 仍是 09-08 的 v3，只是不再被读取）。
- **admin、web-aiavatar**：09:05:35–09:06:13 发布，env-check、verify 均 ALL GREEN。线上包里有新代码：web-aiavatar `/video` 页带 `settingsChanged`，admin 带「已迁走」说明；admin BUILD_ID `sVkYZJipqm2wb-O2uy7Iu`，web-aiavatar `J59UHDq2HLO2udvKgLeHy`。
- **studio-admin**：第一次 09:06:24 发布失败，脚本自动回滚到旧版。原因是包里的目录是 700（在统一队列里构建时 umask 是 077），服务用户进不了工作目录（`status=200/CHDIR`）；server / admin / web-aiavatar 的发布脚本会改权限所以没受影响。把 `deploy-studio-admin-release.sh` 改成解包后统一改为别人可读，用同一个包 09:07:30 重发成功，BUILD_ID `__seETLIjHvlCUmaUQkZA`，包里有「能推断」开关。studio-admin 在 09:06:24–09:06:34 之间约 10 秒不可用。
- **后台页面**（已登录的浏览器，只看不改）：「Prompt 管理 › AiAvatar」8 个键标「已迁走」，打开 `dap.ip_canvas_image` 显示「已经搬到提示词与技能（stage-image）…在这里改不会生效」，保存按钮不可点；「提示词与技能」列出 87 条，打开「AI 视频编导写脚本」点「拼一次看看」（不调模型、不存东西），拼出来的是第 3 版内容：素材行是例句不是尖括号，镜头规则里有「价格、优惠…放进台词说出来」和「没给的写【待补】」。
- **重启窗口**：nginx 17:03:50–17:08:30（北京时间）共 85 个 200、2 个 302、7 个 502；502 都在 09:04:29–09:04:44，6 个是部署脚本探测 `/api/config`，1 个是用户读余额 `GET /api/me/wallet`。前端重启没有 5xx。不称零中断。
- **没验的**：没有在线上真跑一次编导或出图（会花用户积分）；上线后头一批真实请求的效果见 TODO「Studio 提示词库后续」。

## 备份与回滚

- 备份（root-only）：`/opt/ai-star-eco/backups/20261101-studio-prompt-library-20261101T090344Z/`，内有发布前的 `ip_skill`、`ip_skill_version`、`prompt_template` 三张表（`mysqldump --single-transaction`，gzip SHA256 `e63d8b5d…`）和上一版 server JAR（SHA256 `0566a009…`，即 `20261101-enterprise-owner-deposit`）。
- server、admin、web-aiavatar 回上一版：生产机 `/opt/ai-star-eco/releases/20261101-enterprise-owner-deposit`（`1e3e3f795`）。server 和 web-aiavatar 要一起回：新编导页把场景输入放在 run 请求的 `scene` 里，旧 server 不认。
- 只回 server 时，库里多出的 82 条提示词库行旧代码会当成做法去解析、失败后跳过（启动时每条打一行 ERROR，5 个做法不受影响，旧后台技能页会多列出这些条目）。要彻底回到发布前，用备份里的 `ip_skill` / `ip_skill_version` 恢复；恢复会丢掉发布后在后台改过的提示词，先确认没人改过。
- 回滚 server 后画布出图和导演台出图会重新读 `prompt_template.dap.ip_canvas_image` 的 v0.173 旧包装（那一行没动过）。
- studio-admin 回上一版：发布脚本不保留旧目录，要从 `fe4a654ce`（`20261031-studio-admin-scene-brief`）重新构建再发；旧后台保存场景目录会丢掉新加的「能推断」，回滚期间不要在「场景模板」里保存。
- 远端 `/tmp` 暂存已由发布脚本清理；本机构建工作区 `../AIStarEcosystem-release-prompt-library` 保留到下一次发布。
