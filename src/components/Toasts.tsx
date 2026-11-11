import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useStore } from '../state/context';
import type { Toast, ToastTone } from '../types';

const TONE: Record<ToastTone, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: 'text-exec ring-exec/30' },
  success: { icon: CheckCircle2, cls: 'text-ok ring-ok/30' },
  warning: { icon: AlertTriangle, cls: 'text-hitl ring-hitl/30' },
  danger: { icon: ShieldAlert, cls: 'text-danger ring-danger/30' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(toast.id), toast.tone === 'danger' ? 7000 : 4500);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.tone, onDismiss]);
  const { icon: Icon, cls } = TONE[toast.tone];
  return (
    <div role="status" className={cn('glass pointer-events-auto flex w-full gap-3 rounded-xl bg-surface/90 p-3 ring-1 animate-slide-in', cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100">{toast.title}</p>
        {toast.body && <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{toast.body}</p>}
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)} className="self-start rounded p-0.5 text-slate-500 hover:text-white">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function Toasts() {
  const { state, dispatch } = useStore();
  const dismiss = useCallback((id: string) => dispatch({ type: 'DISMISS_TOAST', id }), [dispatch]);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96">
      {state.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
