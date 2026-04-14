#!/usr/bin/env bash
set -euo pipefail

PORT=${PORT:-3000}
MOCK_PID=""

# ---------------------------------------------------------------------------
# Cleanup — always stop the mock server on exit
# ---------------------------------------------------------------------------

cleanup() {
  if [ -n "$MOCK_PID" ]; then
    echo ""
    echo "[mock] Stopping mock server (PID $MOCK_PID)..."
    kill "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Start mock server
# ---------------------------------------------------------------------------

echo "[mock] Starting mock server on port $PORT..."
node mock-server.js &
MOCK_PID=$!

# ---------------------------------------------------------------------------
# Wait until the server is ready (up to 10 seconds)
# ---------------------------------------------------------------------------

echo "[mock] Waiting for server to be ready..."
for i in $(seq 1 20); do
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "[mock] Server is ready."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "[mock] Server did not start in time. Exiting."
    exit 1
  fi
  sleep 0.5
done

# ---------------------------------------------------------------------------
# Run flows
# ---------------------------------------------------------------------------

ENV=mock make test-newman-flows
