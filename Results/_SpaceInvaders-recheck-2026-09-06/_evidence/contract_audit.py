"""Static contract audit: for every `Klass.method(...)` call where Klass is a
class imported from a local module, check the class actually defines `method`.

Catches exactly the failure this build keeps hitting -- a module written in
isolation calling an interface on a sibling that the sibling never grew.
"""
import os, re, sys

ROOT = sys.argv[1].replace('\\', '/')

files = []
for dp, dn, fn in os.walk(ROOT):
    if 'node_modules' in dp or '/dist' in dp.replace('\\', '/'):
        continue
    for f in fn:
        if f.endswith('.js'):
            files.append(os.path.join(dp, f).replace('\\', '/'))

CLASS_RE = re.compile(r'^\s*export\s+class\s+(\w+)([\s\S]*?)(?=^\s*export\s|\Z)', re.M)
STATIC_RE = re.compile(r'^\s*static\s+(?:get\s+|set\s+|async\s+)?(\w+)\s*[({=]', re.M)
INST_RE = re.compile(r'^\s{2,}(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z_]\w*)\s*\(', re.M)
IMPORT_RE = re.compile(r"import\s+\{([^}]*)\}\s+from\s+['\"](\.[^'\"]+)['\"]")

# class name -> (static members, instance members)
classes = {}
for f in files:
    src = open(f, encoding='utf-8').read()
    for m in CLASS_RE.finditer(src):
        name, body = m.group(1), m.group(2)
        statics = set(STATIC_RE.findall(body))
        insts = set(INST_RE.findall(body)) - {'if', 'for', 'while', 'switch', 'catch', 'return'}
        fields = set(re.findall(r'^\s*static\s+(\w+)\s*=', body, re.M))
        classes[name] = (statics | fields, insts)

problems = []
for f in files:
    src = open(f, encoding='utf-8').read()
    imported = set()
    for m in IMPORT_RE.finditer(src):
        for p in m.group(1).split(','):
            p = p.strip().split(' as ')[-1].strip()
            if p:
                imported.add(p)
    for name in sorted(imported & set(classes)):
        statics, insts = classes[name]
        for cm in re.finditer(re.escape(name) + r'\.(\w+)\s*\(', src):
            meth = cm.group(1)
            if meth in statics or meth in insts:
                continue
            line = src[:cm.start()].count('\n') + 1
            problems.append((f.replace(ROOT + '/', ''), line, name, meth))

print('classes indexed:', len(classes))
print('broken static calls:', len(problems))
for f, line, k, m in problems:
    print('  %-46s :%-4s %s.%s()' % (f, line, k, m))
