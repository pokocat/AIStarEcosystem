"""Centralised env-driven configuration for sau-service.

Read once at process start; the resulting Settings instance is injected into
routes and background workers via FastAPI app.state.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    internal_secret: str
    mock_mode: bool
    max_concurrency: int
    login_ticket_ttl_s: int
    tmpfs_dir: str
    default_callback_base: str | None


def load_settings() -> Settings:
    return Settings(
        internal_secret=os.environ.get(
            "SAU_INTERNAL_SECRET",
            "aep-dev-internal-secret-change-in-prod",
        ),
        mock_mode=_env_bool("SAU_MOCK_MODE", True),
        max_concurrency=_env_int("SAU_MAX_CONCURRENCY", 2),
        login_ticket_ttl_s=_env_int("SAU_LOGIN_TICKET_TTL_S", 300),
        tmpfs_dir=os.environ.get("SAU_TMPFS_DIR", "/dev/shm"),
        default_callback_base=os.environ.get("SAU_DEFAULT_CALLBACK_BASE") or None,
    )
