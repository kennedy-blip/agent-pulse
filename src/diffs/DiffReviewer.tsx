import { CheckCircle2, ChevronDown, Circle, Columns2, FileCode2, GitBranch, GitMerge, GitPullRequest, Loader2, MessageSquare, Rows3, ThumbsUp, Undo2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { PR_STATUS_META } from '../components/meta';
import { Badge, Button, Card, CardHeader, EmptyState, inputCls, Modal } from '../components/ui';
import { cn, timeAgo, uid } from '../lib/utils';
import { useStore } from '../state/context';
import type { PrStatus, PullRequest } from '../types';
import { DiffView, type DiffMode } from './DiffView';
import { diffStats } from './parseDiff';

const OPERATOR = 'kennedy';

function ChecksRow({ pr }: { pr: PullRequest }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {pr.checks.map((c) => (
        <span key={c.name} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] ring-1 ring-inset', c.status === 'passed' ? 'text-emerald-300 ring-ok/30' : c.status === 'failed' ? 'text-rose-300 ring-danger/30' : 'text-cyan-300 ring-exec/30')}>
          {c.status === 'passed' ? <CheckCircle2 className="size-3" /> : c.status === 'failed' ? <XCircle className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
          {c.name}
        </span>
      ))}
    </div>
  );
}

export function DiffReviewer() {
  const { state, dispatch, toast } = useStore();
  const [mode, setMode] = useState<DiffMode>('split');
  const [statusFilter, setStatusFilter] = useState<PrStatus | 'all'>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const prs = state.prs.filter((p) => statusFilter === 'all' || p.status === statusFilter);
  const pr = state.prs.find((p) => p.id === state.selectedPrId) ?? prs[0];
  const agentName = (id: string) => state.agents.find((a) => a.id === id)?.name ?? id;

  if (!pr) {
    return <Card><EmptyState icon={<GitPullRequest className="size-5" />} title="No pull requests yet" body="Agents open PRs automatically when a brief completes." /></Card>;
  }

  const stats = diffStats(pr.files);
  const checksPassing = pr.checks.every((c) => c.status === 'passed');
  const generalComments = pr.comments.filter((c) => !c.lineKey);

  const comment = (lineKey: string | null, body: string, kind: 'comment' | 'revision' | 'approval' = 'comment') =>
    dispatch({ type: 'ADD_PR_COMMENT', id: pr.id, comment: { id: uid('c'), lineKey, author: OPERATOR, body, ts: Date.now(), kind } });

  const approve = () => {
    dispatch({ type: 'SET_PR_STATUS', id: pr.id, status: 'approved' });
    comment(null, 'Approved — patch looks good.', 'approval');
    toast('success', `PR #${pr.number} approved`, 'Ready to merge from the header quick action');
  };

  const merge = () => {
    dispatch({ type: 'SET_PR_STATUS', id: pr.id, status: 'merged' });
    toast('success', `PR #${pr.number} merged into ${pr.base}`, `${pr.branch} · ${pr.commit}`);
  };

  const requestRevision = () => {
    const note = revisionNote.trim() || 'Please address the inline comments.';
    comment(null, note, 'revision');
    dispatch({ type: 'UPDATE_PR', id: pr.id, patch: { status: 'changes_requested', revisionDueAt: Date.now() + 9000 } });
    dispatch({ type: 'PUSH_STREAM', events: [{ id: uid('ev'), ts: Date.now(), agentId: pr.agentId, kind: 'think', title: `Addressing review feedback on PR #${pr.number}`, detail: note, status: 'info' }] });
    toast('warning', `Revision requested on PR #${pr.number}`, `${agentName(pr.agentId)} is revising the patch`);
    setRevisionOpen(false);
    setRevisionNote('');
  };

  const toggleFile = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit lg:sticky lg:top-36">
        <CardHeader icon={<GitPullRequest className="size-4 text-swarm" />} title="Pull Requests" subtitle={`${state.prs.length} total · ${state.prs.filter((p) => p.status === 'approved').length} approved`} />
        <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2 scrollbar-thin">
          {(['all', 'open', 'changes_requested', 'approved', 'merged'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)} className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-medium', statusFilter === s ? 'bg-swarm/20 text-violet-200' : 'text-slate-400 hover:bg-white/5')}>
              {s === 'all' ? 'All' : PR_STATUS_META[s].label}
            </button>
          ))}
        </div>
        <ul className="max-h-[50vh] divide-y divide-white/5 overflow-y-auto scrollbar-thin lg:max-h-[calc(100vh-280px)]">
          {prs.map((p) => {
            const s = diffStats(p.files);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => dispatch({ type: 'SELECT_PR', id: p.id })} className={cn('w-full px-4 py-3 text-left transition', p.id === pr.id ? 'bg-swarm/[0.08]' : 'hover:bg-white/[0.03]')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-500">#{p.number}</span>
                    <Badge tone={PR_STATUS_META[p.status].tone}>{PR_STATUS_META[p.status].label}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-200">{p.title}</p>
                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-cyan-300/80">{p.repo}</span>
                    <span className="text-emerald-400">+{s.additions}</span>
                    <span className="text-rose-400">−{s.deletions}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={PR_STATUS_META[pr.status].tone} dot>{PR_STATUS_META[pr.status].label}</Badge>
                  <span className="font-mono text-xs text-slate-500">#{pr.number}</span>
                </div>
                <h2 className="mt-1.5 text-base font-semibold text-slate-100">{pr.title}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-mono"><GitBranch className="size-3.5" /><span className="text-cyan-300">{pr.branch}</span> → <span className="text-slate-300">{pr.base}</span></span>
                  <span className="font-mono">commit <span className="text-violet-300">{pr.commit}</span></span>
                  <span>by {agentName(pr.agentId)} · {timeAgo(pr.createdAt)}</span>
                  <span className="font-mono"><span className="text-emerald-400">+{stats.additions}</span> <span className="text-rose-400">−{stats.deletions}</span> in {pr.files.length} files</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {pr.status !== 'merged' && (
                  <>
                    <Button variant="warning" size="sm" icon={<Undo2 className="size-3.5" />} onClick={() => setRevisionOpen(true)} disabled={pr.status === 'changes_requested'}>
                      Request revision
                    </Button>
                    {pr.status !== 'approved' ? (
                      <Button variant="success" size="sm" icon={<ThumbsUp className="size-3.5" />} onClick={approve} disabled={pr.status === 'changes_requested'}>
                        Approve patch
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" icon={<GitMerge className="size-3.5" />} onClick={merge} disabled={!checksPassing} title={checksPassing ? undefined : 'Waiting for CI checks'}>
                        Merge now
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <ChecksRow pr={pr} />
            {generalComments.length > 0 && (
              <div className="space-y-2 border-t border-white/5 pt-3">
                {generalComments.map((c) => (
                  <div key={c.id} className="flex gap-2 text-xs">
                    <MessageSquare className={cn('mt-0.5 size-3.5 shrink-0', c.kind === 'approval' ? 'text-ok' : c.kind === 'revision' ? 'text-hitl' : 'text-slate-500')} />
                    <p className="text-slate-300"><span className="font-medium text-slate-100">{c.author}</span> <span className="text-slate-500">{timeAgo(c.ts)}</span> — {c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">Hover a line and click <MessageSquare className="inline size-3" /> to comment inline.</p>
          <div className="flex rounded-lg bg-obsidian/70 p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Diff layout">
            <button type="button" role="tab" aria-selected={mode === 'split'} onClick={() => setMode('split')} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs', mode === 'split' ? 'bg-swarm/25 text-violet-100' : 'text-slate-400')}><Columns2 className="size-3.5" /> Side-by-side</button>
            <button type="button" role="tab" aria-selected={mode === 'unified'} onClick={() => setMode('unified')} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs', mode === 'unified' ? 'bg-swarm/25 text-violet-100' : 'text-slate-400')}><Rows3 className="size-3.5" /> Unified</button>
          </div>
        </div>

        {pr.files.map((file) => {
          const s = diffStats([file]);
          const fileComments = pr.comments.filter((c) => c.lineKey?.startsWith(`${file.path}:`));
          const isCollapsed = collapsed.has(file.path);
          return (
            <Card key={file.path} className="overflow-hidden">
              <button type="button" onClick={() => toggleFile(file.path)} className="flex w-full items-center gap-2 border-b border-white/5 px-4 py-2.5 text-left hover:bg-white/[0.02]" aria-expanded={!isCollapsed}>
                <ChevronDown className={cn('size-4 text-slate-500 transition', isCollapsed && '-rotate-90')} />
                <FileCode2 className="size-4 text-slate-400" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-200">{file.path}</span>
                {file.status === 'added' && <Badge tone="emerald">new</Badge>}
                {fileComments.length > 0 && <span className="flex items-center gap-1 text-[11px] text-violet-300"><MessageSquare className="size-3" />{fileComments.length}</span>}
                <span className="font-mono text-[11px] text-emerald-400">+{s.additions}</span>
                <span className="font-mono text-[11px] text-rose-400">−{s.deletions}</span>
                <span className="hidden gap-0.5 sm:flex">
                  {Array.from({ length: 5 }, (_, i) => {
                    const total = s.additions + s.deletions || 1;
                    const greens = Math.round((s.additions / total) * 5);
                    return <Circle key={i} className={cn('size-2 fill-current', i < greens ? 'text-ok' : 'text-danger')} />;
                  })}
                </span>
              </button>
              {!isCollapsed && (
                <DiffView file={file} mode={mode} comments={pr.comments} readOnly={pr.status === 'merged'} onComment={(key, body) => { comment(key, body); toast('info', 'Inline comment added', file.path); }} />
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={revisionOpen} onClose={() => setRevisionOpen(false)} title={`Request revision · PR #${pr.number}`}>
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{agentName(pr.agentId)} will receive your note plus all inline comments and push a new revision.</p>
          <textarea rows={4} className={inputCls} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="e.g. Add exponential backoff to the SSE reconnect and cover it with a unit test." autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRevisionOpen(false)}>Cancel</Button>
            <Button variant="warning" icon={<Undo2 className="size-4" />} onClick={requestRevision}>Send to agent</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
