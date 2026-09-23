# @alexeyco/opencode-workflow

OpenCode v2 plugin that registers 11 agents (3 primaries + 8 subagents),
the `workflow` routing skill, and the `/revdiff` interactive review command.
Human-facing docs: [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

- `index.ts` — shim for local directory installs (host probes `<dir>/index.ts`);
  npm installs resolve via `package.json` `exports`.
- `opencode/index.ts` — plugin entry; registers agents, the `/revdiff` command,
  and the `workflow` skill with OpenCode v2 (`@opencode/plugin`).
- `opencode/permissions.ts` — `composePermissions`; merges defaults → plugin
  rules → user rules, last match wins.
- `opencode/render.ts` — `renderCommand`; substitutes `{{REVDIFF_LAUNCHER}}`
  in the command template at runtime.
- `agents/*.md` — 11 agent definitions (no `model:` pins, array-style
  permissions with v2 action vocabulary).
- `commands/revdiff.md` — command template; `{{REVDIFF_LAUNCHER}}` is replaced
  with the resolved path to `tools/launch-revdiff.sh`.
- `skills/workflow/SKILL.md` — orchestration skill loaded by `make`.
- `tools/launch-revdiff.sh` — vendored from umputun/revdiff (MIT); see
  CONTRIBUTING for re-sync instructions.
- `scripts/check.mjs` — sanity checks behind `make check`; same checks run
  in CI.
- `tests/` — test suite, run by `make check`.
- `docs/` — `agents.md` (full catalog + permission tables) and `skills.md`
  (skill-access tuning deep-dive).

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
