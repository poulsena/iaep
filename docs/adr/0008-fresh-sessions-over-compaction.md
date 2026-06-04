# Fresh sessions seeded from durable artifacts are preferred over compaction

Sessions are re-seeded from durable artifacts rather than compacted, because compaction carries accumulated exploration noise forward in a compressed, hard-to-inspect form. A clean seed beats compressed history. This is the unifying bet behind no-compaction, no-committed-plans, and central CONTEXT.

## Consequences

Re-seeding cost if CONTEXT is thin, so this depends on the durable layer being good. In practice the seed granularity is per-stage (ADR-0010), and the per-session token budget (~120k) bounds how much can be seeded and worked in one session.
