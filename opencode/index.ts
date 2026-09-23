// OpenCode v2 plugin entry: registers 11 agents from bundled markdown,
// the /revdiff command, and the workflow skill.

import { readFileSync, readdirSync, accessSync, constants } from "node:fs";
import * as path from "node:path";
import { Agent, Plugin, Skill } from "@opencode/plugin";
import {
  parseMarkdown,
  validateAgentDoc,
  validateCommandDoc,
  validateSkillDoc,
} from "./markdown.ts";
import { composePermissions } from "./permissions.ts";
import { renderCommand } from "./render.ts";

const root = path.join(import.meta.dirname, "..");
const agentsDir = path.join(root, "agents");
const commandsDir = path.join(root, "commands");
const skillsDir = path.join(root, "skills", "workflow");
const toolsDir = path.join(root, "tools");

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

    // ── Command ─────────────────────────────────────────────────────────
    const commandPath = path.join(commandsDir, "revdiff.md");
    const commandRaw = readText(commandPath);
    const { frontmatter: cmdFm, body: cmdBody } =
      parseMarkdown<unknown>(commandRaw);
    const cmdDoc = validateCommandDoc(cmdFm);
    const launcherPath = path.join(toolsDir, "launch-revdiff.sh");

    // Fail-fast: verify launcher is executable and template has placeholder.
    try {
      accessSync(launcherPath, constants.X_OK);
    } catch {
      throw new Error(
        `opencode-workflow: launcher not executable: ${launcherPath}`,
      );
    }
    if (!cmdBody.includes("{{REVDIFF_LAUNCHER}}")) {
      throw new Error(
        "opencode-workflow: command template missing {{REVDIFF_LAUNCHER}}",
      );
    }

    await ctx.command.transform((editor) =>
      editor.add({
        name: "revdiff",
        description: cmdDoc.description,
        execute: async (input) => {
          const userText = input.prompt?.text ?? "";
          const text = renderCommand(cmdBody, launcherPath, userText);
          await ctx.session.prompt({
            ...input.prompt,
            sessionID: input.sessionID,
            delivery: input.delivery,
            text,
          });
        },
      }),
    );

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
