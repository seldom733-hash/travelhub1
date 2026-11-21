/**
 * Creates a small, clearly marked coverage dataset for the Sales Register
 * filters: missing statuses, cancellation reasons, settlement statuses and
 * client/supplier payment states.
 *
 * Test records are marked:
 *   customer.firstName = FILTER COVERAGE
 *   customer.email     = coverage.<run>@test.local
 *
 * Usage (backend cwd):
 *   node test/scenarios/seed-filter-coverage.js
 */
"use strict";

require("dotenv").config();
const { request } = require("playwright");
const { Client } = require("pg");

const BASE = process.env.SCENARIO_BASE_URL || "http://127.0.0.1:4000/api/v1";
const RUN = Date.now().toString(36).toUpperCase();

async function api(context, method, url, data, headers) {
  const response = await context.fetch(`${BASE}${url}`, {
    method,
    data,
    headers: { "Content-Type": "application/json", "Idempotency-Key": `coverage-${RUN}-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...(headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok()) throw new Error(`${method} ${url}: ${response.status()} ${body?.message || body}`);
  return body;
}

const STATUS_REQUEST = ["SUPPLIER_TIMEOUT", "CUSTOMER_PAYMENT_TIMEOUT", "EXPIRED", "CONVERTED"];
const STATUS_ORDER = ["WAITING_FOR_DATA", "SENT_TO_BOOKING", "PARTIALLY_FULFILLED", "READY_TO_CLOSE", "FULFILLED"];
const CANCELLATION_REASONS = ["CUSTOMER_FAULT", "SUPPLIER_FAULT", "NAVITRAVEL_FAULT", "FORCE_MAJEURE", "MUTUAL_AGREEMENT"];
const SETTLEMENT_STATUSES = ["OPEN", "PENDING_SETTLEMENT", "FINANCIALLY_SETTLED", "FINANCIALLY_SETTLED_WITH_PENALTY", "FINANCIALLY_SETTLED_FULL_REFUND", "FINANCIALLY_SETTLED_NO_CHARGES"];

async function main() {
  const context = await request.newContext();
  await api(context, "POST", "/auth/login", { username: "admin", password: "admin123" });
  const customerResponse = await api(context, "POST", "/customers", {
    type: "PERSON",
    firstName: "FILTER COVERAGE",
    lastName: RUN,
    email: `coverage.${RUN}@test.local`,
    phone: `+99470${String(Date.now()).slice(-6)}`,
    initialNote: "FILTER COVERAGE TEST DATA",
  });
  const customer = customerResponse.customer ?? customerResponse;

  const createRequest = async (label) => {
    const request = await api(context, "POST", "/requests", {
      customerId: customer.id,
      requestType: "HOTEL",
      displayedPrice: 1000,
      displayedCurrency: "AZN",
      requestedServiceDate: new Date().toISOString().slice(0, 10),
      travelerCount: 1,
      travelers: [{ firstName: "FILTER", lastName: "COVERAGE", birthDate: "1990-01-01", position: 1 }],
      services: [{ serviceType: "HOTEL", title: label, data: { costPrice: "700", salePrice: "1000" } }],
    });
    return request;
  };
  const convert = async (requestId) => {
    await api(context, "POST", `/requests/${requestId}/confirm-price`, {});
    await api(context, "POST", `/requests/${requestId}/customer-accept`, {});
    await api(context, "POST", `/requests/${requestId}/convert`, {});
    const full = await api(context, "GET", `/requests/${requestId}`);
    return full.convertedOrderId;
  };

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const requestIds = [];
  const orderIds = [];
  try {
    // Request-only statuses (no order created).
    for (const status of STATUS_REQUEST) {
      const row = await createRequest(`COVERAGE ${status}`);
      requestIds.push(row.id);
      await client.query(`UPDATE "order"."Request" SET status=$1 WHERE id=$2`, [status, row.id]);
    }
    // Order statuses (request remains CONVERTED, order carries the filter status).
    for (const status of STATUS_ORDER) {
      const row = await createRequest(`COVERAGE ${status}`);
      requestIds.push(row.id);
      const orderId = await convert(row.id);
      orderIds.push(orderId);
      await client.query(`UPDATE "order"."Order" SET status=$1 WHERE id=$2`, [status, orderId]);
    }
    // Five cancellation reasons.
    for (const reason of CANCELLATION_REASONS) {
      const row = await createRequest(`COVERAGE CANCEL ${reason}`);
      requestIds.push(row.id);
      const orderId = await convert(row.id);
      orderIds.push(orderId);
      await client.query(
        `UPDATE "order"."Order" SET status='CANCELLATION_APPROVED', "cancellationReason"=$1 WHERE id=$2`,
        [reason, orderId],
      );
    }
    // Six settlement statuses.
    for (const status of SETTLEMENT_STATUSES) {
      const row = await createRequest(`COVERAGE SETTLEMENT ${status}`);
      requestIds.push(row.id);
      const orderId = await convert(row.id);
      orderIds.push(orderId);
      await client.query(
        `INSERT INTO "finance"."OrderFinancialSettlement"
          (id,code,"orderId","originalAmount",currency,"capturedAmount","refundedAmount","pendingRefundAmount",
           "finalCustomerLiability","penaltyAmount","platformPenaltyShare","supplierPenaltyShare",
           "annulledUnpaidAmount","remainingToPay","remainingToRefund",status,reason,"cancellationReason","confirmedAt","updatedAt")
         VALUES (gen_random_uuid(),$1,$2,1000,'AZN',0,0,0,1000,0,0,0,0,1000,0,$3,$4,$5,now(),now())`,
        [`SET-COV-${RUN}-${status}`, orderId, status, `COVERAGE ${status}`, CANCELLATION_REASONS[0]],
      );
    }
    // Client payment states: partial payment on a fresh order.
    const partialClientRequest = await createRequest("COVERAGE CLIENT PARTIAL");
    requestIds.push(partialClientRequest.id);
    const partialClientOrder = await convert(partialClientRequest.id);
    orderIds.push(partialClientOrder);
    const payment = await api(context, "POST", "/finance/payments", {
      orderId: partialClientOrder,
      amount: "500.00",
      paymentMethod: "CASH",
      reason: "COVERAGE client partial payment",
    });
    await api(context, "POST", `/finance/payments/${payment.code}/confirm`, {});

    // Supplier payment states: insert the same synthetic payout rows the deals
    // projection reads (no external provider is involved).
    const partialSupplierRequest = await createRequest("COVERAGE SUPPLIER PARTIAL");
    requestIds.push(partialSupplierRequest.id);
    const partialSupplierOrder = await convert(partialSupplierRequest.id);
    orderIds.push(partialSupplierOrder);
    await client.query(
      `INSERT INTO "finance"."SupplierPayout"
        (id,code,"orderId",status,direction,amount,currency,"aznAmount","occurredAt",purpose,"supplierCode")
       VALUES (gen_random_uuid(),$1,$2,'CONFIRMED','OUTGOING',350,'AZN',350,now(),$3,'COVERAGE')`,
      [`SPO-COV-${RUN}-P`, partialSupplierOrder, "COVERAGE supplier partial payout"],
    );
    const paidSupplierRequest = await createRequest("COVERAGE SUPPLIER PAID");
    requestIds.push(paidSupplierRequest.id);
    const paidSupplierOrder = await convert(paidSupplierRequest.id);
    orderIds.push(paidSupplierOrder);
    await client.query(
      `INSERT INTO "finance"."SupplierPayout"
        (id,code,"orderId",status,direction,amount,currency,"aznAmount","occurredAt",purpose,"supplierCode")
       VALUES (gen_random_uuid(),$1,$2,'CONFIRMED','OUTGOING',700,'AZN',700,now(),$3,'COVERAGE')`,
      [`SPO-COV-${RUN}-F`, paidSupplierOrder, "COVERAGE supplier full payout"],
    );

    console.log(JSON.stringify({
      run: RUN,
      customerId: customer.id,
      requests: requestIds.length,
      orders: orderIds.length,
      requestStatuses: STATUS_REQUEST,
      orderStatuses: STATUS_ORDER,
      cancellationReasons: CANCELLATION_REASONS,
      settlementStatuses: SETTLEMENT_STATUSES,
      clientPaymentStates: ["UNPAID (existing)", "PARTIALLY_PAID", "PAID (existing)"],
      supplierPaymentStates: ["UNPAID (existing)", "PARTIALLY_PAID", "PAID"],
    }, null, 2));
  } finally {
    await client.end();
    await context.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
