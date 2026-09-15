import json, io, sys

inv = json.load(io.open(sys.argv[1], encoding='utf-8'))
llm = {x['modelKey']: x for x in inv if x.get('type') == 'llm'}

ROSTER = [
    'qwen/qwen3-coder-30b',
    'qwen3.6-35b-a3b-mtp@q4_k_m',
    'qwen3.6-35b-a3b-claude-4.6-opus-reasoning-distilled',
    'fable-coder-35b-a3b',
    'qwen3.6-27b-fable-5-experimental',
    'google/gemma-4-26b-a4b',
    'qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max',
    'qwen3.6-35b-a3b-mtp@q3_k_m',
    'qwen/qwen3.6-27b',
    'qwen.qwen3.6-35b-a3b',
    'qwen-agentworld-35b-a3b-apex',
    'gemma-4-12b-agentic-fable5-composer2.5-v2-3.5x-tau2@q8_0',
    'openai/gpt-oss-20b',
    'prism-ml/bonsai-27b',
    'gemma-4-12b-agentic-fable5-composer2.5-v2-3.5x-tau2@q6_k',
]

gb = lambda x: x.get('sizeBytes', 0) / 1e9

print('=== ROSTER OF 15 — still present? ===')
missing = []
for k in ROSTER:
    if k in llm:
        print('  ok       %-58s %5.1fGB' % (k[:58], gb(llm[k])))
    else:
        near = [c for c in llm if c.split('/')[-1][:22] == k.split('/')[-1][:22]]
        print('  GONE     %-58s  %s' % (k[:58], ('renamed? ' + near[0]) if near else 'not in inventory'))
        missing.append(k)

print()
print('=== SUSPECT ENTRIES — size implies a shard or partial download ===')
# A "27b"/"35b"/"30b" name against a few GB on disk is not a whole model.
import re
for k, x in sorted(llm.items(), key=lambda kv: gb(kv[1])):
    m = re.search(r'(\d+)b\b', k.lower())
    if not m:
        continue
    params = int(m.group(1))
    size = gb(x)
    # ~0.4 GB per B is about Q1; below that the file cannot hold the weights
    if params >= 20 and size < params * 0.15:
        print('  SUSPECT  %-58s %5.1fGB for a %dB model  quant=%s'
              % (k[:58], size, params, (x.get('quantization') or {}).get('name', '-')))

print()
print('=== NEW SINCE THE ROSTER WAS PICKED (not on it, >= 6 GB) ===')
for k, x in sorted(llm.items(), key=lambda kv: -gb(kv[1])):
    if k in ROSTER or gb(x) < 6:
        continue
    print('  %-58s %5.1fGB  %-8s %s' % (k[:58], gb(x),
          (x.get('quantization') or {}).get('name', '-'), x.get('architecture', '-')))
