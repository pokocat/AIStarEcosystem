"""In-memory login session pool.

Per ticket we hold (in v1 mock mode) a placeholder profile + an artificial
"scanned at" trigger so /login/poll has a deterministic transition.

When Slice 5 wires real Playwright we'll add `browser: Browser` and `context:
BrowserContext` fields; the public surface stays the same (start / poll / drop /
sweep_expired) so callers don't change.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from .qr import build_mock_qr


@dataclass
class LoginSession:
    ticket: str
    platform: str
    account_name: str
    expires_at: float
    # plaintext JSON returned to the server exactly once on /login/poll success
    storage_state_plain: dict[str, Any] | None = None
    profile: dict[str, Any] | None = None
    qr_image_data_url: str | None = None
    # in mock mode: simulate the user scanning the QR after N polls
    polls_until_success: int = 2
    polls_seen: int = 0
    # real-mode placeholder for Playwright handles
    handles: dict[str, Any] = field(default_factory=dict)


class LoginPool:
    """Async-safe ticket → LoginSession registry."""

    def __init__(self, ttl_seconds: int) -> None:
        self._sessions: dict[str, LoginSession] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl_seconds

    async def start(self, ticket: str, platform: str, account_name: str, *, mock: bool) -> LoginSession:
        async with self._lock:
            now = time.time()
            session = LoginSession(
                ticket=ticket,
                platform=platform,
                account_name=account_name,
                expires_at=now + self._ttl,
            )
            if mock:
                session.qr_image_data_url = build_mock_qr(platform, account_name)
                session.storage_state_plain = _mock_storage_state(platform, account_name)
                session.profile = {
                    "displayName": f"mock-{account_name}",
                    "avatarUrl": f"https://picsum.photos/seed/{account_name}/64",
                }
            self._sessions[ticket] = session
            return session

    async def get(self, ticket: str) -> LoginSession | None:
        async with self._lock:
            self._sweep_locked()
            return self._sessions.get(ticket)

    async def mark_success_and_drop(self, ticket: str) -> LoginSession | None:
        async with self._lock:
            return self._sessions.pop(ticket, None)

    async def drop(self, ticket: str) -> None:
        async with self._lock:
            self._sessions.pop(ticket, None)

    async def sweep_expired(self) -> int:
        async with self._lock:
            return self._sweep_locked()

    # ── internal ──────────────────────────────────────────────────────
    def _sweep_locked(self) -> int:
        now = time.time()
        expired = [t for t, s in self._sessions.items() if s.expires_at < now]
        for t in expired:
            self._sessions.pop(t, None)
        return len(expired)


def _mock_storage_state(platform: str, account_name: str) -> dict[str, Any]:
    """A minimally-shaped Playwright storage_state dict for offline testing."""
    return {
        "cookies": [
            {
                "name": f"mock_{platform}_session",
                "value": f"mock-token-for-{account_name}",
                "domain": f".{platform}.example",
                "path": "/",
                "expires": -1,
                "httpOnly": True,
                "secure": True,
                "sameSite": "Lax",
            }
        ],
        "origins": [],
    }
