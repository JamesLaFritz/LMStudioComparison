#!/usr/bin/env python
"""plan_fidelity.py -- did the build follow the plan's file architecture?

    python plan_fidelity.py <results-root> [<results-root> ...] [--md] [--json out.json]

The directive's STEP 2 asks for "every ES module required, and the import path between
each". So every plan names files. This reads the module paths out of each plan (plan.md on
disk + the p2 reply) and checks them against the source tree the run actually produced.

  planned    distinct source-file paths named in the plan (.js .mjs .ts .css .html)
  built      planned paths that exist in ws/ (matched by path suffix, then by basename)
  missing    planned, not on disk
  unplanned  source files on disk the plan never named
  vfx        the six VFX systems the plan promised vs the six the audit found in code

Paths are normalised: leading ./ and src/ are dropped, backslashes flipped, and a planned
`Space_Invaders/Game.js` matches an actual `src/Space_Invaders/Game.js`. Directory
listings inside ``` fences and inline `path/File.js` mentions both count. Basename-only
matches are reported separately so a moved file is not called missing.
"""
import argparse, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import plan_audit

PATH_RX = re.compile(r'(?<![\w/.-])((?:[\w.-]+/)*[A-Za-z_][\w.-]*\.(?:js|mjs|ts|css|html))\b')
SKIP_NAMES = {'package.json', 'package-lock.json', 'vite.config.js', 'vite.config.ts', 'index.html',
              'plan.md', 'README.md', 'playwright.config.js', 'playwright.config.ts', '.gitignore',
              # the library and its addons, named in import lines, are not files the model writes
              'Three.js', 'three.js', 'EffectComposer.js', 'RenderPass.js', 'UnrealBloomPass.js', 'OutputPass.js',
              'ShaderPass.js', 'SMAAPass.js', 'FXAAShader.js', 'BufferGeometryUtils.js', 'OrbitControls.js',
              'SimplexNoise.js', 'ImprovedNoise.js', 'Pass.js', 'CopyShader.js', 'GammaCorrectionShader.js'}
TREE_LINE = re.compile(r'^[\s│├└─|`-]*([\w.-]+\.(?:js|mjs|ts|css|html))\b', re.M)


def norm(p):
    p = p.replace('\\', '/').strip('/')
    p = re.sub(r'^(\./|(\.\./)+)', '', p)
    p = re.sub(r'^(src|project-root|project|root|workspace|AAA-[\w-]+|neon-[\w-]+)/', '', p, flags=re.I)
    return p


def planned_paths(text):
    out = set()
    for m in PATH_RX.finditer(text):
        p = norm(m.group(1))
        if os.path.basename(p) in SKIP_NAMES or p.startswith(('node_modules', 'dist', 'http', 'three/', 'postprocessing/')):
            continue
        if '/' in p or True:
            out.add(p)
    # tree listings: only the filename is on the line, the directory is implied by the
    # indentation we cannot reliably reconstruct -- keep basename entries, marked
    for m in TREE_LINE.finditer(text):
        b = m.group(1)
        if b not in SKIP_NAMES:
            out.add(b)
    return out


def actual_paths(ws):
    out = []
    for dp, dn, fn in os.walk(ws):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git', 'test-results', '.playwright-cli', '.playwright-mcp', 'artifacts')]
        for f in fn:
            if f.lower().endswith(('.js', '.mjs', '.ts', '.css', '.html')) and f not in SKIP_NAMES:
                rel = os.path.relpath(os.path.join(dp, f), ws).replace('\\', '/')
                out.append(norm(rel))
    return out


def match(planned, actual):
    actual_set = set(actual)
    stem = lambda x: os.path.splitext(os.path.basename(x))[0]
    by_base = {}
    for a in actual:
        by_base.setdefault(stem(a), []).append(a)
    exact, moved, missing = [], [], []
    for p in sorted(planned):
        if '/' in p:
            if p in actual_set or any(a.endswith('/' + p) for a in actual_set):
                exact.append(p)
            elif stem(p) in by_base:
                moved.append((p, by_base[stem(p)][0]))
            else:
                missing.append(p)
        else:                                    # basename only (tree listing)
            if stem(p) in by_base:
                exact.append(p)
            else:
                missing.append(p)
    named = {stem(p) for p in planned}
    unplanned = sorted(a for a in actual if stem(a) not in named)
    return exact, moved, missing, unplanned


def fidelity(rdir):
    # The plan as written: plan.md on disk when it is a real plan, else the chat reply.
    # Not the union -- one run wrote plan.md with one set of module names and then
    # printed a summary with different ones, and built the summary.
    _, src, dlen, clen = plan_audit.plan_text(rdir)
    ws = os.path.join(rdir, 'ws')
    disk = ''
    for dp, dn, fn in os.walk(ws):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git')]
        for f in fn:
            if f.lower() == 'plan.md':
                t = plan_audit.load(os.path.join(dp, f))
                if len(t) > len(disk):
                    disk = t
    chat = ''
    try:
        chat = json.load(open(os.path.join(rdir, 'p2.json'), encoding='utf-8')).get('reply') or ''
    except Exception:
        pass
    # whichever version names the architecture (mtp run 2 wrote a 6 KB stub to disk and
    # put the module list in the reply); ties go to the file on disk
    pd, pc = planned_paths(disk) if disk else set(), planned_paths(chat) if chat else set()
    text, src = (disk, 'disk') if len(pd) >= len(pc) else (chat, 'chat')
    actual = actual_paths(ws)
    if not text:
        return {'source': 'none', 'actual': len(actual)}
    planned = planned_paths(text)
    # collapse basename-only entries that duplicate a full path
    full_bases = {os.path.basename(p) for p in planned if '/' in p}
    planned = {p for p in planned if '/' in p or p not in full_bases}
    exact, moved, missing, unplanned = match(planned, actual)
    audit = {}
    try:
        audit = json.load(open(os.path.join(rdir, 'audit.json'), encoding='utf-8'))
    except Exception:
        pass
    sig = audit.get('signals') or {}
    vfx_code = {k: bool(sig.get(k)) for k in ('camera shake', 'particle bursts', 'hit-stop', 'motion trails', 'shockwave rings', 'floating score text')}
    pa = plan_audit.audit(rdir)
    vfx_plan = {k: bool(v) for k, v in (pa.get('vfx') or {}).items()}
    return {
        'source': src, 'planned': len(planned), 'built_exact': len(exact), 'built_moved': len(moved),
        'missing': missing, 'unplanned': unplanned, 'actual': len(actual),
        'fidelity': round((len(exact) + len(moved)) / len(planned), 2) if planned else None,
        'vfx_planned': sum(vfx_plan.values()), 'vfx_in_code': sum(vfx_code.values()),
        'vfx_dropped': [k for k in vfx_plan if vfx_plan[k] and not vfx_code.get(k.replace('floating score', 'floating score text'), vfx_code.get(k, False))],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('roots', nargs='+'); ap.add_argument('--md', action='store_true'); ap.add_argument('--json')
    a = ap.parse_args()
    rows = []
    for root in a.roots:
        for mdir in sorted(glob.glob(os.path.join(root, '*'))):
            if not os.path.isdir(mdir) or os.path.basename(mdir).startswith(('_', '.', 'notes', 'prompts')):
                continue
            for rdir in sorted(glob.glob(os.path.join(mdir, 'run*'))):
                if 'contaminated' in rdir or not os.path.isdir(os.path.join(rdir, 'ws')):
                    continue
                r = fidelity(rdir); r['model'] = os.path.basename(mdir); r['run'] = os.path.basename(rdir); rows.append(r)
    if a.json:
        json.dump(rows, open(a.json, 'w', encoding='utf-8'), indent=1)
    if a.md:
        print('| Model | Run | Planned files | Built | Moved | Missing | Unplanned | On disk | Fidelity | VFX planned→code |')
        print('|---|:-:|---:|---:|---:|---:|---:|---:|:-:|:-:|')
        for r in rows:
            if r.get('source') == 'none' or r.get('planned') is None:
                print('| `%s` | %s | — | | | | | %d | | |' % (r['model'], r['run'][3:], r.get('actual', 0))); continue
            print('| `%s` | %s | %d | %d | %d | %d | %d | %d | %s | %d→%d |' % (
                r['model'], r['run'][3:], r['planned'], r['built_exact'], r['built_moved'], len(r['missing']),
                len(r['unplanned']), r['actual'], '' if r['fidelity'] is None else '%.0f%%' % (100 * r['fidelity']),
                r['vfx_planned'], r['vfx_in_code']))


if __name__ == '__main__':
    main()
