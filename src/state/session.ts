// Auth/session state for the SPA. Separate from the designer store (useStore)
// so login/admin concerns don't tangle with cabinet geometry. On login it pulls
// the admin-controlled global cabinet dims + base pricing formulas into the
// designer store so every dealer designs against the same catalog rules.
import { create } from 'zustand';
import { api, ApiError, type AccountType, type ApiUser, type CatalogPrefs, type CertInfo, type DealerPrefs } from '../api/client';
import { deleteLocalJob, listLocalJobs } from './localJobs';
import { NEWAGE_DEFAULT_APPLIANCES } from '../model/newage';
import { DEFAULT_GRILL_APPLIANCES } from '../model/defaultAppliances';
import { useStore } from './store';

export type Screen = 'design' | 'admin' | 'jobs' | 'profile' | 'catalog' | 'account';

interface SessionState {
  /** 'guest' = designing without an account (consumer mode, local-only saves). */
  status: 'loading' | 'authed' | 'guest' | 'anon';
  user: ApiUser | null;
  prefs: DealerPrefs | null;
  cert: CertInfo | null;
  /** Cabinet-company catalog customization (null for other roles). */
  catalogPrefs: CatalogPrefs | null;
  /** Global sales-tax rate (percent), admin-controlled. */
  taxRate: number;
  screen: Screen;
  /** id of the saved job currently loaded in the designer (for Save vs Save As). */
  currentJobId: number | null;
  currentJobName: string | null;
  /** Save-job dialog visibility. */
  saveJobOpen: boolean;
  /** Sign-in / create-account dialog: null = closed, else the reason shown. */
  authPrompt: string | null;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Create a consumer account (homeowner / cabinet company). Returns true
   *  when a verification email was sent (vs signed straight in). */
  signup: (input: { name: string; email: string; password: string; accountType: AccountType; companyName?: string }) => Promise<boolean>;
  /** Complete email verification from the ?verify=<token> deep link. */
  verifyEmail: (token: string) => Promise<void>;
  openAuth: (reason: string | null) => void;
  closeAuth: () => void;
  /** Update account details (name/company/phone/address). */
  updateAccount: (input: { name: string; companyName?: string; phone?: string; address?: string }) => Promise<void>;
  /** Change the sign-in email (password confirmed). Returns true when the new
   *  address must be verified via the emailed link. */
  changeEmail: (password: string, newEmail: string) => Promise<boolean>;
  setCatalogPrefs: (catalogPrefs: CatalogPrefs) => Promise<void>;
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
  const [{ dims }, { pricing }, { retailPricing }, { rate }, { appliances }, { brands }, { handles }, { clearance }, { modelAligns }, { rates }] = await Promise.all([
    api.getCabinetDims(),
    api.getPricing(),
    api.getRetailPricing(),
    api.getTaxRate(),
    api.getAppliances(),
    api.getApplianceBrands(),
    api.getHandles(),
    api.getLinerClearance(),
    api.getModelAligns(),
    api.getPanelRates(),
  ]);
  // Push server-managed globals into the designer store. These override the
  // per-browser values that store.ts persists in localStorage.
  useStore.setState({ dims, pricing, retailPricing, appliances, applianceBrands: brands, handles, linerClearance: clearance, modelAligns, panelRates: rates });
  set({ taxRate: rate });
}

/** localStorage flag remembering that this browser chose guest mode. */
const GUEST_KEY = 'cabdesign-guest';

/** Consumer roles created via public signup. */
const isConsumerRole = (role?: string) => role === 'homeowner' || role === 'company';

/** Move any browser-local guest jobs into the freshly signed-in account so
 *  nothing designed before signup is lost. Best-effort; failures keep the
 *  local copy. */
async function migrateLocalJobs(): Promise<void> {
  for (const j of listLocalJobs()) {
    try {
      await api.createJob({ name: j.name, customerName: '', customerEmail: '', customerAddress: '', design: j.design });
      deleteLocalJob(j.id);
    } catch {
      /* keep the local copy */
    }
  }
}

export const useSession = create<SessionState>()((set, get) => ({
  status: 'loading',
  user: null,
  prefs: null,
  cert: null,
  catalogPrefs: null,
  authPrompt: null,
  taxRate: 6.5,
  screen: 'design',
  currentJobId: null,
  currentJobName: null,
  saveJobOpen: false,

  init: async () => {
    try {
      const { user, prefs, cert, catalogPrefs } = await api.me();
      if (user) {
        await pullGlobals(set);
        set({ status: 'authed', user, prefs: prefs ?? null, cert: cert ?? null, catalogPrefs: catalogPrefs ?? null });
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
    const { user, prefs, cert, catalogPrefs } = await api.login(email, password);
    await pullGlobals(set);
    set({ status: 'authed', user, prefs, cert, catalogPrefs: catalogPrefs ?? null, authPrompt: null });
    if (isConsumerRole(user.role)) void migrateLocalJobs();
  },

  signup: async (input) => {
    const r = await api.signup(input);
    if (r.needsVerify || !r.user) return true;
    // No-SMTP (local dev) path: the account is pre-verified and signed in.
    await pullGlobals(set);
    set({ status: 'authed', user: r.user, prefs: r.prefs ?? null, cert: r.cert ?? null, catalogPrefs: r.catalogPrefs ?? null, authPrompt: null });
    void migrateLocalJobs();
    return false;
  },

  verifyEmail: async (token) => {
    const { user, prefs, cert, catalogPrefs } = await api.verifyEmail(token);
    await pullGlobals(set);
    set({ status: 'authed', user, prefs, cert, catalogPrefs: catalogPrefs ?? null, authPrompt: null });
    if (isConsumerRole(user.role)) void migrateLocalJobs();
  },

  openAuth: (reason) => set({ authPrompt: reason ?? 'Sign in or create a free account to continue.' }),
  closeAuth: () => set({ authPrompt: null }),

  updateAccount: async (input) => {
    const { user } = await api.updateAccount(input);
    set({ user });
  },

  changeEmail: async (password, newEmail) => {
    const { needsVerify, user } = await api.changeEmail(password, newEmail);
    set({ user });
    return needsVerify;
  },

  setCatalogPrefs: async (catalogPrefs) => {
    const { catalogPrefs: saved } = await api.setCatalogPrefs(catalogPrefs);
    set({ catalogPrefs: saved });
  },

  continueAsGuest: async () => {
    // Globals (catalog rules, tax, appliances) are public reads — pull them if
    // the API is reachable, but guests can design fully offline too.
    try {
      await pullGlobals(set);
    } catch {
      /* offline / no server — the built-in catalog still works */
    }
    // No admin appliance inventory? Seed the built-in brand grills/griddles
    // (with real 3D models) + the NewAge insert grills so every grill cabinet
    // has real options to choose from.
    if (useStore.getState().appliances.length === 0) {
      useStore.setState({ appliances: [...DEFAULT_GRILL_APPLIANCES, ...NEWAGE_DEFAULT_APPLIANCES] });
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
    set({ status: 'anon', user: null, prefs: null, cert: null, catalogPrefs: null, screen: 'design', currentJobId: null, currentJobName: null });
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
