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

const MAKE_MD_RULES: PermissionRule[] = [
  { action: "read", resource: "*", effect: "allow" },
  { action: "edit", resource: "*", effect: "deny" },
  { action: "shell", resource: "*", effect: "ask" },
  { action: "shell", resource: "which*", effect: "allow" },
  { action: "shell", resource: "sudo *", effect: "deny" },
  { action: "subagent", resource: "*", effect: "deny" },
  { action: "subagent", resource: "coder", effect: "allow" },
  { action: "skill", resource: "*", effect: "deny" },
  { action: "skill", resource: "workflow", effect: "allow" },
];

test("composePermissions: fresh-create ordering", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "shell", resource: "sudo *", effect: "deny" }, // global config
    { action: "skill", resource: "grilling", effect: "deny" }, // user override
  ];
  const result = composePermissions(existing, MAKE_MD_RULES);

  // First 5 must be the defaults in canonical order.
  for (let i = 0; i < DEFAULT_PERMISSION_RULES.length; i++) {
    assert.deepStrictEqual(result[i], DEFAULT_PERMISSION_RULES[i]);
  }
  // Next come the md rules in order.
  for (let i = 0; i < MAKE_MD_RULES.length; i++) {
    assert.deepStrictEqual(
      result[DEFAULT_PERMISSION_RULES.length + i],
      MAKE_MD_RULES[i],
    );
  }
  // Tail: global + user rules (non-default, non-md).
  const tail = result.slice(
    DEFAULT_PERMISSION_RULES.length + MAKE_MD_RULES.length,
  );
  assert.deepStrictEqual(tail, [
    { action: "skill", resource: "grilling", effect: "deny" },
  ]);
});

test("composePermissions: idempotent across 3 runs", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "shell", resource: "sudo *", effect: "deny" },
    { action: "skill", resource: "grilling", effect: "deny" },
  ];
  const once = composePermissions(existing, MAKE_MD_RULES);
  const twice = composePermissions(once, MAKE_MD_RULES);
  const thrice = composePermissions(twice, MAKE_MD_RULES);
  assert.ok(deepEqual(once, twice), "once != twice");
  assert.ok(deepEqual(twice, thrice), "twice != thrice");
});

test("composePermissions: user override wins via findLast", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "workflow", effect: "deny" }, // user override
  ];
  const result = composePermissions(existing, MAKE_MD_RULES);

  // findLast for (skill, workflow): md has {skill, workflow, allow}, then
  // user's {skill, workflow, deny} sits in the tail → deny wins.
  const matches = result.filter(
    (r) => r.action === "skill" && r.resource === "workflow",
  );
  assert.deepStrictEqual(matches[matches.length - 1], {
    action: "skill",
    resource: "workflow",
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
  const result = composePermissions(existing, MAKE_MD_RULES);
  for (let i = 0; i < DEFAULT_PERMISSION_RULES.length; i++) {
    assert.deepStrictEqual(result[i], DEFAULT_PERMISSION_RULES[i]);
  }
});

test("resolvePermission: semantic findLast with glob matching", () => {
  const existing: PermissionRule[] = [
    ...DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
    { action: "skill", resource: "grilling", effect: "deny" }, // user override
  ];
  const rules = composePermissions(existing, MAKE_MD_RULES);

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

  // resolve("skill", "workflow") → allow (make has {skill, workflow, allow})
  assert.equal(
    resolvePermission(rules, "skill", "workflow"),
    "allow",
    "workflow skill should be allowed for make",
  );

  // resolve("skill", "grilling") → deny (user override in tail)
  assert.equal(
    resolvePermission(rules, "skill", "grilling"),
    "deny",
    "grilling skill should be denied by user override",
  );

  // resolve("skill", "other") → deny (make has {skill, *, deny})
  assert.equal(
    resolvePermission(rules, "skill", "other"),
    "deny",
    "other skills should be denied for make",
  );
});
