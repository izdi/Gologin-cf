import os
import json
import base64
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

import requests as req
from gologin import GoLogin

TOKEN = os.environ.get("TOKEN", "")
PROFILE_ID = os.environ.get("PROFILE_ID", "")

print(f"[env] TOKEN={'set' if TOKEN else 'MISSING'}")
print(f"[env] PROFILE_ID={PROFILE_ID or 'MISSING'}")
SCREEN_WIDTH = os.environ.get("SCREEN_WIDTH", "1920")
SCREEN_HEIGHT = os.environ.get("SCREEN_HEIGHT", "1080")
CDP_PORT = 9222
TARGET_URL = "https://gosu.team"


def take_screenshot():
    """Start browser, go to gosu.team, return PNG bytes."""
    print(f"[main] TOKEN={TOKEN[:8]}... PROFILE={PROFILE_ID}")

    gl = GoLogin({
        "token": TOKEN,
        "profile_id": PROFILE_ID,
        "port": CDP_PORT,
        "executablePath": "/usr/bin/orbita-browser/chrome",
        "extra_params": [
            "--headless",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--no-zygote",
            "--disable-gpu",
            "--remote-allow-origins=*",
            f"--window-size={SCREEN_WIDTH},{SCREEN_HEIGHT}",
        ],
    })
    gl.checkProxyRecoverRecordIfNeeded = lambda: None

    print("[main] Starting browser...")
    gl.start()
    print("[main] Browser ready")

    try:
        import websocket

        tabs = req.get(
            f"http://127.0.0.1:{CDP_PORT}/json/list",
            timeout=10,
        ).json()
        ws_url = tabs[0]["webSocketDebuggerUrl"]

        ws = websocket.create_connection(ws_url, timeout=30)

        # Set viewport size explicitly (--window-size
        # is unreliable in headless mode)
        ws.send(json.dumps({
            "id": 1,
            "method": "Emulation.setDeviceMetricsOverride",
            "params": {
                "width": int(SCREEN_WIDTH),
                "height": int(SCREEN_HEIGHT),
                "deviceScaleFactor": 1,
                "mobile": False,
            },
        }))
        ws.recv()

        ws.send(json.dumps({
            "id": 2,
            "method": "Page.navigate",
            "params": {"url": TARGET_URL},
        }))
        ws.recv()
        print(f"[main] Navigating to {TARGET_URL}")
        time.sleep(5)

        ws.send(json.dumps({
            "id": 3,
            "method": "Page.captureScreenshot",
            "params": {
                "format": "png",
                "captureBeyondViewport": True,
            },
        }))
        result = json.loads(ws.recv())
        ws.close()

        b64 = result.get("result", {}).get("data")
        if not b64:
            return None, f"No screenshot data: {result}"

        png = base64.b64decode(b64)
        print(f"[main] Screenshot OK ({len(png)} bytes)")
        return png, None

    finally:
        try:
            gl.stop()
        except Exception:
            pass


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/screenshot":
            try:
                png, err = take_screenshot()
            except Exception as exc:
                self._json(500, {"error": str(exc)})
                return

            if err:
                self._json(500, {"error": err})
                return

            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header(
                "Content-Length", str(len(png)),
            )
            self.end_headers()
            self.wfile.write(png)
        else:
            self._json(200, {"status": "ready"})

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[http] {fmt % args}")


print("[main] Server listening on :3500")
HTTPServer(("0.0.0.0", 3500), Handler).serve_forever()
