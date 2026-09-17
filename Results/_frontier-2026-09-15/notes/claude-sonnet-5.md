# NOTES — claude-sonnet-5 run1

Log here anything that was not one of the three prompts: extra messages sent, limit hits and resume times, crashes.

- thinking level used: extra high effort
- p1 sent: 11:09PM
- p2 sent: 
- p3 sent: 
- finished: 

## Incident 2026-09-16 00:24 (Ember)
- While scoring Sol, `tools/stage1_build.sh` was run on the whole frontier root and walked into this
  live workspace: `rm -rf dist`, `npm`/`vite build`, wrote `build.log`. `build.log` removed at 00:26;
  `dist/` left in place (it is a rebuild of the model's own source at that moment). If the model lists
  the tree and remarks on `dist/` or a build it did not run, that is this. The script now skips any
  run without a recorded `session.json`.
