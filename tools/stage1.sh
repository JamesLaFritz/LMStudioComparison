#!/usr/bin/env bash
# stage1.sh — the contest. All three prompts, n = 3 per model, seeds 1/2/3.
#
# Built from stage0.sh (load with NO parameters, absolute paths, drain-until-idle,
# recorded session responses) and run.sh (continue-on-bail). One load per model;
# its three runs go back-to-back so the weights are paid for once.
#
# Unattended for days. Anything that fails is recorded and the sweep moves on.
# Progress is in $OUT/stage1.log; each run's evidence is in $OUT/<model>/run<n>/.
set -u

OUT="$1"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && { pwd -W 2>/dev/null || pwd; })"
API=http://localhost:4517/api
DASH_SESSIONS="C:/Data/Tools/ember-dashboard/.sessions"
SEEDS="1 2 3"
P3_TIMEOUT=14400          # 4 h; the longest observed p3 was 2 h 39 m
DRAIN_MAX=360             # 10 s polls -> 1 h to let a runaway finish server-side

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$OUT/stage1.log"; }
vram() { nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | head -1; }

busy_sessions() {
  curl -s "$API/agent/sessions" 2>/dev/null \
    | python -c "import sys,json;print(sum(1 for s in json.load(sys.stdin)['sessions'] if s.get('busy')))" 2>/dev/null \
    || echo 0
}

drain() {                  # wait for every session to go idle
  local i
  for i in $(seq 1 "$DRAIN_MAX"); do
    [ "$(busy_sessions)" = "0" ] && return 0
    sleep 10
  done
  log "  WARNING: sessions still busy after drain window"
  return 1
}

send() {                   # send <session> <prompt-file> <out-file> <timeout-s>
  python -c "
import json,sys
print(json.dumps({'text': open(sys.argv[1], encoding='utf-8').read()}))" "$2" > "$OUT/.body.json"
  curl -s --max-time "$4" -X POST "$API/agent/$1/message" \
    -H 'Content-Type: application/json' --data-binary "@$OUT/.body.json" > "$3" 2>/dev/null
}

# Continue only on bails that mean "cut off mid-output" -- reasoning overrun or an
# empty turn. NOT on max_hops: that bail means the model spent its whole hop
# budget, and a continue hands it another 500. Bonsai run 2 was continued five
# times and reached 3,002 hops and 152M prompt tokens -- a runner-manufactured
# runaway, not a model result. Hop exhaustion is a verdict; record it and stop.
bailed() {
  grep -qE 'Stopped after [0-9]+ turns? that' "$1" 2>/dev/null
}

printf 'continue' > "$OUT/continue.txt"

# The dashboard hung 15 hours into the first attempt. The runner then recorded
# "SESSION FAILED" for all thirty remaining runs in six minutes and declared the
# stage complete. A dead dashboard is not a per-run failure to record and move
# past; it is a stop-the-world condition. Wait for it, and if it does not come
# back, halt with the roster intact so a relaunch resumes cleanly.
dashboard_up() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$API/agent/sessions" 2>/dev/null | grep -q '^200$'; }
require_dashboard() {
  local i
  dashboard_up && return 0
  log "  DASHBOARD DOWN - waiting for it to return"
  for i in $(seq 1 720); do          # 10 s polls -> 2 h
    sleep 10
    if dashboard_up; then log "  dashboard back after $((i*10))s"; return 0; fi
  done
  log "  DASHBOARD STILL DOWN after 2h - halting so the roster is not burned"
  touch "$OUT/HALTED"
  exit 2
}

while IFS= read -r MODEL || [ -n "$MODEL" ]; do
  MODEL=$(printf '%s' "$MODEL" | tr -d '\015')
  [ -z "$MODEL" ] && continue
  SLUG=$(echo "$MODEL" | tr '/@:' '___' | cut -c1-60)
  MDIR="$OUT/$SLUG"; mkdir -p "$MDIR"
  # Do not pay for a load if every run of this model is already complete.
  DONE_RUNS=0
  for SEED in $SEEDS; do
    [ -f "$MDIR/run$SEED/run.json" ] && python -c "
import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if (d.get('turns') or 0) >= 3 else 1)" "$MDIR/run$SEED/run.json" 2>/dev/null && DONE_RUNS=$((DONE_RUNS+1))
  done
  if [ "$DONE_RUNS" = "3" ]; then
    log "=============== $MODEL - all 3 runs complete, skipping"
    continue
  fi
  log "=============== $MODEL"
  require_dashboard

  drain
  timeout 180 lms unload --all >/dev/null 2>&1
  sleep 3
  IDLE=$(vram)
  if ! timeout 900 lms load "$MODEL" -y >/dev/null 2>&1; then
    log "  LOAD FAILED"
    echo '{"model":"'"$MODEL"'","load":"FAILED"}' > "$MDIR/model.json"
    continue
  fi
  LOADED=$(vram)
  CTX=$(curl -s http://localhost:1234/api/v1/models 2>/dev/null | python -c "
import sys,json
try:
    d=json.load(sys.stdin); ms=d.get('data') or d.get('models') or []
    print(next((i[0].get('config',{}).get('context_length') for m in ms for i in [m.get('loaded_instances') or []] if i), '?'))
except Exception: print('?')" 2>/dev/null)
  log "  loaded: ${LOADED} MiB (idle ${IDLE}), ctx ${CTX}"
  echo '{"model":"'"$MODEL"'","load":"ok","vram_mib":'"$LOADED"',"idle_mib":'"$IDLE"',"ctx":"'"$CTX"'"}' > "$MDIR/model.json"

  for SEED in $SEEDS; do
    RDIR="$MDIR/run$SEED"; mkdir -p "$RDIR/ws"

    # Resume: a run is complete when p1, p2 and p3 all produced a turn. The run
    # the dashboard took down mid-p3 sits at turns=2 and is redone; the five that
    # finished are kept. A relaunch therefore costs nothing already paid for.
    if [ -f "$RDIR/run.json" ] && python -c "
import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if (d.get('turns') or 0) >= 3 else 1)" "$RDIR/run.json" 2>/dev/null; then
      log "  --- run $SEED already complete, skipping"
      continue
    fi
    if [ -f "$RDIR/run.json" ]; then
      log "  --- run $SEED incomplete on disk (turns < 3) - redoing"
      rm -rf "$RDIR"; mkdir -p "$RDIR/ws"
    fi
    require_dashboard
    log "  --- run $SEED (seed $SEED)"

    curl -s -X POST "$API/workspaces" -H 'Content-Type: application/json' \
      -d "{\"path\":\"$RDIR/ws\"}" >/dev/null 2>&1
    curl -s -X POST "$API/agent/session" -H 'Content-Type: application/json' \
      -d "{\"model\":\"$MODEL\",\"workspace\":\"$RDIR/ws\",\"preset\":\"coding-agent\",\"mode\":\"auto\",\"identity\":false,\"seed\":$SEED}" \
      > "$RDIR/session_response.json" 2>&1
    SID=$(python -c "import sys,json;print(json.load(open(sys.argv[1])).get('session',''))" "$RDIR/session_response.json" 2>/dev/null)
    if [ -z "$SID" ]; then
      if [ ! -s "$RDIR/session_response.json" ]; then
        # No body at all means the request never reached the dashboard. That is
        # not this run failing; treat it as the outage it is.
        log "    no response from dashboard - re-checking health"
        require_dashboard
        rm -rf "$RDIR"; mkdir -p "$RDIR/ws"
        # retry this seed once the dashboard is back
        curl -s -X POST "$API/workspaces" -H 'Content-Type: application/json' -d "{\"path\":\"$RDIR/ws\"}" >/dev/null 2>&1
        curl -s -X POST "$API/agent/session" -H 'Content-Type: application/json' \
          -d "{\"model\":\"$MODEL\",\"workspace\":\"$RDIR/ws\",\"preset\":\"coding-agent\",\"mode\":\"auto\",\"identity\":false,\"seed\":$SEED}" \
          > "$RDIR/session_response.json" 2>&1
        SID=$(python -c "import sys,json;print(json.load(open(sys.argv[1])).get('session',''))" "$RDIR/session_response.json" 2>/dev/null)
      fi
      if [ -z "$SID" ]; then
        log "    SESSION FAILED: $(head -c 160 "$RDIR/session_response.json")"
        continue
      fi
    fi
    echo "$SID" > "$RDIR/session.id"

    T0=$(date +%s)
    send "$SID" "$OUT/p1.txt" "$RDIR/p1.json" 2700;  T1=$(date +%s)
    send "$SID" "$OUT/p2.txt" "$RDIR/p2.json" 3600;  T2=$(date +%s)
    send "$SID" "$OUT/p3.txt" "$RDIR/p3.json" "$P3_TIMEOUT"; T3=$(date +%s)
    log "    p1 $((T1-T0))s · p2 $((T2-T1))s · p3 $((T3-T2))s"

    # The frozen v1 run needed one continue. Allow five so a bail is never what
    # ends a run; a model that still fails after that failed on merit.
    LAST="$RDIR/p3.json"; N=0
    for i in 1 2 3 4 5; do
      bailed "$LAST" || break
      log "    bail detected -> continue $i"
      send "$SID" "$OUT/continue.txt" "$RDIR/c$i.json" "$P3_TIMEOUT"
      LAST="$RDIR/c$i.json"; N=$i
    done
    T4=$(date +%s)

    drain
    # Reap what the model left running. Every model that tested its game started
    # a vite server and nothing ended it -- twenty were found alive after the
    # first full sweep, holding workspaces open and, plausibly, the dashboard
    # down at hour fifteen. Kill anything whose command line lives in this run's
    # workspace; the run is over and it has no further business.
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*$SLUG*run$SEED*' -and \$_.Name -ne 'bash.exe' } | ForEach-Object { try { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }" >/dev/null 2>&1
    cp "$DASH_SESSIONS/$SID.json" "$RDIR/session.json" 2>/dev/null
    # deterministic evidence while the tree is fresh
    PYTHONIOENCODING=utf-8 python "$(dirname "$0")/audit.py" "$RDIR/ws" --session "$RDIR/session.json" \
      > "$RDIR/audit.txt" 2>&1
    PYTHONIOENCODING=utf-8 python "$(dirname "$0")/audit.py" "$RDIR/ws" --session "$RDIR/session.json" --json \
      > "$RDIR/audit.json" 2>/dev/null
    python - "$RDIR" "$MODEL" "$SEED" "$SID" "$((T1-T0))" "$((T2-T1))" "$((T3-T2))" "$N" "$((T4-T0))" <<'PY'
import json, os, sys
d, model, seed, sid, p1, p2, p3, cont, total = sys.argv[1:10]
rec = {"model": model, "seed": int(seed), "session": sid,
       "p1_seconds": int(p1), "p2_seconds": int(p2), "p3_seconds": int(p3),
       "continues": int(cont), "total_seconds": int(total)}
try:
    s = json.load(open(os.path.join(d, 'session.json'), encoding='utf-8'))
    h = s.get('history', [])
    rec["turns"] = (s.get('stats') or {}).get('turns')
    rec["tokens_in"] = (s.get('stats') or {}).get('in')
    rec["tokens_out"] = (s.get('stats') or {}).get('out')
    rec["bails"] = [e.get('reason') for e in h if e.get('kind') == 'bail']
    rec["compactions"] = sum(1 for e in h if e.get('kind') == 'compacted')
    rec["max_reasoning"] = s.get('maxReasoningTokens')
    rec["seed_recorded"] = s.get('seed')
except Exception as e:
    rec["session_error"] = str(e)[:120]
files = 0
for dp, dn, fn in os.walk(os.path.join(d, 'ws')):
    dn[:] = [x for x in dn if x not in ('node_modules', 'dist', '.git')]
    files += len(fn)
rec["files"] = files
json.dump(rec, open(os.path.join(d, 'run.json'), 'w'), indent=1)
print("    done: %s turns, %s files, %s continue(s), bails=%s, %dm" % (
    rec.get('turns'), files, cont, rec.get('bails'), int(total) // 60))
PY
  done
done < "$OUT/roster.txt"

drain
timeout 180 lms unload --all >/dev/null 2>&1
rm -f "$OUT/.body.json"
log "STAGE 1 COMPLETE"
touch "$OUT/DONE"
