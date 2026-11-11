import { Activity, Coins, Cpu, Gauge, OctagonX, Play, TrendingUp } from 'lucide-react';
import { useId } from 'react';
import { ROLE_META } from '../components/meta';
import { Badge, Button, Card, CardHeader, Field, inputCls, ProgressBar, Sparkline, Stat, Toggle } from '../components/ui';
import { cn, formatTokens, formatUsd } from '../lib/utils';
import { useStore } from '../state/context';

export function CostGuard() {
  const { state, dispatch, toast } = useStore();
  const ids = { hourly: useId(), daily: useId(), price: useId() };
  const { cost } = state;
  const last = cost.history[cost.history.length - 1];
  const rate = last?.rate ?? 0;
  const tpm = last?.tokens ?? 0;
  const budgetPct = (cost.totalSpend / cost.dailyBudget) * 100;
  const ratePct = (rate / cost.hourlyLimit) * 100;
  const hoursLeft = rate > 0 ? (cost.dailyBudget - cost.totalSpend) / rate : Infinity;
  const agents = [...state.agents].sort((a, b) => b.spent - a.spent);
  const maxSpent = Math.max(...agents.map((a) => a.spent), 1);

  const resume = () => {
    dispatch({ type: 'UPDATE_COST', patch: { tripped: null } });
    dispatch({ type: 'SET_GLOBAL_PAUSE', paused: false });
    toast('success', 'Guardrail reset — swarm resumed');
  };

  return (
    <div className="space-y-5">
      {cost.tripped && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4">
          <OctagonX className="size-5 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-200">Auto-stop engaged — all agents halted</p>
            <p className="text-xs text-rose-300/80">{cost.tripped}</p>
          </div>
          <Button variant="secondary" icon={<Play className="size-4" />} onClick={resume}>Reset & resume</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Burn rate" value={`${formatUsd(rate)}/hr`} sub={`limit ${formatUsd(cost.hourlyLimit, 0)}/hr`} icon={<Gauge className="size-4" />} tone={ratePct > 85 ? 'rose' : ratePct > 60 ? 'amber' : 'cyan'} />
        <Stat label="Token burn" value={`${formatTokens(tpm)}/min`} sub={`${formatTokens(cost.totalTokens)} total`} icon={<Cpu className="size-4" />} tone="violet" />
        <Stat label="Spend today" value={formatUsd(cost.totalSpend)} sub={`${budgetPct.toFixed(0)}% of ${formatUsd(cost.dailyBudget, 0)}`} icon={<Coins className="size-4" />} tone={budgetPct > 85 ? 'rose' : 'emerald'} />
        <Stat label="Runway" value={Number.isFinite(hoursLeft) ? `${Math.max(0, hoursLeft).toFixed(1)}h` : '∞'} sub="at current burn" icon={<TrendingUp className="size-4" />} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={<Activity className="size-4 text-exec" />} title="Compute Spend ($/hour)" subtitle="Live swarm burn rate · dashed line = auto-stop limit" actions={<Badge tone={state.globalPaused ? 'rose' : 'cyan'} dot pulse={!state.globalPaused}>{state.globalPaused ? 'halted' : 'live'}</Badge>} />
          <div className="p-4 sm:p-5">
            <Sparkline values={cost.history.map((h) => h.rate)} limit={cost.hourlyLimit} tone={ratePct > 85 ? 'rose' : 'cyan'} height={150} />
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Hourly rate vs limit</span><span className="font-mono text-slate-300">{ratePct.toFixed(0)}%</span></div>
                <ProgressBar value={ratePct} tone={ratePct > 85 ? 'rose' : ratePct > 60 ? 'amber' : 'cyan'} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Daily budget consumed</span><span className="font-mono text-slate-300">{budgetPct.toFixed(1)}%</span></div>
                <ProgressBar value={budgetPct} tone={budgetPct > 85 ? 'rose' : 'emerald'} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<OctagonX className="size-4 text-danger" />} title="Auto-stop Limits" subtitle="Halts every agent when a limit is crossed" actions={<Toggle checked={cost.autoStop} onChange={(v) => { dispatch({ type: 'UPDATE_COST', patch: { autoStop: v } }); toast(v ? 'success' : 'warning', `Auto-stop ${v ? 'armed' : 'disarmed'}`); }} label="Auto-stop" tone="rose" />} />
          <div className="space-y-4 p-4 sm:p-5">
            <Field label="Max burn rate ($/hr)" htmlFor={ids.hourly} hint={<span className="font-mono">{formatUsd(cost.hourlyLimit, 0)}</span>}>
              <input id={ids.hourly} type="range" min={20} max={300} step={5} value={cost.hourlyLimit} onChange={(e) => dispatch({ type: 'UPDATE_COST', patch: { hourlyLimit: Number(e.target.value) } })} className="w-full accent-rose-500" />
            </Field>
            <Field label="Daily budget ($)" htmlFor={ids.daily} hint={<span className="font-mono">{formatUsd(cost.dailyBudget, 0)}</span>}>
              <input id={ids.daily} type="range" min={50} max={2000} step={10} value={cost.dailyBudget} onChange={(e) => dispatch({ type: 'UPDATE_COST', patch: { dailyBudget: Number(e.target.value) } })} className="w-full accent-rose-500" />
            </Field>
            <Field label="Price per 1K tokens ($)" htmlFor={ids.price}>
              <input id={ids.price} type="number" min={0.001} step={0.001} value={cost.pricePer1k} onChange={(e) => { const v = Number(e.target.value); if (v > 0) dispatch({ type: 'UPDATE_COST', patch: { pricePer1k: v } }); }} className={cn(inputCls, 'font-mono')} />
            </Field>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Cpu className="size-4 text-swarm" />} title="Per-agent Spend & Token Burn" />
        <ul className="divide-y divide-white/5">
          {agents.map((a) => (
            <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)_100px_90px] sm:px-5">
              <div className="flex items-center gap-2">
                <Badge tone={ROLE_META[a.role].tone}>{ROLE_META[a.role].short}</Badge>
                <span className="truncate text-sm text-slate-200">{a.name}</span>
              </div>
              <span className="font-mono text-xs text-slate-300 sm:order-last sm:text-right">{formatUsd(a.spent)}</span>
              <ProgressBar value={(a.spent / maxSpent) * 100} tone={ROLE_META[a.role].tone} className="col-span-2 sm:col-span-1" />
              <span className="hidden font-mono text-xs text-slate-400 sm:block sm:text-right">{formatTokens(a.tokensPerMin)}/min</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
