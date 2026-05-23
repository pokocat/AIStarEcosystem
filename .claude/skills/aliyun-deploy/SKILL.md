---
name: aliyun-deploy
description: Deploy the AI Star Eco monorepo to the production server at 47.94.102.182. Use when the user asks to deploy, redeploy, publish, sync web/admin/server/web-celebrity/sau-service changes, upload frontend video assets, restart production services, verify /web /admin /api, test celebrity account binding QR, or document/standardize the AI Star Eco deployment workflow.
---

# Aliyun Deploy

Use this skill to deploy the AI Star Eco monorepo from `/Users/donis/dev/Aisingerecosystemcopy` to the production server.

For topology, exact paths, service names, verification endpoints, and known caveats, read [production.md](references/production.md) when doing any real deployment.

## Default Workflow

1. Inspect local changes with `git status --short`.
2. Decide deploy scope:
   - If only `apps/web` changed, deploy `web` and static videos.
   - If only `apps/admin` changed, deploy `admin`.
   - If `apps/server` changed, deploy `server`.
   - If `apps/web-celebrity` changed, deploy `web-celebrity`.
   - If `apps/sau-service` changed, rebuild and restart the `aistareco-sau-service` Docker container.
   - If unsure, deploy only the affected runtime services; avoid touching unrelated services.
3. Build locally before syncing. Next apps must use `output: "standalone"`:
   - `apps/web`: `npm run build`
   - `apps/admin`: `npm run build`
   - `apps/server`: `./mvnw package -DskipTests`
   - `apps/web-celebrity`: `pnpm --filter @ai-star-eco/web-celebrity build`
   - `apps/sau-service`: run local tests if changed, then remote Docker build.
4. Package and sync only runtime artifacts:
   - Next: `.next/standalone`, then copy `.next/static` into `.next/standalone/.next/static`, and `public` into `.next/standalone/public`.
   - Also sync `next.config.mjs` for auditability and future builds.
   - Server: the packaged jar.
5. Restart only affected services unless doing a full deploy.
6. Verify public endpoints, representative chunks, static videos, account binding QR, and service logs.
7. Report elapsed time, what was deployed, what passed, and any known residual risk.

## Important Rules

- Prefer local builds and remote artifact sync. Avoid remote `next build`; it has historically been slower and can hang.
- Prefer Next standalone deploys. Do not sync the whole `.next` tree unless troubleshooting; sync `.next/standalone`, then place `.next/static` and `public` inside that standalone runtime.
- Do not delete old `.next/static` chunks during normal deploys. They are immutable and may still be referenced by users with cached HTML; keeping them prevents transient ChunkLoadError.
- Always sync `apps/web/public/videos/` to `/opt/ai-star-eco/static/videos/` when deploying `web` or any appearance/video change.
- Always sync `next.config.mjs` for `web` or `admin`; it carries `basePath`, `output: "standalone"`, and rewrite behavior used by production.
- Use `/web` and `/admin` as public paths. Do not verify root-level Next pages without the base path.
- Nginx must preserve `/web` and `/admin` prefixes when proxying to Next. If chunk URLs return 404, check for trailing slash `proxy_pass` rules first.
- Systemd for Next should run `node .next/standalone/server.js` with `PORT` and `HOSTNAME`, not `next start`.
- Expect Spring Boot startup to take 2-3 minutes after restarting `aistareco-server`; poll `/api/auth/dev-accounts` instead of assuming failure.
- `web-celebrity` is exposed directly at `http://47.94.102.182:3012/` and uses public API base `http://47.94.102.182/api`.
- For `sau-service` real login mode, Docker builds must use `--build-arg INSTALL_REAL=1`; otherwise `patchright` is missing and `/login/start` returns 500.
- `sau-service` should listen only on `127.0.0.1:8090` and be called by server, not exposed publicly.
- Account binding QR smoke tests must check both bad-token behavior and a valid `/me/social-accounts/bind-init` response. Bad tokens should return JSON 401 so the frontend clears localStorage.
- Do not print or overwrite secrets from `/etc/aistareco/server.env`.
- Do not change Nginx or systemd unless the user specifically asks or deployment requires it.

## Minimal Commands

Run commands from `/Users/donis/dev/Aisingerecosystemcopy`.

Build:

```bash
cd apps/web && npm run build
cd apps/admin && npm run build
cd apps/server && ./mvnw package -DskipTests
pnpm --filter @ai-star-eco/web-celebrity build
(cd apps/sau-service && .venv/bin/pytest -q)
```

Sync:

```bash
rsync -az --delete --exclude='.next/static' --exclude='public' apps/web/.next/standalone/ root@47.94.102.182:/opt/ai-star-eco/apps/web/.next/standalone/
rsync -az apps/web/.next/static/ root@47.94.102.182:/opt/ai-star-eco/apps/web/.next/standalone/.next/static/
rsync -az --delete apps/web/public/ root@47.94.102.182:/opt/ai-star-eco/apps/web/.next/standalone/public/
rsync -avz apps/web/next.config.mjs root@47.94.102.182:/opt/ai-star-eco/apps/web/next.config.mjs
rsync -avz --progress apps/web/public/videos/ root@47.94.102.182:/opt/ai-star-eco/static/videos/

rsync -az --delete --exclude='.next/static' --exclude='public' apps/admin/.next/standalone/ root@47.94.102.182:/opt/ai-star-eco/apps/admin/.next/standalone/
rsync -az apps/admin/.next/static/ root@47.94.102.182:/opt/ai-star-eco/apps/admin/.next/standalone/.next/static/
[ -d apps/admin/public ] && rsync -az --delete apps/admin/public/ root@47.94.102.182:/opt/ai-star-eco/apps/admin/.next/standalone/public/
rsync -avz apps/admin/next.config.mjs root@47.94.102.182:/opt/ai-star-eco/apps/admin/next.config.mjs

rsync -avz apps/server/target/ai-star-eco-server-1.0.0.jar root@47.94.102.182:/opt/ai-star-eco/apps/server/target/

rsync -az --delete --exclude='.next/static' --exclude='public' apps/web-celebrity/.next/standalone/ root@47.94.102.182:/opt/ai-star-eco/apps/web-celebrity/.next/standalone/
rsync -az apps/web-celebrity/.next/static/ root@47.94.102.182:/opt/ai-star-eco/apps/web-celebrity/.next/standalone/apps/web-celebrity/.next/static/
rsync -az --delete apps/web-celebrity/public/ root@47.94.102.182:/opt/ai-star-eco/apps/web-celebrity/.next/standalone/apps/web-celebrity/public/
rsync -avz apps/web-celebrity/next.config.mjs root@47.94.102.182:/opt/ai-star-eco/repo/apps/web-celebrity/next.config.mjs

rsync -az apps/sau-service/src/ root@47.94.102.182:/opt/ai-star-eco/repo/apps/sau-service/src/
```

Restart:

```bash
ssh root@47.94.102.182 'systemctl restart aistareco-web'
ssh root@47.94.102.182 'systemctl restart aistareco-admin'
ssh root@47.94.102.182 'systemctl restart aistareco-server'
ssh root@47.94.102.182 'systemctl restart aistareco-web-celebrity'
ssh root@47.94.102.182 'cd /opt/ai-star-eco/repo/apps/sau-service && DOCKER_BUILDKIT=1 docker build --build-arg INSTALL_REAL=1 -t aistareco/sau-service:real .'
ssh root@47.94.102.182 'docker rm -f aistareco-sau-service || true; docker run -d --name aistareco-sau-service --restart unless-stopped -p 127.0.0.1:8090:8090 --tmpfs /dev/shm:rw,size=1g --env-file /etc/aistareco/sau-service.env -v /opt/ai-star-eco/sau-debug-snapshots:/data/sau-debug aistareco/sau-service:real'
```

Verify:

```bash
curl -I -s http://47.94.102.182/web
curl -I -s http://47.94.102.182/admin
curl -I -s http://47.94.102.182:3012/
curl -I -s http://47.94.102.182/static/videos/showreel-05.mp4
curl -s http://47.94.102.182/api/auth/dev-accounts
ssh root@47.94.102.182 'curl -fsS http://127.0.0.1:8090/healthz'
```

## When Deployment Fails

- If `/web` or `/admin` briefly returns `502`, wait for the standalone Next server to print `Ready`.
- If `/web/_next/static/chunks/*.js` or `/admin/_next/static/chunks/*.js` returns 404, sync `next.config.mjs`, verify `.next/standalone/.next/static` exists remotely, and confirm Nginx `proxy_pass` does not strip the base path.
- If API returns `000` right after restart, continue polling for up to 3 minutes.
- If account binding shows no QR and access logs show `POST /api/me/social-accounts/bind-init 403`, test with a fresh dev-login token. This usually means the browser has stale `aistareco.auth.token`; backend should return 401 for invalid tokens so AuthProvider clears it.
- If `/me/social-accounts/bind-init` returns sau 500, inspect `docker logs --since 10m aistareco-sau-service`; `ModuleNotFoundError: patchright` means the image was built without `--build-arg INSTALL_REAL=1`.
- If `/me/social-accounts/bind-init` times out while navigating platform login pages, check `SAU_LOGIN_NAV_TIMEOUT_MS` in `/etc/aistareco/sau-service.env` and `SAU_REQUEST_TIMEOUT_MS` in `/etc/aistareco/server.env`.
- If server logs show MariaDB DDL warning around `aep_notifications.read`, note it as a known warning unless startup fails.
- If package files changed, sync `package.json` and lockfiles and run remote `npm install` in the affected app before restart.
