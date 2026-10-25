# TODO 已关闭段归档

> 从 [`TODO.md`](../../TODO.md) 整段移来的「已全部完成」段落（段内没有任何 `- [ ]`）。条目原样保留、按原顺序排列，只是不再占待修清单的版面；要查某个修复的来龙去脉仍以这里和 [`VERSION_HISTORY.md`](../VERSION_HISTORY.md) 为准。整理日期：2026-10-18。

## 2026-10-07 · v0.200 接手整合

- [x] ~~名片资产归属遗漏（写入 + 存量公开读）~~ **v0.200 完成，2026-10-07**：CardService 同时校验 avatar、嵌套 key 与旧 URL，新增跨用户与公开读回归。
- [x] ~~混剪下载保护不完整~~ **v0.200 完成，2026-10-07**：AssetDownloader 拒绝任意本地路径、逐跳检查重定向、固定已校验 DNS；MixcutRenderingService 校验资产归属、路径穿越和符号链接。测试不访问真实内网。
- [x] ~~发布重试升级兼容旧冻结~~ **v0.200 完成，2026-10-07**：V38 显式补 retry_count；0 次仍使用裸 jobId，重试才加 :rN；成功/失败旧回调和迁移幂等测试覆盖。
- [x] ~~受保护视频镜像失败空成功、DAP 提交前派发~~ **v0.200 完成，2026-10-07**：整合 #126/#107 有效修复及回归测试。
- [x] ~~开放 PR 分散、冲突及测试基线不同步~~ **v0.200 完成，2026-10-07**：本地整合 #101/#102/#106–#114/#122/#126/#127；#124 被共享 Storage 设置覆盖；保留旧 worktree 未提交内容。部署结果另以实际 release 为准。


---

## 2026-10-03 · 例行 QA 巡检

- [x] ~~**发布任务重试免费（revenue loss）**~~ **2026-10-03 完成**：`PublishJobService` 的 hold / commitHold / releaseHold 四处都用裸 `job.getId()` 当 CreditHold referenceId，而 `CreditService.hold` 以 `(referenceType, referenceId)` 幂等、对已存在的终态 hold 也直接返回不再扣。失败 → `releaseHoldOnFailure` 把 hold 置 RELEASED；用户重试（`POST /me/publish/jobs/{id}/retry` 或批量 `retryFailedBatch`）复用同一行 → `startJob` 的 hold 命中已 RELEASED 的终态 hold → 扣 0 分，随后 LIVE 的 commit 因 hold 终态抛 409 被 catch 吞掉 → 重发免费。修复：`PublishJob` 加 `retryCount`（v0.200 由 V38 显式补列，存量 0），首次继续用裸 `jobId`（兼容旧在途冻结），重试用 `jobId:r{retryCount}`，`retry()` 先自增，与 DapJob 的 `:rN` 一致；回归测试 `PublishJobServiceTest#retryMintsFreshHoldReferenceSoItChargesAgain`。

## 2026-09-17 · 例行 QA 巡检（商品链接抓取 SSRF：白名单只卡初始 URL、重定向照跟）

> 本轮同样承接 #102 分支、不新开 PR。开工前查了三仓开着的 routine PR（本仓 #101 SSRF /
> #102 合集；ai-pilot #50；shequn-gongju 无），复用 #102。用三个子代理对三仓做对抗式复核：
> shequn-gongju 基本全是静态原型、无可达缺陷；后端 money/auth/幂等面已被历轮打磨得很干净，
> 仅落一处新确定缺陷（下）。ai-pilot 侧另落两处（settleVideoJob/httpTool，见 PR #50）。
> 验证：`./mvnw compile` 绿。

- [x] ~~**Medium：抖音商品链接抓取的 SSRF 白名单被重定向绕过**~~
      （**完成**，2026-09-17）：`DouyinHtmlScrapeHandler` 的 `HttpClient` 建成
      `followRedirects(NORMAL)`，而 host 白名单（`*.douyin.com` / `*.jinritemai.com`）**只校验了
      初始 URL**。任一认证用户 `POST /api/me/products/parse-link` 传一个白名单域上的开放重定向
      链接，服务端就会跟着 302 去请求任意 host —— 例如 `http://169.254.169.254/…`（云元数据）
      或内网服务；抓回来的 `og:*` / 图片字段还会部分回显进 `ProductLinkInfoDto`，非全盲。
      与 #101 的 mixcut `AssetDownloader` SSRF 是不同站点（那条是 file_url 零校验，这条是
      重定向绕过白名单）。修法：`HttpClient` 改 `Redirect.NEVER` + 手动逐跳跟随
      （`getFollowingWhitelistedRedirects`），**每一跳的目标 host 都重新过白名单、协议必须
      http(s)、跳数上限 5 防环**——既堵住 SSRF，又保留抖音短链常见的一两跳合法重定向
      （直接 NEVER 会让合法短链解析失败）。`fetchPromotionDetail` 的固定可信 URL 也改走同一
      漏斗做纵深防御。`./mvnw compile` 绿。

---

## 2026-09-20 · 例行 QA 巡检（bugfix）

- [x] ~~**DAP 异步作业在事务提交前就派发 worker**~~ **完成，2026-09-20**：
      `DapJobService.submit` / `retry` 直接 `runner.run(id)`，而 `DapJobRunner.run` 是
      `@Async`（真线程池 `dapJobExecutor`）。被 `@Transactional` 的 `DapCompositionService.create`
      / `DapAssetService.generateScene|sceneVariants|generateProduct|productAngles` 调用时，
      worker 在自己的新事务里 `findById` 查这条尚未提交的作业（生产 MySQL READ_COMMITTED）
      → `job == null` 静默退出，作业永远停在 running、冻结积分等 180 分钟兜底才回收。改成
      `TransactionSynchronizationManager` 有活跃事务时挂 `afterCommit` 派发、否则当场派发
      （范式同 `MaterialVideoJobService` / `IpRunService`）。回归 `DapJobDispatchTest`（有事务→afterCommit 才派、无事务→当场派）。
- [x] ~~**短剧首帧任务卡把带 TTL 的签名 URL 原样返回（§4.7.7）**~~ **完成，2026-09-20**：
      `DramaFrameJobService.toFrameTask` 把 `resultJson` 里的 `frames[].url`（1h 签名）
      原样透到 wire，一小时后任务卡首帧预览 403 图裂。加 `CdnUrlSigner` 依赖，在出 wire 前
      对 result 递归 `maybeSign`（范式同 `DramaProjectService.resignAssetUrls`）。

## 2026-08-29 · nginx 443 vhost 补齐（v0.136）

- [x] ~~仓库 `infra/nginx/` 缺 music / drama / aiavatar / star 的 443 SSL example~~（**v0.136 完成，2026-08-29**）：新增 `{music,drama,aiavatar,star,celebrity,api}.aibuzz.cn.ssl.conf.example` 六份；前五份的 `server` 块与线上 `/etc/nginx/conf.d/` 对应文件逐字节一致（已 diff 校验），七份合起来过 `nginx -t`（docker nginx:1.27-alpine）。`infra/README.md` 新增 **§5.1「每子域必须同时有 80 和 443」**（含 443 默认站机制、线上 vhost 清单、泛域名证书副本台账、新增子域 checklist + 实测过的验证脚本），`docs/INDEX.md` last-reviewed 同步。
- [x] ~~**`api.aibuzz.cn` 缺 443 vhost（线上仍存在的同类 bug）**~~（**完成，2026-09-06**：已装 `api.aibuzz.cn.ssl.conf`，`https://api.aibuzz.cn/api/me/profile` 实测直通 8080 返回 401 后端 JSON，不再 302 到 /admin）：`aistareco.conf:151` 只有 80 block，`https://api.aibuzz.cn/` 落到 443 默认站 admin 并 302 到 `/admin`（2026-08-29 实测 `curl -sI https://api.aibuzz.cn/` → `location: https://api.aibuzz.cn/admin`；`http://` 为 404 属正常，命中 server 根路径）。修法：装 `infra/nginx/api.aibuzz.cn.ssl.conf.example` 到 `/etc/nginx/conf.d/api.aibuzz.cn.ssl.conf` 后 `nginx -t && systemctl reload nginx`。**修好前不要把 `https://api.aibuzz.cn` 用作支付/短信回调地址或小程序 request 合法域名。**
- [x] ~~**泛域名证书 5 处副本目录**（2026-11-08 到期前必须处理）~~（**完成，2026-09-06**：drama / celebrity / admin / aistar 四处配置已改指 `/etc/nginx/certs/aibuzz.cn/`，只剩非本仓的 `bossclub.aibuzz.cn.conf` 还引用副本；续期脚本 `deploy-to-ecs.sh` 同时覆盖真值目录与全部 5 个副本）：`/etc/nginx/ssl/{admin,aistar,bossclub,drama}.aibuzz.cn/` 与 `/etc/nginx/certs/celebrity.aibuzz.cn/` 存的是与 `/etc/nginx/certs/aibuzz.cn/` **完全相同**的证书副本（md5 一致，非独立签发），线上 `drama.aibuzz.cn.ssl.conf` / `celebrity-ssl.conf` / `admin.aibuzz.cn.ssl.conf` 仍指向各自副本。续期若只换 canonical 目录，这几个域会继续用旧证书直到过期。修法二选一：把线上配置改指共享路径（仓库 example 已收敛），或让续期脚本覆盖全部 6 个路径。
- [x] ~~清理 `infra/nginx/{star,aistar}.aibuzz.cn.conf.example` 两份历史「80+443 单文件」example~~（**完成，2026-09-06**：不是删除而是扶正 —— 线上 `aistar.aibuzz.cn.conf` 已补齐 `/api/` `/static/` `/cdn/` 并改指共享证书，`star.aibuzz.cn.conf` 改成纯 80 跳转，两份 example 重新与线上逐字节对齐，README §5.1 的「勿再安装」警告已撤销）。原描述：其 443 块缺 `/api/` `/static/` `/cdn/` 三个反代（装上去前端能开但接口全 404），且引用的 `/etc/nginx/ssl/star.aibuzz.cn/` 线上并不存在。已在 README §5.1 标注「勿再安装」，待确认无人引用后删除。
- [x] ~~`aibuzz.cn` 顶级域从 ECS 本机与本地 curl 均 `000`~~（**审计确认，2026-09-06**：本机 DNS 确实被代理劫持到 198.18.0.0/15，绕开后用 `--resolve` 与 DoH 复验，`aibuzz.cn` 的 A 记录与 vhost 均正常，非线上缺陷）。原描述：本地 DNS 被 VPN 劫持到 198.18.0.0/15，未能确诊，**与本次 443 改动无关**，需在干净网络下复验 DNS A 记录与安全组。

## 2026-07-07 · 例行 QA 新发现（均已同轮修复，非遗留待办，留痕备查）

> 本轮复核了 PR #81（遗留 `apps/web` 三处 `window.confirm()`，已携带进本轮）+ 四个专项 agent 交叉审计
> （credit-ledger bypass / hold-commit-release、`/api/me/**`+`/api/star/**` 归属校验、CDN URL 签名、
> `?? ""` 掩盖 + 原生 confirm/alert/prompt）。归属校验与 `?? ""`/原生弹窗两类**审计后确认无新增问题**
> （见 PR 描述）。以下三条是本轮新发现且已在同一 PR 内修复：

- [x] ~~**`MaterialVideoJob.videoUrl`/`thumbnailUrl`/`lastFrameUrl` 从落库那刻就未签名**~~（**已修复**，2026-07-07）：`AliyunOssCdnUploader.upload()` 返回的是未签名 `publicUrlFor(key)`，`MaterialVideoJobService.toCard` 此前原样透传出 wire，从未经过 `CdnUrlSigner`——生产 driver=oss 且开启防盗刷签名时不是 1h TTL 过期才裂，而是从生成那一刻起就 403（AGENTS.md §4.7.7 同类教训，本条之前没堵上）。改为 `toCard` 对三个字段调 `CdnUrlSigner.maybeSign`（URL 反抽 key 重签，同 DramaProject/DramaShort 已有兜底路径），未新增列。回归测试 `MaterialVideoJobServiceCdnSignTest`。注：本条之前在 §4.7.6「local-only 字段迁移」列表里被记成「待迁移到 OSS」，实际当时已经在传 OSS（`mirrorToCdn` 真调用了 `cdnUploader.upload`），真正的洞是「传了但没签」，描述口径已更新。
- [x] ~~**`StoreService.redeem` 绕开 `CreditService` 手写钱包扣款**~~（**已修复**，2026-07-07）：手写 `walletRepo.findByUserIdForUpdate → setXxxBalance → save`，虽用了悲观锁 + 服务端权威价（未被并发/定价漏洞利用），但违反 AGENTS.md §4.2 硬规则且复制了扣桶优先级逻辑，与 `CreditService` 产生维护漂移风险。改为 `CreditService.debit` 新增的 entryType 可选重载（默认 ADJUST，原 3 个调用方行为不变），`redeem` 传 SPEND，语义等价。回归测试 `StoreServiceRedeemTest`。
- [x] ~~**`/api/store/items/**`（商店购买）缺显式 `authenticated()`**~~（**已修复**，2026-07-07）：同 F-01（2026-07-05 修的 `/api/settings/**`）一样落 `anyRequest().permitAll()` 兜底，`StoreController#redeem` 未登录会 NPE 500 而非干净 401。只收紧 `items/**`（写路径）；`/api/store/catalog` 保持 permitAll（`StoreController#catalog` 显式支持匿名浏览，收紧会破坏既有设计）。

---

## 2026-07-10 · 例行 QA 新发现（5 处，均已同轮修复）

> 本轮未发现历史遗留的 open routine QA PR 需要承接（`[Routine QA]` 标题 / `qa/routine/` 分支前缀均搜索为空，上一轮 #85 已合并入 main）。独立审计发现并修复以下 5 处：

- [x] ~~**`CreditService.commitHold`/`releaseHold` 用无锁查询读 `CreditHold`，与 `CreditHoldSweeper` 的清扫竞态可导致双重退款 + 账本终态被覆盖**~~（**已修复**，2026-07-10）：两方法都用 `CreditHoldRepository.findByReferenceTypeAndReferenceId`（普通派生查询，无 `@Lock`）读 hold，再单独对 `Wallet` 行加悲观锁——但 hold 行本身没锁。`CreditHoldSweeper` 是 `@Scheduled` 任务，专门清扫超 180 分钟 TTL 的 `ACTIVE` hold，与业务方几乎同时对同一 hold 调 `commitHold`/`releaseHold` 时（sweeper 判定「孤儿」的窗口本就贴着「任务可能仍在跑」的边界），两个事务可能各自读到同一份 `status=ACTIVE` 的旧对象；先提交的一方把 hold 置为终态（COMMITTED 或 RELEASED），后到者仍持有陈旧的内存对象，在 wallet 锁释放后基于旧状态继续操作——`releaseHold` 会把已经 `commitHold` 完成的任务再退一次款（用户白嫖），且把 hold 状态从 COMMITTED 覆盖回 RELEASED（账本审计链损坏）。修复：给 `CreditHoldRepository` 新增 `findByReferenceTypeAndReferenceIdForUpdate`（`@Lock(PESSIMISTIC_WRITE)`，与 `WalletRepository#findByUserIdForUpdate` 同一模式），`commitHold`/`releaseHold` 改用锁版查询，且在获取 wallet 锁之前先锁 hold 行（锁顺序 hold→wallet 两方法一致，不与仅锁 wallet 的 `hold()` 创建路径产生环路，无死锁风险）。回归测试 `CreditServiceHoldLockTest`（3 例：commit/release 均改走锁版查询且不再调无锁版；模拟锁串行化后重读 COMMITTED 状态时 release 正确 no-op、不重复退款）。
- [x] ~~**`GET /api/admin/users/{id}/wallet` 缺失 `@PreAuthorize`，任意 OPERATOR admin 可读取任意用户钱包**~~（**已修复**，2026-07-10）：与 2026-07-09 刚修的 `AdminCreditController` 是同一 bug class，只是换了一个 controller——`AdminUserController.getWallet` 只受 `/api/admin/**` 的 `hasAnyRole("SUPER_ADMIN","OPERATOR")` 兜底保护，未收紧到 `FINANCE_ADMIN|SUPER_ADMIN`。虽然当前 admin 前端没有页面调用这个端点（`apps/admin/src/api/users.ts` 的 `getUserWallet` 未被引用），但端点本身在 `specs/openapi.yaml` 有登记、可直接访问。修复：补 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`，与 `AdminCreditController` 口径一致。回归测试 `AdminUserControllerWalletSecurityTest`（3 例：OPERATOR 403 / FINANCE_ADMIN、SUPER_ADMIN 均 200，200 用例挑一个真有 wallet 的 seed 用户，不是 `AepUserRepository.findAll()` 的第一条）。
- [x] ~~**`PublishJobDto.from()` 读路径未经 `CdnUrlSigner`，`videoUrl`/`coverUrl` 签名过期后 403**~~（**已修复**，2026-07-10）：2026-07-08 的 `a72317e` 只修了 *派单* 路径（`startJob` 派单前 `maybeSign` 重签），但 *读* 路径（`GET /api/me/publish-jobs`、`GET /api/me/publish-jobs/{id}` 等 9 处调用点）漏签——`PublishJobDto.from(j)` 原样透传落库时已签名的 URL，TTL（默认 3600s）过期后任何读取这些字段的客户端都会拿到失效签名。当前 celebrity/drama 前端还没有把这两个字段渲染成 `<img>`/`<video>` src，所以不是即时可见故障，但属于 AGENTS.md §4.7.7 明确要求必须堵的口子（读路径不重签 = 定时炸弹）。修复：`PublishJobDto.from` 加 `CdnUrlSigner` 参数、对 `videoUrl`/`coverUrl` 各 `maybeSign` 一次；`PublishJobService` 全部 9 处调用点传入已注入的 `cdnUrlSigner`；新增 `PublishJobService.toDto(job)` 包装方法供 `PublishJobBatchService` 复用（不必让它也持有 `CdnUrlSigner`）。同步更新 `PublishJobServiceCdnSignTest`：`startJob` 返回的 DTO 现在也会重签一次，同一 URL 上 `maybeSign` 从断言调用 1 次改为 2 次（派单前 + 出 DTO 各一次），测试注释写明原因。
- [x] ~~**web-celebrity 素材工坊编辑/预览页拉取脚本失败无 `.catch()`，永久卡在加载态**~~（**已修复**，2026-07-10）：`material/workshop/[scriptId]/edit/editor-client.tsx` 与同目录 `preview-client.tsx` 的 `MaterialOpsApi.getScript(scriptId).then(...)` 都没有 `.catch()`/`.finally()`。JWT 过期 / 500 / 网络抖动时 promise reject，`setLoading(false)` 永远不会跑，页面卡死在「加载脚本…」，控制台留一条 unhandled rejection，且没有任何 error 状态可退——比 2026-07-08 修的 13 个 web-star 页面更彻底（那些好歹有 `!data` 判断，这里是 loading 状态本身卡死）。修复：两个文件都加 `error` state + `.catch()` 设置错误信息并解除 loading + 「重试」按钮（`reloadKey` 触发 `useEffect` 重新拉取）。
- [x] ~~**web-drama 分发总览页把后端原始状态枚举值直接渲染给用户**~~（**已修复**，2026-07-10）：`distribution/page.tsx` 两处 `<StatusBadge tone={tone}>{p.status}</StatusBadge>` / `{j.status}` 把 `PlatformStatus`（`"connected"`/`"pending"`/`"disconnected"`）和 `PublishJobStatus`（`"awaiting_user"`/`"transcoding"` 等）wire 原值直接当可视文案，违反 AGENTS.md §8「UI 文案：用户友好」（禁止暴露内部枚举原值）。同一枚举在 `web-celebrity` 的 `PublishJobList.tsx` 已有正确的中文 `STATUS_META` 标签映射，确认这是本页遗漏而非有意设计。修复：新增本地 `PLATFORM_STATUS_LABEL`/`JOB_STATUS_LABEL` 映射（对齐 `PublishJobList.tsx` 的中文标签），两处渲染改用映射后的标签。

**本轮复核历史 open routine PR**：无——`[Routine QA]`/`qa/routine/` 搜索均为空（#85 已合并），无需 carry-forward，也无需 supersede/close 任何旧 PR。
**验证**：`./mvnw compile`（无 `-o`，走代理联网拉包）全绿；`./mvnw -Dtest=CreditServiceHoldLockTest,AdminUserControllerWalletSecurityTest,CreditHoldSweeperTest,AdminCreditControllerSecurityTest,CreditServiceRefundTest,PublishJobServiceCdnSignTest,CelebrityZoneServiceTest,CreditOpsServiceTest,DramaProjectServiceTest,DramaShortServiceTest,LicenseActivationServiceCreditTest,MaterialDraftBillingTest,RechargeServiceTest,StoreServiceRedeemTest,WalletBucketAndConcurrencyTest,MaterialVideoJobServiceCdnSignTest,MixcutPublishServiceTest test` 全绿（17 + 2 + 广谱回归共 90+ 例）；`pnpm typecheck:web-celebrity` / `pnpm typecheck:web-drama` 见本轮 PR 描述。

## 2026-07-22 · 例行 QA（承接 #95，1 处 Critical SSRF 高置信度新缺陷已修复）

> 开工前核对：#95（`qa/routine/2026-07-21-bugfix-sweep`）base SHA 与当前 `origin/main` 完全一致（main 在 #95 开出后无新提交），直接从该分支 fast-forward 切出本轮分支，10 个既有提交无需 chery-pick / 无冲突。
>
> 独立审计（general-purpose 子 agent，要求不复用前几轮"已核实无新缺陷"的结论，聚焦近期未被专门审计过的代码路径），发现并修复以下 1 处：

- [x] ~~**`DramaAssembleService.download()`（成片合成 `POST /me/drama/projects/{id}/assemble`）对用户可控的 shot `videoUrl` 零 origin 校验，构成 SSRF**~~（**已修复**，2026-07-22）：`videoUrl` 来自 `DramaProject.payloadJson`（`episodeDocs[ep].storyboard.scenes[].shots[].videoUrl`），而 `PUT /me/drama/projects/{id}`（`DramaProjectService.saveProject`）把整个 `data` JSON 原样落库、不做任何嵌套字段校验——任何登录用户可经该接口把自己项目的 `shot.videoUrl` 改成任意字符串（如阿里云 metadata 接口 `http://100.100.100.200/latest/meta-data/ram/security-credentials/<role>` 或任意内网服务地址）。`assemble()` 随后对每个 `videoUrl` 调 `download()`：此前该方法只判断 `url.startsWith("http")` 决定是否需要拼自身 origin，对已是绝对 URL 的输入**没有任何 origin 白名单校验**就直接发起服务端 `HttpClient.send(GET)`，把响应体写入本地临时文件喂给 ffmpeg——这与 `PublishJobService.toAbsoluteUrl()` 已经修过的同一类 SSRF（2026-07-11，见上文）是同一漏洞模式的第三个独立代码路径，此前两轮 SSRF 专项审计（2026-07-11 聚焦 `PublishJobService`；`MaterialOpsService.resolveSubmittedVideoUrl` 早已有 `isAllowedViralHost` 校验）均未覆盖到 `DramaAssembleService`，属于遗漏而非新引入。修复：仿照 `PublishJobService` 同一套 `trustedDispatchOrigins` 口径，新增 `trustedDownloadOrigins`（自身 `http://localhost:<server.port>` + `aep.cdn.public-base-url`/`aep.cdn.oss.base-url` 已配置的 origin），`download()` 对已是绝对 URL 的输入强制校验 origin 命中白名单，未命中前**在发起任何网络请求之前**抛 400 `VIDEO_URL_NOT_ALLOWED` 拒绝（`assemble()` 的 `catch (BusinessException e) { throw e; }` 会原样上抛，不会被吞成 502）；相对路径（同源）不受影响。回归测试：新增 `DramaAssembleServiceTest`（2 例：云 metadata 地址 / 任意内网服务地址均 400 拒绝且 `ffmpeg`/`cdnUploader` 零交互）；已验证回退生产代码改动会导致测试类编译失败（构造器签名依赖新增的白名单参数，无法在无该改动的情况下通过 Mockito 组装出旧行为），证明测试确实锁定了这处修复。定位：`apps/server/src/main/java/com/aistareco/aep/service/DramaAssembleService.java`（原 `download()` 方法，约第 177-191 行）。

**验证**：`./mvnw compile` 全绿；`./mvnw test` 全量 **409/409 全绿、0 失败**（较 2026-07-21 基线净增 2 个回归测试）；`DramaAssembleServiceTest` 单独跑 2/2 全绿。本轮未改动前端/契约，未跑 `pnpm typecheck:all`/`check:api-contract`（无相关文件变更）。

## 模型定价与专享额度（2026-10-24）

- [x] ~~模型接入点赠款与折扣收尾~~ **2026-10-25 本地完成，未发布**：现有 endpointId 是唯一范围，沿用原价、折扣取最优、不叠加，折后赠款优先、余额补差，企业主账号与新老成员统一企业折扣。模型行提供配置入口；数字人组合任务已按用户确认拆成文本与媒体两笔账，分别冻结、结算和原路释放，重试不换模型或重复扣费。定向回归及四门检查通过，未合主线、未部署；真源 `docs/model-billing-design.md`。
