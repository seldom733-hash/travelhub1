-- Least privilege: PARTNER must not read supplier offer inventory.
--
-- The RBAC defect fix 20261025150000 declared supplier.search.* and granted
-- supplier.search.read to ADMIN/DIRECTOR/OPERATOR only. На dev-БД у роли
-- PARTNER обнаружился supplier.search.read (историческая строка RolePermission):
-- партнёр видел бы предложения поставщиков (риск disintermediation и утечки
-- закупочных цен). Грант не входит в ROLE_PERMISSIONS и не должен существовать.
--
-- Идемпотентно: удаляет только этот грант, остальные права PARTNER не трогает.

DELETE FROM "security"."RolePermission" rp
USING "security"."Role" r, "security"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."code" = 'PARTNER'
  AND p."code" LIKE 'supplier.search%';
