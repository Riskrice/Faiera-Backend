#!/bin/bash
# Fix Nginx - start with HTTP only, then get SSL

cat > /etc/nginx/sites-available/faiera << 'EOF'
server {
    listen 80;
    server_name faiera.com www.faiera.com;

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

server {
    listen 80;
    server_name api.faiera.com;

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

ln -sf /etc/nginx/sites-available/faiera /etc/nginx/sites-enabled/faiera
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx

echo "---NGINX TEST---"
curl -sI http://faiera.com 2>&1 | head -5
echo "---API TEST---"
curl -sI http://api.faiera.com/api/v1/health 2>&1 | head -5

echo "---GETTING SSL---"
certbot --nginx -d faiera.com -d www.faiera.com -d api.faiera.com --non-interactive --agree-tos --email admin@faiera.com --redirect 2>&1

echo "---FINAL TEST---"
curl -sI https://faiera.com 2>&1 | head -5
echo "---"
curl -sI https://api.faiera.com/api/v1/health 2>&1 | head -5
echo "ALL DONE!"
