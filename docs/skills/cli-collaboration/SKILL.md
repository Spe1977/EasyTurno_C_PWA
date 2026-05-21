---
name: cli-collaboration
description: Use when multiple CLI agents or assistants alternate on the same repository, especially with a dirty worktree, shared plans, handoffs, or limited context budgets.
---

# CLI Collaboration

Use a written handoff as the source of truth when Codex, Claude Code, Gemini CLI, or other CLI agents alternate on one repo.

## Core Rule

Never infer ownership from `git status` alone. A dirty worktree may contain user work or another agent's work. Read the handoff first, declare your intended files, and leave a precise handoff before stopping.

## Start Of Shift

1. Read the repo handoff file. Prefer `AGENT_HANDOFF.md`; otherwise use `docs/agent-handoff.md`.
2. Read the active plan/spec named by the handoff.
3. Run `git status --short --branch`.
4. Identify the current task and likely file ownership.
5. Before editing, state:

```text
Handoff read:
Current task:
Files I will touch:
Expected red test:
Stop conditions:
```

## During Work

- Use TDD for implementation tasks when tests are possible.
- Keep edits scoped to the declared files.
- If an undeclared file becomes necessary, announce why before editing.
- Do not reset, revert, clean, or delete unrelated changes.
- If another agent appears to own the same files, stop and ask the user.
- If context/time is low, prefer a clean handoff over starting a risky refactor.

## End Of Shift

Update the repo handoff file, or report a block the next agent can paste:

```text
Agent:
Date/time:
Task:
Status:
Files changed:
Tests red:
Tests green:
Open concerns:
Next agent starts from:
Do not touch:
```

## Agent Notes

- Codex: use this skill with local repo instructions and any project plan skill.
- Claude Code: mirror this workflow in `CLAUDE.md` or a Claude skill, and still read the repo handoff.
- Gemini CLI: use `GEMINI.md` or the repo handoff as the trigger if skill loading is unavailable.

## Common Failures

- Starting from stale chat memory instead of the handoff.
- Treating a dirty worktree as disposable.
- Continuing after red tests without recording the exact failure.
- Ending with "all good" instead of naming the next task and file ownership.
