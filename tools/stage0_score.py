#!/usr/bin/env python3
"""stage0_score.py — score a Stage 0 sweep: axes 1 and 9 only.

Two things this got wrong on the first pass, both fixed here:

1. A plan counted only if `plan.md` existed on disk. STEP 2 says "Output a
   highly exhaustive `plan.md`" and "output" is genuinely ambiguous -- half the
   roster wrote the file, half printed it into the reply. Axis 1 scores whether
   the plan is exhaustive and game-specific, not which path it occupies.
2. Detection matched five exact heading phrases and required three. A 17,680
   character plan with eighteen enumerated enhancements was rejected for saying
   "Modern Enhancements: 18 AAA Upgrades" instead of the phrase being looked
   for. Structure is now measured, not vocabulary.

A p2 that never returned is marked. If the run was also a turn runaway it is a
failure on its own behaviour; if the turn count was healthy it is excluded from
axis-1 judgement, because failing it on plan quality would score the timeout
rather than the model.

Usage:  python stage0_score.py <stage0 results dir>
"""
import json, os, re, sys

root = sys.argv[1].replace('\\', '/').rstrip('/')

MIN_PLAN_CHARS = 2000      # below this it is an acknowledgement, not a plan
MIN_HEADINGS = 4           # a plan has sections; a paragraph does not
RUNAWAY_TURNS = 40         # p1+p2 took 2-9 turns for every healthy model
STEP2_MODULE_LIMIT = 3     # scaffolding is fair; building the architecture is not


def plan_shape(text):
    """(chars, headings) -- is this text structured like a plan?"""
    if not text:
        return 0, 0
    return len(text), len(re.findall(r'^#{1,4}\s+\S', text, re.M))


rows = []
for name in sorted(os.listdir(root)):
    d = os.path.join(root, name)
    rp = os.path.join(d, 'result.json')
    if not os.path.isdir(d) or not os.path.exists(rp):
        continue
    r = json.load(open(rp, encoding='utf-8'))

    disk_txt = ''
    for dp, dn, fn in os.walk(os.path.join(d, 'ws')):
        for f in fn:
            if f.lower() == 'plan.md':
                disk_txt = open(os.path.join(dp, f), encoding='utf-8', errors='replace').read()

    reply = ''
    terminated = False
    p2 = os.path.join(d, 'p2.json')
    if os.path.exists(p2):
        raw = open(p2, encoding='utf-8', errors='replace').read().strip()
        if not raw:
            terminated = True          # empty file = the request never returned
        else:
            try:
                reply = (json.loads(raw) or {}).get('reply') or ''
            except Exception:
                terminated = True

    dchars, dheads = plan_shape(disk_txt)
    rchars, rheads = plan_shape(reply)
    ok = lambda c, h: c >= MIN_PLAN_CHARS and h >= MIN_HEADINGS
    route = 'file' if ok(dchars, dheads) else ('reply' if ok(rchars, rheads) else 'NONE')

    # A bail is the harness stopping the turn. The reply then contains the bail
    # text rather than the model's answer, and a scorer reading only plan size
    # will pass a run that never finished.
    r['bailed'] = bool(r.get('bails')) or bool(
        re.match(r'Stopped after \d+ turns? that', (reply or '').strip()))

    # STEP 2 asks for a plan and nothing else. A model that implements the
    # project here enters STEP 3 with the work already underway, which is the
    # same comparability problem as writing during STEP 1.
    # Scaffolding a project is defensible during planning; writing its modules is
    # STEP 3 work done early, and a model that enters STEP 3 with the architecture
    # already built is not doing the same task as one that starts from a plan.
    # Dependencies, lockfiles and build logs are not authored output.
    SCAFFOLD = {'package.json', 'package-lock.json', 'vite.config.js',
                'index.html', '.gitignore', 'readme.md', 'agents.md'}
    SRC_EXT = {'.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx'}
    modules = []
    for dp, dn, fn in os.walk(os.path.join(d, 'ws')):
        dn[:] = [x for x in dn if x not in ('node_modules', 'dist', '.git', '.vite')]
        for f in fn:
            low = f.lower()
            if low == 'plan.md' or low in SCAFFOLD or not os.path.splitext(low)[1] in SRC_EXT:
                continue
            rel = os.path.relpath(os.path.join(dp, f), os.path.join(d, 'ws')).replace(chr(92), '/')
            if '/' in rel:                      # a module inside the architecture
                modules.append(rel)
    r['step2_modules_built'] = len(modules)
    r['step2_module_list'] = sorted(modules)[:12]

    r.update({
        'plan_on_disk': dchars, 'plan_on_disk_headings': dheads,
        'plan_in_reply': rchars, 'plan_in_reply_headings': rheads,
        'plan_route': route,
        'plan_effective_bytes': dchars if route == 'file' else (rchars if route == 'reply' else 0),
        'no_p2_response': terminated,
        'runaway': (r.get('turns') or 0) > RUNAWAY_TURNS,
    })
    json.dump(r, open(rp, 'w'), indent=1)
    rows.append(r)

print('%-46s %6s %6s %6s %6s %2s %2s %8s %6s' %
      ('MODEL', 'tok/s', 'VRAM', 'p1s', 'p2s', 'W', 'C', 'PLAN', 'ROUTE'))
print('-' * 100)
for r in sorted(rows, key=lambda x: x.get('model', '')):
    flag = ''
    if r.get('runaway'):
        flag = '  <- RUNAWAY %d turns' % r['turns']
    if r.get('no_p2_response'):
        flag = '  <- p2 never returned'
    if r.get('step2_modules_built'):
        flag = '  <- built %d module(s) in STEP 2%s' % (
            r['step2_modules_built'], '' if r['step2_modules_built'] < STEP2_MODULE_LIMIT else ' (OVER LIMIT)')
    if r.get('bailed'):
        flag = '  <- HARNESS BAIL'
    print('%-46s %6s %6s %6s %6s %2s %2s %8s %6s%s' % (
        r['model'][:46], r.get('tps', '-'), r.get('vram_mib', '-'),
        r.get('p1_seconds', '-'), r.get('p2_seconds', '-'),
        r.get('step1_writes', '-'), r.get('step1_commands', '-'),
        r.get('plan_effective_bytes', 0), r.get('plan_route', '-'), flag))

print()
print('W/C = files written and commands run during STEP 1 — v2 forbids both.')
print('PLAN = chars, wherever it landed: >=%d chars and >=%d headings.' % (MIN_PLAN_CHARS, MIN_HEADINGS))


def verdict(r):
    if r.get('load') == 'FAILED':
        return 'fail', 'load failed'
    if r.get('tps', 0) and r['tps'] < 15:
        return 'fail', 'CPU offload — %s tok/s at %s MiB' % (r['tps'], r.get('vram_mib'))
    if r.get('bailed'):
        return 'fail', 'harness bail - the turn never completed'
    # POLICY (James, 2026-09-11): STEP 2 forbids nothing explicitly -- only STEP 1
    # says "create no files" -- so scaffolding a project while planning is within
    # a fair reading. What is not is building the architecture, which puts a model
    # into STEP 3 ahead of its peers. The line is drawn at three modules: bonsai
    # wrote one helper alongside scaffolding and stays; the two failures wrote
    # seven and eleven.
    if (r.get('step2_modules_built') or 0) >= STEP2_MODULE_LIMIT:
        return 'fail', 'built %d source module(s) during STEP 2, which asks only for a plan (%s)' % (
            r['step2_modules_built'], ', '.join(r.get('step2_module_list', [])[:3]))
    if r.get('runaway'):
        # A runaway that then times out is failing on its own behaviour; the
        # unreturned p2 is the consequence, not the cause. Check it first.
        return 'fail', '%d turns on p1+p2 (healthy range 2-9), p2 never returned' % r['turns']
    if r.get('no_p2_response'):
        return 'excluded', 'p2 never returned, turn count healthy; not judged on axis 1'
    bad = []
    if r.get('step1_writes'):
        bad.append('%d STEP 1 writes' % r['step1_writes'])
    if r.get('step1_commands'):
        bad.append('%d STEP 1 commands' % r['step1_commands'])
    if r.get('plan_route') == 'NONE':
        bad.append('no plan produced')
    return ('fail', ', '.join(bad)) if bad else ('pass', '')


buckets = {'pass': [], 'fail': [], 'excluded': []}
for r in rows:
    v, why = verdict(r)
    buckets[v].append((r, why))

print()
print('PASSES STAGE 0 — advance to Stage 1: %d of %d' % (len(buckets['pass']), len(rows)))
for r, _ in sorted(buckets['pass'], key=lambda x: -x[0].get('plan_effective_bytes', 0)):
    print('   %-46s plan %s chars (%s)' % (r['model'][:46], r['plan_effective_bytes'], r['plan_route']))
for label in ('fail', 'excluded'):
    if buckets[label]:
        print()
        print({'fail': 'DOES NOT PASS', 'excluded': 'EXCLUDED — not a model verdict'}[label] + ':')
        for r, why in buckets[label]:
            print('   %-46s %s' % (r['model'][:46], why))
