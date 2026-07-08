import { useMemo, useState } from 'react';
import type { KitchenType, ProductLine } from '../model/types';
import { listLocalJobs } from '../state/localJobs';
import { useSession } from '../state/session';
import { useStore } from '../state/store';

type StartKind = 'indoor' | 'outdoor' | 'newage';

const START_ARGS: Record<StartKind, { kitchenType: KitchenType; line: ProductLine }> = {
  indoor: { kitchenType: 'indoor', line: 'ext' },
  outdoor: { kitchenType: 'outdoor', line: 'ext' },
  newage: { kitchenType: 'outdoor', line: 'newage' },
};

/* ---------- small inline icons (stroke style) ---------- */
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const IconCheck = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
    <circle cx="10" cy="10" r="8.4" {...stroke} strokeWidth={1.5} />
    <path d="M6.4 10.2l2.4 2.4 4.8-5" {...stroke} strokeWidth={1.5} />
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
    <circle cx="10" cy="7" r="3.4" {...stroke} strokeWidth={1.5} />
    <path d="M3.8 17c1-3 3.3-4.4 6.2-4.4s5.2 1.4 6.2 4.4" {...stroke} strokeWidth={1.5} />
  </svg>
);
const IconHouse = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
    <path d="M4 15 16 5l12 10" {...stroke} />
    <path d="M7.5 13.5V27h17V13.5" {...stroke} />
    <rect x="13" y="19" width="6" height="8" rx="0.8" {...stroke} />
  </svg>
);
const IconPalm = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
    <path d="M16 13c-1 4-1.8 9-1.2 14" {...stroke} />
    <path d="M16 13c-3.4-2.6-7-2.8-10-.6 3-.4 5.6.2 7.6 1.8" {...stroke} />
    <path d="M16 13c-.6-4-3-6.6-6.8-7.2 2.8 1.4 4.4 3.4 4.8 6" {...stroke} />
    <path d="M16 13c.8-3.8 3.4-6 7.4-6-2.6 1.2-4.2 3-4.8 5.4" {...stroke} />
    <path d="M16 13c3.4-2 6.8-1.8 9.6.6-2.8-.8-5.4-.4-7.8 1.2" {...stroke} />
    <path d="M9 27h14" {...stroke} />
  </svg>
);
const IconDraw = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <rect x="7" y="7" width="22" height="22" rx="1" {...stroke} strokeDasharray="4 3" />
    <rect x="4.6" y="4.6" width="5" height="5" rx="1" {...stroke} />
    <rect x="26.4" y="26.4" width="5" height="5" rx="1" {...stroke} />
  </svg>
);
const IconCabinet = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <rect x="9" y="5" width="18" height="26" rx="1.4" {...stroke} />
    <path d="M9 13h18M18 13v18" {...stroke} />
    <path d="M18 8.4v2.4" {...stroke} strokeWidth={2.4} />
  </svg>
);
const IconAppliance = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <rect x="7" y="7" width="22" height="22" rx="2" {...stroke} />
    <path d="M7 13h22" {...stroke} />
    <circle cx="11.5" cy="10" r="1" fill="currentColor" />
    <circle cx="16" cy="10" r="1" fill="currentColor" />
    <circle cx="14" cy="20.5" r="3.6" {...stroke} />
    <circle cx="23.5" cy="20.5" r="1.6" {...stroke} />
  </svg>
);
const IconQuote = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <path d="M8 6h14l6 6v18H8Z" {...stroke} />
    <path d="M22 6v6h6" {...stroke} />
    <path d="M12 17h12M12 22h12M12 27h7" {...stroke} strokeWidth={1.5} />
  </svg>
);
const IconCube = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <path d="M18 4.5 30 11v14L18 31.5 6 25V11Z" {...stroke} />
    <path d="M6 11l12 6.5L30 11M18 17.5v14" {...stroke} />
  </svg>
);
const IconPrint = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <path d="M11 12V5h14v7" {...stroke} />
    <rect x="7" y="12" width="22" height="12" rx="2" {...stroke} />
    <rect x="11" y="20" width="14" height="11" rx="1" {...stroke} />
    <path d="M14 24.5h8M14 27.5h5" {...stroke} strokeWidth={1.5} />
  </svg>
);
const IconPalette = () => (
  <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden>
    <path d="M18 5c7.7 0 13 4.8 13 10.6 0 3.9-3 6.4-6.6 6.4h-2.8c-1.8 0-3 1.3-2.5 3 .4 1.4.3 3-1 4-1 .8-2.4 1.2-4 .9C8.2 28.9 5 23.9 5 18 5 10.8 10.8 5 18 5Z" {...stroke} />
    <circle cx="12" cy="13" r="1.7" fill="currentColor" />
    <circle cx="19.5" cy="10.5" r="1.7" fill="currentColor" />
    <circle cx="26" cy="14.5" r="1.7" fill="currentColor" />
    <circle cx="11" cy="20" r="1.7" fill="currentColor" />
  </svg>
);
const Arrow = () => (
  <svg viewBox="0 0 40 12" width="34" height="12" aria-hidden className="landing-step-arrow">
    <path d="M2 6h33M31 2l4 4-4 4" {...stroke} strokeWidth={1.5} />
  </svg>
);

const FEATURES = [
  { icon: <IconDraw />, name: 'Draw Your Space', sub: 'Draw walls in seconds with smart tools.' },
  { icon: <IconCabinet />, name: 'Add Cabinets', sub: 'Drag & drop cabinets along any wall.' },
  { icon: <IconAppliance />, name: 'Add Appliances', sub: 'Grills, fridges, sinks and more.' },
  { icon: <IconQuote />, name: 'Free Quotes', sub: 'Request a quote right from your design.' },
  { icon: <IconCube />, name: '3D Visualization', sub: 'View your kitchen in stunning 3D.' },
  { icon: <IconPrint />, name: 'Print & Share', sub: 'Generate professional plans instantly.' },
];

const STEPS = [
  { icon: <IconDraw />, name: 'Draw Your Room', sub: 'Create your walls in minutes.' },
  { icon: <IconCabinet />, name: 'Add Cabinets', sub: 'Choose and place cabinets.' },
  { icon: <IconAppliance />, name: 'Add Appliances', sub: 'Add grills, sinks, fridges & more.' },
  { icon: <IconPalette />, name: 'Customize', sub: 'Pick colors, finishes and options.' },
  { icon: <IconCube />, name: 'View in 3D', sub: 'See your kitchen come to life.' },
  { icon: <IconPrint />, name: 'Print or Save', sub: 'Print plans or save for later.' },
];

/** Consumer landing page — shown to first-time visitors. Picking a designer
 *  enters guest mode with a fresh design of that type. */
export default function StartScreen() {
  const continueAsGuest = useSession((s) => s.continueAsGuest);
  const setScreen = useSession((s) => s.setScreen);
  const newDesign = useStore((s) => s.newDesign);
  const [busy, setBusy] = useState(false);
  const hasSavedJobs = useMemo(() => listLocalJobs().length > 0, []);

  async function start(kind: StartKind) {
    if (busy) return;
    setBusy(true);
    try {
      const a = START_ARGS[kind];
      newDesign(a.kitchenType, a.line);
      await continueAsGuest();
    } finally {
      setBusy(false);
    }
  }

  async function openSaved() {
    if (busy) return;
    setBusy(true);
    try {
      await continueAsGuest();
      setScreen('jobs');
    } finally {
      setBusy(false);
    }
  }

  const scrollToChoices = () => document.getElementById('landing-ways')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="landing">
      {/* ---------- top nav ---------- */}
      <header className="landing-nav">
        <div className="brand landing-brand">
          Cab<span>Design</span>
        </div>
        <div className="landing-nav-right">
          <span className="landing-badge">
            <IconUser /> No account required
          </span>
          <span className="landing-badge">
            <IconCheck /> 100% Free to use
          </span>
          {hasSavedJobs && (
            <button className="landing-link" onClick={openSaved} disabled={busy}>
              Open saved job
            </button>
          )}
          <button className="landing-btn" onClick={scrollToChoices}>
            Start Designing
          </button>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <h1>
            Design Your Dream Kitchen <span className="landing-hl">in Minutes</span>
          </h1>
          <p>Draw your room, place cabinets and appliances, see it in 3D, and print your plans — all in real time.</p>
          <ul className="landing-checks">
            <li>
              <IconCheck /> No software to install
            </li>
            <li>
              <IconCheck /> No downloads
            </li>
            <li>
              <IconCheck /> Free to use forever
            </li>
          </ul>
        </div>
        <div className="landing-hero-shot">
          <img src="/landing/hero-3d.jpg" alt="CabDesign 3D outdoor kitchen designer" />
        </div>
      </section>

      {/* ---------- two ways ---------- */}
      <section className="landing-section" id="landing-ways">
        <h2>Two Ways to Design</h2>
        <p className="landing-section-sub">Choose your experience and start building your dream kitchen.</p>
        <div className="landing-ways">
          <div className="landing-way">
            <div className="landing-way-shot">
              <img src="/landing/indoor-plan.jpg" alt="Indoor kitchen floor plan" />
            </div>
            <div className="landing-way-body">
              <span className="landing-way-icon">
                <IconHouse />
              </span>
              <div>
                <h3>Indoor Kitchen Designer</h3>
                <p>Create custom indoor kitchens with precise layout tools, cabinets, and real-time 3D visualization.</p>
                <button className="landing-btn" onClick={() => start('indoor')} disabled={busy}>
                  Start Indoor Design →
                </button>
              </div>
            </div>
          </div>
          <div className="landing-way">
            <div className="landing-way-shot">
              <img src="/landing/outdoor-3d.jpg" alt="Outdoor kitchen in 3D" />
            </div>
            <div className="landing-way-body">
              <span className="landing-way-icon">
                <IconPalm />
              </span>
              <div>
                <h3>Outdoor Kitchen Designer</h3>
                <p>Design durable outdoor kitchens with weatherproof cabinets, grills, sinks and more.</p>
                <button className="landing-btn" onClick={() => start('outdoor')} disabled={busy}>
                  Start Outdoor Design →
                </button>
                <button className="landing-link landing-way-alt" onClick={() => start('newage')} disabled={busy}>
                  or start with NewAge stainless modular cabinets
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section className="landing-section">
        <h2>Powerful Tools. Beautiful Results.</h2>
        <div className="landing-features">
          {FEATURES.map((f) => (
            <div key={f.name} className="landing-feature">
              <span className="landing-feature-icon">{f.icon}</span>
              <b>{f.name}</b>
              <span>{f.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="landing-section landing-how-wrap">
        <div className="landing-how-card">
          <h2>How It Works</h2>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div key={s.name} className="landing-step-cell">
                <div className="landing-step">
                  <span className="landing-step-num">{i + 1}</span>
                  <span className="landing-step-icon">{s.icon}</span>
                  <b>{s.name}</b>
                  <span>{s.sub}</span>
                </div>
                {i < STEPS.length - 1 && <Arrow />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section className="landing-section landing-cta">
        <h2>Ready to design your kitchen?</h2>
        <p className="landing-section-sub">Choose your experience and start designing in minutes.</p>
        <div className="landing-cta-row">
          <button className="landing-btn" onClick={() => start('indoor')} disabled={busy}>
            <IconHouse /> Start Indoor Design
          </button>
          <span className="landing-cta-or">or</span>
          <button className="landing-btn landing-btn-outline" onClick={() => start('outdoor')} disabled={busy}>
            <IconPalm /> Start Outdoor Design
          </button>
        </div>
      </section>

      <footer className="landing-foot">
        Free to use — no account needed. Your designs and saved jobs stay in this browser.
      </footer>
    </div>
  );
}
