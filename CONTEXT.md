# CONTEXT

Glossary for the LM Studio Comparison benchmark. Terms only — no implementation
detail, no spec, no scratch notes.

## Mission directive

The frozen prompt text in `BENCHMARK-SPEC.md`. It is the *instrument*, not a task
description: editing it mid-benchmark invalidates every cross-model comparison
already taken. "The directive" always means this text, never a model's reading of it.

## Workload

One replayable sequence of prompts fed to a contestant. The Space Invaders workload
is three prompts — directive, "Begin Space Invaders", "Plan approved" — captured in
`Results/_SpaceInvaders-bench-2026-09-04/_evidence/mission.txt`. A workload is held
constant across models; a *directive* can appear in many workloads.

## Contestant

A model under measurement, together with the harness driving it. `qwen3.6-35b-a3b-mtp@q3_k_m`
over EmberOS Workbench is a different contestant from the same weights over another
harness — the harness is part of what is being measured, which is why
`HARNESS-PARITY.md` exists.

## Build

The artifact a contestant produced from a workload. A build is *evidence*: it is
attributable to one contestant on one run, and hand-editing it destroys that
attribution permanently. Builds are frozen once recorded.

## Reference build

A build produced deliberately, by hand, to define the ceiling rather than to measure
anyone. It obeys every directive constraint so that scores taken against it are
comparable, but it is **not a contestant** and carries no run evidence. Distinguished
from a build by *intent*: a build answers "what did this model do", a reference build
answers "what does success look like".

## Gate

A scored pass/fail decision on the 8-axis rubric, at a named point in the roster.
Gate 1 is Pong. Passing a gate is what licenses advancing a contestant, so a gate is
a decision about the *contestant*, never about the code.

## Playable

Proven by driving the software with real input and observing the result — never by a
green build, a passing test, a screenshot, or reading the source. A build that renders
correctly and responds to nothing is **not playable**, and the distinction is not
academic: the 2026-09-04 local build shipped a green `vite build` and a 558 KB bundle
with a simulation layer that never ran once.

## Verb

One thing a player can cause to happen. Playability is assessed verb by verb —
"the ship moves" and "the ship fires" are separate claims with separate evidence,
and a build can pass the first while failing the second.
