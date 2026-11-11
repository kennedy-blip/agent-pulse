import { X } from 'lucide-react';
import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/utils';

export type Tone = 'violet' | 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate';

export const TONE_TEXT: Record<Tone, string> = {
  violet: 'text-swarm',
  emerald: 'text-ok',
  cyan: 'text-exec',
  amber: 'text-hitl',
  rose: 'text-danger',
  slate: 'text-slate-400',
};

const TONE_BADGE: Record<Tone, string> = {
  violet: 'bg-swarm/12 text-violet-300 ring-swarm/30',
  emerald: 'bg-ok/12 text-emerald-300 ring-ok/30',
  cyan: 'bg-exec/12 text-cyan-300 ring-exec/30',
  amber: 'bg-hitl/12 text-amber-300 ring-hitl/30',
  rose: 'bg-danger/12 text-rose-300 ring-danger/30',
  slate: 'bg-slate-500/10 text-slate-300 ring-slate-500/25',
};

const TONE_DOT: Record<Tone, string> = {
  violet: 'bg-swarm',
  emerald: 'bg-ok',
  cyan: 'bg-exec',
  amber: 'bg-hitl',
  rose: 'bg-danger',
  slate: 'bg-slate-500',
};

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass min-w-0 rounded-2xl', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = 'slate', children, className, dot, pulse }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; pulse?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap', TONE_BADGE[tone], className)}>
      {dot && <StatusDot tone={tone} pulse={pulse} />}
      {children}
    </span>
  );
}

export function StatusDot({ tone, pulse, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)}>
      {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', TONE_DOT[tone])} />}
      <span className={cn('relative inline-flex size-2 rounded-full', TONE_DOT[tone])} />
    </span>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-swarm text-white hover:bg-violet-400 shadow-[0_0_20px_-6px_rgb(139_92_246_/_0.8)]',
  secondary: 'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-danger/15 text-rose-300 ring-1 ring-inset ring-danger/40 hover:bg-danger/25',
  success: 'bg-ok/15 text-emerald-300 ring-1 ring-inset ring-ok/40 hover:bg-ok/25',
  warning: 'bg-hitl/15 text-amber-300 ring-1 ring-inset ring-hitl/40 hover:bg-hitl/25',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  tone = 'violet',
  size = 'md',
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        checked ? TONE_DOT[tone] : 'bg-slate-700',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow transition-transform',
          size === 'sm' ? 'size-3' : 'size-4',
          checked ? (size === 'sm' ? 'translate-x-3.5' : 'translate-x-4.5') : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function ProgressBar({ value, tone = 'cyan', className, striped }: { value: number; tone?: Tone; className?: string; striped?: boolean }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/5', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', TONE_DOT[tone], striped && 'animate-pulse')}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('glass relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface/95 scrollbar-thin sm:rounded-2xl animate-slide-in', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-surface/95 px-5 py-3.5 backdrop-blur">
          <h2 id={titleId} className="text-sm font-semibold text-slate-100">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="grid size-11 place-items-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10">{icon}</div>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {body && <p className="max-w-sm text-xs text-slate-400">{body}</p>}
      {action}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-slate-300">{label}</label>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-white/10 bg-obsidian/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-swarm/60 focus:ring-2 focus:ring-swarm/20';

export function Sparkline({
  values,
  tone = 'violet',
  height = 64,
  limit,
  className,
}: {
  values: number[];
  tone?: Tone;
  height?: number;
  limit?: number;
  className?: string;
}) {
  const gid = useId().replace(/:/g, '');
  const w = 300;
  const max = Math.max(...values, limit ?? 0, 1) * 1.1;
  const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * w : 0, height - (v / max) * height] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color = { violet: '#8b5cf6', emerald: '#10b981', cyan: '#06b6d4', amber: '#f59e0b', rose: '#f43f5e', slate: '#64748b' }[tone];
  const ly = limit !== undefined ? height - (limit / max) * height : null;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 && <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {ly !== null && <line x1="0" x2={w} y1={ly} y2={ly} stroke="#f43f5e" strokeDasharray="6 4" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export function Stat({ label, value, sub, icon, tone = 'slate' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <span className={TONE_TEXT[tone]}>{icon}</span>}
      </div>
      <div className={cn('mt-2 font-mono text-xl font-semibold tabular-nums sm:text-2xl', TONE_TEXT[tone] === 'text-slate-400' ? 'text-slate-100' : TONE_TEXT[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}
