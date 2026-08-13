"""Capture real screenshots from the live demo for the directory evidence page.

Logs in as the demo GM, then shoots the specific tabs a G2 reviewer needs to
see. Demo login triggers a server-side reseed, so the run waits for the app to
settle before shooting.
"""
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "https://rotahr.com"
EMAIL = "sarah.connolly@rotahr.demo"
PASSWORD = "Demo1234!"
OUT = Path("/home/user/rotahr/public/evidence")
OUT.mkdir(parents=True, exist_ok=True)

# label, path, optional tab text to click, optional extra text to click after the
# tab (used to expand a collapsed row so its detail is visible in the shot)
SHOTS = [
    ("floor-plan", "/bookings", "Floor Plan"),
    ("bookings-list", "/bookings", None),
    ("supplier-orders", "/stock", "Order Lists"),
    ("supplier-statements", "/stock", "Statements", "Musgrave MarketPlace"),
    ("suppliers", "/stock", "Suppliers"),
    ("haccp", "/haccp", None),
    ("stock-items", "/stock", "Stock List"),
    ("recipe-costing", "/recipes", None),
    ("rota", "/rota", None),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        # InstallBanner reads this flag on mount; setting it before any page
        # loads keeps the PWA toast out of every screenshot. Clicking it away
        # after login was unreliable — the toast animates in late.
        ctx.add_init_script("try { localStorage.setItem('pwa-banner-dismissed', '1'); } catch (e) {}")
        page = ctx.new_page()

        print("login...")
        # /auth/signin is the real signin page; /login is a bare legacy form.
        page.goto(f"{BASE}/auth/signin", wait_until="networkidle", timeout=60000)
        page.fill('input[type="email"]', EMAIL)
        page.fill('input[type="password"]', PASSWORD)
        page.get_by_role("button", name="Sign in").first.click()

        # Demo login kicks off a reseed; the interstitial can hold for minutes.
        for _ in range(60):
            time.sleep(5)
            url = page.url
            if "/login" not in url and "/auth" not in url:
                break
        print("  landed on", page.url)
        time.sleep(10)

        for shot in SHOTS:
            label, path, tab = shot[0], shot[1], shot[2]
            expand = shot[3] if len(shot) > 3 else None
            try:
                print(f"{label} -> {path} tab={tab}")
                page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=60000)
                time.sleep(6)
                if tab:
                    # Tabs on /stock and /bookings are plain <button>s, not
                    # role=tab, and the label may carry a count badge — so match
                    # on button text without requiring an exact name.
                    clicked = False
                    for locator in (
                        page.get_by_role("button", name=tab),
                        page.locator("button", has_text=tab),
                        page.get_by_text(tab, exact=True),
                    ):
                        try:
                            locator.first.click(timeout=8000)
                            clicked = True
                            break
                        except Exception:
                            continue
                    if not clicked:
                        print(f"  ! could not click tab {tab}")
                    time.sleep(5)
                if expand:
                    try:
                        page.get_by_text(expand, exact=False).first.click(timeout=8000)
                        time.sleep(3)
                    except Exception:
                        print(f"  ! could not expand {expand}")
                page.screenshot(path=str(OUT / f"{label}.png"), full_page=False)
                print("  saved")
            except Exception as e:
                print(f"  FAILED {label}: {type(e).__name__} {e}")

        browser.close()


if __name__ == "__main__":
    sys.exit(main())
