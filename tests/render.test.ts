import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCommand } from "../opencode/render.ts";

test("renderCommand: placeholder replaced exactly once", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}} --staged";
  const result = renderCommand(template, "/path/to/launcher.sh", "");
  assert.equal(result, "Run: '/path/to/launcher.sh' --staged");
});

test("renderCommand: path always single-quoted (even without spaces)", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/simple/path.sh", "");
  assert.equal(result, "Run: '/simple/path.sh'");
});

test("renderCommand: path with spaces gets single-quoted", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/path with spaces/launcher.sh", "");
  assert.equal(result, "Run: '/path with spaces/launcher.sh'");
});

test("renderCommand: path with single quote gets POSIX-escaped", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/path/it's.sh", "");
  // POSIX escaping: 'path/it'\''s.sh'
  assert.equal(result, "Run: '/path/it'\\''s.sh'");
});

test("renderCommand: path with $& not interpreted as replacement pattern", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/path/$&/launcher.sh", "");
  // $& should NOT be replaced with the matched string
  assert.equal(result, "Run: '/path/$&/launcher.sh'");
});

test("renderCommand: path with $` not interpreted", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/path/$`/launcher.sh", "");
  assert.equal(result, "Run: '/path/$`/launcher.sh'");
});

test("renderCommand: substitution happens exactly once", () => {
  const template = "First: {{REVDIFF_LAUNCHER}}, Second: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/launcher.sh", "");
  assert.equal(result, "First: '/launcher.sh', Second: '/launcher.sh'");
});

test("renderCommand: user args appended when non-empty", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/launcher.sh", "  fix all  ");
  assert.equal(result, "Run: '/launcher.sh'\n\nArguments: fix all");
});

test("renderCommand: no args appended when empty", () => {
  const template = "Run: {{REVDIFF_LAUNCHER}}";
  const result = renderCommand(template, "/launcher.sh", "   ");
  assert.equal(result, "Run: '/launcher.sh'");
});

test("renderCommand: throws on missing placeholder", () => {
  const template = "Run: something else";
  assert.throws(
    () => renderCommand(template, "/launcher.sh", ""),
    /missing placeholder/,
  );
});
