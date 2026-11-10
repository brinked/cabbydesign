import { Component, type ErrorInfo, type ReactNode } from 'react';
import { resetSavedDesign } from '../state/store';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render error anywhere in the app used to leave a
 * blank page — and because the design autosaves, the same blank page on every
 * reload. This shows what happened and offers a way out that never destroys
 * the design (it is parked in the browser under a recovery key first).
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <h1>Something went wrong</h1>
          <p>
            The designer hit a problem it couldn’t recover from. Your design is still saved in this browser — try
            reloading first.
          </p>
          <div className="crash-actions">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                resetSavedDesign(error);
                window.location.reload();
              }}
            >
              Start a fresh design
            </button>
          </div>
          <p className="crash-note">
            “Start a fresh design” keeps a backup copy of the current design in this browser, so it can still be
            recovered.
          </p>
          <details>
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
