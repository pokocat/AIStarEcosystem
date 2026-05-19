# sau-service

Stateless Python + Playwright worker that bridges `apps/server` (Spring Boot) and the
[social-auto-upload (sau)](https://github.com/dreammis/social-auto-upload) library.

## Why a separate service

Java cannot drive Playwright directly. `apps/server` owns the source of truth (DB,
encrypted cookies, jobs, ledger) and delegates the browser-automation step to this
worker over HTTP. The worker is stateless — Playwright contexts only live in memory
during a single login flow or upload task, and tmpfs (`/dev/shm`) holds video files
and storage_state JSON for the duration of an upload.

```
  apps/server (8080)              sau-service (8090)
  ┌────────────────────┐  POST   ┌────────────────────────┐
  │ SauServiceClient   │ ──────▶ │ FastAPI shim           │
  │ AES-decrypt cookie │         │  /login/{start,poll}   │
  │ start-job tx       │         │  /accounts/verify      │
  └──────┬─────────────┘         │  /upload (taskId)      │
         │  POST                 │  /tasks/{id}, cancel   │
         │  /api/internal/sau    │  ──┐                   │
         ◀───────────────────────┘    │ Playwright in     │
         job-callback (idempotent)    │ memory + tmpfs    │
                                      └───────────────────┘
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/healthz` | Liveness — returns `{ok: true, mockMode}` |
| `POST` | `/login/start` | Open platform login page, capture QR, return ticket + base64 QR |
| `GET`  | `/login/poll?ticket=…` | Returns `{status, storageStatePlain?, profile?}` (success returns plaintext storage_state once) |
| `POST` | `/accounts/verify` | Run a verify pass against existing storage_state; may return refreshed cookie |
| `POST` | `/upload` | Submit an upload task; returns `{taskId}`. Progress streams back via `callbackUrl` |
| `GET`  | `/tasks/{taskId}` | Resume sweep — current status snapshot |
| `POST` | `/tasks/{taskId}/cancel` | Best-effort cancel |

All routes require the `X-Internal-Secret` header (shared with `apps/server`'s
`InternalAuthFilter`).

## Cookie & storage_state handling

- Cookies (Playwright `storage_state` JSON) **never persist** in this service.
- Login flow: capture in memory inside a Playwright context, hand the JSON back to
  the server in the `/login/poll` response, then drop the context.
- Upload flow: the server sends the plaintext JSON in the `/upload` request body,
  sau-service writes it to `/dev/shm/{taskId}-state.json`, hands the path to the
  uploader, and unlinks the file when the task finishes (success or failure).
- No PVC, no on-disk persistence — by design.

## v1 mock mode

Set `SAU_MOCK_MODE=1` (default) to skip real Playwright work. The mock uploader
returns synthetic QR codes / synthetic storage_state / synthetic upload progress,
which is enough for `apps/server` to exercise the full state machine.

Slice 5 of the rollout swaps `uploader.py` and `qr.py` over to the patched
[`pokocat/social-auto-upload`](https://github.com/pokocat/social-auto-upload) fork.

## Local dev

```bash
cd apps/sau-service
docker compose up --build
# or, without docker:
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
SAU_MOCK_MODE=1 uvicorn sau_service.main:app --reload --port 8090
```

Smoke test:

```bash
curl -H 'X-Internal-Secret: aep-dev-internal-secret-change-in-prod' \
     http://localhost:8090/healthz
```

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `SAU_INTERNAL_SECRET` | `aep-dev-internal-secret-change-in-prod` | Shared with apps/server `aep.internal.secret` |
| `SAU_MOCK_MODE` | `1` | `1` skips Playwright (Slice 3); `0` routes to forked sau (Slice 5+) |
| `SAU_MAX_CONCURRENCY` | `2` | asyncio worker pool size for `/upload` |
| `SAU_LOGIN_TICKET_TTL_S` | `300` | seconds before in-memory login context is dropped |
| `SAU_DEFAULT_CALLBACK_BASE` | unset | optional default for the callback URL if server omits it |

## Tests

```bash
pip install -e '.[dev]'
pytest
```
