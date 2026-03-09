"""Example: launch a GoLogin profile on Cloudflare and automate with Playwright."""

from gologin_cf import GologinCF
from playwright.sync_api import sync_playwright

# ---- configuration (use env vars in production) ----

WORKER_URL = "https://gologin-cf.<your-subdomain>.workers.dev"
API_KEY = "your-worker-api-key"
PROFILE_ID = "your-profile-id"

# ---- start browser ----

gl = GologinCF(
    worker_url=WORKER_URL,
    api_key=API_KEY,
    profile_id=PROFILE_ID,
)

ws_url = gl.start()
print(f"Browser ready at {ws_url}")

# ---- automate with Playwright ----

with sync_playwright() as pw:
    browser = pw.chromium.connect_over_cdp(ws_url)
    context = browser.contexts[0]
    page = (
        context.pages[0] if context.pages else context.new_page()
    )

    page.goto("https://myip.link/mini")
    print("Page title:", page.title())
    print("Content:", page.content()[:300])

    browser.close()

# ---- clean up ----

gl.stop()
print("Done.")
