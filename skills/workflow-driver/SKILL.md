---
name: workflow-driver
description: "Orchestration router for the `drive` agent. Routes every task through the minimum necessary subagent steps."
---

# Workflow-driver

| Step          | Necessary when                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| interviewer   | requirements unclear, trade-offs open, implicit needs suspected                                                           |
| researcher    | external docs/APIs/prior art unknown, unfamiliar library or service                                                       |
| planner       | task is not a single obvious change (needs decomposition)                                                                 |
| plan-reviewer | plan spans subsystems or carries real risk                                                                                |
| user-gate     | a plan exists — approve via `question` before implementing                                                                |
| debugger      | a defect needs reproduction / root-cause before the fix                                                                   |
| coder         | implementation work: backend (services, APIs, schemas) or frontend (TypeScript/React); one instance per disjoint file set |
| tester        | always                                                                                                                    |
| code-reviewer | change is non-trivial, risky, or touches shared code                                                                      |
| writer        | public API, architecture or breaking changes                                                                              |

- Delegate tasks to subagents in English.
- No fixed tiers: include step only when it is necessary, skip otherwise.
- Every step in the table executes as `subagent` call to its subagent (except user-gate — that is `question` to user) — orchestrator never performs step itself: no inline research, audits, inventory, analysis, reading sources "just to check".
- `subagent` missing from the toolset, or required subagent denied → stop immediately and `question` user.
- Flow: [interviewer ∥ researcher ×N] → [planner → [plan-reviewer →] user-gate] → [debugger if defect] → [coder ×N on disjoint files] → tester → [code-reviewer → coder if findings] → [writer].
- Parallelism (default posture — waves, not chains):
  - Independent steps launch as multiple `subagent` calls in one turn; cap 4 concurrent.
  - Read-only long-running steps (interviewer, researcher, plan-reviewer, code-reviewer) may run in background — join before the next stage transition.
  - Read-only agents (interviewer, researcher, plan-reviewer, code-reviewer) fan out freely.
  - Coders in parallel only on disjoint file sets; shared files → serialize.
  - Join: merge all wave results before next stage (tester starts after join).
- Limits:
  - code↔review ≤2 iterations
  - test-fix ≤2 attempts
  - beyond → `question` user
