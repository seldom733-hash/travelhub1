#!/usr/bin/env node
/**
 * Three manual cancellation schemes with client/supplier schedules.
 *
 * Creates real test deals through the API, sets historical/future due dates,
 * pays the first client installment, configures the supplier plan/payout and
 * runs cancellation + settlement. No external supplier calls.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { request } = require("playwright");
const { Api, Runner } = require("./scenario-runner");

const OUT_DIR = path.resolve(__dirname, "../../../reports/scenario-runner");
const MANAGER_ID = "d49a3d20-cac6-47ea-978c-480dce0f79b5"; // Diana
const PARTNER_ID = "65be6d8f-2ffc-4bf4-a828-9e396b1d5406"; // Anextour
const SERVICE_DATE = "2026-11-10";
const CLIENT_FIRST_DUE = "2026-10-25";
const CLIENT_SECOND_DUE = "2026-11-01";
const SUPPLIER_DUE_OVERDUE = "2026-11-01";
const SUPPLIER_DUE_FUTURE = "2026-12-01";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function payClient(api, orderId, amount) {
  const payment = await api.post("/finance/payments", {
    orderId,
    amount: amount.toFixed(2),
    paymentMethod: "CASH",
    reason: "HAND SCENARIO — client first installment",
  }, { "Idempotency-Key": `hand-client-${orderId}-${Date.now()}` });
  await api.post(`/finance/payments/${payment.code}/confirm`, {}, {
    "Idempotency-Key": `hand-client-confirm-${payment.code}-${Date.now()}`,
  });
  return payment;
}

async function paySupplier(api, orderId, obligation) {
  const payment = await api.post("/finance/supplier-payments", {
    orderId,
    partnerId: PARTNER_ID,
    amount: obligation.remainingAmount,
    currency: obligation.sourceCurrency ?? "AZN",
    method: "CASH",
    comment: "HAND SCENARIO — supplier payment",
    allocations: [{
      obligationCode: obligation.code,
      amount: obligation.remainingAmount,
      aznAmount: obligation.aznAmount ?? obligation.remainingAmount,
    }],
  }, { "Idempotency-Key": `hand-supplier-${orderId}-${Date.now()}` });
  await api.post(`/finance/supplier-payments/${payment.code}/confirm`, {}, {
    "Idempotency-Key": `hand-supplier-confirm-${payment.code}-${Date.now()}`,
  });
  return payment;
}

async function settle(api, orderId, input) {
  let submitError = null;
  try {
    await api.post(`/orders/${orderId}/cancellation/submit`, input);
  } catch (error) {
    submitError = error;
  }
  let approveError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await api.post(`/orders/${orderId}/cancellation/approve`, {});
    } catch (error) {
      approveError = error;
      await delay(500);
    }
  }
  throw submitError ?? approveError;
}

async function runCase(api, runner, name, options) {
  const label = `HAND ${name}`;
  const fixture = await runner.createFixture(label, {
    assignedManagerId: MANAGER_ID,
    partnerId: PARTNER_ID,
    requestedServiceDate: SERVICE_DATE,
    services: [{
      serviceType: "HOTEL",
      title: `HAND ${name} service`,
      data: { costPrice: "700", salePrice: "1000", supplierCode: "ANEX" },
    }],
  });

  const steps = [];
  await api.post(`/requests/${fixture.requestId}/confirm-price`, {});
  await api.post(`/requests/${fixture.requestId}/customer-accept`, {});
  const converted = await api.post(`/requests/${fixture.requestId}/convert`, {});
  fixture.orderId = converted.convertedOrder?.id ?? fixture.orderId;
  if (!fixture.orderId) throw new Error(`${name}: order was not created`);
  const order = await api.get(`/orders/${fixture.orderId}`);
  const sequence = order.commerceSequence ?? String(order.referenceNumber).split("-").pop();
  steps.push({ sequence, orderStatus: order.status });

  // Client payment plan (300 first, 700 second), dates intentionally historical.
  await api.post(`/finance/deals/${sequence}/schedule`, {
    stage: "FIRST",
    dueDate: CLIENT_FIRST_DUE,
    amount: 300,
    percent: 30,
    condition: options.clientCondition,
  });
  await api.post(`/finance/deals/${sequence}/schedule`, {
    stage: "SECOND",
    dueDate: CLIENT_SECOND_DUE,
    amount: 700,
    percent: 70,
    condition: "second client payment",
  });

  await runner.prepareOrder(fixture.orderId, "confirm");
  await api.patch(`/orders/${fixture.orderId}`, { action: "process", reason: `HAND ${name}` });
  await runner.prepareOrder(fixture.orderId, "confirm");
  await api.patch(`/orders/${fixture.orderId}`, { action: "confirm", reason: `HAND ${name}` });
  await api.patch(`/orders/${fixture.orderId}`, { action: "waitFirstPayment", reason: `HAND ${name}` });

  let firstPayment = null;
  let bookingId = null;
  if (options.payFirstClient) {
    firstPayment = await payClient(api, fixture.orderId, 300);
    steps.push({ firstPayment: firstPayment.code, amount: "300" });
  }

  if (options.bookingAndSupplier) {
    await api.patch(`/orders/${fixture.orderId}`, { action: "send", reason: `HAND ${name}` });
    const bookings = await api.get(`/bookings?orderId=${encodeURIComponent(fixture.orderId)}&pageSize=20`);
    const booking = (bookings.items ?? bookings)[0];
    if (!booking) throw new Error(`${name}: booking was not created`);
    bookingId = booking.id;
    await api.patch(`/bookings/${booking.id}`, { action: "send", reason: `HAND ${name}` });
    await api.patch(`/bookings/${booking.id}`, { action: "confirm", reason: `HAND ${name}` });
    steps.push({ booking: booking.code, bookingStatus: "CONFIRMED" });

    const obligations = await api.get(`/finance/obligations?orderId=${encodeURIComponent(fixture.orderId)}&pageSize=20`);
    const obligation = (obligations.items ?? [])[0];
    if (!obligation) throw new Error(`${name}: supplier obligation was not created`);
    await api.call("PUT", `/finance/supplier-obligations/${obligation.id}/payment-plan`, {
      mode: "FULL",
      installments: [{ kind: "FULL", dueDate: options.supplierDue, amount: Number(obligation.remainingAmount) }],
    });
    steps.push({ supplierObligation: obligation.code, supplierDue: options.supplierDue });

    if (options.paySupplier) {
      const payout = await paySupplier(api, fixture.orderId, obligation);
      steps.push({ supplierPayment: payout.code, amount: obligation.remainingAmount });
    } else {
      await api.post(`/finance/obligations/${obligation.code}/cancel`, {
        reason: `HAND ${name} — supplier payment deadline not reached`,
      }).catch(() => undefined);
    }
  }

  await api.patch(`/orders/${fixture.orderId}`, { action: "requestCancellation", reason: `HAND ${name}` });

  if (bookingId) {
    await api.patch(`/bookings/${bookingId}`, { action: "cancel", reason: `HAND ${name} — cancellation` })
      .catch((error) => steps.push({ bookingCancelError: String(error) }));
  }
  const close = await api.patch(`/orders/${fixture.orderId}`, { action: "close", reason: `HAND ${name}` }).catch((error) => ({ error: String(error) }));
  const deal = await api.get(`/finance/deals/${sequence}`);
  const result = {
    name,
    fixture,
    sequence,
    steps,
    clientSchedule: [CLIENT_FIRST_DUE, CLIENT_SECOND_DUE],
    supplierDue: options.supplierDue ?? null,
    penalties: { client: options.clientPenalty, supplier: options.supplierPenalty },
    close,
    deal: {
      status: deal.status,
      clientReceived: deal.clientReceived,
      clientRefunded: deal.clientRefunded,
      clientPenalty: deal.clientPenalty,
      supplierPaid: deal.supplierPaid,
      supplierPenalty: deal.supplierPenalty,
      currentIncome: deal.currentIncome,
      cancellationResult: deal.cancellationResult,
    },
  };
  console.log(`[manual] ${name}: ${deal.status} income=${deal.currentIncome}`);
  return result;
}

async function main() {
  const context = await request.newContext();
  const api = new Api(context);
  const runner = new Runner(api, "manual-schemes");
  await runner.login();

  const results = [];
  results.push(await runCase(api, runner, "CASE 1 — no payment / no penalties", {
    clientCondition: "penalty not active before first payment",
    payFirstClient: false,
    bookingAndSupplier: false,
    clientPenalty: 0,
    supplierPenalty: 0,
  }));
  results.push(await runCase(api, runner, "CASE 2 — client penalty only", {
    clientCondition: "client penalty activates after first payment",
    payFirstClient: true,
    bookingAndSupplier: true,
    supplierDue: SUPPLIER_DUE_FUTURE,
    clientPenalty: 300,
    supplierPenalty: 0,
  }));
  results.push(await runCase(api, runner, "CASE 3 — client + supplier penalty", {
    clientCondition: "client penalty activates after first payment",
    payFirstClient: true,
    bookingAndSupplier: true,
    supplierDue: SUPPLIER_DUE_OVERDUE,
    paySupplier: true,
    clientPenalty: 300,
    supplierPenalty: 700,
  }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `hand-cancellation-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ runAt: new Date().toISOString(), results }, null, 2), "utf8");
  console.log(`[manual] result: ${file}`);
  await context.dispose();
  if (results.some((row) => row.deal.status !== "CANCELLED_CLOSED" && row.deal.status !== "CLOSED")) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[manual] fatal:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
