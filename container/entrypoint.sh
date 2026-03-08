#!/bin/bash
set -e

mkdir -p ~/.vnc
export DISPLAY=:0

SCREEN_WIDTH=${SCREEN_WIDTH:-1920}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-1080}

echo "Starting Xvfb ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"
Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x16" &
sleep 2

echo "Starting VNC on :5901"
x11vnc -storepasswd 12345678 ~/.vnc/passwd
x11vnc -display "$DISPLAY" -bg -forever -usepw -quiet \
  -rfbport 5901 -xkb

echo "Starting nginx (CDP proxy :3000 -> :3500)"
/usr/sbin/nginx -c /etc/nginx/nginx.conf

echo "Launching Orbita browser for profile ${PROFILE_ID}"
cd /opt/orbita
exec node index.js
