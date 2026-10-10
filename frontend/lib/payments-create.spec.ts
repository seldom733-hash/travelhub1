import { describe, expect, it, vi, type Mock } from "vitest";
import { api, HttpError } from "./api";
import { t, LOCALES } from "./i18n";
import {
  PAYMENT_METHODS,
  availableToCreate,
  buildCreatePaymentPayload,
  createPayment,
  newPaymentIdempotencyKey,
  paymentCreateErrorKey,
  type CreatePaymentInput,
} from "./payments";

// POST перехватывается: createPayment → api.post(path, body, headers).
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    api: { ...actual.api, post: vi.fn(), get: vi.fn() },
  };
});

/**
 * Payment create — контракт frontend payload (prompt §2/AC-5/AC-7/AC-12).
 * Backend: POST /api/v1/finance/payments; amount/currency — server-owned.
 */

const base: CreatePaymentInput = {
  orderId: "ord-1",
  paymentMethod: "cash",
  reason: "Manual offline initiation",
  initialNote: "note",
};

/** Поля, которые frontend НИКОГДА не отправляет (prompt §2 «Критично»). */
const FORBIDDEN_KEYS = [
  "amount",
  "currency",
  "status",
  "customerId",
  "partnerId",
  "providerRef",
  "version",
  "id",
  "code",
  "createdAt",
  "updatedAt",
  "paidAt",
  "failedAt",
  "cancelledAt",
  "bookingId",
] as const;

describe("buildCreatePaymentPayload — whitelist payload (AC-5/AC-12)", () => {
  it("содержит только orderId/reason/paymentMethod/initialNote", () => {
    const payload = buildCreatePaymentPayload(base);
    expect(Object.keys(payload).sort()).toEqual(["initialNote", "orderId", "paymentMethod", "reason"]);
    expect(payload).toEqual({
      orderId: "ord-1",
      reason: "Manual offline initiation",
      paymentMethod: "cash",
      initialNote: "note",
    });
  });

  it("НЕ содержит НИ ОДНОГО server-owned / запрещённого поля (amount, currency, bookingId, …)", () => {
    const payload = buildCreatePaymentPayload(base) as Record<string, unknown>;
    for (const key of FORBIDDEN_KEYS) {
      expect(payload).not.toHaveProperty(key);
      expect(Object.keys(payload)).not.toContain(key);
    }
  });

  it("опциональные поля отсутствуют, когда не заданы; значения триммятся", () => {
    const payload = buildCreatePaymentPayload({ orderId: "  ord-2  ", reason: "  why  " });
    expect(payload).toEqual({ orderId: "ord-2", reason: "why" });
    expect(payload.paymentMethod).toBeUndefined();
    expect(payload.initialNote).toBeUndefined();
    expect(buildCreatePaymentPayload({ ...base, initialNote: "   " }).initialNote).toBeUndefined();
  });

  it("bookingId отсутствует — Payment всегда привязывается через orderId (§5/AC-12)", () => {
    const payload = buildCreatePaymentPayload(base) as Record<string, unknown>;
    expect("bookingId" in payload).toBe(false);
    expect(typeof payload.orderId).toBe("string");
  });
});

describe("PAYMENT_METHODS — agreed allowlist (AC-7)", () => {
  it("ровно cash / card / bank_transfer / other", () => {
    expect([...PAYMENT_METHODS]).toEqual(["cash", "card", "bank_transfer", "other"]);
  });
});

describe("paymentCreateErrorKey — status → i18n key (§3 errors)", () => {
  it("маппит 403/404/409/422", () => {
    expect(paymentCreateErrorKey(new HttpError("forbidden", 403))).toBe("payments.create.error.forbidden");
    expect(paymentCreateErrorKey(new HttpError("not found", 404))).toBe("payments.create.error.not_found");
    expect(paymentCreateErrorKey(new HttpError("conflict", 409))).toBe("payments.create.error.conflict");
    expect(paymentCreateErrorKey(new HttpError("validation", 422))).toBe("payments.create.error.validation");
  });

  it("неизвестный статус / обычный Error → null (generic-сообщение)", () => {
    expect(paymentCreateErrorKey(new HttpError("boom", 500))).toBeNull();
    expect(paymentCreateErrorKey(new Error("plain"))).toBeNull();
    expect(paymentCreateErrorKey(null)).toBeNull();
  });
});

describe("i18n — все ключи create-формы резолвятся в RU/AZ/EN (AC-15)", () => {
  const KEYS = [
    "payments.create.button",
    "payments.create.title",
    "payments.create.order",
    "payments.create.amount",
    "payments.create.method",
    "payments.create.method.cash",
    "payments.create.method.card",
    "payments.create.method.bank_transfer",
    "payments.create.method.other",
    "payments.create.reason",
    "payments.create.reason_hint",
    "payments.create.note",
    "payments.create.submit",
    "payments.create.cancel",
    "payments.create.success",
    "payments.create.error.forbidden",
    "payments.create.error.not_found",
    "payments.create.error.conflict",
    "payments.create.error.validation",
    "payments.create.error.generic",
    "payments.create.select_order",
    "payments.create.loading_orders",
    "payments.create.no_orders",
    "payments.create.readonly_hint",
    "payments.create.reserved_hint",
  ];

  it("каждый ключ существует и непуст для каждого локали", () => {
    for (const key of KEYS) {
      for (const locale of LOCALES) {
        const value = t(key, locale);
        expect(value, `${key}@${locale}`).toBeTruthy();
        expect(value, `${key}@${locale}`).not.toBe(key);
        expect(value).not.toContain("payments.create.");
      }
    }
  });

  it("переводы между локалью различны (не заглушки)", () => {
    for (const key of KEYS) {
      expect(t(key, "ru")).not.toBe(t(key, "en"));
    }
  });
});

describe("createPayment — Idempotency-Key header (Step 2.12H, @Idempotent payment.create)", () => {
  const KEY_RE = /^[A-Za-z0-9._~-]+$/;
  const postMock = api.post as Mock;

  function lastKey(): string {
    return (postMock.mock.calls.at(-1)![2] as Record<string, string>)["Idempotency-Key"];
  }

  it("api.post(/finance/payments) получает Idempotency-Key автоматически (без opts)", async () => {
    postMock.mockReset().mockResolvedValue({ id: "pay-1" });
    await createPayment(base);
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body, headers] = postMock.mock.calls[0];
    expect(path).toBe("/finance/payments");
    expect(body).toEqual(buildCreatePaymentPayload(base));
    const key = headers["Idempotency-Key"];
    expect(key).toMatch(KEY_RE);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(key.startsWith("payment.create-")).toBe(true);
  });

  it("opts.idempotencyKey → уходит как есть (stale-retry клиента)", async () => {
    postMock.mockReset().mockResolvedValue({ id: "pay-1" });
    await createPayment(base, { idempotencyKey: "payment.create-fixed-key.1~2" });
    expect(lastKey()).toBe("payment.create-fixed-key.1~2");
  });

  it("без opts ключи различаются между вызовами (нет скрытого replay)", async () => {
    postMock.mockReset().mockResolvedValue({ id: "pay-1" });
    await createPayment(base);
    await createPayment(base);
    const k1 = (postMock.mock.calls[0][2] as Record<string, string>)["Idempotency-Key"];
    const k2 = (postMock.mock.calls[1][2] as Record<string, string>)["Idempotency-Key"];
    expect(k1).not.toBe(k2);
  });

  it("newPaymentIdempotencyKey: формат backend-regex и ≤128 (50 итераций)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const key = newPaymentIdempotencyKey();
      expect(key).toMatch(KEY_RE);
      expect(key.length).toBeLessThanOrEqual(128);
      seen.add(key);
    }
    expect(seen.size).toBe(50);
  });
});

describe("availableToCreate (due − reserved — зеркало серверного due-guard)", () => {
  const base = { dueAmount: "1250.00" };

  it("нет reservedAmount → due как есть (старый DTO)", () => {
    expect(availableToCreate({ dueAmount: "4585" })).toBe("4585");
    expect(availableToCreate({ dueAmount: "1250.00", reservedAmount: null })).toBe("1250.00");
  });

  it("reserved = 0 → due", () => {
    expect(availableToCreate({ ...base, reservedAmount: "0" })).toBe("1250.00");
    expect(availableToCreate({ ...base, reservedAmount: "0.00" })).toBe("1250.00");
  });

  it("частичный резерв → due − reserved с 2dp", () => {
    expect(availableToCreate({ ...base, reservedAmount: "400.00" })).toBe("850.00");
    expect(availableToCreate({ dueAmount: "4585", reservedAmount: "1000" })).toBe("3585.00");
  });

  it("резерв ≥ due → кламп в 0.00 (create невозможен)", () => {
    expect(availableToCreate({ ...base, reservedAmount: "1250.00" })).toBe("0.00");
    expect(availableToCreate({ ...base, reservedAmount: "9999.99" })).toBe("0.00");
  });

  it("null контекст / пустой due → null (валидация только по формату)", () => {
    expect(availableToCreate(null)).toBeNull();
    expect(availableToCreate({ dueAmount: "" })).toBeNull();
  });

  it("мусор в reserved → fallback на due (не ломаем форму)", () => {
    expect(availableToCreate({ ...base, reservedAmount: "abc" })).toBe("1250.00");
  });
});
