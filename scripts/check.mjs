import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const YAML = require("yaml");

const failures = [];

function fail(msg) {
  failures.push(msg);
}

function readText(path) {
  return readFileSync(path, "utf-8");
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return YAML.parse(match[1]);
}

// ── 1. package.json ──────────────────────────────────────────────────────────

{
  const pkgPath = join(ROOT, "package.json");
  let pkg;
  try {
    pkg = JSON.parse(readText(pkgPath));
  } catch {
    fail("package.json: missing or invalid JSON");
    pkg = null;
  }

  if (pkg) {
    const required = [
      "name",
      "version",
      "type",
      "exports",
      "files",
      "keywords",
      "scripts",
      "dependencies",
    ];
    for (const key of required) {
      if (pkg[key] === undefined) fail(`package.json: missing "${key}"`);
    }
    if (pkg.main !== undefined) fail('package.json: must not have "main"');
    if (pkg.dependencies?.["@opencode/plugin"] === undefined)
      fail("package.json: dependencies must include @opencode/plugin");
    if (pkg.dependencies?.yaml === undefined)
      fail("package.json: dependencies must include yaml");

    // Assert package.json `files` contains required entries
    const requiredFiles = [
      "index.ts",
      "opencode",
      "agents",
      "skills",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
    ];
    if (Array.isArray(pkg.files)) {
      for (const f of requiredFiles) {
        if (!pkg.files.includes(f)) {
          fail(`package.json: "files" must include "${f}"`);
        }
      }
    }
    // Assert exports["."] === "./opencode/index.ts"
    if (pkg.exports?.["."] !== "./opencode/index.ts") {
      fail('package.json: exports["."] must be "./opencode/index.ts"');
    }
  }
}

// ── 2. repo scan: zero @opencode-ai ──────────────────────────────────────────

{
  const FORBIDDEN = "@opencode-ai";
  const EXTS = new Set([".ts", ".mjs", ".json", ".md"]);
  const SKIP_DIRS = new Set(["node_modules", ".git", "scripts"]);

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && EXTS.has(extname(entry.name))) {
        const content = readText(full);
        if (content.includes(FORBIDDEN)) {
          fail(
            `${relative(ROOT, full)}: contains forbidden string "${FORBIDDEN}"`,
          );
        }
      }
    }
  }

  walk(ROOT);
}

// ── 3. agents/ ───────────────────────────────────────────────────────────────

{
  const REQUIRED_IDS = [
    "make",
    "ask",
    "YOLO",
    "coder",
    "tester",
    "researcher",
    "planner",
    "plan-reviewer",
    "code-reviewer",
    "interviewer",
    "writer",
  ];
  const PRIMARIES = new Set(["make", "ask", "YOLO"]);
  const VALID_MODES = new Set(["primary", "subagent"]);
  const VALID_ACTIONS = new Set([
    "read",
    "edit",
    "shell",
    "subagent",
    "skill",
    "glob",
    "grep",
    "question",
    "webfetch",
    "websearch",
    "external_directory",
  ]);
  const VALID_EFFECTS = new Set(["allow", "ask", "deny"]);

  const agentsDir = join(ROOT, "agents");
  if (!existsSync(agentsDir)) {
    fail("agents/: directory missing");
  } else {
    const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
    const ids = files.map((f) => f.replace(/\.md$/, ""));

    for (const id of REQUIRED_IDS) {
      if (!ids.includes(id)) fail(`agents/: missing ${id}.md`);
    }
    for (const id of ids) {
      if (!REQUIRED_IDS.includes(id)) fail(`agents/: unexpected ${id}.md`);
    }

    for (const id of ids) {
      const path = join(agentsDir, `${id}.md`);
      const text = readText(path);
      const fm = parseFrontmatter(text);

      if (!fm) {
        fail(`agents/${id}.md: missing or invalid YAML frontmatter`);
        continue;
      }

      for (const key of ["description", "mode", "permissions"]) {
        if (fm[key] === undefined)
          fail(`agents/${id}.md: frontmatter missing "${key}"`);
      }
      if (fm.model !== undefined)
        fail(`agents/${id}.md: forbidden key "model"`);
      if (!VALID_MODES.has(fm.mode))
        fail(
          `agents/${id}.md: mode must be primary|subagent, got "${fm.mode}"`,
        );
      // Assert primaries ⇔ mode==="primary"
      if (PRIMARIES.has(id) && fm.mode !== "primary")
        fail(
          `agents/${id}.md: primary agent must have mode "primary", got "${fm.mode}"`,
        );
      if (!PRIMARIES.has(id) && fm.mode !== "subagent")
        fail(
          `agents/${id}.md: subagent must have mode "subagent", got "${fm.mode}"`,
        );
      if (PRIMARIES.has(id) && fm.color === undefined)
        fail(`agents/${id}.md: primary agent must have "color"`);

      if (Array.isArray(fm.permissions)) {
        for (const perm of fm.permissions) {
          if (!VALID_ACTIONS.has(perm.action))
            fail(`agents/${id}.md: invalid action "${perm.action}"`);
          if (typeof perm.resource !== "string")
            fail(
              `agents/${id}.md: permission rule resource must be a string, got ${typeof perm.resource}`,
            );
          if (!VALID_EFFECTS.has(perm.effect))
            fail(`agents/${id}.md: invalid effect "${perm.effect}"`);
        }

        const skillRules = fm.permissions.filter((p) => p.action === "skill");

        if (id === "make") {
          const hasDenyAll = skillRules.some(
            (p) => p.resource === "*" && p.effect === "deny",
          );
          const hasAllowWorkflow = skillRules.some(
            (p) => p.resource === "workflow" && p.effect === "allow",
          );
          if (!hasDenyAll) fail(`agents/make.md: must have {skill, *, deny}`);
          if (!hasAllowWorkflow)
            fail(`agents/make.md: must have {skill, workflow, allow}`);
          if (skillRules.length !== 2)
            fail(
              `agents/make.md: must have exactly 2 skill rules, got ${skillRules.length}`,
            );
        } else {
          const allowStar = skillRules.filter(
            (p) => p.resource === "*" && p.effect === "allow",
          );
          if (allowStar.length !== 1)
            fail(
              `agents/${id}.md: must have exactly one {skill, *, allow}, got ${allowStar.length}`,
            );
          if (skillRules.length !== 1)
            fail(
              `agents/${id}.md: must have exactly 1 skill rule, got ${skillRules.length}`,
            );
        }
      }
    }
  }
}

// ── 4. skills/workflow/SKILL.md ──────────────────────────────────────────────

{
  const path = join(ROOT, "skills", "workflow", "SKILL.md");
  if (!existsSync(path)) {
    fail("skills/workflow/SKILL.md: file missing");
  } else {
    const text = readText(path);
    const fm = parseFrontmatter(text);
    if (!fm) {
      fail("skills/workflow/SKILL.md: missing or invalid YAML frontmatter");
    } else {
      if (fm.name !== "workflow")
        fail(
          `skills/workflow/SKILL.md: frontmatter name must be "workflow", got "${fm.name}"`,
        );
      if (fm.description === undefined)
        fail('skills/workflow/SKILL.md: frontmatter missing "description"');
    }
  }
}

// ── 5. opencode/index.ts ─────────────────────────────────────────────────────

{
  const path = join(ROOT, "opencode", "index.ts");
  if (!existsSync(path)) {
    fail("opencode/index.ts: file missing");
  } else {
    const text = readText(path);
    if (!text.includes("Plugin.define"))
      fail("opencode/index.ts: must contain Plugin.define");
  }
}

// ── 6. root index.ts (local directory install shim) ──────────────────────────

{
  const path = join(ROOT, "index.ts");
  if (!existsSync(path)) {
    fail("index.ts: file missing (required for local directory installs)");
  } else {
    const text = readText(path);
    if (!text.includes("./opencode/index.ts"))
      fail("index.ts: must re-export ./opencode/index.ts");
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`check.mjs: ${failures.length} failure(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("check.mjs: all checks passed");
