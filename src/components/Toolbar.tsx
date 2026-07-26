import { useEffect, useRef, useState } from 'react';
import type { Design, KitchenType, ProductLine } from '../model/types';
import { useStore, type Tab } from '../state/store';
import { useSession, type Screen } from '../state/session';
import DesignPanel from './DesignPanel';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'design', label: 'Walls' },
  { id: 'plan', label: 'Top View' },
  { id: '3d', label: '3D' },
  { id: 'report', label: 'Report' },
];

export default function Toolbar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const design = useStore((s) => s.design);
  const setDesignMeta = useStore((s) => s.setDesignMeta);
  const newDesign = useStore((s) => s.newDesign);
  const setQuoteOpen = useStore((s) => s.setQuoteOpen);

  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const screen = useSession((s) => s.screen);
  const setScreen = useSession((s) => s.setScreen);
  const logout = useSession((s) => s.logout);
  const openSaveJob = useSession((s) => s.openSaveJob);
  const setCurrentJob = useSession((s) => s.setCurrentJob);
  const currentJobName = useSession((s) => s.currentJobName);
  const openAuth = useSession((s) => s.openAuth);
  const isAdmin = user?.role === 'admin';
  const isGuest = status === 'guest';
  const isCompany = user?.role === 'company';
  const [newOpen, setNewOpen] = useState(false);

  const isConsumerAccount = isCompany || user?.role === 'homeowner';
  const navItems: Array<{ id: Screen; label: string; show: boolean }> = [
    { id: 'design', label: 'Designer', show: true },
    { id: 'jobs', label: 'My Jobs', show: !isGuest },
    { id: 'catalog', label: 'My Catalog', show: isCompany },
    { id: 'profile', label: 'Profile', show: !isGuest && !isConsumerAccount },
    { id: 'account', label: 'Account', show: isConsumerAccount },
    { id: 'admin', label: 'Admin', show: !!isAdmin },
  ];

  return (
    <header className="toolbar no-print">
      <div className="brand" onClick={() => setScreen('design')} style={{ cursor: 'pointer' }}>
        Cab<span>Design</span>
      </div>

      <nav className="tabs screen-nav">
        {navItems
          .filter((n) => n.show)
          .map((n) => (
            <button key={n.id} className={screen === n.id ? 'tab active' : 'tab'} onClick={() => setScreen(n.id)}>
              {n.label}
            </button>
          ))}
      </nav>

      {screen === 'design' && (
        <>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="toolbar-right">
            <SettingsMenu isAdmin={isAdmin} />
            <FileMenu
              onSave={() => (isGuest ? openAuth('Create a free account to save your designs — reopen them anytime, on any device.') : openSaveJob(true))}
              onOpen={() => (isGuest ? openAuth('Sign in to open your saved designs.') : setScreen('jobs'))}
              onNew={() => setNewOpen(true)}
            />
            {isGuest && (
              <button
                className="btn-quote"
                title="Send your design to EXT Cabinets for a free quote"
                onClick={() => {
                  setTab('report');
                  setQuoteOpen(true);
                }}
              >
                Get a free quote
              </button>
            )}
          </div>
        </>
      )}

      <div className="toolbar-user">
        {screen === 'design' && currentJobName && <span className="job-chip">Job: {currentJobName}</span>}
        {isGuest ? (
          <button className="btn-ghost" onClick={() => openAuth('Sign in or create a free account to save designs and download plans.')}>
            Sign in
          </button>
        ) : (
          <>
            <span className="user-name">{user?.companyName || user?.name}</span>
            <button className="btn-ghost" onClick={() => logout()}>
              Log out
            </button>
          </>
        )}
      </div>

      {newOpen && (
        <NewDesignModal
          onClose={() => setNewOpen(false)}
          onCreate={(kitchenType, line) => {
            newDesign(kitchenType, line);
            setCurrentJob(null, null);
            setNewOpen(false);
          }}
        />
      )}
    </header>
  );
}

/** File dropdown: save / open / new — keeps the toolbar to a single row. */
function FileMenu({ onSave, onOpen, onNew }: { onSave: () => void; onOpen: () => void; onNew: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="settings-dd" ref={ref}>
      <button className={open ? 'btn-primary active' : 'btn-primary'} onClick={() => setOpen((o) => !o)} title="Save, open or start a design">
        File ▾
      </button>
      {open && (
        <div className="settings-menu file-menu">
          <button className="settings-menu-item" onClick={() => run(onSave)}>
            💾 Save job
          </button>
          <button className="settings-menu-item" onClick={() => run(onOpen)}>
            📂 Open job…
          </button>
          <div className="settings-menu-sep" />
          <button className="settings-menu-item" onClick={() => run(onNew)}>
            ✨ New design…
          </button>
        </div>
      )}
    </div>
  );
}

/** New-design chooser: the same three kitchen options as the start screen. */
function NewDesignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (k: KitchenType, l: ProductLine) => void }) {
  const options: Array<{ k: KitchenType; l: ProductLine; label: string; sub: string }> = [
    { k: 'indoor', l: 'ext', label: 'Indoor Kitchen Cabinets', sub: 'Made-to-size cabinets — any width, 12 colors, shaker or flat doors.' },
    { k: 'outdoor', l: 'ext', label: 'Outdoor Kitchen Cabinets', sub: 'Weatherproof HDPE cabinets made to size around your grill and appliances.' },
    { k: 'outdoor', l: 'newage', label: 'NewAge Outdoor Kitchen Cabinets', sub: 'Modular 304 stainless or aluminum units at factory sizes.' },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>New design</h2>
            <p className="modal-sub">Pick a kitchen to start fresh. Save the current design first if you want to keep it.</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="line-cards">
          {options.map((o) => (
            <button key={`${o.k}-${o.l}`} className="cat-card" onClick={() => onCreate(o.k, o.l)}>
              <span className="cat-name">{o.label}</span>
              <span className="cat-note">{o.sub}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Gear dropdown gathering the per-job design options + admin config links. */
/** The toolbar's design + settings controls. The look-and-feel choices live in
 *  the visual DesignPanel; this keeps only the occasional shortcuts (a
 *  homeowner's appliance list, or the admin catalogue screens) behind a gear. */
function SettingsMenu({ isAdmin }: { isAdmin: boolean }) {
  const setPricingOpen = useStore((s) => s.setPricingOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setAppliancesOpen = useStore((s) => s.setAppliancesOpen);
  const setMyAppliancesOpen = useStore((s) => s.setMyAppliancesOpen);
  const setHandlesOpen = useStore((s) => s.setHandlesOpen);
  const [open, setOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openModal = (fn: (v: boolean) => void) => {
    fn(true);
    setOpen(false);
  };

  return (
    <>
      <button className="btn-soft" onClick={() => setPanelOpen(true)} title="Colours, doors, worktops, flooring">
        ✨ Design
      </button>
      <div className="settings-dd" ref={ref}>
        <button className={open ? 'btn-ghost active' : 'btn-ghost'} onClick={() => setOpen((o) => !o)} title="More settings">
          ⚙
        </button>
        {open && (
          <div className="settings-menu">
            {!isAdmin && (
              <>
                <div className="settings-menu-label">Inventory</div>
                <button className="settings-menu-item" onClick={() => openModal(setMyAppliancesOpen)}>
                  My appliances &amp; brands…
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <div className="settings-menu-label">Admin</div>
                <button className="settings-menu-item" onClick={() => openModal(setPricingOpen)}>
                  Base pricing…
                </button>
                <button className="settings-menu-item" onClick={() => openModal(setSettingsOpen)}>
                  Cabinet size limits…
                </button>
                <button className="settings-menu-item" onClick={() => openModal(setAppliancesOpen)}>
                  Appliances…
                </button>
                <button className="settings-menu-item" onClick={() => openModal(setHandlesOpen)}>
                  Cabinet handles…
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {panelOpen && <DesignPanel onClose={() => setPanelOpen(false)} />}
    </>
  );
}
