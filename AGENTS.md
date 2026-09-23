# @alexeyco/opencode-workflow

OpenCode v2 plugin that registers 11 agents (3 primaries + 8 subagents)
and the `workflow` routing skill.
Human-facing docs: [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```
opencode-workflow/
├── index.ts                    shim for local directory installs
├── opencode/
│   ├── index.ts                plugin entry: agents + workflow skill
│   ├── permissions.ts          composePermissions (defaults → plugin → user)
│   └── markdown.ts             frontmatter parsing/validation
├── agents/                     11 agent definitions (3 primary + 8 subagent)
├── skills/workflow/SKILL.md    orchestration skill loaded by make
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
- Permission composition order: defaults → plugin rules → user rules,
  last match wins (`Array.prototype.findLast`).
- Assets are read at runtime relative to `import.meta.dirname` — keep
  `package.json` `files` in sync when adding new paths.
- Run `make fmt` before committing.

## Release

Tag-driven npm publish — see [CONTRIBUTING.md](CONTRIBUTING.md#publishing).
