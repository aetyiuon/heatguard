# Working together with Codex and Claude

Use [AGENTS.md](../AGENTS.md) as the shared project guidance. Codex discovers that file; [CLAUDE.md](../CLAUDE.md) imports it for Claude Code. In a plain chat without repository access, attach the relevant files and explicitly ask the assistant to read the shared instructions. Instructions provide context; they do not synchronize two chats or prevent Git conflicts automatically.

## A small-team workflow

1. Each person clones the private repository into their own folder after receiving repository access. Never share an account token or commit local environment files.
2. Start a task from an up-to-date, clean `production` and create a descriptive branch such as `feature/map-search` or `design/profile-layout`. These names are examples, not fixed branches. Use a separate clone/worktree for another agent running at the same time.
3. Give each task a concrete outcome, acceptance checks, and an expected set of files. If tasks both touch `App.tsx`, `src/state/useHeatGuard.ts`, shared types/theme, package files, or a generated dataset, coordinate ownership first or work sequentially. Put the agreement in the task/PR, where the other person can see it.
4. Keep commits focused. Open a pull request targeting `production` with the handoff below. The other person or their agent reviews the diff and checks; after the owner reviews and integrates the PR, everyone updates from `production` before starting the next task.
5. Before combining branches, fetch the latest changes and inspect differences. Integrate on your task branch, resolve conflicts by preserving both intended behaviors, and rerun affected checks. Do not force-push `main`, replace entire shared files to fix a small conflict, or reset away someone else's work.

For a clean clone, the task-start commands look like this:

```sh
git status --short --branch
git switch production
git pull --ff-only
git switch -c design/profile-layout
```

Use your own task branch name. If the checkout has uncommitted work, preserve it before switching or pulling. If it is a ZIP download without Git history, clone the repository for shared development instead of running these commands in a parent repository.

## Production release ownership

The private repository uses Vercel Hobby hosting. GitHub collaborators do not need Vercel or Supabase credentials for app development. Their commits may be blocked from both preview and production deployment because Vercel checks commit authorship. The owner reviews and tests the actual changes, then publishes an owner-authored integration/release commit on `production`. Preserve all contributor attribution and history. Do not impersonate the owner, share tokens, force-push or change the repository to public. Verify the deployment check and stable URL after the owner release. Supabase schema/function changes are a separate deployment. See [deployment.md](deployment.md).

## A prompt either person can reuse

```text
Read AGENTS.md and docs/contributing.md, then inspect the current branch and diff.
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

See [README.md](../README.md) for setup, [verification.md](verification.md) for past checks and gaps, and [iphone-testing.md](iphone-testing.md) for saved phone-testing steps.

Instruction-file references: [OpenAI: AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Claude Code: project memory and imports](https://code.claude.com/docs/en/memory).

## Current continuation context

The production branch is `production`. Read the root README and AGENTS.md, this guide, [Verification](verification.md), and the feature guide relevant to your task. Do not start from the historical nearest-AC/UI branches. Preserve the lifecycle, erasure, contact/index, location-scope and profile-editor safeguards summarized in Verification. Durable implementation rules live in AGENTS.md; task-specific handoffs belong in PR descriptions.

## Existing local clones after the branch rename

The default and Vercel production branch is now `production`. A fresh clone checks it out automatically. In an existing clean clone, inspect your branch/status first and preserve uncommitted changes. If your local production branch still has its former name, run:

```sh
git fetch origin
git branch -m codex/deploy-live production
git branch --set-upstream-to=origin/production production
git remote set-head origin -a
```

The first rename command applies only when that old local branch exists. Do not run it over an existing local production branch. Renaming remote branches does not rewrite contributor commits or remove AI-assistance disclosures. Use feature/, fix/, design/ or maintenance/ names for future work. GitHub automatically closed the historical head-branch PRs #1 and #2 during renaming; their discussions/commits and the renamed branches remain available.
