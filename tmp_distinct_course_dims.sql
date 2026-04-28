SELECT DISTINCT COALESCE(subject, 'NULL') AS subject, COALESCE(grade, 'NULL') AS grade
FROM courses
WHERE status = 'published'
ORDER BY 1, 2;
