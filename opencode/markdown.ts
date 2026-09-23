// Markdown asset loader: splits YAML frontmatter from body and parses the
// frontmatter with the `yaml` package (flow-mapping arrays like
// `{ action: read, resource: "*", effect: allow }` need a real parser).

import YAML from "yaml";

export interface PermissionRule {
  readonly action: string;
  readonly resource: string;
  readonly effect: "allow" | "deny" | "ask";
}

export interface AgentDoc {
  readonly description: string;
  readonly mode: "primary" | "subagent";
  readonly color?: string;
  readonly permissions: PermissionRule[];
}

export interface CommandDoc {
  readonly description: string;
}

export interface SkillDoc {
  readonly name: string;
  readonly description: string;
}

export interface ParsedMarkdown<T> {
  readonly frontmatter: T;
  readonly body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseMarkdown<T = unknown>(raw: string): ParsedMarkdown<T> {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("markdown: missing or invalid YAML frontmatter");
  }
  const yamlText = match[1]!;
  const body = raw.slice(match[0].length);
  let frontmatter: unknown;
  try {
    frontmatter = YAML.parse(yamlText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`markdown: failed to parse frontmatter YAML: ${msg}`);
  }
  if (frontmatter === null || typeof frontmatter !== "object") {
    throw new Error("markdown: frontmatter must parse to an object");
  }
  return { frontmatter: frontmatter as T, body };
}

const VALID_MODES = new Set(["primary", "subagent"]);
const VALID_EFFECTS = new Set(["allow", "deny", "ask"]);

export function validateAgentDoc(value: unknown): AgentDoc {
  if (!value || typeof value !== "object") {
    throw new Error("agent doc: frontmatter must be an object");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.description !== "string") {
    throw new Error("agent doc: frontmatter missing string 'description'");
  }
  if (typeof v.mode !== "string" || !VALID_MODES.has(v.mode)) {
    throw new Error(
      `agent doc: frontmatter 'mode' must be primary|subagent, got ${String(v.mode)}`,
    );
  }
  if (v.color !== undefined && typeof v.color !== "string") {
    throw new Error("agent doc: frontmatter 'color' must be a string when set");
  }
  if (!Array.isArray(v.permissions)) {
    throw new Error("agent doc: frontmatter 'permissions' must be an array");
  }
  const permissions: PermissionRule[] = [];
  for (const [i, rule] of v.permissions.entries()) {
    if (!rule || typeof rule !== "object") {
      throw new Error(`agent doc: permissions[${i}] must be an object`);
    }
    const r = rule as Record<string, unknown>;
    if (typeof r.action !== "string") {
      throw new Error(`agent doc: permissions[${i}].action must be a string`);
    }
    if (typeof r.resource !== "string") {
      throw new Error(`agent doc: permissions[${i}].resource must be a string`);
    }
    if (typeof r.effect !== "string" || !VALID_EFFECTS.has(r.effect)) {
      throw new Error(
        `agent doc: permissions[${i}].effect must be allow|deny|ask, got ${String(r.effect)}`,
      );
    }
    permissions.push({
      action: r.action,
      resource: r.resource,
      effect: r.effect as PermissionRule["effect"],
    });
  }
  const doc: AgentDoc = {
    description: v.description,
    mode: v.mode as AgentDoc["mode"],
    permissions,
  };
  if (typeof v.color === "string") {
    return { ...doc, color: v.color };
  }
  return doc;
}

export function validateCommandDoc(value: unknown): CommandDoc {
  if (!value || typeof value !== "object") {
    throw new Error("command doc: frontmatter must be an object");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.description !== "string") {
    throw new Error("command doc: frontmatter missing string 'description'");
  }
  return { description: v.description };
}

export function validateSkillDoc(value: unknown): SkillDoc {
  if (!value || typeof value !== "object") {
    throw new Error("skill doc: frontmatter must be an object");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string") {
    throw new Error("skill doc: frontmatter missing string 'name'");
  }
  if (typeof v.description !== "string") {
    throw new Error("skill doc: frontmatter missing string 'description'");
  }
  return { name: v.name, description: v.description };
}
