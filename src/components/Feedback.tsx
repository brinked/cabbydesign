// App-wide feedback: toasts (with an optional action such as Undo) and a
// styled confirm dialog that replaces the browser's confirm().
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

interface FeedbackState {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
}

const useFeedback = create<FeedbackState>(() => ({ toasts: [], confirm: null }));
let nextId = 1;

/** Show a short message at the bottom of the screen. */
export function toast(message: string, action?: Toast['action'], ms = action ? 6000 : 3200): void {
  const id = nextId++;
  // one toast at a time keeps it readable — a new one replaces the old
  useFeedback.setState({ toasts: [{ id, message, action }] });
  setTimeout(() => useFeedback.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

/** Ask the user to confirm; resolves true when they accept. */
export function confirmAsk(opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    useFeedback.getState().confirm?.resolve(false);
    useFeedback.setState({
      confirm: { title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? 'OK', cancelLabel: opts.cancelLabel ?? 'Cancel', danger: opts.danger ?? false, resolve },
    });
  });
}

/** Mount once, at the app root. */
export default function FeedbackHost() {
  const toasts = useFeedback((s) => s.toasts);
  const confirm = useFeedback((s) => s.confirm);
  const okRef = useRef<HTMLButtonElement>(null);

  const answer = (ok: boolean) => {
    confirm?.resolve(ok);
    useFeedback.setState({ confirm: null });
  };

  useEffect(() => {
    if (!confirm) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        answer(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm]);

  return (
    <>
      {confirm && (
        <div className="modal-backdrop confirm-backdrop" onClick={() => answer(false)}>
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirm-title">{confirm.title}</h2>
            <p className="modal-sub">{confirm.message}</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => answer(false)}>
                {confirm.cancelLabel}
              </button>
              <button ref={okRef} className={confirm.danger ? 'btn-danger' : 'btn-primary'} onClick={() => answer(true)}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  useFeedback.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
