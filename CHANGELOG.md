# Changelog

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
