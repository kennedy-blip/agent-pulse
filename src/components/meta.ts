import type { AgentRole, AgentStatus, BriefStatus, Priority, PrStatus, RiskLevel, StreamKind, SubTaskStatus } from '../types';
import type { Tone } from './ui';

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  P0: { label: 'P0 · Critical', tone: 'rose' },
  P1: { label: 'P1 · High', tone: 'amber' },
  P2: { label: 'P2 · Medium', tone: 'cyan' },
  P3: { label: 'P3 · Low', tone: 'slate' },
};

export const BRIEF_STATUS_META: Record<BriefStatus, { label: string; tone: Tone; pulse?: boolean }> = {
  queued: { label: 'Queued', tone: 'slate' },
  running: { label: 'Running', tone: 'cyan', pulse: true },
  awaiting_hitl: { label: 'Awaiting HITL', tone: 'amber', pulse: true },
  paused: { label: 'Paused', tone: 'slate' },
  completed: { label: 'Completed', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'rose' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};

export const SUBTASK_STATUS_META: Record<SubTaskStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'slate' },
  running: { label: 'Running', tone: 'cyan' },
  blocked: { label: 'HITL', tone: 'amber' },
  done: { label: 'Done', tone: 'emerald' },
  failed: { label: 'Failed', tone: 'rose' },
};

export const AGENT_STATUS_META: Record<AgentStatus, { label: string; tone: Tone }> = {
  idle: { label: 'Idle', tone: 'slate' },
  running: { label: 'Running', tone: 'cyan' },
  paused: { label: 'Paused', tone: 'slate' },
  blocked: { label: 'Awaiting HITL', tone: 'amber' },
};

export const ROLE_META: Record<AgentRole, { tone: Tone; short: string }> = {
  Planner: { tone: 'violet', short: 'PLN' },
  Frontend: { tone: 'cyan', short: 'FE' },
  Backend: { tone: 'emerald', short: 'BE' },
  QA: { tone: 'amber', short: 'QA' },
  DevOps: { tone: 'slate', short: 'OPS' },
  Security: { tone: 'rose', short: 'SEC' },
};

export const PR_STATUS_META: Record<PrStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'cyan' },
  changes_requested: { label: 'Changes requested', tone: 'amber' },
  approved: { label: 'Approved', tone: 'violet' },
  merged: { label: 'Merged', tone: 'emerald' },
};

export const RISK_META: Record<RiskLevel, { label: string; tone: Tone }> = {
  medium: { label: 'Medium', tone: 'cyan' },
  high: { label: 'High', tone: 'amber' },
  critical: { label: 'Critical', tone: 'rose' },
};

export const STREAM_KIND_LABEL: Record<StreamKind, string> = {
  file_edit: 'File edit',
  shell: 'Shell',
  test: 'Test run',
  browser: 'Browser',
  think: 'Reasoning',
  git: 'Git',
  security: 'Security',
};
