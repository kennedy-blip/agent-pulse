import { MessageSquarePlus } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { Button, inputCls } from '../components/ui';
import { cn, timeAgo } from '../lib/utils';
import type { DiffFile, DiffLine, InlineComment } from '../types';
import { toSplitRows } from './parseDiff';

export type DiffMode = 'split' | 'unified';

interface Props {
  file: DiffFile;
  mode: DiffMode;
  comments: InlineComment[];
  onComment: (lineKey: string, body: string) => void;
  readOnly?: boolean;
}

const LINE_BG: Record<DiffLine['type'], string> = {
  add: 'bg-ok/[0.09]',
  del: 'bg-danger/[0.09]',
  ctx: '',
};
const GUTTER_BG: Record<DiffLine['type'], string> = {
  add: 'bg-ok/15 text-emerald-300/70',
  del: 'bg-danger/15 text-rose-300/70',
  ctx: 'text-slate-600',
};
const SIGN: Record<DiffLine['type'], string> = { add: '+', del: '-', ctx: ' ' };

function CommentThread({ comments, composing, onSubmit, onCancel }: { comments: InlineComment[]; composing: boolean; onSubmit: (body: string) => void; onCancel: () => void }) {
  const [body, setBody] = useState('');
  if (!comments.length && !composing) return null;
  return (
    <div className="space-y-2 border-y border-swarm/20 bg-swarm/[0.04] px-3 py-2.5 font-sans">
      {comments.map((c) => (
        <div key={c.id} className="rounded-lg bg-surface/80 p-2.5 ring-1 ring-white/5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="grid size-5 place-items-center rounded-full bg-swarm/30 text-[9px] font-bold text-violet-100 uppercase">{c.author.slice(0, 2)}</span>
            <span className="font-medium text-slate-200">{c.author}</span>
            <span className="text-slate-500">{timeAgo(c.ts)}</span>
            {c.kind === 'revision' && <span className="rounded bg-hitl/15 px-1.5 text-[10px] text-amber-300">revision requested</span>}
          </div>
          <p className="mt-1.5 text-xs whitespace-pre-wrap text-slate-300">{c.body}</p>
        </div>
      ))}
      {composing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            onSubmit(body.trim());
            setBody('');
          }}
          className="space-y-2"
        >
          <textarea autoFocus rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave an inline review comment… (agent will address it in the next revision)" className={cn(inputCls, 'text-xs')} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button size="sm" variant="primary" type="submit" disabled={!body.trim()}>Comment</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DiffView({ file, mode, comments, onComment, readOnly }: Props) {
  const [composing, setComposing] = useState<string | null>(null);
  const byKey = new Map<string, InlineComment[]>();
  for (const c of comments) if (c.lineKey) byKey.set(c.lineKey, [...(byKey.get(c.lineKey) ?? []), c]);

  const keyOf = (hunkIdx: number, lineIdx: number) => `${file.path}:${hunkIdx}:${lineIdx}`;

  const addBtn = (key: string): ReactNode =>
    readOnly ? null : (
      <button type="button" aria-label="Add inline comment" onClick={() => setComposing(key)} className="absolute top-0 left-0.5 hidden size-4 place-items-center rounded bg-swarm text-white group-hover:grid focus-visible:grid">
        <MessageSquarePlus className="size-3" />
      </button>
    );

  const thread = (key: string, colSpan: number) => {
    const list = byKey.get(key) ?? [];
    if (!list.length && composing !== key) return null;
    return (
      <tr>
        <td colSpan={colSpan} className="p-0">
          <CommentThread
            comments={list}
            composing={composing === key}
            onCancel={() => setComposing(null)}
            onSubmit={(body) => {
              onComment(key, body);
              setComposing(null);
            }}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse font-mono text-[12px] leading-5">
        {file.hunks.map((hunk, hi) => (
          <tbody key={hunk.header}>
            <tr>
              <td colSpan={mode === 'split' ? 4 : 3} className="bg-exec/[0.06] px-3 py-1 text-[11px] text-cyan-300/80">
                {hunk.header}
              </td>
            </tr>
            {mode === 'unified'
              ? hunk.lines.map((line, li) => {
                  const key = keyOf(hi, li);
                  return (
                    <Fragment key={key}>
                      <tr className={cn('group', LINE_BG[line.type])}>
                        <td className={cn('relative w-11 px-2 text-right select-none', GUTTER_BG[line.type])}>
                          {addBtn(key)}
                          {line.oldNo ?? ''}
                        </td>
                        <td className={cn('w-11 px-2 text-right select-none', GUTTER_BG[line.type])}>{line.newNo ?? ''}</td>
                        <td className="px-3 whitespace-pre text-slate-200">
                          <span className={cn('mr-2 select-none', line.type === 'add' ? 'text-ok' : line.type === 'del' ? 'text-danger' : 'text-slate-600')}>{SIGN[line.type]}</span>
                          {line.content}
                        </td>
                      </tr>
                      {thread(key, 3)}
                    </Fragment>
                  );
                })
              : toSplitRows(hunk.lines).map((row) => {
                  const anchor = row.right ?? row.left;
                  const key = keyOf(hi, anchor ? anchor.idx : 0);
                  const leftKey = row.left ? keyOf(hi, row.left.idx) : null;
                  const extraLeft = leftKey && leftKey !== key ? thread(leftKey, 4) : null;
                  return (
                    <Fragment key={`${key}-${row.left?.idx ?? 'x'}`}>
                      <tr className="group">
                        <td className={cn('relative w-11 px-2 text-right select-none', row.left ? GUTTER_BG[row.left.type] : 'bg-white/[0.02]')}>
                          {row.left && leftKey && addBtn(leftKey)}
                          {row.left?.oldNo ?? ''}
                        </td>
                        <td className={cn('w-1/2 border-r border-white/5 px-3 whitespace-pre text-slate-200', row.left ? LINE_BG[row.left.type] : 'bg-white/[0.02]')}>{row.left?.content ?? ''}</td>
                        <td className={cn('relative w-11 px-2 text-right select-none', row.right ? GUTTER_BG[row.right.type] : 'bg-white/[0.02]')}>
                          {row.right && addBtn(keyOf(hi, row.right.idx))}
                          {row.right?.newNo ?? ''}
                        </td>
                        <td className={cn('w-1/2 px-3 whitespace-pre text-slate-200', row.right ? LINE_BG[row.right.type] : 'bg-white/[0.02]')}>{row.right?.content ?? ''}</td>
                      </tr>
                      {extraLeft}
                      {thread(key, 4)}
                    </Fragment>
                  );
                })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
