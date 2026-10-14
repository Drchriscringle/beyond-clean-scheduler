import { Component } from "react";

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Pocket Money crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-4 bg-white/90 backdrop-blur p-7 rounded-[2rem] shadow-xl text-center">
            <span className="text-5xl">🐷</span>
            <h1 className="font-display font-bold text-slate-800">Something went wrong</h1>
            <p className="text-sm text-slate-500">
              Sorry about that — try reloading the page. If it keeps happening, let us know.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full font-display font-bold rounded-2xl py-3 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
