import os, re, sys, json

ROOT = sys.argv[1]

files = []
for dp, dn, fn in os.walk(ROOT):
    if 'node_modules' in dp or 'dist' in dp:
        continue
    for f in fn:
        if f.endswith('.js'):
            files.append(os.path.join(dp, f).replace('\\', '/'))

EXPORT_RE = re.compile(
    r'^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))',
    re.M)
EXPORT_LIST_RE = re.compile(r'^\s*export\s*\{([^}]*)\}', re.M)
IMPORT_RE = re.compile(r"import\s+(?:\*\s+as\s+\w+|\{([^}]*)\}|(\w+))\s+from\s+['\"]([^'\"]+)['\"]", re.M)

exports = {}
for f in files:
    src = open(f, encoding='utf-8').read()
    names = set()
    for m in EXPORT_RE.finditer(src):
        names.add(next(g for g in m.groups() if g))
    for m in EXPORT_LIST_RE.finditer(src):
        for part in m.group(1).split(','):
            part = part.strip()
            if not part:
                continue
            names.add(part.split(' as ')[-1].strip())
    if re.search(r'^\s*export\s+default\b', src, re.M):
        names.add('default')
    exports[f] = names

problems = []
for f in files:
    src = open(f, encoding='utf-8').read()
    base = os.path.dirname(f)
    for m in IMPORT_RE.finditer(src):
        named, dflt, spec = m.group(1), m.group(2), m.group(3)
        if not spec.startswith('.'):
            continue                      # bare package, resolved by node
        target = os.path.normpath(os.path.join(base, spec)).replace('\\', '/')
        if target not in exports:
            for ext in ('.js', '/index.js'):
                if target + ext in exports:
                    target = target + ext
                    break
        line = src[:m.start()].count('\n') + 1
        if target not in exports:
            problems.append((f, line, spec, 'MISSING FILE', ''))
            continue
        wanted = []
        if named:
            wanted = [p.strip().split(' as ')[0].strip() for p in named.split(',') if p.strip()]
        if dflt:
            wanted = ['default']
        for w in wanted:
            if w not in exports[target]:
                problems.append((f, line, os.path.basename(target), 'MISSING EXPORT', w))

rel = lambda p: p.replace(ROOT + '/', '')
print('files scanned:', len(files))
print('broken imports:', len(problems))
seen = set()
for f, line, spec, kind, name in problems:
    print('%-46s :%-4s %-15s %s %s' % (rel(f), line, kind, name, '<- ' + spec))
    seen.add(rel(f))
print('\nfiles affected:', len(seen))
