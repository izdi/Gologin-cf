#!/bin/bash

echo "[entrypoint] Container started"
echo "[entrypoint] PROFILE_ID=${PROFILE_ID} TOKEN=${TOKEN:0:8}... URL=${TARGET_URL}"

if [ ! -d /dev/shm ]; then
  sudo mkdir -p /dev/shm
  sudo mount -t tmpfs tmpfs /dev/shm 2>/dev/null || true
fi

export DISPLAY=:0
SCREEN_WIDTH=${SCREEN_WIDTH:-1920}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-1080}

Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x16" \
  -nolisten tcp -ac &
sleep 2

echo "[entrypoint] Launching browser"
cd /opt/orbita
exec python3 main.py
