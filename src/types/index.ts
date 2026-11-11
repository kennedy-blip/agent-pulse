export type TabId = 'dispatcher' | 'swarm' | 'execution' | 'diffs' | 'webhooks' | 'security';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export const TECH_TAGS = [
  'React',
  'TypeScript',
  'Python',
  'Docker',
  'Go',
  'Postgres',
  'Kubernetes',
  'Rust',
] as const;
export type TechTag = (typeof TECH_TAGS)[number];

export type BriefStatus =
  | 'queued'
  | 'running'
  | 'awaiting_hitl'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Brief {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  repo: string;
  tags: TechTag[];
  costCap: number;
  spent: number;
  status: BriefStatus;
  createdAt: number;
  prId?: string;
}

export type AgentRole = 'Planner' | 'Frontend' | 'Backend' | 'QA' | 'DevOps' | 'Security';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'blocked';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  model: string;
  currentSubtaskId: string | null;
  baseTokensPerMin: number;
  tokensPerMin: number;
  completedTasks: number;
  spent: number;
}

export type SubTaskStatus = 'pending' | 'running' | 'blocked' | 'done' | 'failed';

export interface SubTask {
  id: string;
  briefId: string;
  title: string;
  role: AgentRole;
  agentId: string | null;
  status: SubTaskStatus;
  progress: number;
  dependsOn: string[];
  wave: number;
  estMinutes: number;
}

export type StreamKind = 'file_edit' | 'shell' | 'test' | 'browser' | 'think' | 'git' | 'security';
export type StepStatus = 'running' | 'success' | 'failed' | 'info';

export interface StreamEvent {
  id: string;
  ts: number;
  agentId: string;
  kind: StreamKind;
  title: string;
  detail?: string;
  status: StepStatus;
}

export type TermStream = 'stdin' | 'stdout' | 'stderr' | 'system';

export interface TerminalLine {
  id: string;
  ts: number;
  agentId: string;
  stream: TermStream;
  text: string;
}

export type DiffLineType = 'add' | 'del' | 'ctx';

export interface DiffLine {
  type: DiffLineType;
  oldNo: number | null;
  newNo: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  hunks: DiffHunk[];
}

export interface InlineComment {
  id: string;
  lineKey: string | null;
  author: string;
  body: string;
  ts: number;
  kind: 'comment' | 'revision' | 'approval';
}

export type PrStatus = 'open' | 'changes_requested' | 'approved' | 'merged';
export type CheckStatus = 'passed' | 'failed' | 'running';

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  repo: string;
  branch: string;
  base: string;
  agentId: string;
  status: PrStatus;
  commit: string;
  createdAt: number;
  files: DiffFile[];
  comments: InlineComment[];
  checks: { name: string; status: CheckStatus }[];
  revisionDueAt?: number;
}

export const WEBHOOK_EVENTS = [
  'task.completed',
  'task.failed',
  'pr.created',
  'hitl.approval_required',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export type EndpointKind = 'slack' | 'discord' | 'custom';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  kind: EndpointKind;
  secret: string;
  enabled: boolean;
  events: Record<WebhookEvent, boolean>;
  createdAt: number;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  ts: number;
  statusCode: number;
  latencyMs: number;
  body: string;
  signature: string;
  test: boolean;
}

export type RiskLevel = 'medium' | 'high' | 'critical';
export type HitlCategory =
  | 'destructive_shell'
  | 'force_push'
  | 'branch_override'
  | 'secret_access'
  | 'prod_deploy'
  | 'data_mutation';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  pattern: string;
  risk: RiskLevel;
  category: HitlCategory;
  enabled: boolean;
}

export type HitlStatus = 'pending' | 'approved' | 'rejected';

export interface HitlRequest {
  id: string;
  agentId: string;
  briefId: string | null;
  command: string;
  policyId: string;
  risk: RiskLevel;
  category: HitlCategory;
  reason: string;
  status: HitlStatus;
  ts: number;
  decidedAt?: number;
  decisionNote?: string;
}

export interface CostSample {
  t: number;
  rate: number;
  tokens: number;
}

export interface CostState {
  pricePer1k: number;
  totalSpend: number;
  totalTokens: number;
  dailyBudget: number;
  hourlyLimit: number;
  autoStop: boolean;
  tripped: string | null;
  history: CostSample[];
}

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
}
