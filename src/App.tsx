import { BriefComposer } from './agents/BriefComposer';
import { SwarmPlanner } from './agents/SwarmPlanner';
import { TaskDispatcher } from './agents/TaskDispatcher';
import { Header } from './components/Header';
import { Toasts } from './components/Toasts';
import { Modal } from './components/ui';
import { DiffReviewer } from './diffs/DiffReviewer';
import { CostGuard } from './security/CostGuard';
import { HitlGatekeeper } from './security/HitlGatekeeper';
import { StoreProvider } from './state/StoreProvider';
import { useStore } from './state/context';
import { ExecutionStream } from './terminal/ExecutionStream';
import { SandboxViewer } from './terminal/SandboxViewer';
import { WebhookHub } from './webhooks/WebhookHub';

function ActiveView() {
  const { state } = useStore();
  switch (state.activeTab) {
    case 'dispatcher':
      return <TaskDispatcher />;
    case 'swarm':
      return <SwarmPlanner />;
    case 'execution':
      return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ExecutionStream />
          <SandboxViewer />
        </div>
      );
    case 'diffs':
      return <DiffReviewer />;
    case 'webhooks':
      return <WebhookHub />;
    case 'security':
      return (
        <div className="space-y-5">
          <HitlGatekeeper />
          <CostGuard />
        </div>
      );
  }
}

function Shell() {
  const { state, dispatch } = useStore();
  const close = () => dispatch({ type: 'SET_COMPOSER', open: false });
  return (
    <div className="min-h-dvh bg-obsidian text-slate-200">
      <Header />
      <main id="main" className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 lg:py-6">
        <ActiveView />
      </main>
      <Modal open={state.composerOpen} onClose={close} title="Dispatch New Brief" wide>
        <BriefComposer onDone={close} compact />
      </Modal>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
