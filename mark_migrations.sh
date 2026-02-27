#!/bin/bash
# Mark all migrations as executed since schema is already synced
docker exec faiera-postgres psql -U postgres -d faiera << 'SQLEOF'
INSERT INTO migrations (timestamp, name) VALUES 
  (1769084049486, 'AddCreatedByToCourse1769084049486'),
  (1769200000000, 'AddEnrollmentTable1769200000000'),
  (1771777279542, 'AddTeacherToCourse1771777279542')
ON CONFLICT DO NOTHING;

SELECT * FROM migrations;
SQLEOF
echo "DONE - All migrations marked as executed"
