# Frontier line — prompt v2, run by hand — 2026-09-15

Five contestants, one run each, same three prompt files the 12 local models got in
`Results/_stage1-2026-09-11/`. The point is parity: an **empty workspace**, the **exact**
prompt text, **no approvals**, and **nothing typed except the three prompts**.

| Folder | Tool | Launch from inside `run1/ws/` |
|---|---|---|
| `gpt-5.6-sol/` | ChatGPT app (Codex) | project dir = `run1/ws`, model **GPT 5.6 Sol**, thinking **Max** |
| `gpt-5.6-terra/` | ChatGPT app (Codex) | project dir = `run1/ws`, model **GPT 5.6 Terra**, thinking **Max** |
| `gpt-6-astra/` | ChatGPT app (Codex) | project dir = `run1/ws`, model **GPT-6 Astra**, thinking **Max** |
| `claude-opus-5/` | Claude Code | `claude --model claude-opus-5 --effort xhigh --dangerously-skip-permissions` |
| `claude-sonnet-5/` | Claude Code | `claude --model claude-sonnet-5 --effort xhigh --dangerously-skip-permissions` |

The GPT runs go through the ChatGPT app. Its thinking levels are Light / Medium / High /
Extra High / Max / Ultra; run all three at **Max** — the CLI's `max`, which is what the BRIEF
specified. Set the app to full access / no approvals for the folder; if it still pauses for
permission, note each pause in `notes/<model>.md`. Claude runs at **Extra High**
(`--effort xhigh`), the highest level its picker offers — same rule as the GPTs: the highest
effort James will actually run. The local models had a hard 8,192-token reasoning clamp, so
the frontier line is a ceiling reference regardless. GPT-6 Astra was added 2026-09-15 as the
newest model the app offers.

## Cross-session memory is OFF for these runs — verify before p2

`.codex/config.toml` in this folder sets `[features] memories = false` for every workspace
beneath it (Codex's "tree" config layer; your global default is untouched). On 2026-09-15
the app's memory summary carried the benchmark's own scoring rules into the first Sol and
Terra runs — both quarantined. **After sending p1, pause and tell Ember**: the new rollout's
first developer message must contain no `MEMORY_SUMMARY` block before p2 goes out. Claude
is already covered by `CLAUDE_CODE_DISABLE_AUTO_MEMORY` in `~/.claude/settings.json`.

Notes files live in `notes/<model>.md`, not next to `ws/` — Terra walked up one directory
and read them. Keep `run1/` empty apart from `ws/` until the run is done.

## The three prompts, in order

1. `prompts/p1.txt` (a copy of the frozen `prompt-v2/p1.txt`) — paste the whole file (5,712 chars). Wait for the model to stop.
2. `prompts/p2.txt` — the text is exactly `Begin Space Invaders`. Wait for it to stop.
3. `prompts/p3.txt` — the text is exactly `Plan approved`. Wait for it to stop.

Send the next prompt only after the previous one has fully finished. If the model ends a
turn by asking a question or saying "shall I continue?", **do not answer it** — the local
runner never did. A model that stops early is a result, not a problem to fix. Note the
time you sent each prompt in `notes/<model>.md` (transcripts carry timestamps; the note is insurance).

## Parity rules — the same conditions the local models had

- **Start in the empty `ws/`.** Do not `git init`, do not `npm install`, do not create
  anything before p1. If Codex asks whether to trust the folder, say yes; if it refuses to
  start outside a git repo, add `--skip-git-repo-check` rather than initialising one.
- **No skill invocation.** Prompt v2 deliberately dropped `Use the openai-game-studio skill:`.
  Both CLIs can see the skill; whether the model reaches for it on its own is part of what
  gets recorded. Don't reach for it on the model's behalf.
- **No extra messages.** No "continue", no hints, no answering its questions. If you have
  to send anything else, write down exactly what and when in `notes/<model>.md`.
- **If a session limit hits mid-run** (Claude: monthly/session cap; Codex: rate limit),
  stop, note the time in `notes/<model>.md`, and resume the same session after the reset
  (`claude --resume` / `codex resume`) — a resume of the same thread is one run, the way
  the Opus attempt on 09-04 was parked. Do not start over in the same folder.
- **Leave the workspace alone when it's done.** No cleanup, no `npm run build`, no
  opening it in a browser. The build, playability probe, audit and scoring run from the
  same tools as Stage 1 (`tools/stage1_build.sh`, `play_probe.mjs`, `audit.py`,
  `stage1_score.py`) against the untouched tree.

## What Ember needs from you when a run is done

Just say which one finished. The transcripts are recovered from the CLIs' own logs —
`~/.claude/projects/<cwd-slug>/*.jsonl` for Claude, `~/.codex/sessions/2026/09/…/rollout-*.jsonl`
for Codex CLI — keyed to the `ws/` path. **Whether the ChatGPT app writes the same rollout
files is unverified**: keep each app thread open until Ember has checked, and if nothing
landed on disk, export the conversation from the app into `run1/`. Anything in `notes/<model>.md` gets folded into `RUN.md`.

## Order

GPT first (Sol, Terra, Astra), then Claude (Opus 5, then Sonnet 5) one at a time, so a
Claude limit hit parks cleanly and the next reset picks it up.
