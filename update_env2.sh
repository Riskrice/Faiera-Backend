#!/bin/bash
python3 -c "
import re
with open('/opt/faiera/backend/.env', 'r') as f:
    content = f.read()
content = re.sub(r'SMTP_PASS=.*', 'SMTP_PASS=\"]L5z8]cs/\"', content)
with open('/opt/faiera/backend/.env', 'w') as f:
    f.write(content)
print('SMTP_PASS updated successfully in backend env')
"
cd /opt/faiera/backend/docker
docker compose -f docker-compose.prod.yml restart api web
