<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working policy

When asked to change, add, or fix code:

1. Inspect the relevant code and understand the existing behavior first.
2. Implement the requested change completely without asking for confirmation
   for normal, reversible work inside this repository.
3. After every code change, run the relevant validation automatically.
4. Fix failures caused by the change and rerun validation until it passes.
5. Review the final diff for regressions, security issues, accidental changes,
   and missing edge cases.
6. Report:
   - files changed
   - behavior changed
   - validation commands run
   - test/build results
   - any remaining risks or unverified behavior

For this project, the default validation is:

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run build` when the change can affect compilation, routing,
  server/client boundaries, Prisma integration, or production behavior.
- For UI changes, verify the affected flow in a browser when the development
  server and database are available.
- For bug fixes, add or update a regression test when a suitable test setup
  exists. If no automated test setup exists, perform a focused manual check
  and explain what was verified.

Do not claim that a change works unless the relevant validation was actually
run. If a command cannot be run, explain why.

Ask before proceeding only when:

- requirements are materially ambiguous and different interpretations would
  produce meaningfully different behavior
- the change may delete or overwrite user data
- a database migration could cause data loss
- credentials, secrets, production access, or external services are required
- the action writes outside this repository
- the action publishes, deploys, purchases, sends messages, or changes an
  external system
- the requested change conflicts with existing behavior or requirements
- completing the task requires a material expansion of scope

Do not ask for routine actions such as reading project files, editing files
inside this repository, running lint, TypeScript checks, builds, or existing
non-destructive tests.

When uncertainty is minor and does not materially change behavior, make the
most reasonable assumption, state it briefly, and continue.
