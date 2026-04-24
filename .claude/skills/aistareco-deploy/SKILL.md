---
name: aistareco-deploy
description: Deploy the AI Star Eco monorepo to the production server at 47.94.102.182. Use when the user asks to deploy, redeploy, publish, sync web/admin/server changes, upload frontend video assets, restart production services, verify /web /admin /api, or document/standardize the AI Star Eco deployment workflow.
---

# AI Star Eco Deploy

Use this skill to deploy the AI Star Eco monorepo from `/Users/donis/dev/Aisingerecosystemcopy` to the production server.

For topology, exact paths, service names, verification endpoints, and known caveats, read [production.md](references/production.md) when doing any real deployment.

## Default Workflow

1. Inspect local changes with `git status --short`.
2. Decide deploy scope:
   - If only `apps/web` changed, deploy `web` and static videos.
   - If only `apps/admin` changed, deploy `admin`.
   - If `apps/server` changed, deploy `server`.
   - If unsure, deploy all three.
3. Build locally before syncing:
   - `apps/web`: `npm run build`
   - `apps/admin`: `npm run build`
   - `apps/server`: `./mvnw package -DskipTests`
4. Sync artifacts to production with `rsync`.
5. Restart only affected services unless doing a full deploy.
6. Verify public endpoints and service logs.
7. Report what was deployed, what passed, and any known residual risk.

## Important Rules

- Prefer local builds and remote artifact sync. Avoid remote `next build`; it has historically been slower and can hang.
- Always sync `apps/web/public/videos/` to `/opt/ai-star-eco/static/videos/` when deploying `web` or any appearance/video change.
- Use `/web` and `/admin` as public paths. Do not verify root-level Next pages without the base path.
- Expect Spring Boot startup to take 2-3 minutes after restarting `aistareco-server`; poll `/api/auth/dev-accounts` instead of assuming failure.
- Do not print or overwrite secrets from `/etc/aistareco/server.env`.
- Do not change Nginx or systemd unless the user specifically asks or deployment requires it.

## Minimal Commands

Run commands from `/Users/donis/dev/Aisingerecosystemcopy`.

Build:

```bash
cd apps/web && npm run build
cd apps/admin && npm run build
cd apps/server && ./mvnw package -DskipTests
```

Sync:

```bash
rsync -avz --delete apps/web/.next/ root@47.94.102.182:/opt/ai-star-eco/apps/web/.next/
rsync -avz apps/web/src/ root@47.94.102.182:/opt/ai-star-eco/apps/web/src/
rsync -avz --progress apps/web/public/videos/ root@47.94.102.182:/opt/ai-star-eco/static/videos/

rsync -avz --delete apps/admin/.next/ root@47.94.102.182:/opt/ai-star-eco/apps/admin/.next/
rsync -avz apps/admin/src/ root@47.94.102.182:/opt/ai-star-eco/apps/admin/src/

rsync -avz apps/server/target/ai-star-eco-server-1.0.0.jar root@47.94.102.182:/opt/ai-star-eco/apps/server/target/
```

Restart:

```bash
ssh root@47.94.102.182 'systemctl restart aistareco-web'
ssh root@47.94.102.182 'systemctl restart aistareco-admin'
ssh root@47.94.102.182 'systemctl restart aistareco-server'
```

Verify:

```bash
curl -I -s http://47.94.102.182/web
curl -I -s http://47.94.102.182/admin
curl -I -s http://47.94.102.182/static/videos/showreel-05.mp4
curl -s http://47.94.102.182/api/auth/dev-accounts
```

## When Deployment Fails

- If `/web` or `/admin` briefly returns `502`, wait for `next start` to print `Ready`.
- If API returns `000` right after restart, continue polling for up to 3 minutes.
- If server logs show MariaDB DDL warning around `aep_notifications.read`, note it as a known warning unless startup fails.
- If package files changed, sync `package.json` and lockfiles and run remote `npm install` in the affected app before restart.
