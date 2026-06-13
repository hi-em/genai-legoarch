import { Component } from "react";
import { useBuild } from "../state/store.js";
import { Button } from "./ui/index.js";

// Last line of defence: without this, any render error white-screens the whole
// app (no React error boundary existed anywhere). Class component — error
// boundaries can't be hooks.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // silent mode: non-essential chrome (mascot, toasts) just disappears
    // instead of taking the app down with a full-screen fallback
    if (this.props.silent) return null;
    return (
      <div className="felt flex min-h-full w-full items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-2xl bg-elevated p-6 text-center shadow-pop">
          <h2 className="font-display text-h3 font-extrabold text-ink">Something snapped apart.</h2>
          <p className="mt-1.5 text-sm text-muted">
            An unexpected error broke this screen. Your dials and seed are safe.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <Button
              variant="primary"
              onClick={() => {
                // reset() keeps params + seed by design — the copy above promises it
                useBuild.getState().reset();
                this.setState({ error: null });
              }}
            >
              Back to the start
            </Button>
            <Button variant="secondary" onClick={() => location.reload()}>
              Reload the page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
