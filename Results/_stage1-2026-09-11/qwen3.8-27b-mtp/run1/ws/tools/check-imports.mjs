// tools/check-imports.mjs — verifies every local named import resolves to a real export.
// Run: node tools/check-imports.mjs   (from workspace root)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'tools') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})(ROOT);

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const names = m[1].split(',').map((s) => s.trim().split(' as ')[0]).filter(Boolean);
    if (m[2] === 'three' || m[2].startsWith('three/')) continue; // package — verified separately
    const target = path.resolve(path.dirname(f), m[2]);
    if (!fs.existsSync(target)) { console.log(`MISSING FILE: ${f} -> ${m[2]}`); bad++; continue; }
    const tsrc = fs.readFileSync(target, 'utf8');
    for (const n of names) {
      const decl = new RegExp('export\\s+(?:class|function|const|let|var)\\s+' + n + '\\b').test(tsrc);
      const list = new RegExp('export\\s*\\{[^}]*\\b' + n + '\\b').test(tsrc);
      if (!decl && !list) { console.log(`BAD IMPORT: ${f}: "${n}" not exported by ${m[2]}`); bad++; }
    }
  }
}
console.log(bad === 0 ? 'ALL NAMED LOCAL IMPORTS RESOLVE' : `${bad} problems`);
