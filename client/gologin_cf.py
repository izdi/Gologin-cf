"""Thin client for GoLogin browser profiles running on Cloudflare Containers."""

from __future__ import annotations

import time
import logging

import requests

logger = logging.getLogger(__name__)


class GologinCF:
    """Manage GoLogin Orbita browser containers on Cloudflare.

    Usage::

        gl = GologinCF(
            worker_url="https://gologin-cf.<sub>.workers.dev",
            api_key="worker-api-key",
            profile_id="yU0Pr0f1leiD",
        )
        ws_url = gl.start()          # boots container + browser
        # ... connect Playwright / Selenium to ws_url ...
        gl.stop()
    """

    def __init__(
        self,
        worker_url: str,
        api_key: str,
        profile_id: str,
        screen_width: int = 1920,
        screen_height: int = 1080,
    ) -> None:
        self.worker_url = worker_url.rstrip("/")
        self.api_key = api_key
        self.profile_id = profile_id
        self.screen_width = screen_width
        self.screen_height = screen_height
        self._ws_endpoint: str | None = None

    @property
    def headers(self) -> dict[str, str]:
        return {"X-API-Key": self.api_key}

    @property
    def ws_endpoint(self) -> str | None:
        return self._ws_endpoint

    # ----- lifecycle -----

    def start(
        self,
        url: str = "about:blank",
        timeout: int = 120,
        poll_interval: float = 3,
    ) -> str:
        """Start the container and wait for the browser to be ready.

        Returns the rewritten ``webSocketDebuggerUrl`` that Playwright
        or Selenium can connect to directly.
        """
        api_url = (
            f"{self.worker_url}"
            f"/api/profiles/{self.profile_id}/start"
        )
        resp = requests.post(
            api_url,
            json={
                "url": url,
                "screenWidth": self.screen_width,
                "screenHeight": self.screen_height,
            },
            headers=self.headers,
            timeout=60,
        )
        if resp.status_code in (200, 202):
            logger.info(
                "Container %s for profile %s",
                resp.json().get("status", "unknown"),
                self.profile_id,
            )
        else:
            logger.warning(
                "Start returned %s, will poll anyway",
                resp.status_code,
            )

        # Poll until Orbita exposes CDP
        self._ws_endpoint = self._poll_cdp(
            timeout, poll_interval,
        )
        logger.info("Browser ready: %s", self._ws_endpoint)
        return self._ws_endpoint

    def stop(self) -> None:
        url = (
            f"{self.worker_url}"
            f"/api/profiles/{self.profile_id}/stop"
        )
        resp = requests.post(
            url, headers=self.headers, timeout=10,
        )
        resp.raise_for_status()
        self._ws_endpoint = None
        logger.info(
            "Stop requested for profile %s",
            self.profile_id,
        )

    def status(self) -> dict:
        url = (
            f"{self.worker_url}"
            f"/api/profiles/{self.profile_id}/status"
        )
        resp = requests.get(
            url, headers=self.headers, timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    # ----- internal -----

    def _poll_cdp(
        self,
        timeout: int,
        interval: float,
    ) -> str:
        """Poll ``/json/version`` until the browser responds."""
        url = (
            f"{self.worker_url}"
            f"/cdp/{self.profile_id}/json/version"
        )
        deadline = time.monotonic() + timeout
        last_err: Exception | None = None

        while time.monotonic() < deadline:
            try:
                resp = requests.get(
                    url, headers=self.headers, timeout=5,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    ws = data.get("webSocketDebuggerUrl")
                    if ws:
                        return ws
            except requests.RequestException as exc:
                last_err = exc
            time.sleep(interval)

        msg = (
            f"Browser not ready within {timeout}s"
            f" (last error: {last_err})"
        )
        raise TimeoutError(msg)
