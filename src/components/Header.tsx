import {
  Bot,
  Cpu,
  GitMerge,
  GitPullRequest,
  OctagonPause,
  Play,
  Radio,
  Send,
  ShieldCheck,
  SquareTerminal,
  Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { useStore } from '../state/context';
import { isMergeable } from '../state/reducer';
import type { TabId } from '../types';
import { Button, StatusDot } from './ui';

export const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'dispatcher', label: 'Task Dispatcher', icon: <Send className="size-4" /> },
  { id: 'swarm', label: 'Swarm Orchestrator', icon: <Workflow className="size-4" /> },
  { id: 'execution', label: 'Live Execution & Terminal', icon: <SquareTerminal className="size-4" /> },
  { id: 'diffs', label: 'PR & Diff Reviewer', icon: <GitPullRequest className="size-4" /> },
  { id: 'webhooks', label: 'Webhook & Alert Hub', icon: <Radio className="size-4" /> },
  { id: 'security', label: 'HITL & Security', icon: <ShieldCheck className="size-4" /> },
];

function CoreIcon({ paused }: { paused: boolean }) {
  return (
    <div className={cn('relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-swarm to-violet-900 ring-1 ring-violet-400/40', !paused && 'animate-pulse-ring')}>
      <div className={cn('absolute inset-1 rounded-lg border border-dashed border-exec/50', !paused && 'animate-spin-slow')} />
      <Cpu className="relative size-5 text-white" />
    </div>
  );
}

export function Header() {
  const { state, dispatch, toast } = useStore();
  const active = state.agents.filter((a) => a.status === 'running').length;
  const blocked = state.agents.filter((a) => a.status === 'blocked').length;
  const approved = state.prs.filter(isMergeable);
  const pendingHitl = state.hitl.filter((h) => h.status === 'pending').length;
  const openPrs = state.prs.filter((p) => p.status === 'open' || p.status === 'changes_requested').length;

  const togglePause = () => {
    const paused = !state.globalPaused;
    dispatch({ type: 'SET_GLOBAL_PAUSE', paused });
    if (!paused && state.cost.tripped) dispatch({ type: 'UPDATE_COST', patch: { tripped: null } });
    toast(paused ? 'danger' : 'success', paused ? 'Emergency pause engaged' : 'Swarm resumed', paused ? 'All agent execution halted. Sandboxes frozen.' : `${active} agents resuming execution`);
  };

  const mergeApproved = () => {
    if (!approved.length) return;
    dispatch({ type: 'MERGE_APPROVED' });
    toast('success', `Merged ${approved.length} approved PR${approved.length > 1 ? 's' : ''}`, approved.map((p) => `#${p.number}`).join(', '));
  };

  const badges: Partial<Record<TabId, { n: number; tone: string }>> = {
    security: pendingHitl ? { n: pendingHitl, tone: 'bg-hitl text-obsidian' } : undefined,
    diffs: openPrs ? { n: openPrs, tone: 'bg-swarm text-white' } : undefined,
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-obsidian/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CoreIcon paused={state.globalPaused} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-xl">
                AgentPulse
              </h1>
              <span className="hidden rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-white/10 sm:inline">v2.4.0</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                  state.globalPaused ? 'bg-danger/10 text-rose-300 ring-danger/40' : 'bg-swarm/10 text-violet-200 ring-swarm/40',
                )}
              >
                <StatusDot tone={state.globalPaused ? 'rose' : 'emerald'} pulse={!state.globalPaused} />
                {state.globalPaused ? 'Devin Swarm: Paused' : `Devin Swarm: ${active} Active Agent${active === 1 ? '' : 's'}`}
              </span>
              {blocked > 0 && (
                <span className="hidden items-center gap-1 text-[11px] text-amber-300 sm:inline-flex">
                  <Bot className="size-3" /> {blocked} awaiting sign-off
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
          <Button variant="primary" icon={<Send className="size-4" />} onClick={() => dispatch({ type: 'SET_COMPOSER', open: true })} className="min-w-0 flex-1 px-2 sm:flex-none sm:px-3.5">
            <span className="hidden md:inline">Dispatch New Brief</span>
            <span className="md:hidden">Dispatch</span>
          </Button>
          <Button
            variant={state.globalPaused ? 'success' : 'danger'}
            icon={state.globalPaused ? <Play className="size-4" /> : <OctagonPause className="size-4" />}
            onClick={togglePause}
            className="min-w-0 flex-1 px-2 sm:flex-none sm:px-3.5"
            aria-pressed={state.globalPaused}
          >
            <span className="hidden md:inline">{state.globalPaused ? 'Resume All Agents' : 'Emergency Pause All'}</span>
            <span className="md:hidden">{state.globalPaused ? 'Resume' : 'Pause All'}</span>
          </Button>
          <Button variant="success" icon={<GitMerge className="size-4" />} onClick={mergeApproved} disabled={!approved.length} className="min-w-0 flex-1 px-2 sm:flex-none sm:px-3.5" title={approved.length ? `Merge ${approved.length} approved PR(s)` : 'No approved PRs'}>
            <span className="hidden md:inline">Merge Approved PRs</span>
            <span className="md:hidden">Merge</span>
            <span className="rounded-full bg-ok/25 px-1.5 font-mono text-[10px]">{approved.length}</span>
          </Button>
        </div>
      </div>

      <nav className="mx-auto max-w-[1600px] px-3 sm:px-6" aria-label="Primary">
        <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const selected = state.activeTab === tab.id;
            const badge = badges[tab.id];
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                className={cn(
                  'group relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  selected ? 'border-swarm text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
                )}
              >
                <span className={cn(selected ? 'text-swarm' : 'text-slate-500 group-hover:text-slate-300')}>{tab.icon}</span>
                {tab.label}
                {badge && <span className={cn('rounded-full px-1.5 font-mono text-[10px] font-semibold', badge.tone)}>{badge.n}</span>}
              </button>
            );
          })}
        </div>
      </nav>
      {state.globalPaused && (
        <div className="border-t border-danger/30 bg-danger/10 px-4 py-1.5 text-center text-xs text-rose-200">
          <OctagonPause className="mr-1.5 inline size-3.5" />
          {state.cost.tripped ? `Cost guardrail tripped: ${state.cost.tripped}.` : 'Emergency pause active — all agent execution and sandbox I/O is frozen.'}{' '}
          <button type="button" className="font-semibold underline underline-offset-2 hover:text-white" onClick={togglePause}>
            Resume swarm
          </button>
        </div>
      )}
    </header>
  );
}
