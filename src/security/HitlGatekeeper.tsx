import { AlertTriangle, Check, Clock, FlaskConical, Plus, ShieldAlert, ShieldCheck, ShieldX, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RISK_META } from '../components/meta';
import { Badge, Button, Card, CardHeader, EmptyState, inputCls, Modal, Toggle } from '../components/ui';
import { cn, timeAgo, uid } from '../lib/utils';
import { useStore } from '../state/context';
import type { HitlCategory, HitlRequest, RiskLevel } from '../types';
import { CATEGORY_LABEL, classifyCommand } from './policy';

type View = 'pending' | 'history';

function PolicyForm({ onDone }: { onDone: () => void }) {
  const { dispatch, toast } = useStore();
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [risk, setRisk] = useState<RiskLevel>('high');
  const [category, setCategory] = useState<HitlCategory>('destructive_shell');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pattern.trim()) return setError('Name and pattern are required');
    try {
      new RegExp(pattern, 'i');
    } catch (err) {
      return setError(`Invalid regex: ${(err as Error).message}`);
    }
    dispatch({ type: 'ADD_POLICY', policy: { id: uid('pol'), name: name.trim(), description: `Custom rule · /${pattern}/i`, pattern, risk, category, enabled: true } });
    toast('success', 'Policy added', name.trim());
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <input aria-label="Policy name" className={inputCls} placeholder="Policy name, e.g. Block npm publish" value={name} onChange={(e) => setName(e.target.value)} />
      <input aria-label="Regex pattern" className={cn(inputCls, 'font-mono text-xs')} placeholder={String.raw`regex, e.g. \bnpm\s+publish\b`} value={pattern} onChange={(e) => { setPattern(e.target.value); setError(null); }} />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Risk" className={inputCls} value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
          {(['medium', 'high', 'critical'] as const).map((r) => <option key={r} value={r}>{RISK_META[r].label}</option>)}
        </select>
        <select aria-label="Category" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as HitlCategory)}>
          {(Object.keys(CATEGORY_LABEL) as HitlCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" icon={<Plus className="size-4" />}>Add policy</Button>
      </div>
    </form>
  );
}

function RequestCard({ req }: { req: HitlRequest }) {
  const { state, dispatch, toast } = useStore();
  const [note, setNote] = useState('');
  const agent = state.agents.find((a) => a.id === req.agentId);
  const brief = state.briefs.find((b) => b.id === req.briefId);
  const policy = state.policies.find((p) => p.id === req.policyId);
  const decide = (status: 'approved' | 'rejected') => {
    dispatch({ type: 'DECIDE_HITL', id: req.id, status, note: note.trim() || undefined });
    toast(status === 'approved' ? 'success' : 'warning', `${req.id} ${status}`, `${agent?.name ?? req.agentId}: ${req.command}`);
  };
  return (
    <div className={cn('rounded-xl border p-4', req.risk === 'critical' ? 'border-danger/40 bg-danger/[0.04]' : 'border-hitl/30 bg-hitl/[0.03]')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={RISK_META[req.risk].tone} dot pulse>{RISK_META[req.risk].label}</Badge>
        <Badge tone="slate">{CATEGORY_LABEL[req.category]}</Badge>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500"><Clock className="size-3" />{timeAgo(req.ts)}</span>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-[#05070d] px-3 py-2 font-mono text-xs text-amber-200 ring-1 ring-white/5 scrollbar-thin"><span className="text-slate-500 select-none">$ </span>{req.command}</pre>
      <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
        <div><dt className="inline text-slate-500">Agent: </dt><dd className="inline text-slate-200">{agent?.name ?? req.agentId}</dd></div>
        <div><dt className="inline text-slate-500">Policy: </dt><dd className="inline text-slate-200">{policy?.name ?? req.policyId}</dd></div>
        {brief && <div className="sm:col-span-2"><dt className="inline text-slate-500">Brief: </dt><dd className="inline text-slate-200">{brief.title}</dd></div>}
        <div className="sm:col-span-2"><dt className="inline text-slate-500">Reason: </dt><dd className="inline text-slate-300">{req.reason}</dd></div>
      </dl>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input aria-label="Decision note" className={cn(inputCls, 'h-8 py-0 text-xs')} placeholder="Optional note to the agent…" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="danger" icon={<X className="size-3.5" />} onClick={() => decide('rejected')} className="flex-1">Reject</Button>
          <Button size="sm" variant="success" icon={<Check className="size-3.5" />} onClick={() => decide('approved')} className="flex-1">Approve & run</Button>
        </div>
      </div>
    </div>
  );
}

export function HitlGatekeeper() {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<View>('pending');
  const [testCmd, setTestCmd] = useState('git push origin main --force');
  const [adding, setAdding] = useState(false);
  const pending = state.hitl.filter((h) => h.status === 'pending');
  const history = state.hitl.filter((h) => h.status !== 'pending').sort((a, b) => (b.decidedAt ?? b.ts) - (a.decidedAt ?? a.ts));
  const match = testCmd.trim() ? classifyCommand(testCmd, state.policies) : null;
  const agentName = (id: string) => state.agents.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={<ShieldAlert className="size-4 text-hitl" />}
          title="Destructive Action Gatekeeper"
          subtitle={`${pending.length} awaiting sign-off · agents are blocked until a human decides`}
          actions={
            <div className="flex rounded-lg bg-obsidian/70 p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Request view">
              {(['pending', 'history'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded-md px-2.5 py-1 text-xs capitalize', view === v ? 'bg-hitl/20 text-amber-200' : 'text-slate-400')}>
                  {v} {v === 'pending' ? `(${pending.length})` : `(${history.length})`}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-4 sm:p-5">
          {view === 'pending' ? (
            pending.length ? (
              <div className="grid gap-3 lg:grid-cols-2">{pending.map((r) => <RequestCard key={r.id} req={r} />)}</div>
            ) : (
              <EmptyState icon={<ShieldCheck className="size-5 text-ok" />} title="No pending approvals" body="Risky commands issued by agents will appear here for sign-off." />
            )
          ) : history.length ? (
            <ul className="divide-y divide-white/5">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-xs">
                  {h.status === 'approved' ? <ShieldCheck className="size-4 text-ok" /> : <ShieldX className="size-4 text-danger" />}
                  <code className="min-w-0 flex-1 truncate font-mono text-slate-200">{h.command}</code>
                  <span className="text-slate-400">{agentName(h.agentId)}</span>
                  <Badge tone={h.status === 'approved' ? 'emerald' : 'rose'}>{h.status}</Badge>
                  <span className="text-slate-500">{timeAgo(h.decidedAt ?? h.ts)}</span>
                  {h.decisionNote && <p className="w-full pl-7 text-slate-400">“{h.decisionNote}”</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Clock className="size-5" />} title="No decisions yet" />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader icon={<ShieldCheck className="size-4 text-swarm" />} title="Interception Policies" subtitle={`${state.policies.filter((p) => p.enabled).length}/${state.policies.length} active`} actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>Add policy</Button>} />
        <div className="space-y-3 p-4 sm:p-5">
          <div className="rounded-xl bg-obsidian/60 p-3 ring-1 ring-white/5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300" htmlFor="policy-test"><FlaskConical className="size-3.5 text-exec" /> Policy dry-run</label>
            <input id="policy-test" className={cn(inputCls, 'mt-2 font-mono text-xs')} value={testCmd} onChange={(e) => setTestCmd(e.target.value)} placeholder="Type a command to test against policies" />
            <p className={cn('mt-2 flex items-center gap-1.5 text-xs', match ? 'text-amber-300' : 'text-emerald-300')}>
              {match ? <AlertTriangle className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {testCmd.trim() ? (match ? `Would be intercepted by “${match.name}” (${match.risk})` : 'Allowed — no active policy matches') : 'Enter a command'}
            </p>
          </div>
          <ul className="grid gap-2 md:grid-cols-2">
            {state.policies.map((p) => (
              <li key={p.id} className={cn('flex min-w-0 items-start gap-3 rounded-xl p-3 ring-1 ring-white/5', match?.id === p.id ? 'bg-hitl/[0.08] ring-hitl/40' : 'bg-white/[0.02]')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-100">{p.name}</p>
                    <Badge tone={RISK_META[p.risk].tone}>{p.risk}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{p.description}</p>
                  <code className="mt-1 block truncate font-mono text-[10px] text-slate-500">/{p.pattern}/i</code>
                </div>
                <Toggle checked={p.enabled} onChange={() => dispatch({ type: 'TOGGLE_POLICY', id: p.id })} label={`Toggle ${p.name}`} tone="amber" />
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Modal open={adding} onClose={() => setAdding(false)} title="New interception policy">
        <PolicyForm onDone={() => setAdding(false)} />
      </Modal>
    </div>
  );
}
