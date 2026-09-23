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

test("plugin: setup registers 11 agents with correct modes", async () => {
  const { ctx, agentEditor } = createFakeContext();
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
  const { ctx, agentEditor } = createFakeContext();
  await plugin.setup(ctx as any);

  for (const id of PRIMARIES) {
    const agent = agentEditor.get(id);
    assert.ok(agent.color, `${id} should have color`);
  }
});

test("plugin: plan and build are removed", async () => {
  const { ctx, agentEditor } = createFakeContext(["plan", "build"]);
  await plugin.setup(ctx as any);

  assert.equal(agentEditor.get("plan"), undefined);
  assert.equal(agentEditor.get("build"), undefined);
});

test("plugin: remove() of missing id does not throw", async () => {
  const { ctx } = createFakeContext([]); // No plan/build pre-seeded
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

test("plugin: workflow skill registered", async () => {
  const { ctx, skillEditor, getReloadCalled } = createFakeContext();
  await plugin.setup(ctx as any);

  const skills = skillEditor.list();
  assert.equal(skills.length, 1);

  const skill = skills[0];
  assert.equal(skill.id, "workflow");
  assert.equal(skill.name, "workflow");
  assert.ok(skill.description.length > 0);
  assert.ok(skill.content.length > 0);
  assert.ok(skill.path.endsWith("skills/workflow/SKILL.md"));
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

test("plugin: make's composed rules resolve correctly", async () => {
  const { ctx, agentEditor } = createFakeContext();
  await plugin.setup(ctx as any);

  const make = agentEditor.get("make")!;
  const perms = make.permissions;

  // shell "ls x" should ask (matches {shell, *, ask})
  assert.equal(resolvePermission(perms, "shell", "ls x"), "ask");

  // shell "sudo rm x" should deny (matches {shell, "sudo *", deny})
  assert.equal(resolvePermission(perms, "shell", "sudo rm x"), "deny");

  // skill "workflow" should allow
  assert.equal(resolvePermission(perms, "skill", "workflow"), "allow");

  // skill "other" should deny (make has {skill, *, deny})
  assert.equal(resolvePermission(perms, "skill", "other"), "deny");
});
