# Workflow engine is a linear stage state-machine

The workflow engine is a declarative linear state-machine: stages are states, gates are transition guards, and a role is the agent config bound to a state. Lanes (full-feature, quick-change) are paths through the same machine. Parallelism (the Phase-3 DAG) is contained *inside* the Implementation stage as a sub-structure — it never appears at the top level. Failure is a first-class transition: a failed gate loops back to a prior stage with a fresh session seeded by a concise feedback artifact, with bounded retries before escalating to a human.

## Considered Options

- Everything-is-a-DAG from day one — uniform but over-built for a skeleton that only ever runs one linear path.
- Hardcoded sequential pipeline — fastest, but lanes and the Phase-3 DAG become rewrites.

## Consequences

Lanes come nearly free, "no parallelism in Phase 0" stays honest because the top-level engine is linear, and inter-stage hand-off (including failure feedback) is carried purely by on-disk artifacts (ADR-0008), never by conversation continuity.
