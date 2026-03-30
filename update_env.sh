#!/bin/bash
python3 -c "
import re
with open('/root/.env', 'r') as f:
    content = f.read()
content = re.sub(r'SMTP_PASS=.*', 'SMTP_PASS=\"]L5z8]cs/\"', content)
with open('/root/.env', 'w') as f:
    f.write(content)
print('SMTP_PASS updated successfully')
"
grep SMTP_PASS /root/.env
