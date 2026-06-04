# Planning artifacts are not committed to git; durable knowledge is

CONTEXT.md (per module), CONTEXT-MAP.md (index), and ADRs are the persisted, git-committed layer. PRDs, issue breakdowns, and plans live in a local, ephemeral in-flight store and are discarded at merge, gated on distillation having happened first. Stale specs in a repo mislead future readers who treat them as truth; domain knowledge changes slower and compounds.

## Consequences

Relies on a disciplined Distill step. CONTEXT files relocate drift rather than removing it, so they need a validation backstop for out-of-workflow changes. The in-flight store lives host-side, out-of-repo (`~/.iaep/<repo-key>/runs/<run-id>/`), as files; the durable layer lives in the repo.
