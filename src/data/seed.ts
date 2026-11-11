import type {
  Agent,
  Brief,
  CostSample,
  HitlRequest,
  PullRequest,
  StreamEvent,
  SubTask,
  TerminalLine,
  WebhookDelivery,
  WebhookEndpoint,
} from '../types';
import { decomposeBrief } from '../agents/decompose';
import { DOCKER_FILES, PYTHON_FILES, REACT_FILES } from '../diffs/templates';
import { DEFAULT_POLICIES } from '../security/policy';
import type { AppState } from '../state/types';

export const REPOS = [
  'acme/agentpulse-web',
  'acme/platform-api',
  'acme/billing',
  'acme/infra-k8s',
  'acme/mobile-app',
] as const;

const now = Date.now();
const min = 60_000;

export const SEED_AGENTS: Agent[] = [
  { id: 'ag_core', name: 'Devin-Core', role: 'Planner', status: 'idle', model: 'devin-planner-xl', currentSubtaskId: null, baseTokensPerMin: 14000, tokensPerMin: 0, completedTasks: 41, spent: 18.42 },
  { id: 'ag_ui', name: 'Devin-UI', role: 'Frontend', status: 'running', model: 'devin-coder-pro', currentSubtaskId: null, baseTokensPerMin: 26000, tokensPerMin: 26000, completedTasks: 63, spent: 31.08 },
  { id: 'ag_api', name: 'Devin-API', role: 'Backend', status: 'running', model: 'devin-coder-pro', currentSubtaskId: null, baseTokensPerMin: 24000, tokensPerMin: 24000, completedTasks: 57, spent: 27.9 },
  { id: 'ag_qa', name: 'Devin-QA', role: 'QA', status: 'running', model: 'devin-tester', currentSubtaskId: null, baseTokensPerMin: 18000, tokensPerMin: 18000, completedTasks: 88, spent: 15.61 },
  { id: 'ag_ops', name: 'Devin-Ops', role: 'DevOps', status: 'idle', model: 'devin-infra', currentSubtaskId: null, baseTokensPerMin: 16000, tokensPerMin: 0, completedTasks: 22, spent: 9.77 },
  { id: 'ag_sec', name: 'Devin-Sec', role: 'Security', status: 'idle', model: 'devin-sentinel', currentSubtaskId: null, baseTokensPerMin: 12000, tokensPerMin: 0, completedTasks: 35, spent: 7.2 },
];

const SEED_BRIEFS: Brief[] = [
  {
    id: 'brf_live',
    title: 'Ship live execution streamer for agent dashboard',
    description: 'Replace 2s polling in the dashboard with an SSE stream, add auto-scroll, typed events, and a Python API endpoint that fans out agent events. Must include e2e coverage.',
    priority: 'P0',
    repo: 'acme/agentpulse-web',
    tags: ['React', 'TypeScript', 'Python'],
    costCap: 60,
    spent: 21.4,
    status: 'running',
    createdAt: now - 42 * min,
  },
  {
    id: 'brf_hmac',
    title: 'Harden webhook ingress with HMAC SHA-256 verification',
    description: 'Verify X-AgentPulse-Signature on all inbound webhooks, reject stale timestamps, and add a Postgres table for delivery audit logs.',
    priority: 'P1',
    repo: 'acme/platform-api',
    tags: ['Python', 'Postgres'],
    costCap: 35,
    spent: 0,
    status: 'queued',
    createdAt: now - 18 * min,
  },
  {
    id: 'brf_docker',
    title: 'Containerize worker with multi-stage Docker build & CI',
    description: 'Shrink the worker image, run as non-root, add healthcheck and wire docker build into the GitHub Actions pipeline.',
    priority: 'P2',
    repo: 'acme/infra-k8s',
    tags: ['Docker', 'Kubernetes'],
    costCap: 25,
    spent: 24.1,
    status: 'completed',
    createdAt: now - 3 * 60 * min,
    prId: 'pr_479',
  },
  {
    id: 'brf_go',
    title: 'Port invoice reconciler from Python to Go',
    description: 'Rewrite the nightly invoice reconciler as a Go service with identical output; benchmark against the current job.',
    priority: 'P3',
    repo: 'acme/billing',
    tags: ['Go', 'Postgres'],
    costCap: 80,
    spent: 12.85,
    status: 'failed',
    createdAt: now - 95 * min,
  },
];

function seedSubtasks(): { subtasks: SubTask[]; agents: Agent[] } {
  const agents = SEED_AGENTS.map((a) => ({ ...a }));
  const live = decomposeBrief(SEED_BRIEFS[0], agents);
  const progressByRole: Record<string, number> = { Planner: 100 };
  const subtasks = live.map((st) => {
    if (st.wave === 0) return { ...st, status: 'done' as const, progress: progressByRole.Planner };
    return st;
  });
  // Put the three running agents to work on wave-1 / wave-2 tasks.
  const assign = (role: string, agentId: string, progress: number) => {
    const st = subtasks.find((s) => s.role === role && s.status === 'pending');
    const agent = agents.find((a) => a.id === agentId);
    if (!st || !agent) return;
    st.status = 'running';
    st.agentId = agentId;
    st.progress = progress;
    agent.currentSubtaskId = st.id;
  };
  const ui = subtasks.find((s) => s.title.startsWith('Build UI'));
  if (ui) {
    ui.status = 'done';
    ui.progress = 100;
  }
  assign('Frontend', 'ag_ui', 38);
  assign('Backend', 'ag_api', 64);
  const tests = subtasks.find((s) => s.role === 'QA' && s.status === 'pending');
  if (tests) {
    tests.status = 'running';
    tests.agentId = 'ag_qa';
    tests.progress = 22;
    const qa = agents.find((a) => a.id === 'ag_qa');
    if (qa) qa.currentSubtaskId = tests.id;
  }

  const failed = decomposeBrief(SEED_BRIEFS[3], agents).map((st, i) => {
    if (i === 0) return { ...st, status: 'done' as const, progress: 100 };
    if (st.role === 'Backend' && st.wave === 1) return { ...st, status: 'failed' as const, progress: 57 };
    return st;
  });
  const done = decomposeBrief(SEED_BRIEFS[2], agents).map((st) => ({ ...st, status: 'done' as const, progress: 100 }));
  return { subtasks: [...subtasks, ...failed, ...done], agents };
}

const SEED_PRS: PullRequest[] = [
  {
    id: 'pr_482',
    number: 482,
    title: 'feat(stream): replace polling with SSE execution stream',
    repo: 'acme/agentpulse-web',
    branch: 'devin/live-stream',
    base: 'main',
    agentId: 'ag_ui',
    status: 'open',
    commit: '3f9a1c7',
    createdAt: now - 12 * min,
    files: REACT_FILES,
    comments: [
      { id: 'c1', lineKey: 'src/api/stream.ts:0:8', author: 'Devin-Sec', body: 'Consider exponential backoff on reconnect to avoid hammering the gateway.', ts: now - 9 * min, kind: 'comment' },
    ],
    checks: [
      { name: 'ci / lint', status: 'passed' },
      { name: 'ci / unit', status: 'passed' },
      { name: 'ci / e2e', status: 'running' },
    ],
  },
  {
    id: 'pr_481',
    number: 481,
    title: 'feat(api): HMAC SHA-256 signature verification for ingest',
    repo: 'acme/platform-api',
    branch: 'devin/hmac-ingress',
    base: 'main',
    agentId: 'ag_api',
    status: 'approved',
    commit: 'b71e0d4',
    createdAt: now - 55 * min,
    files: PYTHON_FILES,
    comments: [
      { id: 'c2', lineKey: null, author: 'kennedy', body: 'LGTM — constant-time compare is exactly what we need.', ts: now - 30 * min, kind: 'approval' },
    ],
    checks: [
      { name: 'ci / lint', status: 'passed' },
      { name: 'ci / pytest', status: 'passed' },
      { name: 'security / semgrep', status: 'passed' },
    ],
  },
  {
    id: 'pr_479',
    number: 479,
    title: 'build: multi-stage Dockerfile & CI image build',
    repo: 'acme/infra-k8s',
    branch: 'devin/docker-slim',
    base: 'main',
    agentId: 'ag_ops',
    status: 'merged',
    commit: 'e04c2aa',
    createdAt: now - 2 * 60 * min,
    files: DOCKER_FILES,
    comments: [],
    checks: [
      { name: 'ci / build', status: 'passed' },
      { name: 'ci / trivy', status: 'passed' },
    ],
  },
];

const SEED_ENDPOINTS: WebhookEndpoint[] = [
  {
    id: 'wh_slack',
    name: 'Slack · #eng-agents',
    url: 'https://hooks.slack.com/services/T04ACME/B07PULSE/xYz123SlackToken',
    kind: 'slack',
    secret: 'whsec_9f86d081884c7d659a2feaa0c55ad015',
    enabled: true,
    events: { 'task.completed': true, 'task.failed': true, 'pr.created': true, 'hitl.approval_required': true },
    createdAt: now - 7 * 24 * 60 * min,
  },
  {
    id: 'wh_discord',
    name: 'Discord · #swarm-alerts',
    url: 'https://discord.com/api/webhooks/1182736455/agentpulse-alerts',
    kind: 'discord',
    secret: 'whsec_2c26b46b68ffc68ff99b453c1d304134',
    enabled: true,
    events: { 'task.completed': false, 'task.failed': true, 'pr.created': false, 'hitl.approval_required': true },
    createdAt: now - 3 * 24 * 60 * min,
  },
  {
    id: 'wh_custom',
    name: 'Ops API · incident bridge',
    url: 'https://ops.acme.dev/v1/hooks/agentpulse',
    kind: 'custom',
    secret: 'whsec_fcde2b2edba56bf408601fb721fe9b5c',
    enabled: false,
    events: { 'task.completed': true, 'task.failed': true, 'pr.created': true, 'hitl.approval_required': false },
    createdAt: now - 24 * 60 * min,
  },
];

const SEED_HITL: HitlRequest[] = [
  {
    id: 'hitl_7k2',
    agentId: 'ag_ops',
    briefId: 'brf_docker',
    command: 'kubectl delete deployment agentpulse-worker -n production',
    policyId: 'pol_k8s',
    risk: 'critical',
    category: 'prod_deploy',
    reason: 'Recreate worker deployment with new slim image',
    status: 'rejected',
    ts: now - 70 * min,
    decidedAt: now - 66 * min,
    decisionNote: 'Use a rolling update instead of delete.',
  },
  {
    id: 'hitl_9q4',
    agentId: 'ag_core',
    briefId: 'brf_live',
    command: 'git reset --hard origin/main',
    policyId: 'pol_reset',
    risk: 'high',
    category: 'branch_override',
    reason: 'Rebase plan branch: discard local changes after merge conflict',
    status: 'pending',
    ts: now - 2 * min,
  },
];

const SEED_STREAM: StreamEvent[] = [
  { id: 'ev1', ts: now - 6 * min, agentId: 'ag_core', kind: 'think', title: 'Drafted execution plan for "Ship live execution streamer"', detail: '3 waves · 8 sub-tasks', status: 'success' },
  { id: 'ev2', ts: now - 5 * min, agentId: 'ag_ui', kind: 'file_edit', title: 'Edited src/components/ExecutionStream.tsx', detail: '+27 −9', status: 'success' },
  { id: 'ev3', ts: now - 4 * min, agentId: 'ag_api', kind: 'shell', title: 'uvicorn app.main:app --reload', detail: 'Uvicorn running on http://127.0.0.1:8000', status: 'success' },
  { id: 'ev4', ts: now - 3 * min, agentId: 'ag_qa', kind: 'test', title: 'pytest tests/api -q', detail: '1 failed, 47 passed — test_ingest_rejects_stale_timestamp', status: 'failed' },
  { id: 'ev5', ts: now - 2 * min, agentId: 'ag_core', kind: 'security', title: 'HITL gate intercepted: git reset --hard origin/main', detail: 'Policy: Hard reset / branch delete', status: 'info' },
];

const SEED_TERMINAL: TerminalLine[] = [
  { id: 't1', ts: now - 5 * min, agentId: 'system', stream: 'system', text: 'AgentPulse sandbox mirror attached · ubuntu-22.04 · 4 vCPU · 16GB' },
  { id: 't2', ts: now - 5 * min, agentId: 'ag_ui', stream: 'stdin', text: '$ npm run dev -- --host' },
  { id: 't3', ts: now - 5 * min, agentId: 'ag_ui', stream: 'stdout', text: '  VITE v6.0.3  ready in 412 ms  ➜  Local: http://localhost:5173/' },
  { id: 't4', ts: now - 3 * min, agentId: 'ag_qa', stream: 'stdin', text: '$ pytest tests/api -q' },
  { id: 't5', ts: now - 3 * min, agentId: 'ag_qa', stream: 'stderr', text: 'FAILED tests/api/test_ingest.py::test_ingest_rejects_stale_timestamp - AssertionError: 202 != 401' },
  { id: 't6', ts: now - 2 * min, agentId: 'ag_core', stream: 'system', text: '⛔ HITL gate: "git reset --hard origin/main" intercepted — awaiting human sign-off (hitl_9q4)' },
];

function seedDeliveries(): WebhookDelivery[] {
  return [
    { id: 'dlv_a1', endpointId: 'wh_slack', event: 'hitl.approval_required', ts: now - 2 * min, statusCode: 200, latencyMs: 182, body: '{\n  "text": "⚠️ *Approval required* — git reset --hard origin/main"\n}', signature: 'sha256=4b1e…', test: false },
    { id: 'dlv_a2', endpointId: 'wh_discord', event: 'hitl.approval_required', ts: now - 2 * min, statusCode: 204, latencyMs: 241, body: '{\n  "content": "⚠️ **Approval required** — git reset --hard origin/main"\n}', signature: 'sha256=9ac0…', test: false },
    { id: 'dlv_a3', endpointId: 'wh_slack', event: 'pr.created', ts: now - 12 * min, statusCode: 200, latencyMs: 167, body: '{\n  "text": "🔀 *PR created* in `acme/agentpulse-web` — feat(stream): replace polling with SSE execution stream"\n}', signature: 'sha256=e3b0…', test: false },
  ];
}

function seedHistory(): CostSample[] {
  const out: CostSample[] = [];
  for (let i = 40; i > 0; i -= 1) {
    const tokens = 62000 + Math.sin(i / 4) * 9000 + (i % 7) * 900;
    out.push({ t: now - i * 4000, tokens, rate: (tokens * 60 * 0.012) / 1000 });
  }
  return out;
}

export function createInitialState(): AppState {
  const { subtasks, agents } = seedSubtasks();
  return {
    activeTab: 'dispatcher',
    briefs: SEED_BRIEFS.map((b) => ({ ...b })),
    subtasks,
    agents,
    stream: SEED_STREAM,
    terminal: SEED_TERMINAL,
    prs: SEED_PRS,
    endpoints: SEED_ENDPOINTS,
    deliveries: seedDeliveries(),
    hitl: SEED_HITL,
    policies: DEFAULT_POLICIES,
    cost: {
      pricePer1k: 0.012,
      totalSpend: 110.0,
      totalTokens: 9_166_000,
      dailyBudget: 400,
      hourlyLimit: 120,
      autoStop: true,
      tripped: null,
      history: seedHistory(),
    },
    globalPaused: false,
    selectedBriefId: 'brf_live',
    selectedPrId: 'pr_482',
    composerOpen: false,
    toasts: [],
  };
}
