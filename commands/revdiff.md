---
description: Review the current change via revdiff; on a clean branch review all files
---

Review task for the current repo. Work from the repo root.

## Pick the mode

Check the state of the branch: `git status --porcelain`, `git diff`, and the
diff against the base branch (`git diff origin/main...HEAD` or the repo's
default base). If there are no changes at all — the branch is clean — skip
the overlay and go straight to "Clean branch: review all files".

## Branch with changes: revdiff overlay

Your first and only launch action — run the launcher bare (never wrapped in
`gtimeout`, `timeout`, or kill timers; it blocks until the user finishes
reviewing, that wait is unbounded by design, killing it loses the user's
annotations). The command itself stays bare, but the bash tool call MUST
carry an explicit maximal `timeout` in milliseconds (use `timeout:
3600000`): the tool's default is 120 s, and without this parameter it kills
the launcher mid-review with the overlay still open:

    {{REVDIFF_LAUNCHER}}

Choose flags per situation: `--staged` for staged changes, a ref argument
for a branch or commit range, `--untracked` to include new files. The
command opens revdiff in a terminal overlay; remarks arrive on stdout as
annotation text.

Exit codes: 0 = no remarks (report "clean" and stop), 10 = remarks captured
(continue to fixing), anything else = launcher failure — report it and stop.

For each remark: quote it verbatim, locate the affected file:line from the
annotation, fix it. Verify with tests/lint where available. Ask the user
when a remark is ambiguous. Run revdiff exactly once per invocation — never
relaunch it after fixing; report the results and stop.

## Clean branch: review all files

There is no diff to annotate, so review the whole tree directly:

1. Enumerate files: `git ls-files` — skip generated state and vendored
   runtime dirs.
2. Run `gitleaks dir --no-banner --redact -v .` first; treat every finding as a
   security remark and never echo the secret itself.
3. Read the source files in logical groups and report bugs, security
   issues, dead code, and convention violations.
4. Fix the findings, then finish with a summary grouped by file.
