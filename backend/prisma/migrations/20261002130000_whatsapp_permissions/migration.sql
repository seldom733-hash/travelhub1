-- M1 WhatsApp: permission catalog rows + default grants.
-- Источник истины: backend/src/security/permissions.constants.ts (PERMISSIONS,
-- ROLE_PERMISSIONS) + PERMISSION_DESCRIPTIONS (security.service.ts).
-- Решение владельца №7 (мастер-промпт §5 D7):
--   whatsapp.read          → внутренние роли (DIRECTOR, FINANCE, MARKETER,
--                            ANALYST, MODERATOR, SALES_MANAGER, OPERATOR)
--   whatsapp.send          → SALES_MANAGER, OPERATOR
--   whatsapp.manage        → OPERATOR (link/unlink; ADMIN — по ALL)
--   whatsapp.session.admin → OPERATOR (ADMIN — по ALL)
--   whatsapp.send.recover  → только ADMIN (покрывается блоком ALL ниже)
-- ADMIN получает ALL_PERMISSIONS convention-ом.
--
-- Idempotent: safe to re-apply. НЕ удаляет существующие RolePermission.
-- rbac-parity e2e требует точного соответствия DB ↔ ROLE_PERMISSIONS.

-- 1. Permission catalog (boot seed тоже добавляет отсутствующие коды, идемпотентно)
INSERT INTO "security"."Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'whatsapp.read', 'Чтение WhatsApp-интеграции (сессии, контакты, статусы, delivery)'),
  (gen_random_uuid(), 'whatsapp.send', 'Отправка сообщений в WhatsApp через TravelHUB (операционный контур)'),
  (gen_random_uuid(), 'whatsapp.send.recover', 'Recovery-отправка UNKNOWN-сообщений («Retry anyway», только ADMIN)'),
  (gen_random_uuid(), 'whatsapp.manage', 'Управление WhatsApp-интеграцией (link/unlink контактов, параметры)'),
  (gen_random_uuid(), 'whatsapp.session.admin', 'Администрирование WhatsApp-сессии (connect/disconnect/logout)')
ON CONFLICT ("code") DO NOTHING;

-- 2. Матричные гранты по ролям (решение владельца №7)
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM (VALUES
  ('DIRECTOR',      'whatsapp.read'),
  ('FINANCE',       'whatsapp.read'),
  ('MARKETER',      'whatsapp.read'),
  ('ANALYST',       'whatsapp.read'),
  ('MODERATOR',     'whatsapp.read'),
  ('SALES_MANAGER', 'whatsapp.read'),
  ('OPERATOR',      'whatsapp.read'),
  ('SALES_MANAGER', 'whatsapp.send'),
  ('OPERATOR',      'whatsapp.send'),
  ('OPERATOR',      'whatsapp.manage'),
  ('OPERATOR',      'whatsapp.session.admin')
) AS g("roleCode", "permissionCode")
JOIN "security"."Role" r ON r."code"::text = g."roleCode"
JOIN "security"."Permission" p ON p."code" = g."permissionCode"
WHERE NOT EXISTS (
  SELECT 1 FROM "security"."RolePermission" rp
  WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
);

-- 3. ADMIN gets ALL_PERMISSIONS (idempotent add-missing) — покрывает
--    whatsapp.* целиком, включая whatsapp.send.recover.
INSERT INTO "security"."RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "security"."Role" r, "security"."Permission" p
WHERE r."code" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM "security"."RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  );
