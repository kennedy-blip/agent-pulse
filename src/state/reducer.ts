import type { HitlRequest, TerminalLine } from '../types';
import { uid } from '../lib/utils';
import { TICK_MS, TIME_SCALE } from './context';
import type { Action, AppState } from './types';

const STREAM_CAP = 250;
const TERMINAL_CAP = 500;
const DELIVERY_CAP = 150;
const HISTORY_CAP = 60;

function sysLine(agentId: string, text: string, stream: TerminalLine['stream'] = 'system'): TerminalLine {
  return { id: uid('tl'), ts: Date.now(), agentId, stream, text };
}

function hitlApprovedOutput(req: HitlRequest): string[] {
  return [`$ ${req.command}`, `✓ executed with human sign-off (${req.id})`];
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_COMPOSER':
      return { ...state, composerOpen: action.open };
    case 'SELECT_BRIEF':
      return { ...state, selectedBriefId: action.id };
    case 'SELECT_PR':
      return { ...state, selectedPrId: action.id };

    case 'ADD_BRIEF':
      return {
        ...state,
        briefs: [action.brief, ...state.briefs],
        subtasks: action.subtasks ? [...state.subtasks, ...action.subtasks] : state.subtasks,
        selectedBriefId: action.brief.id,
      };
    case 'UPDATE_BRIEF':
      return { ...state, briefs: state.briefs.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) };
    case 'SET_BRIEF_STATUS': {
      const terminal = action.status === 'cancelled' || action.status === 'failed';
      const subtaskIds = new Set(state.subtasks.filter((s) => s.briefId === action.id).map((s) => s.id));
      return {
        ...state,
        briefs: state.briefs.map((b) => (b.id === action.id ? { ...b, status: action.status } : b)),
        agents: terminal
          ? state.agents.map((a) =>
              a.currentSubtaskId && subtaskIds.has(a.currentSubtaskId)
                ? { ...a, currentSubtaskId: null, status: a.status === 'blocked' ? 'running' : a.status }
                : a,
            )
          : state.agents,
        subtasks: terminal
          ? state.subtasks.map((s) =>
              s.briefId === action.id && (s.status === 'running' || s.status === 'blocked')
                ? { ...s, status: action.status === 'failed' ? 'failed' : 'pending' }
                : s,
            )
          : state.subtasks,
        hitl:
          action.status === 'cancelled'
            ? state.hitl.map((h) =>
                h.briefId === action.id && h.status === 'pending'
                  ? { ...h, status: 'rejected', decidedAt: Date.now(), decisionNote: 'Brief cancelled' }
                  : h,
              )
            : state.hitl,
      };
    }
    case 'REMOVE_BRIEF': {
      const ids = new Set(state.subtasks.filter((s) => s.briefId === action.id).map((s) => s.id));
      return {
        ...state,
        briefs: state.briefs.filter((b) => b.id !== action.id),
        subtasks: state.subtasks.filter((s) => s.briefId !== action.id),
        agents: state.agents.map((a) => (a.currentSubtaskId && ids.has(a.currentSubtaskId) ? { ...a, currentSubtaskId: null } : a)),
        selectedBriefId: state.selectedBriefId === action.id ? null : state.selectedBriefId,
      };
    }
    case 'SET_SUBTASKS': {
      const oldIds = new Set(state.subtasks.filter((s) => s.briefId === action.briefId).map((s) => s.id));
      return {
        ...state,
        subtasks: [...state.subtasks.filter((s) => s.briefId !== action.briefId), ...action.subtasks],
        agents: state.agents.map((a) => (a.currentSubtaskId && oldIds.has(a.currentSubtaskId) ? { ...a, currentSubtaskId: null } : a)),
      };
    }
    case 'UPDATE_SUBTASK':
      return { ...state, subtasks: state.subtasks.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) };
    case 'REASSIGN_SUBTASK': {
      const st = state.subtasks.find((s) => s.id === action.id);
      if (!st || st.status === 'done') return state;
      const wasRunning = st.status === 'running';
      return {
        ...state,
        subtasks: state.subtasks.map((s) =>
          s.id === action.id ? { ...s, agentId: action.agentId, status: wasRunning ? 'pending' : s.status } : s,
        ),
        agents: state.agents.map((a) => (a.currentSubtaskId === action.id ? { ...a, currentSubtaskId: null } : a)),
      };
    }
    case 'RETRY_BRIEF':
      return {
        ...state,
        briefs: state.briefs.map((b) => (b.id === action.id ? { ...b, status: 'running' } : b)),
        subtasks: state.subtasks.map((s) =>
          s.briefId === action.id && s.status === 'failed' ? { ...s, status: 'pending', progress: 0 } : s,
        ),
      };

    case 'UPDATE_AGENT':
      return { ...state, agents: state.agents.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)) };
    case 'SET_AGENT_STATUS':
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.id ? { ...a, status: action.status, tokensPerMin: action.status === 'running' ? a.baseTokensPerMin : 0 } : a,
        ),
      };

    case 'PUSH_STREAM':
      return { ...state, stream: [...state.stream, ...action.events].slice(-STREAM_CAP) };
    case 'PUSH_TERMINAL':
      return { ...state, terminal: [...state.terminal, ...action.lines].slice(-TERMINAL_CAP) };
    case 'CLEAR_TERMINAL':
      return { ...state, terminal: [sysLine('system', 'Terminal buffer cleared')] };

    case 'ADD_PR':
      return { ...state, prs: [action.pr, ...state.prs] };
    case 'UPDATE_PR':
      return { ...state, prs: state.prs.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'SET_PR_STATUS':
      return { ...state, prs: state.prs.map((p) => (p.id === action.id ? { ...p, status: action.status } : p)) };
    case 'ADD_PR_COMMENT':
      return {
        ...state,
        prs: state.prs.map((p) => (p.id === action.id ? { ...p, comments: [...p.comments, action.comment] } : p)),
      };
    case 'MERGE_APPROVED':
      return { ...state, prs: state.prs.map((p) => (p.status === 'approved' ? { ...p, status: 'merged' } : p)) };

    case 'ADD_ENDPOINT':
      return { ...state, endpoints: [...state.endpoints, action.endpoint] };
    case 'UPDATE_ENDPOINT':
      return { ...state, endpoints: state.endpoints.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)) };
    case 'REMOVE_ENDPOINT':
      return { ...state, endpoints: state.endpoints.filter((e) => e.id !== action.id) };
    case 'ADD_DELIVERY':
      return { ...state, deliveries: [action.delivery, ...state.deliveries].slice(0, DELIVERY_CAP) };

    case 'ADD_HITL':
      return { ...state, hitl: [action.request, ...state.hitl] };
    case 'DECIDE_HITL': {
      const req = state.hitl.find((h) => h.id === action.id);
      if (!req || req.status !== 'pending') return state;
      const approved = action.status === 'approved';
      const agent = state.agents.find((a) => a.id === req.agentId);
      const stillPending = state.hitl.some(
        (h) => h.id !== req.id && h.status === 'pending' && h.briefId === req.briefId,
      );
      const lines = approved
        ? hitlApprovedOutput(req).map((t, i) => sysLine(req.agentId, t, i === 0 ? 'stdin' : 'stdout'))
        : [sysLine(req.agentId, `✗ ${req.id} rejected by operator${action.note ? `: ${action.note}` : ''} — agent re-planning with a safer alternative`)];
      return {
        ...state,
        hitl: state.hitl.map((h) =>
          h.id === action.id ? { ...h, status: action.status, decidedAt: Date.now(), decisionNote: action.note } : h,
        ),
        agents: state.agents.map((a) =>
          a.id === req.agentId && a.status === 'blocked' ? { ...a, status: 'running', tokensPerMin: a.baseTokensPerMin } : a,
        ),
        subtasks: state.subtasks.map((s) =>
          agent && s.id === agent.currentSubtaskId && s.status === 'blocked' ? { ...s, status: 'running' } : s,
        ),
        briefs: state.briefs.map((b) =>
          b.id === req.briefId && b.status === 'awaiting_hitl' && !stillPending ? { ...b, status: 'running' } : b,
        ),
        terminal: [...state.terminal, ...lines].slice(-TERMINAL_CAP),
      };
    }
    case 'TOGGLE_POLICY':
      return { ...state, policies: state.policies.map((p) => (p.id === action.id ? { ...p, enabled: !p.enabled } : p)) };
    case 'ADD_POLICY':
      return { ...state, policies: [...state.policies, action.policy] };

    case 'UPDATE_COST':
      return { ...state, cost: { ...state.cost, ...action.patch } };
    case 'COST_TICK':
      return {
        ...state,
        cost: {
          ...state.cost,
          totalSpend: state.cost.totalSpend + action.spend,
          totalTokens: state.cost.totalTokens + action.sample.tokens * (TICK_MS / 60_000) * TIME_SCALE,
          history: [...state.cost.history, action.sample].slice(-HISTORY_CAP),
        },
        agents: state.agents.map((a) => ({
          ...a,
          tokensPerMin: action.perAgentTokens[a.id] ?? 0,
          spent: a.spent + (action.perAgentSpend[a.id] ?? 0),
        })),
        briefs: state.briefs.map((b) =>
          action.perBriefSpend[b.id] ? { ...b, spent: b.spent + action.perBriefSpend[b.id] } : b,
        ),
      };
    case 'SET_GLOBAL_PAUSE':
      return { ...state, globalPaused: action.paused };

    case 'PUSH_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast].slice(-5) };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}
