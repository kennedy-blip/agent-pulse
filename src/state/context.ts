import { createContext, useContext, type Dispatch } from 'react';
import type { ToastTone, WebhookEndpoint, WebhookEvent, WebhookDelivery } from '../types';
import type { EventData, SignedRequest } from '../webhooks/payloads';
import type { Action, AppState } from './types';

export const TICK_MS = 1500;
/** Simulated seconds that pass per real second when accruing spend. */
export const TIME_SCALE = 5;

export interface StoreApi {
  state: AppState;
  dispatch: Dispatch<Action>;
  toast: (tone: ToastTone, title: string, body?: string) => void;
  emitWebhook: (event: WebhookEvent, data: EventData) => void;
  sendTestPing: (
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
  ) => Promise<{ request: SignedRequest; delivery: WebhookDelivery }>;
}

export const StoreContext = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
