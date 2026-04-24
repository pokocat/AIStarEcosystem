# AI Star Eco Production Reference

## Host

- SSH: `root@47.94.102.182`
- Project root: `/opt/ai-star-eco`
- Web app: `/opt/ai-star-eco/apps/web`
- Admin app: `/opt/ai-star-eco/apps/admin`
- Server app: `/opt/ai-star-eco/apps/server`
- Shared videos: `/opt/ai-star-eco/static/videos`

## Public Routes

- `http://47.94.102.182/web`
- `http://47.94.102.182/admin`
- `http://47.94.102.182/api/*`
- `http://47.94.102.182/static/videos/*`

## Local Ports on Server

- `aistareco-server`: `127.0.0.1:8080`
- `aistareco-web`: `127.0.0.1:3002`
- `aistareco-admin`: `127.0.0.1:3003`

## Services

```bash
systemctl status --no-pager aistareco-web
systemctl status --no-pager aistareco-admin
systemctl status --no-pager aistareco-server
journalctl -u aistareco-web -n 40 --no-pager
journalctl -u aistareco-admin -n 40 --no-pager
journalctl -u aistareco-server -n 80 --no-pager
```

## Environment

- Nginx config: `/etc/nginx/conf.d/ai.conf`
- Server env: `/etc/aistareco/server.env`
- Required behavior:
  - `SPRING_PROFILES_ACTIVE=mysql`
  - `AEP_DEV_AUTH_ENABLED=true`
  - `AEP_FORGE_VIDEO_BASE=/static/videos`

Do not print secrets from `server.env` in user-facing answers.

## Nginx Shape

- `/` redirects to `/web`
- `/web` proxies to `127.0.0.1:3002`
- `/admin` proxies to `127.0.0.1:3003`
- `/api/` proxies to `127.0.0.1:8080`
- `/static/videos/` aliases `/opt/ai-star-eco/static/videos/`

## Verification Checklist

```bash
curl -I -s http://47.94.102.182/web
curl -I -s http://47.94.102.182/admin
curl -I -s http://47.94.102.182/static/videos/showreel-05.mp4
curl -s http://47.94.102.182/api/auth/dev-accounts
```

Expected:

- `/web`: `200 OK`
- `/admin`: `200 OK`
- `/static/videos/showreel-05.mp4`: `200 OK`, `Content-Type: video/mp4`
- `/api/auth/dev-accounts`: JSON with `success: true`

## Poll Server After Restart

```bash
ssh root@47.94.102.182 'for i in $(seq 1 36); do code=$(curl -s -o /tmp/aistareco-dev-accounts.json -w "%{http_code}" http://127.0.0.1:8080/api/auth/dev-accounts || true); if [ "$code" = "200" ]; then echo "$code"; cat /tmp/aistareco-dev-accounts.json; exit 0; fi; sleep 5; done; journalctl -u aistareco-server -n 80 --no-pager; exit 1'
```

## Current Static Video Pool

Local source:

- `apps/web/public/videos/showreel-01.mp4`
- `apps/web/public/videos/showreel-02.mp4`
- `apps/web/public/videos/showreel-03.mp4`
- `apps/web/public/videos/showreel-04.mp4`
- `apps/web/public/videos/showreel-05.mp4`

Remote target:

- `/opt/ai-star-eco/static/videos/showreel-01.mp4`
- `/opt/ai-star-eco/static/videos/showreel-02.mp4`
- `/opt/ai-star-eco/static/videos/showreel-03.mp4`
- `/opt/ai-star-eco/static/videos/showreel-04.mp4`
- `/opt/ai-star-eco/static/videos/showreel-05.mp4`

If adding a new video that should be randomly assigned by the forge save flow, update both:

- `apps/web/src/lib/forge-video.ts`
- `apps/server/src/main/java/com/aistareco/aep/controller/ForgeController.java`
