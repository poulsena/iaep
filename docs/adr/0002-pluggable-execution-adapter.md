# Pluggable execution adapter

Project type selects the execution adapter and its isolation only; the workflow above the build/test/run seam is identical for every project type. This lets conventional and Automation Studio projects run through one pipeline and lets the tool develop itself.

## Consequences

An adapter interface to maintain, and two isolation stories to keep correct.
