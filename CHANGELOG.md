# Changelog

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
