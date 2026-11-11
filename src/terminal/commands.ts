import { formatTokens, formatUsd, shortSha } from '../lib/utils';
import type { AppState } from '../state/types';
import type { TermStream } from '../types';

export interface CommandOutput {
  lines: { stream: TermStream; text: string }[];
  clear?: boolean;
}

const out = (...texts: string[]): CommandOutput => ({ lines: texts.map((text) => ({ stream: 'stdout', text })) });
const err = (...texts: string[]): CommandOutput => ({ lines: texts.map((text) => ({ stream: 'stderr', text })) });

export const HELP_TEXT = [
  'Available sandbox commands:',
  '  help                 show this help',
  '  clear                clear terminal buffer',
  '  ls | pwd | whoami    inspect sandbox',
  '  git status | git log  repository state',
  '  npm test | pytest    run test suites',
  '  agents               list swarm agents',
  '  cost                 show live burn metrics',
  '  hitl                 list pending approvals',
  'Destructive commands (rm -rf, git push --force, DROP TABLE, kubectl delete…)',
  'are intercepted by the HITL gatekeeper and require human sign-off.',
];

export function runCommand(raw: string, state: AppState): CommandOutput {
  const cmd = raw.trim();
  const [head, ...rest] = cmd.split(/\s+/);
  const arg = rest.join(' ');
  switch (head) {
    case 'help':
      return out(...HELP_TEXT);
    case 'clear':
      return { lines: [], clear: true };
    case 'pwd':
      return out('/home/devin/workspace/agentpulse-web');
    case 'whoami':
      return out('operator (human-in-the-loop) · sandbox uid=1000');
    case 'ls':
      return out('README.md  package.json  src/  tests/  app/  Dockerfile  .github/  charts/');
    case 'echo':
      return out(arg);
    case 'date':
      return out(new Date().toString());
    case 'git':
      if (arg.startsWith('status'))
        return out('On branch devin/live-stream', 'Changes not staged for commit:', '  modified:   src/components/ExecutionStream.tsx', '  modified:   app/api/routes/webhooks.py', 'Untracked files:', '  src/api/stream.ts');
      if (arg.startsWith('log'))
        return out(...state.prs.slice(0, 5).map((p) => `${p.commit} ${p.title}`));
      if (arg.startsWith('diff')) return out('diff --git a/src/api/stream.ts b/src/api/stream.ts', '+export function subscribe(agentId: string, listener: Listener) {');
      if (arg.startsWith('commit')) return out(`[devin/live-stream ${shortSha()}] ${arg.replace(/^commit\s+(-m\s+)?/, '').replace(/["']/g, '') || 'wip'}`, ' 2 files changed, 41 insertions(+), 9 deletions(-)');
      if (arg.startsWith('push')) return out('Enumerating objects: 9, done.', 'To github.com:acme/agentpulse-web.git', '   3f9a1c7..b2e4d10  devin/live-stream -> devin/live-stream');
      return out(`git: '${arg}' simulated OK`);
    case 'npm':
    case 'pnpm':
    case 'yarn':
      if (/test/.test(arg)) return out('> vitest run', ' ✓ src/components (126 tests) 2.1s', ' ✓ src/hooks (88 tests) 1.4s', ' Test Files  31 passed (31)', '      Tests  214 passed (214)');
      if (/build/.test(arg)) return out('> vite build', '✓ 1284 modules transformed.', 'dist/index.html   0.62 kB', 'dist/assets/index.js  214.33 kB │ gzip: 68.10 kB', '✓ built in 3.82s');
      if (/install|ci/.test(arg)) return out('added 812 packages, audited 813 packages in 9s', 'found 0 vulnerabilities');
      return out(`${head} ${arg}: done`);
    case 'pytest':
      return out('================ test session starts ================', 'collected 48 items', 'tests/api ................................................ [100%]', '================ 48 passed in 6.21s =================');
    case 'agents':
      return out(...state.agents.map((a) => `${a.name.padEnd(11)} ${a.role.padEnd(9)} ${a.status.padEnd(8)} ${formatTokens(a.tokensPerMin).padStart(6)} tok/min`));
    case 'cost': {
      const last = state.cost.history[state.cost.history.length - 1];
      return out(`burn rate   ${formatUsd(last?.rate ?? 0)}/hr (limit ${formatUsd(state.cost.hourlyLimit, 0)}/hr)`, `tokens/min  ${formatTokens(last?.tokens ?? 0)}`, `spend today ${formatUsd(state.cost.totalSpend)} / ${formatUsd(state.cost.dailyBudget, 0)}`, `auto-stop   ${state.cost.autoStop ? 'armed' : 'disarmed'}`);
    }
    case 'hitl': {
      const pending = state.hitl.filter((h) => h.status === 'pending');
      return pending.length ? out(...pending.map((h) => `${h.id}  [${h.risk}]  ${h.command}`)) : out('No pending approvals.');
    }
    case 'cat':
      if (/\.env|credentials|id_rsa/.test(arg)) return err(`cat: ${arg}: permission denied by sandbox policy`);
      return out(`// ${arg}`, '(file contents elided in mirror view)');
    case 'sudo':
      return err('sudo: operator sessions cannot escalate privileges in the sandbox');
    case '':
      return { lines: [] };
    default:
      return err(`${head}: command not found (type "help")`);
  }
}
