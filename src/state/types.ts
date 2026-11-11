import type {
  Agent,
  AgentStatus,
  Brief,
  BriefStatus,
  CostSample,
  CostState,
  HitlRequest,
  InlineComment,
  PrStatus,
  PullRequest,
  SecurityPolicy,
  StreamEvent,
  SubTask,
  TabId,
  TerminalLine,
  Toast,
  WebhookDelivery,
  WebhookEndpoint,
} from '../types';

export interface AppState {
  activeTab: TabId;
  briefs: Brief[];
  subtasks: SubTask[];
  agents: Agent[];
  stream: StreamEvent[];
  terminal: TerminalLine[];
  prs: PullRequest[];
  endpoints: WebhookEndpoint[];
  deliveries: WebhookDelivery[];
  hitl: HitlRequest[];
  policies: SecurityPolicy[];
  cost: CostState;
  globalPaused: boolean;
  selectedBriefId: string | null;
  selectedPrId: string | null;
  composerOpen: boolean;
  toasts: Toast[];
}

export type Action =
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SET_COMPOSER'; open: boolean }
  | { type: 'SELECT_BRIEF'; id: string | null }
  | { type: 'SELECT_PR'; id: string | null }
  | { type: 'ADD_BRIEF'; brief: Brief; subtasks?: SubTask[] }
  | { type: 'UPDATE_BRIEF'; id: string; patch: Partial<Brief> }
  | { type: 'SET_BRIEF_STATUS'; id: string; status: BriefStatus }
  | { type: 'REMOVE_BRIEF'; id: string }
  | { type: 'SET_SUBTASKS'; briefId: string; subtasks: SubTask[] }
  | { type: 'UPDATE_SUBTASK'; id: string; patch: Partial<SubTask> }
  | { type: 'REASSIGN_SUBTASK'; id: string; agentId: string }
  | { type: 'RETRY_BRIEF'; id: string }
  | { type: 'UPDATE_AGENT'; id: string; patch: Partial<Agent> }
  | { type: 'SET_AGENT_STATUS'; id: string; status: AgentStatus }
  | { type: 'PUSH_STREAM'; events: StreamEvent[] }
  | { type: 'PUSH_TERMINAL'; lines: TerminalLine[] }
  | { type: 'CLEAR_TERMINAL' }
  | { type: 'ADD_PR'; pr: PullRequest }
  | { type: 'UPDATE_PR'; id: string; patch: Partial<PullRequest> }
  | { type: 'SET_PR_STATUS'; id: string; status: PrStatus }
  | { type: 'ADD_PR_COMMENT'; id: string; comment: InlineComment }
  | { type: 'MERGE_APPROVED' }
  | { type: 'ADD_ENDPOINT'; endpoint: WebhookEndpoint }
  | { type: 'UPDATE_ENDPOINT'; id: string; patch: Partial<WebhookEndpoint> }
  | { type: 'REMOVE_ENDPOINT'; id: string }
  | { type: 'ADD_DELIVERY'; delivery: WebhookDelivery }
  | { type: 'ADD_HITL'; request: HitlRequest }
  | { type: 'DECIDE_HITL'; id: string; status: 'approved' | 'rejected'; note?: string }
  | { type: 'TOGGLE_POLICY'; id: string }
  | { type: 'ADD_POLICY'; policy: SecurityPolicy }
  | { type: 'UPDATE_COST'; patch: Partial<CostState> }
  | {
      type: 'COST_TICK';
      sample: CostSample;
      spend: number;
      perAgentTokens: Record<string, number>;
      perAgentSpend: Record<string, number>;
      perBriefSpend: Record<string, number>;
    }
  | { type: 'SET_GLOBAL_PAUSE'; paused: boolean }
  | { type: 'PUSH_TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: string };
