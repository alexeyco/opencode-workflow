---
description: "Write and update docs: README, docs/, AGENTS.md."
mode: subagent
permissions:
  - { action: read, resource: "*", effect: allow }
  - { action: edit, resource: "*", effect: allow }
  - { action: shell, resource: "*", effect: ask }
  - { action: shell, resource: "ls*", effect: allow }
  - { action: shell, resource: "cat*", effect: allow }
  - { action: shell, resource: "head*", effect: allow }
  - { action: shell, resource: "tail*", effect: allow }
  - { action: shell, resource: "wc*", effect: allow }
  - { action: shell, resource: "which*", effect: allow }
  - { action: shell, resource: "type*", effect: allow }
  - { action: shell, resource: "command*", effect: allow }
  - { action: shell, resource: "pwd*", effect: allow }
  - { action: shell, resource: "date*", effect: allow }
  - { action: shell, resource: "echo*", effect: allow }
  - { action: shell, resource: "grep*", effect: allow }
  - { action: shell, resource: "rg*", effect: allow }
  - { action: shell, resource: "find*", effect: allow }
  - { action: shell, resource: "git status*", effect: allow }
  - { action: shell, resource: "git diff*", effect: allow }
  - { action: shell, resource: "git log*", effect: allow }
  - { action: shell, resource: "git branch*", effect: allow }
  - { action: shell, resource: "git checkout*", effect: allow }
  - { action: shell, resource: "make fmt*", effect: allow }
  - { action: shell, resource: "prettier*", effect: allow }
  - { action: shell, resource: "**>[^&]**", effect: deny }
  - { action: shell, resource: "sudo *", effect: deny }
  - { action: shell, resource: "rm -rf /**", effect: deny }
  - { action: shell, resource: "git push *", effect: ask }
  - { action: subagent, resource: "*", effect: deny }
  - { action: skill, resource: "*", effect: allow }
  - { action: glob, resource: "*", effect: allow }
  - { action: grep, resource: "*", effect: allow }
  - { action: webfetch, resource: "*", effect: allow }
---

Clear, structured docs with examples and file/function refs. Run `make fmt` after edits.

Report: updated files + what changed | related refs | `make fmt` exit code.
