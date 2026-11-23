#!/usr/bin/env node
/**
 * Linear happy-path lifecycle:
 * request -> order -> booking -> completed service -> closed order.
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
const MAX_STEPS = Number(process.env.LIFECYCLE_MAX_STEPS || 20);

async function main() {
  const context = await request.newContext();
  const api = new Api(context);
  const runner = new Runner(api, "lifecycle");
  await runner.login();

  const fixture = await runner.createFixture("happy-path");
  const steps = [];
  const started = Date.now();

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const state = await runner.getState(fixture);
    const action = PRIORITY.find((candidate) => state.actions.includes(candidate));
    if (!action) {
      steps.push({ state, action: null, terminal: true });
      break;
    }
    await runner.performAction(fixture, action);
    steps.push({
      action,
      entity: state.entity,
      from: state.status,
    });
    console.log(`[lifecycle] ${steps.length}. ${state.entity}.${action} (from ${state.status})`);
  }

  const state = await runner.getState(fixture);
  let order = null;
  if (fixture.orderId) {
    order = await api.get(`/orders/${fixture.orderId}`);
  }
  const result = {
    runAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    fixture,
    steps,
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
    success: state.actions.length === 0 && (!order || ["CLOSED", "COMPLETED", "FULFILLED"].includes(order.status)),
    limitation: "No settlement/penalty events are executed in this linear happy path.",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `happy-path-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf8");
  console.log(`[lifecycle] terminal: ${state.entity}/${state.status}; actions=${state.actions.length}`);
  console.log(`[lifecycle] result: ${file}`);
  await context.dispose();
  if (!result.success) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[lifecycle] fatal:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
