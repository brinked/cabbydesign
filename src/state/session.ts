// Auth/session state for the SPA. Separate from the designer store (useStore)
// so login/admin concerns don't tangle with cabinet geometry. On login it pulls
// the admin-controlled global cabinet dims + base pricing formulas into the
// designer store so every dealer designs against the same catalog rules.
import { create } from 'zustand';
import { api, ApiError, type ApiUser, type CertInfo, type DealerPrefs } from '../api/client';
import { NEWAGE_DEFAULT_APPLIANCES } from '../model/newage';
import { useStore } from './store';

export type Screen = 'design' | 'admin' | 'jobs' | 'profile';

interface SessionState {
  /** 'guest' = designing without an account (consumer mode, local-only saves). */
  status: 'loading' | 'authed' | 'guest' | 'anon';
  user: ApiUser | null;
  prefs: DealerPrefs | null;
  cert: CertInfo | null;
  /** Global sales-tax rate (percent), admin-controlled. */
  taxRate: number;
  screen: Screen;
  /** id of the saved job currently loaded in the designer (for Save vs Save As). */
  currentJobId: number | null;
  currentJobName: string | null;
  /** Save-job dialog visibility. */
  saveJobOpen: boolean;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Enter consumer/guest mode — design without an account. */
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  setScreen: (screen: Screen) => void;
  setPrefs: (prefs: DealerPrefs) => Promise<void>;
  setLogo: (logo: string) => Promise<void>;
  setCert: (cert: string, name: string) => Promise<void>;
  setCurrentJob: (id: number | null, name: string | null) => void;
  openSaveJob: (open: boolean) => void;
  /** Re-pull admin globals (dims + pricing + tax) into the designer/session. */
  refreshGlobals: () => Promise<void>;
}

async function pullGlobals(set: (partial: Partial<SessionState>) => void) {
  const [{ dims }, { pricing }, { retailPricing }, { rate }, { appliances }, { brands }, { handles }] = await Promise.all([
    api.getCabinetDims(),
    api.getPricing(),
    api.getRetailPricing(),
    api.getTaxRate(),
    api.getAppliances(),
    api.getApplianceBrands(),
    api.getHandles(),
  ]);
  // Push server-managed globals into the designer store. These override the
  // per-browser values that store.ts persists in localStorage.
  useStore.setState({ dims, pricing, retailPricing, appliances, applianceBrands: brands, handles });
  set({ taxRate: rate });
}

/** localStorage flag remembering that this browser chose guest mode. */
const GUEST_KEY = 'cabdesign-guest';

export const useSession = create<SessionState>()((set, get) => ({
  status: 'loading',
  user: null,
  prefs: null,
  cert: null,
  taxRate: 6.5,
  screen: 'design',
  currentJobId: null,
  currentJobName: null,
  saveJobOpen: false,

  init: async () => {
    try {
      const { user, prefs, cert } = await api.me();
      if (user) {
        await pullGlobals(set);
        set({ status: 'authed', user, prefs: prefs ?? null, cert: cert ?? null });
        return;
      }
    } catch {
      /* fall through to guest/anon below */
    }
    // A returning guest goes straight back into the designer.
    if (localStorage.getItem(GUEST_KEY)) {
      await get().continueAsGuest();
      return;
    }
    set({ status: 'anon', user: null, prefs: null, cert: null });
  },

  login: async (email, password) => {
    const { user, prefs, cert } = await api.login(email, password);
    await pullGlobals(set);
    set({ status: 'authed', user, prefs, cert, screen: 'design' });
  },

  continueAsGuest: async () => {
    // Globals (catalog rules, tax, appliances) are public reads — pull them if
    // the API is reachable, but guests can design fully offline too.
    try {
      await pullGlobals(set);
    } catch {
      /* offline / no server — the built-in catalog still works */
    }
    // No admin appliance inventory? Seed the NewAge insert grills so the grill
    // cabinets have real options to choose from.
    if (useStore.getState().appliances.length === 0) {
      useStore.setState({ appliances: NEWAGE_DEFAULT_APPLIANCES });
    }
    localStorage.setItem(GUEST_KEY, '1');
    set({ status: 'guest', user: null, prefs: null, cert: null, screen: 'design' });
  },

  logout: async () => {
    localStorage.removeItem(GUEST_KEY);
    try {
      await api.logout();
    } catch {
      /* ignore network errors on logout */
    }
    set({ status: 'anon', user: null, prefs: null, cert: null, screen: 'design', currentJobId: null, currentJobName: null });
  },

  setScreen: (screen) => set({ screen }),

  setPrefs: async (prefs) => {
    const { prefs: saved } = await api.setPrefs(prefs);
    set({ prefs: saved });
  },

  setLogo: async (logo) => {
    const { logo: saved } = await api.setLogo(logo);
    const user = get().user;
    if (user) set({ user: { ...user, logo: saved } });
  },

  setCert: async (cert, name) => {
    const { cert: saved } = await api.setCert(cert, name);
    set({ cert: saved });
  },

  setCurrentJob: (id, name) => set({ currentJobId: id, currentJobName: name }),

  openSaveJob: (open) => set({ saveJobOpen: open }),

  refreshGlobals: async () => {
    if (get().status === 'authed' || get().status === 'guest') {
      try {
        await pullGlobals(set);
      } catch {
        /* tolerate missing server in guest mode */
      }
    }
  },
}));

export { ApiError };
