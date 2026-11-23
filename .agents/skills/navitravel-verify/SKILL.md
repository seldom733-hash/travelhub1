---
name: navitravel-verify
description: Navitravel verification loop — plan, build, restart, browser/API checks, and evidence-based completion. Use before claiming a change works, especially for cross-stack features, filters, pricing, and runtime state.
---

# Navitravel Verify

A change is not complete because it compiles.

## Loop

1. State the expected behavior in one sentence.
2. Identify the smallest verification that can falsify it.
3. Build affected packages.
4. Restart only the services that need it.
5. Verify with the real API or browser, not assumptions.
6. Report exact evidence: status, values, counts, route, commit.

## Backend

```powershell
cd backend
npm run build
```

For runtime changes, restart the API and check the exact endpoint or query.

## Frontend

```powershell
cd frontend
npm run build
```

Then restart the frontend and open the exact route in a browser. Check:

- the data is present;
- the action updates the screen without a manual refresh;
- RU/AZ/EN labels where relevant;
- mobile width for layout changes.

## Cross-stack checks

- Verify the request parameters actually reach the backend adapter.
- Verify the backend response contains the field the UI renders.
- Verify the final database value when persistence is involved.
- For live polling, verify active → terminal transitions and that the timer stops.

## Evidence rules

- Do not say “done” if only a build ran and the task was visual/interactive.
- Do not say “works” from a type check alone.
- If a verification was impossible, say exactly what was not verified.
- Prefer a temporary read-only check over a destructive test.

## Safe runtime commands

Use the project scripts for restarting services; do not start duplicate servers on the same ports. Before killing a process, verify the listening port and owning process.

## Reporting

Include:

```text
what changed
where
exact verification
result
commit
remaining limitation
```
