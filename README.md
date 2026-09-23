# @alexeyco/opencode-workflow

A complete multi-agent engineering team for OpenCode — orchestrator, 8 specialized subagents, 2 utility primaries, and the `workflow` routing skill — in one plugin.

## Why

- **Delegation-first orchestration.** `make` breaks work into parallel waves, gates each wave on a Definition-of-Done, and never falls back to "do it yourself" — subagents own the work end-to-end.
- **11 role-tuned agents, role-scoped permission sets.** Each agent ships with the narrowest permission set it needs; no agent gets more than its role requires.
- **Interactive terminal review via the official revdiff plugin.** Annotate diffs in your terminal and the agent fixes every remark — see [revdiff integration](#revdiff-integration-optional) below.
- **Skills stay yours.** Agents see every skill installed in your environment; tune access per agent from `opencode.jsonc`.
- **Kills the stock `plan` / `build` agents.** One orchestrator to rule them all.

## What you get

| Agent           | Mode     | Role                                                  |
| --------------- | -------- | ----------------------------------------------------- |
| `make`          | primary  | workflow orchestrator — routes work through subagents |
| `ask`           | primary  | read-only Q&A, no side effects                        |
| `YOLO`          | primary  | unrestricted executor, no confirmations               |
| `coder`         | subagent | implementation                                        |
| `tester`        | subagent | tests and test runs                                   |
| `researcher`    | subagent | codebase and docs exploration                         |
| `planner`       | subagent | plan drafting                                         |
| `plan-reviewer` | subagent | plan critique                                         |
| `code-reviewer` | subagent | diff critique                                         |
| `interviewer`   | subagent | requirements elicitation                              |
| `writer`        | subagent | docs and copy                                         |

## Install

```jsonc
// opencode.json(c)
{ "plugins": ["@alexeyco/opencode-workflow"] }
```

OpenCode v2 native key is `plugins`; opencode installs the npm package automatically. Then restart opencode and switch the primary agent to `make`.

## revdiff integration (optional)

For interactive terminal diff review, install the official upstream revdiff opencode plugin — it provides a `revdiff` custom tool and `/revdiff` command with **no shell-tool timeout** (the bundled launcher was capped at 120 s).

```sh
opencode plugin add github.com/umputun/revdiff/plugins/opencode
# or run setup.sh from the repo root
```

See [umputun/revdiff](https://github.com/umputun/revdiff) (`plugins/opencode/`, `setup.sh`). The overlay requires one of: tmux, Zellij, herdr, kitty, wezterm, cmux, ghostty, iTerm2, Emacs vterm, agterm.

To let `make` call the `revdiff` tool without a permission prompt, allow the `revdiff` action in `opencode.jsonc`:

```jsonc
{
  "agents": {
    "make": {
      "permissions": [
        { "action": "revdiff", "resource": "*", "effect": "allow" },
      ],
    },
  },
}
```

User rules are applied after plugin rules (last match wins), so this override takes effect; YOLO already allows everything. Annotations arrive in the current agent's session and `make` delegates fixes per the workflow skill.

## Usage

- Talk to `make` in natural language — it routes work through subagents per the `workflow` skill.
- With the revdiff plugin installed: `/revdiff` on a dirty branch → overlay review → agent fixes every annotation; on a clean branch → `gitleaks` + full-tree review.

## Tuning subagent skill access

By default every agent **except `make`** may load **all** skills discovered by opencode (`~/.config/opencode/skills`, `~/.agents/skills`, project `.opencode/skills`, …). `make` is workflow-only.

To restrict a subagent, add rules to your `opencode.jsonc` — they are applied **after** the plugin's rules, **last match wins** (`Array.prototype.findLast` semantics):

```jsonc
{
  "agents": {
    "coder": {
      "permissions": [
        { "action": "skill", "resource": "*", "effect": "deny" },
        {
          "action": "skill",
          "resource": "test-driven-development",
          "effect": "allow",
        },
        {
          "action": "skill",
          "resource": "systematic-debugging",
          "effect": "allow",
        },
      ],
    },
  },
}
```

The snippet above denies every skill to `coder`, then re-allows two. See [docs/skills.md](docs/skills.md) for the full tuning deep-dive.

## Companion skills (optional)

The `workflow` methodology is designed to pair with skills such as `grilling`, `writing-plans`, `test-driven-development`, `caveman-review`, `docmap`, etc. when installed in your environment. They are **not bundled** — steps degrade gracefully when a skill is missing.

## Models

Agents ship **unpinned** and inherit your default model.

| Class           | Agents                                   |
| --------------- | ---------------------------------------- |
| Heavy reasoning | `make`, `plan-reviewer`, `code-reviewer` |
| Balanced        | `coder`, `researcher`, `planner`         |
| Fast            | `ask`, `tester`, `interviewer`, `writer` |

Pin per agent when needed:

```jsonc
{ "agents": { "coder": { "model": "provider/model" } } }
```

## Disabling `plan` / `build`

The plugin removes them automatically. Config fallback if you ever need it without the plugin:

```jsonc
{ "agents": { "plan": { "disabled": true }, "build": { "disabled": true } } }
```

## Adopting the plugin

If you previously kept hand-written copies of these agents / skills in `~/.config/opencode`, remove the duplicates (`agents/*.md`, `skills/workflow`) to avoid double registration.

## Requirements

OpenCode v2. The v1 plugin API is not supported.

## See also

- [docs/agents.md](docs/agents.md) — full catalog + permission tables.
- [docs/skills.md](docs/skills.md) — skill-access tuning deep-dive.
- [CONTRIBUTING.md](CONTRIBUTING.md) — development and release workflow.
- [CHANGELOG.md](CHANGELOG.md).
