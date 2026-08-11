#!/usr/bin/env bash
# Measure real VRAM per model at a given context length by actually loading each
# one. Slow (~20s per model) but it is the only method that works — see below.
#
#   ./probe-context.sh 32768                 # all roster models at 32k
#   ./probe-context.sh 32768 fable-coder-35b-a3b   # one model
#
# WHY NOT --estimate-only: `lms load --estimate-only` reports the SAME figure at
# 4,096 and at 262,144 context (verified 2026-08-07, fable-coder: 20.22 GiB at
# both). It estimates weights plus fixed overhead and ignores context entirely,
# which is why it self-reports Confidence: LOW. It cannot answer this question.

set -uo pipefail
LMS="${LMS:-$HOME/.lmstudio/bin/lms}"
CTX="${1:-32768}"
shift || true

MODELS=("$@")
if [ ${#MODELS[@]} -eq 0 ]; then
  MODELS=(
    "fable-coder-35b-a3b"
    "qwen/qwen3.6-27b"
    "qwen/qwen3-coder-30b"
    "qwen.qwen3.6-35b-a3b"
    "openai/gpt-oss-20b"
    "qwen3.6-27b-fable-5-experimental"
    "qwen-agentworld-35b-a3b-apex"
    "qwen3.6-35b-a3b-claude-4.6-opus-reasoning-distilled"
    "google/gemma-4-26b-a4b"
    "gemma-4-12b-agentic-fable5-composer2.5-v2-3.5x-tau2"
    "bonsai-27b"
    "qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max"
  )
fi

vram() { nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1; }

"$LMS" unload --all >/dev/null 2>&1; sleep 2
IDLE=$(vram)
TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
echo "GPU ${TOTAL} MiB total · ${IDLE} MiB idle · target context ${CTX}"
printf '%-58s %10s %10s %8s\n' "MODEL" "USED_MiB" "MODEL_MiB" "FREE_MiB"

for M in "${MODELS[@]}"; do
  # --parallel 1: benchmark sessions are single-stream. The default (4) splits
  # or multiplies the KV allocation for no benefit and adds a variable.
  if ! "$LMS" load "$M" -c "$CTX" --gpu max --parallel 1 -y >/dev/null 2>&1; then
    printf '%-58s %10s\n' "$M" "LOAD FAILED"
    "$LMS" unload --all >/dev/null 2>&1; sleep 2; continue
  fi
  sleep 2
  U=$(vram)
  printf '%-58s %10s %10s %8s\n' "$M" "$U" "$((U - IDLE))" "$((TOTAL - U))"
  "$LMS" unload --all >/dev/null 2>&1; sleep 2
done

cat <<'NOTE'

Confirm the loaded context from the v1 endpoint (v0 has a different schema and
reports loaded_instances as null):

  curl -s http://127.0.0.1:1234/api/v1/models \
    | python -c "import sys,json;[print(m['key'], m['loaded_instances'][0]['config']['context_length']) for m in json.load(sys.stdin)['models'] if m.get('loaded_instances')]"

Record the loaded value in every RUN.md. Compaction fires at 0.75 x it.
NOTE
