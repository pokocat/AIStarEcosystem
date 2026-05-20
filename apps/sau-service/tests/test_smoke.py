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
    """Real mode + a platform we haven't wired (kuaishou) must return
    valid=False *without* importing patchright. The slim mock-mode CI doesn't
    have the [real] extra installed, so an unguarded import would 500.
    Also asserts we never up-flip a cookie we can't actually probe."""
    monkeypatch.setenv("SAU_INTERNAL_SECRET", SECRET)
    monkeypatch.setenv("SAU_MOCK_MODE", "0")

    with TestClient(main.app) as client:
        r = client.post(
            "/accounts/verify",
            headers=_h(),
            json={"platform": "kuaishou", "storageState": {"cookies": [{"name": "x", "value": "y"}]}},
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
    the early-reject branch via the only platform not in LOGIN_PAGE_URLS yet
    (kuaishou). Ensures operators flipping SAU_MOCK_MODE=0 get a clear
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
            json={"ticket": "real-1", "platform": "kuaishou", "accountName": "ks-test"},
        )
        assert r.status_code == 501
        detail = r.json()["detail"]
        assert detail["code"] == "PLATFORM_REAL_LOGIN_NOT_WIRED"
        assert "kuaishou" in detail["message"]
