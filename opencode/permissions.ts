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

/** True when `candidate` appears verbatim (ordered) at `offset` in `rules`. */
function matchesPrefix(
  rules: readonly PermissionRule[],
  offset: number,
  candidate: readonly PermissionRule[],
): boolean {
  if (offset + candidate.length > rules.length) {
    return false;
  }
  return candidate.every((rule, i) => ruleEquals(rules[offset + i]!, rule));
}

/**
 * Compose final permission order:
 *   [all 5 defaults in canonical order, ...mdRules, ...verbatim tail]
 *
 * The 5 defaults are always present in the output, even if not in the input.
 *
 * Stripping is positional, never by content: if `existing` starts with the
 * defaults in canonical order, that prefix is dropped; then if the segment
 * right after it equals `mdRules` (ordered), that segment is dropped too.
 * Everything after is the user's verbatim tail — rules identical to an
 * mdRule survive in tail position, so `findLast` still gives user rules
 * final say (a full "replace the kept set" override works).
 *
 * Idempotent: the output starts with defaults then mdRules, so composing it
 * again strips exactly that head, keeps the tail, and re-prepends in the
 * same order — a deep-equal array.
 */
export function composePermissions(
  existing: readonly PermissionRule[],
  mdRules: readonly PermissionRule[],
): PermissionRule[] {
  let head = 0;
  if (matchesPrefix(existing, head, DEFAULT_PERMISSION_RULES)) {
    head += DEFAULT_PERMISSION_RULES.length;
  }
  if (matchesPrefix(existing, head, mdRules)) {
    head += mdRules.length;
  }
  const tail = existing.slice(head);
  return [...DEFAULT_PERMISSION_RULES, ...mdRules, ...tail];
}
