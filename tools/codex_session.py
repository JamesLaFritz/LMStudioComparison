#!/usr/bin/env python
"""codex_session.py -- Codex Desktop rollouts -> workbench-shaped session.json.

    python codex_session.py <run-dir> --model gpt-5.6-sol [--seed 1]

<run-dir>/rollouts/*.jsonl holds every thread the app wrote for this workspace
(root + sub-agents, found by cwd).  Output, next to it:

    session.json   history[] in the workbench's vocabulary so audit.py and
                   stage1_score.py read it unchanged: user / assistant /
                   reasoning / tool{run_command,write_file,edit_file,...} /
                   compacted.  Sub-agent entries carry an `agent` field.
    p1.json p2.json p3.json   {"reply": <last assistant message of that turn>}
    run.json       the Stage 1 run record (timings, tokens, turns, files)

The desktop app's tool surface is one `exec` custom tool running a JavaScript
snippet against a `tools.*` API.  One snippet can carry several calls
(Promise.all), so one exec may fan out to several history entries.  Mapping:

    tools.exec_command({cmd})          -> run_command   args = cmd
    tools.apply_patch(*** Add File)    -> write_file    args = path
    tools.apply_patch(*** Update File) -> edit_file     args = path
    tools.apply_patch(*** Delete File) -> delete_file   args = path
    tools.view_image({path})           -> view_image    args = path
    tools.mcp__context7__*             -> mcp           args = context7:<fn>
    tools.web__run                     -> web_search
    tools.write_stdin                  -> write_stdin
    function_call spawn_agent/...      -> agent:<fn>    args = task_name

Only the three benchmark prompts become `user` entries; the app's injected
<recommended_plugins> message and the developer-role app context are dropped,
so the scorer's "everything before the second user turn is STEP 1" holds.
"""
import argparse, glob, json, os, re, sys
from datetime import datetime, timezone

PROMPT_HEADS = ('# MISSION DIRECTIVE', 'Begin Space Invaders', 'Plan approved')


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


def text_of(payload):
    c = payload.get('content')
    if isinstance(c, list):
        return ''.join(x.get('text', '') for x in c if isinstance(x, dict))
    return c if isinstance(c, str) else ''


def load_threads(rdir):
    threads = []
    for f in sorted(glob.glob(os.path.join(rdir, 'rollouts', '*.jsonl'))):
        lines = []
        with open(f, encoding='utf-8') as fh:
            for l in fh:
                l = l.strip()
                if l:
                    try:
                        lines.append(json.loads(l))
                    except json.JSONDecodeError:
                        pass
        if not lines or lines[0].get('type') != 'session_meta':
            continue
        meta = lines[0]['payload']
        src = meta.get('source')
        agent = None
        if isinstance(src, dict) and 'subagent' in src:
            agent = src['subagent']['thread_spawn'].get('agent_path')
        threads.append({'id': meta.get('id'), 'parent': meta.get('parent_thread_id'),
                        'agent': agent, 'lines': lines, 'file': os.path.basename(f)})
    return threads


# --- the JS snippet -> history entries -------------------------------------

# the snippets write both `cmd:"…"` and `"cmd":"…"`
CMD_RX = re.compile(r'\bcmd"?\s*:\s*"((?:[^"\\]|\\.)*)"')
PATH_RX = re.compile(r'\bpath"?\s*:\s*"((?:[^"\\]|\\.)*)"')
PATCH_RX = re.compile(r'\*\*\* (Add|Update|Delete) File: (.+)')
IMG_RX = re.compile(r'"((?:[^"\\]|\\.)*\.(?:png|jpe?g|webp))"', re.I)
MCP_RX = re.compile(r'tools\.(mcp__\w+)\s*\(')


def unescape(s):
    try:
        return json.loads('"' + s + '"')
    except Exception:
        return s


def js_to_entries(inp, at, agent):
    out = []
    base = {'at': at}
    if agent:
        base['agent'] = agent
    if 'tools.exec_command' in inp:
        cmds = [unescape(c) for c in CMD_RX.findall(inp)]
        args = '; '.join(cmds) if cmds else inp
        # The app stores a long paste as an attachment and the model reads its
        # own prompt back with Get-Content. That is the paste mechanism, not a
        # command the benchmark forbade in STEP 1 -- keep it visible, not scored.
        tool = 'read_prompt_attachment' if '.codex' in args and 'pasted-text' in args else 'run_command'
        # Reading a SKILL.md out of ~/.agents/skills is the app's `use_skill`;
        # the workbench exposes that as a tool, and axis 9 does not count it as
        # a command. Same act, same label.
        if re.search(r'[\\/]skills[\\/][^"\s]*SKILL\.md', args) and re.match(r'\s*(Get-Content|cat|type)\b', args):
            skills = re.findall(r'skills[\\/]+([\w.-]+)', args)
            out.append(dict(base, kind='tool', tool='use_skill', args=', '.join(dict.fromkeys(skills))))
            return out
        out.append(dict(base, kind='tool', tool=tool, args=args))
    if 'tools.apply_patch' in inp:
        seen = []
        for kind, path in PATCH_RX.findall(inp):
            path = path.strip().rstrip('\\n"')
            tool = {'Add': 'write_file', 'Update': 'edit_file', 'Delete': 'delete_file'}[kind]
            if (tool, path) not in seen:
                seen.append((tool, path))
                out.append(dict(base, kind='tool', tool=tool, args=path))
        if not seen:
            out.append(dict(base, kind='tool', tool='edit_file', args='(unparsed patch)'))
    if 'tools.view_image' in inp:
        # single call: view_image({path: ".."}); batched: const paths = ["..png", ..]
        paths = PATH_RX.findall(inp) or IMG_RX.findall(inp)
        for p in paths:
            out.append(dict(base, kind='tool', tool='view_image', args=unescape(p)))
    for m in MCP_RX.finditer(inp):
        fn = m.group(1)
        if fn.startswith('mcp__playwright__browser_'):
            # The Playwright MCP reached through the app: same tool the Claude runs
            # used, so emit the same `browser` entries in the page.* idiom (the
            # audit's LAUNCHED / INTERACTED patterns read them). The snippet after
            # the call carries url / key / code, and run_code_unsafe scripts carry
            # their own page.keyboard / page.click calls.
            short = fn[len('mcp__playwright__browser_'):]
            tail = inp[m.end():m.end() + 400].replace('\n', ' ')
            idiom = {'navigate': 'page.goto', 'click': 'page.click', 'press_key': 'page.keyboard.press',
                     'type': 'page.keyboard.type', 'evaluate': 'page.evaluate', 'run_code_unsafe': 'page.evaluate',
                     'take_screenshot': 'page.screenshot', 'snapshot': 'page.snapshot',
                     'console_messages': 'page.consoleMessages', 'resize': 'page.setViewportSize',
                     'wait_for': 'page.waitFor', 'hover': 'page.hover', 'fill_form': 'page.fill'}.get(short, short)
            out.append(dict(base, kind='tool', tool='browser', args='%s(%s' % (idiom, tail)))
        else:
            out.append(dict(base, kind='tool', tool='mcp', args=fn))
    if 'tools.web__run' in inp:
        out.append(dict(base, kind='tool', tool='web_search', args=inp[:200]))
    if 'tools.write_stdin' in inp:
        out.append(dict(base, kind='tool', tool='write_stdin', args=''))
    if not out:
        out.append(dict(base, kind='tool', tool='exec', args=inp[:300]))
    return out


def convert(rdir, model, seed):
    threads = load_threads(rdir)
    root = [t for t in threads if t['parent'] is None]
    if len(root) != 1:
        sys.exit('expected exactly one root thread, found %d' % len(root))
    root = root[0]

    history, turns_meta = [], []
    tokens = {'in': 0, 'out': 0, 'reasoning': 0, 'cached': 0}
    turn_count = 0
    compactions = 0
    shells = set()

    for t in threads:
        agent = t['agent']
        last_usage = None
        for e in t['lines']:
            kind, p, at = e.get('type'), e.get('payload') or {}, e.get('timestamp', '')
            atms = str(int(ts(at) * 1000)) if at else ''
            if kind == 'response_item':
                pt = p.get('type')
                if pt == 'message':
                    role, txt = p.get('role'), text_of(p)
                    if role == 'user' and t is root:
                        # the app pastes long prompts as a file; keep the real three only
                        if any(h in txt for h in PROMPT_HEADS) and 'recommended_plugins' not in txt:
                            history.append({'at': atms, 'kind': 'user', 'text': txt})
                    elif role == 'assistant':
                        ent = {'at': atms, 'kind': 'assistant', 'text': txt}
                        if agent:
                            ent['agent'] = agent
                        history.append(ent)
                        turn_count += 1
                elif pt == 'reasoning':
                    summ = p.get('summary') or []
                    txt = ''.join(s.get('text', '') for s in summ if isinstance(s, dict))
                    ent = {'at': atms, 'kind': 'reasoning', 'text': txt}
                    if agent:
                        ent['agent'] = agent
                    history.append(ent)
                elif pt == 'custom_tool_call':
                    inp = p.get('input', '')
                    for m in re.findall(r'shell\s*:\s*"(\w+)"', inp):
                        shells.add(m)
                    history.extend(js_to_entries(inp, atms, agent))
                    turn_count += 1
                elif pt == 'function_call':
                    name = p.get('name', '')
                    try:
                        a = json.loads(p.get('arguments') or '{}')
                    except Exception:
                        a = {}
                    ent = {'at': atms, 'kind': 'tool', 'tool': 'agent:' + name,
                           'args': a.get('task_name') or a.get('agent_id') or a.get('id') or ''}
                    if agent:
                        ent['agent'] = agent
                    history.append(ent)
                    turn_count += 1
            elif kind == 'compacted':
                ent = {'at': atms, 'kind': 'compacted', 'reason': 'auto'}
                if agent:
                    ent['agent'] = agent
                history.append(ent)
                compactions += 1
            elif kind == 'event_msg':
                pt = p.get('type')
                if pt == 'token_count' and p.get('info'):
                    last_usage = p['info'].get('total_token_usage')
                elif t is root and pt in ('task_started', 'task_complete'):
                    turns_meta.append((pt, ts(at), p.get('last_agent_message', '')))
        if last_usage:
            tokens['in'] += last_usage.get('input_tokens', 0)
            tokens['out'] += last_usage.get('output_tokens', 0)
            tokens['reasoning'] += last_usage.get('reasoning_output_tokens', 0)
            tokens['cached'] += last_usage.get('cached_input_tokens', 0)

    history.sort(key=lambda e: int(e['at'] or 0))

    # prompt turns from the root thread's task_started / task_complete pairs
    prompts = []
    start = None
    for pt, when, last in turns_meta:
        if pt == 'task_started':
            start = when
        elif pt == 'task_complete' and start is not None:
            prompts.append({'seconds': int(round(when - start)), 'reply': last})
            start = None

    ws = os.path.join(rdir, 'ws')
    files = 0
    for dp, dn, fn in os.walk(ws):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git')]
        files += len(fn)

    n_users = sum(1 for e in history if e['kind'] == 'user')
    run = {
        'model': model, 'seed': seed, 'harness': 'Codex Desktop',
        'session': root['id'],
        'p1_seconds': prompts[0]['seconds'] if len(prompts) > 0 else None,
        'p2_seconds': prompts[1]['seconds'] if len(prompts) > 1 else None,
        'p3_seconds': prompts[2]['seconds'] if len(prompts) > 2 else None,
        'continues': 0,
        'total_seconds': sum(p['seconds'] for p in prompts),
        'turns': turn_count,
        'tokens_in': tokens['in'], 'tokens_out': tokens['out'],
        'tokens_cached': tokens['cached'], 'reasoning_tokens': tokens['reasoning'],
        'bails': [], 'compactions': compactions,
        'max_reasoning': None,
        'seed_recorded': None,
        'files': files,
        'threads': len(threads), 'subagents': len(threads) - 1,
        'user_turns_recorded': n_users,
        'shells': sorted(shells),
    }
    session = {
        'id': root['id'], 'model': model, 'workspace': ws, 'preset': 'codex-desktop',
        'mode': 'auto', 'seed': seed,
        'history': history,
        'stats': {'turns': turn_count, 'in': tokens['in'], 'out': tokens['out']},
        'threads': [{'id': t['id'], 'parent': t['parent'], 'agent': t['agent'], 'file': t['file']}
                    for t in threads],
    }
    with open(os.path.join(rdir, 'session.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(session, f, indent=1, ensure_ascii=False)
    for i, p in enumerate(prompts[:3], 1):
        with open(os.path.join(rdir, 'p%d.json' % i), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'reply': p['reply']}, f, indent=1, ensure_ascii=False)
    with open(os.path.join(rdir, 'run.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(run, f, indent=1)
    return run, session


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('run_dir')
    ap.add_argument('--model', required=True)
    ap.add_argument('--seed', type=int, default=1)
    a = ap.parse_args()
    run, session = convert(a.run_dir, a.model, a.seed)
    from collections import Counter
    h = session['history']
    print(json.dumps(run, indent=1))
    print('history kinds :', dict(Counter(e['kind'] for e in h)))
    print('tools         :', dict(Counter(e['tool'] for e in h if e['kind'] == 'tool')))
    print('user turns    :', [e['text'][:40].replace('\n', ' ') for e in h if e['kind'] == 'user'])


if __name__ == '__main__':
    main()
