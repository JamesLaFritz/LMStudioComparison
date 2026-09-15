#!/usr/bin/env bash
# Stage 0 — protocol screen. p1 + p2 only, n = 1, every roster model.
#
# Scores axes 1 (Plan Diligence) and 9 (Protocol Compliance) and nothing else.
# p3 is ~2.5h of a ~2.7h run, so this pays ~10 minutes per model to find out who
# can follow the workflow before committing to the expensive half. See N-DESIGN.md.
#
# Unattended by design: a model that will not load, or a turn that overruns, is
# recorded and the sweep moves on. Never let one bad model end the sweep.
set -u

OUT="$1"                     # results directory
API=http://localhost:4517/api
mkdir -p "$OUT"
# Absolute, always. The workspace allowlist stores what it is handed and the
# session check compares literally, so a relative OUT registers a path that can
# never match, and every session dies with "not in the configured allowlist".
OUT="$(cd "$OUT" && { pwd -W 2>/dev/null || pwd; })"   # Windows form: the API needs C:/... not /c/...

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$OUT/stage0.log"; }

vram() { nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | head -1; }

# A load that succeeds can still be offloading to CPU, and only throughput shows
# it. 200 tokens is enough to separate 16 tok/s from 100.
probe_tps() {
  local model="$1"
  python - "$model" <<'PY' 2>/dev/null || echo "0"
import json,sys,time,urllib.request
b={"model":sys.argv[1],"messages":[{"role":"user","content":"Count from 1 to 60, comma separated."}],
   "max_tokens":200,"temperature":0}
r=urllib.request.Request("http://localhost:1234/v1/chat/completions",
    data=json.dumps(b).encode(),headers={"Content-Type":"application/json"})
t=time.time()
d=json.load(urllib.request.urlopen(r,timeout=600))
dt=time.time()-t
n=(d.get("usage") or {}).get("completion_tokens") or 0
print("%.1f" % (n/dt if dt>0 else 0))
PY
}

send() {                      # send <session> <prompt-file> <out-file> <timeout-s>
  python -c "
import json,sys
print(json.dumps({'text': open(sys.argv[1], encoding='utf-8').read()}))" "$2" > "$OUT/.body.json"
  curl -s --max-time "$4" -X POST "$API/agent/$1/message" \
    -H 'Content-Type: application/json' --data-binary "@$OUT/.body.json" > "$3" 2>/dev/null
}

# `|| [ -n "$MODEL" ]` catches a final line with no terminator; the tr strips a
# carriage return from a roster written by anything defaulting to CRLF on
# Windows. Both failed silently once: every model key carried a trailing CR, so
# every load failed in under a second, and the last model was skipped entirely.
while IFS= read -r MODEL || [ -n "$MODEL" ]; do
  MODEL=$(printf '%s' "$MODEL" | tr -d '\015')   # strip CR
  [ -z "$MODEL" ] && continue
  SLUG=$(echo "$MODEL" | tr '/@:' '___' | cut -c1-60)
  DIR="$OUT/$SLUG"; mkdir -p "$DIR/ws"
  log "=== $MODEL"

  timeout 180 lms unload --all >/dev/null 2>&1
  sleep 3
  BASE=$(vram)

  # NO load parameters. Forcing `-c ... --gpu max --parallel 1` was itself the
  # bug in the 2026-08-23 sweep: --gpu max pushes every layer onto the card
  # whether or not it fits beside the KV cache, and five models were excluded
  # from the roster for thrash the measurement was causing. Each model carries
  # its own LM Studio configuration; record it, do not impose one.
  if ! timeout 900 lms load "$MODEL" -y >/dev/null 2>&1; then
    log "  LOAD FAILED"
    echo '{"model":"'"$MODEL"'","load":"FAILED"}' > "$DIR/result.json"
    continue
  fi
  LOADED=$(vram)
  CTX=$(curl -s http://localhost:1234/api/v1/models 2>/dev/null | python -c "
import sys,json
try:
    d=json.load(sys.stdin); ms=d.get('data') or d.get('models') or []
    print(next((i[0].get('config',{}).get('context_length') for m in ms for i in [m.get('loaded_instances') or []] if i), '?'))
except Exception: print('?')" 2>/dev/null)
  TPS=$(probe_tps "$MODEL")
  log "  loaded: ${LOADED} MiB used (idle ${BASE}), ctx ${CTX}, ${TPS} tok/s"

  # A session is bound to a workspace; each model gets its own empty one.
  curl -s -X POST "$API/workspaces" -H 'Content-Type: application/json' \
    -d "{\"path\":\"$DIR/ws\"}" >/dev/null 2>&1
  # Keep the raw response. A swallowed body turned a one-line diagnosis into a
  # re-run; if this fails again the reason is on disk instead of lost.
  curl -s -X POST "$API/agent/session" -H 'Content-Type: application/json' \
    -d "{\"model\":\"$MODEL\",\"workspace\":\"$DIR/ws\",\"preset\":\"coding-agent\",\"mode\":\"auto\",\"identity\":false}" \
    > "$DIR/session_response.json" 2>&1
  SID=$(python -c "import sys,json;print(json.load(open(sys.argv[1])).get('session',''))" "$DIR/session_response.json" 2>/dev/null)
  if [ -z "$SID" ]; then
    log "  SESSION FAILED: $(head -c 200 "$DIR/session_response.json")"
    echo '{"model":"'"$MODEL"'","load":"ok","session":"FAILED","vram":'"$LOADED"',"tps":'"$TPS"'}' > "$DIR/result.json"
    continue
  fi

  T0=$(date +%s)
  send "$SID" "$OUT/p1.txt" "$DIR/p1.json" 2700
  T1=$(date +%s)
  send "$SID" "$OUT/p2.txt" "$DIR/p2.json" 3600
  T2=$(date +%s)
  log "  p1 $((T1-T0))s · p2 $((T2-T1))s"

  # A curl timeout does not stop the turn -- the workbench keeps generating
  # server-side. Wait for the session to go idle before touching the model, or
  # the next `lms unload` pulls the weights out from under a live generation.
  for _ in $(seq 1 60); do
    BUSY=$(curl -s "$API/agent/sessions" 2>/dev/null       | python -c "import sys,json;print(sum(1 for s in json.load(sys.stdin)['sessions'] if s.get('busy')))" 2>/dev/null)
    [ "${BUSY:-0}" = "0" ] && break
    sleep 10
  done
  [ "${BUSY:-0}" != "0" ] && log "  WARNING: session still busy after 10m drain wait"

  cp "C:/Data/Tools/ember-dashboard/.sessions/$SID.json" "$DIR/session.json" 2>/dev/null
  python - "$DIR" "$MODEL" "$SID" "$LOADED" "$TPS" "$((T1-T0))" "$((T2-T1))" <<'PY'
import json, os, sys
d, model, sid, vram, tps, t1, t2 = sys.argv[1:8]
res = {"model": model, "session": sid, "load": "ok",
       "vram_mib": int(vram or 0), "tps": float(tps or 0),
       "p1_seconds": int(t1), "p2_seconds": int(t2)}
try:
    s = json.load(open(os.path.join(d, 'session.json'), encoding='utf-8'))
    h = s.get('history', [])
    u = [i for i, e in enumerate(h) if e.get('kind') == 'user']
    end = u[1] if len(u) > 1 else len(h)
    res["step1_writes"] = sum(1 for e in h[:end] if e.get('kind') == 'tool' and e.get('tool') in ('write_file', 'edit_file'))
    res["step1_commands"] = sum(1 for e in h[:end] if e.get('kind') == 'tool' and e.get('tool') == 'run_command')
    res["turns"] = (s.get('stats') or {}).get('turns')
    res["bails"] = [e.get('reason') for e in h if e.get('kind') == 'bail']
    res["max_reasoning"] = s.get('maxReasoningTokens')
except Exception as e:
    res["session_error"] = str(e)[:120]
# plan.md is the STEP 2 deliverable; its size is the first read on axis 1
plan = None
for dp, dn, fn in os.walk(os.path.join(d, 'ws')):
    for f in fn:
        if f.lower() == 'plan.md':
            plan = os.path.join(dp, f)
res["plan_bytes"] = os.path.getsize(plan) if plan else 0
res["plan_path"] = os.path.relpath(plan, d).replace('\\', '/') if plan else None
res["files_after_p2"] = sum(len(fn) for _, _, fn in os.walk(os.path.join(d, 'ws')))
json.dump(res, open(os.path.join(d, 'result.json'), 'w'), indent=1)
print("  writes=%s cmds=%s plan=%sB files=%s" %
      (res.get('step1_writes'), res.get('step1_commands'), res['plan_bytes'], res['files_after_p2']))
PY

done < "$OUT/roster.txt"

timeout 180 lms unload --all >/dev/null 2>&1
rm -f "$OUT/.body.json"
log "STAGE 0 COMPLETE"
touch "$OUT/DONE"
