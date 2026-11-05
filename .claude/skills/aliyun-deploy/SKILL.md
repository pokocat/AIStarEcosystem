---
name: aliyun-deploy
description: Use when deploying, redeploying, verifying, or rolling back the AI Star Eco production stack on Aliyun/ECS, including deploying all apps, deploying selected apps, building release artifacts, using the GitHub Actions production deployment workflow, or troubleshooting production deployment issues for server, web-celebrity, web-aiavatar, admin, and sau-service.
---
## AIStar 双机 PostgreSQL 迁移准备（2026-11-05，优先于下方历史单机说明）

新发布入口 `infra/scripts/deploy.sh server --plan`；新 A/B、ALB A100/B0、PG/Tair 配置以 `infra/cluster/production.json` 为准。旧单机发布入口已禁用，不能回退旧机。正式尚未切流，生产激活需另行窗口及正式导入凭证。API 两机关闭后台；后台/SAU 在 A 独立单活。前端及角色交接单独验收。

完整文件、导入保护、滚动顺序与验收见 [`docs/aistar-postgresql-cutover.md`](../../../docs/aistar-postgresql-cutover.md)。下方旧 ECS/MySQL/身份同机描述仅作历史运维参考，不能用于新发布。


# Aliyun Production Deploy

This skill is the repo-local deployment entrypoint. Before any deployment action:

1. Read `infra/README.md`.
2. Run `git status --short` and identify unrelated dirty changes.
3. Do not edit `/etc/aistareco/*.env` secrets or credentials as part of a deploy. If env values are missing or wrong, tell the user exactly what to configure.

`clip` preprod is an explicit exception to the production topology, not a production service alias. Only when the user asks for 军师快出片预发, use `infra/scripts/deploy-clip-preprod.sh`, `/etc/aistareco/clip-preprod.env`, `/opt/aistareco-clip-preprod`, and systemd `aistareco-clip-preprod` on the user-authorized preprod host. It must stay on `127.0.0.1:8081`; expose only `/clip_preprod/cdn|files/` through nginx; never restart or modify `aistareco-server` production. Real Shiliu tokens must be entered interactively or installed by a secret manager and never appear in command arguments/output. For v0.113+, the deploy script itself must resolve the ffmpeg/ffprobe paths from the remote env and fail before upload unless ffmpeg exposes `signalstats`, `metadata`, and `loudnorm`; otherwise the final media quality gate intentionally fails closed. Preserve or explicitly set the `AEP_CLIP_MIN/MAX_*` thresholds documented in `infra/env/clip-preprod.env.example`. The target host mounts `/tmp` as a 3.7 GiB tmpfs, so every timestamped `/tmp/aistareco-clip-*.jar` must be removed by the remote `trap` on success or failure; preflight must also delete same-owner leftovers older than 60 minutes.

During the explicit testing stage, the script defaults `TEST_MEDIA_MODE=true`, which writes only `AEP_CLIP_FORCE_MOCK=true` to the isolated preprod env. This mode must still produce a playable stored MP4 through real ffmpeg assembly/quality gates and permanently burn `测试演示`; it may not fall back to a status-only fake work. Set `TEST_MEDIA_MODE=false` for real Shiliu media acceptance. `prod`/`mysql` profiles must reject force-mock at startup.

Unified IP Studio local acceptance uses `aep.ipstudio.fixture-enabled=true` and a local `aep.ipstudio.fixture-directory`. Both are local development settings, default off; `prod`/`production`/`mysql` must reject fixture mode at startup. Never carry fixture settings or `.studio-fixtures` media into a production release. Native provider generation is disabled while this mode is active. Real API acceptance runs with the switch off after the user supplies model configuration.

Studio local identity uses `infra/scripts/studio-local-identity.py` and `infra/local/studio-identity.yml` on loopback port 8098 with a persistent local H2 database. Its fixed `dev` fixture and initialization credentials are local only; never deploy this configuration, database, or startup script to production. See `infra/README.md` for the local login workflow.

## Services

Current production services are:

- `server` - Spring Boot backend, systemd unit `aistareco-server`.
- `web-music` - Next.js 16 music app, systemd unit `aistareco-web-music`.
- `web-drama` - Next.js 16 drama app, systemd unit `aistareco-web-drama`.
- `web-celebrity` - Next.js 16 celebrity app, systemd unit `aistareco-web-celebrity`.
- `web-aiavatar` - Next.js 16 AiAvatar app, systemd unit `aistareco-web-aiavatar`.
  Since v0.190 this app also hosts the AI IP workbench (infinite canvas) that used to be
  `web-ipstudio`; one app serves a mobile shell (<1024px) and a desktop shell (>=1024px).
  `ipstudio.aibuzz.cn` is now a 308 redirect here — do not deploy anything to it.
- `web-star` - Next.js 16 star business console, systemd unit `aistareco-web-star`.
- `admin` - Next.js admin app, systemd unit `aistareco-admin`.
- `sau-service` - Dockerized FastAPI/Playwright service, systemd unit `aistareco-sau-service`.
  Real-image builds run `apps/sau-service/scripts/prepare_real_runtime.py` to patch
  the pinned upstream's Python 3.11-incompatible XHS f-string and import all four
  upload drivers. Keep this build gate: `/healthz` alone does not load the drivers.
- `all` - builds and deploys all current production services above.

### Identity center (`id.aibuzz.cn`) - not in this repo

The identity center lives in its own repository:
<https://github.com/pokocat/aibuzz-id>. Build, env, JWK keys, systemd unit, nginx vhost,
deploy and rollback are all in that repo's `deploy/README.md`. The scripts in
`infra/scripts/` neither build nor deploy it — do not try to add it back to a service list here.

Host facts worth keeping straight when working on this box: it runs on the **same ECS** as
`aistareco-server`, on port **8091** (8090 is bound by the `aistareco-sau-service` container
and referenced by `SAU_SERVICE_URL` in `server.env`), with its own database `aistareco_id`
and a local self-hosted Redis. Its systemd unit is `aistareco-id-server`; start
troubleshooting with `journalctl -u aistareco-id-server`.

What stays in *this* repo is the consumer side: `AEP_ID_*` in `server.env`, and the
build-time `NEXT_PUBLIC_*` for the five web apps (see below).

## Default Production Parameters

Use these defaults unless the user gives a different host or topology:

```bash
DEPLOY_HOST=ecs-user@47.98.162.120
PUBLIC_BASE=http://47.98.162.120
REMOTE_ROOT=/opt/ai-star-eco
```

For local manual deploys, use the user's local private key path if provided, for example:

```bash
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem
```

Never write the private key value into repo files or GitHub Secrets examples.

## OSS / CDN URL 签名（v0.47+，强制生产配置）

Production deployments **MUST** configure OSS URL signing — bucket private + CDN 回源不足以防流量盗刷。
Without signing, any leaked public asset URL becomes an indefinite hot-link target.

`SPRING_PROFILES_ACTIVE=mysql` loads `application.yml` first and then overlays
`application-mysql.yml`. The MySQL profile defaults persistent assets to OSS;
`application.yml` keeps only the dev/local fake-CDN fallback.

Required env vars in `/etc/aistareco/server.env`:

```bash
AEP_CDN_DRIVER=oss
AEP_CDN_OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
AEP_CDN_OSS_BUCKET=aiartist
AEP_CDN_OSS_BASE_URL=https://aiartist.oss-cn-hangzhou.aliyuncs.com  # or HTTPS CNAME/CDN domain
AEP_CDN_OSS_KEY_PREFIX=media
AEP_CDN_SIGNED_URL_STRATEGY=oss         # cdn (推荐高带宽) | oss (默认可用) | none (仅 dev)
AEP_CDN_SIGNED_URL_TTL_SECONDS=3600     # URL 有效 1h；视频长可调 14400
AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<32字符密钥>  # 仅 strategy=cdn 用
```

Setup steps for `strategy=cdn`:

1. Aliyun CDN 控制台 → 域名管理 → 选 configured public CDN/CNAME domain → **访问控制 → URL 鉴权**
2. 鉴权类型 = **Type A**，状态 = **开启**
3. 「主 KEY」点「自动生成」复制 32 位密钥
4. 填到 ECS `/etc/aistareco/server.env` 的 `AEP_CDN_SIGNED_URL_CDN_AUTH_KEY`
5. `sudo systemctl restart aistareco-server`

Verify:

```bash
# 拉混剪任务 JSON，outputs[*].cdn_url 应当带 ?auth_key=…
curl -H "Authorization: Bearer <jwt>" https://api.aibuzz.cn/api/me/mixcut/jobs | jq '.data[0].outputs[0].cdn_url'
# 直接 GET 应 200；改 auth_key 后再 GET 应 403
```

详见 [`infra/oss/README.md#31-url-鉴权--签名-v047-必配防流量盗刷`](../../../infra/oss/README.md)。

## Deployment Paths

Use the artifact deploy chain as the only deploy path.

Remote ECS bootstrap/preflight:

```bash
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
./infra/scripts/preflight.sh --remote ecs-user@47.98.162.120

ssh -i /Users/donis/dev/aliyun/aiartist.pem ecs-user@47.98.162.120 \
  'sudo bash -s' < infra/scripts/install-cjk-fonts.sh
```

`deploy-release.sh` runs `infra/scripts/install-host-deps.sh` on the remote host by default before restarting services. This idempotently installs missing host-level runtime/build dependencies for the selected services based on `/etc/os-release` and the available package manager (`dnf`, `yum`, or `apt-get`). It then runs `infra/scripts/check-runtime-env.sh` to validate `/etc/aistareco/*.env` and the release manifest without printing secret values. It also runs `infra/scripts/install-cjk-fonts.sh`, keeping system CJK fonts available for Java2D picgen, ffmpeg drawtext, browser rendering, and future server-side image work. Only set `ENSURE_HOST_DEPS=0`, `CHECK_RUNTIME_ENV=0`, or `ENSURE_CJK_FONTS=0` when explicitly troubleshooting package manager/network issues.

Build release artifacts without deploying:

```bash
./infra/scripts/build-release.sh all
./infra/scripts/build-release.sh server,web-music,web-drama,web-celebrity,web-aiavatar
```

Build locally and deploy in one command:

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy.sh all
```

Deploy only selected services:

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy.sh server,web-celebrity,web-aiavatar
./infra/scripts/deploy.sh web-music,web-drama
```

Switching the five web apps to identity-center login is a **build-time** change
(`NEXT_PUBLIC_*` is inlined by Next), so it cannot be done by editing an env file on the box:

```bash
NEXT_PUBLIC_AUTH_MODE=id NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn \
  ./infra/scripts/deploy.sh web-music,web-drama,web-celebrity,web-aiavatar,web-star
```

The default is `legacy`, so ordinary deploys leave current login behaviour untouched.
Rolling back means rebuilding with `legacy`, not restarting a service.

Deploy an already-built release directory:

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/<release-id> server,admin
```

Verify production after deploy:

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 \
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 \
./infra/scripts/verify.sh
```

## ECS 本机直接部署（v0.47+，无 SSH）

When the user is already on the ECS box (or wants to deploy from ECS itself without SSH bouncing), prefer `update-and-deploy.sh` for one-command server-side updates. It installs missing host dependencies, safely fast-forwards the repo, then execs `deploy-local.sh`. Same artifact layout, same systemd units, same backup convention as `deploy-release.sh` — but everything happens locally.

```bash
# 在 ECS 本机
cd /opt/ai-star-eco/repo

# 一键：补依赖 → git pull --ff-only → build → deploy → verify
sudo ./infra/scripts/update-and-deploy.sh all

# 独立 / 多选
sudo ./infra/scripts/update-and-deploy.sh server
sudo ./infra/scripts/update-and-deploy.sh server,admin
sudo ./infra/scripts/update-and-deploy.sh "web-celebrity web-aiavatar sau-service"

# 等价快捷方式：deploy-local --pull 会转交给 update-and-deploy.sh
sudo ./infra/scripts/deploy-local.sh all --pull

# 如果代码已经是目标版本，只部署当前工作区
sudo ./infra/scripts/deploy-local.sh server
sudo ./infra/scripts/deploy-local.sh server,admin
sudo ./infra/scripts/deploy-local.sh "web-celebrity web-aiavatar sau-service"

# 紧急部署：跳 typecheck + 跳 verify
SKIP_TYPECHECK=1 sudo ./infra/scripts/deploy-local.sh all --no-verify

# 已经 build 过仅翻新 + restart（审产物后再发布）
./infra/scripts/build-release.sh all
sudo ./infra/scripts/deploy-local.sh all --no-build --release-id=<RELEASE_ID>
```

Host dependency install is handled by `infra/scripts/install-host-deps.sh`. It reads `/etc/os-release`, selects `dnf`, `yum`, or `apt-get`, and installs only missing required runtime/build commands: Java 17 JDK, nginx, docker for `sau-service`, ffmpeg, fontconfig + CJK fonts, Node 24.14.1, pnpm 10.33.2, rsync/curl/tar/unzip, and related base packages. Use `--no-deps` only when intentionally skipping this step.

Runtime env validation is handled by `infra/scripts/check-runtime-env.sh` and is enabled by default in both `deploy-local.sh` and `deploy-release.sh`. It checks `/etc/aistareco/server.env`, `/etc/aistareco/sau-service.env`, and release build-time env (`NEXT_PUBLIC_USE_MOCK`, `NEXT_PUBLIC_API_BASE_URL`, etc.) without printing actual values. Missing files, placeholders, missing key secrets, `AEP_DEV_AUTH_ENABLED=true`, missing Aliyun SMS credentials for `AEP_SMS_DRIVER=aliyun`, missing OSS/signing credentials for `AEP_CDN_DRIVER=oss`, `SAU_MOCK_MODE!=0`, and `SAU_INTERNAL_SECRET` mismatch must block deploy. Permission issues and `AEP_SEED_DEV_DATA_ENABLED=true` may warn. Use `--no-env-check` or `CHECK_RUNTIME_ENV=0` only for explicit troubleshooting; use `ENV_CHECK_WARN_ONLY=1` if the user asks to see warnings without blocking.

`update-and-deploy.sh` defaults to `git pull --ff-only` and must stop on a dirty server worktree. Do not pass `--reset-to-origin` unless the user explicitly confirms that server-side repo changes may be discarded.

`verify.sh` 同期加 `LOCAL_MODE=1`，被 `deploy-local.sh` 自动调用做本机健康检查。

## GitHub Actions (build-only, no auto-deploy)

**Controlled release (since 2026-06-22):** the workflow `.github/workflows/deploy-production.yml`
(name: *Build release artifacts*) **only builds + uploads artifacts** — the SSH "Configure SSH" and
"Deploy to production" steps were removed. Rationale: do not store a long-lived production SSH private
key in GitHub Secrets (it widens blast radius); releases are performed manually/controlled instead.

- Workflow: `.github/workflows/deploy-production.yml`
- Trigger: `workflow_dispatch`
- `services` input accepts `all`, `server`, `server,web-celebrity,web-aiavatar,admin`, or `sau-service`.
- **No `PROD_SSH_*` secrets needed** — the job no longer SSHes anywhere, so it will not fail on missing secrets.
- Output: `dist/deploy/<release-id>` uploaded as a downloadable artifact (14-day retention).

After the workflow builds, **deploy manually** with one of:
- local: `./infra/scripts/deploy.sh <services>` (build+deploy), or `deploy-release.sh <dir> <services>` on a downloaded artifact
- on ECS: `sudo ./infra/scripts/update-and-deploy.sh <services>` (private key never leaves the box)

If the user wants to restore auto-deploy via Actions: **do not use the master PEM** — mint a dedicated,
restricted deploy key (`authorized_keys` with `command=`/`from=` constraints, independently rotatable),
then re-add the Configure SSH / Deploy steps and the `PROD_SSH_*` secrets. Never put real AK, SMS
templates, OSS credentials, or PEM contents into the repo; runtime app credentials stay on the server in
`/etc/aistareco/*.env`.

## Troubleshooting

- HTML `502 Bad Gateway` from nginx usually means the upstream service is restarting or unreachable. First check `systemctl status aistareco-server` and `journalctl -u aistareco-server`.
- SMS issues belong to `apps/server`, not `sau-service`. First check `AEP_SMS_DRIVER` in `/etc/aistareco/server.env` and `journalctl -u aistareco-server` for `sms-aliyun`, `sms-disabled`, or `sms-log`.
- `sau-service` must be built with `--build-arg INSTALL_REAL=1`. After deploy, verify `curl http://127.0.0.1:8090/healthz` returns `mockMode:false`.
- `aistareco-id-server` failing to start, or `https://id.aibuzz.cn` redirecting to `/admin` (its 443 vhost is missing): both belong to <https://github.com/pokocat/aibuzz-id>; see that repo's `deploy/README.md`. Nothing in `infra/` here fixes them.
- `apps/server` rejecting identity-center tokens with 401: check that `AEP_ID_CLIENT_SECRET` (server.env) equals the identity center's `ID_CLIENT_SECRET_AISTAR_SERVER`, and that `AEP_ID_ISSUER` matches its `ID_ISSUER` exactly.
- Chinese text mojibake has two separate causes. For API/usernames, inspect DB stored values and MySQL `utf8mb4` connection/table settings. For picgen/ffmpeg/browser rendering, first run `fc-list :lang=zh family`, `fc-match 'Noto Sans CJK SC:lang=zh-cn'`, and check `journalctl -u aistareco-server` for `[fonts] registry total`.
- If a deploy changes only one app, pass only that service list. Do not redeploy `all` unless the user asks for a full release or dependencies require it.
- If production env values need changes, stop and ask the user to edit `/etc/aistareco/*.env` or confirm the exact non-secret change. Do not invent or overwrite secrets.

## Enterprise release flags (2026-10-15)

Keep `AEP_ENTERPRISE_ENABLED=false` unless enterprise foundation access is explicitly included in a release. E01–E12 provide relations/RBAC, corporate-owned recoverable credits, manual enterprise cash records, all Studio payer selection/admission/settlement, lifecycle recovery, and finance reports. Product enrollment stays explicit; no enterprise seats. This feature is enabled only when explicitly included in an authorized release. NEXT_PUBLIC_ENTERPRISE_ENABLED defaults0 and is a build-time flag for Studio navigation; rebuild with1 only when included in an authorized release. Platform finance handlers remain available for existing enterprise orders when new product entry is disabled. V57 records original recharge provenance and unique cash receipts; refunds wait for original frozen credits to settle and never use later recharge lots. V56 introduces corporate wallets with nullable user_id; once corporate data exists, rollback must retain corporate-aware wallet/ledger readers and hold settlement by wallet_id. Disabling new access must never disable in-flight financial settlement or reconciliation. Environment changes require the existing recreation/restart procedure appropriate to the actual service host.

企业付款灰度：`AEP_ENTERPRISE_ALLOWED_IDS` 可填逗号分隔的企业ID；留空表示全局开关开启后全部企业。只限制新企业付款，不影响原任务结算与恢复。


## PostgreSQL preparation — no production cutover（2026-11-04，未生产发布）

V74基线不回改，V75结构补齐、V76业务标识比较、V77重试引用比较。用户名/slug与幂等请求使用限定列ICU+rtrim；身份UID、任务主键和凭据精确比较。ModelPrice/ModelDiscount新建记录补updatedAt。postgres备用/导入验证进程默认 `AEP_BACKGROUND_ENABLED=false`；仅主节点显式开启定时任务，启动发布恢复也遵守该开关，HTTP异步入口仍须另行排空。

真实RDS独立演练已恢复192表/28,280行并核对全字段指纹；工具只允许演练库，不支持生产恢复。源时间按真实Hibernate/JDBC类型逐列转换，不统一减8小时。AIStar生产窗口尚未安排，不执行部署、停写、ALB/DNS切换，不借用账号中心的窗口。完整规则与验收入口见 `../../../docs/runbooks/postgresql-18-migration.md`。

ALB就绪入口为 `GET /internal/ready`：应用启动完成且真实数据库连接与共享Tair状态有效才200，启动中、关闭或数据库故障返回503，响应仅含ready布尔值。它不承诺生成供应商、支付或发布能力均已可用；这些仍须业务验收。

生产postgres配置由 `PostgresEnvironmentGuard` 在EnvironmentPostProcessor阶段检查，早于DataSource/Hibernate创建；拒绝旧环境遗留的ddl-auto=update或MySQL Flyway目录等覆盖。源env复制后必须显式替换数据库/driver/dialect、schema、Flyway目录/开关、UTC、日志目录与后台角色，不能只改DB_URL。实际数据库版本/角色/时区仍在连接后另行验证。

PG正式主备滚动必须使用Tair共享旧短信状态：独立账号/TLS，正式DB15与`aistar:prod:sms:v1:`，演练DB14与独立prefix；`AEP_SMS_TAIR_URL`/`AEP_SMS_TAIR_PREFIX`必填，保留原AES密钥。原子预留、确认、失败锁定及一次消费失败时不回落内存，Tair不可用readiness返回503。首次迁移不能导出旧进程内存：验证码默认5分钟、失败锁定默认30分钟，按实际最长状态时长保守维护旧短信接口。默认运行库`aistar_prod`、DML角色`aistar_app`，DDL由单独`aistar_migrator`先执行，日志写`/var/log/aistar/*.log`并挂SLS采集目录。镜像固定已验收JAR和基础镜像digest；官方Podman通过Cloud Assistant安装，禁止为了运行镜像替换宿主系统Java/Python。

Tair TLS使用阿里云实例`DescribeInstanceSSL`返回的官方CA链；为AIStar复制独立Java truststore（仅trustedCertEntry，保留默认公共根），不修改系统或账号中心信任库。原始JRE默认cacerts不包含此托管私有CA，不能关闭证书或主机名校验绕过。正式镜像入口要求挂载`AISTAR_JAVA_TRUSTSTORE=/etc/aistar/java-truststore`只读；完整API验收必须在相同truststore与不可变镜像上通过。

迁移保持源JVM业务时区`Asia/Shanghai`，JDBC/Hibernate和PG连接仍UTC。源码4个未显式zone的凌晨03:30/40/45/50清理cron及若干LocalDate.now依赖JVM，不能随数据库迁移改成UTC导致业务日/调度晚8小时；用实际镜像的离线时钟/cron边界验收，后台依旧关闭。

PG18低权限元数据兼容：固定pgJDBC42.7.14（旧42.7.4的hideUnprivilegedObjects会引用已移除RULE权限）；生产postgres运行期Flyway仅validate，DDL由迁移角色先执行，待执行迁移使运行期失败且不建表/不写历史。MySQL/dev及postgresit建库门禁保留原迁移行为。COPY使用UTF8字节流，避免Reader分块拆开emoji代理对；真实PG测试覆盖隐藏无权schema、只读历史验证/拒绝待执行DDL、超64KiB中文/emoji/引号/换行COPY。官方说明：https://jdbc.postgresql.org/changelogs/2025-01-14-42/ ，当前固定发行：https://jdbc.postgresql.org/changelogs/2026-10-07-42.7.14-release/ 。

AIStar运行镜像必须同时固定官方Java与Node镜像digest；Studio仿片分析使用JAR内置Hypit适配器，单有Java/FFmpeg会返回STUDIO_HYPIT_UNAVAILABLE。仅从官方node镜像复制Node22+二进制，不安装npm依赖或替换宿主Node。AistarHypitRuntimeVerification离线调用真实StudioHypitMedia的requireReady/read，合成红蓝视频并验证24帧原始时间戳；两机在禁网/只读根目录下运行，不调用模型/支付/短信或发布平台。

容器路径与本地文件：源环境已有AEP_STUDIO_RECREATION_MEDIA_BIN=/opt/ai-star-eco/hypit-runtime/bin，不能原样继承到镜像；新模板明确使用/usr/bin，并固定Node=/usr/local/bin/node。FileStorageService实际配置键是AEP_STORAGE_LOCAL_DIR，挂载/app/work为UID10001可写；AEP_FILE_STORAGE_ROOT不是有效替代。源file-storage约4GB，保留完整预同步副本并校验，正式停写后补增量；不能仅因已接OSS而假定本地目录可删除。预同步不是冻结数据，禁止据此清理旧服务文件。

迁移文件中转只能使用独立私有Bucket，先以无敏感信息的canary验证匿名Range GET为403；仅设置object private ACL不足以证明Bucket策略未放行。禁止把数据库导出、文件归档或含业务信息的中转包放入现有公开素材Bucket。分发OCI归档时校验归档SHA256、配置摘要和RootFS摘要；Podman导出重新压缩可能改变引擎显示的manifest digest，不能据此跳过内容校验。
