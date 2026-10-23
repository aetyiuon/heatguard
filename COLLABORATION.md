# Working together with Codex and Claude

Use [AGENTS.md](AGENTS.md) as the shared project guidance. Codex discovers that file; [CLAUDE.md](CLAUDE.md) imports it for Claude Code. In a plain chat without repository access, attach the relevant files and explicitly ask the assistant to read the shared instructions. Instructions provide context; they do not synchronize two chats or prevent Git conflicts automatically.

## A small-team workflow

1. Each person clones the private repository into their own folder after receiving repository access. Never share an account token or commit local environment files.
2. Start a task from an up-to-date, clean `main` and create a descriptive branch such as `codex/map-search` or `claude/profile-layout`. These names are examples, not fixed branches. Use a separate clone/worktree for another agent running at the same time.
3. Give each task a concrete outcome, acceptance checks, and an expected set of files. If tasks both touch `App.tsx`, `src/state/useHeatGuard.ts`, shared types/theme, package files, or a generated dataset, coordinate ownership first or work sequentially. Put the agreement in the task/PR, where the other person can see it.
4. Keep commits focused. Open a pull request with the handoff below. The other person or their agent reviews the diff and checks; after merging, everyone updates from `main` before starting the next task.
5. Before combining branches, fetch the latest changes and inspect differences. Integrate on your task branch, resolve conflicts by preserving both intended behaviors, and rerun affected checks. Do not force-push `main`, replace entire shared files to fix a small conflict, or reset away someone else's work.

For a clean clone, the task-start commands look like this:

```sh
git status --short --branch
git switch main
git pull --ff-only
git switch -c claude/profile-layout
```

Use your own task branch name. If the checkout has uncommitted work, preserve it before switching or pulling. If it is a ZIP download without Git history, clone the repository for shared development instead of running these commands in a parent repository.

## A prompt either person can reuse

```text
Read AGENTS.md and COLLABORATION.md, then inspect the current branch and diff.
Task: [one concrete outcome]
Acceptance checks: [what should work]
Expected files/area: [scope]
Concurrent work to preserve: [other branch/PR and overlapping files, or unknown]
Previous handoff/PR: [link or pasted handoff, if any]
Implement the task, run appropriate checks, and provide the handoff template.
Do not assume access to another assistant's chat history.
```

## Handoff template

Paste this into the PR description or the next assistant's chat. Replace placeholders with actual results; do not put secrets or private user data in it.

```text
Task / authoring tool:
Branch / base commit / final commit (or say uncommitted):
PR link (if opened):
Outcome and key decisions:
Changed files and why:
Checks actually run, with results:
Manual preview/device checks, including platform:
Not tested / known limitations:
Conflicts or concurrent work to preserve:
Next step:
```

Keep enduring decisions in the relevant project documentation and the shared rules in `AGENTS.md`. Use PRs/handoffs for task status rather than one global log that every agent must edit. The implementation and committed changes are the source of truth when an old conversation disagrees with the current code.

## Review before merging

- Does the change meet the requested behavior without unrelated rewrites?
- Do affected web/iOS/Android behavior, English/Spanish copy, accessibility, and raised-button conventions still work?
- Are heat guidance, missing-data handling, privacy, and map provenance/coverage preserved?
- Do reported checks match what ran? An Expo export alone does not prove physical iPhone behavior.
- Are the lockfile, API types, generated data, and relevant docs consistent with the change?

See [README.md](README.md) for setup, [VERIFICATION.md](VERIFICATION.md) for past checks and gaps, and [IPHONE-TESTING.md](IPHONE-TESTING.md) for saved phone-testing steps.

Instruction-file references: [OpenAI: AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Claude Code: project memory and imports](https://code.claude.com/docs/en/memory).
