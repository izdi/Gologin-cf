import os
import sys
import time

from gologin import GoLogin

TOKEN = os.environ.get("TOKEN", "")
PROFILE_ID = os.environ.get("PROFILE_ID", "")
TARGET_URL = os.environ.get("TARGET_URL", "about:blank")
SCREEN_WIDTH = os.environ.get("SCREEN_WIDTH", "1920")
SCREEN_HEIGHT = os.environ.get("SCREEN_HEIGHT", "1080")

if not TOKEN or not PROFILE_ID:
    print("[main] TOKEN and PROFILE_ID are required", file=sys.stderr)
    sys.exit(1)

print(f"[main] Starting profile {PROFILE_ID} → {TARGET_URL}")

gl = GoLogin({
    "token": TOKEN,
    "profile_id": PROFILE_ID,
    "port": 3500,
    "executablePath": "/usr/bin/orbita-browser/chrome",
    "extra_params": [
        "--headless",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-zygote",
        "--disable-gpu",
        f"--window-size={SCREEN_WIDTH},{SCREEN_HEIGHT}",
        TARGET_URL,
    ],
})

debugger_address = gl.start()
print(f"[main] Browser ready at {debugger_address}")

while True:
    time.sleep(30)
    print(f"alive | port 3500 | profile {PROFILE_ID}")
