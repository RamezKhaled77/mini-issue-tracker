import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Top-level render guard — keeps a render crash from blanking the app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="not-found" role="alert">
          <p className="page-eyebrow">Error</p>
          <h1 className="page-title">Something went wrong</h1>
          <p className="not-found-description">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <a href="/">
            <button type="button" className="btn btn--secondary">
              Reload
            </button>
          </a>
        </section>
      );
    }
    return this.props.children;
  }
}
