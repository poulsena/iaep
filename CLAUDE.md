# CLAUDE.md

## UI rules

All UI elements must be reusable Svelte components. No inline or one-off markup in app surfaces.

Before creating any new component:
1. Propose it by name with its variants and states.
2. Get explicit user approval.
3. Build a `.stories.svelte` alongside it and iterate in Storybook (`bun run storybook`, http://localhost:6006) until the user signs off.
4. Only then use it in an app surface.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub Issues (`poulsena/iaep`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: CONTEXT-MAP.md at root indexes per-module CONTEXT.md files. See `docs/agents/domain.md`.
