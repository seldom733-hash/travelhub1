-- Constructor Default layer: stored per-tab default configurations.
-- Default = base configuration restorable via "Восстановить по умолчанию"
-- and replaceable via "Сделать текущим состоянием по умолчанию".
-- NULL field → built-in backend DEFAULT_*_CONFIG applies for that tab.
ALTER TABLE "constructor"."ConstructorPage" ADD COLUMN "defaultConfigs" JSONB;
