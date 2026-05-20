"""Centralised env-driven configuration for sau-service.

Read once at process start; the resulting Settings instance is injected into
routes and background workers via FastAPI app.state.
"""

from __future__ import annotations

import os
import tempfile
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


def _default_tmpfs_dir() -> str:
    """Pick a tmpfs-like scratch dir that actually exists & is writable.

    Linux containers / hosts: `/dev/shm` (POSIX shared memory, RAM-backed) — fastest
    and what the docker-compose / k8s deployment relies on.

    macOS / Windows / restricted hosts: fall back to `<system tempdir>/sau-service`.
    macOS in particular has *no* `/dev/shm`, and `makedirs("/dev/shm")` errors with
    `PermissionError: Operation not permitted`, which used to crash every upload
    task on local venv runs. Falling back to `gettempdir()` keeps semantics close
    enough (files unlinked after each task, OS may wipe `/tmp` on boot).

    Env var `SAU_TMPFS_DIR` always wins; this is just the implicit default.
    """
    candidate = "/dev/shm"
    if os.path.isdir(candidate) and os.access(candidate, os.W_OK):
        return candidate
    return os.path.join(tempfile.gettempdir(), "sau-service")


@dataclass(frozen=True)
class Settings:
    internal_secret: str
    mock_mode: bool
    max_concurrency: int
    login_ticket_ttl_s: int
    tmpfs_dir: str
    default_callback_base: str | None
    # Real-mode debug knob: when SAU_REAL_LOGIN_HEADLESS=0 we launch chromium
    # in headed mode so an operator on a workstation can watch what the QR
    # capture looks like. Production stays headless=True.
    real_login_headless: bool


def load_settings() -> Settings:
    return Settings(
        internal_secret=os.environ.get(
            "SAU_INTERNAL_SECRET",
            "aep-dev-internal-secret-change-in-prod",
        ),
        mock_mode=_env_bool("SAU_MOCK_MODE", True),
        max_concurrency=_env_int("SAU_MAX_CONCURRENCY", 2),
        login_ticket_ttl_s=_env_int("SAU_LOGIN_TICKET_TTL_S", 300),
        tmpfs_dir=os.environ.get("SAU_TMPFS_DIR") or _default_tmpfs_dir(),
        default_callback_base=os.environ.get("SAU_DEFAULT_CALLBACK_BASE") or None,
        real_login_headless=_env_bool("SAU_REAL_LOGIN_HEADLESS", True),
    )
