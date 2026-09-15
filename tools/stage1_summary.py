#!/usr/bin/env python3
"""stage1_summary.py — one row per run, so a 13-second p3 cannot hide.

Reads each run's run.json, audit.json and p3 reply. The columns that matter
first are the ones that separate "the turn ended" from "the work was done":
source files written, whether the game directory exists, the p3 wall time, and
what the model's last message actually says.

Usage:  python stage1_summary.py <stage1 results dir>
"""
import json, os, re, sys

root = sys.argv[1].replace('\\', '/').rstrip('/')

rows = []
for mdir in sorted(os.listdir(root)):
    mp = os.path.join(root, mdir)
    if not os.path.isdir(mp) or mdir.startswith('_'):
        continue
    for rdir in sorted(os.listdir(mp)):
        rp = os.path.join(mp, rdir)
        rj = os.path.join(rp, 'run.json')
        if not os.path.isdir(rp) or not os.path.exists(rj):
            continue
        r = json.load(open(rj, encoding='utf-8'))
        a = {}
        aj = os.path.join(rp, 'audit.json')
        if os.path.exists(aj):
            try:
                a = json.load(open(aj, encoding='utf-8'))
            except Exception:
                pass

        # the model's final word -- from p3 reply, or the last continue, or the session
        last = ''
        for cand in ['c5', 'c4', 'c3', 'c2', 'c1', 'p3']:
            f = os.path.join(rp, cand + '.json')
            if os.path.exists(f):
                raw = open(f, encoding='utf-8', errors='replace').read().strip()
                if raw:
                    try:
                        last = (json.loads(raw).get('reply') or '').strip()
                        break
                    except Exception:
                        pass
        if not last:
            sj = os.path.join(rp, 'session.json')
            if os.path.exists(sj):
                try:
                    h = json.load(open(sj, encoding='utf-8')).get('history', [])
                    msgs = [e.get('text', '') for e in h if e.get('kind') == 'assistant']
                    last = (msgs[-1] if msgs else '').strip()
                except Exception:
                    pass

        # what is on disk
        ws = os.path.join(rp, 'ws')
        src = 0
        game_dir = False
        for dp, dn, fn in os.walk(ws):
            dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git')]
            if os.path.basename(dp).lower().replace('-', '_') in ('space_invaders', 'spaceinvaders'):
                game_dir = True
            src += sum(1 for f in fn if os.path.splitext(f)[1] in ('.js', '.mjs', '.ts'))

        bail = bool(r.get('bails')) or bool(re.match(r'Stopped after \d+', last))
        rows.append({
            'model': r.get('model', mdir), 'seed': r.get('seed'),
            'p3s': r.get('p3_seconds'), 'turns': r.get('turns'),
            'tokens_in': r.get('tokens_in'), 'continues': r.get('continues'),
            'src': src, 'game_dir': game_dir,
            'imports_broken': len(a.get('broken_imports', [])) if a else None,
            'calls_broken': len(a.get('broken_calls', [])) if a else None,
            'built': bool((a.get('session') or {}).get('verification', {}).get('ran a build')) if a else None,
            'launched': bool((a.get('session') or {}).get('verification', {}).get('LAUNCHED a browser')) if a else None,
            'bail': bail, 'last': last.replace('\n', ' ')[:110],
        })

print('%-34s sd %6s %5s %5s %4s %4s %3s %3s %3s %3s  %s' % (
    'MODEL', 'p3 s', 'turns', 'src', 'game', 'cont', 'imp', 'cal', 'bld', 'lch', 'LAST MESSAGE'))
print('-' * 150)
for x in rows:
    print('%-34s %2s %6s %5s %5s %4s %4s %3s %3s %3s %3s  %s%s' % (
        x['model'][:34], x['seed'], x['p3s'], x['turns'], x['src'],
        'Y' if x['game_dir'] else '-', x['continues'],
        x['imports_broken'] if x['imports_broken'] is not None else '?',
        x['calls_broken'] if x['calls_broken'] is not None else '?',
        'Y' if x['built'] else '-', 'Y' if x['launched'] else '-',
        'BAIL ' if x['bail'] else '', x['last'][:95]))

print()
print('src = source files on disk · game = Space_Invaders/ dir exists · cont = continues sent')
print('imp/cal = broken imports / broken cross-module calls · bld/lch = ran a build / launched a browser')
print()
# the smell test: p3 shorter than 5 minutes or fewer than 10 source files
sus = [x for x in rows if (x['p3s'] or 0) < 300 or x['src'] < 10]
print('RUNS THAT DID NOT PLAUSIBLY IMPLEMENT (p3 < 5 min or < 10 source files): %d of %d' % (len(sus), len(rows)))
for x in sus:
    print('   %-34s seed %s  p3=%ss  src=%s' % (x['model'][:34], x['seed'], x['p3s'], x['src']))
