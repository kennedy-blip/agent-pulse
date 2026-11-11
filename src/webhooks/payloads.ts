import type { EndpointKind, WebhookEndpoint, WebhookEvent } from '../types';
import { hmacSha256 } from '../lib/utils';

export type EventData = Record<string, string | number | boolean | null>;

export const EVENT_META: Record<WebhookEvent, { label: string; emoji: string; color: number; description: string }> = {
  'task.completed': { label: 'Task completed', emoji: '✅', color: 0x10b981, description: 'A brief finished all sub-tasks' },
  'task.failed': { label: 'Task failed', emoji: '❌', color: 0xf43f5e, description: 'A sub-task errored or was aborted' },
  'pr.created': { label: 'PR created', emoji: '🔀', color: 0x8b5cf6, description: 'An agent opened a pull request' },
  'hitl.approval_required': { label: 'Approval required', emoji: '⚠️', color: 0xf59e0b, description: 'A risky action awaits sign-off' },
};

export function detectKind(url: string): EndpointKind {
  if (/hooks\.slack\.com/i.test(url)) return 'slack';
  if (/discord(?:app)?\.com\/api\/webhooks/i.test(url)) return 'discord';
  return 'custom';
}

export function sampleData(event: WebhookEvent): EventData {
  switch (event) {
    case 'task.completed':
      return { brief_id: 'brf_demo', title: 'Add HMAC verification to webhook ingress', repo: 'acme/platform-api', duration_s: 1843, cost_usd: 4.37 };
    case 'task.failed':
      return { brief_id: 'brf_demo', title: 'Migrate billing service to Go', repo: 'acme/billing', error: 'pytest exited with code 1 (3 failed)', agent: 'Devin-QA' };
    case 'pr.created':
      return { pr_number: 482, title: 'feat: live execution streamer', repo: 'acme/agentpulse-web', branch: 'devin/live-stream', additions: 214, deletions: 37 };
    case 'hitl.approval_required':
      return { request_id: 'hitl_demo', agent: 'Devin-Ops', command: 'kubectl delete deployment agentpulse-worker -n production', risk: 'critical' };
  }
}

export function buildEnvelope(event: WebhookEvent, data: EventData, deliveryId: string, ts: number) {
  return { id: deliveryId, event, created_at: new Date(ts).toISOString(), source: 'agentpulse', data };
}

function summary(event: WebhookEvent, data: EventData): string {
  const title = String(data.title ?? data.command ?? '');
  const repo = data.repo ? ` in \`${data.repo}\`` : '';
  return `${EVENT_META[event].emoji} *${EVENT_META[event].label}*${repo}${title ? ` — ${title}` : ''}`;
}

/** Formats the request body for the target platform. */
export function buildBody(kind: EndpointKind, event: WebhookEvent, data: EventData, deliveryId: string, ts: number): unknown {
  const envelope = buildEnvelope(event, data, deliveryId, ts);
  if (kind === 'slack') {
    return {
      text: summary(event, data),
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: summary(event, data) } },
        {
          type: 'context',
          elements: Object.entries(data).map(([k, v]) => ({ type: 'mrkdwn', text: `*${k}:* ${String(v)}` })),
        },
      ],
      metadata: { event_type: event, event_payload: envelope },
    };
  }
  if (kind === 'discord') {
    return {
      username: 'AgentPulse',
      content: summary(event, data).replace(/\*/g, '**'),
      embeds: [
        {
          title: EVENT_META[event].label,
          color: EVENT_META[event].color,
          fields: Object.entries(data).map(([k, v]) => ({ name: k, value: String(v), inline: true })),
          timestamp: envelope.created_at,
        },
      ],
    };
  }
  return envelope;
}

export interface SignedRequest {
  body: string;
  signature: string;
  headers: Record<string, string>;
}

export async function signRequest(
  endpoint: WebhookEndpoint,
  event: WebhookEvent,
  data: EventData,
  deliveryId: string,
  ts: number,
): Promise<SignedRequest> {
  const body = JSON.stringify(buildBody(endpoint.kind, event, data, deliveryId, ts), null, 2);
  const timestamp = Math.floor(ts / 1000).toString();
  let signature: string;
  try {
    signature = await hmacSha256(endpoint.secret, `${timestamp}.${body}`);
  } catch {
    signature = 'unavailable';
  }
  return {
    body,
    signature,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AgentPulse-Webhooks/2.4',
      'X-AgentPulse-Event': event,
      'X-AgentPulse-Delivery': deliveryId,
      'X-AgentPulse-Timestamp': timestamp,
      'X-AgentPulse-Signature': `sha256=${signature}`,
    },
  };
}
