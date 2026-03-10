import os
import sys
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import requests as req
from gologin import GoLogin

TOKEN = os.environ.get("TOKEN", "")
PROFILE_ID = os.environ.get("PROFILE_ID", "")
TARGET_URL = os.environ.get("TARGET_URL", "https://myip.link/mini")
SCREEN_WIDTH = os.environ.get("SCREEN_WIDTH", "1920")
SCREEN_HEIGHT = os.environ.get("SCREEN_HEIGHT", "1080")
CDP_PORT = 9222

browser_ready = False
browser_error = None
debugger_addr = None


def start_browser():
    global browser_ready, browser_error, debugger_addr

    if not TOKEN or not PROFILE_ID:
        browser_error = "TOKEN and PROFILE_ID are required"
        print(f"[browser] {browser_error}", file=sys.stderr)
        return

    try:
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
                f"--window-size={SCREEN_WIDTH},{SCREEN_HEIGHT}",
            ],
        })
        debugger_addr = gl.start()
        browser_ready = True
        print(f"[browser] Ready at {debugger_addr}")

        if TARGET_URL and TARGET_URL != "about:blank":
            print(f"[browser] Navigating to {TARGET_URL}")
            req.get(
                f"http://127.0.0.1:{CDP_PORT}/json/new"
                f"?{TARGET_URL}",
                timeout=10,
            )
    except Exception as exc:
        browser_error = str(exc)
        print(f"[browser] FATAL: {exc}", file=sys.stderr)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/health":
            self._json(200, {
                "ready": browser_ready,
                "error": browser_error,
                "debugger": debugger_addr,
                "profileId": PROFILE_ID,
            })
        elif path == "/test":
            self._handle_test()
        else:
            self._json(404, {"error": "not found"})

    def _handle_test(self):
        if not browser_ready:
            self._json(503, {
                "error": browser_error or "browser starting",
            })
            return
        try:
            tabs = req.get(
                f"http://127.0.0.1:{CDP_PORT}/json/list",
                timeout=5,
            ).json()
            self._json(200, {
                "profileId": PROFILE_ID,
                "targetUrl": TARGET_URL,
                "tabs": [
                    {"title": t.get("title", ""),
                     "url": t.get("url", "")}
                    for t in tabs
                ],
            })
        except Exception as exc:
            self._json(500, {"error": str(exc)})

    def _json(self, code, data):
        body = json.dumps(data, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[http] {fmt % args}")


threading.Thread(target=start_browser, daemon=True).start()

print("[main] HTTP server starting on :3500")
HTTPServer(("0.0.0.0", 3500), Handler).serve_forever()
