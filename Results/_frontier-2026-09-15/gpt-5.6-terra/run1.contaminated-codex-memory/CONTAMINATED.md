# CONTAMINATED — not a reference run

Codex cross-session memory (`~/.codex/memories/MEMORY.md`, `features.memories = true`)
carried the benchmark's own Stage 1 results and scoring rules into this run. The app
injects `memory_summary.md` into the developer message, and that summary said:

- "browser-observed behavior rather than build-only claims"
- "Make important behavioral signals, such as `playwright-cli` use, visible in audits and scorecards"
- "Build success is not playability: serve, interact with, and inspect the running artifact"
- "use separate harsh visual critics, blind comparison, and looping until quality is acceptable;
  report evidence and gaps instead of claiming completion from a green build"
- and a 2026-09-06 Codex session that built a reference Space Invaders for this same directive.

**Sol:** memory was empty at session start (01:36 local). The regenerated summary entered the
context at the first compaction — 09:51, six minutes into p3. p1 and p2 are clean; p3 is not.
The p2 plan (written clean) already contained verification gates, so the disposition predates
the leak, but the p3 sub-agent structure (`final_visual_judge`, `final_acceptance_audit`) is the
memory's sentence made flesh and cannot be attributed to the model alone.

**Terra:** contaminated from the first token; it also read `MEMORY.md` and `../NOTES.md`
directly (the app does not root tools in the workspace). Stopped during p3.

Both kept, scored where scored, and labelled. Re-run under
`Results/_frontier-2026-09-15/.codex/config.toml` → `[features] memories = false`, with the
notes files moved out of the workspace's parent directory.
