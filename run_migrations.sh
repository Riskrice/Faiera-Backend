#!/bin/bash
# Create migration script - sync schema first, then run migrations
cat > /tmp/migrate.js << 'JSEOF'
const ds = require("./dist/database/data-source").default;
ds.setOptions({ synchronize: true });
ds.initialize()
  .then(async (s) => {
    console.log("Schema synchronized - all tables created");
    const r = await s.runMigrations();
    console.log("Migrations done:", r.length, "applied");
    process.exit(0);
  })
  .catch(e => { console.error("Error:", e.message); process.exit(1); });
JSEOF

docker cp /tmp/migrate.js faiera-api:/app/migrate.js
docker exec faiera-api node migrate.js

echo "---TABLES---"
docker exec faiera-postgres psql -U postgres -d faiera -c "\dt" 2>&1
echo "DONE"
