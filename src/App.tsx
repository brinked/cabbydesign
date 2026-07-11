import { useEffect, useState } from 'react';
import Toolbar from './components/Toolbar';
import WallsView from './components/WallsView';
import TopView from './components/TopView';
import View3D from './components/View3D';
import Report from './components/Report';
import StartScreen from './components/StartScreen';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import AdminPanel from './components/AdminPanel';
import JobsScreen from './components/JobsScreen';
import ProfileScreen from './components/ProfileScreen';
import { AddItemModal, AppliancesModal, EditItemModal, HandlesModal, MyAppliancesModal, OpeningModal, PricingModal, RetailPricingModal, RoughInModal, SettingsModal } from './components/Modals';
import { ApplianceAlignerModal } from './components/ApplianceAligner';
import AuthModal from './components/AuthModal';
import CatalogPrefsScreen from './components/CatalogPrefsScreen';
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
  const verifyEmail = useSession((s) => s.verifyEmail);
  // Email-verification deep link: ?verify=<token> from the signup email.
  const [verifyToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('verify'));
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!verifyToken) return;
    window.history.replaceState(null, '', window.location.pathname);
    verifyEmail(verifyToken)
      .then(() => setVerifyMsg('✅ Email verified — welcome to CabDesign! You are signed in.'))
      .catch((e) => setVerifyMsg(`⚠ ${e instanceof Error ? e.message : 'Verification failed.'}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyToken]);

  // Password-reset deep link: ?reset=<token> from the emailed link.
  const [resetToken, setResetToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('reset'));
  // Unlisted admin/dealer entrance: visiting /?admin shows the sign-in screen
  // (the public consumer app carries no login UI at all).
  const [adminGate] = useState(() => new URLSearchParams(window.location.search).has('admin'));

  useEffect(() => {
    init();
  }, [init]);

  // Preload real 3D appliance models; flip the store flag so the 3D scene and
  // 2D sprites re-render with them once they arrive.
  useEffect(() => {
    const off = onModelsLoaded(() => useStore.setState((s) => ({ modelsReady: s.modelsReady + 1 })));
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

  const banner = verifyMsg && (
    <div className="verify-banner" onClick={() => setVerifyMsg(null)}>
      {verifyMsg} <span className="verify-banner-x">✕</span>
    </div>
  );

  if (adminGate && status !== 'authed') return <Login />;
  if (status === 'anon')
    return (
      <>
        {banner}
        <StartScreen />
        <AuthModal />
      </>
    );

  return (
    <div className="app">
      {banner}
      <SvgDefs />
      <Toolbar />
      {screen === 'admin' && <AdminPanel />}
      {screen === 'jobs' && <JobsScreen />}
      {screen === 'profile' && <ProfileScreen />}
      {screen === 'catalog' && <CatalogPrefsScreen />}
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
      <OpeningModal />
      <PricingModal />
      <RetailPricingModal />
      <SettingsModal />
      <AppliancesModal />
      <MyAppliancesModal />
      <HandlesModal />
      <ApplianceAlignerModal />
      <AuthModal />
      <SaveJobModal />
    </div>
  );
}
