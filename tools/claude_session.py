#!/usr/bin/env python
"""claude_session.py -- Claude Code transcripts -> workbench-shaped session.json.

    python claude_session.py <run-dir> --model claude-sonnet-5 [--seed 1] [--session <uuid>]

<run-dir>/transcripts/*.jsonl are the files copied from
~/.claude/projects/<cwd-slug>/. The run is ONE session (the one that received
the three prompts); other transcripts in the folder (aborted attempts, /clear
before the real start) are ignored unless --session names one. Output next to
them: session.json, p1..p3.json, run.json -- same shapes codex_session.py
writes, so audit.py and stage1_score.py read them unchanged.

Tool mapping (Claude Code name -> workbench vocabulary):

    Bash / PowerShell                    -> run_command   args = command
    Write                                -> write_file    args = path relative to ws
    Edit / MultiEdit / NotebookEdit      -> edit_file
    Read                                 -> read_file
    Glob / Grep / LS                     -> glob
    Skill                                -> use_skill
    Agent / Task                         -> agent:spawn
    WebFetch / WebSearch                 -> web_search
    ToolSearch                           -> tool_search
    mcp__playwright__browser_*           -> browser       args in the Playwright idiom
                                            (page.goto / page.click / page.keyboard.press /
                                            page.evaluate / page.screenshot) so the audit's
                                            LAUNCHED / INTERACTED patterns read them

User turns: only the three benchmark prompts. Claude Code's own injected
"Output token limit hit. Resume directly" message is recorded as a
reasoning_overrun bail + one continue (the workbench's continue-on-bail
equivalent), not as a user turn. Slash-command echoes and tool_result
messages are not user turns either.
"""
import argparse, glob, json, os, sys
from datetime import datetime

PROMPT_HEADS = ('# MISSION DIRECTIVE', 'Begin Space Invaders', 'Plan approved')
AUTO_CONTINUE = 'Output token limit hit'


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


def load(f):
    out = []
    with open(f, encoding='utf-8') as fh:
        for l in fh:
            l = l.strip()
            if l:
                try:
                    out.append(json.loads(l))
                except json.JSONDecodeError:
                    pass
    return out


def user_text(e):
    c = e.get('message', {}).get('content')
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return ''.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text')
    return ''


def is_prompt(txt):
    return bool(txt) and not txt.startswith('<') and any(h in txt for h in PROMPT_HEADS)


def pick_session(files, wanted):
    """The transcript that carries all three prompts (or the one named)."""
    if wanted:
        for f in files:
            if wanted in os.path.basename(f):
                return f
        sys.exit('no transcript matching ' + wanted)
    best, best_n = None, -1
    for f in files:
        n = sum(1 for e in load(f) if e.get('type') == 'user' and is_prompt(user_text(e)))
        if n > best_n:
            best, best_n = f, n
    return best


def rel(path, ws):
    p = path.replace('\\', '/')
    w = ws.replace('\\', '/').rstrip('/')
    return p[len(w) + 1:] if p.lower().startswith(w.lower() + '/') else p


BROWSER = {
    'browser_navigate':         lambda i: 'page.goto(%s)' % json.dumps(i.get('url', '')),
    'browser_navigate_back':    lambda i: 'page.goBack()',
    'browser_click':            lambda i: 'page.click(%s)' % json.dumps(i.get('element') or i.get('ref') or ''),
    'browser_press_key':        lambda i: 'page.keyboard.press(%s)' % json.dumps(i.get('key', '')),
    'browser_type':             lambda i: 'page.keyboard.type(%s)' % json.dumps(i.get('text', '')),
    'browser_fill_form':        lambda i: 'page.fill(form)',
    'browser_evaluate':         lambda i: 'page.evaluate(%s)' % json.dumps((i.get('function') or '')[:120]),
    'browser_run_code_unsafe':  lambda i: 'page.evaluate(%s)' % json.dumps((i.get('code') or '')[:120]),
    'browser_take_screenshot':  lambda i: 'page.screenshot(%s)' % json.dumps(i.get('filename', '')),
    'browser_snapshot':         lambda i: 'page.snapshot()',
    'browser_console_messages': lambda i: 'page.consoleMessages()',
    'browser_wait_for':         lambda i: 'page.waitFor(%s)' % json.dumps(str(i.get('text') or i.get('time') or '')),
    'browser_hover':            lambda i: 'page.hover(%s)' % json.dumps(i.get('element') or ''),
    'browser_resize':           lambda i: 'page.setViewportSize(%s)' % json.dumps([i.get('width'), i.get('height')]),
    'browser_close':            lambda i: 'browser.close()',
}


def tool_entry(name, inp, ws):
    if name in ('Bash', 'PowerShell'):
        return 'run_command', inp.get('command', '')
    if name == 'Write':
        return 'write_file', rel(inp.get('file_path', ''), ws)
    if name in ('Edit', 'MultiEdit', 'NotebookEdit'):
        return 'edit_file', rel(inp.get('file_path') or inp.get('notebook_path') or '', ws)
    if name == 'Read':
        return 'read_file', rel(inp.get('file_path', ''), ws)
    if name in ('Glob', 'Grep', 'LS'):
        return 'glob', inp.get('pattern') or inp.get('path') or ''
    if name == 'Skill':
        return 'use_skill', inp.get('skill') or inp.get('name') or ''
    if name in ('Agent', 'Task'):
        return 'agent:spawn', inp.get('description') or inp.get('subagent_type') or ''
    if name in ('WebFetch', 'WebSearch'):
        return 'web_search', inp.get('url') or inp.get('query') or ''
    if name == 'ToolSearch':
        return 'tool_search', inp.get('query', '')
    if name.startswith('mcp__playwright__'):
        short = name[len('mcp__playwright__'):]
        fn = BROWSER.get(short)
        return 'browser', fn(inp) if fn else short
    if name.startswith('mcp__'):
        return 'mcp', name
    return name.lower(), json.dumps(inp)[:200]


def convert(rdir, model, seed, wanted):
    ws = os.path.join(rdir, 'ws')
    files = sorted(glob.glob(os.path.join(rdir, 'transcripts', '*.jsonl')))
    f = pick_session(files, wanted)
    L = load(f)
    session_id = os.path.splitext(os.path.basename(f))[0]

    history, prompts_at = [], []
    tokens = {'in': 0, 'out': 0, 'cached': 0, 'cache_write': 0, 'thinking': 0}
    turns = 0
    bails, continues = [], 0
    max_thinking = 0
    last_assistant_at = None
    claude_version = None

    for e in L:
        t = e.get('type')
        at = e.get('timestamp') or ''
        atms = str(int(ts(at) * 1000)) if at else ''
        claude_version = claude_version or e.get('version')
        if t == 'user':
            txt = user_text(e)
            c = e.get('message', {}).get('content')
            if isinstance(c, list) and c and isinstance(c[0], dict) and c[0].get('type') == 'tool_result':
                continue                                   # tool output, not a turn
            if txt.startswith(AUTO_CONTINUE):
                # Claude Code's own continue after a max_tokens stop -- the same
                # thing the Stage 1 runner did on a reasoning_overrun bail.
                continues += 1
                history.append({'at': atms, 'kind': 'auto_continue', 'text': txt[:120]})
                continue
            if is_prompt(txt):
                history.append({'at': atms, 'kind': 'user', 'text': txt})
                prompts_at.append(ts(at))
            continue
        if t == 'assistant':
            m = e.get('message', {})
            u = m.get('usage') or {}
            tokens['in'] += u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0)
            tokens['cached'] += u.get('cache_read_input_tokens', 0)
            tokens['cache_write'] += u.get('cache_creation_input_tokens', 0)
            tokens['out'] += u.get('output_tokens', 0)
            th = (u.get('output_tokens_details') or {}).get('thinking_tokens', 0)
            tokens['thinking'] += th
            max_thinking = max(max_thinking, th)
            turns += 1
            last_assistant_at = at
            if m.get('stop_reason') == 'max_tokens':
                reason = 'reasoning_overrun' if th and th >= u.get('output_tokens', 0) else 'max_tokens'
                bails.append(reason)
                history.append({'at': atms, 'kind': 'bail', 'reason': reason,
                                'output_tokens': u.get('output_tokens', 0), 'thinking_tokens': th})
            for b in m.get('content', []):
                bt = b.get('type')
                if bt == 'thinking':
                    history.append({'at': atms, 'kind': 'reasoning', 'text': b.get('thinking', ''), 'tokens': th})
                elif bt == 'text':
                    txt = b.get('text', '')
                    # A spend/usage-limit refusal arrives as assistant text. It is a
                    # harness stop, not a model turn; the protocol allows a same-thread
                    # resume, so record the bail and let the timing skip the gap.
                    if txt.startswith("You've hit your") and 'limit' in txt[:80]:
                        bails.append('spend_limit')
                        history.append({'at': atms, 'kind': 'bail', 'reason': 'spend_limit', 'text': txt[:160]})
                        continue
                    history.append({'at': atms, 'kind': 'assistant', 'text': txt})
                elif bt == 'tool_use':
                    tool, args = tool_entry(b.get('name', ''), b.get('input') or {}, ws)
                    history.append({'at': atms, 'kind': 'tool', 'tool': tool, 'args': args, 'name': b.get('name')})
            continue
        if t == 'system' and e.get('subtype') == 'compact_boundary':
            history.append({'at': atms, 'kind': 'compacted', 'reason': 'auto'})

    # per-prompt wall clock: prompt sent -> last model activity before the next
    # prompt, minus any idle gap longer than IDLE_GAP (a limit hit and a resume
    # hours later is one run by protocol, but the hours are not model time).
    IDLE_GAP = 1800
    seconds, idle_excluded = [], 0
    for i, p0 in enumerate(prompts_at):
        p1 = prompts_at[i + 1] if i + 1 < len(prompts_at) else float('inf')
        stamps = sorted(int(x['at']) / 1000 for x in history
                        if x['kind'] in ('assistant', 'tool', 'reasoning', 'bail') and x['at']
                        and p0 <= int(x['at']) / 1000 < p1)
        active, prev = 0.0, p0
        for tx in stamps:
            gap = tx - prev
            if gap > IDLE_GAP:
                idle_excluded += gap
            else:
                active += gap
            prev = tx
        seconds.append(int(round(active)))

    replies = []
    for i, p0 in enumerate(prompts_at):
        p1 = prompts_at[i + 1] if i + 1 < len(prompts_at) else float('inf')
        texts = [x['text'] for x in history if x['kind'] == 'assistant' and x['at'] and p0 <= int(x['at']) / 1000 < p1]
        replies.append(texts[-1] if texts else '')

    files_on_disk = 0
    for dp, dn, fn in os.walk(ws):
        dn[:] = [d for d in dn if d not in ('node_modules', 'dist', '.git')]
        files_on_disk += len(fn)

    compactions = sum(1 for x in history if x['kind'] == 'compacted')
    run = {
        'model': model, 'seed': seed, 'harness': 'Claude Code %s' % (claude_version or ''),
        'session': session_id,
        'p1_seconds': seconds[0] if len(seconds) > 0 else None,
        'p2_seconds': seconds[1] if len(seconds) > 1 else None,
        'p3_seconds': seconds[2] if len(seconds) > 2 else None,
        'continues': continues,
        'resumes_after_limit': sum(1 for b in bails if b == 'spend_limit'),
        'idle_excluded_seconds': int(idle_excluded),
        'total_seconds': sum(seconds),
        'turns': turns,
        'tokens_in': tokens['in'], 'tokens_out': tokens['out'],
        'tokens_cached': tokens['cached'], 'reasoning_tokens': tokens['thinking'],
        'bails': bails, 'compactions': compactions,
        'max_reasoning': max_thinking,
        'seed_recorded': None,
        'files': files_on_disk,
        'threads': 1, 'subagents': sum(1 for x in history if x['kind'] == 'tool' and x['tool'] == 'agent:spawn'),
        'user_turns_recorded': len(prompts_at),
        'transcripts_in_folder': [os.path.basename(x) for x in files],
    }
    session = {
        'id': session_id, 'model': model, 'workspace': ws, 'preset': 'claude-code',
        'mode': 'bypassPermissions', 'seed': seed,
        'history': history,
        'stats': {'turns': turns, 'in': tokens['in'], 'out': tokens['out']},
    }
    with open(os.path.join(rdir, 'session.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(session, fh, indent=1, ensure_ascii=False)
    for i, r in enumerate(replies[:3], 1):
        with open(os.path.join(rdir, 'p%d.json' % i), 'w', encoding='utf-8', newline='\n') as fh:
            json.dump({'reply': r}, fh, indent=1, ensure_ascii=False)
    with open(os.path.join(rdir, 'run.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(run, fh, indent=1)
    return run, session


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('run_dir')
    ap.add_argument('--model', required=True)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--session', help='transcript uuid (prefix) to use; default: the one with the most prompts')
    a = ap.parse_args()
    run, session = convert(a.run_dir, a.model, a.seed, a.session)
    from collections import Counter
    h = session['history']
    print(json.dumps(run, indent=1))
    print('history kinds :', dict(Counter(x['kind'] for x in h)))
    print('tools         :', dict(Counter(x['tool'] for x in h if x['kind'] == 'tool')))
    print('user turns    :', [x['text'][:40].replace('\n', ' ') for x in h if x['kind'] == 'user'])


if __name__ == '__main__':
    main()
