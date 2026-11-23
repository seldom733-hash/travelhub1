#!/usr/bin/env node
/**
 * Cancellation + penalty lifecycle:
 * request -> order -> synthetic payment -> request cancellation
 * -> settlement approval -> penalty waiver.
 *
 * Uses the safe scenario fixture. No external supplier calls, no real money.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { request } = require("playwright");
const { Api, Runner } = require("./scenario-runner");

const OUT_DIR = path.resolve(__dirname, "../../../reports/scenario-runner");
const PRIORITY = ["confirmPrice", "customerAccept", "convert", "process", "confirm", "waitFirstPayment", "send"];
const MAX_STEPS = Number(process.env.LIFECYCLE_MAX_STEPS || 16);

async function main() {
  const context = await request.newContext();
  const api = new Api(context);
  const runner = new Runner(api, "cancellation");
  await runner.login();

  const fixture = await runner.createFixture("cancel-penalty");
  const steps = [];
  const started = Date.now();

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const state = await runner.getState(fixture);
    if (state.entity === "order" && ["WAITING_FOR_FIRST_PAYMENT", "IN_PROCESSING", "READY_FOR_BOOKING"].includes(state.status) && state.actions.includes("requestCancellation")) {
      break;
    }
    const action = PRIORITY.find((candidate) => state.actions.includes(candidate));
    if (!action) break;
    await runner.performAction(fixture, action);
    steps.push({ action, entity: state.entity, from: state.status });
    console.log(`[cancel] ${steps.length}. ${state.entity}.${action} (from ${state.status})`);
  }

  if (!fixture.orderId) throw new Error("Order was not created");
  const orderBefore = await api.get(`/orders/${fixture.orderId}`);

  await api.patch(`/orders/${fixture.orderId}`, {
    action: "requestCancellation",
    reason: "AUTOMATED SCENARIO TEST — client fault",
  });
  steps.push({ action: "requestCancellation", entity: "order", from: orderBefore.status });
  console.log(`[cancel] ${steps.length}. order.requestCancellation`);

  // Process the client refund before settlement confirmation: the calculator
  // blocks approval while REMAINING_TO_REFUND > 0.
  let refund = null;
  try {
    const payments = await api.get(`/finance/payments?orderId=${encodeURIComponent(fixture.orderId)}&pageSize=50`);
    const captured = (payments?.items ?? []).find((p) => p.status === "CAPTURED");
    const paid = Number(captured?.amount ?? 0);
    const refundAmount = Math.max(0, paid - 300);
    if (captured && refundAmount > 0) {
      refund = await api.post("/finance/refunds", {
        paymentId: captured.id,
        amount: refundAmount.toFixed(2),
        reason: "AUTOMATED SCENARIO TEST — client refund before settlement",
      });
      await api.post(`/finance/refunds/${refund.code}/approve`, {});
      await api.post(`/finance/refunds/${refund.code}/process`, {});
    }
  } catch (error) {
    console.log("[cancel] refund blocked:", error instanceof Error ? error.message : String(error));
  }

  const cancellation = {
    cancellationReason: "CUSTOMER_FAULT",
    clientPenaltyAmount: "200",
    supplierPenaltyAmount: "100",
    penaltyAmount: "300",
    platformPenaltyShare: "200",
    supplierPenaltyShare: "100",
    finalCustomerLiability: "300",
    reason: "AUTOMATED SCENARIO TEST — client-fault penalty schedule",
  };

  const submitted = await api.post(`/orders/${fixture.orderId}/cancellation/submit`, cancellation);
  console.log(`[cancel] approval submitted: ${submitted.status ?? submitted.status ?? "ok"}`);

  let approved = null;
  let approvalError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      approved = await api.post(`/orders/${fixture.orderId}/cancellation/approve`, {});
      console.log("[cancel] approval accepted");
      approvalError = null;
      break;
    } catch (error) {
      approvalError = error instanceof Error ? error.message : String(error);
      console.log(`[cancel] approval attempt ${attempt + 1} blocked:`, approvalError);
      if (!approvalError.includes("LEDGER_INCOMPLETE") || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  let settlement = null;
  try {
    settlement = await api.get(`/orders/${fixture.orderId}/financial-settlement`);
  } catch (error) {
    approvalError = approvalError ?? (error instanceof Error ? error.message : String(error));
  }
  const beforeWaive = settlement ? {
    status: settlement.status,
    penaltyAmount: settlement.penaltyAmount,
    clientPenaltyAmount: settlement.clientPenaltyAmount,
    supplierPenaltyAmount: settlement.supplierPenaltyAmount,
    platformPenaltyShare: settlement.platformPenaltyShare,
    supplierPenaltyShare: settlement.supplierPenaltyShare,
    clientPenaltyStatus: settlement.clientPenaltyStatus,
    supplierPenaltyStatus: settlement.supplierPenaltyStatus,
    remainingToPay: settlement.remainingToPay,
    remainingToRefund: settlement.remainingToRefund,
  } : null;

  let waived = null;
  let waiverError = null;
  try {
    waived = await api.post(`/orders/${fixture.orderId}/financial-settlement/cancel-penalty`, {
      client: true,
      supplier: true,
      reason: "AUTOMATED SCENARIO TEST — penalty waiver",
    });
    settlement = await api.get(`/orders/${fixture.orderId}/financial-settlement`);
  } catch (error) {
    waiverError = error instanceof Error ? error.message : String(error);
    console.log("[cancel] waiver blocked:", waiverError);
  }
  const afterWaive = settlement ? {
    penaltyAmount: settlement.penaltyAmount,
    clientPenaltyAmount: settlement.clientPenaltyAmount,
    supplierPenaltyAmount: settlement.supplierPenaltyAmount,
    platformPenaltyShare: settlement.platformPenaltyShare,
    supplierPenaltyShare: settlement.supplierPenaltyShare,
    clientPenaltyStatus: settlement.clientPenaltyStatus,
    supplierPenaltyStatus: settlement.supplierPenaltyStatus,
  } : null;

  const orderAfter = await api.get(`/orders/${fixture.orderId}`);
  const result = {
    runAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    fixture,
    steps,
    cancellation,
    refund,
    approval: approved,
    approvalError,
    settlementBeforeWaive: beforeWaive,
    waiverResponse: waived,
    waiverError,
    settlementAfterWaive: afterWaive,
    order: {
      status: orderAfter.status,
      amount: orderAfter.amount,
      paidAmount: orderAfter.paidAmount,
      refundedAmount: orderAfter.refundedAmount,
      financialStatus: orderAfter.financialStatus,
      availableActions: orderAfter.availableActions,
    },
    success: Boolean(afterWaive?.clientPenaltyStatus === "WAIVED" && afterWaive?.supplierPenaltyStatus === "WAIVED"),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `cancel-penalty-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf8");
  console.log(`[cancel] order: ${orderAfter.status}; penalty before=${JSON.stringify(beforeWaive)}`);
  console.log(`[cancel] penalty after=${JSON.stringify(afterWaive)}`);
  console.log(`[cancel] result: ${file}`);
  await context.dispose();
  if (!result.success) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[cancel] fatal:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
