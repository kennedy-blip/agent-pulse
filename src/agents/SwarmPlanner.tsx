import { ArrowRight, Boxes, CheckCircle2, GitFork, Layers, Network, RefreshCw, Send, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { BRIEF_STATUS_META, PRIORITY_META, ROLE_META, SUBTASK_STATUS_META } from '../components/meta';
import { Badge, Button, Card, CardHeader, EmptyState, inputCls, ProgressBar, TONE_TEXT } from '../components/ui';
import { cn, formatUsd } from '../lib/utils';
import { useStore } from '../state/context';
import type { SubTask } from '../types';
import { AgentRoster } from './AgentRoster';
import { decomposeBrief, wakeIdleAgents } from './decompose';

const CELL_TONE: Record<SubTask['status'], string> = {
  pending: 'bg-slate-500/10 text-slate-300 ring-slate-500/30',
  running: 'bg-exec/15 text-cyan-200 ring-exec/40',
  blocked: 'bg-hitl/15 text-amber-200 ring-hitl/40',
  done: 'bg-ok/15 text-emerald-200 ring-ok/40',
  failed: 'bg-danger/15 text-rose-200 ring-danger/40',
};

export function SwarmPlanner() {
  const { state, dispatch, toast } = useStore();
  const [view, setView] = useState<'matrix' | 'waves'>('matrix');
  const brief = state.briefs.find((b) => b.id === state.selectedBriefId) ?? state.briefs[0];
  const subtasks = brief ? state.subtasks.filter((s) => s.briefId === brief.id).sort((a, b) => a.wave - b.wave) : [];
  const waves = Array.from(new Set(subtasks.map((s) => s.wave))).sort((a, b) => a - b);
  const titleOf = (id: string) => subtasks.find((s) => s.id === id)?.title ?? id;

  const decompose = () => {
    if (!brief) return;
    const next = decomposeBrief(brief, state.agents);
    dispatch({ type: 'SET_SUBTASKS', briefId: brief.id, subtasks: next });
    toast('info', 'Goal decomposed', `${next.length} sub-tasks across ${new Set(next.map((s) => s.role)).size} specialist agents · ${new Set(next.map((s) => s.wave)).size} waves`);
  };

  const dispatchBrief = () => {
    if (!brief) return;
    let subs = subtasks;
    if (!subs.length) {
      subs = decomposeBrief(brief, state.agents);
      dispatch({ type: 'SET_SUBTASKS', briefId: brief.id, subtasks: subs });
    }
    dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'running' });
    wakeIdleAgents(subs, state.agents, dispatch);
    toast('success', 'Swarm dispatched', brief.title);
  };

  const reassign = (st: SubTask, agentId: string) => {
    dispatch({ type: 'REASSIGN_SUBTASK', id: st.id, agentId });
    const agent = state.agents.find((a) => a.id === agentId);
    if (agent?.status === 'idle') dispatch({ type: 'SET_AGENT_STATUS', id: agentId, status: 'running' });
    toast('info', 'Sub-task reassigned', `${st.title} → ${agent?.name}`);
  };

  if (!brief) {
    return (
      <Card>
        <EmptyState icon={<Network className="size-5" />} title="No briefs yet" body="Dispatch a brief to see its sub-task decomposition." action={<Button variant="primary" onClick={() => dispatch({ type: 'SET_COMPOSER', open: true })}>Dispatch New Brief</Button>} />
      </Card>
    );
  }

  const done = subtasks.filter((s) => s.status === 'done').length;
  const pct = subtasks.length ? subtasks.reduce((a, s) => a + s.progress, 0) / subtasks.length : 0;
  const editable = brief.status !== 'completed' && brief.status !== 'running' && brief.status !== 'awaiting_hitl';

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-medium tracking-wider text-slate-500 uppercase" htmlFor="brief-select">Engineering goal</label>
            <select id="brief-select" className={cn(inputCls, 'mt-1 font-medium')} value={brief.id} onChange={(e) => dispatch({ type: 'SELECT_BRIEF', id: e.target.value })}>
              {state.briefs.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.priority}] {b.title}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={PRIORITY_META[brief.priority].tone}>{PRIORITY_META[brief.priority].label}</Badge>
              <Badge tone={BRIEF_STATUS_META[brief.status].tone} dot pulse={BRIEF_STATUS_META[brief.status].pulse}>{BRIEF_STATUS_META[brief.status].label}</Badge>
              <span className="font-mono text-[11px] text-cyan-300">{brief.repo}</span>
              <span className="text-[11px] text-slate-500">· {formatUsd(brief.spent)} of {formatUsd(brief.costCap, 0)}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="min-w-48 flex-1">
              <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                <span>{done}/{subtasks.length} sub-tasks</span>
                <span className="font-mono">{Math.round(pct)}%</span>
              </div>
              <ProgressBar value={pct} tone={brief.status === 'completed' ? 'emerald' : 'cyan'} />
            </div>
            <Button icon={<RefreshCw className="size-4" />} onClick={decompose} disabled={!editable} title={editable ? 'Re-run planner decomposition' : 'Pause the brief to re-plan'}>
              {subtasks.length ? 'Re-decompose' : 'Auto-decompose'}
            </Button>
            {(brief.status === 'queued' || brief.status === 'paused') && (
              <Button variant="primary" icon={<Send className="size-4" />} onClick={dispatchBrief}>
                Dispatch Swarm
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<Boxes className="size-4 text-swarm" />}
          title="Sub-Task Decomposition Matrix"
          subtitle="Rows are sub-tasks, columns are specialised agents. Click an empty cell to reassign."
          actions={
            <div className="flex rounded-lg bg-obsidian/70 p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Planner view">
              {(['matrix', 'waves'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', view === v ? 'bg-swarm/25 text-violet-100' : 'text-slate-400 hover:text-slate-200')}>
                  {v === 'matrix' ? <Layers className="size-3.5" /> : <GitFork className="size-3.5" />}
                  {v === 'matrix' ? 'Matrix' : 'Parallel waves'}
                </button>
              ))}
            </div>
          }
        />
        {!subtasks.length ? (
          <EmptyState icon={<Network className="size-5" />} title="Not decomposed yet" body="Run auto-decomposition to break this goal into parallel sub-tasks." action={<Button variant="primary" onClick={decompose} icon={<RefreshCw className="size-4" />}>Auto-decompose</Button>} />
        ) : view === 'matrix' ? (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[11px] text-slate-400">
                  <th className="sticky left-0 z-10 border-b border-white/5 bg-surface/95 px-4 py-2.5 font-medium">Sub-task</th>
                  <th className="border-b border-white/5 px-2 py-2.5 text-center font-medium">Wave</th>
                  {state.agents.map((a) => (
                    <th key={a.id} className="border-b border-white/5 px-2 py-2.5 text-center font-medium">
                      <span className={cn('block font-mono text-[10px]', TONE_TEXT[ROLE_META[a.role].tone])}>{ROLE_META[a.role].short}</span>
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subtasks.map((st) => (
                  <tr key={st.id} className="group">
                    <td className="sticky left-0 z-10 max-w-72 border-b border-white/5 bg-surface/95 px-4 py-2.5">
                      <p className="truncate text-xs font-medium text-slate-200" title={st.title}>{st.title}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                        {st.dependsOn.length ? `after: ${st.dependsOn.map(titleOf).map((t) => t.split(' ').slice(0, 3).join(' ').replace(/\s*[&,]$/, '')).join(', ')}` : 'no dependencies'} · ~{st.estMinutes}m
                      </p>
                    </td>
                    <td className="border-b border-white/5 px-2 text-center font-mono text-xs text-slate-400">W{st.wave + 1}</td>
                    {state.agents.map((a) => {
                      const assigned = st.agentId === a.id;
                      const canAssign = !assigned && st.status !== 'done' && st.status !== 'blocked';
                      return (
                        <td key={a.id} className="border-b border-white/5 px-1.5 py-2 text-center">
                          {assigned ? (
                            <div className={cn('mx-auto w-full max-w-28 rounded-lg px-2 py-1.5 ring-1 ring-inset', CELL_TONE[st.status])}>
                              <div className="flex items-center justify-between gap-1 text-[10px] font-semibold">
                                <span>{SUBTASK_STATUS_META[st.status].label}</span>
                                <span className="font-mono">{Math.round(st.progress)}%</span>
                              </div>
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/30">
                                <div className="h-full rounded-full bg-current transition-[width] duration-700" style={{ width: `${st.progress}%` }} />
                              </div>
                            </div>
                          ) : canAssign ? (
                            <button type="button" onClick={() => reassign(st, a.id)} className="mx-auto grid h-9 w-full max-w-28 place-items-center rounded-lg border border-dashed border-white/5 text-slate-600 opacity-60 transition hover:border-swarm/50 hover:bg-swarm/10 hover:text-violet-300 hover:opacity-100 focus-visible:opacity-100" aria-label={`Assign "${st.title}" to ${a.name}`}>
                              <UserPlus className="size-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-700">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto p-4 scrollbar-thin sm:p-5">
            {waves.map((w, i) => (
              <div key={w} className="flex shrink-0 items-stretch gap-3">
                <div className="w-64 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span>Wave {w + 1}</span>
                    <span>{subtasks.filter((s) => s.wave === w).length} parallel</span>
                  </div>
                  {subtasks.filter((s) => s.wave === w).map((st) => {
                    const agent = state.agents.find((a) => a.id === st.agentId);
                    return (
                      <div key={st.id} className={cn('rounded-lg p-3 ring-1 ring-inset', CELL_TONE[st.status])}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-slate-100">{st.title}</p>
                          {st.status === 'done' && <CheckCircle2 className="size-3.5 shrink-0 text-ok" />}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className={cn('font-mono', TONE_TEXT[ROLE_META[st.role].tone])}>{agent?.name ?? st.role}</span>
                          <span className="font-mono text-slate-400">{Math.round(st.progress)}%</span>
                        </div>
                        <ProgressBar className="mt-1.5" value={st.progress} tone={st.status === 'done' ? 'emerald' : st.status === 'failed' ? 'rose' : st.status === 'blocked' ? 'amber' : 'cyan'} />
                      </div>
                    );
                  })}
                </div>
                {i < waves.length - 1 && <ArrowRight className="size-4 self-center text-slate-600" />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <AgentRoster />
    </div>
  );
}
