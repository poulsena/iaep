# Multi-agent parallelism is a speed mechanism

Multi-agent parallelism is used only on independent DAG nodes, with a git worktree per agent, conflict detection before merge, verification gates, and sequential merges. The value is wall-clock speed and specialization, not better output per token; coordination must be treated as infrastructure.

## Consequences

Roughly N-times token cost, coordination overhead, and a hard dependency on upstream decomposition quality. Parallelism is contained inside the Implementation stage (ADR-0010); it never appears above the engine's linear stage machine.
