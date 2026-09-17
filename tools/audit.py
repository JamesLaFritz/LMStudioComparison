#!/usr/bin/env python3
"""audit.py — deterministic evidence for the benchmark rubric.

The prompt states a dozen constraints in checkable terms: no physics libraries,
no external asset files, MeshStandardMaterial only, object pooling, a 500-particle
cap, explicit .dispose(), EffectComposer + UnrealBloomPass, six named VFX systems,
dual input, glassmorphism, procedural audio and textures. Scoring those by eye is
slow and drifts between models; this reads them off the tree the same way every
time.

It reports EVIDENCE, not scores. Axes 1, 6 and 7 need judgement and are only
partly served here — the script says what it found, you decide what it is worth.

Usage:
    python audit.py <workspace> [--session path/to/session.json] [--json]

    <workspace>  the directory the model built in
    --session    a workbench session JSON, which adds axis 8 and axis 9 evidence
    --json       machine-readable output instead of the report
"""

import argparse
import json
import os
import re
import sys

# --------------------------------------------------------------------------
# file collection
# --------------------------------------------------------------------------

SKIP_DIRS = {'node_modules', 'dist', '.git', '.vite', 'build', 'coverage'}
CODE_EXT = {'.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx'}
ASSET_EXT = {'.gltf', '.glb', '.fbx', '.obj', '.png', '.jpg', '.jpeg', '.gif',
             '.webp', '.bmp', '.tga', '.mp3', '.wav', '.ogg', '.m4a', '.hdr', '.exr'}


def collect(root):
    """Every file under root, minus dependency and build output directories."""
    code, assets, other = [], [], []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            p = os.path.join(dp, f).replace('\\', '/')
            ext = os.path.splitext(f)[1].lower()
            if ext in CODE_EXT:
                code.append(p)
            elif ext in ASSET_EXT:
                assets.append(p)
            else:
                other.append(p)
    return code, assets, other


def read(p):
    try:
        return open(p, encoding='utf-8', errors='replace').read()
    except OSError:
        return ''


# --------------------------------------------------------------------------
# axis 2 — code completeness: placeholders, imports, cross-module contracts
# --------------------------------------------------------------------------

PLACEHOLDER = re.compile(
    r'//\s*\.{3}\s*(rest of|insert|previously defined|remaining|etc)'
    r'|/\*\s*\.{3}\s*(rest|insert|remaining)'
    r'|\bTODO\b\s*:?\s*implement'
    r'|\bunimplemented\b'
    r'|throw new Error\([\'"]not implemented',
    re.I)

EXPORT_RE = re.compile(
    r'^\s*export\s+(?:default\s+)?(?:async\s+)?'
    r'(?:function\s*\*?\s*(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))', re.M)
EXPORT_LIST_RE = re.compile(r'^\s*export\s*\{([^}]*)\}', re.M)
IMPORT_RE = re.compile(
    r"import\s+(?:\*\s+as\s+\w+|\{([^}]*)\}|(\w+))\s+from\s+['\"]([^'\"]+)['\"]", re.M)
CLASS_RE = re.compile(r'^\s*export\s+class\s+(\w+)([\s\S]*?)(?=^\s*export\s|\Z)', re.M)
STATIC_RE = re.compile(r'^\s*static\s+(?:get\s+|set\s+|async\s+)?(\w+)\s*[({=]', re.M)
INST_RE = re.compile(r'^\s{2,}(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z_]\w*)\s*\(', re.M)
NOT_METHODS = {'if', 'for', 'while', 'switch', 'catch', 'return', 'constructor'}


def exports_of(src):
    names = set()
    for m in EXPORT_RE.finditer(src):
        names.add(next(g for g in m.groups() if g))
    for m in EXPORT_LIST_RE.finditer(src):
        for part in m.group(1).split(','):
            part = part.strip()
            if part:
                names.add(part.split(' as ')[-1].strip())
    if re.search(r'^\s*export\s+default\b', src, re.M):
        names.add('default')
    return names


def check_completeness(code, texts):
    placeholders, broken_imports, broken_calls = [], [], []

    for p in code:
        for m in PLACEHOLDER.finditer(texts[p]):
            line = texts[p][:m.start()].count('\n') + 1
            placeholders.append((p, line, m.group(0)[:60].strip()))

    exports = {p: exports_of(texts[p]) for p in code}

    # imports resolve to real exports
    for p in code:
        base = os.path.dirname(p)
        for m in IMPORT_RE.finditer(texts[p]):
            named, dflt, spec = m.group(1), m.group(2), m.group(3)
            if not spec.startswith('.'):
                continue                       # bare package, resolved by node
            target = os.path.normpath(os.path.join(base, spec)).replace('\\', '/')
            if target not in exports:
                for ext in ('.js', '.mjs', '.ts', '/index.js'):
                    if target + ext in exports:
                        target += ext
                        break
            line = texts[p][:m.start()].count('\n') + 1
            if target not in exports:
                broken_imports.append((p, line, spec, 'MISSING FILE', ''))
                continue
            wanted = ['default'] if dflt else (
                [x.strip().split(' as ')[0].strip() for x in named.split(',') if x.strip()]
                if named else [])
            for w in wanted:
                if w not in exports[target]:
                    broken_imports.append(
                        (p, line, os.path.basename(target), 'MISSING EXPORT', w))

    # methods called on imported classes actually exist
    classes = {}
    for p in code:
        for m in CLASS_RE.finditer(texts[p]):
            name, body = m.group(1), m.group(2)
            statics = set(STATIC_RE.findall(body)) | set(
                re.findall(r'^\s*static\s+(\w+)\s*=', body, re.M))
            insts = set(INST_RE.findall(body)) - NOT_METHODS
            classes[name] = (statics, insts)

    for p in code:
        src = texts[p]
        imported = set()
        for m in re.finditer(r"import\s+\{([^}]*)\}\s+from\s+['\"](\.[^'\"]+)['\"]", src):
            for x in m.group(1).split(','):
                x = x.strip().split(' as ')[-1].strip()
                if x:
                    imported.add(x)
        for name in sorted(imported & set(classes)):
            statics, insts = classes[name]
            for cm in re.finditer(re.escape(name) + r'\.(\w+)\s*\(', src):
                meth = cm.group(1)
                if meth in statics or meth in insts:
                    continue
                line = src[:cm.start()].count('\n') + 1
                broken_calls.append((p, line, name, meth))

    return placeholders, broken_imports, broken_calls


# --------------------------------------------------------------------------
# hard constraints — each is a flat yes/no the prompt actually states
# --------------------------------------------------------------------------

PHYSICS_LIBS = re.compile(
    r"from\s+['\"](cannon(-es)?|ammo(\.js)?|@dimforge/rapier[\w-]*|matter-js|p2|planck-js|box2d[\w-]*)['\"]", re.I)
LOADERS = re.compile(r'\b(GLTFLoader|FBXLoader|OBJLoader|TextureLoader|CubeTextureLoader|AudioLoader|RGBELoader)\b')
NON_STANDARD_MAT = re.compile(r'\bnew\s+THREE\.(MeshBasicMaterial|MeshPhongMaterial|MeshLambertMaterial|MeshToonMaterial)\b')

SIGNALS = {
    # axis 3 — post-processing
    'EffectComposer':      re.compile(r'\bEffectComposer\b'),
    'UnrealBloomPass':     re.compile(r'\bUnrealBloomPass\b'),
    # axis 4 — the six mandatory VFX systems
    'camera shake':        re.compile(r'\b(camerashake|shaketrauma|trauma)\b', re.I),
    'particle bursts':     re.compile(r'\b(particlemanager|particlesystem|emitburst|spawnburst|burst)\b', re.I),
    'hit-stop':            re.compile(r'\b(hitstop|hit_stop|freezeframe|timescale|timedilation)\b', re.I),
    'motion trails':       re.compile(r'\b(motiontrail|trailrenderer|\btrail\b)', re.I),
    'shockwave rings':     re.compile(r'\b(shockwave|shock_wave|ringwave)', re.I),   # ShockwavePool, ShockwaveManager
    # No trailing \b: `FloatingScoreManager` is the common class name and the
    # boundary after `floatingscore` never matches it (missed on the Sol run).
    'floating score text': re.compile(r'\b(floatingtext|scorepopup|floatingscore|damagetext|scorefloat|score-float|scoretext)', re.I),
    # axis 5 — resource discipline
    'object pooling':      re.compile(r'\b(objectpool|entitypool|\bPool\b|acquire\(|release\()', re.I),
    'InstancedMesh':       re.compile(r'\bInstancedMesh\b'),
    # axis 6 — procedural generation
    'CanvasTexture':       re.compile(r'\bCanvasTexture\b|getContext\([\'"]2d'),
    'Web Audio':           re.compile(r'\b(AudioContext|OscillatorNode|createOscillator|createGain)\b'),
    'procedural noise':    re.compile(r'\b(simplex|perlin|noise2D|noise3D|fbm)\b', re.I),
    # stack + input
    'Gamepad API':         re.compile(r'\bgetGamepads\b|\bgamepadconnected\b'),
    'keyboard input':      re.compile(r"['\"]Arrow(Left|Right|Up|Down)['\"]|\bKeyW\b|\bKeyA\b"),
}

# axis 7 — glassmorphism lives in CSS/HTML, so it is searched across all text files
CSS_SIGNALS = {
    'glassmorphism (backdrop-filter)': re.compile(r'backdrop-filter'),
    'neon glow (text/box-shadow)':     re.compile(r'(text|box)-shadow'),
}


def find_signals(code, texts, patterns):
    """{label: [(file, line), ...]} for the first hit of each pattern per file."""
    found = {}
    for label, rx in patterns.items():
        hits = []
        for p in code:
            m = rx.search(texts[p])
            if m:
                hits.append((p, texts[p][:m.start()].count('\n') + 1))
        found[label] = hits
    return found


def particle_cap(code, texts):
    """The prompt mandates a hard 500-particle cap. Find a declared ceiling."""
    # MAX_ACTIVE_PARTICLES / PARTICLE_BUDGET / maxActiveParticles are as common
    # as MAX_PARTICLES; the first form was missed on the Sol run.
    rx = re.compile(r'(MAX_?(?:ACTIVE_?|LIVE_?)?PARTICLES?|PARTICLE_?(?:CAP|BUDGET|LIMIT)'
                    r'|max(?:Active|Live)?Particles|particle(?:Cap|Budget|Limit|Capacity|_capacity))\s*[:=]\s*(\d+)', re.I)
    # A cap can also live in a config table: `pools: { …, particles: 500 }` — a
    # `particles:` key within a few lines of a pools/limits/caps/budget key.
    rx_table = re.compile(r'\b(pools?|limits?|caps?|budgets?|maxCounts?)\s*[:=]\s*(?:Object\.freeze\()?\{[^}]{0,400}?\b(particles?)\s*:\s*(\d+)', re.I)
    out = []
    for p in code:
        for m in rx_table.finditer(texts[p]):
            out.append((p, texts[p][:m.start()].count('\n') + 1, m.group(1) + '.' + m.group(2), int(m.group(3))))
        for m in rx.finditer(texts[p]):
            out.append((p, texts[p][:m.start()].count('\n') + 1, m.group(1), int(m.group(2))))
    return out


def dispose_balance(code, texts):
    """Explicit .dispose() against the allocations that need disposing."""
    disposes = allocs = 0
    for p in code:
        s = texts[p]
        disposes += len(re.findall(r'\.dispose\s*\(', s))
        # `new THREE.BoxGeometry(` and, with named imports, `new BoxGeometry(`
        allocs += len(re.findall(r'new\s+(?:THREE\.)?[A-Z]\w*(Geometry|Material|Texture)\s*\(', s))
    return disposes, allocs


# --------------------------------------------------------------------------
# axes 8 and 9 — read off a workbench session, not the tree
# --------------------------------------------------------------------------

VERIFY_PATTERNS = [
    ('ran a build',        re.compile(r'\b(npm|pnpm|yarn)\s+(run\s+)?build\b|\bvite\s+build\b')),
    ('installed deps',     re.compile(r'\b(npm|pnpm|yarn)\s+(install|i|ci)\b')),
    ('served the game',    re.compile(r'\bvite\s+(preview|dev)\b|\bserve\b|--port\b')),
    # Split deliberately: a run that only asked "is playwright installed?" and a
    # run that actually drove a page both matched one broad pattern, and the
    # single label read as if they had done the same thing.
    ('looked for browser tools', re.compile(r'\b(playwright|puppeteer|chromium)\b', re.I)),
    # Two idioms: driving Chrome over CDP / the Playwright library, and the
    # `playwright-cli` tool installed globally on this machine. The first pass
    # knew only the former and scored a run with 27 playwright-cli commands --
    # open, click, keydown Space, eval on the score -- as never having launched.
    ('LAUNCHED a browser',  re.compile(
        r'--remote-debugging-port'
        r'|\b(chromium|puppeteer|browserType|chrome)\.launch\b'
        r'|\bnewPage\s*\(|\bpage\.goto\s*\(|\bconnectOverCDP\b'
        r'|127\.0\.0\.1:9\d{3}/json|localhost:9\d{3}/json'
        r'|\bplaywright-cli\s+(open|goto|navigate)\b', re.I)),
    # Interaction separates looked from played: clicks and keys sent to the
    # running game, or its state read back out.
    ('INTERACTED with it',  re.compile(
        r'\bplaywright-cli\s+(click|press|keydown|keyup|type|fill|run-code|eval|snapshot)\b'
        r'|\bpage\.(click|keyboard|press|evaluate|fill)\b'
        r'|\bkeyboard\.(press|down|up)\b', re.I)),
    # Named on its own so it shows up in the report and the scorecard. On this
    # machine it is the browser tool every model had on PATH; two of twelve used it.
    ('used playwright-cli', re.compile(r'\bplaywright-cli\b', re.I)),
    ('wrote its own test', re.compile(r'\b(smoke|e2e|playtest|test)[\w.-]*\.(mjs|js|ts)\b', re.I)),
]


NPM_RUN_RX = re.compile(r'\b(?:npm|pnpm|yarn)\s+(?:run\s+(\S+)|(test)\b)')
PW_TEST_RX = re.compile(r'\bplaywright\s+test\b', re.I)
PAGE_ACT_RX = re.compile(r'\bpage\.(click|keyboard|press|evaluate|fill|goto)\b|\bkeyboard\.(press|down|up)\b')
TEST_FILE_RX = re.compile(r'(?:^|[\\/])[\w.-]*(?:spec|test|smoke|e2e|playtest)[\w.-]*\.(?:mjs|js|ts)\b', re.I)


def npm_scripts(ws):
    try:
        return json.load(open(os.path.join(ws, 'package.json'), encoding='utf-8')).get('scripts') or {}
    except Exception:
        return {}


def expand_scripts(cmd, scripts):
    """`npm run test:browser` -> the same string plus the script body, so the
    patterns see `playwright test` / `vite preview` behind an npm alias. The
    clean Sol run hid every browser launch behind `npm run test:browser`."""
    extra = []
    for m in NPM_RUN_RX.finditer(cmd):
        name = m.group(1) or m.group(2)
        body = scripts.get(name)
        if body:
            extra.append(body)
    return cmd + (' :: ' + ' ; '.join(extra) if extra else '')


def spec_interactions(ws):
    """page.* interactions in the workspace's own test files."""
    n = 0
    for dp, dn, fn in os.walk(ws):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git', 'test-results')]
        for f in fn:
            if TEST_FILE_RX.search(f):
                try:
                    n += len(PAGE_ACT_RX.findall(open(os.path.join(dp, f), encoding='utf-8', errors='replace').read()))
                except OSError:
                    pass
    return n


def audit_session(path, ws=None):
    """Verification behaviour (axis 8) and protocol compliance (axis 9)."""
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        return {'error': str(e)}

    hist = d.get('history', [])
    scripts = npm_scripts(ws) if ws else {}
    cmds = [expand_scripts(str(e.get('args', '')), scripts) for e in hist
            if e.get('kind') == 'tool' and e.get('tool') == 'run_command']
    # A harness with a native browser tool (Claude Code's Playwright MCP) records
    # `browser` entries whose args are already in the page.* idiom -- scanned by
    # the same patterns, not counted as shell commands.
    browser = [str(e.get('args', '')) for e in hist
               if e.get('kind') == 'tool' and e.get('tool') == 'browser']
    behaviour = {label: sum(1 for c in cmds + browser if rx.search(c)) for label, rx in VERIFY_PATTERNS}

    # The Playwright *library* is a browser too. A run that wrote a spec and ran
    # `playwright test` launched Chromium and drove the page from the spec file,
    # not from the command line, so the interactions live in the tree.
    pw_runs = sum(1 for c in cmds if PW_TEST_RX.search(c))
    if pw_runs and ws:
        behaviour['LAUNCHED a browser'] += pw_runs
        behaviour['INTERACTED with it'] += spec_interactions(ws) * pw_runs
    # Test files written through the write tool, not only named on a command line.
    behaviour['wrote its own test'] += sum(
        1 for e in hist if e.get('kind') == 'tool' and e.get('tool') == 'write_file'
        and TEST_FILE_RX.search(str(e.get('args', ''))))

    # Axis 9: STEP 1 forbids creating files before the first "Begin" prompt.
    # Everything up to the SECOND user turn belongs to STEP 1.
    user_idx = [i for i, e in enumerate(hist) if e.get('kind') == 'user']
    step1_end = user_idx[1] if len(user_idx) > 1 else len(hist)
    writes_in_step1 = [e.get('args', '') for e in hist[:step1_end]
                       if e.get('kind') == 'tool' and e.get('tool') in ('write_file', 'edit_file')]
    cmds_in_step1 = [e.get('args', '') for e in hist[:step1_end]
                     if e.get('kind') == 'tool' and e.get('tool') == 'run_command']

    return {
        'model': d.get('model'),
        'turns': d.get('stats', {}).get('turns'),
        'tool_calls': sum(1 for e in hist if e.get('kind') == 'tool'),
        'run_commands': len(cmds),
        'verification': behaviour,
        'step1_writes': writes_in_step1,
        'step1_commands': cmds_in_step1,
        'bails': [e.get('reason') for e in hist if e.get('kind') == 'bail'],
        'compactions': sum(1 for e in hist if e.get('kind') == 'compacted'),
    }


# --------------------------------------------------------------------------
# report
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('workspace')
    ap.add_argument('--session', help='workbench session JSON, for axes 8 and 9')
    ap.add_argument('--json', action='store_true', help='machine-readable output')
    args = ap.parse_args()

    root = os.path.normpath(args.workspace).replace(chr(92), '/').rstrip('/')   # a stray // once broke every import path
    if not os.path.isdir(root):
        sys.exit('not a directory: ' + root)

    code, assets, other = collect(root)
    texts = {p: read(p) for p in code}
    all_text = {p: read(p) for p in code + other
                if os.path.splitext(p)[1].lower() in CODE_EXT | {'.html', '.css'}}
    rel = lambda p: p[len(root) + 1:] if p.startswith(root) else p

    placeholders, broken_imports, broken_calls = check_completeness(code, texts)
    signals = find_signals(code, texts, SIGNALS)
    css = find_signals(list(all_text), all_text, CSS_SIGNALS)
    caps = particle_cap(code, texts)
    disposes, allocs = dispose_balance(code, texts)

    violations = []
    for p in code:
        for m in PHYSICS_LIBS.finditer(texts[p]):
            violations.append(('physics library', rel(p), m.group(1)))
        for m in LOADERS.finditer(texts[p]):
            violations.append(('asset loader', rel(p), m.group(1)))
    for a in assets:
        violations.append(('external asset file', rel(a), os.path.splitext(a)[1]))
    non_standard = [(rel(p), m.group(1)) for p in code
                    for m in NON_STANDARD_MAT.finditer(texts[p])]

    lines = sum(texts[p].count('\n') + 1 for p in code)
    session = audit_session(args.session, root) if args.session else None

    if args.json:
        print(json.dumps({
            'workspace': root, 'files': len(code), 'lines': lines,
            'placeholders': [(rel(p), l, t) for p, l, t in placeholders],
            'broken_imports': [(rel(p), l, s, k, n) for p, l, s, k, n in broken_imports],
            'broken_calls': [(rel(p), l, c, m) for p, l, c, m in broken_calls],
            'signals': {k: [(rel(p), l) for p, l in v] for k, v in signals.items()},
            'css': {k: [(rel(p), l) for p, l in v] for k, v in css.items()},
            'particle_caps': [(rel(p), l, n, v) for p, l, n, v in caps],
            'dispose_calls': disposes, 'three_allocations': allocs,
            'violations': violations, 'non_standard_materials': non_standard,
            'session': session,
        }, indent=1))
        return

    P = print
    P('=' * 74)
    P('AUDIT  ' + root)
    P('=' * 74)
    P('%d source files, %d lines, %d non-code files' % (len(code), lines, len(other)))
    P('')

    P('-- AXIS 2  Code Completeness ' + '-' * 44)
    P('  placeholder syntax       : %s' % ('%d FOUND' % len(placeholders) if placeholders else 'none'))
    for p, l, t in placeholders[:8]:
        P('      %s:%d  %s' % (rel(p), l, t))
    P('  imports resolving        : %s' % ('%d BROKEN' % len(broken_imports) if broken_imports else 'all resolve'))
    for p, l, s, k, n in broken_imports[:8]:
        P('      %s:%d  %s %s <- %s' % (rel(p), l, k, n, s))
    P('  cross-module contracts   : %s' % ('%d BROKEN' % len(broken_calls) if broken_calls else 'all resolve'))
    for p, l, c, m in broken_calls[:8]:
        P('      %s:%d  %s.%s()' % (rel(p), l, c, m))
    P('')

    P('-- HARD CONSTRAINTS  (the prompt states these flatly) ' + '-' * 20)
    if violations:
        for kind, where, what in violations[:12]:
            P('  VIOLATION  %-22s %s  (%s)' % (kind, where, what))
        if len(violations) > 12:
            P('  ... and %d more' % (len(violations) - 12))
    else:
        P('  no physics libraries, no asset loaders, no external asset files')
    if non_standard:
        P('  non-PBR materials        : %d use(s) -- prompt mandates MeshStandardMaterial' % len(non_standard))
        for where, what in non_standard[:5]:
            P('      %s  %s' % (where, what))
    else:
        P('  materials                : MeshStandardMaterial only')
    P('')

    def row(label, hits):
        P('  %-26s %s' % (label, ('yes  ' + rel(hits[0][0])) if hits else 'NOT FOUND'))

    P('-- AXIS 3  Post-processing ' + '-' * 46)
    for k in ('EffectComposer', 'UnrealBloomPass'):
        row(k, signals[k])
    P('')
    P('-- AXIS 4  VFX  (all six are mandatory) ' + '-' * 33)
    six = ['camera shake', 'particle bursts', 'hit-stop', 'motion trails',
           'shockwave rings', 'floating score text']
    for k in six:
        row(k, signals[k])
    P('  ---> %d of 6 present' % sum(1 for k in six if signals[k]))
    P('')
    P('-- AXIS 5  Resource Discipline ' + '-' * 42)
    row('object pooling', signals['object pooling'])
    row('InstancedMesh', signals['InstancedMesh'])
    if caps:
        for p, l, n, v in caps[:4]:
            flag = 'OK' if v <= 500 else 'OVER THE 500 CAP'
            P('  %-26s %s = %d  [%s]  %s:%d' % ('particle cap', n, v, flag, rel(p), l))
    else:
        P('  %-26s NO DECLARED CAP -- prompt mandates a hard 500 limit' % 'particle cap')
    P('  %-26s %d dispose() vs %d THREE allocations' % ('disposal', disposes, allocs))
    P('')
    P('-- AXIS 6  Procedural Fidelity  (evidence only; judge the quality) ' + '-' * 7)
    for k in ('CanvasTexture', 'Web Audio', 'procedural noise'):
        row(k, signals[k])
    P('')
    P('-- AXIS 7  Juice & UI  (evidence only) ' + '-' * 34)
    for k, v in css.items():
        row(k, v)
    P('')
    P('-- INPUT ' + '-' * 64)
    for k in ('keyboard input', 'Gamepad API'):
        row(k, signals[k])
    P('')

    if session:
        if 'error' in session:
            P('-- SESSION  unreadable: %s' % session['error'])
            return
        P('-- AXIS 8  Verification Behavior ' + '-' * 40)
        P('  %d turns, %d tool calls, %d run_command' %
          (session['turns'] or 0, session['tool_calls'], session['run_commands']))
        for label, n in session['verification'].items():
            P('  %-26s %s' % (label, ('%d time(s)' % n) if n else 'NEVER'))
        P('')
        P('-- AXIS 9  Protocol Compliance ' + '-' * 42)
        nw, nc = len(session['step1_writes']), len(session['step1_commands'])
        P('  STEP 1 forbids creating files and running commands before "Begin".')
        P('  %-26s %s' % ('files written in STEP 1', ('%d  VIOLATION' % nw) if nw else '0  compliant'))
        for w in session['step1_writes'][:5]:
            P('      %s' % str(w)[:70])
        P('  %-26s %s' % ('commands run in STEP 1', ('%d  VIOLATION' % nc) if nc else '0  compliant'))
        P('')
        P('-- HARNESS  (context for every axis above) ' + '-' * 30)
        P('  bails        : %s' % (', '.join(session['bails']) if session['bails'] else 'none'))
        P('  compactions  : %d' % session['compactions'])
    else:
        P('(no --session given: axes 8 and 9 not evaluated)')


if __name__ == '__main__':
    main()
