/**
 * Navitravel — Automated Sales Register Scenario Runner.
 *
 * Discovers and executes every action exposed by Request / Order / Booking
 * state machines through the real backend API. Each alternative branch is
 * replayed on a freshly created scenario fixture (TEST-marked customer and
 * request), so branches never contaminate each other.
 *
 * Modes:
 *   discovery   — full state/action graph discovery and execution.
 *   regression  — replay the saved scenario map and compare with the baseline.
 *   change      — discovery + compare against the previous map.
 *
 * Usage:
 *   node test/scenarios/scenario-runner.js --mode=discovery
 *   node test/scenarios/scenario-runner.js --mode=regression
 *   node test/scenarios/scenario-runner.js --mode=change
 *
 * Environment:
 *   SCENARIO_BASE_URL      backend URL (default http://127.0.0.1:4000/api/v1)
 *   SCENARIO_MAX_DEPTH     maximum action-path depth (default 12)
 *   SCENARIO_MAX_SCENARIOS maximum branches per run (default 120)
 *   SCENARIO_MAP           scenario map path (default reports/scenario-runner/scenario-map.json)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { request } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(ROOT, "reports", "scenario-runner");
const MAP_FILE = process.env.SCENARIO_MAP || path.join(OUT_DIR, "scenario-map.json");
const BASE = process.env.SCENARIO_BASE_URL || "http://127.0.0.1:4000/api/v1";
const MAX_DEPTH = Number(process.env.SCENARIO_MAX_DEPTH || 12);
const MAX_SCENARIOS = Number(process.env.SCENARIO_MAX_SCENARIOS || 120);
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");

function argMode() {
  const value = process.argv.find((a) => a.startsWith("--mode="));
  return (value ? value.split("=")[1] : "discovery").toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function safeName(value) {
  return String(value || "scenario").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

class Api {
  constructor(context) {
    this.context = context;
  }

  async call(method, url, data, extraHeaders) {
    const response = await this.context.fetch(`${BASE}${url}`, {
      method,
      data,
      headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok()) {
      const message = body && typeof body === "object"
        ? body.message || body.error || JSON.stringify(body)
        : String(body || response.statusText());
      const error = new Error(`${method} ${url} → ${response.status()}: ${message}`);
      error.status = response.status();
      error.body = body;
      throw error;
    }
    return body;
  }

  get(url) { return this.call("GET", url); }
  post(url, data, headers) { return this.call("POST", url, data || {}, headers); }
  patch(url, data) { return this.call("PATCH", url, data || {}); }
}

const REQUEST_ACTION_METHODS = {
  confirmPrice: "confirm-price",
  proposePrice: "propose-price",
  customerAccept: "customer-accept",
  customerDecline: "customer-decline",
};

function availableActionList(value) {
  if (Array.isArray(value)) return value.filter((x) => typeof x === "string");
  if (value && typeof value === "object") {
    return Object.entries(value).filter(([, enabled]) => enabled === true).map(([name]) => name);
  }
  return [];
}


function actionPriority(action) {
  const order = [
    "confirmPrice", "proposePrice", "customerAccept", "convert",
    "process", "confirm", "waitFirstPayment", "send", "complete", "close",
    "prepare", "service",
    "approveCancellation", "rejectCancellation", "cancel", "reopen",
    "customerDecline", "reject", "unavailable",
    "returnToRequest", "returnToOrder", "requestClarification", "resume",
    "problem", "suspend", "requestCancellation",
  ];
  const index = order.indexOf(action);
  return index === -1 ? 100 : index;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

class Runner {
  constructor(api, mode) {
    this.api = api;
    this.mode = mode;
    this.scenarios = [];
    this.uniqueActions = new Set();
    this.testedActions = 0;
    this.createdFixtures = 0;
    this.errors = [];
    this.visitedStates = new Set();
    this.visitedTransitions = new Set();
    this.cycles = 0;
    this.cleanupIds = { customers: [] };
  }

  async login() {
    await this.api.post("/auth/login", { username: process.env.SCENARIO_USER || "admin", password: process.env.SCENARIO_PASSWORD || "admin123" });
  }

  async createFixture(label) {
    this.createdFixtures += 1;
    const tag = `${RUN_ID}-${this.createdFixtures}`;
    const email = `scenario.${tag}@test.local`;
    const phone = `+99455${String(Date.now()).slice(-6)}${String(this.createdFixtures).padStart(2, "0")}`;
    const customerResponse = await this.api.post("/customers", {
      type: "PERSON",
      firstName: "SCENARIO",
      lastName: `TEST ${tag}`,
      email,
      phone,
      initialNote: "AUTOMATED SCENARIO TEST — safe to clean up",
    });
    const customer = customerResponse?.customer ?? customerResponse;
    this.cleanupIds.customers.push(customer.id);
    const requestBody = {
      customerId: customer.id,
      requestType: "HOTEL",
      displayedPrice: 1000,
      displayedCurrency: "AZN",
      requestedServiceDate: new Date().toISOString().slice(0, 10),
      travelerCount: 1,
      travelers: [{ firstName: "SCENARIO", lastName: "TRAVELER", birthDate: "1990-01-01", position: 1 }],
      services: [{ serviceType: "HOTEL", title: `AUTOMATED TEST ${label || tag}`, data: { costPrice: "700", salePrice: "1000" } }],
    };
    const created = await this.api.post("/requests", requestBody);
    const state = { customerId: customer.id, requestId: created.id, orderId: null, bookingId: null };
    return state;
  }

  async request(id) {
    return this.api.get(`/requests/${id}`);
  }

  async order(id) {
    return this.api.get(`/orders/${id}`);
  }

  async orderTravelers(id) {
    return this.api.get(`/orders/${id}/travelers`);
  }

  async bookingsForOrder(orderId) {
    const data = await this.api.get(`/bookings?orderId=${encodeURIComponent(orderId)}&pageSize=50`);
    return data?.items ?? data ?? [];
  }

  async prepareOrder(orderId, action) {
    const travelers = await this.orderTravelers(orderId);
    for (const traveler of travelers?.travelers ?? []) {
      if (traveler.dataCompleteness === "COMPLETE") continue;
      await this.api.patch(`/orders/${orderId}/travelers/${traveler.id}`, {
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        birthDate: traveler.birthDate ? String(traveler.birthDate).slice(0, 10) : "1990-01-01",
        citizenship: "AZ",
        passportSeries: "AA",
        passportNumber: "1234567",
        passportExpiry: "2030-01-01",
      });
    }
    if (["confirm", "send"].includes(action) && !travelers?.finalConfirmedAt) {
      await this.api.post(`/orders/${orderId}/final-confirm`, {});
    }
    if (action === "send") await this.ensureSyntheticPayment(orderId);
    return this.order(orderId);
  }

  async ensureSyntheticPayment(orderId) {
    const order = await this.order(orderId);
    if (["CANCELLED", "CLOSED", "FULFILLED"].includes(order.status)) return;
    if (Number(order.paidAmount || 0) > 0) return;
    const payment = await this.api.post("/finance/payments", {
      orderId,
      amount: String(order.amount),
      paymentMethod: "CASH",
      reason: "AUTOMATED SCENARIO TEST — synthetic payment",
    }, { "Idempotency-Key": `scenario-pay-${orderId}-${Date.now()}` });
    await this.api.post(`/finance/payments/${payment.code}/confirm`, {});
  }

  /**
   * Prerequisites that are setup steps, not tested buttons: complete traveler
   * data, final confirmation and a synthetic captured payment. Without these
   * confirm/send remain hidden and traversal never reaches Booking actions.
   */
  async ensureOrderReady(orderId) {
    let order = await this.order(orderId);
    if (["CANCELLED", "CLOSED"].includes(order.status)) return order;
    const travelers = await this.orderTravelers(orderId);
    for (const traveler of travelers?.travelers ?? []) {
      if (traveler.dataCompleteness === "COMPLETE") continue;
      await this.api.patch(`/orders/${orderId}/travelers/${traveler.id}`, {
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        birthDate: traveler.birthDate ? String(traveler.birthDate).slice(0, 10) : "1990-01-01",
        citizenship: "AZ",
        passportSeries: "AA",
        passportNumber: "1234567",
        passportExpiry: "2030-01-01",
      });
    }
    if (["IN_PROCESSING", "WAITING_FOR_DATA"].includes(order.status) && !travelers?.finalConfirmedAt) {
      try { await this.api.post(`/orders/${orderId}/final-confirm`, {}); } catch { /* guard records it */ }
    }
    order = await this.order(orderId);
    if (["READY_FOR_BOOKING", "WAITING_FOR_FIRST_PAYMENT", "IN_PROCESSING"].includes(order.status)) {
      await this.ensureSyntheticPayment(orderId);
    }
    return this.order(orderId);
  }

  async prepareRequest(requestId, action) {
    let req = await this.request(requestId);
    if (["customerAccept", "customerDecline", "convert"].includes(action)) {
      if (req.status === "NEW") {
        await this.api.post(`/requests/${requestId}/confirm-price`, {});
        req = await this.request(requestId);
      }
      // convert needs the customer's acceptance; accepting/declining themselves
      // must not be pre-executed, otherwise the tested action runs twice.
      if (action === "convert" && req.status === "CONFIRMED") {
        await this.api.post(`/requests/${requestId}/customer-accept`, {});
        req = await this.request(requestId);
      }
    }
    return req;
  }

  async performAction(state, action) {
    let req = await this.request(state.requestId);
    const requestActions = availableActionList(req.availableActions);
    if (requestActions.includes(action)) {
      await this.prepareRequest(state.requestId, action);
      if (action === "proposePrice") {
        await this.api.post(`/requests/${state.requestId}/propose-price`, { price: Number(req.displayedPrice || 1000) });
      } else {
        await this.api.post(`/requests/${state.requestId}/${REQUEST_ACTION_METHODS[action] || action}`, {});
      }
    } else if (state.orderId && !state.bookingId) {
      await this.prepareOrder(state.orderId, action);
      await this.api.patch(`/orders/${state.orderId}`, { action, reason: "AUTOMATED SCENARIO TEST" });
    } else if (state.orderId && state.bookingId) {
      const booking = await this.api.get(`/bookings/${state.bookingId}`);
      if (availableActionList(booking.availableActions).includes(action)) {
        await this.api.patch(`/bookings/${state.bookingId}`, { action, reason: "AUTOMATED SCENARIO TEST" });
      } else {
        await this.prepareOrder(state.orderId, action);
        await this.api.patch(`/orders/${state.orderId}`, { action, reason: "AUTOMATED SCENARIO TEST" });
      }
    } else {
      throw new Error(`No entity can execute action ${action}`);
    }

    const freshRequest = await this.request(state.requestId);
    state.orderId = freshRequest.convertedOrderId || state.orderId || null;
    if (state.orderId) {
      await this.ensureOrderReady(state.orderId);
      const order = await this.order(state.orderId);
      const bookings = await this.bookingsForOrder(state.orderId);
      const activeBooking = bookings.find((b) => !["CANCELLED", "SUPPLIER_REJECTED"].includes(b.status)) ?? bookings[0];
      state.bookingId = activeBooking?.id ?? null;
      if (state.bookingId) {
        const booking = await this.api.get(`/bookings/${state.bookingId}`);
        const bookingActions = availableActionList(booking.availableActions);
        if (bookingActions.length === 0) {
          state.bookingId = null;
        }
      }
      if (order.status === "CANCELLED" && requestActions.includes("convert") === false) {
        // returned-to-request / cancelled order remains on request entity
      }
    }
    return state;
  }

  async getState(state) {
    const req = await this.request(state.requestId);
    const requestActions = availableActionList(req.availableActions);
    if (state.orderId) {
      await this.ensureOrderReady(state.orderId);
      const order = await this.order(state.orderId);
      const bookings = await this.bookingsForOrder(state.orderId);
      for (const b of bookings) {
        const booking = await this.api.get(`/bookings/${b.id}`);
        const actions = availableActionList(booking.availableActions);
        if (actions.length > 0) {
          return {
            entity: "booking",
            id: b.id,
            status: booking.status,
            actions,
            orderStatus: order.status,
            requestStatus: req.status,
          };
        }
      }
      const actions = availableActionList(order.availableActions);
      if (actions.length > 0) {
        return { entity: "order", id: order.id, status: order.status, actions, requestStatus: req.status };
      }
    }
    return { entity: "request", id: req.id, status: req.status, actions: requestActions };
  }

  async replay(pathActions) {
    const fixture = await this.createFixture(pathActions.join("-") || "root");
    for (const action of pathActions) {
      await this.performAction(fixture, action);
    }
    const state = await this.getState(fixture);
    return { fixture, state };
  }

  async executePath(pathActions) {
    if (this.scenarios.length >= MAX_SCENARIOS) return;
    const started = Date.now();
    try {
      const { fixture, state } = await this.replay(pathActions);
      const actions = [...state.actions].sort((a, b) => actionPriority(a) - actionPriority(b));
      const stateKey = `${state.entity}:${state.status}:${[...actions].sort().join(",")}`;
      for (const action of actions) {
        if (this.scenarios.length >= MAX_SCENARIOS) break;
        this.uniqueActions.add(`${state.entity}.${action}`);
        const transitionKey = `${stateKey}::${action}`;
        let result;
        try {
          const child = await this.replay([...pathActions, action]);
          this.testedActions += 1;
          const childState = child.state;
          result = {
            id: safeName(`${pathActions.join("_") || "root"}_${action}`),
            path: [...pathActions, action],
            depth: pathActions.length + 1,
            from: { entity: state.entity, status: state.status },
            action,
            to: { entity: childState.entity, status: childState.status },
            actionsAfter: childState.actions,
            success: true,
            durationMs: Date.now() - started,
            entityIds: {
              requestId: child.fixture.requestId,
              orderId: child.fixture.orderId,
              bookingId: child.fixture.bookingId,
            },
          };
          if (childState.actions.length === 0) {
            result.terminal = true;
          } else if (pathActions.length + 1 >= MAX_DEPTH) {
            result.truncated = true;
          }
          this.scenarios.push(result);
          if (!this.visitedTransitions.has(transitionKey)) {
            this.visitedTransitions.add(transitionKey);
          } else {
            this.cycles += 1;
          }
          if (childState.actions.length > 0 && pathActions.length + 1 < MAX_DEPTH && !this.visitedStates.has(`${childState.entity}:${childState.status}:${[...childState.actions].sort().join(",")}`)) {
            await this.executePath([...pathActions, action]);
          }
        } catch (error) {
          this.testedActions += 1;
          result = {
            id: safeName(`${pathActions.join("_") || "root"}_${action}`),
            path: [...pathActions, action],
            depth: pathActions.length + 1,
            from: { entity: state.entity, status: state.status },
            action,
            success: false,
            error: errorMessage(error),
            statusCode: error.status ?? null,
            durationMs: Date.now() - started,
          };
          this.errors.push(result);
          this.scenarios.push(result);
        }
      }
      this.visitedStates.add(stateKey);
    } catch (error) {
      this.errors.push({
        id: safeName(pathActions.join("_") || "root"),
        path: pathActions,
        success: false,
        error: errorMessage(error),
        statusCode: error.status ?? null,
      });
    }
  }

  async runDiscovery() {
    console.log(`[scenario] discovery start; max depth=${MAX_DEPTH}, max branches=${MAX_SCENARIOS}`);
    const root = { customerId: null, requestId: null, orderId: null, bookingId: null };
    const fixture = await this.createFixture("root");
    const state = await this.getState(fixture);
    const rootActions = [...state.actions].sort((a, b) => actionPriority(a) - actionPriority(b));
    console.log(`[scenario] root ${state.entity}/${state.status}: ${rootActions.join(", ")}`);
    for (const action of rootActions) {
      if (this.scenarios.length >= MAX_SCENARIOS) break;
      this.uniqueActions.add(`${state.entity}.${action}`);
      try {
        const child = await this.replay([action]);
        this.testedActions += 1;
        const result = {
          id: safeName(`root_${action}`),
          path: [action],
          depth: 1,
          from: { entity: state.entity, status: state.status },
          action,
          to: { entity: child.state.entity, status: child.state.status },
          actionsAfter: child.state.actions,
          success: true,
          terminal: child.state.actions.length === 0,
          entityIds: { requestId: child.fixture.requestId, orderId: child.fixture.orderId, bookingId: child.fixture.bookingId },
        };
        this.scenarios.push(result);
        if (child.state.actions.length > 0) await this.executePath([action]);
      } catch (error) {
        this.testedActions += 1;
        const result = {
          id: safeName(`root_${action}`),
          path: [action],
          depth: 1,
          from: { entity: state.entity, status: state.status },
          action,
          success: false,
          error: errorMessage(error),
          statusCode: error.status ?? null,
        };
        this.errors.push(result);
        this.scenarios.push(result);
      }
    }
  }

  summary() {
    const successful = this.scenarios.filter((s) => s.success).length;
    const failed = this.scenarios.filter((s) => !s.success).length;
    return {
      runId: RUN_ID,
      mode: this.mode,
      generatedAt: nowIso(),
      baseUrl: BASE,
      uniqueActions: this.uniqueActions.size,
      actions: [...this.uniqueActions].sort(),
      testedActions: this.testedActions,
      fixturesCreated: this.createdFixtures,
      scenarios: this.scenarios.length,
      successfulScenarios: successful,
      failedScenarios: failed,
      errors: this.errors.length,
      cyclesDetected: this.cycles,
      visitedStates: this.visitedStates.size,
      unvisitedScenarios: this.scenarios.filter((s) => s.truncated).length,
      testCustomerIds: this.cleanupIds.customers,
      scenariosDetail: this.scenarios,
      failures: this.errors,
    };
  }

  saveReport(report) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const jsonPath = path.join(OUT_DIR, `run-${RUN_ID}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
    const lines = [
      "# Navitravel — Sales Register Scenario Report",
      "",
      `- Run: **${report.runId}**`,
      `- Mode: **${report.mode}**`,
      `- Generated: ${report.generatedAt}`,
      `- Base API: ${report.baseUrl}`,
      "",
      "| Metric | Value |",
      "|---|---|",
      `| Unique actions discovered | ${report.uniqueActions} |`,
      `| Actions executed | ${report.testedActions} |`,
      `| Test fixtures created | ${report.fixturesCreated} |`,
      `| Scenarios executed | ${report.scenarios} |`,
      `| Successful scenarios | ${report.successfulScenarios} |`,
      `| Failed scenarios | ${report.failedScenarios} |`,
      `| Errors | ${report.errors} |`,
      `| Cycles detected | ${report.cyclesDetected} |`,
      `| Visited states | ${report.visitedStates} |`,
      `| Truncated scenarios | ${report.unvisitedScenarios} |`,
      "",
      "## Discovered action map",
      "",
      ...report.actions.map((a) => `- ${a}`),
      "",
      "## Failures",
      "",
      ...(report.failures.length ? report.failures.map((f) => `- ${f.path?.join(" → ") || f.id}: ${f.error}`) : ["- нет"]),
      "",
    ];
    const mdPath = path.join(OUT_DIR, `report-${RUN_ID}.md`);
    fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
    if (report.mode !== "regression") {
      fs.writeFileSync(MAP_FILE, JSON.stringify({
        runId: report.runId,
        generatedAt: report.generatedAt,
        actions: report.actions,
        scenarios: report.scenariosDetail,
      }, null, 2), "utf8");
    }
    console.log(`[scenario] report: ${jsonPath}`);
    console.log(`[scenario] report: ${mdPath}`);
    console.log(`[scenario] map: ${MAP_FILE}`);
  }
}

async function loadMap() {
  if (!fs.existsSync(MAP_FILE)) throw new Error(`Scenario map not found: ${MAP_FILE}`);
  return JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
}

async function main() {
  const mode = argMode();
  const context = await request.newContext();
  const api = new Api(context);
  const runner = new Runner(api, mode);
  await runner.login();
  if (mode === "regression") {
    const map = await loadMap();
    const report = {
      runId: RUN_ID, mode, generatedAt: nowIso(), baseUrl: BASE,
      uniqueActions: map.actions.length, actions: map.actions,
      testedActions: 0, fixturesCreated: 0, scenarios: 0,
      successfulScenarios: 0, failedScenarios: 0, errors: 0,
      cyclesDetected: 0, visitedStates: 0, unvisitedScenarios: 0,
      testCustomerIds: [], scenariosDetail: [], failures: [],
    };
    for (const saved of map.scenarios || []) {
      if (saved.truncated) continue;
      const pathActions = saved.path || [];
      try {
        const { fixture, state } = await runner.replay(pathActions);
        report.testedActions += 1;
        report.scenarios += 1;
        const ok = saved.to?.status ? state.status === saved.to.status : true;
        if (ok) report.successfulScenarios += 1;
        else {
          report.failedScenarios += 1;
          report.failures.push({ path: pathActions, error: `Status changed: expected ${saved.to.status}, got ${state.status}` });
        }
        report.scenariosDetail.push({ path: pathActions, expectedStatus: saved.to?.status ?? null, actualStatus: state.status, ok, requestId: fixture.requestId });
        report.testCustomerIds.push(fixture.customerId);
      } catch (error) {
        report.failedScenarios += 1;
        report.errors += 1;
        report.failures.push({ path: pathActions, error: errorMessage(error) });
      }
    }
    runner.saveReport(report);
    await context.dispose();
    return;
  }

  await runner.runDiscovery();
  const report = runner.summary();
  if (mode === "change") {
    try {
      const previous = await loadMap();
      report.previousRunId = previous.runId;
      report.newActions = report.actions.filter((a) => !previous.actions.includes(a));
      report.removedActions = previous.actions.filter((a) => !report.actions.includes(a));
    } catch {
      report.previousRunId = null;
    }
  }
  runner.saveReport(report);
  await context.dispose();
  if (report.failedScenarios > 0) process.exitCode = 2;
}

main().catch(async (error) => {
  console.error("[scenario] fatal:", errorMessage(error));
  process.exitCode = 1;
});
