# Agent Instructions

This repository uses a CLI-agent handoff workflow.

Before making changes, every agent must read:

1. `AGENT_HANDOFF.md`
2. `firebase.md`
3. `docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md`

Follow the start-of-shift and end-of-shift checklists in `AGENT_HANDOFF.md`.

Key rules:

- The worktree may be dirty because Codex, Claude Code, Gemini CLI, and the user alternate work.
- Do not reset, revert, delete, or clean files you did not modify.
- Use TDD for implementation work.
- Keep edits scoped to the current task.
- Do not commit without explicit user permission.
