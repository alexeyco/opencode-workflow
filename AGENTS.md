# @alexeyco/opencode-workflow

OpenCode v2 plugin that registers 10 agents (1 primary + 9 subagents)
and the `workflow-driver` + `workflow-subagent` skills.
Human-facing docs: [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```
opencode-workflow/
├── index.ts                    shim for local directory installs
├── opencode/
│   ├── index.ts                plugin entry: agents + two skills
│   ├── permissions.ts          composePermissions (defaults → plugin → user)
│   └── markdown.ts             frontmatter parsing/validation
├── agents/                     10 agent definitions (1 primary + 9 subagent)
├── skills/workflow-driver/SKILL.md    orchestration router loaded by drive
├── skills/workflow-subagent/SKILL.md  universal subagent contract + report format
├── docs/                       agents.md catalog · skills.md tuning · gallery/ diagrams
├── scripts/check.mjs           sanity checks behind make check
├── tests/                      unit tests (node --test)
├── Makefile · package.json · tsconfig.json · .github/
```

## Conventions

- All content in English.
- OpenCode v2 only — zero v1 plugin API references; `scripts/check.mjs`
  fails on any v1 import.
- Agent `.md` files: no `model:` pins, array-style permissions with the v2
  action vocabulary (`read`, `edit`, `shell`, `subagent`, `skill`, `glob`,
  `grep`, `question`, `webfetch`, `websearch`, `external_directory`).
- Subagent `skill` rules ship contract-only: deny `*`, allow
  `workflow-subagent` (`drive`: `workflow-driver` only) — each agent
  gets exactly its own plugin skill. No companion skills are
  pre-allowed; extra skills are opt-in via user tail rules.
- Permission composition order: defaults → plugin rules → user rules,
  last match wins (`Array.prototype.findLast`).
- Assets are read at runtime relative to `import.meta.dirname` — keep
  `package.json` `files` in sync when adding new paths.
- Run `make fmt` before committing.

## Release

Tag-driven npm publish — see [CONTRIBUTING.md](CONTRIBUTING.md#publishing).
