#!/usr/bin/env node
/**
 * Linear happy-path lifecycle:
 * request -> order -> booking -> completed service -> supplier paid -> closed order.
 *
 * Uses the same safe scenario fixture + synthetic CASH payment as the
 * discovery runner. No external supplier calls, no real money.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { request } = require("playwright");
const { Api, Runner } = require("./scenario-runner");

const OUT_DIR = path.resolve(__dirname, "../../../reports/scenario-runner");
const PRIORITY = [
  "confirmPrice",
  "customerAccept",
  "convert",
  "process",
  "confirm",
  "waitFirstPayment",
  "send",
  "prepare",
  "service",
  "complete",
  "close",
];
const MAX_STEPS = Number(process.env.LIFECYCLE_MAX_STEPS || 24);

function yesterday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function firstPartnerId(api) {
  const data = await api.get("/partners?pageSize=1");
  return data?.items?.[0]?.id ?? null;
}

/** Pay every open supplier obligation so the close guard can clear. */
async function settleSupplier(api, orderId) {
  const list = await api.get(`/finance/obligations?orderId=${encodeURIComponent(orderId)}`);
  const items = (list?.items ?? []).filter((item) => Number(item.remainingAmount ?? 0) > 0);
  if (items.length === 0) return [];
  const partnerId = await firstPartnerId(api);
  if (!partnerId) throw new Error("No partner available for supplier payout");
  const paid = [];
  for (const item of items) {
    const payment = await api.post("/finance/supplier-payments", {
      orderId,
      partnerId,
      amount: item.remainingAmount,
      currency: item.sourceCurrency ?? "AZN",
      method: "CASH",
      comment: "AUTOMATED SCENARIO TEST — synthetic supplier payment",
      allocations: [{ obligationCode: item.code, amount: item.remainingAmount, aznAmount: item.remainingAmount }],
    }, { "Idempotency-Key": `scenario-spo-${orderId}-${item.code}-${Date.now()}` });
    await api.post(`/finance/supplier-payments/${payment.code}/confirm`, {}, {
      "Idempotency-Key": `scenario-spo-confirm-${payment.code}-${Date.now()}`,
    });
    paid.push({ code: payment.code, amount: item.remainingAmount });
  }
  return paid;
}

async function main() {
  const context = await request.newContext();
  const api = new Api(context);
  const runner = new Runner(api, "lifecycle");
  await runner.login();

  // Service date in the past: closure is allowed after the service end date.
  const fixture = await runner.createFixture("happy-path", { requestedServiceDate: yesterday() });
  const steps = [];
  const started = Date.now();

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const state = await runner.getState(fixture);
    if (state.actions.includes("close")) break;
    const action = PRIORITY.find((candidate) => state.actions.includes(candidate));
    if (!action) break;
    await runner.performAction(fixture, action);
    steps.push({ action, entity: state.entity, from: state.status });
    console.log(`[lifecycle] ${steps.length}. ${state.entity}.${action} (from ${state.status})`);
  }

  const payments = fixture.orderId ? await settleSupplier(api, fixture.orderId) : [];
  if (fixture.orderId) {
    const order = await api.get(`/orders/${fixture.orderId}`);
    if (order.availableActions?.includes("close")) {
      await runner.performAction(fixture, "close");
      steps.push({ action: "close", entity: "order", from: order.status });
      console.log(`[lifecycle] ${steps.length}. order.close`);
    }
  }

  const state = await runner.getState(fixture);
  const order = fixture.orderId ? await api.get(`/orders/${fixture.orderId}`) : null;
  const result = {
    runAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    fixture,
    steps,
    supplierPayments: payments,
    terminalState: state,
    order: order
      ? {
          status: order.status,
          amount: order.amount,
          paidAmount: order.paidAmount,
          refundedAmount: order.refundedAmount,
          financialStatus: order.financialStatus,
          availableActions: order.availableActions,
        }
      : null,
    success: order?.status === "CLOSED",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `happy-path-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf8");
  console.log(`[lifecycle] terminal: ${order?.status ?? state.status}; actions=${state.actions.length}`);
  console.log(`[lifecycle] result: ${file}`);
  await context.dispose();
  if (!result.success) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[lifecycle] fatal:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
