# Agent Instructions

This repository uses a CLI-agent handoff workflow.

Before making changes, every agent must read:

1. `AGENT_HANDOFF.md`
2. `README.md` (or `README_IT.md`) for current architecture and commands
3. Any active plan/notes present locally (historical docs like `firebase.md` and `docs/superpowers/plans/*` are local-only and excluded from GitHub)

Follow the start-of-shift and end-of-shift checklists in `AGENT_HANDOFF.md`.

Key rules:

- The worktree may be dirty because Codex, Claude Code, Gemini CLI, and the user alternate work.
- Do not reset, revert, delete, or clean files you did not modify.
- Use TDD for implementation work.
- Keep edits scoped to the current task.
- Do not commit without explicit user permission.
