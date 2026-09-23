# Skill access

How opencode discovers skills, what this plugin does with them by
default, and how to tune access per agent.

## How opencode discovers skills

A skill is a folder with a `SKILL.md` (`name` + `description`
frontmatter, folder name = skill name). opencode scans these locations:

| Source                | Path                                                              |
| --------------------- | ----------------------------------------------------------------- |
| Global config         | `~/.config/opencode/skills/<name>/SKILL.md`                       |
| Project config        | `.opencode/skills/<name>/SKILL.md`                                |
| Global Claude-compat  | `~/.claude/skills/<name>/SKILL.md`                                |
| Project Claude-compat | `.claude/skills/<name>/SKILL.md`                                  |
| Global agents-compat  | `~/.agents/skills/<name>/SKILL.md`                                |
| Project agents-compat | `.agents/skills/<name>/SKILL.md`                                  |
| Config entries        | `skills` key in `opencode.jsonc` — paths or URLs to skill folders |

For project paths opencode walks up from the working directory to the
git worktree root, collecting every match. Discovered skills are listed
in the `skill` tool; the agent loads one on demand.

## What this plugin ships

The plugin registers **one** skill itself: `workflow`
([`skills/workflow/SKILL.md`](../skills/workflow/SKILL.md)), the
orchestration router. It does **not** bundle companion skills and does
not restrict what you install — discovery is yours.

The default rule per agent, straight from the frontmatter:

- All agents except `make`:

  ```yaml
  - { action: skill, resource: "*", effect: allow }
  ```

  → every agent sees **whatever is installed** in your environment.

- `make` is workflow-only by design — the orchestrator must load the
  routing skill first and never freelance with others:

  ```yaml
  - { action: skill, resource: "*", effect: deny }
  - { action: skill, resource: "workflow", effect: allow }
  ```

### Default state

| Agent                                                                                                                | Skill access         |
| -------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `make`                                                                                                               | `workflow` only      |
| `ask`, `YOLO`, `coder`, `tester`, `researcher`, `planner`, `plan-reviewer`, `code-reviewer`, `interviewer`, `writer` | all installed skills |

## Tuning via `opencode.jsonc`

### Rule format

The native v2 format is an **array** of rules; each rule is
`action` / `resource` / `effect`, where `resource` is matched as a
pattern (`*` wildcard) against the skill name:

```jsonc
{ "action": "skill", "resource": "my-skill", "effect": "deny" }
// effect: "allow" | "deny" | "ask"
```

### Composition order — why your rules win

When the plugin registers an agent it rewrites that agent's permission
list via
[`composePermissions`](../opencode/permissions.ts):

```text
[ 5 built-in defaults, ... plugin rules from agents/<id>.md, ... your config rules ]
```

1. **Defaults** (always first, canonical order): catch-all allow,
   `external_directory` ask, `*.env` / `*.env.*` read ask,
   `*.env.example` read allow.
2. **Plugin rules** — verbatim frontmatter order, which is why trailing
   `deny`/`ask` guardrails matter inside the plugin's own lists.
3. **Your rules** — everything you configured (global `permissions` plus
   per-agent overrides), non-default and non-duplicate, appended last.

opencode resolves an action with `Array.prototype.findLast` semantics:
of all rules matching `(action, resource)`, the **last one wins** — so
segment 3 always beats segment 2, which beats segment 1. Composition is
idempotent: rules identical to a plugin rule or a default are not
appended twice.

### Recipe — restrict `coder` to two skills

Deny everything, then re-allow (the README's canonical example):

```jsonc
// opencode.jsonc
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

### Recipe — deny one noisy skill for all subagents

Permission rules are **per agent** — there is no per-role grouping, so
repeat the rule for each agent you want it on:

```jsonc
// opencode.jsonc
{
  "agents": {
    "coder": {
      "permissions": [
        { "action": "skill", "resource": "noisy-skill", "effect": "deny" },
      ],
    },
    "tester": {
      "permissions": [
        { "action": "skill", "resource": "noisy-skill", "effect": "deny" },
      ],
    },
    // ... one entry per agent
  },
}
```

The top-level `permissions` array is the tempting shortcut — it applies
to every agent. Per the plugin's own composition (and its tests, which
model config rules — global and per-agent alike — as landing in the
tail _after_ plugin rules), such a global deny does in practice beat
the plugin's catch-all allow, rather than being silently overridden.
Two caveats keep per-agent overrides the recommended route: the tail
segment keeps the order opencode resolved, so how global and per-agent
rules interleave is host-determined; and a global rule also hits
primaries — including `make`, whose skill surface you may want to keep
deliberately curated. Prefer explicit per-agent rules.

### Recipe — give `make` extra skills

Append an allow; it sits in the tail, so `findLast` beats `make`'s
`{ skill, *, deny }`:

```jsonc
// opencode.jsonc
{
  "agents": {
    "make": {
      "permissions": [
        { "action": "skill", "resource": "grilling", "effect": "allow" },
      ],
    },
  },
}
```

Symmetrically, `{ "action": "skill", "resource": "workflow", "effect": "deny" }`
would take `workflow` away from `make` — the plugin's routing then
depends entirely on `make`'s system prompt. Not recommended.

## Companion skills

The `workflow` methodology is designed to pair with these skills when
they are installed in your environment — they are **not bundled**, and
steps degrade gracefully when one is missing:

| Skill                     | Reinforces step | Purpose                             |
| ------------------------- | --------------- | ----------------------------------- |
| `grilling`                | interviewer     | relentless requirements questions   |
| `writing-plans`           | planner         | plan structure and DoD discipline   |
| `test-driven-development` | coder           | tests-before-code workflow          |
| `caveman-review`          | code-reviewer   | blunt, high-signal diff review      |
| `docmap`                  | writer          | README / AGENTS.md / docs blueprint |

They come from your own skill directories (`~/.config/opencode/skills`,
`~/.agents/skills`, project `.opencode/skills`, …) or any `skills`
config entry — install whichever you want; agents with `skill: * allow`
pick them up automatically.

## Troubleshooting

- **Skill not visible** → check the discovery table above: is it
  `SKILL.md` (all caps) with valid `name`/`description` frontmatter, in
  a folder matching the skill name, unique across all locations?
- **`permission denied` on load** → remember last-match-wins: your rule
  only beats a plugin rule if it is in the config tail (it always is for
  `agents.<id>.permissions`), and a broader later rule can undo a
  narrower earlier one — order your own array deny-first, allow-except.
- **Verify against the running server** → start `opencode serve` and
  inspect the composed state: `GET /api/skill` (discovered skills) and
  `GET /api/agent/<id>` (agent definition incl. final permissions). The
  server's OpenAPI spec at `GET /doc` is the source of truth for exact
  paths.

## See also

- [docs/agents.md](agents.md) — full catalog + permission tables.
- [README — Tuning subagent skill access](../README.md#tuning-subagent-skill-access)
- [`opencode/permissions.ts`](../opencode/permissions.ts) — the composition implementation.
