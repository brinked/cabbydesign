import { useEffect, useRef, useState } from 'react';
import { FINISHES } from '../model/catalog';
import { COUNTERTOPS, COUNTER_CATEGORY_LABELS, type CounterCategory } from '../model/countertops';
import type { Design } from '../model/types';
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
  const loadDesign = useStore((s) => s.loadDesign);
  const fileRef = useRef<HTMLInputElement>(null);

  const user = useSession((s) => s.user);
  const screen = useSession((s) => s.screen);
  const setScreen = useSession((s) => s.setScreen);
  const logout = useSession((s) => s.logout);
  const openSaveJob = useSession((s) => s.openSaveJob);
  const setCurrentJob = useSession((s) => s.setCurrentJob);
  const currentJobName = useSession((s) => s.currentJobName);
  const isAdmin = user?.role === 'admin';

  function exportDesign() {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(design.name || 'design').replace(/[^\w-]+/g, '_')}.cabdesign.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importDesign(file: File) {
    file.text().then((text) => {
      try {
        const d = JSON.parse(text) as Design;
        if (!d || !Array.isArray(d.walls) || !Array.isArray(d.items)) throw new Error('bad file');
        loadDesign(d);
        setCurrentJob(null, null);
      } catch {
        alert('That file does not look like a saved design.');
      }
    });
  }

  const navItems: Array<{ id: Screen; label: string; show: boolean }> = [
    { id: 'design', label: 'Designer', show: true },
    { id: 'jobs', label: 'My Jobs', show: true },
    { id: 'profile', label: 'Profile', show: true },
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
          <input
            className="project-name"
            value={design.name}
            placeholder="Project name"
            onChange={(e) => setDesignMeta({ name: e.target.value })}
          />
          <input
            className="project-client"
            value={design.client}
            placeholder="Client (optional)"
            onChange={(e) => setDesignMeta({ client: e.target.value })}
          />

          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="toolbar-right">
            <SettingsMenu design={design} setDesignMeta={setDesignMeta} isAdmin={isAdmin} />
            <button className="btn-primary" onClick={() => openSaveJob(true)} title="Save this design to your account">
              Save job
            </button>
            <button className="btn-ghost" onClick={() => setScreen('jobs')} title="Open a saved job">
              Open
            </button>
            <button className="btn-ghost" onClick={exportDesign} title="Download design file">
              Export
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} title="Import design file">
              Import
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                if (confirm('Start a new design? The current design stays in your browser until replaced.')) {
                  newDesign();
                  setCurrentJob(null, null);
                }
              }}
            >
              New
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importDesign(f);
                e.target.value = '';
              }}
            />
          </div>
        </>
      )}

      <div className="toolbar-user">
        {screen === 'design' && currentJobName && <span className="job-chip">Job: {currentJobName}</span>}
        <span className="user-name">{user?.name}</span>
        <button className="btn-ghost" onClick={() => logout()}>
          Log out
        </button>
      </div>
    </header>
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

  return (
    <div className="settings-dd" ref={ref}>
      <button className={open ? 'btn-ghost active' : 'btn-ghost'} onClick={() => setOpen((o) => !o)} title="Design & settings">
        ⚙ Settings ▾
      </button>
      {open && (
        <div className="settings-menu">
          <div className="settings-menu-label">Design</div>
          <label className="settings-menu-row">
            <span>Door style</span>
            <select className="select" value={design.doorStyle} onChange={(e) => setDesignMeta({ doorStyle: e.target.value as Design['doorStyle'] })}>
              <option value="shaker">Shaker (groove)</option>
              <option value="flat">Euro / flat</option>
            </select>
          </label>
          <label className="settings-menu-row">
            <span>Finish</span>
            <select className="select" value={design.finishId} onChange={(e) => setDesignMeta({ finishId: e.target.value })}>
              {FINISHES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-menu-row">
            <span>Countertop</span>
            <select className="select" value={design.counterId} onChange={(e) => setDesignMeta({ counterId: e.target.value })}>
              {(['solid', 'granite', 'quartzite', 'concrete'] as CounterCategory[]).map((cat) => (
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
            <span>Measure from</span>
            <select className="select" value={design.dimFrom ?? 'left'} onChange={(e) => setDesignMeta({ dimFrom: e.target.value as Design['dimFrom'] })}>
              <option value="left">Left end</option>
              <option value="right">Right end</option>
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
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = parseFloat(text);
    if (Number.isFinite(v) && v > 0) onChange(Math.round(v * 100) / 100);
    else setText(String(value));
  };
  return (
    <span className="counter-thick" title="Countertop thickness in inches (default 1.25″ = 3cm)">
      <span>Counter</span>
      <input
        className="counter-input"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
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
  useEffect(() => {
    if (value > 0) setText(String(value));
  }, [value]);
  const commit = () => {
    const v = parseFloat(text);
    if (Number.isFinite(v) && v > 0) onChange(Math.round(v * 100) / 100);
    else setText(String(value || DEFAULT_BACKSPLASH_H));
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
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span>″</span>
    </span>
  );
}
