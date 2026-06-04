# Isolation is per-project-type

Conventional projects run inside WSL2 (a Hyper-V VM boundary from the Windows host) with gVisor (runsc, Systrap mode, no nested virtualization) layered on for defense in depth. AS projects run on the host, secured by agent-reach controls. AS is a 30-year-old Windows GUI application with Windows Forms dependencies and a manual licensed install: it cannot be containerized, and kernel isolation solves untrusted-code-escape, which is not the risk when the agent drives a trusted vendor compiler over the user's own code.

## Consequences

The AS path has a weaker isolation boundary, mitigated by reach controls and the physical-transfer gate (ADR-0007).
