import { DollarSign, GitBranch, Sparkles, Wand2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { PRIORITY_META } from '../components/meta';
import { Button, Field, inputCls, Toggle } from '../components/ui';
import { REPOS } from '../data/seed';
import { cn, uid } from '../lib/utils';
import { useStore } from '../state/context';
import { TECH_TAGS, type Brief, type Priority, type TechTag } from '../types';
import { decomposeBrief, wakeIdleAgents } from './decompose';

const TEMPLATES: { title: string; description: string; tags: TechTag[]; repo: string; priority: Priority }[] = [
  {
    title: 'Add OAuth device-flow login to CLI',
    description: 'Implement GitHub OAuth device flow for the CLI, store tokens in the OS keychain, add auth endpoints in the Python API and tests for token refresh.',
    tags: ['Python', 'TypeScript'],
    repo: 'acme/platform-api',
    priority: 'P1',
  },
  {
    title: 'Build cost analytics dashboard page',
    description: 'Create a React dashboard page with charts for per-agent token spend, filterable by repo and date range, backed by a new /v1/costs endpoint.',
    tags: ['React', 'TypeScript', 'Python'],
    repo: 'acme/agentpulse-web',
    priority: 'P2',
  },
  {
    title: 'Migrate workers to Kubernetes with Helm',
    description: 'Containerize the queue workers, write a Helm chart with HPA, and deploy to the staging cluster via CI pipeline.',
    tags: ['Docker', 'Kubernetes'],
    repo: 'acme/infra-k8s',
    priority: 'P2',
  },
];

export function BriefComposer({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const { state, dispatch, toast } = useStore();
  const ids = { title: useId(), desc: useId(), repo: useId(), cap: useId() };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('P1');
  const [repo, setRepo] = useState<string>(REPOS[0]);
  const [tags, setTags] = useState<TechTag[]>(['React', 'TypeScript']);
  const [costCap, setCostCap] = useState(40);
  const [autoRun, setAutoRun] = useState(true);
  const [touched, setTouched] = useState(false);

  const titleError = touched && title.trim().length < 6 ? 'Give the brief a descriptive title (6+ chars)' : null;
  const descError = touched && description.trim().length < 20 ? 'Describe the goal in at least 20 characters' : null;

  const toggleTag = (t: TechTag) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const applyTemplate = (i: number) => {
    const t = TEMPLATES[i];
    setTitle(t.title);
    setDescription(t.description);
    setTags(t.tags);
    setRepo(t.repo);
    setPriority(t.priority);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (title.trim().length < 6 || description.trim().length < 20) return;
    const brief: Brief = {
      id: uid('brf'),
      title: title.trim(),
      description: description.trim(),
      priority,
      repo,
      tags,
      costCap,
      spent: 0,
      status: autoRun ? 'running' : 'queued',
      createdAt: Date.now(),
    };
    const subtasks = autoRun ? decomposeBrief(brief, state.agents) : undefined;
    dispatch({ type: 'ADD_BRIEF', brief, subtasks });
    if (subtasks) wakeIdleAgents(subtasks, state.agents, dispatch);
    toast('success', autoRun ? 'Brief dispatched to swarm' : 'Brief queued', `${brief.title} · ${subtasks ? `${subtasks.length} sub-tasks` : 'awaiting dispatch'}`);
    setTitle('');
    setDescription('');
    setTouched(false);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <Sparkles className="size-3 text-swarm" /> Templates:
        </span>
        {TEMPLATES.map((t, i) => (
          <button key={t.title} type="button" onClick={() => applyTemplate(i)} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/10 hover:bg-swarm/15 hover:text-violet-200">
            {t.title}
          </button>
        ))}
      </div>

      <Field label="Brief title" htmlFor={ids.title}>
        <input id={ids.title} className={cn(inputCls, titleError && 'border-danger/60')} placeholder="e.g. Add rate limiting to public API" value={title} onChange={(e) => setTitle(e.target.value)} />
        {titleError && <p className="text-[11px] text-rose-300">{titleError}</p>}
      </Field>

      <Field label="Natural language brief" htmlFor={ids.desc} hint={`${description.length}/2000`}>
        <textarea
          id={ids.desc}
          rows={compact ? 3 : 4}
          maxLength={2000}
          className={cn(inputCls, 'resize-y', descError && 'border-danger/60')}
          placeholder="Describe the engineering goal, acceptance criteria and constraints. The planner will decompose it into parallel sub-tasks."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {descError && <p className="text-[11px] text-rose-300">{descError}</p>}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority tier">
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-obsidian/70 p-1 ring-1 ring-white/10" role="radiogroup" aria-label="Priority tier">
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                onClick={() => setPriority(p)}
                title={PRIORITY_META[p].label}
                className={cn(
                  'rounded-md py-1.5 font-mono text-xs font-semibold transition',
                  priority === p
                    ? { rose: 'bg-danger/20 text-rose-300', amber: 'bg-hitl/20 text-amber-300', cyan: 'bg-exec/20 text-cyan-300', slate: 'bg-slate-500/25 text-slate-200', violet: '', emerald: '' }[PRIORITY_META[p].tone]
                    : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Target repository" htmlFor={ids.repo}>
          <div className="relative">
            <GitBranch className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-500" />
            <select id={ids.repo} className={cn(inputCls, 'pl-8 font-mono text-xs')} value={repo} onChange={(e) => setRepo(e.target.value)}>
              {REPOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <Field label="Tech stack tags" hint={`${tags.length} selected`}>
        <div className="flex flex-wrap gap-1.5">
          {TECH_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition', on ? 'bg-swarm/20 text-violet-200 ring-swarm/50' : 'bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200')}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Compute cost cap" htmlFor={ids.cap} hint={<span className="font-mono text-slate-300">${costCap}</span>}>
        <div className="flex items-center gap-3">
          <DollarSign className="size-4 text-slate-500" />
          <input id={ids.cap} type="range" min={5} max={250} step={5} value={costCap} onChange={(e) => setCostCap(Number(e.target.value))} className="w-full accent-violet-500" />
        </div>
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <Toggle checked={autoRun} onChange={setAutoRun} label="Auto-decompose and run" size="sm" />
          Auto-decompose & dispatch immediately
        </label>
        <Button type="submit" variant="primary" icon={<Wand2 className="size-4" />}>
          {autoRun ? 'Decompose & Dispatch' : 'Add to Queue'}
        </Button>
      </div>
    </form>
  );
}
