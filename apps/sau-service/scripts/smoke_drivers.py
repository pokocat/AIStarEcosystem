"""End-to-end driver smoke test against live platform login pages.

Run from apps/sau-service: `python3 scripts/smoke_drivers.py`

Boots a headless patchright chromium per platform, navigates to the driver's
LOGIN_URL, then exercises `extract_qr_data_url()` + `is_logged_in()`. The
expected outcome on a clean (unauthenticated) session:
  - extract_qr_data_url returns a data:image/... URL (QR widget rendered)
  - is_logged_in returns False (login overlay still up)

Not a CI test — depends on live platform availability and the [real] extra
dependencies. Used for "did my selectors actually hit the real DOM" sanity.
"""
from __future__ import annotations

import asyncio
import sys

sys.path.insert(0, "src")

from patchright.async_api import async_playwright  # noqa: E402

from sau_service.login_pool import DRIVERS  # noqa: E402


async def smoke(platform: str) -> tuple[bool, str]:
    driver_cls = DRIVERS[platform]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        # ignore_https_errors=True because this container intercepts TLS;
        # production sau-service does NOT need this — the real platform
        # certs validate fine outside our sandbox.
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            ignore_https_errors=True,
        )
        page = await context.new_page()
        try:
            await page.goto(driver_cls.LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(1500)  # let JS settle
            url_after_goto = page.url
            try:
                qr_src = await driver_cls.extract_qr_data_url(page)
                qr_len = len(qr_src) if qr_src else 0
                qr_ok = qr_src and qr_src.startswith("data:image/")
            except Exception as exc:
                qr_src = None
                qr_len = 0
                qr_ok = False
                qr_err = repr(exc)
            else:
                qr_err = None
            try:
                logged_in = await driver_cls.is_logged_in(page)
            except Exception as exc:
                logged_in = None
                logged_in_err = repr(exc)
            else:
                logged_in_err = None
            ok = qr_ok and (logged_in is False)
            report = (
                f"[{platform}] navigate→ {url_after_goto}\n"
                f"  extract_qr_data_url: ok={qr_ok} len={qr_len}"
                + (f" err={qr_err}" if qr_err else "")
                + "\n"
                f"  is_logged_in:        result={logged_in}"
                + (f" err={logged_in_err}" if logged_in_err else "")
                + "\n"
            )
            return ok, report
        finally:
            await context.close()
            await browser.close()


async def main() -> int:
    platforms = ["shipinhao", "xiaohongshu", "kuaishou"]
    results = []
    for p in platforms:
        try:
            ok, report = await smoke(p)
        except Exception as exc:
            ok = False
            report = f"[{p}] CRASHED: {exc!r}\n"
        results.append((p, ok))
        print(report, flush=True)

    print("\n=== summary ===")
    for p, ok in results:
        marker = "PASS" if ok else "FAIL"
        print(f"  {marker} {p}")

    return 0 if all(ok for _, ok in results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
