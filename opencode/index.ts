// OpenCode v2 plugin entry: registers 10 agents (1 primary + 9 subagents)
// from bundled markdown and two skills: workflow-driver + workflow-subagent.

import { readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { Agent, Plugin, Skill } from "@opencode/plugin";
import {
  parseMarkdown,
  validateAgentDoc,
  validateSkillDoc,
} from "./markdown.ts";
import { composePermissions } from "./permissions.ts";

const root = path.join(import.meta.dirname, "..");
const agentsDir = path.join(root, "agents");
const skillsRoot = path.join(root, "skills");
const SKILL_IDS = ["workflow-driver", "workflow-subagent"] as const;

// Captured set of every subagent visible in the editor after our agents are
// registered: our 9 + `general` + `explore` + any user-defined subagent.
// Refreshed on every replay/reload; read by the contract-injection hook below.
let subagentIDs: ReadonlySet<string> = new Set();

// Read-only view of the captured subagent set, exposed for tests. Not part of
// the plugin's public surface.
export function getSubagentIDs(): ReadonlySet<string> {
  return subagentIDs;
}

function readText(file: string): string {
  return readFileSync(file, "utf8");
}

interface AgentAsset {
  readonly id: string;
  readonly path: string;
  readonly doc: ReturnType<typeof validateAgentDoc>;
  readonly body: string;
}

function loadAgentAssets(): AgentAsset[] {
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const id = file.replace(/\.md$/, "");
    const fullPath = path.join(agentsDir, file);
    const raw = readText(fullPath);
    const { frontmatter, body } = parseMarkdown<unknown>(raw);
    const doc = validateAgentDoc(frontmatter);
    return { id, path: fullPath, doc, body };
  });
}

export default Plugin.define({
  id: "opencode-workflow",
  async setup(ctx) {
    // ── Agents ──────────────────────────────────────────────────────────
    const agentAssets = loadAgentAssets();

    await ctx.agent.transform((editor) => {
      for (const asset of agentAssets) {
        editor.update(asset.id, (agent) => {
          // Agent.Name.make casts the string to the branded type.
          agent.name = Agent.Name.make(asset.id);
          agent.description = asset.doc.description;
          agent.mode = asset.doc.mode;
          if (asset.doc.color !== undefined) {
            agent.color = asset.doc.color;
          }
          agent.system = asset.body.trim();
          agent.permissions = composePermissions(
            agent.permissions,
            asset.doc.permissions,
          );
        });
      }

      // Capture every subagent in the editor (ours + builtins + user-defined)
      // by mode, so the contract hook follows the live registry rather than a
      // hardcoded list. Each replay refreshes the set.
      subagentIDs = new Set(
        editor
          .list()
          .filter((agent) => agent.mode === "subagent")
          .map((agent) => String(agent.id)),
      );
    });

    // ── Skills ──────────────────────────────────────────────────────────
    // Captured workflow-subagent body, pushed verbatim into every subagent's
    // system prompt by the contract-injection hook below.
    let subagentContract = "";
    await ctx.skill.transform((editor) => {
      for (const id of SKILL_IDS) {
        const skillPath = path.join(skillsRoot, id, "SKILL.md");
        const skillRaw = readText(skillPath);
        const { frontmatter: skillFm, body: skillBody } =
          parseMarkdown<unknown>(skillRaw);
        const skillDoc = validateSkillDoc(skillFm);
        if (id === "workflow-subagent") {
          subagentContract = skillBody;
        }
        editor.add(
          Skill.Info.make({
            id: Skill.ID.make(id),
            name: Skill.Name.make(skillDoc.name),
            description: skillDoc.description,
            path: skillPath as Skill.Info["path"],
            content: skillBody,
          }),
        );
      }
    });

    await ctx.skill.reload();

    // ── Contract body injection ────────────────────────────────────────
    // Inject the workflow-subagent contract body into every subagent's system
    // prompt (drive is primary and carries workflow-driver instead); the body
    // is the skill's own text, so agents need no per-file copy.
    ctx.session.hook("context", (event) => {
      if (subagentIDs.has(event.agent)) {
        event.system.push({
          type: "text",
          text: subagentContract,
        });
      }
    });
  },
});
