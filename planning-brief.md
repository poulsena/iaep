# Project Planning Brief

*Working title TBD. Internal agentic engineering platform.*

---

## The principle: Compounding Context

Distilled knowledge accumulates faster than complexity, so every shipped feature leaves the codebase cheaper to change while the complexity that would normally slow you down gets absorbed into the durable layer. Stated for the outside: **the codebase gets easier to change as it grows.**

This inverts the usual agentic decay, where bigger codebases need more surrounding context per change, which means more tokens, more context-rot exposure, and more places to break something the agent cannot see. The mechanism is that a fresh agent reads the distilled map instead of the raw, growing code, so the per-task cost of understanding the system decouples from the system's size. It compounds only while the map's coverage scales with the code and stays true, which makes the Distill step and the validation backstop the engine that delivers the principle.

---

## Product definition

- GUI desktop application, **local-first**, provider-agnostic.
- A general agentic development workflow that abstracts setup and configuration so non-power-users adopt it. Convenience is the adoption thesis.
- Supports **conventional software** and **Automation Studio / PLC (Structured Text)** projects through the same pipeline.
- Built to develop itself (conventional adapter) and other software, with AS support as a first-class supported project type rather than the thing it is optimized around.

---

## Scope (v1)

**In:**
- Idea-to-merge workflow with the durable knowledge layer (Compounding Context).
- Conventional execution adapter with local sandboxing.
- Parallel implementation on independent work, with conflict detection.
- Agent-reach security controls and a context-rot indicator.
- Automation Studio adapter (later phase, see build plan).

**Out:**
- Remote or cloud execution. Considered only after the local product is proven.
- Central, multi-user LLM wiki. Out of scope for now; if pursued, it is central rather than per-user.
- Relevance-density context indicator as a shipped default. It is a gated experiment, not v1 core.

---

## Locked decisions (seed ADRs)

These passed the three-criteria gate: hard to reverse, surprising without context, the product of a real trade-off.

**ADR-1. Local-first, no remote execution in v1.**
Why: sensitive environments, and the AS simulation needs the local interactive desktop session. The unit is the colleague's machine.
Trade-off: no central management or observability, and no easy multi-user sharing of in-flight state.

**ADR-2. Pluggable execution adapter; project type changes only the adapter and its isolation, never the workflow.**
Why: support conventional and AS projects through one pipeline, and develop the tool with the tool.
Trade-off: an adapter interface to maintain, and two isolation stories to keep correct.

**ADR-3. Isolation is per-project-type.**
Conventional projects run inside WSL2 (a Hyper-V VM boundary from the Windows host) with gVisor (runsc, Systrap mode, no nested virtualization) layered on for defense in depth. AS projects run on the host, secured by agent-reach controls.
Why: AS is a 30-year-old Windows GUI application with Windows Forms dependencies and a manual licensed install. It cannot be containerized, and kernel isolation solves untrusted-code-escape, which is not the risk when the agent drives a trusted vendor compiler over the user's own code.
Trade-off: the AS path has a weaker isolation boundary, mitigated by reach controls and the physical-transfer gate (ADR-7).

**ADR-4. Planning artifacts are not committed to git; durable knowledge is.**
CONTEXT.md (per module), CONTEXT-MAP.md (index), and ADRs are the persisted layer. PRDs, issue breakdowns, and plans live in a local in-flight store and are discarded at merge, gated on distillation having happened first.
Why: stale specs in a repo mislead future readers who treat them as truth. Domain knowledge changes slower and compounds.
Trade-off: relies on a disciplined Distill step, and CONTEXT files relocate drift rather than removing it, so they need a validation backstop for out-of-workflow changes.

**ADR-5. ADRs are gated by the three criteria, enforced in the app.**
A proposed ADR must justify against all three or it becomes a CONTEXT.md note or nothing.
Why: keep the decision log high-signal. Documentation-by-default is what poisons most ADR directories.
Trade-off: requires judgment at the gate.

**ADR-6. Multi-agent parallelism is a speed mechanism.**
Used only on independent DAG nodes, with a git worktree per agent, conflict detection before merge, verification gates, and sequential merges.
Why: proven viable in 2026; the value is wall-clock speed and specialization, not better output per token. Coordination must be treated as infrastructure.
Trade-off: roughly N-times token cost, coordination overhead, and a hard dependency on upstream decomposition quality.

**ADR-7. Physical PLC transfer always requires explicit human confirmation.**
Transfers to a simulated target run autonomously.
Why: transferring to a physical PLC is an irreversible action on real machinery.
Trade-off: none worth noting.

**ADR-8. Fresh sessions seeded from durable artifacts are preferred over context compaction.**
Why: compaction carries accumulated exploration noise forward in a compressed, hard-to-inspect form. A clean seed beats compressed history.
Trade-off: re-seeding cost if CONTEXT is thin, so this depends on the durable layer being good.

---

## Architecture

A universal workflow engine sits on top of pluggable, auto-detected execution adapters. Project type is detected from structure (an AS project file versus a package.json or equivalent), and the user never picks the adapter or its isolation.

```
Workflow engine (universal)
  Idea/grill -> PRD -> Kanban/DAG -> Implementation -> QA -> Merge & Distill
        |                                                         |
        v                                                         v
  In-flight artifact store (local, ephemeral)        Durable layer (git):
                                                      CONTEXT.md, CONTEXT-MAP.md, ADRs
        |
        v
Execution adapter (per project type)
  - Conventional: build/test/run in WSL2 + gVisor
  - Automation Studio: ST edits + AS CLI + GUI-session simulation on host
        |
        v
Agent-reach controls (runtime-agnostic, both adapters)
  scoped file access | egress proxy | tool allowlist | approval gates | audit log
```

The build/test/run interface is the seam. Conventional adapters implement it with the project's toolchain inside the sandbox. The AS adapter implements it with the AS CLI on the host. Everything above the seam is identical for both.

---

## Workflow

Each stage has an entry/exit gate and an assigned role.

| Stage | Role | Exit gate |
|---|---|---|
| Idea (grilling) | Interrogator | Context packed enough to write a pristine PRD. Research and Prototype are optional handoffs spawned to close gaps the grilling surfaces. |
| PRD | Author | Spec complete, scope explicit, ADR candidates flagged. |
| Kanban (decompose + DAG) | Decomposer | Issues independently grabbable as vertical slices, dependency DAG built, conflicts flagged. |
| Implementation | Worker(s) | Slice complete, local tests pass. Each worker in its own worktree, no direct inter-worker coordination. |
| QA / Code Review | Tester, Reviewer (Judge) | Tests green, review passed, no integration conflicts. |
| Merge & Distill | Librarian | Durable layer updated (ADR gate applied), in-flight store cleared. |

**Lanes.** A full feature lane runs the whole pipeline. A quick-change lane (diagnose, fix, review) skips PRD and Kanban and produces no heavy artifacts, so artifacts earn their stay.

**Role-gating rule.** Add a role only when a stage genuinely needs a distinct system prompt, tool set, or context scope from its neighbors. Otherwise fold it in. The Librarian is a role the conventional Planner/Implementer/Reviewer/Tester set lacks, and it is the one that maintains the durable layer.

---

## Context engineering rules

- Center the product on context engineering. The tool is the operating system deciding what to load into the window and when to evict.
- Show a context-rot indicator. Token-count meter as the default and safe initial signal, with roughly 100k as a working floor and a higher ceiling as a heuristic. Use the term "context-rot" in the UI.
- Test relevance density as a gated experiment, since the relevance of what is in the window matters as much as its length. Ship it only if it predicts failures better than token count.
- Prefer fresh sessions seeded from durable artifacts over compaction. Use subagents to offload exploration and keep the active context clean.
- The unifying bet: distilled durable knowledge is rich enough to seed a fresh agent, so session history is never carried forward. No-compaction, no-committed-plans, and central CONTEXT all rest on this.

---

## Open questions

Resolve these before or during the phase that needs them.

1. **PVI programmatic access.** Can the agent read simulated process variables through PVI without a human watching the GUI? This decides whether AS simulation feedback can close the loop autonomously. (Blocks Phase 4.)
2. **AS CLI surface.** The full command set beyond build and transfer, and what else the agent can usefully drive.
3. **Conflict-detection mechanism.** A concrete way to detect two nominally independent issues touching the same decision surface (shared files, domain types, interfaces). (Blocks Phase 2.)
4. **CONTEXT validation backstop.** How to detect out-of-workflow drift, where code changed but its CONTEXT.md did not.
5. **Brownfield ingestion quality.** How to derive an initial CONTEXT.md and CONTEXT-MAP.md from an existing codebase well enough to seed the workflow.

---

## Build plan (proposal, dogfood-first)

Security architecture is part of the skeleton from Phase 0. The heavier isolation is hardened before parallelism, since parallelism multiplies the number of concurrently executing agents and therefore the blast radius. Sequencing is otherwise the part most likely to change against your own priorities.

**Phase 0. Walking skeleton.** Workflow engine shell, conventional execution adapter, local in-flight artifact store, CONTEXT.md read/write, a minimal but real GUI, and the agent-reach control architecture stubbed in (tool allowlist, approval gates, scoped file access, audit). Goal: run one feature end-to-end on a conventional project with a single agent, no parallelism. Outcome: you can build the tool with the tool.

**Phase 1. The durable layer (the differentiator).** CONTEXT.md, CONTEXT-MAP.md, and ADR generation, the Distill step, the ADR three-criteria gate, brownfield ingestion, and the validation backstop. Outcome: Compounding Context is real and measurable on the tool's own repo.

**Phase 2. Security hardening.** gVisor sandbox for the conventional adapter in WSL2, egress proxy, full tool-allowlist enforcement, audit completeness, and the context-rot indicator in the GUI. Outcome: enterprise-grade containment in place before parallelism amplifies the risk.

**Phase 3. Parallel implementation (speed).** DAG decomposition, worktree isolation, conflict detection before merge, Planner/Worker/Judge orchestration, sequential merges. Outcome: multi-issue features ship faster with safety rails, on top of a hardened sandbox.

**Phase 4. Automation Studio adapter.** Host execution, AS CLI integration, the physical-transfer human gate, and PVI simulation feedback (pending open question 1). Outcome: PLC engineers onboarded.

**Cross-cutting.** GUI and convenience polish increase every phase. The abstraction of setup is the value proposition, so it constrains every phase rather than being a separate workstream.

---

## Influences (reference)

- **Center:** context engineering (Karpathy, Anthropic). **Backbone:** Matt Pocock's skill pipeline.
- **Taking from:** Cursor's Planner/Worker/Judge split; Augment's coordination-as-infrastructure (worktree isolation, conflict detection before merge, verification gates); Cognition's principle of making implicit decisions explicit before fan-out; Manus's filesystem-as-context and anti-compaction; EARS notation as an optional spec format; Beads as a reference for Kanban-layer concurrency.
- **Reference only:** Spec Kit, for its phase skeleton. Its committed living-artifact model conflicts with ADR-4, so it is not wrapped.
- **Not adopting:** Tessl (spec-as-source, the opposite philosophy) and Intent's living-spec approach (solves drift by syncing a committed spec, which is a different fork than the one chosen here).
