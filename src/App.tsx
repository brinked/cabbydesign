import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import WallsView from './components/WallsView';
import TopView from './components/TopView';
import View3D from './components/View3D';
import Report from './components/Report';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import JobsScreen from './components/JobsScreen';
import ProfileScreen from './components/ProfileScreen';
import { AddItemModal, AppliancesModal, EditItemModal, PricingModal, RetailPricingModal, RoughInModal, SettingsModal } from './components/Modals';
import SaveJobModal from './components/SaveJobModal';
import { SvgDefs } from './components/svg';
import { useStore } from './state/store';
import { useSession } from './state/session';

export default function App() {
  const tab = useStore((s) => s.tab);
  const status = useSession((s) => s.status);
  const screen = useSession((s) => s.screen);
  const init = useSession((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

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
