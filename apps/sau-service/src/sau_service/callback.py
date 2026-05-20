"""Async POST helper for streaming job-callback events back to apps/server.

Each upload task is given a `callback_url` and `callback_secret` by the server
on /upload submit. The worker calls `post_callback(...)` for every progress
tick + each status transition. Failures are best-effort retried with
exponential backoff up to three times — the next callback will catch the
server up regardless of which one wins.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)


async def post_callback(
    callback_url: str,
    callback_secret: str,
    payload: dict[str, Any],
    *,
    max_attempts: int = 3,
    timeout_s: float = 5.0,
) -> bool:
    """Post a single callback payload; returns True on 2xx, False otherwise.

    Network errors are retried up to max_attempts with 0.5s / 1s backoff.
    HTTP 4xx/5xx is logged at WARN and *not* retried (assume the next event
    will refresh the server state).
    """
    headers = {
        "Content-Type": "application/json",
        "X-Internal-Secret": callback_secret,
    }
    delay = 0.5
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(callback_url, json=payload, headers=headers)
            if 200 <= resp.status_code < 300:
                return True
            log.warning(
                "callback non-2xx %s (attempt %d/%d) body=%s",
                resp.status_code,
                attempt,
                max_attempts,
                resp.text[:200],
            )
            if 500 <= resp.status_code < 600 and attempt < max_attempts:
                await asyncio.sleep(delay)
                delay *= 2
                continue
            return False
        except Exception as exc:  # noqa: BLE001 — log and retry network errors
            last_err = exc
            log.info("callback network error attempt=%d err=%r", attempt, exc)
            await asyncio.sleep(delay)
            delay *= 2
    log.warning("callback ultimately failed url=%s err=%r", callback_url, last_err)
    return False
