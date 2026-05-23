"""Browser runtime helpers for patchright launches."""

from __future__ import annotations

import os


def chrome_executable_path() -> str | None:
    """Return an explicit Chromium binary path when configured.

    Production Docker images install Debian's `chromium` package to avoid
    downloading patchright's bundled browser from Google/Playwright CDNs.
    """
    value = os.environ.get("SAU_CHROME_EXECUTABLE_PATH", "").strip()
    return value or None


def chromium_launch_kwargs(**kwargs):
    path = chrome_executable_path()
    if path and not kwargs.get("executable_path"):
        kwargs["executable_path"] = path
    proxy_server = os.environ.get("SAU_PROXY_SERVER", "").strip()
    if proxy_server and not kwargs.get("proxy"):
        kwargs["proxy"] = {"server": proxy_server}
    return kwargs
