# Contributing

This is currently a solo project, so outside code contributions are not being
accepted yet. Feedback, bug reports, and ideas are welcome through GitHub
issues.

The workflow is:

1. Branch from `main` (one short-lived branch per change).
2. Keep changes small and focused.
3. Run the project checks locally before pushing (format, lint, tests, build).
   See the Setup section below for the exact commands once they are defined.
4. Open a pull request into `main`. CI must pass before merge. PRs opened by
   the repository owner have squash auto-merge armed automatically and delete
   their branch once merged.

## Setup

You need Node 22 or newer.

```bash
npm ci                          # install
npx playwright install chromium # once, for the browser tests
npm run dev                     # dev server, open the printed URL
npm run typecheck && npm test && npm run build && npm run test:e2e
```

The last line is what CI runs. Docs are linted with
`npx markdownlint-cli '**/*.md' --ignore node_modules --ignore LICENSE`.
The Python data tools and the tablet APK have their own steps in
`CLAUDE.md` and `prototypes/tablet-test/README.md`.

## Conventions

- Conventional Commits (for example `feat: ...`, `fix: ...`, `chore: ...`,
  `docs: ...`).
- No em dashes in code, comments, docs, commit messages, or user-facing text.
- See `CLAUDE.md` for the full working rules and `docs/` for design notes and
  decision records.
