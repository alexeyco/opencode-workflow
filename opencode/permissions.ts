// Permission composition: merges the 5 built-in defaults, the plugin's
// markdown-defined rules, and any pre-existing rules (global config + user
// overrides) so that `findLast` semantics give user rules final say.

import type { PermissionRule } from "./markdown.ts";

export const DEFAULT_PERMISSION_RULES: readonly PermissionRule[] = [
  { action: "*", resource: "*", effect: "allow" },
  { action: "external_directory", resource: "*", effect: "ask" },
  { action: "read", resource: "*.env", effect: "ask" },
  { action: "read", resource: "*.env.*", effect: "ask" },
  { action: "read", resource: "*.env.example", effect: "allow" },
] as const;

function ruleEquals(a: PermissionRule, b: PermissionRule): boolean {
  return (
    a.action === b.action && a.resource === b.resource && a.effect === b.effect
  );
}

function isDefaultRule(rule: PermissionRule): boolean {
  return DEFAULT_PERMISSION_RULES.some((d) => ruleEquals(d, rule));
}

function anyRuleEquals(
  rule: PermissionRule,
  set: readonly PermissionRule[],
): boolean {
  return set.some((s) => ruleEquals(s, rule));
}

/**
 * Compose final permission order:
 *   [all 5 defaults in canonical order, ...mdRules, ...pre-existing non-default non-md rules]
 *
 * The 5 defaults are always present in the output, even if not in the input.
 * Idempotent: composing the result again with the same mdRules yields a
 * deep-equal array. Pre-existing md rules are classified as "rest" on the
 * second pass but dropped from it (they already sit in the middle), so no
 * duplication occurs.
 */
export function composePermissions(
  existing: readonly PermissionRule[],
  mdRules: readonly PermissionRule[],
): PermissionRule[] {
  const rest: PermissionRule[] = [];
  for (const rule of existing) {
    if (!isDefaultRule(rule)) {
      rest.push(rule);
    }
  }
  // Drop from `rest` anything already covered by mdRules (idempotency).
  const filteredRest = rest.filter((r) => !anyRuleEquals(r, mdRules));
  return [...DEFAULT_PERMISSION_RULES, ...mdRules, ...filteredRest];
}
