import { useEffect, useRef, useState } from 'react';
import { FINISHES } from '../model/catalog';
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
  const setPricingOpen = useStore((s) => s.setPricingOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setAppliancesOpen = useStore((s) => s.setAppliancesOpen);
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
            <select
              className="select"
              value={design.doorStyle}
              onChange={(e) => setDesignMeta({ doorStyle: e.target.value as Design['doorStyle'] })}
              title="Door style"
            >
              <option value="shaker">Shaker (groove)</option>
              <option value="flat">Euro / flat</option>
            </select>
            <select
              className="select"
              value={design.finishId}
              onChange={(e) => setDesignMeta({ finishId: e.target.value })}
              title="Cabinet finish"
            >
              {FINISHES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={design.gasType ?? ''}
              onChange={(e) => setDesignMeta({ gasType: (e.target.value || undefined) as Design['gasType'] })}
              title="Fuel type for the gas appliances"
            >
              <option value="">Gas: not set</option>
              <option value="ng">Natural Gas</option>
              <option value="lp">Liquid Propane</option>
            </select>
            <CounterThicknessInput value={design.counterThickness} onChange={(v) => setDesignMeta({ counterThickness: v })} />
            {isAdmin && (
              <>
                <button className="btn-ghost" onClick={() => setPricingOpen(true)}>
                  Pricing
                </button>
                <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>
                  Settings
                </button>
                <button className="btn-ghost" onClick={() => setAppliancesOpen(true)}>
                  Appliances
                </button>
              </>
            )}
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
