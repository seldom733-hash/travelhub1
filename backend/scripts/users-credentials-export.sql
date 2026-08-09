\pset fieldsep '|'
\pset tuples_only on
\pset format unaligned
SELECT u.username,
       COALESCE(u.email, ''),
       COALESCE(u."fullName", ''),
       r.code,
       u.status,
       u."createdAt"::date
FROM security."User" u
LEFT JOIN security."Role" r ON r.id = u."roleId"
ORDER BY r.code NULLS LAST, u.username;
