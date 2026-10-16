import { Component } from "react";
import { Button, Card, Centered, Logo } from "./ui";

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
        <Centered>
          <Card className="max-w-sm p-7 text-center space-y-4">
            <div className="flex justify-center"><Logo size={48} /></div>
            <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
            <p className="text-sm text-ink-muted">Sorry about that — try reloading. If it keeps happening, let us know.</p>
            <Button className="w-full" onClick={() => window.location.reload()}>Reload</Button>
          </Card>
        </Centered>
      );
    }
    return this.props.children;
  }
}
