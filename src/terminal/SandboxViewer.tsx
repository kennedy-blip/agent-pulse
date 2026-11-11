import { ArrowLeft, ArrowRight, Globe, Lock, Monitor, RotateCw, SquareTerminal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Card, CardHeader, inputCls } from '../components/ui';
import { cn, formatClock, uid } from '../lib/utils';
import { classifyCommand } from '../security/policy';
import { useStore } from '../state/context';
import type { TerminalLine } from '../types';
import { runCommand } from './commands';

const ROUTES = ['/dashboard', '/agents', '/login', '/api/docs'] as const;

const STREAM_CLS: Record<TerminalLine['stream'], string> = {
  stdin: 'text-cyan-300',
  stdout: 'text-slate-300',
  stderr: 'text-rose-400',
  system: 'text-amber-300',
};

function FakePage({ route, progress, loading }: { route: string; progress: number; loading: boolean }) {
  const filled = Math.floor(progress / 20);
  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <RotateCw className="size-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (route === '/login') {
    return (
      <div className="grid h-full place-items-center p-4">
        <div className="w-full max-w-56 space-y-2.5 rounded-lg bg-white p-4 shadow-lg">
          <div className="mx-auto size-7 rounded-md bg-violet-500" />
          <p className="text-center text-xs font-semibold text-slate-800">Sign in to Acme</p>
          <div className="h-6 rounded border border-slate-200 bg-slate-50" />
          <div className="h-6 rounded border border-slate-200 bg-slate-50" />
          <div className="h-6 rounded bg-violet-500" />
        </div>
      </div>
    );
  }
  if (route === '/api/docs') {
    return (
      <div className="space-y-2 p-4 font-mono text-[11px] text-slate-700">
        <p className="text-sm font-semibold text-slate-900">Acme Platform API · v1</p>
        {[
          ['POST', '/v1/hooks/ingest', 'bg-emerald-500'],
          ['GET', '/v1/agents/{id}/stream', 'bg-sky-500'],
          ['GET', '/v1/costs', 'bg-sky-500'],
          ['DELETE', '/v1/briefs/{id}', 'bg-rose-500'],
        ].map(([m, p, c]) => (
          <div key={p} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5">
            <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold text-white', c)}>{m}</span>
            {p}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <div className="hidden w-24 shrink-0 space-y-1.5 bg-slate-900 p-2 sm:block">
        <div className="mb-3 h-3 w-12 rounded bg-violet-500" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('h-2 rounded', i === 0 ? 'bg-slate-500' : 'bg-slate-700')} />
        ))}
      </div>
      <div className="flex-1 space-y-2.5 bg-slate-100 p-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded bg-slate-800" />
          <div className="h-5 w-14 rounded bg-violet-500" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-md bg-white p-2 shadow-sm">
              <div className="h-1.5 w-8 rounded bg-slate-300" />
              <div className={cn('mt-1.5 h-3 w-10 rounded transition-colors duration-700', i < filled ? ['bg-emerald-500', 'bg-cyan-500', 'bg-violet-500'][i] : 'animate-pulse bg-slate-200')} />
            </div>
          ))}
        </div>
        <div className="rounded-md bg-white p-2 shadow-sm">
          <div className="flex h-16 items-end gap-1">
            {[40, 65, 30, 80, 55, 90, 70, 45, 85, 60].map((h, i) => (
              <div key={i} className={cn('flex-1 rounded-t transition-all duration-700', i < filled * 2 ? 'bg-cyan-500' : 'bg-slate-200')} style={{ height: `${i < filled * 2 ? h : 20}%` }} />
            ))}
          </div>
        </div>
        <div className="space-y-1 rounded-md bg-white p-2 shadow-sm">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn('size-2 rounded-full', i < filled - 2 ? 'bg-emerald-500' : 'bg-slate-300')} />
              <div className="h-1.5 flex-1 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SandboxViewer() {
  const { state, dispatch, toast, emitWebhook } = useStore();
  const [agentId, setAgentId] = useState('ag_ui');
  const [termFilter, setTermFilter] = useState<'mirror' | 'all'>('all');
  const [pane, setPane] = useState<'split' | 'browser' | 'terminal'>('split');
  const [route, setRoute] = useState<string>('/dashboard');
  const [urlDraft, setUrlDraft] = useState('/dashboard');
  const [history, setHistory] = useState<string[]>(['/dashboard']);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const termRef = useRef<HTMLDivElement>(null);

  const agent = state.agents.find((a) => a.id === agentId);
  const subtask = agent?.currentSubtaskId ? state.subtasks.find((s) => s.id === agent.currentSubtaskId) : undefined;
  const port = agent?.role === 'Backend' ? 8000 : 5173;

  const lines = useMemo(
    () => (termFilter === 'all' ? state.terminal : state.terminal.filter((l) => l.agentId === agentId || l.agentId === 'operator' || l.agentId === 'system')),
    [state.terminal, termFilter, agentId],
  );
  const browserLog = state.stream.filter((e) => e.kind === 'browser' && e.agentId === agentId).slice(-3);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (!loading) return undefined;
    const t = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(t);
  }, [loading]);

  const navigate = (to: string) => {
    const path = to.startsWith('/') ? to : `/${to}`;
    setRoute(path);
    setUrlDraft(path);
    setHistory((h) => [...h, path]);
    setLoading(true);
  };

  const back = () => {
    if (history.length < 2) return;
    const next = history.slice(0, -1);
    setHistory(next);
    setRoute(next[next.length - 1]);
    setUrlDraft(next[next.length - 1]);
    setLoading(true);
  };

  const submitUrl = (e: FormEvent) => {
    e.preventDefault();
    navigate(urlDraft.replace(/^https?:\/\/[^/]+/, '') || '/');
  };

  const submitCommand = (e: FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    setInput('');
    setHistIdx(-1);
    if (!cmd) return;
    setCmdHistory((h) => [...h, cmd]);
    const now = Date.now();
    const echo: TerminalLine = { id: uid('tl'), ts: now, agentId: 'operator', stream: 'stdin', text: `$ ${cmd}` };
    if (state.globalPaused) {
      dispatch({ type: 'PUSH_TERMINAL', lines: [echo, { id: uid('tl'), ts: now, agentId: 'system', stream: 'system', text: 'Sandbox I/O frozen by emergency pause. Resume the swarm to run commands.' }] });
      return;
    }
    const policy = classifyCommand(cmd, state.policies);
    if (policy) {
      const id = uid('hitl');
      dispatch({
        type: 'ADD_HITL',
        request: { id, agentId: agentId, briefId: subtask?.briefId ?? null, command: cmd, policyId: policy.id, risk: policy.risk, category: policy.category, reason: 'Issued manually from the sandbox terminal mirror', status: 'pending', ts: now },
      });
      dispatch({ type: 'PUSH_TERMINAL', lines: [echo, { id: uid('tl'), ts: now, agentId: 'system', stream: 'system', text: `⛔ Intercepted by HITL Gatekeeper (${policy.name}, risk: ${policy.risk}) — queued as ${id}. Approve it in the HITL & Security tab.` }] });
      dispatch({ type: 'PUSH_STREAM', events: [{ id: uid('ev'), ts: now, agentId: 'system', kind: 'security', title: `HITL gate intercepted: ${cmd}`, detail: `Policy: ${policy.name} · manual terminal input`, status: 'info' }] });
      emitWebhook('hitl.approval_required', { request_id: id, agent: agent?.name ?? 'operator', command: cmd, risk: policy.risk });
      toast('warning', 'Destructive command intercepted', cmd);
      return;
    }
    const result = runCommand(cmd, state);
    if (result.clear) {
      dispatch({ type: 'CLEAR_TERMINAL' });
      return;
    }
    dispatch({ type: 'PUSH_TERMINAL', lines: [echo, ...result.lines.map((l) => ({ id: uid('tl'), ts: now, agentId: 'operator', ...l }))] });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && cmdHistory.length) {
      e.preventDefault();
      const idx = histIdx < 0 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx]);
    } else if (e.key === 'ArrowDown' && histIdx >= 0) {
      e.preventDefault();
      const idx = histIdx + 1;
      if (idx >= cmdHistory.length) {
        setHistIdx(-1);
        setInput('');
      } else {
        setHistIdx(idx);
        setInput(cmdHistory[idx]);
      }
    }
  };

  const agentName = (id: string) => (id === 'operator' ? 'you' : id === 'system' ? 'sys' : state.agents.find((a) => a.id === id)?.name.replace('Devin-', '').toLowerCase() ?? id);

  return (
    <Card className="flex h-full min-h-[560px] flex-col">
      <CardHeader
        icon={<Monitor className="size-4 text-exec" />}
        title="Sandbox Mirror"
        subtitle={agent ? `${agent.name} · isolated VM · ${subtask ? subtask.title : 'no active sub-task'}` : 'Select an agent'}
        actions={
          <>
            <select aria-label="Mirror agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className={cn(inputCls, 'h-8 w-auto py-0 text-xs')}>
              {state.agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex rounded-lg bg-obsidian/70 p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Sandbox pane">
              {([
                ['split', 'Split', <Monitor key="s" className="size-3.5" />],
                ['browser', 'Browser', <Globe key="b" className="size-3.5" />],
                ['terminal', 'Terminal', <SquareTerminal key="t" className="size-3.5" />],
              ] as const).map(([id, label, icon]) => (
                <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs', pane === id ? 'bg-exec/20 text-cyan-100' : 'text-slate-400 hover:text-slate-200')}>
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </>
        }
      />
      <div className={cn('grid flex-1 gap-3 p-3 sm:p-4', pane === 'split' && 'grid-rows-[minmax(260px,1fr)_minmax(260px,1fr)]')}>
        {pane !== 'terminal' && (
          <div className="flex min-h-[260px] flex-col overflow-hidden rounded-xl ring-1 ring-white/10">
            <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5">
              <div className="hidden gap-1.5 sm:flex">
                <span className="size-2.5 rounded-full bg-rose-500/80" />
                <span className="size-2.5 rounded-full bg-amber-500/80" />
                <span className="size-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <button type="button" aria-label="Back" onClick={back} disabled={history.length < 2} className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30"><ArrowLeft className="size-3.5" /></button>
              <button type="button" aria-label="Forward" disabled className="rounded p-0.5 text-slate-400 disabled:opacity-30"><ArrowRight className="size-3.5" /></button>
              <button type="button" aria-label="Reload" onClick={() => setLoading(true)} className="rounded p-0.5 text-slate-400 hover:text-white"><RotateCw className={cn('size-3.5', loading && 'animate-spin')} /></button>
              <form onSubmit={submitUrl} className="flex flex-1 items-center gap-1.5 rounded-md bg-obsidian/80 px-2 py-1 ring-1 ring-white/5">
                <Lock className="size-3 text-emerald-400" />
                <span className="font-mono text-[11px] text-slate-500">localhost:{port}</span>
                <input aria-label="Sandbox URL path" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-slate-200 outline-none" />
              </form>
            </div>
            <div className="flex gap-1 overflow-x-auto bg-slate-800/40 px-2 py-1 scrollbar-thin">
              {ROUTES.map((r) => (
                <button key={r} type="button" onClick={() => navigate(r)} className={cn('shrink-0 rounded px-2 py-0.5 font-mono text-[10px]', route === r ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200')}>
                  {r}
                </button>
              ))}
            </div>
            <div className="relative flex-1 bg-slate-50">
              <FakePage route={route} progress={subtask?.progress ?? 100} loading={loading} />
              {state.globalPaused && <div className="absolute inset-0 grid place-items-center bg-obsidian/70 text-xs font-medium text-rose-200 backdrop-blur-[2px]">Sandbox frozen</div>}
            </div>
            <div className="space-y-0.5 bg-obsidian px-2.5 py-1.5 font-mono text-[10px]">
              {browserLog.length ? browserLog.map((e) => (
                <p key={e.id} className="truncate text-slate-400"><span className="text-cyan-400">console</span> {e.detail}</p>
              )) : <p className="text-slate-600">console · no browser activity for this agent yet</p>}
            </div>
          </div>
        )}
        {pane !== 'browser' && (
          <div className="flex min-h-[260px] flex-col overflow-hidden rounded-xl bg-[#05070d] ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-1.5">
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                <SquareTerminal className="size-3.5 text-exec" /> tty · {termFilter === 'all' ? 'all agents' : agent?.name}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setTermFilter(termFilter === 'all' ? 'mirror' : 'all')} className="rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-white/10 hover:text-white">
                  {termFilter === 'all' ? 'mirror selected' : 'show all'}
                </button>
                <Button size="sm" variant="ghost" aria-label="Clear terminal" icon={<Trash2 className="size-3" />} onClick={() => dispatch({ type: 'CLEAR_TERMINAL' })} className="h-6 px-1.5" />
              </div>
            </div>
            <div ref={termRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed scrollbar-thin" onClick={() => document.getElementById('term-input')?.focus()}>
              {lines.map((l) => (
                <div key={l.id} className="flex gap-2">
                  <span className="hidden shrink-0 text-slate-600 sm:inline">{formatClock(l.ts)}</span>
                  <span className="w-12 shrink-0 truncate text-violet-400/80">{agentName(l.agentId)}</span>
                  <span className={cn('break-all whitespace-pre-wrap', STREAM_CLS[l.stream])}>{l.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={submitCommand} className="flex items-center gap-2 border-t border-white/5 px-3 py-2 font-mono text-[11.5px]">
              <span className="shrink-0 text-emerald-400">operator@sandbox</span>
              <span className="text-slate-500">:~$</span>
              <input
                id="term-input"
                aria-label="Terminal command"
                autoComplete="off"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder='try "help", "git status" or "rm -rf dist"'
                className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder:text-slate-600 outline-none"
              />
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
