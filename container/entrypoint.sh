#!/bin/bash

echo "[entrypoint] Container started"
echo "[entrypoint] env: PROFILE_ID=${PROFILE_ID} TOKEN=${TOKEN:0:8}..."

# Ensure X11 socket dir exists
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

# Ensure shared memory is available (needed by Chromium)
if [ ! -d /dev/shm ]; then
  echo "[entrypoint] /dev/shm missing, creating tmpfs fallback"
  sudo mkdir -p /dev/shm
  sudo mount -t tmpfs tmpfs /dev/shm 2>/dev/null || true
fi

export DISPLAY=:0
SCREEN_WIDTH=${SCREEN_WIDTH:-1920}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-1080}

echo "[entrypoint] Starting Xvfb ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"
Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x16" \
  -nolisten tcp -ac &
sleep 2

if xdpyinfo -display "$DISPLAY" > /dev/null 2>&1; then
  echo "[entrypoint] Xvfb is running"
else
  echo "[entrypoint] WARNING: Xvfb may have failed"
  # Try to see why
  ls -la /tmp/.X11-unix/ 2>&1
fi

echo "[entrypoint] Checking Orbita binary"
ls -la /usr/bin/orbita-browser/chrome 2>&1

echo "[entrypoint] Launching GoLogin SDK"
cd /opt/orbita
node index.js &
NODE_PID=$!

wait $NODE_PID
EXIT_CODE=$?
echo "[entrypoint] node exited with code $EXIT_CODE"

# Fallback: keep container alive with a debug server on 3500
echo "[entrypoint] Starting fallback server on 3500"
exec node -e "
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(500, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({
    error: 'browser crashed',
    exitCode: ${EXIT_CODE}
  }));
}).listen(3500, '0.0.0.0', () => {
  console.log('[fallback] Listening on 3500');
});
"
