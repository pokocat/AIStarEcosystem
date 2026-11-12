---
name: aliyun-deploy
description: Use for AIStar production API deployment, verification, or recovery on the Aliyun dual-node PostgreSQL cluster, or the explicitly requested isolated clip preproduction deployment.
---

# AIStar 阿里云发布

先读 [AIStar 生产发布与恢复](../../../docs/runbooks/aistar-production-release.md)。核对 `git status --short`、远端 main、两机当前版本和用户授权范围，保留无关工作区改动。

- API 已切至 PostgreSQL，ALB 常态 A50/B50。以 `./infra/scripts/deploy.sh server --plan` 查看目标；正式发布按手册准备同一 SHA 的 CI 制品，再通过 `./infra/scripts/deploy.sh server` 滚动。旧单机命令和旧 MySQL 回滚不适用于 AIStar API。
- A 的后台和 SAU 需独立发布及验收。Web 和后台页面也按各组件的现行发布入口处理。账号中心由 [aibuzz-id](https://github.com/pokocat/aibuzz-id/blob/main/deploy/README.md) 独立发布。
- 以双机实际 SHA、严格 TLS、两个 VIP 的真实鉴权、ALB 权重及本次业务回归作为验收依据。凭据、运行环境和探针密钥通过授权渠道管理。

## 隔离预发和本地验收

`clip` preprod is an explicit exception to the production topology, not a production service alias. Only when the user asks for 军师快出片预发, use `infra/scripts/deploy-clip-preprod.sh`, `/etc/aistareco/clip-preprod.env`, `/opt/aistareco-clip-preprod`, and systemd `aistareco-clip-preprod` on the user-authorized preprod host. It must stay on `127.0.0.1:8081`; expose only `/clip_preprod/cdn|files/` through nginx; never restart or modify `aistareco-server` production. Real Shiliu tokens must be entered interactively or installed by a secret manager and never appear in command arguments/output. For v0.113+, the deploy script itself must resolve the ffmpeg/ffprobe paths from the remote env and fail before upload unless ffmpeg exposes `signalstats`, `metadata`, and `loudnorm`; otherwise the final media quality gate intentionally fails closed. Preserve or explicitly set the `AEP_CLIP_MIN/MAX_*` thresholds documented in `infra/env/clip-preprod.env.example`. The target host mounts `/tmp` as a 3.7 GiB tmpfs, so every timestamped `/tmp/aistareco-clip-*.jar` must be removed by the remote `trap` on success or failure; preflight must also delete same-owner leftovers older than 60 minutes.

During the explicit testing stage, the script defaults `TEST_MEDIA_MODE=true`, which writes only `AEP_CLIP_FORCE_MOCK=true` to the isolated preprod env. This mode must still produce a playable stored MP4 through real ffmpeg assembly/quality gates and permanently burn `测试演示`; it may not fall back to a status-only fake work. Set `TEST_MEDIA_MODE=false` for real Shiliu media acceptance. `prod`/`mysql` profiles must reject force-mock at startup.

Unified IP Studio local acceptance uses `aep.ipstudio.fixture-enabled=true` and a local `aep.ipstudio.fixture-directory`. Both are local development settings, default off; `prod`/`production`/`mysql` must reject fixture mode at startup. Never carry fixture settings or `.studio-fixtures` media into a production release. Native provider generation is disabled while this mode is active. Real API acceptance runs with the switch off after the user supplies model configuration.

Studio local identity uses `infra/scripts/studio-local-identity.py` and `infra/local/studio-identity.yml` on loopback port 8098 with a persistent local H2 database. Its fixed `dev` fixture and initialization credentials are local only; never deploy this configuration, database, or startup script to production. See `infra/README.md` for the local login workflow.
