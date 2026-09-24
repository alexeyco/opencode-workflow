# Skill access

How opencode discovers skills, what this plugin does with them by
default, and how to tune access per agent.

## What this plugin ships

The plugin registers **two** skills itself:

- `workflow-driver`
  ([`skills/workflow-driver/SKILL.md`](../skills/workflow-driver/SKILL.md)) —
  the orchestration router that `drive` loads to delegate work.
- `workflow-subagent` ([`skills/workflow-subagent/SKILL.md`](../skills/workflow-subagent/SKILL.md)) —
  the universal subagent contract: English reasoning for token economy,
  strict brevity, and the one JSON report format every subagent returns
  (defined by the skill itself; per-agent payload guidance lives in each
  [`agents/<id>.md`](../agents)).

It does **not** bundle companion skills and does not restrict what you
install — discovery is yours. What it _does_ restrict is what each agent
may load by default: a strict contract-only whitelist — each agent's own
plugin skill and nothing else.

The default rules per agent, straight from the frontmatter — deny all
skills, then allow back only the contract:

- All nine subagents:

  ```yaml
  - { action: skill, resource: "*", effect: deny }
  - { action: skill, resource: "workflow-subagent", effect: allow }
  ```

  `workflow-subagent` is contractually mandatory: each subagent's prompt
  hard-requires loading it before any action and replying in its report
  format (per-agent payload guidance in each `agents/<id>.md`). Every
  other skill a subagent may use — companion skills included — is
  opt-in: allow it in your `opencode.jsonc` tail rules, one rule per
  skill, same deny-then-reallow shape as the recipes below.

- `drive` uses the same shape by design — the orchestrator must load the
  routing skill first and never freelance with others:

  ```yaml
  - { action: skill, resource: "*", effect: deny }
  - { action: skill, resource: "workflow-driver", effect: allow }
  ```

### Default state

| Agent           | Skills allowed by default |
| --------------- | ------------------------- |
| `drive`         | `workflow-driver`         |
| `coder`         | `workflow-subagent`       |
| `tester`        | `workflow-subagent`       |
| `debugger`      | `workflow-subagent`       |
| `researcher`    | `workflow-subagent`       |
| `planner`       | `workflow-subagent`       |
| `plan-reviewer` | `workflow-subagent`       |
| `code-reviewer` | `workflow-subagent`       |
| `interviewer`   | `workflow-subagent`       |
| `writer`        | `workflow-subagent`       |

Contract-only: no skill beyond the agent's own ships in the default
whitelist — companion skills included (see
[Companion skills](#companion-skills)). Enable one with a single
`allow` rule per agent in your config tail. Everything outside a row is
denied until you allow it.

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

### Recipe — set an explicit skill list for `coder`

To replace a subagent's contract-only default outright, deny everything
in the tail, then re-allow the kept set — it **must include
`workflow-subagent`**, shown second below, plus whatever else the role
should see (this example adds `test-driven-development` and
`systematic-debugging`):

```jsonc
// opencode.jsonc
{
  "agents": {
    "coder": {
      "permissions": [
        { "action": "skill", "resource": "*", "effect": "deny" },
        {
          "action": "skill",
          "resource": "workflow-subagent",
          "effect": "allow",
        },
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

To merely _add_ one skill on top of the contract-only default — the way
to enable any companion or extra skill — skip the deny-all and append
the single `allow` rule — it lands in the tail, so `findLast` beats the
plugin's `{ skill, *, deny }`.

### Recipe — deny one noisy skill for all subagents

The contract-only default already keeps every unlisted skill away from
every subagent; you need this recipe once a skill _is_ allowed — one you
added in the tail — and want it gone for some agents. Permission
rules are **per agent** — there is no per-role grouping, so repeat the
rule for each agent you want it on:

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
tail _after_ plugin rules), such a global deny always beats any earlier
allow of that skill — yours from the config tail included — rather than
being silently overridden. Two caveats keep per-agent overrides the
recommended route: the tail segment keeps the order opencode resolved,
so how global and per-agent rules interleave is host-determined; and a
global rule also hits primaries — including `drive`, whose skill
surface you may want to keep deliberately curated. Prefer explicit
per-agent rules.

### Recipe — give `drive` extra skills

Append an allow; it sits in the tail, so `findLast` beats `drive`'s
`{ skill, *, deny }`:

```jsonc
// opencode.jsonc
{
  "agents": {
    "drive": {
      "permissions": [
        { "action": "skill", "resource": "grilling", "effect": "allow" },
      ],
    },
  },
}
```

Symmetrically, `{ "action": "skill", "resource": "workflow-driver", "effect": "deny" }`
would take `workflow-driver` away from `drive` — the plugin's routing then
depends entirely on `drive`'s system prompt. Not recommended.

> [!WARNING]
> Whenever you override the available skills of **any** agent, keep
> `workflow-driver` allowed on `drive` and `workflow-subagent` allowed
> on every subagent — these two skills carry the plugin's methodology
> (routing and the unified report format), and overriding them away
> breaks it.

## Companion skills

The `workflow-driver` methodology is designed to pair with the optional
skills below when they are installed in your environment — they are
**not bundled**, **not pre-allowed**, and steps degrade gracefully when
one is missing. Every role below still runs under the bundled
`workflow-subagent` contract:

| Skill                     | Optional pairing for | Purpose                             |
| ------------------------- | -------------------- | ----------------------------------- |
| `grilling`                | interviewer          | relentless requirements questions   |
| `writing-plans`           | planner              | plan structure and DoD discipline   |
| `test-driven-development` | coder                | tests-before-code workflow          |
| `caveman-review`          | code-reviewer        | blunt, high-signal diff review      |
| `systematic-debugging`    | debugger             | disciplined reproduce → root-cause  |
| `docmap`                  | writer               | README / AGENTS.md / docs blueprint |

They come from your own skill directories (`~/.config/opencode/skills`,
`~/.agents/skills`, project `.opencode/skills`, …) or any `skills`
config entry — install whichever you want. Nothing in this table ships
in an agent's default whitelist (see [Default state](#default-state)):
enable a pairing with one `allow` rule per agent, appended to your
`opencode.jsonc` tail — the add-a-single-skill shape shown under the
[`coder` recipe](#recipe--set-an-explicit-skill-list-for-coder).
`researcher`, `plan-reviewer` and `tester` have no listed pairing, but
by default no role allows anything beyond `workflow-subagent` anyway.

## Troubleshooting

- **Skill not visible** → is it `SKILL.md` (all caps) with valid
  `name`/`description` frontmatter, in a folder matching the skill name,
  in one of the [opencode discovery
  locations](https://opencode.ai/docs/skills)? And is it in that agent's
  whitelist — by default each agent allows only its own contract skill
  (`workflow-subagent`, `workflow-driver` for `drive`), so anything
  else must be allowed in your config tail (see
  [Default state](#default-state))?
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
