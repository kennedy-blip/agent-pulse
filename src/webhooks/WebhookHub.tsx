import { Check, Copy, Eye, EyeOff, KeyRound, Link2, Plus, Radio, RefreshCw, Send, ShieldCheck, Trash2, Webhook, Zap } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Badge, Button, Card, CardHeader, EmptyState, Field, inputCls, Toggle } from '../components/ui';
import { cn, copyText, formatClock, hmacSha256, randomHex, timingSafeEqual, uid } from '../lib/utils';
import { useStore } from '../state/context';
import { WEBHOOK_EVENTS, type EndpointKind, type WebhookDelivery, type WebhookEndpoint, type WebhookEvent } from '../types';
import { detectKind, EVENT_META, type SignedRequest } from './payloads';

const KIND_LABEL: Record<EndpointKind, string> = { slack: 'Slack', discord: 'Discord', custom: 'Custom API' };
const KIND_CLS: Record<EndpointKind, string> = { slack: 'bg-emerald-500/15 text-emerald-300', discord: 'bg-indigo-500/20 text-indigo-300', custom: 'bg-cyan-500/15 text-cyan-300' };

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts.pop() ?? '';
    return `${u.host}/${[...parts, last.length > 6 ? `${last.slice(0, 3)}•••${last.slice(-2)}` : last].join('/')}`;
  } catch {
    return url;
  }
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const { dispatch, toast } = useStore();
  const ids = { name: useId(), url: useId(), secret: useId() };
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState(() => `whsec_${randomHex(16)}`);
  const [events, setEvents] = useState<Record<WebhookEvent, boolean>>({ 'task.completed': true, 'task.failed': true, 'pr.created': true, 'hitl.approval_required': true });
  const [error, setError] = useState<string | null>(null);
  const kind = detectKind(url);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setError('Enter a valid URL');
      return;
    }
    if (parsed.protocol !== 'https:') return setError('Webhook targets must use HTTPS');
    if (secret.length < 16) return setError('Signing secret must be at least 16 characters');
    if (!Object.values(events).some(Boolean)) return setError('Subscribe to at least one event');
    const endpoint: WebhookEndpoint = { id: uid('wh'), name: name.trim() || `${KIND_LABEL[kind]} · ${parsed.host}`, url, kind, secret, enabled: true, events, createdAt: Date.now() };
    dispatch({ type: 'ADD_ENDPOINT', endpoint });
    toast('success', 'Endpoint registered', endpoint.name);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-b border-white/5 bg-swarm/[0.03] p-4 sm:p-5" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display name" htmlFor={ids.name}>
          <input id={ids.name} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack · #deploys" />
        </Field>
        <Field label="Target URL" htmlFor={ids.url} hint={url ? <span className={cn('rounded px-1.5 py-0.5', KIND_CLS[kind])}>{KIND_LABEL[kind]}</span> : 'Slack, Discord or any HTTPS endpoint'}>
          <input id={ids.url} className={cn(inputCls, 'font-mono text-xs')} value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} placeholder="https://hooks.slack.com/services/…" />
        </Field>
      </div>
      <Field label="HMAC SHA-256 signing secret" htmlFor={ids.secret}>
        <div className="flex gap-2">
          <input id={ids.secret} className={cn(inputCls, 'font-mono text-xs')} value={secret} onChange={(e) => setSecret(e.target.value)} />
          <Button icon={<RefreshCw className="size-3.5" />} onClick={() => setSecret(`whsec_${randomHex(16)}`)}>Generate</Button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-3">
        {WEBHOOK_EVENTS.map((ev) => (
          <label key={ev} className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
            <Toggle size="sm" checked={events[ev]} onChange={(v) => setEvents((p) => ({ ...p, [ev]: v }))} label={ev} />
            {ev}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" icon={<Plus className="size-4" />}>Register endpoint</Button>
      </div>
    </form>
  );
}

function EndpointCard({ endpoint, onPing }: { endpoint: WebhookEndpoint; onPing: (ep: WebhookEndpoint, ev: WebhookEvent) => void }) {
  const { state, dispatch, toast } = useStore();
  const [reveal, setReveal] = useState(false);
  const [pingEvent, setPingEvent] = useState<WebhookEvent>('task.completed');
  const recent = state.deliveries.filter((d) => d.endpointId === endpoint.id);
  const okRate = recent.length ? Math.round((recent.filter((d) => d.statusCode < 300).length / recent.length) * 100) : 100;

  return (
    <div className={cn('rounded-xl border p-4 transition', endpoint.enabled ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-transparent opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', KIND_CLS[endpoint.kind])}>{KIND_LABEL[endpoint.kind]}</span>
            <p className="truncate text-sm font-semibold text-slate-100">{endpoint.name}</p>
          </div>
          <p className="mt-1 flex items-center gap-1 truncate font-mono text-[11px] text-slate-400"><Link2 className="size-3 shrink-0" />{maskUrl(endpoint.url)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={okRate > 95 ? 'emerald' : okRate > 80 ? 'amber' : 'rose'}>{okRate}% delivered</Badge>
          <Toggle checked={endpoint.enabled} onChange={(v) => dispatch({ type: 'UPDATE_ENDPOINT', id: endpoint.id, patch: { enabled: v } })} label={`Enable ${endpoint.name}`} tone="emerald" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-obsidian/70 px-2.5 py-1.5 ring-1 ring-white/5">
        <KeyRound className="size-3.5 shrink-0 text-swarm" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">{reveal ? endpoint.secret : `whsec_${'•'.repeat(24)}`}</span>
        <button type="button" aria-label={reveal ? 'Hide secret' : 'Reveal secret'} onClick={() => setReveal(!reveal)} className="text-slate-500 hover:text-white">{reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
        <button type="button" aria-label="Copy secret" onClick={async () => { const ok = await copyText(endpoint.secret); toast(ok ? 'success' : 'warning', ok ? 'Secret copied' : 'Clipboard unavailable'); }} className="text-slate-500 hover:text-white"><Copy className="size-3.5" /></button>
        <button type="button" aria-label="Rotate secret" title="Rotate secret" onClick={() => { dispatch({ type: 'UPDATE_ENDPOINT', id: endpoint.id, patch: { secret: `whsec_${randomHex(16)}` } }); toast('info', 'Signing secret rotated', endpoint.name); }} className="text-slate-500 hover:text-white"><RefreshCw className="size-3.5" /></button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {WEBHOOK_EVENTS.map((ev) => (
          <label key={ev} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.02] px-2.5 py-1.5 ring-1 ring-white/5">
            <span className="font-mono text-[11px] text-slate-300">{ev}</span>
            <Toggle size="sm" checked={endpoint.events[ev]} onChange={(v) => dispatch({ type: 'UPDATE_ENDPOINT', id: endpoint.id, patch: { events: { ...endpoint.events, [ev]: v } } })} label={`${ev} for ${endpoint.name}`} tone={ev === 'task.failed' ? 'rose' : ev === 'hitl.approval_required' ? 'amber' : ev === 'pr.created' ? 'violet' : 'emerald'} />
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <select aria-label="Test event" value={pingEvent} onChange={(e) => setPingEvent(e.target.value as WebhookEvent)} className={cn(inputCls, 'h-8 w-auto flex-1 py-0 font-mono text-[11px]')}>
          {WEBHOOK_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} onClick={() => onPing(endpoint, pingEvent)} disabled={!endpoint.enabled}>Send test ping</Button>
        <Button size="sm" variant="ghost" aria-label={`Delete ${endpoint.name}`} icon={<Trash2 className="size-3.5" />} onClick={() => { dispatch({ type: 'REMOVE_ENDPOINT', id: endpoint.id }); toast('info', 'Endpoint removed', endpoint.name); }} />
      </div>
    </div>
  );
}

function SignatureVerifier({ preset }: { preset: { body: string; secret: string; timestamp: string; signature: string } | null }) {
  const [body, setBody] = useState('');
  const [secret, setSecret] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [sig, setSig] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; expected: string }>(null);
  const load = () => {
    if (!preset) return;
    setBody(preset.body);
    setSecret(preset.secret);
    setTimestamp(preset.timestamp);
    setSig(preset.signature);
    setResult(null);
  };
  const verify = async () => {
    try {
      const expected = await hmacSha256(secret, `${timestamp}.${body}`);
      setResult({ ok: timingSafeEqual(expected, sig.replace(/^sha256=/, '')), expected });
    } catch (e) {
      setResult({ ok: false, expected: (e as Error).message });
    }
  };
  return (
    <Card>
      <CardHeader icon={<ShieldCheck className="size-4 text-ok" />} title="HMAC SHA-256 Signature Verifier" subtitle="sig = HMAC(secret, `${timestamp}.${body}`)" actions={<Button size="sm" onClick={load} disabled={!preset}>Load last ping</Button>} />
      <div className="space-y-2 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label="Secret" className={cn(inputCls, 'font-mono text-[11px]')} placeholder="whsec_…" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <input aria-label="Timestamp" className={cn(inputCls, 'font-mono text-[11px]')} placeholder="X-AgentPulse-Timestamp" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} />
        </div>
        <input aria-label="Signature" className={cn(inputCls, 'font-mono text-[11px]')} placeholder="sha256=…" value={sig} onChange={(e) => setSig(e.target.value)} />
        <textarea aria-label="Raw body" rows={3} className={cn(inputCls, 'font-mono text-[11px]')} placeholder="raw request body" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="success" size="sm" icon={<ShieldCheck className="size-3.5" />} onClick={verify} disabled={!secret || !body}>Verify signature</Button>
          {result && (
            <span className={cn('flex min-w-0 items-center gap-1.5 font-mono text-[11px]', result.ok ? 'text-emerald-300' : 'text-rose-300')}>
              {result.ok ? <Check className="size-3.5" /> : <Zap className="size-3.5" />}
              {result.ok ? 'Valid — constant-time match' : `Mismatch · expected ${result.expected.slice(0, 16)}…`}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function WebhookHub() {
  const { state, sendTestPing, toast } = useStore();
  const [registering, setRegistering] = useState(false);
  const [preview, setPreview] = useState<{ request: SignedRequest; delivery: WebhookDelivery; secret: string } | null>(null);
  const [selected, setSelected] = useState<WebhookDelivery | null>(null);
  const [pinging, setPinging] = useState(false);

  const ping = async (ep: WebhookEndpoint, ev: WebhookEvent) => {
    setPinging(true);
    const res = await sendTestPing(ep, ev);
    await new Promise((r) => setTimeout(r, res.delivery.latencyMs));
    setPreview({ ...res, secret: ep.secret });
    setSelected(null);
    setPinging(false);
    toast(res.delivery.statusCode < 300 ? 'success' : 'danger', `Test ping ${res.delivery.statusCode < 300 ? 'delivered' : 'failed'} · ${res.delivery.statusCode}`, `${ev} → ${ep.name}`);
  };

  const endpointName = (id: string) => state.endpoints.find((e) => e.id === id)?.name ?? 'removed endpoint';
  const shownBody = selected ? selected.body : preview?.request.body;
  const shownHeaders = selected ? null : preview?.request.headers;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader icon={<Webhook className="size-4 text-swarm" />} title="Endpoint Manager" subtitle={`${state.endpoints.filter((e) => e.enabled).length}/${state.endpoints.length} endpoints active · payloads signed with HMAC SHA-256`} actions={!registering && <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setRegistering(true)}>Register endpoint</Button>} />
          {registering && <RegisterForm onDone={() => setRegistering(false)} />}
          <div className="space-y-3 p-4 sm:p-5">
            {state.endpoints.length ? state.endpoints.map((ep) => <EndpointCard key={ep.id} endpoint={ep} onPing={ping} />) : <EmptyState icon={<Webhook className="size-5" />} title="No endpoints" body="Register a Slack, Discord or custom HTTPS endpoint." />}
          </div>
        </Card>
        <SignatureVerifier preset={preview ? { body: preview.request.body, secret: preview.secret, timestamp: preview.request.headers['X-AgentPulse-Timestamp'], signature: preview.request.headers['X-AgentPulse-Signature'] } : null} />
      </div>

      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader icon={<Radio className={cn('size-4 text-exec', pinging && 'animate-pulse')} />} title="Payload Preview" subtitle={selected ? `Delivery ${selected.id} · ${selected.event}` : preview ? `Test ping · ${preview.delivery.event} → ${endpointName(preview.delivery.endpointId)}` : 'Send a test ping to preview the signed request'} actions={shownBody && <Button size="sm" icon={<Copy className="size-3.5" />} onClick={async () => toast((await copyText(shownBody)) ? 'success' : 'warning', 'Payload copied')}>Copy</Button>} />
          <div className="p-4 sm:p-5">
            {shownBody ? (
              <div className="space-y-3">
                {shownHeaders && (
                  <div className="rounded-lg bg-[#05070d] p-3 font-mono text-[11px] ring-1 ring-white/5">
                    <p className="mb-1 text-slate-500">POST {preview && new URL(state.endpoints.find((e) => e.id === preview.delivery.endpointId)?.url ?? 'https://example.com').pathname} HTTP/1.1</p>
                    {Object.entries(shownHeaders).map(([k, v]) => (
                      <p key={k} className="break-all"><span className="text-violet-300">{k}</span><span className="text-slate-500">: </span><span className={k.includes('Signature') ? 'text-emerald-300' : 'text-slate-300'}>{v}</span></p>
                    ))}
                  </div>
                )}
                <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#05070d] p-3 font-mono text-[11px] leading-relaxed text-cyan-100 ring-1 ring-white/5 scrollbar-thin">{shownBody}</pre>
              </div>
            ) : (
              <EmptyState icon={<Send className="size-5" />} title="No payload yet" body="Pick an event on an endpoint and hit “Send test ping”." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Zap className="size-4 text-hitl" />} title="Delivery Log" subtitle={`${state.deliveries.length} recent deliveries · click a row to inspect`} />
          <div className="max-h-[420px] overflow-auto scrollbar-thin">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="sticky top-0 bg-surface text-[11px] text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-2 py-2 font-medium">Event</th>
                  <th className="px-2 py-2 font-medium">Endpoint</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.deliveries.map((d) => (
                  <tr key={d.id} onClick={() => setSelected(d)} className={cn('cursor-pointer hover:bg-white/[0.03]', selected?.id === d.id && 'bg-swarm/[0.08]')}>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{formatClock(d.ts)}</td>
                    <td className="px-2 py-2"><span className="font-mono text-[11px] text-slate-200">{EVENT_META[d.event].emoji} {d.event}</span>{d.test && <span className="ml-1.5 rounded bg-white/5 px-1 text-[10px] text-slate-400">test</span>}</td>
                    <td className="max-w-40 truncate px-2 py-2 text-slate-400">{endpointName(d.endpointId)}</td>
                    <td className="px-2 py-2"><Badge tone={d.statusCode < 300 ? 'emerald' : 'rose'}>{d.statusCode}</Badge></td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-slate-400">{d.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
