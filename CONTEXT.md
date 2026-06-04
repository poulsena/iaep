# IAEP

Internal agentic engineering platform: a local-first desktop tool that runs an idea-to-merge workflow while accumulating a durable knowledge layer, so the codebase gets easier to change as it grows.

## Language

**Compounding Context**:
The governing principle: distilled durable knowledge accumulates faster than complexity, so per-task understanding cost decouples from codebase size.

**Durable layer**:
The git-committed knowledge that survives a feature: CONTEXT.md (per module), CONTEXT-MAP.md (index), and ADRs.
_Avoid_: docs, knowledge base.

**In-flight store**:
The local, ephemeral store for working artifacts (PRDs, issue breakdowns, plans) that are discarded at merge once distillation has happened.
_Avoid_: cache, scratch.

**Execution adapter**:
The per-project-type implementation of the build/test/run seam. Project type selects the adapter and its isolation; the workflow above the seam is identical.
_Avoid_: backend, plugin.

**Agent runtime**:
The provider seam beneath the workflow engine that an agent execution sits on. v1 implements exactly one (Claude Agent SDK) behind this interface; "provider-agnostic" means the seam exists, not that multiple providers work.
_Avoid_: provider, LLM backend, model.

**Agent-reach controls**:
The runtime-agnostic guardrails bounding what an agent can touch: scoped file access, egress proxy, tool allowlist, approval gates, audit log.
_Avoid_: permissions, sandbox (sandbox is the isolation boundary, a different concept).

## Workflow

**Workflow engine**:
The universal, project-type-agnostic core that drives a run through its stages. Always drivable headless via a programmatic driver; any GUI is a thin client over that driver, never the engine itself.
_Avoid_: orchestrator, pipeline.

**Stage**:
A state in the workflow engine's linear state-machine (Idea, PRD, Kanban, Implementation, QA, Merge & Distill), with an entry gate, an exit gate, and a bound role.
_Avoid_: step, phase (phase means a build-plan milestone).

**Gate**:
A transition guard between stages; a stage advances only when its exit gate is satisfied.
_Avoid_: check, validation.

**Role**:
The agent configuration (system prompt, tool set, context scope) bound to a stage. Added only when a stage genuinely needs a distinct configuration from its neighbors.
_Avoid_: persona, mode.

**Lane**:
A path through the stage machine. The full-feature lane runs every stage; the quick-change lane (diagnose, fix, review) skips PRD and Kanban and produces no heavy artifacts.
_Avoid_: track, flow.

**Worker**:
The role that authors and edits code: full edit/build/test tools, repo scope.
_Avoid_: Implementer, developer, agent.

**Reviewer**:
The QA role that verifies a slice: read and run-tests only, no edit tools, sees the diff rather than the authoring context. Distinct from Worker by tool set so no agent grades its own work.
_Avoid_: Judge, Tester (Tester folds into Reviewer until QA needs a distinct test-authoring config).

**Interrogator**:
The role that grills an idea into packable context: a no-code-tools config with a distinct system prompt. Distinct only once the full-feature lane's Idea/PRD stage exists; folds into Worker in the quick-change lane.
_Avoid_: griller, planner.

**Librarian**:
The role that maintains the durable layer at merge: writes CONTEXT.md/ADRs and applies the ADR gate. The one role the conventional Planner/Worker/Reviewer set lacks.
_Avoid_: archivist, scribe.

**Phase**:
A milestone in the build plan (Phase 0–4), not a workflow stage. Distinct from Stage.
