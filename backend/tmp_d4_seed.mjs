/**
 * D4 — canonical representative dev-cases seed (additive, via real API).
 * Permanent cases (all через Request lifecycle — natural transitions):
 *   C1 → READY_FOR_BOOKING (S7): Request → supplier confirm → customer accept →
 *        convert → travelers saved → final confirm → order confirm → READY_FOR_BOOKING.
 *   C2 → supplier confirmed, customer pending (S2): status CONFIRMED, deadline future.
 *   C3 → supplier waiting (S1): status NEW, supplier SLA future.
 *   C4 → supplier unavailable (S4): terminal UNAVAILABLE, no Order.
 * Synthetic personas (no real PII). Product TOUR policy: только имена REQUIRED.
 */
import "dotenv/config";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const API = process.env.API_BASE ?? "http://localhost:4000/api/v1";
const stamp = Date.now();
const FUTURE = (days = 14) => new Date(Date.now() + days * 86400000).toISOString();

// D3RF permanent fixtures (approved partner, published TOUR product, CRM customer).
const PRODUCT_ID = "08040ab8-34b2-49ed-9ab-125c9674536b";
const PARTNER_ID = "f3ef117c-ea39-4c48-91c-46b948f4b7f8";
const CUSTOMER_ID = "ccfcf66c-22e4-463d-965-82a2865db046";

let TOKEN = "";
async function api(method, path, body, headers) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`, ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok && res.status !== 409 && res.status !== 422) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return { status: res.status, body: json };
}

const persona = (n) => ({ firstName: `Синт${n}`, lastName: "Путешественников" });

async function main() {
  const login = await api("POST", "/auth/login", { username: "admin", password: "admin123" });
  TOKEN = login.body.accessToken;

  const out = {};

  const STATE_FILE = "tmp_d4_seed_state.json";
  const readState = () => { try { return JSON.parse(require("fs").readFileSync(STATE_FILE, "utf8")); } catch { return {}; } };
  const writeState = (s) => require("fs").writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  const state = readState();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Request → convert → travelers → final confirm → process → confirm → send → booking
  async function chainToBooking() {
    const req = await api("POST", "/requests", {
      customerId: CUSTOMER_ID, productId: PRODUCT_ID, partnerId: PARTNER_ID,
      requestedServiceDate: FUTURE(30).slice(0, 10), quantity: 2, travelerCount: 2,
      displayedPrice: 300, displayedCurrency: "AZN",
    });
    if (req.status !== 201) throw new Error(`chain create: ${req.status} ${JSON.stringify(req.body).slice(0,200)}`);
    await api("POST", `/requests/${req.body.id}/confirm-price`, { note: "D4: цена подтверждена" });
    await api("POST", `/requests/${req.body.id}/customer-accept`);
    const conv = await api("POST", `/requests/${req.body.id}/convert`);
    const orderId = conv.body.convertedOrder?.id ?? conv.body.convertedOrderId;
    if (!orderId) throw new Error("chain: no converted order");
    await api("PATCH", `/orders/${orderId}`, { action: "process" });
    const travelers = (await api("GET", `/orders/${orderId}/travelers`)).body.travelers;
    for (let i = 0; i < travelers.length; i++) {
      await api("PATCH", `/orders/${orderId}/travelers/${travelers[i].id}`, persona(i + 1));
    }
    await api("POST", `/orders/${orderId}/final-confirm`);
    await api("PATCH", `/orders/${orderId}`, { action: "confirm" });
    await api("PATCH", `/orders/${orderId}`, { action: "send" });
    // Poll booking creation (in-process subscriber).
    let bookingId = null;
    for (let i = 0; i < 20; i++) {
      const b = (await api("GET", `/bookings?orderId=${orderId}`)).body.items ?? [];
      if (b.length > 0) { bookingId = b[0].id; break; }
      await sleep(500);
    }
    if (!bookingId) throw new Error(`chain: booking not created for order ${orderId}`);
    return { request: req.body, orderId, bookingId };
  }

  // ── C1 (S7): full chain → READY_FOR_BOOKING ─────────────────────────────
  if (!state.c1) {
    const c1 = await api("POST", "/requests", {
      customerId: CUSTOMER_ID, productId: PRODUCT_ID, partnerId: PARTNER_ID,
      requestedServiceDate: FUTURE(30).slice(0, 10), quantity: 2, travelerCount: 2,
      displayedPrice: 340, displayedCurrency: "AZN",
    });
    if (c1.status !== 201) throw new Error(`C1 create: ${c1.status}`);
    const c1id = c1.body.id;
    await api("POST", `/requests/${c1id}/confirm-price`, { note: "D4 C1: цена подтверждена" });
    await api("POST", `/requests/${c1id}/customer-accept`);
    const c1conv = await api("POST", `/requests/${c1id}/convert`);
    const orderId = c1conv.body.convertedOrder?.id ?? c1conv.body.convertedOrderId;
    if (!orderId) throw new Error(`C1 convert: no order — ${JSON.stringify(c1conv.body).slice(0, 200)}`);
    await api("PATCH", `/orders/${orderId}`, { action: "process" });
    const travelersRes = await api("GET", `/orders/${orderId}/travelers`);
    const travelers = travelersRes.body.travelers;
    if (travelers.length !== 2) throw new Error(`C1 travelers != 2: ${travelers.length}`);
    for (let i = 0; i < travelers.length; i++) {
      const p = persona(i + 1);
      await api("PATCH", `/orders/${orderId}/travelers/${travelers[i].id}`, p);
    }
    const vc = await api("POST", `/orders/${orderId}/validate-completion`);
    if (!vc.body.complete) throw new Error(`C1 validate: ${JSON.stringify(vc.body)}`);
    await api("POST", `/orders/${orderId}/final-confirm`);
    await api("PATCH", `/orders/${orderId}`, { action: "confirm" }); // → READY_FOR_BOOKING
    state.c1 = { requestId: c1id, requestRef: c1.body.referenceNumber, orderId };
    writeState(state);
  }
  out.c1 = state.c1;

  // ── C2 (S2): supplier confirmed, customer pending ────────────────────────
  if (!state.c2) {
    const c2 = await api("POST", "/requests", {
      customerId: CUSTOMER_ID, productId: PRODUCT_ID, partnerId: PARTNER_ID,
      requestedServiceDate: FUTURE(45).slice(0, 10), quantity: 1, travelerCount: 1,
      displayedPrice: 120, displayedCurrency: "AZN",
    });
    if (c2.status !== 201) throw new Error(`C2 create: ${c2.status}`);
    await api("POST", `/requests/${c2.body.id}/confirm-price`, { note: "D4 C2: ожидает клиента" });
    state.c2 = { requestId: c2.body.id, requestRef: c2.body.referenceNumber };
    writeState(state);
  }
  out.c2 = state.c2;

  // ── C3 (S1): NEW — supplier waiting ──────────────────────────────────────
  if (!state.c3) {
    const c3 = await api("POST", "/requests", {
      customerId: CUSTOMER_ID, productId: PRODUCT_ID, partnerId: PARTNER_ID,
      requestedServiceDate: FUTURE(60).slice(0, 10), quantity: 1, travelerCount: 1,
      displayedPrice: 95, displayedCurrency: "AZN",
    });
    if (c3.status !== 201) throw new Error(`C3 create: ${c3.status}`);
    state.c3 = { requestId: c3.body.id, requestRef: c3.body.referenceNumber };
    writeState(state);
  }
  out.c3 = state.c3;

  // ── C4 (S4): supplier unavailable (terminal, no Order) ───────────────────
  if (!state.c4) {
    const c4 = await api("POST", "/requests", {
      customerId: CUSTOMER_ID, productId: PRODUCT_ID, partnerId: PARTNER_ID,
      requestedServiceDate: FUTURE(20).slice(0, 10), quantity: 1, travelerCount: 1,
      displayedPrice: 200, displayedCurrency: "AZN",
    });
    if (c4.status !== 201) throw new Error(`C4 create: ${c4.status}`);
    await api("POST", `/requests/${c4.body.id}/unavailable`, { reason: "Даты недоступны у поставщика" });
    state.c4 = { requestId: c4.body.id, requestRef: c4.body.referenceNumber };
    writeState(state);
  }
  out.c4 = state.c4;

  // ── C5 (S9): Booking CONFIRMED, unpaid ───────────────────────────────────
  if (!state.c5) {
    const c5 = await chainToBooking();
    await api("PATCH", `/bookings/${c5.bookingId}`, { action: "send" });
    await api("PATCH", `/bookings/${c5.bookingId}`, { action: "confirm" });
    state.c5 = {
      requestRef: c5.request.referenceNumber, orderId: c5.orderId, bookingId: c5.bookingId,
    };
    writeState(state);
  }
  out.c5 = state.c5;

  // ── C6 (S11+S14+S16): Booking CONFIRMED → paid (CAPTURED) → order cancel → full refund PROCESSED
  if (!state.c6) {
    const c6 = await chainToBooking();
    await api("PATCH", `/bookings/${c6.bookingId}`, { action: "send" });
    await api("PATCH", `/bookings/${c6.bookingId}`, { action: "confirm" });
    const pay = await api("POST", "/finance/payments", {
      orderId: c6.orderId, paymentMethod: "MANUAL", reason: "D4 C6: оплата по заказу (manual capture)",
    }, { "Idempotency-Key": `d4-c6-${stamp}` });
    if (pay.status !== 201) throw new Error(`C6 payment create: ${pay.status} ${JSON.stringify(pay.body).slice(0,200)}`);
    const payCode = pay.body.code ?? pay.body.referenceNumber;
    const payRef = pay.body.referenceNumber;
    await api("POST", `/finance/payments/${payCode}/confirm`);
    // S14: cancel order after payment.
    await api("PATCH", `/orders/${c6.orderId}`, { action: "cancel" });
    // S16: full refund of the captured payment.
    const refund = await api("POST", "/finance/refunds", {
      paymentId: pay.body.id, amount: String(pay.body.amount), reason: "D4 C6: полный возврат после отмены",
    });
    if (refund.status !== 201) throw new Error(`C6 refund create: ${refund.status} ${JSON.stringify(refund.body).slice(0,200)}`);
    await api("POST", `/finance/refunds/${refund.body.code}/approve`);
    await api("POST", `/finance/refunds/${refund.body.code}/process`);
    state.c6 = {
      requestRef: c6.request.referenceNumber, orderId: c6.orderId, bookingId: c6.bookingId,
      paymentRef: payRef, refundCode: refund.body.code, refundRef: refund.body.referenceNumber,
    };
    writeState(state);
  }
  out.c6 = state.c6;

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error("SEED FAIL:", e.message); process.exit(1); });
