set -e
cd /opt/faiera/backend/docker
echo "=== Rebuilding frontend (web service) ==="
docker compose -f docker-compose.prod.yml up --build -d web
echo ""
echo "=== Waiting for build to finish ==="
sleep 30
echo ""
echo "=== Container status ==="
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "NAME|faiera"
echo ""
echo "=== Frontend logs (last 20 lines) ==="
docker logs faiera-web --tail=20 2>&1
