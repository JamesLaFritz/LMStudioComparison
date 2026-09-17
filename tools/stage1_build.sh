#!/usr/bin/env bash
# stage1_build.sh — install and build every Stage 1 run that has enough source
# to be worth it. Writes build.json per run: {installed, built, seconds, error}.
#
# `npm ci` when a lockfile exists, `npm install` otherwise -- the model chose
# the manifest and is scored on it. Build output is kept in build.log.
set -u
ROOT="$1"
MIN_SRC=10

for MDIR in "$ROOT"/*/; do
  M=$(basename "$MDIR"); [ "${M#_}" != "$M" ] && continue
  for R in run1 run2 run3; do
    WS="$MDIR$R/ws"; [ -d "$WS" ] || continue
    # Only finished runs. A run is finished when its session has been recorded
    # (the runner or codex_session.py writes session.json). Without this guard
    # the pass walked into a Claude run that was still in progress and rebuilt
    # its dist/ under it (2026-09-16).
    [ -f "$MDIR$R/session.json" ] || continue
    SRC=$(find "$WS" -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.ts' \) -not -path '*/node_modules/*' -not -path '*/dist/*' | wc -l)
    OUT="$MDIR$R/build.json"
    if [ "$SRC" -lt "$MIN_SRC" ]; then
      printf '{"src":%d,"skipped":"under %d source files"}\n' "$SRC" "$MIN_SRC" > "$OUT"; continue
    fi
    [ -f "$WS/package.json" ] || { printf '{"src":%d,"installed":false,"built":false,"error":"no package.json"}\n' "$SRC" > "$OUT"; continue; }
    printf '%-40s %-5s src=%-3s ' "$M" "$R" "$SRC"
    T0=$(date +%s)
    ( cd "$WS" && rm -rf dist
      if [ -d node_modules ]; then INST=true
      elif [ -f package-lock.json ]; then npm ci --no-audit --no-fund >/dev/null 2>&1 && INST=true || INST=false
      else npm install --no-audit --no-fund >/dev/null 2>&1 && INST=true || INST=false; fi
      if [ "$INST" = true ] && npx vite build > build.log 2>&1; then BUILT=true; ERR=""
      else BUILT=false; ERR=$(grep -m1 -iE 'error|failed|cannot|not found' build.log 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | tr -d '\000-\037' | head -c 160 | sed 's/"/\\"/g'); fi
      T1=$(date +%s)
      printf '{"src":%d,"installed":%s,"built":%s,"seconds":%d,"error":"%s"}\n' "$SRC" "$INST" "$BUILT" "$((T1-T0))" "$ERR" > "$OUT"
      echo "installed=$INST built=$BUILT ($((T1-T0))s) $ERR"
    ) 2>/dev/null || { echo "subshell failed"; printf '{"src":%d,"installed":false,"built":false,"error":"subshell failed"}\n' "$SRC" > "$OUT"; }
  done
done
echo BUILD PASS COMPLETE
