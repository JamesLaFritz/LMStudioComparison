/**
 * Verdict collection and emission.
 *
 * Three values, never two. PASS and FAIL are claims about the build;
 * INCONCLUSIVE is a claim about the *run* — the harness could not put the build
 * in a position to be judged (the probe was absent, the scenario never set up,
 * the tab went hidden). Collapsing INCONCLUSIVE into either of the others is
 * how a gate starts lying, so it gets its own value and it never counts as a
 * pass.
 */

import fs from 'node:fs';
import path from 'node:path';

export const PASS = 'PASS';
export const FAIL = 'FAIL';
export const INCONCLUSIVE = 'INCONCLUSIVE';
export const SKIP = 'SKIP';

export class Report {
  /**
   * @param {object} meta
   * @param {object} [opts]
   * @param {boolean} [opts.quiet]
   * @param {boolean} [opts.complete=true] false when the run was shortened,
   *   filtered, or deliberately broken. A run like that can report FAIL — a red
   *   is still a red — but it can never report PASS, because the verbs it did
   *   not execute are not evidence of anything.
   */
  constructor(meta, { quiet = false, complete = true } = {}) {
    this.meta = meta;
    this.quiet = quiet;
    this.complete = complete;
    /** @type {Array<object>} */
    this.verbs = [];
  }

  /**
   * Record one verb result.
   *
   * @param {object} r
   * @param {string} r.id            stable verb id, matches gate.md
   * @param {string} r.verb          the thing a player can cause to happen
   * @param {string} r.group         hub | core | vfx | integrity
   * @param {boolean} [r.required]   does a FAIL block the gate (default true)
   * @param {string} r.input         the real input that triggered it
   * @param {string} r.observable    what was measured
   * @param {string} r.threshold     the pass threshold, as written in gate.md
   * @param {string} r.verdict       PASS | FAIL | INCONCLUSIVE | SKIP
   * @param {object} [r.measured]    the numbers
   * @param {string} [r.note]
   * @param {string[]} [r.evidence]  relative paths to captured frames
   */
  add(r) {
    const rec = {
      required: true,
      measured: {},
      evidence: [],
      ...r,
      at: new Date().toISOString()
    };
    this.verbs.push(rec);
    const mark =
      rec.verdict === PASS ? 'PASS' : rec.verdict === FAIL ? 'FAIL' : rec.verdict;
    if (!this.quiet) process.stdout.write(
      `  ${mark.padEnd(12)} ${rec.id.padEnd(8)} ${rec.verb}` +
        (rec.note ? `\n               ↳ ${rec.note}` : '') +
        '\n'
    );
    return rec;
  }

  get counts() {
    const c = { PASS: 0, FAIL: 0, INCONCLUSIVE: 0, SKIP: 0 };
    for (const v of this.verbs) c[v.verdict] = (c[v.verdict] || 0) + 1;
    return c;
  }

  /** The gate passes only if the run was complete and every required verb passed. */
  get gateVerdict() {
    const blocking = this.verbs.filter((v) => v.required);
    if (blocking.some((v) => v.verdict === FAIL)) return FAIL;
    if (blocking.some((v) => v.verdict === INCONCLUSIVE || v.verdict === SKIP)) {
      return INCONCLUSIVE;
    }
    if (!this.complete) return INCONCLUSIVE;
    return blocking.length ? PASS : INCONCLUSIVE;
  }

  write(outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const json = {
      gate: this.gateVerdict,
      counts: this.counts,
      meta: this.meta,
      verbs: this.verbs
    };
    fs.writeFileSync(
      path.join(outDir, 'report.json'),
      JSON.stringify(json, null, 2)
    );
    fs.writeFileSync(path.join(outDir, 'report.md'), this.markdown());
    return json;
  }

  markdown() {
    const c = this.counts;
    const lines = [];
    lines.push('# Playability gate — run report');
    lines.push('');
    lines.push(`**Gate verdict: ${this.gateVerdict}**`);
    if (!this.complete) {
      lines.push('');
      lines.push(
        '> This run was shortened, filtered or fault-injected. It can report a ' +
          'red, but it cannot report a pass: the verbs it did not execute are ' +
          'not evidence.'
      );
    }
    lines.push('');
    lines.push(
      `${c.PASS} pass · ${c.FAIL} fail · ${c.INCONCLUSIVE} inconclusive · ${c.SKIP} skipped`
    );
    lines.push('');
    for (const [k, v] of Object.entries(this.meta)) {
      lines.push(`- **${k}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
    lines.push('');

    for (const group of ['integrity', 'hub', 'core', 'vfx']) {
      const rows = this.verbs.filter((v) => v.group === group);
      if (!rows.length) continue;
      lines.push(`## ${group}`);
      lines.push('');
      lines.push('| id | verb | input | observable | threshold | verdict | measured |');
      lines.push('|---|---|---|---|---|---|---|');
      for (const r of rows) {
        lines.push(
          `| ${r.id} | ${r.verb} | ${r.input} | ${r.observable} | ${r.threshold} | **${r.verdict}** | ${md(r.measured)} |`
        );
      }
      lines.push('');
      for (const r of rows.filter((x) => x.note)) {
        lines.push(`- \`${r.id}\` — ${r.note}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }
}

function md(obj) {
  if (!obj || typeof obj !== 'object') return String(obj ?? '');
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${fmt(v)}`)
    .join(', ')
    .replace(/\|/g, '\\|');
}

function fmt(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    return Math.abs(v) >= 100 || Number.isInteger(v) ? String(v) : v.toFixed(4);
  }
  if (Array.isArray(v)) return `[${v.map(fmt).join(' ')}]`;
  return String(v);
}
