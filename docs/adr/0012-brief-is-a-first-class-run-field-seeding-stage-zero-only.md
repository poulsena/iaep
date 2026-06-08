# Brief is a first-class run field, seeding stage zero only

A run's user-supplied intent (the **Brief**) is a first-class typed field on `StartRunOptions` and `RunState`, not an entry in the `artifacts` map. It is injected into `StageInput` for the first stage only; every subsequent stage receives a wiped session seeded by the artifacts derived from it (PRD, issues), consistent with ADR-0008.

## Considered Options

- **Brief as an artifact key** (`artifacts["brief"]`) — zero new types, flows everywhere for free. Rejected because artifacts are stage outputs (secondary context); the Brief is user input (primary intent). Smudging that distinction makes the map ambiguous and reserves a key in a free-form structure.
- **Brief broadcast to every stage** — gives every role the original intent. Rejected because it contradicts ADR-0008: downstream roles (worker, reviewer, librarian) should work from the derived artifacts (PRD/issue), which are supposed to carry everything needed. Leaking the raw Brief past stage zero is a crutch that papers over an under-specified PRD.

## Consequences

The Brief is modeled as `{ text: string }` in v1, leaving room for a `source: "ad-hoc" | "issue"` discriminant when work-item linkage is added. It must be persisted on run state at start time — it is not re-derivable from the repo, so a loopback or resume that re-enters stage zero still has it.
