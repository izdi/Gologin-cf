"""Example: launch a GoLogin profile on Cloudflare and automate with Playwright."""

from gologin_cf import GologinCF
from playwright.sync_api import sync_playwright

# ---- configuration (use env vars in production) ----

WORKER_URL = "https://gologin-cf.gosu-team.workers.dev/"
API_KEY = "4bcecafe6fb2d9acc1420d2298eb577330eac8108ec649eaa617982ce8a2de7b"
PROFILE_ID = "68ca6ed56e1ef8692d5f36fc"

# ---- start browser ----

gl = GologinCF(
    worker_url=WORKER_URL,
    api_key=API_KEY,
    profile_id=PROFILE_ID,
)

ws_url = gl.start(url="https://myip.link/mini")
print(f"Browser ready at {ws_url}")

# ---- automate with Playwright ----

with sync_playwright() as pw:
    browser = pw.chromium.connect_over_cdp(ws_url)
    context = browser.contexts[0]
    page = context.pages[0] if context.pages else context.new_page()

    print("Page title:", page.title())
    print("Content:", page.content()[:300])

    browser.close()

# ---- clean up ----

gl.stop()
print("Done.")
