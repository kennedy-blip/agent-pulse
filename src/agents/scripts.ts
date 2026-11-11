import type { AgentRole, StreamKind } from '../types';

export interface ScriptStep {
  kind: StreamKind;
  title: string;
  detail?: string;
  out?: string[];
}

export const ROLE_SCRIPTS: Record<AgentRole, ScriptStep[]> = {
  Planner: [
    { kind: 'think', title: 'Mapping repository structure', detail: 'Indexed 1,284 files across 46 packages', out: ['$ rg --files | wc -l', '1284'] },
    { kind: 'shell', title: 'Reading CONTRIBUTING.md & CODEOWNERS', detail: 'cat CONTRIBUTING.md .github/CODEOWNERS', out: ['$ cat .github/CODEOWNERS', '/src/api/   @platform-team', '/web/       @frontend-guild'] },
    { kind: 'think', title: 'Drafting dependency-ordered execution plan', detail: 'Plan: 3 waves · 7 sub-tasks · est. 38 min' },
    { kind: 'git', title: 'Creating feature branch', detail: 'git checkout -b devin/agentpulse-swarm', out: ["$ git checkout -b devin/agentpulse-swarm", "Switched to a new branch 'devin/agentpulse-swarm'"] },
    { kind: 'file_edit', title: 'Updated docs/ARCHITECTURE.md', detail: 'docs/ARCHITECTURE.md  +42 −6' },
  ],
  Frontend: [
    { kind: 'file_edit', title: 'Edited src/components/Dashboard.tsx', detail: 'src/components/Dashboard.tsx  +86 −12' },
    { kind: 'file_edit', title: 'Created src/hooks/useLiveMetrics.ts', detail: 'src/hooks/useLiveMetrics.ts  +54 −0' },
    { kind: 'shell', title: 'Type-checking project', detail: 'npx tsc --noEmit', out: ['$ npx tsc --noEmit', '✓ 0 errors in 212 files (3.4s)'] },
    { kind: 'browser', title: 'Rendering /dashboard in sandbox browser', detail: 'GET http://localhost:5173/dashboard → 200 (412ms)' },
    { kind: 'shell', title: 'Linting changed files', detail: 'npx eslint src --fix', out: ['$ npx eslint src --fix', '✔ 0 problems (0 errors, 0 warnings)'] },
    { kind: 'browser', title: 'Capturing responsive screenshots', detail: 'viewport 390×844, 1440×900 — no layout shift detected' },
    { kind: 'file_edit', title: 'Edited src/styles/tokens.css', detail: 'src/styles/tokens.css  +14 −3' },
  ],
  Backend: [
    { kind: 'file_edit', title: 'Edited app/api/routes/webhooks.py', detail: 'app/api/routes/webhooks.py  +71 −9' },
    { kind: 'file_edit', title: 'Created app/services/signing.py', detail: 'app/services/signing.py  +38 −0' },
    { kind: 'shell', title: 'Running database migration', detail: 'alembic upgrade head', out: ['$ alembic upgrade head', 'INFO  [alembic.runtime.migration] Running upgrade 9f2c -> a41d, add webhook_deliveries'] },
    { kind: 'shell', title: 'Starting dev server', detail: 'uvicorn app.main:app --reload', out: ['$ uvicorn app.main:app --reload --port 8000', 'INFO:     Uvicorn running on http://127.0.0.1:8000'] },
    { kind: 'test', title: 'pytest tests/api -q', detail: '48 passed in 6.21s', out: ['$ pytest tests/api -q', '................................................ [100%]', '48 passed in 6.21s'] },
    { kind: 'shell', title: 'curl -X POST /v1/hooks/test', detail: 'HTTP/1.1 202 Accepted', out: ['$ curl -sX POST localhost:8000/v1/hooks/test -d @payload.json', '{"status":"accepted","delivery_id":"dlv_8e1f"}'] },
  ],
  QA: [
    { kind: 'test', title: 'npm run test -- --coverage', detail: '214 passed · coverage 91.4%', out: ['$ npm run test -- --coverage', ' ✓ src/components (126 tests)', ' ✓ src/hooks (88 tests)', ' Test Files  31 passed (31)', ' Coverage    91.4% statements'] },
    { kind: 'file_edit', title: 'Created tests/e2e/dispatch.spec.ts', detail: 'tests/e2e/dispatch.spec.ts  +63 −0' },
    { kind: 'test', title: 'playwright test --project=chromium', detail: '18 passed (42.1s)', out: ['$ npx playwright test --project=chromium', 'Running 18 tests using 4 workers', '  18 passed (42.1s)'] },
    { kind: 'browser', title: 'Replaying recorded user flow', detail: 'dispatch → approve → merge flow verified' },
    { kind: 'test', title: 'Mutation testing (stryker)', detail: 'mutation score 84%', out: ['$ npx stryker run', 'Mutation score: 84.02%'] },
  ],
  DevOps: [
    { kind: 'file_edit', title: 'Edited Dockerfile', detail: 'Dockerfile  +18 −11 (multi-stage build)' },
    { kind: 'shell', title: 'docker build -t agentpulse:dev .', detail: 'image size 142MB (−61%)', out: ['$ docker build -t agentpulse:dev .', ' => [builder 4/6] RUN npm ci', ' => exporting to image  142MB', 'Successfully tagged agentpulse:dev'] },
    { kind: 'file_edit', title: 'Edited .github/workflows/ci.yml', detail: '.github/workflows/ci.yml  +27 −4' },
    { kind: 'shell', title: 'helm lint charts/agentpulse', detail: '1 chart(s) linted, 0 failed', out: ['$ helm lint charts/agentpulse', '==> Linting charts/agentpulse', '1 chart(s) linted, 0 chart(s) failed'] },
  ],
  Security: [
    { kind: 'security', title: 'Running semgrep ruleset p/owasp-top-ten', detail: '0 high · 2 low findings', out: ['$ semgrep --config p/owasp-top-ten', 'Ran 412 rules on 318 files: 2 findings (low)'] },
    { kind: 'shell', title: 'npm audit --omit=dev', detail: 'found 0 vulnerabilities', out: ['$ npm audit --omit=dev', 'found 0 vulnerabilities'] },
    { kind: 'security', title: 'Scanning diff for leaked secrets', detail: 'gitleaks: no leaks found', out: ['$ gitleaks detect --staged', 'INF no leaks found'] },
    { kind: 'think', title: 'Reviewing HMAC verification path', detail: 'Constant-time compare confirmed in verify_signature()' },
  ],
};

export interface RiskyAttempt {
  command: string;
  reason: string;
}

export const RISKY_ATTEMPTS: RiskyAttempt[] = [
  { command: 'rm -rf ./node_modules ./dist ./.cache /tmp/build-*', reason: 'Clean stale build artifacts before rebuild' },
  { command: 'git push --force origin devin/agentpulse-swarm:main', reason: 'Fast-forward rejected; agent attempting to overwrite main' },
  { command: 'psql $DATABASE_URL -c "DROP TABLE webhook_deliveries_legacy;"', reason: 'Remove legacy table after migration' },
  { command: 'kubectl delete deployment agentpulse-worker -n production', reason: 'Recreate worker deployment with new image' },
  { command: 'cat ~/.aws/credentials', reason: 'Validate deployment credentials for S3 artifact upload' },
  { command: 'git reset --hard origin/main', reason: 'Discard local changes after merge conflict' },
  { command: 'terraform apply -auto-approve -target=module.prod_db', reason: 'Apply connection pool size change' },
];
