-- CategoryStatus: PENDING — запись справочника (тип номера/вида),
-- предложенная партнёром и ожидающая утверждения модератором.
-- PG >= 12: ADD VALUE в транзакции допустим (значение не используется в этом же txn).
ALTER TYPE "catalog"."CategoryStatus" ADD VALUE IF NOT EXISTS 'PENDING';
