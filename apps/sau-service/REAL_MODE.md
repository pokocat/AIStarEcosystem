# sau-service real-mode runbook

Default sau-service runs with `SAU_MOCK_MODE=1` and a synthetic uploader, which
is what apps/server's automated integration tests rely on. This document walks
through enabling the real Playwright path on top of the patched
[pokocat/social-auto-upload](https://github.com/pokocat/social-auto-upload) fork.

v1 ships real-mode for **抖音 (douyin)** only. The other v1-enabled platforms
(`kuaishou`, `xiaohongshu`, `shipinhao`) return `PLATFORM_REAL_NOT_WIRED` —
they'll come online in follow-up commits as their selectors are validated
against real accounts.

---

## 1. Build the real-mode image

```bash
cd apps/sau-service

# pulls patchright 1.58.2 + the pinned upstream fork + downloads chromium
docker build \
  --build-arg INSTALL_REAL=1 \
  -t aistareco/sau-service:real \
  .
```

The image is ~1.5 GB once chromium is unpacked. Without `--build-arg
INSTALL_REAL=1` you still get the slim mock-mode image (~250 MB).

If you bump the upstream SHA, edit `pyproject.toml` →
`[project.optional-dependencies].real` → `social-auto-upload @ git+...@<SHA>`.
Current pin: `721476f7b49c2c8c4625ea9b053745b89138d5d8` (main as of
2026-05-17).

---

## 2. Deploy with real-mode enabled

```bash
docker run -d --name sau-service \
  -p 8090:8090 \
  --tmpfs /dev/shm:rw,size=2g \
  -e SAU_INTERNAL_SECRET="$AEP_INTERNAL_SECRET" \
  -e SAU_MOCK_MODE=0 \
  aistareco/sau-service:real
```

Sanity check:

```bash
curl -fsS -H "X-Internal-Secret: $AEP_INTERNAL_SECRET" \
     http://localhost:8090/healthz
# → {"ok": true, "mockMode": false, "version": "0.1.0"}
```

---

## 3. Bind a Douyin account via the in-browser QR flow (recommended)

sau-service now drives the QR login itself: the user clicks "绑定账号" in
`/distribution`, the server calls `POST /login/start` on sau-service, sau-service
launches a headless patchright chromium against `https://creator.douyin.com/`,
screenshots the on-page QR, and returns it as a `data:image/png` URL. The
frontend renders the image; the user scans with the Douyin app; sau-service's
`/login/poll` watches `page.url` and — once it switches to a logged-in
fragment (`creator-micro`, `/creator/home`, `/creator-center`) — dumps
`context.storage_state()` and tears the browser down.

End-to-end, no operator step required:

1. UI: `/distribution` → 绑定账号 → 抖音 → 输入别名 → 确认
2. UI shows the QR image (which is a live screenshot of creator.douyin.com)
3. User scans with the Douyin app
4. Server polls `/me/social-accounts/bind-poll` every ~1.5s; on success the
   account flips to `active` with `storage_state_encrypted` populated
5. Account appears in `/distribution` `已绑定账号` list

Operator tunables (env vars on the sau-service container):

| var | default | meaning |
| --- | --- | --- |
| `SAU_LOGIN_TICKET_TTL_S` | `300` | per-QR session lifetime; chromium gets torn down after this |
| `SAU_REAL_LOGIN_HEADLESS` | `1` | set `0` on a workstation to watch the browser while debugging |

The QR is captured once at `/login/start`. If the user takes too long to
scan and the page-side QR expires, the user re-clicks "绑定账号" to mint a
fresh session.

### 3a. Manual import fallback (for v1-enabled platforms that aren't wired yet)

`kuaishou` / `xiaohongshu` / `shipinhao` still come back from
`/login/start` with `PLATFORM_REAL_LOGIN_NOT_WIRED` until their selectors
are validated against a real account. For those, run the upstream's helper
script once per account on a workstation and import the result into
`aep_social_accounts` (see §4 below):

```bash
git clone https://github.com/pokocat/social-auto-upload.git sau-upstream
cd sau-upstream
pip install -e .
patchright install chromium

# Drops into chromium, you scan with the app, the script saves
# cookies/<accountName>.json. Path/filename varies; see
# examples/get_<platform>_cookie.py for each canonical flow.
python examples/get_kuaishou_cookie.py --account_name producer-team-1
```

---

## 4. Import the cookie into apps/server (DB-level workaround)

Until an admin-facing import endpoint exists, the only path is direct DB
write of an AES-encrypted blob. The encryption uses the same key
`AEP_SECRET_KEY` as the running server. Easiest is to call into the
already-deployed Spring `AepCryptoUtil` via a one-shot JVM eval:

```bash
# From apps/server/, with AEP_SECRET_KEY identical to the running process.
mvn -q exec:java \
  -Dexec.mainClass=com.aistareco.tools.EncryptStorageState \
  -Dexec.args="path/to/storage_state.json"
# prints the base64 ciphertext
```

(That helper main class doesn't ship yet — paste the small one-liner from
`apps/server/src/main/java/com/aistareco/common/AepCryptoUtil.java`'s
`encrypt(String)` into a scratch class until the proper admin tool lands.)

Then INSERT into the DB:

```sql
INSERT INTO aep_social_accounts
    (id, user_id, platform, account_name, status,
     display_name, avatar_url, storage_state_encrypted,
     bound_at, last_verified_at, created_at, updated_at)
VALUES
    ('sa-' || lower(hex(randomblob(8))),   -- any unique id
     '<aep_users.id of the owner>',
     'DOUYIN',
     'producer-team-1',
     'ACTIVE',
     '团队主号 (manual import)',
     NULL,
     '<base64 ciphertext from step above>',
     CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP);
```

H2 console (dev profile) accepts the above directly. MySQL prod is the same
with `UUID()` for the id and `NOW()` for the timestamps.

---

## 5. End-to-end smoke test

After the manual import:

```bash
# Server running on :8080 with AEP_SECRET_KEY=<same key used for import>
# sau-service running on :8090 with SAU_MOCK_MODE=0 and matching SAU_INTERNAL_SECRET

# 5.1 confirm the account is visible to its owner
curl -fsS -H "Authorization: Bearer <jwt-for-owner>" \
     http://localhost:8080/api/me/social-accounts
# → array containing the imported row, status=active

# 5.2 verify cookie still works (round-trips to sau-service /accounts/verify)
curl -fsS -X POST \
     -H "Authorization: Bearer <jwt-for-owner>" \
     http://localhost:8080/api/me/social-accounts/<id>/verify

# 5.3 create a publish job
curl -fsS -X POST \
     -H "Authorization: Bearer <jwt-for-owner>" \
     -H "Content-Type: application/json" \
     -d '{
       "projectId": "<existing-celebrity-project-id>",
       "videoUrl": "https://<your-cdn>/video.mp4",
       "title": "测试发布",
       "description": "sau real-mode smoke",
       "tags": ["test"],
       "targets": [{"platform":"douyin","socialAccountId":"<id>"}]
     }' \
     http://localhost:8080/api/me/publish-jobs

# 5.4 start it (debits credits!)
curl -fsS -X POST \
     -H "Authorization: Bearer <jwt-for-owner>" \
     http://localhost:8080/api/me/publish-jobs/<jobId>/start

# 5.5 watch progress
watch -n 2 "curl -fsS -H 'Authorization: Bearer <jwt-for-owner>' \
            http://localhost:8080/api/me/publish-jobs/<jobId>"
```

In the web-celebrity UI:

1. Log in, `/distribution` shows the imported account under `已绑定账号`.
2. Trigger the start button on the queued job — status walks
   queued → uploading → publishing → live (or → failed).
3. /dev/shm inside the sau-service container holds the video and the
   `<task_id>-state.json` for the duration of the upload; both unlinked on
   completion.

---

## 6. What still needs work (Phase B)

- `kuaishou`, `xiaohongshu`, `shipinhao` upstream wrappers — both upload
  (`_upload_<platform>` in `uploader.py`) and login (`LOGIN_PAGE_URLS` +
  `LOGGED_IN_URL_FRAGMENTS` entries in `login_pool.py`).
- Admin endpoint to import a storage_state without raw SQL.
- Per-platform pricing via `PlatformConfig`; v1 hardcodes 20 credits per
  upload in `apps/server/src/main/resources/application.yml` (`sau.default-upload-cost`).
