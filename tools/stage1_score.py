#!/usr/bin/env python3
"""stage1_score.py — the Stage 1 scorecard: 9 axes x 12 models x 3 seeds.

Every axis is scored by a stated rule from recorded evidence (audit.json,
build.json, play.json, run.json). Where the rubric calls for judgement -- axes
1, 3 (tuning), 6, 7 -- the rule is a floor derived from evidence and the axis is
marked PROVISIONAL for a human pass.

Per N-DESIGN.md: n = 3 gives buckets, not a ranking. Playability and axis 8 are
reported as k/3 and never averaged. Other axes report the median of three with
the range beside it, so a lucky seed cannot masquerade as a capability.

Usage:  python stage1_score.py <stage1 dir> [--md]
"""
import json, os, re, sys, statistics

root = sys.argv[1].replace('\\', '/').rstrip('/')
as_md = '--md' in sys.argv

def load(p):
    try:
        return json.load(open(p, encoding='utf-8'))
    except Exception:
        return {}

def plan_chars(rdir):
    """The Stage 1 p2 plan, wherever it landed."""
    best = 0
    for dp, dn, fn in os.walk(os.path.join(rdir, 'ws')):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git')]
        for f in fn:
            if f.lower() == 'plan.md':
                best = max(best, os.path.getsize(os.path.join(dp, f)))
    p2 = load(os.path.join(rdir, 'p2.json')).get('reply') or ''
    if len(re.findall(r'^#{1,4}\s+\S', p2, re.M)) >= 4:
        best = max(best, len(p2))
    return best

def p3_printed_code(rdir):
    """STEP 3 answered with code in chat and no tool calls."""
    s = load(os.path.join(rdir, 'session.json'))
    h = s.get('history', [])
    u = [i for i, e in enumerate(h) if e.get('kind') == 'user']
    if len(u) < 3:
        return False
    p3 = h[u[2]:]
    tools = sum(1 for e in p3 if e.get('kind') == 'tool')
    return tools == 0

def score_run(mdir, rdir):
    run = load(os.path.join(rdir, 'run.json'))
    audit = load(os.path.join(rdir, 'audit.json'))
    build = load(os.path.join(rdir, 'build.json'))
    play = load(os.path.join(rdir, 'play.json'))
    sess = (audit.get('session') or {})
    ver = sess.get('verification') or {}
    sig = audit.get('signals') or {}
    css = audit.get('css') or {}

    printed = p3_printed_code(rdir)
    src = build.get('src', 0)
    built = bool(build.get('built'))
    fatal = [e for e in play.get('errors', []) if not e.startswith('console:')]
    outcome = play.get('outcome') or ('none' if printed or src < 10 else ('nobuild' if not built else '?'))
    # a canvas that exists but a loop that died on frame one is broken, not rendering
    if outcome == 'renders' and fatal and not play.get('idle_bytes_differ'):
        outcome = 'broken'
    plays = outcome == 'plays'

    s = {}
    # 1 Plan Diligence  (PROVISIONAL floor from size + structure)
    pc = plan_chars(rdir)
    s[1] = 0 if pc < 500 else 1 if pc < 2000 else 2 if pc < 8000 else 3 if pc < 15000 else 4 if pc < 25000 else 5

    # 2 Code Completeness
    if printed or src < 10:           s[2] = 0
    elif not built:                   s[2] = 1
    elif outcome == 'broken':         s[2] = 2
    elif plays and not audit.get('broken_imports') and not audit.get('broken_calls') and not audit.get('placeholders'): s[2] = 5
    elif not audit.get('broken_imports') and not audit.get('broken_calls'): s[2] = 4
    else:                             s[2] = 3

    # 3 Post-processing  (PROVISIONAL: presence is 3, tuning needs eyes)
    ec, ub = bool(sig.get('EffectComposer')), bool(sig.get('UnrealBloomPass'))
    s[3] = 0 if printed or src < 10 else 3 if (ec and ub) else 2 if ec else 0

    # 4 VFX: six mandatory systems
    six = ['camera shake', 'particle bursts', 'hit-stop', 'motion trails', 'shockwave rings', 'floating score text']
    n6 = sum(1 for k in six if sig.get(k))
    s[4] = 0 if printed or src < 10 else {6: 5, 5: 4, 4: 3, 3: 2, 2: 1, 1: 1, 0: 0}[n6]

    # 5 Resource Discipline: five checkable requirements, one point each
    caps = audit.get('particle_caps') or []
    d, a = audit.get('dispose_calls', 0), audit.get('three_allocations', 0)
    pts = 0
    if sig.get('object pooling'): pts += 1
    if caps and all(c[3] <= 500 for c in caps): pts += 1
    if a and d >= a * 0.5: pts += 1
    if sig.get('InstancedMesh'): pts += 1
    if not audit.get('non_standard_materials'): pts += 1
    s[5] = 0 if printed or src < 10 else pts

    # 6 Procedural Fidelity  (PROVISIONAL evidence floor)
    s[6] = 0 if printed or src < 10 else sum(1 for k in ('CanvasTexture', 'Web Audio', 'procedural noise') if sig.get(k))

    # 7 Juice & UI  (PROVISIONAL evidence floor)
    s[7] = 0 if printed or src < 10 else sum(1 for k in css if css.get(k))

    # 8 Verification Behaviour, per the rubric guide
    # Rubric guide: 0 nothing run; 1 build only; 2 opened it, did not repair
    # what it showed; 3 opened + fixed console errors; 4 interacted and repaired
    # what that exposed; 5 iterated to genuinely playable with its own tooling.
    # "Opened" is a served page or a launched browser; "interacted" is clicks,
    # keys, or reading game state back out (>= 3 to count as more than a poke).
    # Level 5 is the rubric's words: "iterated unprompted until genuinely playable,
    # using Playwright/browser tools on its own initiative". Browser-tool use is the
    # criterion, not a test file -- a test file is reported, not required.
    rb  = ver.get('ran a build', 0)
    opened = ver.get('LAUNCHED a browser', 0) or ver.get('served the game', 0)
    inter = ver.get('INTERACTED with it', 0)
    pwcli = ver.get('used playwright-cli', 0)
    browser = ver.get('LAUNCHED a browser', 0) > 0 or pwcli > 0
    tst = ver.get('wrote its own test', 0)
    if not rb and not opened:                       s[8] = 0
    elif not opened:                                s[8] = 1
    elif outcome in ('broken', 'nobuild', 'none'):  s[8] = 2   # opened it, shipped it broken anyway
    elif outcome == 'renders' and inter < 3:        s[8] = 2
    elif outcome == 'renders':                      s[8] = 3   # played it, did not see the fault
    elif plays and browser and inter >= 3:          s[8] = 5   # played it through a browser tool, to playable
    elif plays and inter >= 3:                      s[8] = 4   # played it some other way (curl, served)
    elif plays:                                     s[8] = 3   # playable, but never actually played it
    else:                                           s[8] = 1

    # 9 Protocol Compliance
    w, c = run.get('step1_writes', 0) or 0, run.get('step1_commands', 0) or 0
    if printed:                       s[9] = 1      # answered "write every file" by typing them into chat
    elif w or c:                      s[9] = 2
    elif pc >= 2000:                  s[9] = 4 if os.path.exists(os.path.join(rdir, 'ws')) else 3
    else:                             s[9] = 0
    if s[9] == 4 and any(f.lower() == 'plan.md' for dp, dn, fn in os.walk(os.path.join(rdir, 'ws')) for f in fn if 'node_modules' not in dp):
        s[9] = 5

    return {'seed': run.get('seed'), 'axes': s, 'total': sum(s.values()), 'outcome': outcome,
            'plays': plays, 'printed': printed, 'built': built, 'src': src,
            'score_after': play.get('score_after'), 'turns': run.get('turns'),
            'pwcli': ver.get('used playwright-cli', 0), 'own_tests': ver.get('wrote its own test', 0),
            'bails': run.get('bails') or [], 'p3s': run.get('p3_seconds')}

models = []
for m in sorted(os.listdir(root)):
    mdir = os.path.join(root, m)
    if not os.path.isdir(mdir) or m.startswith('_'):
        continue
    runs = []
    for r in ('run1', 'run2', 'run3'):
        rd = os.path.join(mdir, r)
        if os.path.exists(os.path.join(rd, 'run.json')):
            runs.append(score_run(mdir, rd))
    if not runs:
        continue
    meta = load(os.path.join(mdir, 'model.json'))
    med = {ax: int(statistics.median([x['axes'][ax] for x in runs])) for ax in range(1, 10)}
    rng = {ax: (min(x['axes'][ax] for x in runs), max(x['axes'][ax] for x in runs)) for ax in range(1, 10)}
    models.append({'model': meta.get('model', m), 'runs': runs, 'median': med, 'range': rng,
                   'plays_k': sum(1 for x in runs if x['plays']),
                   'verified_k': sum(1 for x in runs if x['axes'][8] >= 3),
                   'built_k': sum(1 for x in runs if x['built']),
                   'printed_k': sum(1 for x in runs if x['printed']),
                   'pwcli_k': sum(1 for x in runs if x['pwcli']),
                   'pwcli_cmds': sum(x['pwcli'] for x in runs),
                   'median_total': int(statistics.median([x['total'] for x in runs])),
                   'n': len(runs)})

models.sort(key=lambda z: (-z['plays_k'], -z['median_total']))

AX = ['Plan', 'Code', 'Bloom', 'VFX', 'Resrc', 'Proc', 'Juice', 'Verif', 'Proto']
if as_md:
    print('| Model | **Plays** | Verified | PW-CLI | Built | Printed | ' + ' | '.join(AX) + ' | Median /45 |')
    print('|---|:-:|:-:|:-:|:-:|:-:|' + ':-:|' * 9 + '---:|')
    for z in models:
        cells = ' | '.join('%d (%d-%d)' % (z['median'][a], *z['range'][a]) if z['range'][a][0] != z['range'][a][1] else str(z['median'][a]) for a in range(1, 10))
        print('| `%s` | **%d/%d** | %d/%d | %d/%d (%d) | %d/%d | %d/%d | %s | **%d** |' % (
            z['model'], z['plays_k'], z['n'], z['verified_k'], z['n'], z['pwcli_k'], z['n'], z['pwcli_cmds'],
            z['built_k'], z['n'], z['printed_k'], z['n'], cells, z['median_total']))
else:
    print('%-40s %6s %6s %10s %6s %6s  %s  %6s' % ('MODEL', 'PLAYS', 'VERIF', 'PW-CLI', 'BUILT', 'PRINT', ' '.join('%5s' % a for a in AX), 'MED/45'))
    print('-' * 140)
    for z in models:
        print('%-40s %6s %6s %10s %6s %6s  %s  %6s' % (
            z['model'][:40], '%d/%d' % (z['plays_k'], z['n']), '%d/%d' % (z['verified_k'], z['n']),
            '%d/%d (%d)' % (z['pwcli_k'], z['n'], z['pwcli_cmds']),
            '%d/%d' % (z['built_k'], z['n']), '%d/%d' % (z['printed_k'], z['n']),
            ' '.join('%5s' % ('%d' % z['median'][a] if z['range'][a][0] == z['range'][a][1] else '%d~%d' % z['range'][a]) for a in range(1, 10)),
            z['median_total']))
    print()
    print('PLAYS / VERIF / PW-CLI = k of n runs (never averaged); PW-CLI (n) = playwright-cli commands across the three.')
    print('Other axes: median, or min~max when seeds disagree.')
    print('PROVISIONAL (evidence floor, needs a human pass): Plan, Bloom tuning, Proc, Juice.')
    print()
    print('PER RUN')
    for z in models:
        for x in z['runs']:
            print('  %-38s seed %s  %-8s score=%-5s pwcli=%-3s built=%s printed=%s bails=%-14s total=%2d  axes=%s' % (
                z['model'][:38], x['seed'], x['outcome'], x['score_after'] if x['score_after'] is not None else '-',
                x['pwcli'], 'Y' if x['built'] else '-', 'Y' if x['printed'] else '-', ','.join(x['bails']) or '-',
                x['total'], ''.join(str(x['axes'][a]) for a in range(1, 10))))

json.dump(models, open(os.path.join(root, 'SCORECARD.json'), 'w', encoding='utf-8'), indent=1)
