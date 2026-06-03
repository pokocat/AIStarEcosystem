---
name: aliyun-deploy
description: Use when deploying, redeploying, verifying, or rolling back the AI Star Eco production stack on Aliyun/ECS, including deploying all apps, deploying selected apps, building release artifacts, using the GitHub Actions production deployment workflow, or troubleshooting production deployment issues for server, web-celebrity, admin, and sau-service.
---

# Aliyun Production Deploy

This skill is the repo-local deployment entrypoint. Before any deployment action:

1. Read `infra/README.md`.
2. Run `git status --short` and identify unrelated dirty changes.
3. Do not edit `/etc/aistareco/*.env` secrets or credentials as part of a deploy. If env values are missing or wrong, tell the user exactly what to configure.

## Services

Current production services are:

- `server` - Spring Boot backend, systemd unit `aistareco-server`.
- `web-celebrity` - Next.js 16 celebrity app, systemd unit `aistareco-web-celebrity`.
- `admin` - Next.js admin app, systemd unit `aistareco-admin`.
- `sau-service` - Dockerized FastAPI/Playwright service, systemd unit `aistareco-sau-service`.
- `all` - builds and deploys all current production services above.

Do not include `web-music` or `web-drama` in production deploy commands until the deploy scripts explicitly support them.

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
Without signing, any leaked `https://cdn.aibuzz.cn/...` URL becomes an indefinite hot-link target.

Required env vars in `/etc/aistareco/server.env`:

```bash
AEP_CDN_DRIVER=oss
AEP_CDN_SIGNED_URL_STRATEGY=cdn         # cdn (推荐生产) | oss (中小流量) | none (仅 dev)
AEP_CDN_SIGNED_URL_TTL_SECONDS=3600     # URL 有效 1h；视频长可调 14400
AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<32字符密钥>  # 仅 strategy=cdn 用
```

Setup steps for `strategy=cdn`:

1. Aliyun CDN 控制台 → 域名管理 → 选 `cdn.aibuzz.cn` → **访问控制 → URL 鉴权**
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

详见 [`infra/oss/README.md#31-url-鉴权--签名-v047-必配防流量盗刷`](../../infra/oss/README.md)。

## Deployment Paths

Use the artifact deploy chain as the only deploy path.

Remote ECS bootstrap/preflight:

```bash
SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
./infra/scripts/preflight.sh --remote ecs-user@47.98.162.120

ssh -i /Users/donis/dev/aliyun/aiartist.pem ecs-user@47.98.162.120 \
  'sudo bash -s' < infra/scripts/install-cjk-fonts.sh
```

`deploy-release.sh` runs `infra/scripts/install-cjk-fonts.sh` on the remote host by default before restarting services. This is idempotent and keeps system CJK fonts available for Java2D picgen, ffmpeg drawtext, browser rendering, and future server-side image work. Only set `ENSURE_CJK_FONTS=0` when explicitly troubleshooting package manager/network issues.

Build release artifacts without deploying:

```bash
./infra/scripts/build-release.sh all
./infra/scripts/build-release.sh server,web-celebrity
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
./infra/scripts/deploy.sh server,web-celebrity
```

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

When the user is already on the ECS box (or want to deploy from ECS itself without SSH bouncing), use `deploy-local.sh`. Same artifact layout, same systemd units, same backup convention as `deploy-release.sh` — but everything happens locally.

```bash
# 在 ECS 本机
cd /opt/ai-star-eco/repo && git pull

# all-in-one
sudo ./infra/scripts/deploy-local.sh all

# 独立 / 多选
sudo ./infra/scripts/deploy-local.sh server
sudo ./infra/scripts/deploy-local.sh server,admin
sudo ./infra/scripts/deploy-local.sh "web-celebrity sau-service"

# 紧急部署：跳 typecheck + 跳 verify
SKIP_TYPECHECK=1 sudo ./infra/scripts/deploy-local.sh all --no-verify

# 已经 build 过仅翻新 + restart（审产物后再发布）
./infra/scripts/build-release.sh all
sudo ./infra/scripts/deploy-local.sh all --no-build --release-id=<RELEASE_ID>
```

`verify.sh` 同期加 `LOCAL_MODE=1`，被 `deploy-local.sh` 自动调用做本机健康检查。

## GitHub Actions

If the user asks for a GitHub workflow, CI/CD, or "流水线部署", prefer the manual GitHub Actions workflow instead of local SSH deployment:

- Workflow: `.github/workflows/deploy-production.yml`
- Trigger: `workflow_dispatch`
- `services` input accepts `all`, `server`, `server,web-celebrity,admin`, or `sau-service`.
- Required repository secrets:
  - `PROD_SSH_HOST`
  - `PROD_SSH_USER`
  - `PROD_SSH_PRIVATE_KEY`
  - optional `PROD_SSH_PORT`
  - optional `PROD_REMOTE_ROOT`
  - optional `PROD_PUBLIC_BASE`

Do not put real AK, SMS templates, OSS credentials, or PEM contents into the repo. GitHub Secrets hold SSH deployment credentials only; runtime app credentials stay on the server in `/etc/aistareco/*.env`.

## Troubleshooting

- HTML `502 Bad Gateway` from nginx usually means the upstream service is restarting or unreachable. First check `systemctl status aistareco-server` and `journalctl -u aistareco-server`.
- SMS issues belong to `apps/server`, not `sau-service`. First check `AEP_SMS_DRIVER` in `/etc/aistareco/server.env` and `journalctl -u aistareco-server` for `sms-aliyun`, `sms-disabled`, or `sms-log`.
- `sau-service` must be built with `--build-arg INSTALL_REAL=1`. After deploy, verify `curl http://127.0.0.1:8090/healthz` returns `mockMode:false`.
- Chinese text mojibake has two separate causes. For API/usernames, inspect DB stored values and MySQL `utf8mb4` connection/table settings. For picgen/ffmpeg/browser rendering, first run `fc-list :lang=zh family`, `fc-match 'Noto Sans CJK SC:lang=zh-cn'`, and check `journalctl -u aistareco-server` for `[fonts] registry total`.
- If a deploy changes only one app, pass only that service list. Do not redeploy `all` unless the user asks for a full release or dependencies require it.
- If production env values need changes, stop and ask the user to edit `/etc/aistareco/*.env` or confirm the exact non-secret change. Do not invent or overwrite secrets.
