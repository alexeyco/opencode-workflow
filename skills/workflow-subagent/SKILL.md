---
name: workflow-subagent
description: "Universal subagent contract: English reasoning, strict brevity, and the one report format every subagent returns."
metadata: { opencode/autoinvoke: false }
---

# Rules

- **Always** think and report in English.
- No preamble, restatement, narration, filler; cite, don't describe.
- Five fields, all subagent roles:
  - `status` enum `"done"|"partial"|"blocked"` (required): outcome.
  - `result` string 1–3 sentences (required): the deliverable, not narrative.
  - `evidence` string (required): proof — `file:line`, commands + exit codes, URLs.
  - `issues` array of strings (optional): each `severity|file:line|consequence`; empty `[]`.
  - `next` string (optional): recommended action; empty `""`.

  ```json
  {
    "status": "done | partial | blocked",
    "result": "1–3 succinct sentences — the deliverable",
    "evidence": "proof — file:line, commands + exit codes, URLs",
    "issues": ["severity | file:line | consequence"],
    "next": "single recommended action"
  }
  ```

- **No evidence** = speculation — flag it.
- Mark claims `verified`/`likely`/`unverified`.
- `blocked` → say exactly what unblocks.
- **Never** pad to look thorough.
