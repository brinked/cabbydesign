// Auth/session state for the SPA. Separate from the designer store (useStore)
// so login/admin concerns don't tangle with cabinet geometry. On login it pulls
// the admin-controlled global cabinet dims + base pricing formulas into the
// designer store so every dealer designs against the same catalog rules.
import { create } from 'zustand';
import { api, ApiError, type ApiUser, type CertInfo, type DealerPrefs } from '../api/client';
import { useStore } from './store';

export type Screen = 'design' | 'admin' | 'jobs' | 'profile';

interface SessionState {
  status: 'loading' | 'authed' | 'anon';
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
      } else {
        set({ status: 'anon', user: null, prefs: null, cert: null });
      }
    } catch {
      set({ status: 'anon', user: null, prefs: null, cert: null });
    }
  },

  login: async (email, password) => {
    const { user, prefs, cert } = await api.login(email, password);
    await pullGlobals(set);
    set({ status: 'authed', user, prefs, cert, screen: 'design' });
  },

  logout: async () => {
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
    if (get().status === 'authed') await pullGlobals(set);
  },
}));

export { ApiError };
