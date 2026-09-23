import { test } from "node:test";
import assert from "node:assert/strict";
import plugin from "../opencode/index.ts";
import { DEFAULT_PERMISSION_RULES } from "../opencode/permissions.ts";
import type { PermissionRule } from "../opencode/markdown.ts";

// Mini glob matcher for permission resolution tests
function globMatch(pattern: string, value: string): boolean {
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  return regex.test(value);
}

// Resolve permission using findLast semantics
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

// Expected agent IDs
const EXPECTED_AGENTS = [
  "drive",
  "coder",
  "tester",
  "researcher",
  "planner",
  "plan-reviewer",
  "code-reviewer",
  "interviewer",
  "writer",
  "debugger",
];

const PRIMARIES = new Set(["drive"]);

// Fake agent editor backed by Map
class FakeAgentEditor {
  private agents = new Map<string, any>();

  constructor(initialAgents: string[] = []) {
    for (const id of initialAgents) {
      this.agents.set(id, this.createDefault(id));
    }
  }

  private createDefault(id: string): any {
    return {
      id,
      name: id,
      description: "",
      mode: "primary",
      hidden: false,
      permissions: DEFAULT_PERMISSION_RULES.map((r) => ({ ...r })),
      system: "",
    };
  }

  get(id: string): any | undefined {
    return this.agents.get(id);
  }

  remove(id: string): void {
    this.agents.delete(id);
  }

  update(id: string, fn: (agent: any) => void): void {
    if (!this.agents.has(id)) {
      this.agents.set(id, this.createDefault(id));
    }
    const agent = this.agents.get(id)!;
    fn(agent);
  }

  list(): any[] {
    return Array.from(this.agents.values());
  }

  // Snapshot for comparison
  snapshot(): Map<string, any> {
    return new Map(
      Array.from(this.agents.entries()).map(([id, agent]) => [
        id,
        JSON.parse(JSON.stringify(agent)),
      ]),
    );
  }
}

// Fake skill editor
class FakeSkillEditor {
  private skills: any[] = [];

  add(skill: any): void {
    this.skills.push(skill);
  }

  list(): any[] {
    return this.skills;
  }
}

// Fake context
function createFakeContext(preseedAgents: string[] = ["plan", "build"]) {
  const agentEditor = new FakeAgentEditor(preseedAgents);
  const skillEditor = new FakeSkillEditor();
  let reloadCalled = false;

  const ctx = {
    agent: {
      transform: async (cb: (editor: FakeAgentEditor) => void) => {
        cb(agentEditor);
        return { dispose: async () => {} };
      },
    },
    skill: {
      transform: async (cb: (editor: FakeSkillEditor) => void) => {
        cb(skillEditor);
        return { dispose: async () => {} };
      },
      reload: async () => {
        reloadCalled = true;
      },
    },
  };

  return { ctx, agentEditor, skillEditor, getReloadCalled: () => reloadCalled };
}

test("plugin: registers 10 agents with correct modes", async () => {
  // Use empty pre-seed so total count equals exactly the 10 plugin agents.
  const { ctx, agentEditor } = createFakeContext([]);
  await plugin.setup(ctx as any);

  const agents = agentEditor.list();
  assert.equal(agents.length, EXPECTED_AGENTS.length);

  for (const id of EXPECTED_AGENTS) {
    const agent = agentEditor.get(id);
    assert.ok(agent, `agent ${id} should exist`);
    assert.ok(agent.description.length > 0, `${id} should have description`);
    assert.ok(agent.system.length > 0, `${id} should have system prompt`);

    const expectedMode = PRIMARIES.has(id) ? "primary" : "subagent";
    assert.equal(agent.mode, expectedMode, `${id} mode mismatch`);
  }
});

test("plugin: primaries have colors", async () => {
  const { ctx, agentEditor } = createFakeContext([]);
  await plugin.setup(ctx as any);

  for (const id of PRIMARIES) {
    const agent = agentEditor.get(id);
    assert.ok(agent.color, `${id} should have color`);
  }
});

test("plugin: builtins untouched: plan/build remain after setup", async () => {
  const { ctx, agentEditor } = createFakeContext(["plan", "build"]);
  await plugin.setup(ctx as any);

  assert.ok(agentEditor.get("plan"), "plan builtin should remain");
  assert.ok(agentEditor.get("build"), "build builtin should remain");
});

test("plugin: setup does not reject with empty pre-seed", async () => {
  const { ctx } = createFakeContext([]);
  await assert.doesNotReject(async () => {
    await plugin.setup(ctx as any);
  });
});

test("plugin: permissions include defaults + agent rules + user overrides", async () => {
  const { ctx, agentEditor } = createFakeContext(["coder"]);

  // Pre-seed coder with an extra user rule
  const coderBefore = agentEditor.get("coder")!;
  coderBefore.permissions.push({
    action: "skill",
    resource: "grilling",
    effect: "deny",
  });

  await plugin.setup(ctx as any);

  const coder = agentEditor.get("coder")!;
  const perms = coder.permissions;

  // First 5 should be defaults
  for (let i = 0; i < DEFAULT_PERMISSION_RULES.length; i++) {
    assert.deepStrictEqual(perms[i], DEFAULT_PERMISSION_RULES[i]);
  }

  // Last should be the user override
  const lastRule = perms[perms.length - 1];
  assert.deepStrictEqual(lastRule, {
    action: "skill",
    resource: "grilling",
    effect: "deny",
  });
});

test("plugin: two workflow skills registered", async () => {
  const { ctx, skillEditor, getReloadCalled } = createFakeContext([]);
  await plugin.setup(ctx as any);

  const skills = skillEditor.list();
  assert.equal(skills.length, 2);

  const expectedIds = ["workflow-driver", "workflow-subagent"];
  for (const id of expectedIds) {
    const skill = skills.find((s: any) => s.id === id);
    assert.ok(skill, `skill ${id} should be registered`);
    assert.equal(skill.name, id, `${id}: name must match id (frontmatter)`);
    assert.ok(skill.description.length > 0, `${id} should have description`);
    assert.ok(skill.content.length > 0, `${id} should have content`);
    assert.ok(
      skill.path.endsWith(`skills/${id}/SKILL.md`),
      `${id}: path must end with skills/${id}/SKILL.md`,
    );
  }
  assert.ok(getReloadCalled());
});

test("plugin: idempotent across multiple runs", async () => {
  const { ctx: ctx1, agentEditor: editor1 } = createFakeContext();
  await plugin.setup(ctx1 as any);
  const snapshot1 = editor1.snapshot();

  const { ctx: ctx2, agentEditor: editor2 } = createFakeContext();
  await plugin.setup(ctx2 as any);
  await plugin.setup(ctx2 as any); // Run twice
  const snapshot2 = editor2.snapshot();

  // Compare snapshots
  assert.equal(snapshot1.size, snapshot2.size);
  for (const [id, agent1] of snapshot1) {
    const agent2 = snapshot2.get(id);
    assert.ok(agent2, `agent ${id} missing in second run`);
    assert.deepStrictEqual(agent1, agent2);
  }
});

test("plugin: drive's composed rules resolve correctly", async () => {
  const { ctx, agentEditor } = createFakeContext([]);
  await plugin.setup(ctx as any);

  const drive = agentEditor.get("drive")!;
  const perms = drive.permissions;

  // shell "ls x" should ask (matches {shell, *, ask})
  assert.equal(resolvePermission(perms, "shell", "ls x"), "ask");

  // shell "sudo rm x" should deny (matches {shell, "sudo *", deny})
  assert.equal(resolvePermission(perms, "shell", "sudo rm x"), "deny");

  // drive carries {skill, *, deny} then {skill, workflow-driver, allow}:
  // workflow-driver resolves to allow (the later, specific rule wins via findLast)
  assert.equal(resolvePermission(perms, "skill", "workflow-driver"), "allow");

  // any other skill resolves to deny (the deny-all rule matches; no later allow overrides it)
  assert.equal(resolvePermission(perms, "skill", "some-other-skill"), "deny");
});
