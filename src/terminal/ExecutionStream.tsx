import { Activity, Brain, FileCode2, FlaskConical, GitCommitHorizontal, Globe, ShieldAlert, SquareTerminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ROLE_META, STREAM_KIND_LABEL } from '../components/meta';
import { Card, CardHeader, EmptyState, inputCls, StatusDot, TONE_TEXT, Toggle, type Tone } from '../components/ui';
import { cn, formatClock } from '../lib/utils';
import { useStore } from '../state/context';
import type { StreamEvent, StreamKind } from '../types';

const KIND_ICON: Record<StreamKind, ReactNode> = {
  file_edit: <FileCode2 className="size-3.5" />,
  shell: <SquareTerminal className="size-3.5" />,
  test: <FlaskConical className="size-3.5" />,
  browser: <Globe className="size-3.5" />,
  think: <Brain className="size-3.5" />,
  git: <GitCommitHorizontal className="size-3.5" />,
  security: <ShieldAlert className="size-3.5" />,
};

function statusTone(e: StreamEvent): Tone {
  if (e.status === 'failed') return 'rose';
  if (e.kind === 'security') return 'amber';
  if (e.status === 'running') return 'cyan';
  if (e.status === 'success') return e.kind === 'git' ? 'emerald' : 'cyan';
  return 'violet';
}

export function ExecutionStream() {
  const { state } = useStore();
  const [agentFilter, setAgentFilter] = useState('all');
  const [kinds, setKinds] = useState<Set<StreamKind>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const events = useMemo(
    () => state.stream.filter((e) => (agentFilter === 'all' || e.agentId === agentFilter) && (kinds.size === 0 || kinds.has(e.kind))),
    [state.stream, agentFilter, kinds],
  );

  useEffect(() => {
    if (autoScroll && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [events, autoScroll]);

  const toggleKind = (k: StreamKind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const active = state.agents.filter((a) => a.status === 'running' && a.currentSubtaskId);
  const agentName = (id: string) => state.agents.find((a) => a.id === id)?.name ?? (id === 'system' ? 'AgentPulse' : id);

  return (
    <Card className="flex h-full min-h-[560px] flex-col">
      <CardHeader
        icon={<Activity className="size-4 text-exec" />}
        title="Live Execution Stream"
        subtitle={`${events.length} steps · ${state.globalPaused ? 'stream frozen' : 'streaming'}`}
        actions={
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <Toggle checked={autoScroll} onChange={setAutoScroll} label="Auto-scroll" size="sm" tone="cyan" /> Auto-scroll
          </label>
        }
      />
      <div className="space-y-2 border-b border-white/5 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin">
          {active.length === 0 && <p className="text-xs text-slate-500">No agents actively executing.</p>}
          {active.map((a) => {
            const st = state.subtasks.find((s) => s.id === a.currentSubtaskId);
            return (
              <div key={a.id} className="flex min-w-52 shrink-0 items-center gap-2 rounded-lg bg-exec/[0.07] px-2.5 py-1.5 ring-1 ring-exec/20">
                <StatusDot tone={state.globalPaused ? 'slate' : 'cyan'} pulse={!state.globalPaused} />
                <div className="min-w-0">
                  <p className={cn('font-mono text-[10px] font-semibold', TONE_TEXT[ROLE_META[a.role].tone])}>{a.name}</p>
                  <p className="truncate text-[11px] text-slate-300">{st?.title}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select aria-label="Filter by agent" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className={cn(inputCls, 'h-7 w-auto py-0 text-xs')}>
            <option value="all">All agents</option>
            {state.agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
            <option value="system">AgentPulse (system)</option>
          </select>
          {(Object.keys(STREAM_KIND_LABEL) as StreamKind[]).map((k) => (
            <button key={k} type="button" aria-pressed={kinds.has(k)} onClick={() => toggleKind(k)} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ring-1 ring-inset transition', kinds.has(k) ? 'bg-exec/15 text-cyan-200 ring-exec/40' : 'text-slate-400 ring-white/10 hover:text-slate-200')}>
              {KIND_ICON[k]} {STREAM_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div ref={listRef} className="relative flex-1 overflow-y-auto px-4 py-3 scrollbar-thin" aria-live="polite">
        {events.length === 0 ? (
          <EmptyState icon={<Activity className="size-5" />} title="No steps match" body="Clear filters to see all activity." />
        ) : (
          <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-white/5">
            {events.map((e) => {
              const tone = statusTone(e);
              return (
                <li key={e.id} className="relative flex gap-3 rounded-lg py-1.5 pr-2 animate-slide-in hover:bg-white/[0.02]">
                  <span className={cn('relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-current/30', TONE_TEXT[tone])}>{KIND_ICON[e.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[10px] text-slate-500">{formatClock(e.ts)}</span>
                      <span className="font-mono text-[10px] font-semibold text-violet-300">{agentName(e.agentId)}</span>
                      {e.status === 'failed' && <span className="font-mono text-[10px] font-semibold text-danger">FAILED</span>}
                    </div>
                    <p className={cn('text-xs', e.status === 'failed' ? 'text-rose-200' : 'text-slate-200')}>{e.title}</p>
                    {e.detail && <p className="truncate font-mono text-[11px] text-slate-500" title={e.detail}>{e.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
