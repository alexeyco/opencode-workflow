# Contributing

## Branching

- Never push to `master`.
- Branch from `master`: `git checkout -b feat/<topic>`.
- Commit messages: no conventional prefixes (`feat:`, `fix:`, …), past tense —
  e.g. `Added workflow skill`, `Fixed permission composition order`.

## Development

Install dependencies and run the checks — same as CI. Tests require Node ≥ 22.18
(default type stripping). `make check` runs `scripts/check.mjs`, typechecks the
plugin, and runs the test suite:

```sh
npm ci
make fmt
make check
```

Test locally without publishing (local installs are not copied, edits are live):

```sh
# sandbox opencode.jsonc
{ "plugins": ["/absolute/path/to/opencode-workflow"] }
```

Point opencode at the absolute path; edits take effect on the next session
or `/reload` — no copying, no reinstall.

## Publishing

1. Add a `CHANGELOG.md` entry for the new version.
2. Bump `version` in `package.json` (semver) and refresh the committed
   `package-lock.json` with `npm install`.
3. Merge the PR to `master`.
4. Tag and push the tag:

   ```sh
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

5. The `publish` workflow runs `npm publish` with provenance on tag push.

> **Note:** GitHub remote and `NPM_TOKEN` are not configured yet — publishing
> is deferred until the repo is wired up.
