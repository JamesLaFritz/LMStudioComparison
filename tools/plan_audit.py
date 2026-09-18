#!/usr/bin/env python
"""plan_audit.py -- what each STEP 2 plan actually contains, checked against the directive.

    python plan_audit.py <results-root> [<results-root> ...] [--md] [--json out.json]

For every <model>/run*/ under each root, the plan is the union of `plan.md` on disk
(anywhere under ws/, node_modules excluded) and the p2 chat reply (`p2.json`) --
models put it in either or both. Every check is a stated pattern; the report is
evidence, not judgement. Axis 1 has been scored on size alone; this is the content.

The directive (prompt-v2/p1.txt) says the plan MUST contain five sections and the
build must honour a list of constraints. Checks, in that order:

  SECTIONS   core gameplay math · 15-20 modern enhancements (counted) · graphics
             pipeline (post stack config + procedural math) · VFX priority logic ·
             file architecture with import paths
  MECHANICS  formation march · collision · bunkers · UFO · waves · win state (wave-clear counts) ·
             terminal win (campaign end) · loss state
  VFX (6)    camera shake (trauma) · particle bursts · hit-stop · motion trails ·
             shockwave rings · floating score text
  PIPELINE   EffectComposer · UnrealBloomPass · bloom numbers (threshold/strength/radius)
  CONSTRAINTS MeshStandardMaterial · pooling · 500 cap · InstancedMesh · dispose() ·
             hand-written collision / no physics lib · Canvas textures · noise ·
             Web Audio · glassmorphism · neon · keyboard · gamepad · Vite · shared/ ·
             import/export contracts
  VERIFY     a verification plan (heading or playtest phrase) · browser tool named · unit tests named ·
             definition of done restated
  DEPTH      numeric constants (n) · formula lines (=, ×, /) · code fences · other games named
"""
import argparse, glob, json, os, re, sys

RX = lambda p: re.compile(p, re.I | re.M)

SECTIONS = {
    'core gameplay':     RX(r'^#{1,4}.*(core gameplay|mathematical|mechanics|gameplay model|simulation model)'),
    'enhancements':      RX(r'^#{1,4}.*((modern|aaa)[^\n]{0,40}(upgrade|enhancement)|enhancement|upgrades)'),
    'graphics pipeline': RX(r'^#{1,4}.*(graphics pipeline|render(ing)? pipeline|post-?process)'),
    'vfx':               RX(r'^#{1,4}.*(vfx|visual effects)'),
    'file architecture': RX(r'^#{1,4}.*(file architecture|module (map|list|graph)|import (map|graph|path)|directory|architecture)'),
}
MECH = {
    # the formation goes by many names: formation / fleet / swarm / grid / horde ...
    'formation march':   RX(r'\b(march|cadence|step (timer|interval|rate|down)|(formation|fleet|swarm|grid|horde|armada|phalanx|(alien|invader|enemy) (block|rows|group|army))[^\n]{0,80}\b(speed|step|move|advance|descend|drop|accelerat))'),
    'collision':         RX(r'\b(aabb|collision|hit ?test|intersect|overlap test|bounding)'),
    'bunkers':           RX(r'\b(bunker|shield|barrier)s?\b'),
    'ufo':               RX(r'\b(ufo|mystery ship|saucer)'),
    'waves':             RX(r'\bwave(s)?\b'),
    # a wave-clear counts as the directive's "win state"; a campaign end is stricter
    'win state':         RX(r'\b(victory|win (state|condition|screen)|you win|campaign (complete|cleared)|all waves (cleared|complete)|final wave|wave[ _-]?(clear|complete)|\*\*win\b|win:|all (55 )?(aliens|invaders) (destroyed|dead|killed|cleared))'),
    'terminal win':      RX(r'\b(victory|you win|campaign (complete|cleared|end)|all waves (cleared|complete)|final wave|win (the game|screen)|beat the game)'),
    'loss state':        RX(r'\b(game ?over|loss (state|condition)|lose (state|condition)|invasion|invaded|last life|lives? (reach|hit)s? (0|zero)|\*\*los[se]|loss:|lose:)'),
}
VFX = {
    'camera shake':      RX(r'\b(camera ?shake|trauma)'),
    'particle bursts':   RX(r'\b(particle (burst|manager|system)|spark|explosion)'),
    'hit-stop':          RX(r'\b(hit-?stop|frame-?freeze|time ?scale dilation|timescale)'),
    'motion trails':     RX(r'\b(motion ?trail|trail renderer|trails?\b)'),
    'shockwave rings':   RX(r'\b(shock ?wave|ring wave|expanding ring)'),
    'floating score':    RX(r'\b(floating (score|text)|score (pop-?up|text)|damage number)'),
}
PIPE = {
    'EffectComposer':    RX(r'\bEffectComposer\b'),
    'UnrealBloomPass':   RX(r'\bUnrealBloomPass\b'),
    'bloom numbers':     RX(r'bloom[^\n]{0,80}(threshold|strength|radius)[^\n]{0,40}\d|(threshold|strength|radius)[^\n]{0,40}\d[^\n]{0,80}bloom'),
}
CONS = {
    'MeshStandardMaterial': RX(r'\bMeshStandardMaterial\b'),
    'object pooling':    RX(r'\bpool(ing|ed|s)?\b'),
    '500 cap':           RX(r'\b500\b[^\n]{0,60}particle|particle[^\n]{0,60}\b500\b'),
    'InstancedMesh':     RX(r'\bInstancedMesh\b'),
    'dispose()':         RX(r'\.dispose\b|\bdispos(e|al)\b'),
    'no physics lib':    RX(r'hand-?written|no (external )?physics|without (a )?physics|cannon|rapier|ammo'),
    'Canvas textures':   RX(r'\bcanvas ?(texture|api|2d)|CanvasTexture'),
    'noise':             RX(r'\b(simplex|perlin|fbm|noise|sine wave)'),
    'Web Audio':         RX(r'\b(web ?audio|AudioContext|oscillator|synth)'),
    'glassmorphism':     RX(r'\bglass(morph)'),
    'neon':              RX(r'\bneon\b'),
    'keyboard':          RX(r'\b(keyboard|wasd|arrow keys?)'),
    'gamepad':           RX(r'\bgamepad'),
    'Vite':              RX(r'\bvite\b'),
    'shared/':           RX(r'\bshared/'),
    'import contracts':  RX(r'import[^\n]{0,60}(resolve|export)|export[^\n]{0,60}import|contract|interface'),
}
VERIFY = {
    # A verification PLAN, not the word "test": a heading about testing / verification /
    # a checklist / definition of done, or an explicit play-it-yourself phrase. "Swept
    # test" and "slab test" are collision math and were polluting the first version.
    'verification plan':     RX(r'^#{1,4}[^\n]*(test|verif|checklist|acceptance|definition of done|qa\b|validation)'
                                r'|\b(playtest|smoke test|npm (run )?test|run the game|open (it |the game )?in (a |the )?browser|headless|verify (that|the game|it (plays|runs|works)))'),
    'browser tool named':    RX(r'\b(playwright|puppeteer|headless|chromium|cdp\b|browser (test|automation))'),
    'unit tests named':      RX(r'\b(vitest|jest|mocha|node:test|node --test|unit test)'),
    'definition of done':    RX(r'definition of done|done when|acceptance criteria|exit criteria'),
}
OTHER_GAMES = RX(r'\b(pong|snake|breakout|tetris|pac-?man|asteroids|frogger|centipede|galaga|defender|donkey[_ ]kong|paperboy|tmnt)\b')
NUMBER = re.compile(r'(?<![\w.])\d+(?:\.\d+)?(?![\w.])')
FORMULA = re.compile(r'^[^\n]*[=×*/][^\n]*\d', re.M)
FENCE = re.compile(r'^```', re.M)
ENUM_ITEM = re.compile(r'^\s*(?:\d+[.)]|[-*•])\s+\S', re.M)


def load(p):
    try:
        return open(p, encoding='utf-8', errors='replace').read()
    except OSError:
        return ''


def plan_text(rdir):
    disk = ''
    for dp, dn, fn in os.walk(os.path.join(rdir, 'ws')):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git')]
        for f in fn:
            if f.lower() == 'plan.md':
                t = load(os.path.join(dp, f))
                if len(t) > len(disk):
                    disk = t
    chat = ''
    try:
        chat = json.load(open(os.path.join(rdir, 'p2.json'), encoding='utf-8')).get('reply') or ''
    except Exception:
        pass
    src = 'disk+chat' if disk and len(chat) > 2000 else 'disk' if disk else 'chat' if chat else 'none'
    return (disk + '\n\n' + chat).strip(), src, len(disk), len(chat)


def section_body(text, rx, nxt_rx=RX(r'^#{1,3} ')):
    m = rx.search(text)
    if not m:
        return ''
    start = m.end()
    n = nxt_rx.search(text, start)
    return text[start:n.start() if n else len(text)]


def count_enhancements(text):
    body = section_body(text, SECTIONS['enhancements'], RX(r'^#{1,2} '))
    if not body:
        return 0
    # numbered items win; otherwise bullets; otherwise table rows
    # top-level items only: numbered at column 0, `### 3.` sub-headings, or numbered
    # table rows. Indented sub-bullets are detail, not additional enhancements.
    nums = re.findall(r'^(?:#{3,4}\s+)?(\d+)[.)]\s+\S', body, re.M)
    if nums:
        return len(set(nums))
    rows = re.findall(r'^\|\s*(\d+)\s*\|', body, re.M)
    if rows:
        return len(set(rows))
    return len(re.findall(r'^[-*•]\s+\*{0,2}\S', body, re.M))


def audit(rdir):
    text, src, dlen, clen = plan_text(rdir)
    if not text:
        return {'source': 'none'}
    hit = lambda rx: len(rx.findall(text))
    r = {
        'source': src, 'chars_disk': dlen, 'chars_chat': clen, 'chars': len(text),
        'sections': {k: bool(rx.search(text)) for k, rx in SECTIONS.items()},
        'enhancements_n': count_enhancements(text),
        'mechanics': {k: hit(rx) for k, rx in MECH.items()},
        'vfx': {k: hit(rx) for k, rx in VFX.items()},
        'pipeline': {k: hit(rx) for k, rx in PIPE.items()},
        'constraints': {k: hit(rx) for k, rx in CONS.items()},
        'verify': {k: hit(rx) for k, rx in VERIFY.items()},
        'numbers': len(NUMBER.findall(text)),
        'formula_lines': len(FORMULA.findall(text)),
        'code_fences': len(FENCE.findall(text)) // 2,
        'other_games_named': len(set(g.lower() for g in OTHER_GAMES.findall(text))),
    }
    r['sections_n'] = sum(r['sections'].values())
    r['mechanics_n'] = sum(1 for v in r['mechanics'].values() if v)
    r['vfx_n'] = sum(1 for v in r['vfx'].values() if v)
    r['constraints_n'] = sum(1 for v in r['constraints'].values() if v)
    r['pipeline_n'] = sum(1 for v in r['pipeline'].values() if v)
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('roots', nargs='+')
    ap.add_argument('--md', action='store_true')
    ap.add_argument('--json')
    a = ap.parse_args()
    rows = []
    for root in a.roots:
        for mdir in sorted(glob.glob(os.path.join(root, '*'))):
            if not os.path.isdir(mdir) or os.path.basename(mdir).startswith(('_', '.', 'notes', 'prompts')):
                continue
            for rdir in sorted(glob.glob(os.path.join(mdir, 'run*'))):
                if 'contaminated' in rdir or not os.path.isdir(os.path.join(rdir, 'ws')):
                    continue
                r = audit(rdir)
                r['model'] = os.path.basename(mdir)
                r['run'] = os.path.basename(rdir)
                rows.append(r)
    if a.json:
        json.dump(rows, open(a.json, 'w', encoding='utf-8'), indent=1)
    if not a.md:
        for r in rows:
            print(r['model'], r['run'], r.get('source'), r.get('sections_n'), r.get('enhancements_n'), r.get('vfx_n'), r.get('constraints_n'), r.get('verify'))
        return
    P = print
    P('| Model | Run | Plan source | Chars | Sections /5 | Enh. # | Mech /8 | Win | Term. win | Loss | VFX /6 | Pipe /3 | Constr /16 | Verif. plan | Browser tool | Unit tests | DoD | Numbers | Formula lines |')
    P('|---|:-:|:-:|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---:|---:|')
    for r in rows:
        if r.get('source') == 'none':
            P('| `%s` | %s | none | | | | | | | | | | | | | | | |' % (r['model'], r['run']))
            continue
        m = r['mechanics']; v = r['verify']
        P('| `%s` | %s | %s | %s | %d | %d | %d | %s | %s | %s | %d | %d | %d | %d | %s | %s | %s | %d | %d |' % (
            r['model'], r['run'][3:], r['source'], format(r['chars'], ','), r['sections_n'], r['enhancements_n'],
            r['mechanics_n'], 'y' if m['win state'] else '—', 'y' if m['terminal win'] else '—', 'y' if m['loss state'] else '—',
            r['vfx_n'], r['pipeline_n'], r['constraints_n'], v['verification plan'],
            'y' if v['browser tool named'] else '—', 'y' if v['unit tests named'] else '—',
            'y' if v['definition of done'] else '—', r['numbers'], r['formula_lines']))


if __name__ == '__main__':
    main()
