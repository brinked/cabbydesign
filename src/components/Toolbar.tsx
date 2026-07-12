import { useEffect, useRef, useState } from 'react';
import { DOOR_STYLE_LABELS, doorStylesFor, finishesForLine } from '../model/catalog';
import { companyFinishes, mergedHandles } from '../model/companyCatalog';
import { LINE_LABELS } from '../model/newage';
import { COUNTERTOPS, COUNTER_CATEGORY_LABELS, type CounterCategory } from '../model/countertops';
import type { Design, KitchenType, ProductLine } from '../model/types';
import { useStore, type Tab } from '../state/store';
import { useSession, type Screen } from '../state/session';

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
            <SettingsMenu design={design} setDesignMeta={setDesignMeta} isAdmin={isAdmin} />
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
function SettingsMenu({
  design,
  setDesignMeta,
  isAdmin,
}: {
  design: Design;
  setDesignMeta: (patch: Partial<Design>) => void;
  isAdmin: boolean;
}) {
  const setPricingOpen = useStore((s) => s.setPricingOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setAppliancesOpen = useStore((s) => s.setAppliancesOpen);
  const setMyAppliancesOpen = useStore((s) => s.setMyAppliancesOpen);
  const setHandlesOpen = useStore((s) => s.setHandlesOpen);
  const setLine = useStore((s) => s.setLine);
  const handles = useStore((s) => s.handles);
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

  const openModal = (fn: (v: boolean) => void) => {
    fn(true);
    setOpen(false);
  };

  const line = design.line ?? 'ext';
  const isNewAge = line !== 'ext';
  // Cabinet-company accounts can hide finishes/handles and add their own.
  const catalogPrefs = useSession((s) => s.catalogPrefs);
  const hiddenFinishes = new Set(catalogPrefs?.hiddenFinishes ?? []);
  const lineFinishes = [
    ...finishesForLine(line, design.kitchenType).filter((f) => !hiddenFinishes.has(f.id)),
    ...(isNewAge ? [] : companyFinishes(catalogPrefs)),
  ];
  const handleOptions = mergedHandles(handles, catalogPrefs);
  // NewAge finishes group by series; indoor finishes by Painted / Wood Stains.
  const finishGroups = [...new Set(lineFinishes.map((f) => f.group ?? ''))];

  return (
    <div className="settings-dd" ref={ref}>
      <button className={open ? 'btn-ghost active' : 'btn-ghost'} onClick={() => setOpen((o) => !o)} title="Design & settings">
        ⚙ Settings ▾
      </button>
      {open && (
        <div className="settings-menu">
          <div className="settings-menu-label">Project</div>
          <label className="settings-menu-row">
            <span>Name</span>
            <input className="settings-text" value={design.name} placeholder="Project name" onChange={(e) => setDesignMeta({ name: e.target.value })} />
          </label>
          <label className="settings-menu-row">
            <span>Client</span>
            <input className="settings-text" value={design.client} placeholder="Optional" onChange={(e) => setDesignMeta({ client: e.target.value })} />
          </label>
          <div className="settings-menu-sep" />
          <div className="settings-menu-label">Design</div>
          <label className="settings-menu-row">
            <span>Cabinet line</span>
            <select
              className="select"
              value={line}
              onChange={(e) => {
                const next = e.target.value as ProductLine;
                if (next === line) return;
                const dropped = design.items.filter((it) => !it.auto).length;
                if (
                  dropped === 0 ||
                  confirm(
                    `Switch to ${LINE_LABELS[next]}? The ${dropped} placed cabinet(s) belong to the current line and will be removed — walls, windows and stub-outs stay.`
                  )
                ) {
                  setLine(next);
                }
              }}
            >
              {(['ext', 'newage'] as ProductLine[]).map((l) => (
                <option key={l} value={l}>
                  {LINE_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
          {!isNewAge && (
            <label className="settings-menu-row">
              <span>Door style</span>
              <select className="select" value={design.doorStyle} onChange={(e) => setDesignMeta({ doorStyle: e.target.value as Design['doorStyle'] })}>
                {doorStylesFor(design.kitchenType).map((s) => (
                  <option key={s} value={s}>
                    {DOOR_STYLE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isNewAge && (
            <label className="settings-menu-row">
              <span>Handle</span>
              <select className="select" value={design.handleId ?? ''} onChange={(e) => setDesignMeta({ handleId: e.target.value || undefined })}>
                <option value="">Not selected</option>
                {handleOptions
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name || 'Unnamed handle'}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="settings-menu-row" title={isNewAge ? 'Default series & door finish for new cabinets — each cabinet can override this in its own settings' : undefined}>
            <span>{isNewAge ? 'Default finish' : 'Finish'}</span>
            <select className="select" value={design.finishId} onChange={(e) => setDesignMeta({ finishId: e.target.value })}>
              {finishGroups.map((g) =>
                g ? (
                  <optgroup key={g} label={g}>
                    {lineFinishes
                      .filter((f) => (f.group ?? '') === g)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </optgroup>
                ) : (
                  lineFinishes
                    .filter((f) => !f.group)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))
                )
              )}
            </select>
          </label>
          <label className="settings-menu-row">
            <span>Countertop</span>
            <select className="select" value={design.counterId} onChange={(e) => setDesignMeta({ counterId: e.target.value })}>
              {(['solid', 'granite', 'quartzite', 'concrete', 'metal'] as CounterCategory[]).map((cat) => (
                <optgroup key={cat} label={COUNTER_CATEGORY_LABELS[cat]}>
                  {COUNTERTOPS.filter((c) => c.category === cat).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="settings-menu-row">
            <span>Gas type</span>
            <select className="select" value={design.gasType ?? ''} onChange={(e) => setDesignMeta({ gasType: (e.target.value || undefined) as Design['gasType'] })}>
              <option value="">Not set</option>
              <option value="ng">Natural Gas</option>
              <option value="lp">Liquid Propane</option>
            </select>
          </label>
          <label className="settings-menu-row">
            <span>Countertop</span>
            <CounterThicknessInput value={design.counterThickness} onChange={(v) => setDesignMeta({ counterThickness: v })} />
          </label>
          <label className="settings-menu-row">
            <span>Backsplash</span>
            <BacksplashControl value={design.backsplashHeight ?? 0} onChange={(v) => setDesignMeta({ backsplashHeight: v })} />
          </label>

          {!isAdmin && (
            <>
              <div className="settings-menu-sep" />
              <div className="settings-menu-label">Inventory</div>
              <button className="settings-menu-item" onClick={() => openModal(setMyAppliancesOpen)}>
                My appliances &amp; brands…
              </button>
            </>
          )}

          {isAdmin && (
            <>
              <div className="settings-menu-sep" />
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
  );
}

/** Countertop thickness (inches). Commits a positive number on blur/Enter. */
function CounterThicknessInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = parseFloat(text);
    if (Number.isFinite(v) && v > 0) {
      const clamped = Math.min(5, Math.round(v * 100) / 100);
      setText(String(clamped));
      onChange(clamped);
    } else setText(String(value));
  };
  // apply live as typed (no Enter needed) once it's a valid positive number
  const live = (t: string) => {
    const v = parseFloat(t);
    if (Number.isFinite(v) && v > 0) onChange(Math.min(5, Math.round(v * 100) / 100));
  };
  return (
    <span className="counter-thick" title="Countertop thickness in inches (default 1.25″ = 3cm, max 5″)">
      <span>Counter</span>
      <input
        className="counter-input"
        inputMode="decimal"
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setText(e.target.value);
          live(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span>″</span>
    </span>
  );
}

/** Stone backsplash toggle + height (inches). Height 0 = no backsplash; the
 *  checkbox enables it (defaulting to 4″) and the field sets the stone height. */
const DEFAULT_BACKSPLASH_H = 4;
function BacksplashControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const on = value > 0;
  const [text, setText] = useState(String(value || DEFAULT_BACKSPLASH_H));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing && value > 0) setText(String(value));
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = parseFloat(text);
    if (Number.isFinite(v) && v > 0) onChange(Math.round(v * 100) / 100);
    else setText(String(value || DEFAULT_BACKSPLASH_H));
  };
  // apply live as typed (no Enter needed) once it's a valid positive number
  const live = (t: string) => {
    const v = parseFloat(t);
    if (Number.isFinite(v) && v > 0) onChange(Math.round(v * 100) / 100);
  };
  return (
    <span className="counter-thick" title="Stone backsplash height up the wall (inches). Uses the countertop stone.">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked ? parseFloat(text) || DEFAULT_BACKSPLASH_H : 0)}
        title={on ? 'Backsplash on' : 'Backsplash off'}
      />
      <input
        className="counter-input"
        inputMode="decimal"
        value={text}
        disabled={!on}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setText(e.target.value);
          live(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span>″</span>
    </span>
  );
}
