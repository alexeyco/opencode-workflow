# Changelog

## 0.1.0

- Initial release.
- 11 agents: `make`, `ask`, `YOLO` primaries + 8 subagents (`coder`,
  `tester`, `researcher`, `planner`, `plan-reviewer`, `code-reviewer`,
  `interviewer`, `writer`) with least-privilege permission sets.
- `workflow` orchestration skill — parallel waves, DoD gates, subagent
  routing.
- Plugin removes built-in `plan` / `build` agents automatically.
- Skill access tunable via `opencode.jsonc` `agents.<id>.permissions`;
  last match wins.
- Agents ship without model pins — inherit the default model.
