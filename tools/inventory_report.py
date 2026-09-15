#!/usr/bin/env python3
"""inventory_report.py — turn an inventory sweep into a readable table.

Every model loaded with NO parameters, so each row is what that model's own
LM Studio configuration actually does: the context it takes, the VRAM it needs
there, and the throughput it gets. A load that succeeds can still be offloading;
only tok/s shows that, which is why it is measured rather than assumed.

Usage:  python inventory_report.py <sweep dir> [--md]
"""
import json, sys, os

d = sys.argv[1]
as_md = '--md' in sys.argv
rows = json.load(open(os.path.join(d, 'results.json'), encoding='utf-8'))
CARD = 24564          # RTX 4090, MiB

ok = [r for r in rows if r.get('load') == 'ok']
failed = [r for r in rows if r.get('load') != 'ok']

# Throughput is the only offload detector, but it is family-relative: a dense
# 27B is honestly slower than a 3B-active MoE. Flag on the absolute floor that
# separated a spilling model from a resident one in every measurement so far.
OFFLOAD_TPS = 20
TIGHT_MIB = 1200

for r in ok:
    free = CARD - r.get('vram_mib', 0)
    r['free_mib'] = free
    flags = []
    if r.get('tps', 0) and r['tps'] < OFFLOAD_TPS:
        flags.append('SLOW')
    if free < TIGHT_MIB:
        flags.append('TIGHT')
    if (r.get('context_length') or 0) < 32768:
        flags.append('SMALL-CTX')
    r['flags'] = flags

ok.sort(key=lambda r: -(r.get('tps') or 0))

if as_md:
    print('| Model | ctx | VRAM MiB | free | tok/s | par | spec | flags |')
    print('|---|---:|---:|---:|---:|---:|:-:|---|')
    for r in ok:
        spec = 'MTP' if r.get('spec_mtp') else ('draft' if r.get('spec_draft_model') else '—')
        print('| `%s` | %s | %s | %s | %s | %s | %s | %s |' % (
            r['model'], f"{r.get('context_length') or 0:,}", f"{r.get('vram_mib',0):,}",
            f"{r['free_mib']:,}", r.get('tps', '—'), r.get('parallel', '—'),
            spec, ' '.join(r['flags']) or ''))
    for r in failed:
        print('| `%s` | — | — | — | — | — | — | **LOAD FAILED** |' % r['model'])
else:
    print('%-56s %9s %8s %7s %7s %4s %5s  %s' %
          ('MODEL', 'CTX', 'VRAM', 'FREE', 'TOK/S', 'PAR', 'SPEC', 'FLAGS'))
    print('-' * 118)
    for r in ok:
        spec = 'MTP' if r.get('spec_mtp') else ('drft' if r.get('spec_draft_model') else '-')
        print('%-56s %9s %8s %7s %7s %4s %5s  %s' % (
            r['model'][:56], f"{r.get('context_length') or 0:,}", f"{r.get('vram_mib',0):,}",
            f"{r['free_mib']:,}", r.get('tps', '-'), r.get('parallel', '-'),
            spec, ' '.join(r['flags'])))
    for r in failed:
        print('%-56s  LOAD FAILED' % r['model'][:56])

    print()
    print('models measured : %d ok, %d failed to load' % (len(ok), len(failed)))
    print('SLOW      : under %d tok/s — the offload signature' % OFFLOAD_TPS)
    print('TIGHT     : under %d MiB free on a %s MiB card' % (TIGHT_MIB, f'{CARD:,}'))
    print('SMALL-CTX : configured context under 32,768 — too small for this benchmark')
    print()
    ctxs = {}
    for r in ok:
        ctxs.setdefault(r.get('context_length'), []).append(r['model'])
    print('CONFIGURED CONTEXTS')
    for c, ms in sorted(ctxs.items(), key=lambda kv: -(kv[0] or 0)):
        print('  %-9s %2d model(s)' % (f'{c:,}' if c else '?', len(ms)))
    print()
    clean = [r for r in ok if not r['flags']]
    print('USABLE FOR THE BENCHMARK (no flags): %d of %d' % (len(clean), len(rows)))
