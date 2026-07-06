import { useMemo, useState } from 'react';
import type { KitchenType, ProductLine } from '../model/types';
import { listLocalJobs } from '../state/localJobs';
import { useSession } from '../state/session';
import { useStore } from '../state/store';

interface StartOption {
  key: string;
  kitchenType: KitchenType;
  line: ProductLine;
  title: string;
  sub: string;
  icon: JSX.Element;
}

const OPTIONS: StartOption[] = [
  {
    key: 'indoor',
    kitchenType: 'indoor',
    line: 'ext',
    title: 'Indoor Kitchen Cabinets',
    sub: 'Made-to-size cabinets for your indoor kitchen — any width, 12 colors, shaker or flat doors.',
    icon: (
      // house with cabinet
      <svg viewBox="0 0 48 48" aria-hidden>
        <path d="M6 22 24 8l18 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 21v19h26V21" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="17" y="27" width="14" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M24 27v13" stroke="currentColor" strokeWidth="2.5" />
        <path d="M21 33h.01M27 33h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'outdoor',
    kitchenType: 'outdoor',
    line: 'ext',
    title: 'Outdoor Kitchen Cabinets',
    sub: 'Weatherproof HDPE cabinets made to size around your grill, sink, smoker and more.',
    icon: (
      // sun over grill island
      <svg viewBox="0 0 48 48" aria-hidden>
        <circle cx="36" cy="11" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M36 3v2M36 17v2M44 11h-2M30 11h-2M41.7 5.3l-1.4 1.4M31.7 15.3l-1.4 1.4M41.7 16.7l-1.4-1.4M31.7 6.7l-1.4-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="5" y="24" width="30" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M5 30h30" stroke="currentColor" strokeWidth="2.5" />
        <path d="M11 34h6M23 34h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 24v-4c0-1 .8-2 2-2h12c1.2 0 2 1 2 2v4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'newage',
    kitchenType: 'outdoor',
    line: 'newage',
    title: 'NewAge Outdoor Kitchen Cabinets',
    sub: 'NewAge Products modular outdoor kitchens — 304 stainless or aluminum units at factory sizes.',
    icon: (
      // modular cabinet run
      <svg viewBox="0 0 48 48" aria-hidden>
        <path d="M4 16h40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="6" y="20" width="11" height="20" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="19" y="20" width="11" height="20" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="32" y="20" width="10" height="20" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M19 27h11M19 34h11" stroke="currentColor" strokeWidth="2.5" />
        <path d="M14 28v4M35 28v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Consumer start / splash screen: pick a kitchen style and start designing.
 *  No accounts — designs and saved jobs live in this browser. */
export default function StartScreen() {
  const continueAsGuest = useSession((s) => s.continueAsGuest);
  const setScreen = useSession((s) => s.setScreen);
  const newDesign = useStore((s) => s.newDesign);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const hasSavedJobs = useMemo(() => listLocalJobs().length > 0, []);

  async function start(opt: StartOption) {
    if (busyKey) return;
    setBusyKey(opt.key);
    try {
      newDesign(opt.kitchenType, opt.line);
      await continueAsGuest();
    } finally {
      setBusyKey(null);
    }
  }

  async function openSaved() {
    if (busyKey) return;
    setBusyKey('saved');
    try {
      await continueAsGuest();
      setScreen('jobs');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="start-screen">
      <div className="start-hero">
        <div className="brand start-brand">
          Cab<span>Design</span>
        </div>
        <h1 className="start-title">Design your dream kitchen in minutes</h1>
        <p className="start-tag">
          Draw your walls, place cabinets and appliances, see it in 3D, and print your plan — with live pricing as you go.
        </p>
      </div>

      <div className="start-cards">
        {OPTIONS.map((opt) => (
          <button key={opt.key} className="start-card" onClick={() => start(opt)} disabled={busyKey !== null}>
            <span className="start-card-icon">{opt.icon}</span>
            <span className="start-card-title">{opt.title}</span>
            <span className="start-card-sub">{opt.sub}</span>
            <span className="start-card-cta">{busyKey === opt.key ? 'Loading…' : 'Start designing →'}</span>
          </button>
        ))}
      </div>

      {hasSavedJobs && (
        <button className="start-open-saved" onClick={openSaved} disabled={busyKey !== null}>
          {busyKey === 'saved' ? 'Loading…' : 'Or pick up where you left off — open a saved job'}
        </button>
      )}

      <div className="start-steps">
        <div className="start-step">
          <span className="start-step-num">1</span>
          <span>Draw your walls</span>
        </div>
        <div className="start-step">
          <span className="start-step-num">2</span>
          <span>Place cabinets &amp; appliances</span>
        </div>
        <div className="start-step">
          <span className="start-step-num">3</span>
          <span>View in 3D &amp; print your plan</span>
        </div>
      </div>

      <p className="start-foot">Free to use — no account needed. Your designs and saved jobs stay in this browser.</p>
    </div>
  );
}
