# Agent catalog

Ten agents ship with the plugin: 1 primary (`drive`) and 9
subagents. Each is a markdown file under [`agents/`](../agents) —
YAML frontmatter (`description`, `mode`, optional `color`, permission
rules) plus a body that becomes the agent's system prompt.

Two properties hold across the whole catalog:

- **Unpinned models.** No file sets `model:`; every agent inherits your
  opencode default model. Pin deliberately — see
  [Model guidance](#model-guidance).
- **Least privilege, ordered rules, last match wins.** Permissions are
  array-style `{ action, resource, effect }` rules with glob
  `resource` patterns, composed defaults → plugin rules → your config
  rules ([`opencode/permissions.ts`](../opencode/permissions.ts)), so
  your `opencode.jsonc` always beats the plugin's — see
  [composition order](skills.md#composition-order--why-your-rules-win);
  trailing `deny`/`ask` guardrails in each frontmatter rely on the same
  semantics.

## Overview

| Agent           | Mode     | Role (frontmatter description)                                                                                     |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `drive`         | primary  | Workflow orchestrator. Delegates all work to subagents in parallel waves by task necessity.                        |
| `coder`         | subagent | Implement plan steps (backend/frontend) via TDD.                                                                   |
| `tester`        | subagent | QA gate: tests, lint, smoke. Reports with evidence; never fixes.                                                   |
| `debugger`      | subagent | Reproduce and root-cause defects: repro, minimize, locate (file:line). Never fixes — hands the diagnosis to coder. |
| `researcher`    | subagent | Research external docs, APIs and prior art. Read-only, returns findings with sources.                              |
| `planner`       | subagent | Decompose task into steps, dependencies, risks; produce plan with DoD.                                             |
| `plan-reviewer` | subagent | Review plan for completeness, realism, risks. Findings only.                                                       |
| `code-reviewer` | subagent | Read-only code review: quality, bugs, security. Findings with severity.                                            |
| `interviewer`   | subagent | Clarify requirements and uncover implicit needs via questions.                                                     |
| `writer`        | subagent | Write and update docs: README, docs/, AGENTS.md.                                                                   |

## Effective permission posture

Summaries below reflect the actual frontmatter; the raw rule lists are
in each `agents/<id>.md`. `—` means no explicit rule — the built-in
`{ action: "*", resource: "*", effect: "allow" }` default applies. The
`Skill` column lists each agent's shipped whitelist — its own plugin
skill and nothing else; every other skill, companion skills included,
is opt-in via your config tail ([per-role table](skills.md#default-state)).

| Agent           | Read | Edit | Shell                             | Subagents                   | Skill                    | Web              |
| --------------- | ---- | ---- | --------------------------------- | --------------------------- | ------------------------ | ---------------- |
| `drive`         | ✓    | ✗    | ask-by-default + narrow allowlist | 9 allowlisted; others → ask | `workflow-driver` only   | fetch ✓          |
| `coder`         | ✓    | ✓    | open + guardrails                 | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `tester`        | ✓    | ✗    | open + guardrails + redirect deny | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `debugger`      | ✓    | ✗    | allowlist + guardrails            | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `researcher`    | ✓    | ✗    | denied                            | ✗                           | `workflow-subagent` only | fetch ✓          |
| `planner`       | ✓    | ✗    | denied                            | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `plan-reviewer` | ✓    | ✗    | denied                            | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `code-reviewer` | ✓    | ✗    | denied                            | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `interviewer`   | ✓    | ✗    | denied                            | ✗                           | `workflow-subagent` only | ✗ fetch + search |
| `writer`        | ✓    | ✓    | ask-by-default + docs allowlist   | ✗                           | `workflow-subagent` only | fetch ✓          |

All agents share `glob` ✓ and `grep` ✓ (explicit or via default);
`question` ✓ is explicit on `drive` and `interviewer` only. Only the
seven agents marked `✗ fetch + search` deny `websearch` explicitly;
everywhere else it falls through to the default allow.

### The `drive` orchestrator

The only primary the plugin registers; it carries a `color:` of amber
`#f59e0b`. Subagents ship unclored.

The largest rule set, engineered around one principle: _the
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
- **Subagent targets — the 9 bundled subagents are pre-approved:**
  `interviewer`, `researcher`, `planner`, `plan-reviewer`, `coder`,
  `code-reviewer`, `tester`, `debugger`, `writer`. The wildcard is
  `ask`, not `deny`: any other subagent (`general`, `explore`,
  user-defined) is a legitimate target once the user confirms.
- **Skill: `workflow-driver` only**; every subagent gets the injected
  `workflow-subagent` contract body — skill defaults and the report
  format are specified in
  [docs/skills.md](skills.md#default-state).
- **Guardrails:** redirect `**>[^&]**` deny, `sudo *` deny,
  `rm -rf /**` deny, `git push *` ask.
- `question` ✓, `webfetch` ✓.

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

**Shell-capable non-editors** — may run commands to gather evidence,
but never modify anything:

- `debugger` — diagnosis role: `reproduce → minimize → root-cause` with
  `file:line` evidence. `drive` routes it when a defect needs a
  reproduction and a root cause before anyone can fix it; the finished
  diagnosis is handed to `coder`, because `debugger` never fixes — that
  is its contract. Permissions mirror `tester` minus the freedom: shell
  is an allowlist (build/test runners needed to reproduce, plus
  inspection and safe git) with the standard trailing guardrails,
  `edit` ✗, `subagent` ✗, webfetch/websearch ✗.

**Read-only analysts** — `read`/`glob`/`grep` ✓, `edit` ✗, `shell` ✗,
`subagent` ✗; they differ only in what they may add:

- `researcher` — `webfetch` ✓ (its whole purpose: external docs, APIs,
  prior art, with sources).
- `planner`, `plan-reviewer`, `code-reviewer` — fully offline: web ✗.
- `interviewer` — offline, but `question` ✓ (requirements elicitation
  is conversation).

All nine subagents share: `subagent` ✗ (no recursive delegation) and a
strict contract-only `skill` whitelist — the `workflow-subagent` skill
alone, whose contract body the plugin injects into every subagent's
system prompt ([docs/skills.md](skills.md#enforcement)); `drive` mirrors
the shape with `workflow-driver`. Everything else, companion skills
included, needs an explicit allow in your config tail — see
[docs/skills.md](skills.md#default-state).

### Shared guardrail matrix

| Guardrail                  | Pattern            | Effect | Agents                                           |
| -------------------------- | ------------------ | ------ | ------------------------------------------------ |
| No output redirection      | `**>[^&]**`        | deny   | `drive`, `debugger`, `tester`, `writer`          |
| No privilege escalation    | `sudo *`           | deny   | `drive`, `coder`, `tester`, `debugger`, `writer` |
| No destructive `rm`        | `rm -rf /**`       | deny   | `drive`, `coder`, `tester`, `debugger`, `writer` |
| Push needs human approval  | `git push *`       | ask    | `drive`, `coder`, `tester`, `debugger`, `writer` |
| Dotenv reads need approval | `*.env`, `*.env.*` | ask    | all — from the built-in defaults                 |

The rows above list exactly which agents carry each rule in their
frontmatter: shell-capable agents need these trailing guardrails —
`coder` ships without the redirect deny — while the read-only analysts
deny `shell` outright, so the command guardrails are moot for them.

## Model guidance

Agents ship unpinned. Sensible classes when you pin per role:

| Class           | Agents                                                |
| --------------- | ----------------------------------------------------- |
| Heavy reasoning | `drive`, `plan-reviewer`, `code-reviewer`, `debugger` |
| Balanced        | `coder`, `researcher`, `planner`                      |
| Fast            | `tester`, `interviewer`, `writer`                     |

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

The plugin leaves the stock agents untouched: `plan` and `build` stay
exactly as stock OpenCode ships them and coexist with `drive` (the
`general` / `explore` subagents were never modified either). If you
want `plan` and `build` gone, disable them yourself — the plugin no
longer does it for you:

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
- [README](../README.md) — install, usage.
