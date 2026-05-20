"""Stub the upstream `conf` module that pokocat/social-auto-upload expects.

The upstream fork (https://github.com/pokocat/social-auto-upload) assumes you
git-clone the repo and run scripts from its root, so its `uploader/__init__.py`
does `from conf import BASE_DIR` — `conf.py` is a top-level module in the repo.

When installed via pip (`uploader` package only), `conf.py` is **not** packaged,
so any `from uploader.douyin_uploader.main import DouYinVideo` blows up with:

    ModuleNotFoundError: No module named 'conf'

We work around it by injecting a stub `conf` module into `sys.modules` before
the first upstream import. Fields are taken from sau-service settings or sane
defaults — they only need to exist; the upstream uses them like:

  BASE_DIR              → cookies / temp dir (Path)
  DEBUG_MODE            → debug flag (bool)
  LOCAL_CHROME_HEADLESS → chromium headless (bool)
  LOCAL_CHROME_PATH     → explicit chrome binary (str | None)
  XHS_SERVER            → xhs server URL (str)

Call `ensure_upstream_conf(settings)` once before the first upstream import.
Idempotent — re-calling is a no-op.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path


def ensure_upstream_conf(*, headless: bool, base_dir: str) -> None:
    """Install a stub `conf` module if not already present in sys.modules.

    Args:
        headless: forwarded to LOCAL_CHROME_HEADLESS
        base_dir: forwarded to BASE_DIR (will be wrapped to Path)
    """
    if "conf" in sys.modules:
        # Already injected (or shadowed by a real conf.py somewhere on path).
        # Refresh known headless field in case the caller toggled it.
        try:
            sys.modules["conf"].LOCAL_CHROME_HEADLESS = headless  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            pass
        return

    mod = types.ModuleType("conf")
    mod.BASE_DIR = Path(base_dir).resolve()
    mod.DEBUG_MODE = False
    mod.LOCAL_CHROME_HEADLESS = headless
    mod.LOCAL_CHROME_PATH = None  # let patchright pick the bundled chromium
    mod.XHS_SERVER = "http://localhost:8000"  # xhs-server URL; v1 不走 xhs，占位即可
    # Some upstream files may also reference these — default to safe values.
    mod.LOG_LEVEL = "INFO"

    sys.modules["conf"] = mod

    # Ensure BASE_DIR / cookies exists; upstream uploader/__init__ does:
    #   Path(BASE_DIR / "cookies").mkdir(exist_ok=True)
    # which fails if BASE_DIR itself doesn't exist.
    try:
        mod.BASE_DIR.mkdir(parents=True, exist_ok=True)
        (mod.BASE_DIR / "cookies").mkdir(exist_ok=True)
        (mod.BASE_DIR / "videoFile").mkdir(exist_ok=True)
    except OSError:
        # Permission issue — let upstream surface the real error itself.
        pass
