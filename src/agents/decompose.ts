import type { Dispatch } from 'react';
import type { Action } from '../state/types';
import type { Agent, AgentRole, Brief, SubTask } from '../types';
import { uid } from '../lib/utils';

interface Draft {
  key: string;
  title: string;
  role: AgentRole;
  deps: string[];
  est: number;
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

/**
 * Heuristically decomposes a natural-language brief into a dependency-ordered
 * set of sub-tasks, each routed to a specialised agent role.
 */
export function decomposeBrief(brief: Brief, agents: Agent[]): SubTask[] {
  const text = `${brief.title} ${brief.description}`.toLowerCase();
  const tags = new Set(brief.tags);
  const drafts: Draft[] = [
    { key: 'plan', title: 'Index repository & draft execution plan', role: 'Planner', deps: [], est: 4 },
  ];
  const impl: string[] = [];

  const wantsFrontend =
    tags.has('React') || tags.has('TypeScript') || has(text, ['ui', 'frontend', 'component', 'page', 'dashboard', 'form']);
  const wantsBackend =
    tags.has('Python') || tags.has('Go') || tags.has('Rust') || tags.has('Postgres') ||
    has(text, ['api', 'backend', 'endpoint', 'service', 'database', 'webhook', 'queue']);
  const wantsInfra = tags.has('Docker') || tags.has('Kubernetes') || has(text, ['deploy', 'ci', 'pipeline', 'container', 'helm']);
  const wantsSecurity = has(text, ['auth', 'secret', 'token', 'permission', 'oauth', 'security', 'rbac', 'cve']);

  if (wantsBackend) {
    drafts.push({ key: 'api', title: 'Implement API endpoints & request validation', role: 'Backend', deps: ['plan'], est: 12 });
    impl.push('api');
    if (tags.has('Postgres') || has(text, ['database', 'schema', 'migration'])) {
      drafts.push({ key: 'db', title: 'Write schema migration & data access layer', role: 'Backend', deps: ['plan'], est: 8 });
      impl.push('db');
    }
  }
  if (wantsFrontend) {
    drafts.push({ key: 'ui', title: 'Build UI components & responsive layout', role: 'Frontend', deps: ['plan'], est: 10 });
    drafts.push({
      key: 'state',
      title: 'Wire client state & API integration',
      role: 'Frontend',
      deps: wantsBackend ? ['ui', 'api'] : ['ui'],
      est: 6,
    });
    impl.push('ui', 'state');
  }
  if (!wantsFrontend && !wantsBackend) {
    drafts.push({ key: 'core', title: `Implement core change: ${brief.title}`, role: 'Backend', deps: ['plan'], est: 10 });
    impl.push('core');
  }
  if (wantsInfra) {
    drafts.push({ key: 'infra', title: 'Containerize service & update CI pipeline', role: 'DevOps', deps: ['plan'], est: 7 });
    impl.push('infra');
  }
  drafts.push({
    key: 'sec',
    title: wantsSecurity ? 'Threat-model auth flow & audit secret handling' : 'Static analysis & dependency audit',
    role: 'Security',
    deps: impl.length ? [...impl] : ['plan'],
    est: 5,
  });
  drafts.push({ key: 'tests', title: 'Author unit & integration tests', role: 'QA', deps: [...impl], est: 8 });
  drafts.push({ key: 'e2e', title: 'Run full test suite & e2e smoke', role: 'QA', deps: ['tests', 'sec'], est: 5 });
  drafts.push({ key: 'pr', title: 'Update docs, squash commits & open PR', role: 'Planner', deps: ['e2e'], est: 3 });

  const idMap = new Map<string, string>();
  for (const d of drafts) idMap.set(d.key, uid('st'));
  const waveOf = new Map<string, number>();
  const computeWave = (key: string): number => {
    const cached = waveOf.get(key);
    if (cached !== undefined) return cached;
    const d = drafts.find((x) => x.key === key);
    const w = d && d.deps.length ? Math.max(...d.deps.map(computeWave)) + 1 : 0;
    waveOf.set(key, w);
    return w;
  };

  return drafts.map((d) => ({
    id: idMap.get(d.key) as string,
    briefId: brief.id,
    title: d.title,
    role: d.role,
    agentId: agents.find((a) => a.role === d.role)?.id ?? null,
    status: 'pending',
    progress: 0,
    dependsOn: d.deps.map((k) => idMap.get(k) as string),
    wave: computeWave(d.key),
    estMinutes: d.est,
  }));
}

/** Spins up idle agents whose role is required by the given sub-tasks. */
export function wakeIdleAgents(subtasks: SubTask[], agents: Agent[], dispatch: Dispatch<Action>): void {
  const roles = new Set(subtasks.map((s) => s.role));
  for (const a of agents) {
    if (a.status === 'idle' && roles.has(a.role)) dispatch({ type: 'SET_AGENT_STATUS', id: a.id, status: 'running' });
  }
}
