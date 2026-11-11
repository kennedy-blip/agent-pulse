# AgentPulse

Enterprise orchestrator for autonomous software-engineering agents: multi-agent swarm dispatch, live execution streaming, PR/diff review, webhook alerting and human-in-the-loop security guardrails.

Built with React 19 + TypeScript (strict), Vite, Tailwind CSS 4 and Lucide icons. All data is simulated client-side, so no backend is needed.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

## Sections

| Tab | What it does |
| --- | --- |
| Task Dispatcher | Write natural-language briefs with a priority tier, target repo, tech-stack tags and a compute cost cap. Filter, sort, pause, cancel or retry the queue. |
| Swarm Orchestrator | Breaks each brief into dependency-ordered sub-tasks split across specialist agents (matrix or parallel-wave view), with reassignment and an agent roster. |
| Live Execution & Terminal | Streams file edits, shell commands and test runs. Includes a sandbox browser mirror and an interactive terminal whose risky commands go through the HITL policies. |
| PR & Diff Reviewer | Side-by-side and unified diffs with inline comments, revision requests, one-click approval and merging. |
| Webhook & Alert Hub | Register Slack, Discord or custom HTTPS endpoints. Toggle events per endpoint, send test pings with a signed payload preview, and check signatures with the HMAC SHA-256 verifier. |
| HITL & Security | Holds destructive commands (force push, `rm -rf`, `DROP TABLE`, `kubectl delete`…) until a human approves them. Also covers editable regex policies, a dry-run tester, a live $/hour and token-burn monitor, and auto-stop limits. |

## Webhook signatures

Each delivery includes `X-AgentPulse-Timestamp` and `X-AgentPulse-Signature: sha256=<hex>`, where

```
signature = HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
```

Receivers should recompute the HMAC, compare it in constant time, and reject stale timestamps.

## Layout

```
src/
  agents/      brief composer, dispatcher queue, swarm planner, decomposition, agent scripts
  components/  header, toasts, shared UI primitives
  diffs/       diff parser, diff view, PR reviewer
  security/    HITL gatekeeper, cost guard, command policies
  terminal/    execution stream, sandbox viewer, simulated shell
  webhooks/    webhook hub, payload builders and signing
  state/       reducer store, context, simulation loop
  data/        seed data
  types/       domain types
```
