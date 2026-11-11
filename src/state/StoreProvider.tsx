import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { createInitialState } from '../data/seed';
import { uid } from '../lib/utils';
import type { ToastTone, WebhookDelivery, WebhookEndpoint, WebhookEvent } from '../types';
import { sampleData, signRequest, type EventData } from '../webhooks/payloads';
import { StoreContext, type StoreApi } from './context';
import { reducer } from './reducer';
import { useSimulation } from './useSimulation';

function simulatedStatus(endpoint: WebhookEndpoint): number {
  if (Math.random() < 0.04) return 503;
  return endpoint.kind === 'discord' ? 204 : 200;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const toast = useCallback((tone: ToastTone, title: string, body?: string) => {
    dispatch({ type: 'PUSH_TOAST', toast: { id: uid('toast'), tone, title, body } });
  }, []);

  const deliver = useCallback(async (endpoint: WebhookEndpoint, event: WebhookEvent, data: EventData, test: boolean) => {
    const ts = Date.now();
    const deliveryId = uid('dlv');
    const request = await signRequest(endpoint, event, data, deliveryId, ts);
    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      event,
      ts,
      statusCode: simulatedStatus(endpoint),
      latencyMs: Math.round(80 + Math.random() * 320),
      body: request.body,
      signature: request.headers['X-AgentPulse-Signature'],
      test,
    };
    dispatch({ type: 'ADD_DELIVERY', delivery });
    return { request, delivery };
  }, []);

  const emitWebhook = useCallback(
    (event: WebhookEvent, data: EventData) => {
      for (const endpoint of stateRef.current.endpoints) {
        if (endpoint.enabled && endpoint.events[event]) void deliver(endpoint, event, data, false);
      }
    },
    [deliver],
  );

  const sendTestPing = useCallback(
    (endpoint: WebhookEndpoint, event: WebhookEvent) => deliver(endpoint, event, sampleData(event), true),
    [deliver],
  );

  const api = useMemo<StoreApi>(
    () => ({ state, dispatch, toast, emitWebhook, sendTestPing }),
    [state, toast, emitWebhook, sendTestPing],
  );

  useSimulation(stateRef, dispatch, toast, emitWebhook);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
