#!/bin/bash
set -e
echo "=== Checking /opt/faiera ==="
ls /opt/faiera/

echo "=== Finding .env files ==="
find /opt/faiera -name ".env" -maxdepth 4 2>/dev/null || echo "No .env found"

echo "=== Finding docker-compose files ==="
find /opt/faiera -name "docker-compose*.yml" 2>/dev/null

echo "=== Backend git status ==="
cd /opt/faiera/backend 2>/dev/null && git log --oneline -3 && echo "BACKEND_OK" || echo "BACKEND_NOT_FOUND"

echo "=== Frontend git status ==="
cd /opt/faiera/faiera-web && git log --oneline -3 && echo "FRONTEND_OK"

echo "=== Running Docker containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}"