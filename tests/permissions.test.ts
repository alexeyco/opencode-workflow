import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composePermissions,
  DEFAULT_PERMISSION_RULES,
} from "../opencode/permissions.ts";
import type { PermissionRule } from "../opencode/markdown.ts";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Mini glob matcher: converts `*` to `.*` and anchors the pattern.
 * Used for semantic permission resolution tests.
 */
function globMatch(pattern: string, value: string): boolean {
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  return regex.test(value);
}

/**
 * Resolve permission using findLast semantics with glob matching.
 * Returns the effect of the last matching rule, or "allow" if no match.
 */
function resolvePermission(
  rules: readonly PermissionRule[],
  action: string,
  resource: string,
): "allow" | "deny" | "ask" {
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]!;
    if (
      (rule.action === "*" || rule.action === action) &&
      globMatch(rule.resource, resource)
    ) {
      return rule.effect;
    }
  }
  return "allow";
}

const DRIVE_MD_RULES: PermissionRule[] = [
  { action: "read", resource: "*", effect: "allow" },
  { action: "edit", resource: "*", effect: "deny" },
  { action: "shell", resource: "*", effect: "ask" },
  { action: "shell", resource: "which*", effect: "allow" },
  { action: "shell", resource: "sudo *", effect: "deny" },
  { action: "subagent", resource: "*", effect: "deny" },
  { action: "subagent", resource: "coder", effect: "allow" },
  { action: "subagent", resource: "tester", effect: "allow" },
  { action: "subagent", resource: "researcher", effect: "allow" },
  { action: "subagent", resource: "planner", effect: "allow" },
  { action: "subagent", resource: "plan-reviewer", effect: "allow" },
  { action: "subagent", resource: "code-reviewer", effect: "allow" },
  { action: "subagent", resource: "interviewer", effect: "allow" },
  { action: "subagent", resource: "writer", effect: "allow" },
  { action: "subagent", resource: "debugger", effect: "allow" },
  { action: "skill", resource: "*", effect: "deny" },
  { action: "skill", resource: "workflow-driver", effect: "allow" },
];

test("composePermissions: fresh-create ordering", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "shell", resource: "sudo *", effect: "deny" }, // global config
    { action: "skill", resource: "grilling", effect: "deny" }, // user override
  ];
  const result = composePermissions(existing, DRIVE_MD_RULES);

  // First 5 must be the defaults in canonical order.
  for (let i = 0; i < DEFAULT_PERMISSION_RULES.length; i++) {
    assert.deepStrictEqual(result[i], DEFAULT_PERMISSION_RULES[i]);
  }
  // Next come the md rules in order.
  for (let i = 0; i < DRIVE_MD_RULES.length; i++) {
    assert.deepStrictEqual(
      result[DEFAULT_PERMISSION_RULES.length + i],
      DRIVE_MD_RULES[i],
    );
  }
  // Tail: global + user rules, verbatim. The sudo-deny rule is byte-equal
  // to a drive md rule but survives in tail position (last-match-wins is
  // positional; composition never filters the tail by content).
  const tail = result.slice(
    DEFAULT_PERMISSION_RULES.length + DRIVE_MD_RULES.length,
  );
  assert.deepStrictEqual(tail, [
    { action: "shell", resource: "sudo *", effect: "deny" },
    { action: "skill", resource: "grilling", effect: "deny" },
  ]);
});

test("composePermissions: idempotent across 3 runs", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "shell", resource: "sudo *", effect: "deny" },
    { action: "skill", resource: "grilling", effect: "deny" },
  ];
  const once = composePermissions(existing, DRIVE_MD_RULES);
  const twice = composePermissions(once, DRIVE_MD_RULES);
  const thrice = composePermissions(twice, DRIVE_MD_RULES);
  assert.ok(deepEqual(once, twice), "once != twice");
  assert.ok(deepEqual(twice, thrice), "twice != thrice");
});

test("composePermissions: user override wins via findLast", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "workflow-driver", effect: "deny" }, // user override
  ];
  const result = composePermissions(existing, DRIVE_MD_RULES);

  // findLast for (skill, workflow-driver): md has {skill, workflow-driver, allow}, then
  // user's {skill, workflow-driver, deny} sits in the tail → deny wins.
  const matches = result.filter(
    (r) => r.action === "skill" && r.resource === "workflow-driver",
  );
  assert.deepStrictEqual(matches[matches.length - 1], {
    action: "skill",
    resource: "workflow-driver",
    effect: "deny",
  });

  // findLast for (shell, "ls x"): md has {shell, *, ask}, no later shell rule
  // matches "ls x" literally, so ask wins.
  const shellMatches = result.filter(
    (r) =>
      r.action === "shell" && (r.resource === "*" || r.resource === "ls x"),
  );
  assert.deepStrictEqual(shellMatches[shellMatches.length - 1], {
    action: "shell",
    resource: "*",
    effect: "ask",
  });
});

test("composePermissions: defaults always first in canonical order", () => {
  const existing: PermissionRule[] = [
    { action: "read", resource: "*.env.example", effect: "allow" },
    { action: "*", resource: "*", effect: "allow" },
    { action: "external_directory", resource: "*", effect: "ask" },
  ];
  const result = composePermissions(existing, DRIVE_MD_RULES);
  for (let i = 0; i < DEFAULT_PERMISSION_RULES.length; i++) {
    assert.deepStrictEqual(result[i], DEFAULT_PERMISSION_RULES[i]);
  }
});

test("resolvePermission: semantic findLast with glob matching", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "grilling", effect: "deny" }, // user override
  ];
  const rules = composePermissions(existing, DRIVE_MD_RULES);

  // resolve("shell", "sudo rm x") → deny (matches {shell,"sudo *",deny} last)
  assert.equal(
    resolvePermission(rules, "shell", "sudo rm x"),
    "deny",
    "sudo rm x should be denied",
  );

  // resolve("shell", "ls x") → ask (matches {shell,"*",ask})
  assert.equal(
    resolvePermission(rules, "shell", "ls x"),
    "ask",
    "ls x should ask",
  );

  // resolve("skill", "workflow-driver") → allow (drive has {skill, workflow-driver, allow})
  assert.equal(
    resolvePermission(rules, "skill", "workflow-driver"),
    "allow",
    "workflow-driver skill should be allowed for drive",
  );

  // resolve("skill", "grilling") → deny (user override in tail)
  assert.equal(
    resolvePermission(rules, "skill", "grilling"),
    "deny",
    "grilling skill should be denied by user override",
  );

  // resolve("skill", "other") → deny (drive has {skill, *, deny}; no later allow overrides)
  assert.equal(
    resolvePermission(rules, "skill", "other"),
    "deny",
    "other skills resolve to deny via drive's deny-all rule",
  );
});

// Coder-like md (synthetic): strict skill whitelist shape with one extra
// ordered allow rule, used to exercise positional stripping and tail order.
const CODER_MD_RULES: PermissionRule[] = [
  { action: "skill", resource: "*", effect: "deny" },
  { action: "skill", resource: "workflow-subagent", effect: "allow" },
  { action: "skill", resource: "test-driven-development", effect: "allow" },
];

test("composePermissions: user tail rule identical to a plugin rule survives", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "workflow-driver", effect: "allow" }, // duplicate of md rule
    { action: "skill", resource: "*", effect: "deny" }, // duplicate of md rule
  ];
  const result = composePermissions(existing, DRIVE_MD_RULES);

  // Positional stripping: the tail neither starts with defaults nor equals
  // the full md list, so both duplicates are kept verbatim in tail order.
  const tail = result.slice(
    DEFAULT_PERMISSION_RULES.length + DRIVE_MD_RULES.length,
  );
  assert.deepStrictEqual(tail, [
    { action: "skill", resource: "workflow-driver", effect: "allow" },
    { action: "skill", resource: "*", effect: "deny" },
  ]);

  // Occurrence counts: 1 from mdRules + 1 from the user's own copy each.
  const wdAllows = result.filter(
    (r) =>
      r.action === "skill" &&
      r.resource === "workflow-driver" &&
      r.effect === "allow",
  );
  assert.equal(wdAllows.length, 2, "md allow + user's identical tail allow");
  const skillDenyStars = result.filter(
    (r) => r.action === "skill" && r.resource === "*" && r.effect === "deny",
  );
  assert.equal(skillDenyStars.length, 2, "md deny-all + user's tail deny-all");
});

test("composePermissions: replacement skill set honors last-match-wins", () => {
  // Documented recipe: user replaces the kept set outright. Under the old
  // content-filtering, the tail's {skill,*,deny} and
  // {skill,workflow-subagent,allow} were dropped as md-rule duplicates,
  // leaving the plugin's test-driven-development allow uncountermanded.
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "*", effect: "deny" },
    { action: "skill", resource: "workflow-subagent", effect: "allow" },
    { action: "skill", resource: "docmap", effect: "allow" },
  ];
  const result = composePermissions(existing, CODER_MD_RULES);

  assert.equal(
    resolvePermission(result, "skill", "test-driven-development"),
    "deny",
    "plugin companion must be denied by the user's replacement deny-all",
  );
  assert.equal(
    resolvePermission(result, "skill", "docmap"),
    "allow",
    "user's replacement allow survives",
  );
  assert.equal(
    resolvePermission(result, "skill", "workflow-subagent"),
    "allow",
    "contract skill stays allowed via the user's own tail allow",
  );
});

test("composePermissions: idempotent when tail duplicates an md rule", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "*", effect: "deny" }, // byte-equal to an md rule
  ];
  const once = composePermissions(existing, DRIVE_MD_RULES);
  const twice = composePermissions(once, DRIVE_MD_RULES);
  assert.ok(
    deepEqual(once, twice),
    "compose(compose(base, md), md) must equal compose(base, md)",
  );
});

test("composePermissions: first application without defaults prefix keeps tail verbatim", () => {
  const existing: PermissionRule[] = [
    { action: "edit", resource: "*", effect: "ask" },
  ];
  const result = composePermissions(existing, DRIVE_MD_RULES);
  assert.deepStrictEqual(result, [
    ...DEFAULT_PERMISSION_RULES,
    ...DRIVE_MD_RULES,
    { action: "edit", resource: "*", effect: "ask" },
  ]);
});
