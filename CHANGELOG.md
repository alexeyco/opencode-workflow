# Changelog

## 0.2.1

### Fixed

- Subagent report-format compliance is now mechanical: the
  `workflow-subagent` contract body is injected into every subagent's
  system prompt by a session `context` hook — compliance was prompt-only
  in each agent's body before and silently skipped by some
  models/agents.
- The `workflow-subagent` skill ships `opencode/autoinvoke: false` and
  stays hidden from model skill lists — registered and loadable by id,
  but no longer double-loaded next to the injected body.
- Agent bodies no longer carry format guidance or load instructions —
  the injected contract makes them redundant.
- `drive` no longer forbids subagent targets outside the bundle: the
  `subagent` wildcard went from `deny` to `ask`, so `general`,
  `explore` and any user-defined subagent need user confirmation
  instead of being refused; the 9 bundled subagents stay
  pre-approved. The contract hook captures subagents by agent mode,
  not a fixed id-list, so every subagent that runs gets the injected
  contract.
- `workflow-subagent` body rewritten as a typed field schema plus
  JSON shape; contract prose condensed ~40% (it is injected into every
  subagent request).

## 0.2.0

### Fixed

- `composePermissions` no longer drops user rules identical to plugin
  rules; replacement skill sets fully honor last-match-wins.

### Changed

- Subagent skill access narrowed to a strict contract-only whitelist:
  every subagent now ships `{ skill, *, deny }` plus
  a single allow for `workflow-subagent`; `drive` is unchanged
  (`workflow-driver` only). No companion skills are pre-allowed — the
  optional role pairings in `docs/skills.md` are purely opt-in, enabled
  with one `allow` rule per agent in the config tail.
- Breaking for setups relying on subagents seeing all installed skills:
  anything outside an agent's own plugin skill now needs an explicit
  allow in `opencode.jsonc` tail rules (deny-then-reallow shape, kept
  set must include `workflow-subagent`). Companion skills stay optional
  installs — steps degrade gracefully when one is absent.
- Subagent report JSON keys lowercased
  (`status/result/evidence/issues/next`), replacing the caps keys
  shipped in 0.1.0.

## 0.1.0

- 10 agents: `drive` primary + 9 subagents (`coder`, `tester`,
  `debugger`, `researcher`, `planner`, `plan-reviewer`, `code-reviewer`,
  `interviewer`, `writer`) with least-privilege permission sets.
- Two skills: `workflow-driver` (orchestration router) +
  `workflow-subagent` (universal subagent contract — English reasoning,
  strict brevity, STATUS / RESULT / EVIDENCE / ISSUES / NEXT report).
- `debugger` subagent: reproduce → minimize → root-cause with
  `file:line` evidence; hands the diagnosis to `coder` and never fixes
  anything itself.
- Plugin leaves built-in `plan` / `build` agents untouched — they
  coexist with `drive`.
- Skill access tunable via `opencode.jsonc` `agents.<id>.permissions`;
  last match wins.
- Agents ship without model pins — inherit the default model.
