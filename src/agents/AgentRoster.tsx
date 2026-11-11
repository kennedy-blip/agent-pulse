import { Bot, Pause, Play, Power } from 'lucide-react';
import { AGENT_STATUS_META, ROLE_META } from '../components/meta';
import { Badge, Button, Card, CardHeader, ProgressBar, TONE_TEXT } from '../components/ui';
import { cn, formatTokens, formatUsd } from '../lib/utils';
import { useStore } from '../state/context';

export function AgentRoster() {
  const { state, dispatch, toast } = useStore();
  return (
    <Card>
      <CardHeader
        icon={<Bot className="size-4 text-swarm" />}
        title="Agent Roster"
        subtitle={`${state.agents.filter((a) => a.status === 'running').length}/${state.agents.length} agents online`}
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
        {state.agents.map((agent) => {
          const st = agent.currentSubtaskId ? state.subtasks.find((s) => s.id === agent.currentSubtaskId) : undefined;
          const meta = AGENT_STATUS_META[agent.status];
          const role = ROLE_META[agent.role];
          const live = agent.status === 'running' && !state.globalPaused;
          return (
            <div key={agent.id} className={cn('rounded-xl border bg-white/[0.02] p-3.5 transition', live && st ? 'border-exec/25' : 'border-white/5')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 font-mono text-[10px] font-bold ring-1 ring-white/10', TONE_TEXT[role.tone])}>{role.short}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{agent.name}</p>
                    <p className="truncate font-mono text-[11px] text-slate-500">{agent.model}</p>
                  </div>
                </div>
                <Badge tone={state.globalPaused && agent.status === 'running' ? 'slate' : meta.tone} dot pulse={live}>
                  {state.globalPaused && agent.status === 'running' ? 'Frozen' : meta.label}
                </Badge>
              </div>
              <div className="mt-3 min-h-9">
                {st ? (
                  <>
                    <p className="truncate text-xs text-slate-300" title={st.title}>{st.title}</p>
                    <ProgressBar className="mt-1.5" value={st.progress} tone={st.status === 'blocked' ? 'amber' : 'cyan'} />
                  </>
                ) : (
                  <p className="text-xs text-slate-500">{agent.status === 'running' ? 'Waiting for unblocked sub-tasks…' : 'No assignment'}</p>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div><p className="text-slate-500">tok/min</p><p className="text-cyan-300">{formatTokens(agent.tokensPerMin)}</p></div>
                <div><p className="text-slate-500">spent</p><p className="text-slate-200">{formatUsd(agent.spent)}</p></div>
                <div><p className="text-slate-500">done</p><p className="text-emerald-300">{agent.completedTasks}</p></div>
              </div>
              <div className="mt-3 flex gap-1.5">
                {agent.status === 'running' && (
                  <Button size="sm" className="flex-1" icon={<Pause className="size-3.5" />} onClick={() => dispatch({ type: 'SET_AGENT_STATUS', id: agent.id, status: 'paused' })}>
                    Pause
                  </Button>
                )}
                {(agent.status === 'paused' || agent.status === 'idle') && (
                  <Button
                    size="sm"
                    variant="success"
                    className="flex-1"
                    icon={agent.status === 'idle' ? <Power className="size-3.5" /> : <Play className="size-3.5" />}
                    onClick={() => {
                      dispatch({ type: 'SET_AGENT_STATUS', id: agent.id, status: 'running' });
                      toast('info', `${agent.name} ${agent.status === 'idle' ? 'spun up' : 'resumed'}`, `${formatTokens(agent.baseTokensPerMin)} tok/min budgeted`);
                    }}
                  >
                    {agent.status === 'idle' ? 'Spin up' : 'Resume'}
                  </Button>
                )}
                {agent.status === 'blocked' && (
                  <Button size="sm" variant="warning" className="flex-1" onClick={() => dispatch({ type: 'SET_TAB', tab: 'security' })}>
                    Review HITL request
                  </Button>
                )}
                {agent.status !== 'idle' && agent.status !== 'blocked' && (
                  <Button size="sm" variant="ghost" aria-label={`Shut down ${agent.name}`} icon={<Power className="size-3.5" />} onClick={() => { dispatch({ type: 'SET_AGENT_STATUS', id: agent.id, status: 'idle' }); dispatch({ type: 'UPDATE_AGENT', id: agent.id, patch: { currentSubtaskId: null } }); if (st && st.status === 'running') dispatch({ type: 'UPDATE_SUBTASK', id: st.id, patch: { status: 'pending' } }); }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
