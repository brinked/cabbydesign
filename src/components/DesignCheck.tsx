// Toolbar "Design check": a live count of things worth a look, with a list
// that jumps to the cabinet or wall concerned.
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkDesign, type Issue } from '../model/validate';
import { useStore } from '../state/store';

const LEVEL_LABEL: Record<Issue['level'], string> = { problem: 'Needs fixing', warning: 'Worth a look', tip: 'Suggestion' };

export default function DesignCheck() {
  const design = useStore((s) => s.design);
  const appliances = useStore((s) => s.appliances);
  const linerClearance = useStore((s) => s.linerClearance);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => {
    try {
      return checkDesign(design, appliances, linerClearance);
    } catch (err) {
      console.error('design check failed', err);
      return [];
    }
  }, [design, appliances, linerClearance]);

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

  const hasCabinets = design.items.some((it) => !it.auto);
  const problems = issues.filter((i) => i.level === 'problem').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const tone = problems ? 'problem' : warnings ? 'warning' : issues.length ? 'tip' : 'ok';
  const label = !hasCabinets ? 'Design check' : issues.length === 0 ? 'Looks good' : `${issues.length} to review`;

  const go = (issue: Issue) => {
    setOpen(false);
    const s = useStore.getState();
    s.setTab('design');
    if (issue.itemId) s.openEditor(issue.itemId);
    // the walls view mounts on the tab switch — scroll once it is there
    if (issue.wallId) setTimeout(() => document.getElementById(`wall-${issue.wallId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  return (
    <div className="settings-dd" ref={ref}>
      <button className={`check-btn check-${tone}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Checks your design for fit and common mistakes">
        <span className="check-dot" aria-hidden />
        {label}
      </button>
      {open && (
        <div className="settings-menu check-menu" role="dialog" aria-label="Design check">
          {issues.length === 0 ? (
            <p className="check-empty">
              {hasCabinets ? 'Nothing to flag — everything fits and nothing is blocked.' : 'Add some cabinets and this will check that everything fits and nothing is blocked.'}
            </p>
          ) : (
            <ul className="check-list">
              {issues.map((i) => (
                <li key={i.id}>
                  <button className="check-item" onClick={() => go(i)} disabled={!i.wallId && !i.itemId}>
                    <span className={`check-tag check-tag-${i.level}`}>{LEVEL_LABEL[i.level]}</span>
                    <b>{i.title}</b>
                    <span>{i.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
