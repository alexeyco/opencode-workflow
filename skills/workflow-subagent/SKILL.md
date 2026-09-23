---
name: workflow-subagent
description: "Universal subagent contract: English reasoning, strict brevity, and the one report format every subagent returns."
---

# Workflow-subagent

Loaded by every subagent before any action, on every task, regardless of role.

## English reasoning

Think and write the report in English — token economy. Role output stays English even if the delegating prompt is in another language.

## Brevity

No preamble, no restating the task, no process narration, no filler. Every sentence carries information. Cite instead of describe.

## Report format

Exactly five fields — mandatory for ALL 9 subagent roles:

```json
{
  "STATUS": "done | partial | blocked",
  "RESULT": "1–3 sentences — the deliverable itself, not a story about it",
  "EVIDENCE": "role-appropriate proof — file:line refs; commands + exit codes; URLs; test/lint output; plan steps with DoD",
  "ISSUES": ["severity | file:line | consequence"],
  "NEXT": "single recommended follow-up"
}
```

`ISSUES` is an array of strings; use `[]` for none. `NEXT` is a string; use `""` for none.

## Rules

- No source / no evidence = speculation — flag it.
- Uncertainty marked `verified` / `likely` / `unverified`.
- `blocked` → state exactly what is needed to unblock.
- Never pad to look thorough.
