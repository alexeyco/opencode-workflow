import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMarkdown,
  validateAgentDoc,
  validateCommandDoc,
  validateSkillDoc,
} from "../opencode/markdown.ts";

test("parseMarkdown: CRLF frontmatter parses", () => {
  const raw = "---\r\ndescription: test\r\nmode: primary\r\n---\r\nBody text";
  const { frontmatter, body } = parseMarkdown<{
    description: string;
    mode: string;
  }>(raw);
  assert.equal(frontmatter.description, "test");
  assert.equal(frontmatter.mode, "primary");
  assert.equal(body, "Body text");
});

test("parseMarkdown: missing closing --- throws", () => {
  const raw = "---\ndescription: test\nmode: primary\nBody without closing";
  assert.throws(
    () => parseMarkdown(raw),
    /missing or invalid YAML frontmatter/,
  );
});

test("parseMarkdown: empty body handled", () => {
  const raw = "---\ndescription: test\nmode: primary\n---\n";
  const { frontmatter, body } = parseMarkdown<{
    description: string;
    mode: string;
  }>(raw);
  assert.equal(frontmatter.description, "test");
  assert.equal(body, "");
});

test("parseMarkdown: non-object frontmatter throws", () => {
  const raw = "---\njust a string\n---\nBody";
  assert.throws(
    () => parseMarkdown(raw),
    /frontmatter must parse to an object/,
  );
});

test("parseMarkdown: scalar frontmatter throws", () => {
  const raw = "---\n42\n---\nBody";
  assert.throws(
    () => parseMarkdown(raw),
    /frontmatter must parse to an object/,
  );
});

test("validateAgentDoc: valid doc round-trips fields", () => {
  const input = {
    description: "Test agent",
    mode: "subagent",
    color: "#ff0000",
    permissions: [
      { action: "read", resource: "*", effect: "allow" },
      { action: "edit", resource: "*.ts", effect: "ask" },
    ],
  };
  const doc = validateAgentDoc(input);
  assert.equal(doc.description, "Test agent");
  assert.equal(doc.mode, "subagent");
  assert.equal(doc.color, "#ff0000");
  assert.equal(doc.permissions.length, 2);
  assert.deepEqual(doc.permissions[0], {
    action: "read",
    resource: "*",
    effect: "allow",
  });
  assert.deepEqual(doc.permissions[1], {
    action: "edit",
    resource: "*.ts",
    effect: "ask",
  });
});

test("validateAgentDoc: invalid effect throws", () => {
  const input = {
    description: "Test agent",
    mode: "subagent",
    permissions: [{ action: "read", resource: "*", effect: "invalid" }],
  };
  assert.throws(
    () => validateAgentDoc(input),
    /effect must be allow\|deny\|ask/,
  );
});

test("validateAgentDoc: missing description throws", () => {
  const input = {
    mode: "subagent",
    permissions: [{ action: "read", resource: "*", effect: "allow" }],
  };
  assert.throws(
    () => validateAgentDoc(input),
    /frontmatter missing string 'description'/,
  );
});

test("validateAgentDoc: invalid mode throws", () => {
  const input = {
    description: "Test",
    mode: "invalid",
    permissions: [],
  };
  assert.throws(
    () => validateAgentDoc(input),
    /'mode' must be primary\|subagent/,
  );
});

test("validateAgentDoc: non-object throws", () => {
  assert.throws(() => validateAgentDoc("string"), /must be an object/);
  assert.throws(() => validateAgentDoc(null), /must be an object/);
});

test("validateCommandDoc: valid doc round-trips", () => {
  const input = { description: "Test command" };
  const doc = validateCommandDoc(input);
  assert.equal(doc.description, "Test command");
});

test("validateCommandDoc: missing description throws", () => {
  assert.throws(
    () => validateCommandDoc({}),
    /frontmatter missing string 'description'/,
  );
});

test("validateSkillDoc: valid doc round-trips", () => {
  const input = { name: "test-skill", description: "Test skill" };
  const doc = validateSkillDoc(input);
  assert.equal(doc.name, "test-skill");
  assert.equal(doc.description, "Test skill");
});

test("validateSkillDoc: missing name throws", () => {
  assert.throws(
    () => validateSkillDoc({ description: "Test" }),
    /frontmatter missing string 'name'/,
  );
});
