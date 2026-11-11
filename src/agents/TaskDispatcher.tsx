import {
  CheckCircle2,
  Clock,
  Hourglass,
  Inbox,
  ListTodo,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BRIEF_STATUS_META, PRIORITY_META } from '../components/meta';
import { Badge, Button, Card, CardHeader, EmptyState, inputCls, ProgressBar, Stat } from '../components/ui';
import { cn, formatUsd, timeAgo } from '../lib/utils';
import { useStore } from '../state/context';
import type { Brief, BriefStatus } from '../types';
import { BriefComposer } from './BriefComposer';
import { decomposeBrief, wakeIdleAgents } from './decompose';

type Filter = 'all' | 'active' | 'queued' | 'done' | 'failed';
const FILTERS: { id: Filter; label: string; match: (s: BriefStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'active', label: 'Active', match: (s) => s === 'running' || s === 'awaiting_hitl' || s === 'paused' },
  { id: 'queued', label: 'Queued', match: (s) => s === 'queued' },
  { id: 'done', label: 'Completed', match: (s) => s === 'completed' },
  { id: 'failed', label: 'Failed / Cancelled', match: (s) => s === 'failed' || s === 'cancelled' },
];

function BriefCard({ brief }: { brief: Brief }) {
  const { state, dispatch, toast } = useStore();
  const subs = state.subtasks.filter((s) => s.briefId === brief.id);
  const done = subs.filter((s) => s.status === 'done').length;
  const pct = subs.length ? (subs.reduce((a, s) => a + s.progress, 0) / subs.length) : 0;
  const status = BRIEF_STATUS_META[brief.status];
  const prio = PRIORITY_META[brief.priority];
  const costPct = (brief.spent / brief.costCap) * 100;
  const pr = brief.prId ? state.prs.find((p) => p.id === brief.prId) : undefined;

  const dispatchBrief = () => {
    const subtasks = subs.length ? subs : decomposeBrief(brief, state.agents);
    if (!subs.length) dispatch({ type: 'SET_SUBTASKS', briefId: brief.id, subtasks });
    dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'running' });
    wakeIdleAgents(subtasks, state.agents, dispatch);
    toast('info', 'Brief dispatched', `${brief.title} → ${subtasks.length} sub-tasks`);
  };

  const viewInSwarm = () => {
    dispatch({ type: 'SELECT_BRIEF', id: brief.id });
    dispatch({ type: 'SET_TAB', tab: 'swarm' });
  };

  return (
    <article className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-swarm/30 hover:bg-white/[0.035] animate-slide-in">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={prio.tone}>{prio.label}</Badge>
            <Badge tone={status.tone} dot pulse={status.pulse}>{status.label}</Badge>
            {pr && (
              <button type="button" onClick={() => { dispatch({ type: 'SELECT_PR', id: pr.id }); dispatch({ type: 'SET_TAB', tab: 'diffs' }); }}>
                <Badge tone="violet" className="hover:ring-swarm/60">PR #{pr.number}</Badge>
              </button>
            )}
          </div>
          <h4 className="text-sm font-semibold text-slate-100">{brief.title}</h4>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{brief.description}</p>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Clock className="size-3" /> {timeAgo(brief.createdAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-obsidian/80 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 ring-1 ring-white/5">{brief.repo}</span>
        {brief.tags.map((t) => (
          <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-300">{t}</span>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>Sub-tasks {subs.length ? `${done}/${subs.length}` : '— not decomposed'}</span>
            <span className="font-mono">{Math.round(pct)}%</span>
          </div>
          <ProgressBar value={pct} tone={brief.status === 'failed' ? 'rose' : brief.status === 'completed' ? 'emerald' : 'cyan'} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>Cost cap</span>
            <span className="font-mono">
              {formatUsd(brief.spent)} / {formatUsd(brief.costCap, 0)}
            </span>
          </div>
          <ProgressBar value={costPct} tone={costPct > 90 ? 'rose' : costPct > 70 ? 'amber' : 'violet'} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
        {brief.status === 'queued' && (
          <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} onClick={dispatchBrief}>
            Decompose & Run
          </Button>
        )}
        {(brief.status === 'running' || brief.status === 'awaiting_hitl') && (
          <Button size="sm" icon={<Pause className="size-3.5" />} onClick={() => dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'paused' })}>
            Pause
          </Button>
        )}
        {brief.status === 'paused' && (
          <Button
            size="sm"
            variant="success"
            icon={<Play className="size-3.5" />}
            disabled={brief.spent >= brief.costCap}
            title={brief.spent >= brief.costCap ? 'Raise the cost cap to resume' : undefined}
            onClick={() => dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'running' })}
          >
            Resume
          </Button>
        )}
        {brief.status === 'paused' && brief.spent >= brief.costCap && (
          <Button size="sm" variant="warning" onClick={() => dispatch({ type: 'UPDATE_BRIEF', id: brief.id, patch: { costCap: brief.costCap + 25 } })}>
            +$25 cap
          </Button>
        )}
        {(brief.status === 'failed' || brief.status === 'cancelled') && (
          <Button size="sm" variant="warning" icon={<RotateCcw className="size-3.5" />} onClick={() => { dispatch({ type: 'RETRY_BRIEF', id: brief.id }); wakeIdleAgents(subs, state.agents, dispatch); toast('info', 'Retrying brief', brief.title); }}>
            Retry
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<Workflow className="size-3.5" />} onClick={viewInSwarm}>
          View in Swarm
        </Button>
        <div className="ml-auto flex gap-1.5">
          {brief.status !== 'completed' && brief.status !== 'cancelled' && brief.status !== 'failed' && (
            <Button size="sm" variant="ghost" icon={<XCircle className="size-3.5" />} onClick={() => { dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'cancelled' }); toast('warning', 'Brief cancelled', brief.title); }}>
              Cancel
            </Button>
          )}
          <Button size="sm" variant="ghost" aria-label="Remove brief" icon={<Trash2 className="size-3.5" />} onClick={() => dispatch({ type: 'REMOVE_BRIEF', id: brief.id })} />
        </div>
      </div>
    </article>
  );
}

export function TaskDispatcher() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'priority' | 'newest' | 'cost'>('priority');

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    const list = state.briefs.filter(
      (b) => f.match(b.status) && (!q || `${b.title} ${b.repo} ${b.tags.join(' ')}`.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) =>
      sort === 'priority' ? a.priority.localeCompare(b.priority) || b.createdAt - a.createdAt : sort === 'newest' ? b.createdAt - a.createdAt : b.spent - a.spent,
    );
  }, [state.briefs, filter, query, sort]);

  const count = (s: BriefStatus[]) => state.briefs.filter((b) => s.includes(b.status)).length;
  const committed = state.briefs.filter((b) => b.status !== 'cancelled').reduce((a, b) => a + b.costCap, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Queued" value={count(['queued'])} icon={<Inbox className="size-4" />} sub="Awaiting dispatch" />
        <Stat label="Running" value={count(['running'])} icon={<Hourglass className="size-4" />} tone="cyan" sub={`${state.subtasks.filter((s) => s.status === 'running').length} sub-tasks executing`} />
        <Stat label="Awaiting HITL" value={count(['awaiting_hitl'])} icon={<ListTodo className="size-4" />} tone="amber" sub="Blocked on human sign-off" />
        <Stat label="Completed" value={count(['completed'])} icon={<CheckCircle2 className="size-4" />} tone="emerald" sub={`${formatUsd(committed, 0)} total budget committed`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="h-fit">
          <CardHeader icon={<Send className="size-4 text-swarm" />} title="Natural Language Brief" subtitle="Describe the goal — the planner agent decomposes it into parallel sub-tasks" />
          <div className="p-4 sm:p-5">
            <BriefComposer />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<ListTodo className="size-4 text-exec" />}
            title="Brief Queue"
            subtitle={`${state.briefs.length} briefs · sorted by ${sort}`}
            actions={
              <select aria-label="Sort briefs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={cn(inputCls, 'h-8 w-auto py-0 text-xs')}>
                <option value="priority">Priority</option>
                <option value="newest">Newest</option>
                <option value="cost">Spend</option>
              </select>
            }
          />
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-500" />
                <input aria-label="Search briefs" className={cn(inputCls, 'h-8 pl-8 text-xs')} placeholder="Search title, repo or tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-thin">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-pressed={filter === f.id}
                    className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition', filter === f.id ? 'bg-swarm/20 text-violet-200' : 'text-slate-400 hover:bg-white/5')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[calc(100vh-320px)] min-h-64 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
              {visible.length ? visible.map((b) => <BriefCard key={b.id} brief={b} />) : <EmptyState icon={<Inbox className="size-5" />} title="No briefs match" body="Adjust filters or dispatch a new brief." />}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
