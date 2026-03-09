#!/bin/bash

echo "[entrypoint] Container started"
echo "[entrypoint] env: PROFILE_ID=${PROFILE_ID} TOKEN=${TOKEN:0:8}..."

export DISPLAY=:0
SCREEN_WIDTH=${SCREEN_WIDTH:-1920}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-1080}

echo "[entrypoint] Starting Xvfb ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"
Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x16" &
sleep 2

if xdpyinfo -display "$DISPLAY" > /dev/null 2>&1; then
  echo "[entrypoint] Xvfb is running"
else
  echo "[entrypoint] ERROR: Xvfb failed to start"
fi

echo "[entrypoint] Checking Orbita binary"
ls -la /usr/bin/orbita-browser/chrome 2>&1 || echo "[entrypoint] ERROR: Orbita binary not found"

echo "[entrypoint] Launching GoLogin SDK"
cd /opt/orbita
exec node index.js
