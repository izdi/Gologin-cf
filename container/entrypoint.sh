#!/bin/bash

echo "[entrypoint] Container started"
echo "[entrypoint] env: PROFILE_ID=${PROFILE_ID} TOKEN=${TOKEN:0:8}..."

# Simple HTTP server on port 3500 to verify container can start
# Remove this debug block once browser startup works
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({status: 'container-alive', port: 3500}));
});
server.listen(3500, '0.0.0.0', () => {
  console.log('[debug] Health server listening on 3500');
});
"
