"""End-to-end smoke test of the FastAPI surface in mock mode.

Run: `pytest` from apps/sau-service/.

We mount the app in-process via FastAPI's TestClient and stub the callback URL
with a tiny ASGI server-of-our-own that captures POST bodies — that way we
verify the full upload → callback fan-out without leaving Python.
"""

from __future__ import annotations

import asyncio
import json
from collections import deque

import pytest
from fastapi.testclient import TestClient

from sau_service import main


SECRET = "test-secret-1234"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("SAU_INTERNAL_SECRET", SECRET)
    monkeypatch.setenv("SAU_MOCK_MODE", "1")
    monkeypatch.setenv("SAU_LOGIN_TICKET_TTL_S", "60")
    monkeypatch.setenv("SAU_MAX_CONCURRENCY", "2")
    yield


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


def _h() -> dict[str, str]:
    return {"X-Internal-Secret": SECRET}


def test_healthz_open(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["mockMode"] is True


def test_auth_rejects_missing_secret(client: TestClient) -> None:
    r = client.post("/login/start", json={"ticket": "t1", "platform": "douyin", "accountName": "x"})
    assert r.status_code == 401


def test_login_start_returns_qr(client: TestClient) -> None:
    r = client.post(
        "/login/start",
        headers=_h(),
        json={"ticket": "t1", "platform": "douyin", "accountName": "alice"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["qrImageDataUrl"].startswith("data:image/png;base64,")
    assert body["expiresAt"]


def test_login_poll_progresses_to_success(client: TestClient) -> None:
    client.post(
        "/login/start",
        headers=_h(),
        json={"ticket": "t2", "platform": "douyin", "accountName": "bob"},
    )
    first = client.get("/login/poll", headers=_h(), params={"ticket": "t2"}).json()
    assert first["status"] == "pending"
    second = client.get("/login/poll", headers=_h(), params={"ticket": "t2"}).json()
    assert second["status"] == "success"
    assert "cookies" in second["storageStatePlain"]
    assert second["profile"]["displayName"] == "mock-bob"
    assert second["profile"]["platformAccountId"] == "mock-douyin-bob"
    # cookie consumed; another poll is now 'expired'
    third = client.get("/login/poll", headers=_h(), params={"ticket": "t2"}).json()
    assert third["status"] == "expired"


def test_verify_returns_valid_for_nonempty_state(client: TestClient) -> None:
    r = client.post(
        "/accounts/verify",
        headers=_h(),
        json={"platform": "douyin", "storageState": {"cookies": [{"name": "x", "value": "y"}]}},
    )
    assert r.status_code == 200
    assert r.json()["profile"]["platformAccountId"] == "mock-douyin"
    assert r.json()["valid"] is True


def test_verify_real_mode_unsupported_platform_returns_invalid(monkeypatch) -> None:
    """Real mode + a platform we haven't wired (bilibili) must return
    valid=False *without* importing patchright. The slim mock-mode CI doesn't
    have the [real] extra installed, so an unguarded import would 500.
    Also asserts we never up-flip a cookie we can't actually probe."""
    monkeypatch.setenv("SAU_INTERNAL_SECRET", SECRET)
    monkeypatch.setenv("SAU_MOCK_MODE", "0")

    with TestClient(main.app) as client:
        r = client.post(
            "/accounts/verify",
            headers=_h(),
            json={"platform": "bilibili", "storageState": {"cookies": [{"name": "x", "value": "y"}]}},
        )
        assert r.status_code == 200
        assert r.json() == {"valid": False, "refreshedStorageState": None, "profile": None}


def test_upload_lifecycle_pushes_callbacks(client: TestClient, tmp_path, monkeypatch) -> None:
    """Submit an upload, capture the callbacks, assert we reach status=live."""
    received: deque[dict] = deque()

    async def fake_post(callback_url, callback_secret, payload, **_):  # type: ignore[no-untyped-def]
        received.append(payload)
        return True

    monkeypatch.setattr("sau_service.uploader.post_callback", fake_post)
    monkeypatch.setattr("sau_service.main.UploadManager._materialise_tmpfs", _materialise_into_tmp(tmp_path))

    r = client.post(
        "/upload",
        headers=_h(),
        json={
            "platform": "douyin",
            "accountName": "alice",
            "videoUrl": "https://example.test/video.mp4",
            "title": "hello",
            "description": "world",
            "tags": ["t1"],
            "storageState": {"cookies": []},
            "callbackUrl": "http://test/callback",
            "callbackSecret": "irrelevant-because-stubbed",
        },
    )
    assert r.status_code == 200
    task_id = r.json()["taskId"]

    # Mock uploader sleeps 0.4s between transitions; let it finish.
    asyncio.run(_wait_until_finished(client, task_id, timeout_s=10.0))

    statuses = [evt["status"] for evt in received]
    assert "live" in statuses, f"never reached live: {statuses}"
    # Last event should be live with the synthetic URL filled in.
    last = received[-1]
    assert last["status"] == "live"
    assert last["progress"] == 100
    assert last["externalUrl"] is not None


def _materialise_into_tmp(tmp_path):
    async def _impl(self, rec):  # type: ignore[no-untyped-def]
        rec.state_path = str(tmp_path / f"{rec.task_id}-state.json")
        with open(rec.state_path, "w", encoding="utf-8") as fh:
            json.dump(rec.request.storage_state, fh)
        rec.video_path = None

    return _impl


async def _wait_until_finished(client: TestClient, task_id: str, *, timeout_s: float) -> None:
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        snap = client.get(f"/tasks/{task_id}", headers=_h()).json()
        if snap["status"] in {"live", "failed", "cancelled"}:
            return
        await asyncio.sleep(0.2)
    raise AssertionError(f"task {task_id} didn't finish in {timeout_s}s")


def test_real_login_drivers_implement_full_surface() -> None:
    """Every PlatformDriver subclass registered in DRIVERS must override the
    three abstract methods (extract_qr_data_url / is_logged_in /
    extract_profile) and have a non-empty LOGIN_URL. Catches a "I added
    the driver to DRIVERS but forgot extract_qr_data_url" half-wire that
    would 500 the first time anyone tried real-mode bind."""
    from sau_service.login_pool import DRIVERS, PlatformDriver

    for name, cls in DRIVERS.items():
        assert issubclass(cls, PlatformDriver), f"{name} driver doesn't subclass PlatformDriver"
        assert cls.LOGIN_URL, f"{name} driver has empty LOGIN_URL"
        for method in ("extract_qr_data_url", "is_logged_in", "extract_profile"):
            # Each subclass must override; the base method raises
            # NotImplementedError (or returns the trivial profile fallback).
            base_fn = getattr(PlatformDriver, method)
            sub_fn = getattr(cls, method)
            assert sub_fn is not base_fn or method == "extract_profile", (
                f"{name} driver doesn't override {method}"
            )

    # The two currently-wired platforms.
    assert set(DRIVERS) >= {"douyin", "shipinhao"}


def test_douyin_profile_text_helpers_parse_creator_header() -> None:
    from sau_service.login_pool import (
        _extract_labeled_account_id,
        _extract_text_before_label,
        _is_placeholder_profile_text,
    )

    text = "用户7030315623774 | 抖音号：1794189054 | 这个人很懒，没有留下任何签名"
    assert _extract_labeled_account_id(text, ("抖音号",)) == "1794189054"
    assert _extract_text_before_label(text, "抖音号") == "用户7030315623774"
    assert _extract_text_before_label("用户7030315623774 抖音号：1794189054", "抖音号") == "用户7030315623774"
    assert _extract_text_before_label("加载中，请稍候...", "抖音号") is None
    assert _is_placeholder_profile_text("加载中，请稍候...")


def test_real_login_start_rejects_unsupported_platform(monkeypatch) -> None:
    """Real-mode + unknown platform must return 501 *before* touching patchright.

    The slim mock-mode CI doesn't install the `[real]` extra, so we exercise
    the early-reject branch via a platform not in LOGIN_PAGE_URLS (bilibili).
    Ensures operators flipping SAU_MOCK_MODE=0 get a clear
    PLATFORM_REAL_LOGIN_NOT_WIRED rather than an ImportError surfacing as
    500.
    """
    monkeypatch.setenv("SAU_INTERNAL_SECRET", SECRET)
    monkeypatch.setenv("SAU_MOCK_MODE", "0")
    monkeypatch.setenv("SAU_LOGIN_TICKET_TTL_S", "60")

    with TestClient(main.app) as client:
        r = client.post(
            "/login/start",
            headers=_h(),
            json={"ticket": "real-1", "platform": "bilibili", "accountName": "b-test"},
        )
        assert r.status_code == 501
        detail = r.json()["detail"]
        assert detail["code"] == "PLATFORM_REAL_LOGIN_NOT_WIRED"
        assert "bilibili" in detail["message"]


# ── _run_upstream_upload guard (timeout / cancel / publishing watchdog) ─────


def _make_manager_for_guard():
    """Spin up a UploadManager without going through FastAPI lifespan.

    We exercise `_run_upstream_upload` directly with synthetic upload
    coroutines so we don't need patchright installed. The TaskRecord is
    pre-registered on `mgr._tasks` so `submit_interaction(task_id)` can
    find it during SMS watcher tests.
    """
    from sau_service.uploader import TaskRecord, UploadManager, UploadRequest

    mgr = UploadManager(max_concurrency=1, mock_mode=True, tmpfs_dir="/tmp/sau-guard-test")
    req = UploadRequest(
        job_id="job-guard",
        platform="douyin",
        account_name="alice",
        video_url="https://example.test/video.mp4",
        title="t",
        description=None,
        tags=[],
        cover_url=None,
        storage_state={},
        callback_url="http://test/callback",
        callback_secret="x",
    )
    rec = TaskRecord(task_id="task-guard", request=req)
    mgr._tasks[rec.task_id] = rec
    return mgr, rec


def test_run_upstream_upload_returns_true_on_success(monkeypatch) -> None:
    """Happy path: upstream returns cleanly, watchdog never fires, ok=True."""
    monkeypatch.setattr("sau_service.uploader.UPLOAD_TIMEOUT_S", 5.0)
    monkeypatch.setattr("sau_service.uploader.PUBLISHING_AFTER_S", 5.0)
    pushed: list[dict] = []

    async def fake_push(rec):
        pushed.append({"status": rec.status, "progress": rec.progress})

    mgr, rec = _make_manager_for_guard()
    monkeypatch.setattr(type(mgr), "_push", lambda self, r: fake_push(r))

    async def quick_upload():
        await asyncio.sleep(0.05)

    async def run():
        return await mgr._run_upstream_upload(rec, quick_upload, platform_label="douyin")

    ok = asyncio.run(run())
    assert ok is True
    # publishing watchdog did NOT fire (5s > 0.05s upload)
    assert all(p["status"] != "publishing" for p in pushed)


def test_run_upstream_upload_publishes_watchdog_status(monkeypatch) -> None:
    """After PUBLISHING_AFTER_S the task should be pushed as publishing/80."""
    monkeypatch.setattr("sau_service.uploader.UPLOAD_TIMEOUT_S", 5.0)
    monkeypatch.setattr("sau_service.uploader.PUBLISHING_AFTER_S", 0.2)
    pushed: list[dict] = []

    async def fake_push(rec):
        pushed.append({"status": rec.status, "progress": rec.progress})

    mgr, rec = _make_manager_for_guard()
    monkeypatch.setattr(type(mgr), "_push", lambda self, r: fake_push(r))

    async def slow_upload():
        await asyncio.sleep(0.6)  # > 0.2s watchdog, < 5s timeout

    async def run():
        return await mgr._run_upstream_upload(rec, slow_upload, platform_label="douyin")

    ok = asyncio.run(run())
    assert ok is True
    # Watchdog fired in the middle
    assert any(p["status"] == "publishing" and p["progress"] == 80 for p in pushed), (
        f"watchdog should have pushed publishing/80, got: {pushed}"
    )


def test_run_upstream_upload_times_out(monkeypatch) -> None:
    """Upstream that never returns must be force-cancelled with UPLOAD_TIMEOUT."""
    monkeypatch.setattr("sau_service.uploader.UPLOAD_TIMEOUT_S", 0.3)
    monkeypatch.setattr("sau_service.uploader.PUBLISHING_AFTER_S", 5.0)
    pushed: list[dict] = []

    async def fake_push(rec):
        pushed.append(
            {
                "status": rec.status,
                "progress": rec.progress,
                "error_code": rec.error_code,
                "error_message": rec.error_message,
            }
        )

    mgr, rec = _make_manager_for_guard()
    monkeypatch.setattr(type(mgr), "_push", lambda self, r: fake_push(r))

    async def hung_upload():
        # Mimic upstream's `while True` publish-button loop with no exit.
        while True:
            await asyncio.sleep(0.05)

    async def run():
        return await mgr._run_upstream_upload(rec, hung_upload, platform_label="douyin")

    ok = asyncio.run(run())
    assert ok is False
    # Final push reflects timeout failure
    last = pushed[-1]
    assert last["status"] == "failed"
    assert last["error_code"] == "UPLOAD_TIMEOUT"
    assert "180" in last["error_message"] or "0" in last["error_message"]  # contains the timeout figure


def test_run_upstream_upload_honours_cancel_event(monkeypatch) -> None:
    """rec.cancel_event must abort an in-flight upstream upload promptly."""
    monkeypatch.setattr("sau_service.uploader.UPLOAD_TIMEOUT_S", 5.0)
    monkeypatch.setattr("sau_service.uploader.PUBLISHING_AFTER_S", 5.0)
    pushed: list[dict] = []

    async def fake_push(rec):
        pushed.append({"status": rec.status, "progress": rec.progress})

    mgr, rec = _make_manager_for_guard()
    monkeypatch.setattr(type(mgr), "_push", lambda self, r: fake_push(r))

    async def hung_upload():
        while True:
            await asyncio.sleep(0.05)

    async def run():
        async def fire_cancel():
            await asyncio.sleep(0.1)
            rec.cancel_event.set()

        cancel_setter = asyncio.create_task(fire_cancel())
        try:
            return await mgr._run_upstream_upload(rec, hung_upload, platform_label="douyin")
        finally:
            cancel_setter.cancel()
            try:
                await cancel_setter
            except asyncio.CancelledError:
                pass

    ok = asyncio.run(run())
    assert ok is False
    # _terminate pushes the cancelled status
    assert any(p["status"] == "cancelled" for p in pushed), f"expected cancelled, got: {pushed}"


# ── SMS interaction watcher (awaiting_user end-to-end) ──────────────────────


class _FakeSmsDriver:
    """In-memory driver used by SMS watcher tests.

    Behaviour is scripted via instance attributes — first detect() returns
    `phone_masked` payload, then after submit_code succeeds is_cleared
    flips True so the modal is "gone".
    """
    PLATFORM_NAME = "fake"

    def __init__(self):
        self.detect_calls = 0
        self.detected_payload = {"phone_masked": "138****5678", "can_resend_at": None}
        self.request_sms_calls = 0
        self.submit_code_calls: list[str] = []
        self.modal_cleared = False  # flipped True by submit_code on the right code
        self.correct_code = "888888"

    async def detect(self, page):
        self.detect_calls += 1
        if self.modal_cleared:
            return None
        return self.detected_payload

    async def request_sms(self, page):
        self.request_sms_calls += 1
        return True

    async def submit_code(self, page, code):
        self.submit_code_calls.append(code)
        if code == self.correct_code:
            self.modal_cleared = True
            return True
        return False

    async def is_cleared(self, page):
        return self.modal_cleared


def _install_fake_driver(monkeypatch, platform: str = "douyin"):
    driver = _FakeSmsDriver()
    from sau_service import interaction
    monkeypatch.setitem(interaction.SMS_DRIVERS, platform, driver)
    return driver


def test_sms_watcher_pushes_awaiting_user_and_resumes_on_correct_code(monkeypatch) -> None:
    """End-to-end: detect SMS → push awaiting_user → user submits → resume."""
    monkeypatch.setattr("sau_service.uploader.UPLOAD_TIMEOUT_S", 10.0)
    monkeypatch.setattr("sau_service.uploader.PUBLISHING_AFTER_S", 10.0)
    monkeypatch.setattr("sau_service.uploader.INTERACTION_POLL_INTERVAL_S", 0.1)
    monkeypatch.setattr("sau_service.uploader.INTERACTION_USER_TIMEOUT_S", 5.0)
    pushed: list[dict] = []

    async def fake_push(rec):
        pushed.append(
            {
                "status": rec.status,
                "progress": rec.progress,
                "interaction_required": rec.interaction_required,
            }
        )

    mgr, rec = _make_manager_for_guard()
    monkeypatch.setattr(type(mgr), "_push", lambda self, r: fake_push(r))
    driver = _install_fake_driver(monkeypatch, "douyin")

    async def upload_that_waits_for_sms():
        # Mimic upstream stuck in retry loop until SMS modal clears.
        while not driver.modal_cleared:
            await asyncio.sleep(0.05)
        # Once modal cleared, upload finishes quickly.
        await asyncio.sleep(0.05)

    sentinel_page = object()  # driver ignores it

    async def run():
        async def fire_submit():
            # Wait until watcher has pushed awaiting_user, then submit.
            for _ in range(50):  # 50 * 0.1s = 5s max
                await asyncio.sleep(0.1)
                if rec.status == "awaiting_user":
                    break
            assert await mgr.submit_interaction(rec.task_id, {"code": "888888"}), (
                "submit_interaction should be accepted in awaiting_user state"
            )

        submitter = asyncio.create_task(fire_submit())
        try:
            return await mgr._run_upstream_upload(
                rec,
                upload_that_waits_for_sms,
                platform_label="douyin",
                page_provider=lambda: sentinel_page,
            )
        finally:
            submitter.cancel()
            try:
                await submitter
            except asyncio.CancelledError:
                pass

    ok = asyncio.run(run())
    assert ok is True, f"expected upload to succeed, got pushes: {pushed}"
    assert driver.request_sms_calls == 1, "watcher should auto-trigger SMS once"
    assert driver.submit_code_calls == ["888888"]
    awaiting = [p for p in pushed if p["status"] == "awaiting_user"]
    assert awaiting, f"expected awaiting_user push, got: {pushed}"
    assert awaiting[0]["interaction_required"] is not None
    assert awaiting[0]["interaction_required"]["kind"] == "sms"
    assert awaiting[0]["interaction_required"]["phone_masked"] == "138****5678"


def test_sms_watcher_times_out_when_user_silent(monkeypatch) -> None:
    """User who never submits a code → AWAIT_USER_TIMEOUT failure."""
    monkeypatch.setattr("sau_service.uploader.UPLOAD_TIMEOUT_S", 10.0)
    monkeypatch.setattr("sau_service.uploader.PUBLISHING_AFTER_S", 10.0)
    monkeypatch.setattr("sau_service.uploader.INTERACTION_POLL_INTERVAL_S", 0.05)
    monkeypatch.setattr("sau_service.uploader.INTERACTION_USER_TIMEOUT_S", 0.3)
    pushed: list[dict] = []

    async def fake_push(rec):
        pushed.append(
            {
                "status": rec.status,
                "error_code": rec.error_code,
                "error_message": rec.error_message,
            }
        )

    mgr, rec = _make_manager_for_guard()
    monkeypatch.setattr(type(mgr), "_push", lambda self, r: fake_push(r))
    _install_fake_driver(monkeypatch, "douyin")

    async def hung_upload():
        # Never finishes — caller will be cancelled by AWAIT_USER_TIMEOUT.
        while True:
            await asyncio.sleep(0.05)

    sentinel_page = object()

    async def run():
        return await mgr._run_upstream_upload(
            rec,
            hung_upload,
            platform_label="douyin",
            page_provider=lambda: sentinel_page,
        )

    ok = asyncio.run(run())
    assert ok is False
    # Watcher pushed AWAIT_USER_TIMEOUT; main loop saw cancel_event set and
    # bailed (without overwriting the AWAIT_USER_TIMEOUT error).
    codes = [p["error_code"] for p in pushed if p["error_code"]]
    assert "AWAIT_USER_TIMEOUT" in codes, f"expected AWAIT_USER_TIMEOUT, got: {pushed}"


def test_submit_interaction_rejected_when_not_awaiting(monkeypatch) -> None:
    """submit_interaction must return False when task isn't in awaiting_user."""
    mgr, rec = _make_manager_for_guard()  # already registered on mgr._tasks
    rec.status = "uploading"
    ok = asyncio.run(mgr.submit_interaction(rec.task_id, {"code": "123456"}))
    assert ok is False, "should reject submission when not awaiting_user"

    rec.status = "awaiting_user"
    rec.interaction_required = {"kind": "sms", "prompt": "x", "created_at": "2026-05-20T00:00:00+00:00"}
    ok = asyncio.run(mgr.submit_interaction(rec.task_id, {"code": "123456"}))
    assert ok is True, "should accept submission when awaiting_user with pending interaction"

    # Second submission while first is still pending → reject (no double-fill).
    ok = asyncio.run(mgr.submit_interaction(rec.task_id, {"code": "654321"}))
    assert ok is False, "should reject double-submit while response still pending"


def test_hook_chromium_for_page_capture_restores_launch() -> None:
    """The context manager must put the original chromium.launch back, even
    if upstream raises. We assert by counting real-launch calls before/after
    the hook context, since bound-method identity (`is`) isn't stable across
    accesses in Python.
    """
    from sau_service.uploader import _hook_chromium_for_page_capture

    class _FakeBrowser:
        contexts: list = []

    class _FakeChromium:
        original_called = 0

        async def launch(self, **kwargs):
            type(self).original_called += 1
            return _FakeBrowser()

    class _FakePlaywright:
        chromium = _FakeChromium()

    pw = _FakePlaywright()

    # Inside hook: wrapped launch also calls original (transparent capture)
    with _hook_chromium_for_page_capture(pw) as page_provider:
        asyncio.run(pw.chromium.launch())
        assert _FakeChromium.original_called == 1, "wrapped should call original"
        # Browser has no contexts → no pages
        assert page_provider() is None

    # After hook: launch directly hits original (no wrapping side-effects)
    asyncio.run(pw.chromium.launch())
    assert _FakeChromium.original_called == 2

    # Re-entering the hook works (idempotent restore)
    with _hook_chromium_for_page_capture(pw) as _:
        asyncio.run(pw.chromium.launch())
        assert _FakeChromium.original_called == 3
    asyncio.run(pw.chromium.launch())
    assert _FakeChromium.original_called == 4

    # Restores even when caller raises inside the with
    try:
        with _hook_chromium_for_page_capture(pw) as _:
            raise RuntimeError("boom")
    except RuntimeError:
        pass
    asyncio.run(pw.chromium.launch())
    assert _FakeChromium.original_called == 5
