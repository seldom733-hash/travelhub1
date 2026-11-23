---
name: navitravel-review
description: Navitravel code review — correctness, regressions, tests, cross-stack contracts, and release readiness. Use after implementing a feature or before merging a risky change.
---

# Navitravel Review

Review the diff as if you did not write it. Prioritize defects over style.

## Order

1. Does the change satisfy the stated requirement?
2. Does it break any existing behavior or consumer?
3. Are the data contracts consistent across UI, API, service, and DB?
4. Are failure paths handled (timeouts, empty results, stale state, retries)?
5. Are tests meaningful, not just snapshots of the new output?
6. Is the diff minimal and within the intended files?

## Cross-stack checks

- Frontend query parameter → controller DTO → service → adapter → response shape → UI field.
- Filter changes must produce a new request; tables must not show stale data.
- Date/time and money formatting must use the existing locale/format helpers.
- Live status must move to a terminal state or stop polling.
- New DB fields must have migration/generate/build coverage.

## Review output

```text
blocker  — must fix before merge
major    — likely bug or regression
minor    — maintainability/consistency
nit      — optional
```

For each finding include:

```text
file:line
what is wrong
why it matters
concrete fix
```

Do not approve based only on a successful build. State what was actually tested and what was not.
