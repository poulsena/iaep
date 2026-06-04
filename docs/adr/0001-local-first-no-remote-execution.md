# Local-first, no remote execution in v1

Execution happens entirely on the colleague's own machine; there is no remote or cloud execution in v1. Driven by sensitive environments and the fact that AS simulation needs the local interactive desktop session — the unit is the colleague's machine.

## Consequences

No central management or observability, and no easy multi-user sharing of in-flight state. Remote execution is reconsidered only after the local product is proven.
