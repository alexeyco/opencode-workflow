// OpenCode v2 plugin entry: registers 11 agents from bundled markdown
// and the workflow skill.

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
const skillsDir = path.join(root, "skills", "workflow");

const BUILTINS_TO_REMOVE = ["plan", "build"] as const;

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
      for (const id of BUILTINS_TO_REMOVE) {
        if (editor.get(id)) {
          try {
            editor.remove(id);
          } catch {
            // Never let a failed remove break plugin setup.
          }
        }
      }
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
    });

    // ── Skill ───────────────────────────────────────────────────────────
    const skillPath = path.join(skillsDir, "SKILL.md");
    const skillRaw = readText(skillPath);
    const { frontmatter: skillFm, body: skillBody } =
      parseMarkdown<unknown>(skillRaw);
    const skillDoc = validateSkillDoc(skillFm);

    await ctx.skill.transform((editor) => {
      editor.add(
        Skill.Info.make({
          id: Skill.ID.make("workflow"),
          name: Skill.Name.make(skillDoc.name),
          description: skillDoc.description,
          path: skillPath as Skill.Info["path"],
          content: skillBody,
        }),
      );
    });

    await ctx.skill.reload();
  },
});
