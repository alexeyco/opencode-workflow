# @alexeyco/opencode-workflow

A complete multi-agent engineering team for OpenCode v2 — orchestrator, 8 specialized subagents, 2 utility primaries, and the `workflow` routing skill — in one plugin.

<p align="center">
  <img src="docs/gallery/workflow.svg" alt="make orchestrates subagents; dashed groups fan out into parallel runs and merge back" width="640">
</p>

## Why

- **Delegation-first orchestration.** `make` breaks work into parallel waves, gates each wave on a Definition-of-Done, and never falls back to "do it yourself" — subagents own the work end-to-end.
- **11 role-tuned agents, role-scoped permission sets.** Each agent ships with the narrowest permission set it needs; no agent gets more than its role requires.
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
{
  "plugins": ["@alexeyco/opencode-workflow"],
}
```

OpenCode v2 native key is `plugins`; opencode installs the npm package automatically. Then restart opencode and switch the primary agent to `make`.

## Usage

- Talk to `make` in natural language — it routes work through subagents per the `workflow` skill.

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

## See also

- [docs/agents.md](docs/agents.md) — full catalog + permission tables.
- [docs/skills.md](docs/skills.md) — skill-access tuning deep-dive.
- [CONTRIBUTING.md](CONTRIBUTING.md) — development and release workflow.
- [CHANGELOG.md](CHANGELOG.md).
