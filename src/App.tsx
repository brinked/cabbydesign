import { useEffect, useState } from 'react';
import Toolbar from './components/Toolbar';
import WallsView from './components/WallsView';
import TopView from './components/TopView';
import View3D from './components/View3D';
import Report from './components/Report';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import AdminPanel from './components/AdminPanel';
import JobsScreen from './components/JobsScreen';
import ProfileScreen from './components/ProfileScreen';
import { AddItemModal, AppliancesModal, EditItemModal, PricingModal, RetailPricingModal, RoughInModal, SettingsModal } from './components/Modals';
import SaveJobModal from './components/SaveJobModal';
import { SvgDefs } from './components/svg';
import { useStore } from './state/store';
import { useSession } from './state/session';
import { loadModels, onModelsLoaded } from './three/models';

export default function App() {
  const tab = useStore((s) => s.tab);
  const status = useSession((s) => s.status);
  const screen = useSession((s) => s.screen);
  const init = useSession((s) => s.init);

  // Password-reset deep link: ?reset=<token> from the emailed link.
  const [resetToken, setResetToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('reset'));

  useEffect(() => {
    init();
  }, [init]);

  // Preload real 3D appliance models; flip the store flag so the 3D scene and
  // 2D sprites re-render with them once they arrive.
  useEffect(() => {
    const off = onModelsLoaded(() => useStore.setState({ modelsReady: true }));
    loadModels();
    return off;
  }, []);

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          // strip the token from the URL and return to the normal app/login flow
          window.history.replaceState(null, '', window.location.pathname);
          setResetToken(null);
        }}
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className="boot-screen">
        <div className="brand">
          Cab<span>Design</span>
        </div>
        <p>Loading…</p>
      </div>
    );
  }

  if (status === 'anon') return <Login />;

  return (
    <div className="app">
      <SvgDefs />
      <Toolbar />
      {screen === 'admin' && <AdminPanel />}
      {screen === 'jobs' && <JobsScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'design' && (
        <main className={`main main-${tab}`}>
          {tab === 'design' && <WallsView />}
          {tab === 'plan' && <TopView />}
          {tab === '3d' && <View3D />}
          {tab === 'report' && <Report />}
        </main>
      )}
      <AddItemModal />
      <EditItemModal />
      <RoughInModal />
      <PricingModal />
      <RetailPricingModal />
      <SettingsModal />
      <AppliancesModal />
      <SaveJobModal />
    </div>
  );
}
