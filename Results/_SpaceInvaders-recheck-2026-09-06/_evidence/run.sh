#!/usr/bin/env bash
# Re-run of the three-prompt Space Invaders workload against
# qwen3.6-35b-a3b-mtp@q3_k_m over the EmberOS Workbench, 2026-09-06.
#
# Same model, same prompts, same settings as the frozen 2026-09-04 run. The
# only thing that changed in between is harness instrumentation, so a
# different outcome here is noise and an identical one isolates the model.
#
# The message endpoint blocks for the whole turn (p3 ran ~an hour last time),
# so this runs detached and the caller polls DONE.
set -u
SID="$1"
EV="$2"
API="http://localhost:4517/api/agent/$SID/message"

say() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$1" >> "$EV/progress.log"; }

send() {                       # send <label> <file-with-text>
  local label="$1" file="$2"
  say "-> $label"
  python -c "
import json,sys
print(json.dumps({'text': open(sys.argv[1], encoding='utf-8').read()}))
" "$file" > "$EV/.body.json"
  curl -s --max-time 21600 -X POST "$API" \
    -H 'Content-Type: application/json' \
    --data-binary "@$EV/.body.json" > "$EV/$label.json"
  say "<- $label ($(wc -c < "$EV/$label.json") bytes)"
}

bailed() {                     # did the last reply end on a harness bail?
  grep -qE 'Stopped after [0-9]+ (tool hops|turns that produced neither|turns that used the entire)' "$1"
}

send p1 "$EV/p1.txt"
send p2 "$EV/p2.txt"
send p3 "$EV/p3.txt"

# The frozen run needed one continue. Allow up to 5 so a bail cannot be what
# ends the test -- if it still fails after that, it failed on merit.
printf 'continue' > "$EV/continue.txt"
last="$EV/p3.json"
for i in 1 2 3 4 5; do
  bailed "$last" || break
  send "c$i" "$EV/continue.txt"
  last="$EV/c$i.json"
done

say "ALL DONE"
touch "$EV/DONE"
