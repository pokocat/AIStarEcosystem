"""调试小红书登录卡右上角 QR 切换器。

Run from apps/sau-service:
    ./.venv/bin/python scripts/debug_xhs_corner.py

会带头打开 chromium → 访问 creator.xiaohongshu.com/login →
  1. 等 login-box mount
  2. 枚举 login-box 内所有 visible img/svg/[role=button]，按 bounding-box 打印
  3. 截一张 PNG 到 ./xhs-login-snapshot.png 方便事后看
  4. 让浏览器停留 30 秒，方便手动 DevTools inspect

输出表头包含每个候选的 (tag, class, src, rect)；右上角小图标就是 QR 切换器。
拿到具体 class / 选择器后回填到 XiaohongshuDriver._QR_TAB_FALLBACK_SELECTORS。
"""
from __future__ import annotations

import asyncio
import sys

sys.path.insert(0, "src")

from patchright.async_api import async_playwright  # noqa: E402

LOGIN_URL = "https://creator.xiaohongshu.com/login"


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        print(f"→ goto {LOGIN_URL}")
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
        # let SPA hydrate
        await page.wait_for_timeout(2500)

        login_card = page.locator(
            'div[class*="login-box"], .login-box-container'
        ).first
        try:
            await login_card.wait_for(state="visible", timeout=15000)
        except Exception as e:  # noqa: BLE001
            print(f"!! login-box not visible after 15s: {e}")

        box = await login_card.bounding_box()
        if not box:
            print("!! login-box has no bounding box; aborting")
            return
        print(f"login-box bbox: x={box['x']:.0f} y={box['y']:.0f} "
              f"w={box['width']:.0f} h={box['height']:.0f}")

        zone_right = box["x"] + box["width"]
        zone_top = box["y"]
        zone_left = zone_right - 200  # 比生产更宽，方便看
        zone_bottom = zone_top + 200
        print(f"corner zone: x={zone_left:.0f}-{zone_right:.0f} "
              f"y={zone_top:.0f}-{zone_bottom:.0f}")

        # 枚举每个候选 selector
        selectors = (
            'div[class*="login-box"] img',
            ".login-box-container img",
            'div[class*="login-box"] svg',
            ".login-box-container svg",
            'div[class*="login-box"] [role="button"]',
            '.login-box-container [role="button"]',
            'div[class*="login-box"] button',
            ".login-box-container button",
        )
        print("\n--- candidates in corner zone ---")
        for sel in selectors:
            count = await page.locator(sel).count()
            print(f"\nselector: {sel}  (matches={count})")
            for i in range(min(count, 20)):
                el = page.locator(sel).nth(i)
                try:
                    if not await el.is_visible():
                        continue
                    bb = await el.bounding_box()
                    if not bb:
                        continue
                    cx = bb["x"] + bb["width"] / 2
                    cy = bb["y"] + bb["height"] / 2
                    in_zone = (
                        zone_left <= cx <= zone_right
                        and zone_top <= cy <= zone_bottom
                    )
                    cls_attr = await el.get_attribute("class")
                    src_attr = await el.get_attribute("src")
                    aria = await el.get_attribute("aria-label")
                    print(
                        f"  [{i}] in_zone={in_zone} "
                        f"rect=({bb['x']:.0f},{bb['y']:.0f},"
                        f"{bb['width']:.0f}x{bb['height']:.0f}) "
                        f"class={cls_attr!r} src={(src_attr or '')[:60]!r} "
                        f"aria={aria!r}"
                    )
                except Exception as e:  # noqa: BLE001
                    print(f"  [{i}] inspect error: {e}")

        # 截图存档
        try:
            await page.screenshot(path="xhs-login-snapshot.png", full_page=False)
            print("\nscreenshot saved → xhs-login-snapshot.png")
        except Exception as e:  # noqa: BLE001
            print(f"screenshot failed: {e}")

        print("\n>> browser will stay open for 60s so you can DevTools-inspect.")
        await page.wait_for_timeout(60_000)
        await context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
