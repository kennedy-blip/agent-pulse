import { useEffect, useRef, type Dispatch, type RefObject } from 'react';
import { RISKY_ATTEMPTS, ROLE_SCRIPTS } from '../agents/scripts';
import { filesForTags } from '../diffs/templates';
import { pick, shortSha, uid } from '../lib/utils';
import { classifyCommand } from '../security/policy';
import type { Agent, StreamEvent, TerminalLine, ToastTone, WebhookEvent } from '../types';
import type { EventData } from '../webhooks/payloads';
import { TICK_MS, TIME_SCALE } from './context';
import type { Action, AppState } from './types';

const FAIL_PROB = 0.0015;
const HITL_PROB = 0.004;
const MAX_PENDING_HITL = 2;

function ev(agentId: string, partial: Omit<StreamEvent, 'id' | 'ts' | 'agentId'>): StreamEvent {
  return { id: uid('ev'), ts: Date.now(), agentId, ...partial };
}

function line(agentId: string, text: string): TerminalLine {
  const stream = text.startsWith('$ ') ? 'stdin' : /error|failed|✗/i.test(text) ? 'stderr' : 'stdout';
  return { id: uid('tl'), ts: Date.now(), agentId, stream, text };
}

/**
 * Drives the mock swarm: agents pick up sub-tasks, emit execution steps,
 * trigger HITL gates, open PRs, accrue cost and trip guardrails.
 */
export function useSimulation(
  stateRef: RefObject<AppState>,
  dispatch: Dispatch<Action>,
  toast: (tone: ToastTone, title: string, body?: string) => void,
  emitWebhook: (event: WebhookEvent, data: EventData) => void,
) {
  const scriptIdx = useRef<Record<string, number>>({});
  const prCounter = useRef(483);

  useEffect(() => {
    const tick = () => {
      const s = stateRef.current;
      const events: StreamEvent[] = [];
      const lines: TerminalLine[] = [];
      const briefById = new Map(s.briefs.map((b) => [b.id, b]));
      const stById = new Map(s.subtasks.map((st) => [st.id, st]));
      const doneIds = new Set(s.subtasks.filter((st) => st.status === 'done').map((st) => st.id));
      const claimed = new Set<string>();
      const justFinished = new Set<string>();
      let pendingHitl = s.hitl.filter((h) => h.status === 'pending').length;

      const findWork = (agent: Agent) => {
        const ready = s.subtasks.filter(
          (st) =>
            st.status === 'pending' &&
            !claimed.has(st.id) &&
            briefById.get(st.briefId)?.status === 'running' &&
            st.dependsOn.every((d) => doneIds.has(d)) &&
            (st.agentId === agent.id || (st.agentId === null && st.role === agent.role)),
        );
        const prio = (id: string) => briefById.get(id)?.priority ?? 'P3';
        ready.sort((a, b) => prio(a.briefId).localeCompare(prio(b.briefId)) || a.wave - b.wave);
        return ready[0];
      };

      if (!s.globalPaused) {
        for (const agent of s.agents) {
          if (agent.status !== 'running') continue;
          const current = agent.currentSubtaskId ? stById.get(agent.currentSubtaskId) : undefined;
          const brief = current ? briefById.get(current.briefId) : undefined;

          if (current && brief && (brief.status === 'cancelled' || brief.status === 'failed' || brief.status === 'completed')) {
            dispatch({ type: 'UPDATE_AGENT', id: agent.id, patch: { currentSubtaskId: null } });
            continue;
          }

          if (!current || current.status === 'done' || current.status === 'failed' || current.status === 'pending') {
            const next = findWork(agent);
            if (next) {
              claimed.add(next.id);
              dispatch({ type: 'UPDATE_SUBTASK', id: next.id, patch: { status: 'running', agentId: agent.id } });
              dispatch({ type: 'UPDATE_AGENT', id: agent.id, patch: { currentSubtaskId: next.id } });
              events.push(ev(agent.id, { kind: 'think', title: `Picked up: ${next.title}`, detail: briefById.get(next.briefId)?.title, status: 'info' }));
            } else if (current) {
              dispatch({ type: 'UPDATE_AGENT', id: agent.id, patch: { currentSubtaskId: null } });
            }
            continue;
          }

          if (!brief || brief.status !== 'running' || current.status !== 'running') continue;

          // Random failure
          if (Math.random() < FAIL_PROB) {
            dispatch({ type: 'UPDATE_SUBTASK', id: current.id, patch: { status: 'failed' } });
            dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'failed' });
            events.push(ev(agent.id, { kind: 'test', title: `Sub-task failed: ${current.title}`, detail: 'Exit code 1 — 3 assertions failed after 2 self-heal attempts', status: 'failed' }));
            lines.push(line(agent.id, `✗ error: ${current.title} failed after 2 retries (exit 1)`));
            emitWebhook('task.failed', { brief_id: brief.id, title: brief.title, repo: brief.repo, subtask: current.title, agent: agent.name });
            toast('danger', 'Task failed', `${agent.name}: ${current.title}`);
            continue;
          }

          // HITL interception
          if (pendingHitl < MAX_PENDING_HITL && Math.random() < HITL_PROB) {
            const attempt = pick(RISKY_ATTEMPTS);
            const policy = classifyCommand(attempt.command, s.policies);
            if (policy) {
              pendingHitl += 1;
              const id = uid('hitl');
              dispatch({
                type: 'ADD_HITL',
                request: { id, agentId: agent.id, briefId: brief.id, command: attempt.command, policyId: policy.id, risk: policy.risk, category: policy.category, reason: attempt.reason, status: 'pending', ts: Date.now() },
              });
              dispatch({ type: 'SET_AGENT_STATUS', id: agent.id, status: 'blocked' });
              dispatch({ type: 'UPDATE_SUBTASK', id: current.id, patch: { status: 'blocked' } });
              dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'awaiting_hitl' });
              events.push(ev(agent.id, { kind: 'security', title: `HITL gate intercepted: ${attempt.command}`, detail: `Policy: ${policy.name} · risk ${policy.risk}`, status: 'info' }));
              lines.push({ id: uid('tl'), ts: Date.now(), agentId: agent.id, stream: 'system', text: `⛔ HITL gate: "${attempt.command}" intercepted — awaiting human sign-off (${id})` });
              emitWebhook('hitl.approval_required', { request_id: id, agent: agent.name, command: attempt.command, risk: policy.risk, repo: brief.repo });
              toast('warning', 'Approval required', `${agent.name} wants to run: ${attempt.command}`);
              continue;
            }
          }

          // Regular step
          if (Math.random() < 0.8) {
            const script = ROLE_SCRIPTS[agent.role];
            const idx = scriptIdx.current[agent.id] ?? 0;
            const step = script[idx % script.length];
            scriptIdx.current[agent.id] = idx + 1;
            events.push(ev(agent.id, { kind: step.kind, title: step.title, detail: step.detail, status: step.kind === 'think' ? 'info' : 'success' }));
            for (const out of step.out ?? []) lines.push(line(agent.id, out));
          }
          const progress = Math.min(100, current.progress + 4 + Math.random() * 9);
          if (progress >= 100) {
            justFinished.add(current.id);
            dispatch({ type: 'UPDATE_SUBTASK', id: current.id, patch: { status: 'done', progress: 100 } });
            dispatch({ type: 'UPDATE_AGENT', id: agent.id, patch: { currentSubtaskId: null, completedTasks: agent.completedTasks + 1 } });
            events.push(ev(agent.id, { kind: 'git', title: `Completed: ${current.title}`, detail: `commit ${shortSha()} · ${brief.repo}`, status: 'success' }));
          } else {
            dispatch({ type: 'UPDATE_SUBTASK', id: current.id, patch: { progress } });
          }
        }

        // Brief completion → PR
        for (const brief of s.briefs) {
          if (brief.status !== 'running') continue;
          const subs = s.subtasks.filter((st) => st.briefId === brief.id);
          if (!subs.length || !subs.every((st) => st.status === 'done' || justFinished.has(st.id))) continue;
          const number = prCounter.current++;
          const prId = uid('pr');
          const planner = s.agents.find((a) => a.role === 'Planner');
          const slug = brief.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28).replace(/-$/, '');
          dispatch({
            type: 'ADD_PR',
            pr: {
              id: prId,
              number,
              title: `feat: ${brief.title.charAt(0).toLowerCase()}${brief.title.slice(1)}`,
              repo: brief.repo,
              branch: `devin/${slug}`,
              base: 'main',
              agentId: planner?.id ?? s.agents[0].id,
              status: 'open',
              commit: shortSha(),
              createdAt: Date.now(),
              files: filesForTags(brief.tags),
              comments: [],
              checks: [
                { name: 'ci / lint', status: 'running' },
                { name: 'ci / test', status: 'running' },
                { name: 'security / semgrep', status: 'running' },
              ],
            },
          });
          dispatch({ type: 'UPDATE_BRIEF', id: brief.id, patch: { status: 'completed', prId } });
          events.push(ev(planner?.id ?? 'system', { kind: 'git', title: `Opened PR #${number}: ${brief.title}`, detail: `${brief.repo} · devin/${slug} → main`, status: 'success' }));
          emitWebhook('task.completed', { brief_id: brief.id, title: brief.title, repo: brief.repo, cost_usd: Number(brief.spent.toFixed(2)) });
          emitWebhook('pr.created', { pr_number: number, title: brief.title, repo: brief.repo, branch: `devin/${slug}` });
          toast('success', `Brief completed · PR #${number} opened`, brief.title);
        }

        // Cost caps per brief
        for (const brief of s.briefs) {
          if ((brief.status === 'running' || brief.status === 'awaiting_hitl') && brief.spent >= brief.costCap) {
            dispatch({ type: 'SET_BRIEF_STATUS', id: brief.id, status: 'paused' });
            events.push(ev('system', { kind: 'security', title: `Cost cap reached for "${brief.title}"`, detail: `$${brief.spent.toFixed(2)} / $${brief.costCap} — brief paused`, status: 'failed' }));
            toast('warning', 'Brief paused: cost cap reached', brief.title);
          }
        }
      }

      // PR lifecycle: CI checks + revisions
      for (const pr of s.prs) {
        if (pr.checks.some((c) => c.status === 'running') && Math.random() < 0.18) {
          dispatch({
            type: 'UPDATE_PR',
            id: pr.id,
            patch: { checks: pr.checks.map((c) => (c.status === 'running' ? { ...c, status: 'passed' } : c)) },
          });
        }
        if (!s.globalPaused && pr.status === 'changes_requested' && pr.revisionDueAt && pr.revisionDueAt <= Date.now()) {
          const commit = shortSha();
          dispatch({
            type: 'UPDATE_PR',
            id: pr.id,
            patch: {
              status: 'open',
              commit,
              revisionDueAt: undefined,
              checks: pr.checks.map((c) => ({ ...c, status: 'running' })),
              comments: [
                ...pr.comments,
                { id: uid('c'), lineKey: null, author: s.agents.find((a) => a.id === pr.agentId)?.name ?? 'Devin', body: `Addressed review feedback in ${commit}. Ready for another look.`, ts: Date.now(), kind: 'comment' },
              ],
            },
          });
          events.push(ev(pr.agentId, { kind: 'git', title: `Pushed revision to PR #${pr.number}`, detail: `commit ${commit} · addressed review comments`, status: 'success' }));
          toast('info', `PR #${pr.number} revised`, 'Agent pushed a new revision for review');
        }
      }

      // Cost accounting
      const perAgentTokens: Record<string, number> = {};
      const perAgentSpend: Record<string, number> = {};
      const perBriefSpend: Record<string, number> = {};
      let tokens = 0;
      for (const agent of s.agents) {
        let t = 0;
        if (!s.globalPaused) {
          const st = agent.currentSubtaskId ? stById.get(agent.currentSubtaskId) : undefined;
          const active = st && st.status === 'running' && briefById.get(st.briefId)?.status === 'running';
          if (agent.status === 'running') t = agent.baseTokensPerMin * (active ? 0.85 + Math.random() * 0.3 : 0.12);
          else if (agent.status === 'blocked') t = agent.baseTokensPerMin * 0.04;
          const spend = ((t * 60) / 1000) * s.cost.pricePer1k * (TICK_MS / 1000 / 3600) * TIME_SCALE;
          perAgentSpend[agent.id] = spend;
          if (st && active) perBriefSpend[st.briefId] = (perBriefSpend[st.briefId] ?? 0) + spend;
        }
        perAgentTokens[agent.id] = Math.round(t);
        tokens += t;
      }
      const rate = ((tokens * 60) / 1000) * s.cost.pricePer1k;
      const spend = Object.values(perAgentSpend).reduce((a, b) => a + b, 0);
      dispatch({ type: 'COST_TICK', sample: { t: Date.now(), rate, tokens }, spend, perAgentTokens, perAgentSpend, perBriefSpend });

      if (s.cost.autoStop && !s.cost.tripped && !s.globalPaused) {
        let reason: string | null = null;
        if (rate > s.cost.hourlyLimit) reason = `Burn rate $${rate.toFixed(2)}/hr exceeded the $${s.cost.hourlyLimit}/hr limit`;
        else if (s.cost.totalSpend + spend >= s.cost.dailyBudget) reason = `Daily budget of $${s.cost.dailyBudget} exhausted`;
        if (reason) {
          dispatch({ type: 'UPDATE_COST', patch: { tripped: reason } });
          dispatch({ type: 'SET_GLOBAL_PAUSE', paused: true });
          events.push(ev('system', { kind: 'security', title: 'Cost guardrail tripped — swarm halted', detail: reason, status: 'failed' }));
          toast('danger', 'Auto-stop: swarm halted', reason);
        }
      }

      if (events.length) dispatch({ type: 'PUSH_STREAM', events });
      if (lines.length) dispatch({ type: 'PUSH_TERMINAL', lines });
    };

    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [stateRef, dispatch, toast, emitWebhook]);
}
