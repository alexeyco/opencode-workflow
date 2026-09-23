# Agent catalog

Eleven agents ship with the plugin: 3 primaries (`make`, `ask`, `YOLO`)
and 8 subagents. Each is a markdown file under [`agents/`](../agents) —
YAML frontmatter (`description`, `mode`, optional `color`, permission
rules) plus a body that becomes the agent's system prompt.

Two properties hold across the whole catalog:

- **Unpinned models.** No file sets `model:`; every agent inherits your
  opencode default model. Pin deliberately — see
  [Model guidance](#model-guidance).
- **Least privilege, ordered rules, last match wins.** Permissions are
  array-style `{ action, resource, effect }` rules; `resource` supports
  glob patterns (`sudo *`, `**>[^&]**`). opencode evaluates the composed
  list with `Array.prototype.findLast` semantics — the **last matching
  rule decides**. The plugin composes
  defaults → plugin rules → your config rules
  ([`opencode/permissions.ts`](../opencode/permissions.ts)), so a rule
  you add in `opencode.jsonc` always beats the plugin's. Ordering inside
  each agent's frontmatter matters for the same reason: trailing
  guardrails (`deny`, `ask`) override earlier permissive rules.

## Overview

| Agent           | Mode     | Role (frontmatter description)                                                              |
| --------------- | -------- | ------------------------------------------------------------------------------------------- |
| `make`          | primary  | Workflow orchestrator. Delegates all work to subagents in parallel waves by task necessity. |
| `ask`           | primary  | Answer questions only. No code, no edits, no state changes.                                 |
| `YOLO`          | primary  | Full-access executor. Does exactly what you say — directly, no delegation, no restrictions. |
| `coder`         | subagent | Implement plan steps (backend/frontend) via TDD.                                            |
| `tester`        | subagent | QA gate: tests, lint, smoke. Reports with evidence; never fixes.                            |
| `researcher`    | subagent | Research external docs, APIs and prior art. Read-only, returns findings with sources.       |
| `planner`       | subagent | Decompose task into steps, dependencies, risks; produce plan with DoD.                      |
| `plan-reviewer` | subagent | Review plan for completeness, realism, risks. Findings only.                                |
| `code-reviewer` | subagent | Read-only code review: quality, bugs, security. Findings with severity.                     |
| `interviewer`   | subagent | Clarify requirements and uncover implicit needs via questions.                              |
| `writer`        | subagent | Write and update docs: README, docs/, AGENTS.md.                                            |

## Effective permission posture

Summaries below reflect the actual frontmatter; the raw rule lists are
in each `agents/<id>.md`. `—` means no explicit rule — the built-in
`{ action: "*", resource: "*", effect: "allow" }` default applies.

| Agent           | Read | Edit | Shell                                | Subagents     | Skill           | Web              |
| --------------- | ---- | ---- | ------------------------------------ | ------------- | --------------- | ---------------- |
| `make`          | ✓    | ✗    | ask-by-default + narrow allowlist    | 8 allowlisted | `workflow` only | fetch ✓          |
| `ask`           | ✓    | ✗    | ask-by-default + read-only allowlist | ✗             | all             | fetch ✓          |
| `YOLO`          | —    | ✓    | open, no guardrails                  | ✗             | all             | —                |
| `coder`         | ✓    | ✓    | open + guardrails                    | ✗             | all             | ✗ fetch + search |
| `tester`        | ✓    | ✗    | open + guardrails + redirect deny    | ✗             | all             | ✗ fetch + search |
| `researcher`    | ✓    | ✗    | denied                               | ✗             | all             | fetch ✓          |
| `planner`       | ✓    | ✗    | denied                               | ✗             | all             | ✗ fetch + search |
| `plan-reviewer` | ✓    | ✗    | denied                               | ✗             | all             | ✗ fetch + search |
| `code-reviewer` | ✓    | ✗    | denied                               | ✗             | all             | ✗ fetch + search |
| `interviewer`   | ✓    | ✗    | denied                               | ✗             | all             | ✗ fetch + search |
| `writer`        | ✓    | ✓    | ask-by-default + docs allowlist      | ✗             | all             | fetch ✓          |

All agents share `glob` ✓ and `grep` ✓ (explicit or via default);
`question` ✓ is explicit on `make`, `ask` and `interviewer`. Only the
six agents marked `✗ fetch + search` deny `websearch` explicitly;
everywhere else it falls through to the default allow.

### Primaries

Primaries carry a `color:` in frontmatter: `make` amber `#f59e0b`,
`ask` emerald `#34d399`, `YOLO` red `#ef4444`. Subagents ship unclored.

#### `make` — orchestrator

The largest rule set (36 rules), engineered around one principle: _the
orchestrator has no hands of its own; `subagent` is the only way to
work._

- **Read-only reach:** `read`/`glob`/`grep` on everything — allowed only
  to compose delegation context and verify subagents' Definition-of-Done.
- **`edit` denied outright**; all writes go through `coder`/`writer`.
- **Shell: ask-by-default + narrow allowlist.** Allowed without prompt:
  env probes (`which*`, `type*`, `command*`, `pwd*`, `date*`, `echo*`),
  safe git (`git status*`, `git diff*`, `git log*`, `git branch*`,
  `git checkout*`, `git worktree*`), and quality gates (`make smoke*`,
  `make fmt*`). Everything else asks.
- **Subagent allowlist — exactly the 8 bundled subagents:**
  `interviewer`, `researcher`, `planner`, `plan-reviewer`, `coder`,
  `code-reviewer`, `tester`, `writer`. Everything else (including
  `YOLO`) is denied.
- **Skill: `workflow` only** — the orchestrator loads the routing skill
  first and must not freelance with others (see
  [docs/skills.md](skills.md)).
- **Guardrails:** redirect `**>[^&]**` deny, `sudo *` deny,
  `rm -rf /**` deny, `git push *` ask.
- `question` ✓, `webfetch` ✓.

#### `ask` — read-only Q&A

Same shape as `make` minus delegation: `edit` ✗, `subagent` ✗. Shell is
ask-by-default with a read-only inspection allowlist (`ls*`, `cat*`,
`head*`, `tail*`, `wc*`, probing commands, `grep*`, `rg*`, `find*`, safe
git). Same guardrails. Skill access: all.

#### `YOLO` — unrestricted executor

The only agent with an open posture — 4 rules total: `edit` ✓, `shell` ✓
(no guardrails), `skill` ✓, and the sole structural rule:
`subagent` ✗. No delegating; it does everything itself, without
confirmations. Everything unmentioned (read, web, glob, grep) falls
through to the default allow.

### Subagents

**Writing executors** — the only subagents allowed to touch files:

- `coder` — `edit` ✓, `shell` ✓ open with the standard allowlist made
  explicit for auditability (inspection commands, safe git, test/build
  runners: `cargo test*`, `cargo build*`, `go test*`, `go build*`,
  `pytest*`, `npm test*`, `npm run*`, `make*`) and trailing guardrails
  (`sudo *` ✗, `rm -rf /**` ✗, `git push *` ask). Offline: web ✗.
- `tester` — same open shell + guardrails **plus** redirect deny
  (`**>[^&]**`); `edit` ✗ — it reports, never fixes. Test/lint runners
  only (`cargo clippy*`, `go vet*`, `ruff*`, `npm*`, `make*`).
- `writer` — `edit` ✓; shell is ask-by-default with a docs allowlist
  (inspection, safe git, `make fmt*`, `prettier*`) and full guardrails
  including redirect deny. `webfetch` ✓ for reference material.

**Read-only analysts** — `read`/`glob`/`grep` ✓, `edit` ✗, `shell` ✗,
`subagent` ✗; they differ only in what they may add:

- `researcher` — `webfetch` ✓ (its whole purpose: external docs, APIs,
  prior art, with sources).
- `planner`, `plan-reviewer`, `code-reviewer` — fully offline: web ✗.
- `interviewer` — offline, but `question` ✓ (requirements elicitation
  is conversation).

All eight subagents share: `subagent` ✗ (no recursive delegation) and
`skill` all-access.

### Shared guardrail matrix

| Guardrail                  | Pattern            | Effect | Agents                                     |
| -------------------------- | ------------------ | ------ | ------------------------------------------ |
| No output redirection      | `**>[^&]**`        | deny   | `make`, `ask`, `tester`, `writer`          |
| No privilege escalation    | `sudo *`           | deny   | `make`, `ask`, `coder`, `tester`, `writer` |
| No destructive `rm`        | `rm -rf /**`       | deny   | `make`, `ask`, `coder`, `tester`, `writer` |
| Push needs human approval  | `git push *`       | ask    | `make`, `ask`, `coder`, `tester`, `writer` |
| Dotenv reads need approval | `*.env`, `*.env.*` | ask    | all — from the built-in defaults           |

`YOLO` deliberately has none of the shell guardrails; that is its
contract.

## Model guidance

Agents ship unpinned. Sensible classes when you pin per role:

| Class           | Agents                                   |
| --------------- | ---------------------------------------- |
| Heavy reasoning | `make`, `plan-reviewer`, `code-reviewer` |
| Balanced        | `coder`, `researcher`, `planner`         |
| Fast            | `ask`, `tester`, `interviewer`, `writer` |

Pinning is a plain opencode config, e.g.:

```jsonc
// opencode.jsonc
{
  "agents": {
    "coder": { "model": "provider/model" },
  },
}
```

## Built-in `plan` / `build` agents

The plugin removes the stock `plan` and `build` agents at startup — one
orchestrator (`make`) to rule them all. Fallback if you ever want the
same effect without the plugin:

```jsonc
// opencode.jsonc
{
  "agents": {
    "plan": { "disabled": true },
    "build": { "disabled": true },
  },
}
```

## See also

- [README — Tuning subagent skill access](../README.md#tuning-subagent-skill-access)
- [docs/skills.md](skills.md) — skill-access tuning deep-dive.
- [README](../README.md) — install, `/revdiff`, usage.
