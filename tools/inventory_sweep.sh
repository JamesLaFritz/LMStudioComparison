#!/usr/bin/env bash
# inventory_sweep.sh — load every installed model with NO parameters and record
# what LM Studio's own per-model configuration actually does.
#
# Deliberately passes no -c, no --gpu, no --parallel: the point is to measure the
# configuration James has set up per model, not to impose one. A model that
# defaults to a context it cannot hold shows up here as offload, which is the
# whole reason for measuring throughput rather than trusting a successful load.
#
# Records per model: VRAM used, loaded context length, tok/s, load seconds.
set -u

OUT="$1"
mkdir -p "$OUT"
LOG="$OUT/sweep.log"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
vram() { nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | head -1; }

log "sweep start — $(wc -l < "$OUT/models.txt") models, no load parameters"
echo '[]' > "$OUT/results.json"

while IFS= read -r MODEL || [ -n "$MODEL" ]; do
  MODEL=$(printf '%s' "$MODEL" | tr -d '\015')
  [ -z "$MODEL" ] && continue

  timeout 180 lms unload --all >/dev/null 2>&1
  sleep 3
  IDLE=$(vram)

  T0=$(date +%s)
  if ! timeout 900 lms load "$MODEL" -y >/dev/null 2>&1; then
    T1=$(date +%s)
    log "  LOAD FAILED   $MODEL  ($((T1-T0))s)"
    python - "$OUT" "$MODEL" <<'PY'
import json,sys
o,m=sys.argv[1],sys.argv[2]
p=o+'/results.json'; d=json.load(open(p))
d.append({"model":m,"load":"FAILED"})
json.dump(d,open(p,'w'),indent=1)
PY
    continue
  fi
  T1=$(date +%s)
  LOADED=$(vram)

  # Context length and tok/s both come from the server: the loaded instance knows
  # what context it actually got, which is not always what the config asked for.
  python - "$OUT" "$MODEL" "$IDLE" "$LOADED" "$((T1-T0))" <<'PY'
import json, sys, time, urllib.request

out, model, idle, loaded, load_s = sys.argv[1:6]
rec = {"model": model, "load": "ok", "idle_mib": int(idle or 0),
       "vram_mib": int(loaded or 0), "load_seconds": int(load_s)}
rec["vram_delta_mib"] = rec["vram_mib"] - rec["idle_mib"]

def get(url, timeout=60):
    return json.load(urllib.request.urlopen(url, timeout=timeout))

# loaded context length, straight from the instance
try:
    d = get("http://localhost:1234/api/v1/models")
    ms = d.get("data") or d.get("models") or []
    for m in ms:
        insts = m.get("loaded_instances") or []
        if insts and (m.get("key") == model or m.get("id") == model or model in str(insts)):
            cfg = (insts[0] or {}).get("config") or {}
            rec["context_length"] = cfg.get("context_length")
            rec["max_context_length"] = m.get("max_context_length")
            # Both are per-model settings James configured, and both move VRAM:
            # parallel multiplies the KV cache, a draft model adds weights.
            rec["parallel"] = cfg.get("parallel")
            rec["spec_mtp"] = cfg.get("speculative_draft_mtp")
            rec["spec_draft_model"] = cfg.get("speculative_draft_model") or None
            rec["flash_attention"] = cfg.get("flash_attention")
            break
except Exception as e:
    rec["context_error"] = str(e)[:80]

# Throughput must be SUSTAINED. A 200-token probe is dominated by
# time-to-first-token and understates decode by roughly 2x (bonsai read 48.1 on
# 200 tokens and 80-83 on 1,200), which both compresses differences between
# models and inflates any offload threshold set against it.
try:
    body = {"model": model,
            "messages": [{"role": "user", "content":
                "Write a plain list of the numbers 1 to 400, comma separated, on one line. Output nothing else."}],
            "max_tokens": 1200, "temperature": 0}
    req = urllib.request.Request("http://localhost:1234/v1/chat/completions",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    t = time.time()
    r = json.load(urllib.request.urlopen(req, timeout=900))
    dt = time.time() - t
    n = (r.get("usage") or {}).get("completion_tokens") or 0
    rec["tps"] = round(n / dt, 1) if dt > 0 else 0
    rec["gen_tokens"] = n
except Exception as e:
    rec["tps"] = 0
    rec["gen_error"] = str(e)[:100]

p = out + '/results.json'
d = json.load(open(p))
d.append(rec)
json.dump(d, open(p, 'w'), indent=1)
print("  %-56s %6s MiB  ctx %-8s %6s tok/s  (%ss load)" % (
    model[:56], rec["vram_mib"], rec.get("context_length", "?"), rec["tps"], rec["load_seconds"]))
PY
  tail -1 "$OUT/results.json" >/dev/null
  log "$(python -c "
import json;d=json.load(open(r'$OUT/results.json'))[-1]
print('  %-52s %6s MiB  ctx %-8s %6s tok/s' % (d['model'][:52], d.get('vram_mib','?'), d.get('context_length','?'), d.get('tps','?')))" 2>/dev/null)"

done < "$OUT/models.txt"

timeout 180 lms unload --all >/dev/null 2>&1
log "SWEEP COMPLETE"
touch "$OUT/DONE"
