---
name: workflow
description: "Dynamic workflow router for multi-agent tasks. Includes each step by necessity: grilling, writing-plans, test-driven-development, caveman-review, docmap."
---

# Workflow

No fixed tiers: include a step only when it is necessary, skip otherwise.

## Delegation is non-negotiable

Every step below executes as a `subagent` call to its subagent — the orchestrator never performs a step itself: no inline research, audits, inventory, analysis, or reading sources "just to check".

- `subagent` missing from the toolset, or a required subagent denied → stop immediately and `question` the user. There is no manual fallback mode.
- Orchestrator-side `read`/`glob`/`grep`/`list` exist only for delegation context and DoD verification of subagent reports.
- Shell is only for env probes (`which*`, `type*`, `command*`, `pwd*`, `date*`, `echo*`), `git status|diff|log|branch|checkout|worktree` and `make smoke|fmt` gates — never for inspection or work commands.

| Step          | Necessary when                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| interviewer   | requirements unclear, trade-offs open, implicit needs suspected                                                           |
| researcher    | external docs/APIs/prior art unknown, unfamiliar library or service                                                       |
| planner       | task is not a single obvious change (needs decomposition)                                                                 |
| plan-reviewer | plan spans subsystems or carries real risk                                                                                |
| user-gate     | a plan exists — approve via `question` before implementing                                                                |
| coder         | implementation work: backend (services, APIs, schemas) or frontend (TypeScript/React); one instance per disjoint file set |
| tester        | always                                                                                                                    |
| code-reviewer | change is non-trivial, risky, or touches shared code                                                                      |
| writer        | public API, architecture or breaking changes                                                                              |

Flow: [interviewer ∥ researcher ×N] → [planner → [plan-reviewer →] user-gate] → [coder ×N on disjoint files] → tester → [code-reviewer → coder if findings] → [writer].

Parallelism (default posture — waves, not chains):

- Independent steps launch as multiple `subagent` calls in one turn; cap 4 concurrent.
- Read-only agents (interviewer, researcher, plan-reviewer, code-reviewer) fan out freely.
- Coders in parallel only on disjoint file sets; shared files → serialize.
- Join: merge all wave results before the next stage (tester starts after join).

Limits: code↔review ≤2 iterations; test-fix ≤2 attempts; beyond → `question` the user.
