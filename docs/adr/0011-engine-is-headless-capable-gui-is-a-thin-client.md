# The engine is headless-capable; the GUI is a thin client

The workflow engine is always drivable headless through a programmatic driver, and any GUI is a permanent thin client over that driver — never the engine itself. This is a structural invariant on every phase, not just a Phase 0 sequencing convenience. It keeps the engine testable, lets the spine be proven before any GUI exists, and is the enabler for the out-of-scope-for-now remote/cloud execution (ADR-0001) without committing to it.

## Consequences

A driver/IPC boundary must be maintained between engine and GUI from the first commit, and engine state must be expressible to a client that holds no engine internals. In Electron terms: the engine and in-process SDK live in the main process; the renderer is a thin client over IPC.
