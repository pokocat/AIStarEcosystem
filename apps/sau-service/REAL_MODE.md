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

## 3. Get a real `storage_state.json` for a Douyin account

v1 does **not** implement in-browser QR login through sau-service yet (that's
a Phase B item). For now the operator runs the upstream's helper script once
per account on a workstation, then transfers the resulting JSON to the
server's encrypted `aep_social_accounts` table.

On the operator's machine:

```bash
git clone https://github.com/pokocat/social-auto-upload.git sau-upstream
cd sau-upstream
pip install -e .
patchright install chromium

# Drops into chromium, you scan with the Douyin app, the script saves
# cookies/<accountName>.json. (Path/filename may vary across uploader
# subdirs; see examples/get_douyin_cookie.py for the canonical flow.)
python examples/get_douyin_cookie.py --account_name producer-team-1
```

That produces a JSON file. Copy it somewhere reachable, then …

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

- In-browser QR login through sau-service (replace `/login/poll`'s mock
  branch with patchright screenshot + scan-state polling).
- `kuaishou`, `xiaohongshu`, `shipinhao` upstream wrappers (mirror the
  `_upload_douyin` helper in `uploader.py`).
- Admin endpoint to import a storage_state without raw SQL.
- Per-platform pricing via `PlatformConfig`; v1 hardcodes 20 credits per
  upload in `apps/server/src/main/resources/application.yml` (`sau.default-upload-cost`).
