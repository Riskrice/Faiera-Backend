#!/bin/bash
# Fix Traefik - use Nginx instead since Traefik has Docker API compatibility issues

# Stop and remove traefik
docker stop traefik 2>/dev/null
docker rm traefik 2>/dev/null

# Check Docker API version
echo "Docker server API version:"
docker version --format '{{.Server.APIVersion}}'
echo "Docker server version:"
docker version --format '{{.Server.Version}}'

# Use Nginx as reverse proxy instead of Traefik
# Install Nginx directly on the host
apt-get install -y nginx certbot python3-certbot-nginx

# Create Nginx config for faiera
cat > /etc/nginx/sites-available/faiera << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name faiera.com www.faiera.com api.faiera.com;
    return 301 https://$host$request_uri;
}

# Frontend
server {
    listen 443 ssl;
    server_name faiera.com www.faiera.com;
    
    # SSL will be configured by certbot
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 443 ssl;
    server_name api.faiera.com;
    
    # SSL will be configured by certbot
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/faiera /etc/nginx/sites-enabled/faiera
rm -f /etc/nginx/sites-enabled/default

# Stop Nginx temporarily to free port 80 for the containers to be remapped
# First, remap containers to expose ports on host
docker stop faiera-web faiera-api 2>/dev/null
docker rm faiera-web faiera-api 2>/dev/null

# Restart web with port mapping
docker run -d --name faiera-web \
    --network docker_faiera-net \
    -e NODE_ENV=production \
    -e HOSTNAME=0.0.0.0 \
    -e PORT=3000 \
    -e NEXT_PUBLIC_API_URL=https://api.faiera.com \
    -e NEXT_PUBLIC_SOCKET_URL=https://api.faiera.com \
    -p 3000:3000 \
    --restart unless-stopped \
    docker-web

# Restart API with port mapping
docker run -d --name faiera-api \
    --network docker_faiera-net \
    --env-file /opt/faiera/backend/.env \
    -e NODE_ENV=production \
    -e DB_HOST=postgres \
    -e REDIS_HOST=redis \
    -p 4000:4000 \
    --restart unless-stopped \
    docker-api

# Test Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx

echo "---NGINX STATUS---"
systemctl status nginx --no-pager -l | head -10

echo "---CONTAINERS---"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "---TEST---"
sleep 3
curl -sI http://localhost:3000 2>&1 | head -5
echo "---"
curl -sI http://localhost:4000/api/v1/health 2>&1 | head -5

echo "---GET SSL---"
certbot --nginx -d faiera.com -d www.faiera.com -d api.faiera.com --non-interactive --agree-tos --email admin@faiera.com --redirect 2>&1 | tail -10

echo "DONE!"
