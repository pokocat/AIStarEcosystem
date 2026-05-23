# AI Star Eco Production Reference

## Host

- SSH: `root@47.94.102.182`
- Project root: `/opt/ai-star-eco`
- Web app: `/opt/ai-star-eco/apps/web`
- Admin app: `/opt/ai-star-eco/apps/admin`
- Celebrity app runtime: `/opt/ai-star-eco/apps/web-celebrity`
- Remote repo checkout: `/opt/ai-star-eco/repo`
- Server app: `/opt/ai-star-eco/apps/server`
- Shared videos: `/opt/ai-star-eco/static/videos`
- sau debug snapshots: `/opt/ai-star-eco/sau-debug-snapshots`

## Public Routes

- `http://47.94.102.182/web`
- `http://47.94.102.182/admin`
- `http://47.94.102.182:3012/`
- `http://47.94.102.182/api/*`
- `http://47.94.102.182/static/videos/*`

## Local Ports on Server

- `aistareco-server`: `127.0.0.1:8080`
- `aistareco-web`: `127.0.0.1:3002`
- `aistareco-admin`: `127.0.0.1:3003`
- `aistareco-web-celebrity`: `0.0.0.0:3012`
- `aistareco-sau-service`: Docker, `127.0.0.1:8090`

## Services

```bash
systemctl status --no-pager aistareco-web
systemctl status --no-pager aistareco-admin
systemctl status --no-pager aistareco-server
systemctl status --no-pager aistareco-web-celebrity
docker ps --filter name=aistareco-sau-service
journalctl -u aistareco-web -n 40 --no-pager
journalctl -u aistareco-admin -n 40 --no-pager
journalctl -u aistareco-server -n 80 --no-pager
journalctl -u aistareco-web-celebrity -n 80 --no-pager
docker logs --tail 120 aistareco-sau-service
```

## Environment

- Nginx config: `/etc/nginx/conf.d/ai.conf`
- Server env: `/etc/aistareco/server.env`
- sau-service env: `/etc/aistareco/sau-service.env`
- web-celebrity env: `/opt/ai-star-eco/repo/apps/web-celebrity/.env`
- Required behavior:
  - `SPRING_PROFILES_ACTIVE=mysql`
  - `AEP_DEV_AUTH_ENABLED=true`
  - `AEP_FORGE_VIDEO_BASE=/static/videos`
  - `AEP_CORS_ALLOWED_ORIGIN_PATTERNS` includes `http://47.94.102.182:3012`
  - `SAU_REQUEST_TIMEOUT_MS=150000`
  - `SAU_LOGIN_NAV_TIMEOUT_MS=90000`
  - `NEXT_PUBLIC_API_BASE_URL=http://47.94.102.182/api`
  - `NEXT_PUBLIC_SERVER_API_BASE=http://127.0.0.1:8080`

Do not print secrets from `server.env` in user-facing answers.

## Nginx Shape

- `/` redirects to `/web`
- `/web` proxies to `127.0.0.1:3002`
- `/admin` proxies to `127.0.0.1:3003`
- `/api/` proxies to `127.0.0.1:8080`
- `/static/videos/` aliases `/opt/ai-star-eco/static/videos/`

`/api/` must allow long-running account binding QR initialization:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 30s;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
    client_max_body_size 100m;
}
```

Because `web` and `admin` use `basePath`, Nginx must preserve the full request URI:

```nginx
location = /web {
    proxy_pass http://127.0.0.1:3002;
}

location /web/ {
    proxy_pass http://127.0.0.1:3002;
}

location = /admin {
    proxy_pass http://127.0.0.1:3003;
}

location /admin/ {
    proxy_pass http://127.0.0.1:3003;
}
```

Do not use `proxy_pass http://127.0.0.1:3002/;` or `proxy_pass http://127.0.0.1:3003/;` for these locations. The trailing slash strips `/web` or `/admin` from asset URLs and causes chunk 404s.

## Next Standalone Runtime

Production Next apps should be built with `output: "standalone"` and started with Node directly:

```ini
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=HOSTNAME=127.0.0.1
WorkingDirectory=/opt/ai-star-eco/apps/web
ExecStart=/root/.nvm/versions/node/v24.14.1/bin/node .next/standalone/server.js
```

Admin is the same shape with `PORT=3003` and `WorkingDirectory=/opt/ai-star-eco/apps/admin`.

Celebrity is the same standalone shape, but uses direct port access:

```ini
Environment=NODE_ENV=production
Environment=PORT=3012
Environment=HOSTNAME=0.0.0.0
WorkingDirectory=/opt/ai-star-eco/apps/web-celebrity
ExecStart=/root/.nvm/versions/node/v24.14.1/bin/node .next/standalone/apps/web-celebrity/server.js
```

Deploy only these Next runtime artifacts:

- `.next/standalone/`
- `.next/static/` copied to remote `.next/standalone/.next/static/`
- `public/` copied to remote `.next/standalone/public/`
- `next.config.mjs`

Do not use `next start` for standalone deployments.

Use `--delete` for the standalone runtime itself, but exclude `.next/static` and `public` from that delete pass. Sync `.next/static` without `--delete` so old immutable chunks remain available for browsers with cached HTML.

## Verification Checklist

```bash
curl -I -s http://47.94.102.182/web
curl -I -s http://47.94.102.182/admin
curl -I -s http://47.94.102.182:3012/
curl -I -s http://47.94.102.182/static/videos/showreel-05.mp4
curl -s http://47.94.102.182/api/auth/dev-accounts
ssh root@47.94.102.182 'curl -fsS http://127.0.0.1:8090/healthz'
```

Expected:

- `/web`: `200 OK`
- `/admin`: `200 OK`
- `:3012/`: `200 OK`
- `/static/videos/showreel-05.mp4`: `200 OK`, `Content-Type: video/mp4`
- `/api/auth/dev-accounts`: JSON with `success: true`
- `sau-service /healthz`: JSON with `ok: true` and `mockMode: false`

## Poll Server After Restart

```bash
ssh root@47.94.102.182 'for i in $(seq 1 36); do code=$(curl -s -o /tmp/aistareco-dev-accounts.json -w "%{http_code}" http://127.0.0.1:8080/api/auth/dev-accounts || true); if [ "$code" = "200" ]; then echo "$code"; cat /tmp/aistareco-dev-accounts.json; exit 0; fi; sleep 5; done; journalctl -u aistareco-server -n 80 --no-pager; exit 1'
```

## Celebrity Account Binding Smoke Test

Use the public API path and do not print JWTs or QR payloads:

```bash
python3 - <<'PY'
import json, urllib.request, urllib.error, urllib.parse
BASE='http://47.94.102.182/api'
ORIGIN='http://47.94.102.182:3012'
def request(path, method='GET', body=None, token=None, timeout=180):
    data = None if body is None else json.dumps(body).encode()
    headers = {'Origin': ORIGIN}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get('content-type'), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('content-type'), e.read()

st, ct, raw = request('/me/social-accounts', token='invalid', timeout=30)
print('invalid-token', st, ct)
st, ct, raw = request('/auth/dev-login', 'POST', {'username':'agency_moonrise'}, timeout=30)
print('dev-login', st, ct)
token = json.loads(raw)['data']['token']
st, ct, raw = request('/me/social-accounts/bind-init', 'POST', {'platform':'xiaohongshu','accountName':'codex-smoke'}, token)
print('bind-init', st, ct, len(raw))
if st == 200:
    ticket = json.loads(raw)['data'].get('sessionTicket')
    print('qr-ready', bool(ticket), bool(json.loads(raw)['data'].get('qrImageDataUrl')))
    if ticket:
        st, ct, raw = request('/me/social-accounts/bind-cancel?ticket=' + urllib.parse.quote(ticket), 'POST', None, token, timeout=30)
        print('cancel', st, ct)
PY
```

Expected:

- invalid token returns `401 application/json`.
- dev-login returns `200 application/json`.
- bind-init returns `200 application/json` with a `sessionTicket` and QR data, then cancel returns `204`.

If `bind-init` returns `403`, inspect browser localStorage for stale `aistareco.auth.token` and confirm the deployed server includes the custom authentication entry point.

## sau-service Docker Runtime

Real QR login requires the real extra:

```bash
ssh root@47.94.102.182 'cd /opt/ai-star-eco/repo/apps/sau-service && DOCKER_BUILDKIT=1 docker build --progress=plain --build-arg INSTALL_REAL=1 -t aistareco/sau-service:real .'
ssh root@47.94.102.182 'docker rm -f aistareco-sau-service || true; docker run -d --name aistareco-sau-service --restart unless-stopped -p 127.0.0.1:8090:8090 --tmpfs /dev/shm:rw,size=1g --env-file /etc/aistareco/sau-service.env -v /opt/ai-star-eco/sau-debug-snapshots:/data/sau-debug aistareco/sau-service:real'
```

Common failures:

- `ModuleNotFoundError: No module named 'patchright'`: rebuild with `--build-arg INSTALL_REAL=1`.
- platform `Page.goto` timeout: increase/check `SAU_LOGIN_NAV_TIMEOUT_MS` and `SAU_REQUEST_TIMEOUT_MS`.
- public `/api/me/social-accounts/bind-init` returns Nginx `504 text/html`: `/api/` proxy timeout is too short; set `proxy_read_timeout 180s` and `proxy_send_timeout 180s`.
- plain 500 from `/login/start`: inspect `docker logs --since 10m aistareco-sau-service`.

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
