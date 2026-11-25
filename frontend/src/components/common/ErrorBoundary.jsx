import { Component } from 'react';
import { Button } from '@/components/ui';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="tw:m-5 tw:flex tw:flex-col tw:items-start tw:gap-3 tw:rounded-lg tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:p-5 tw:normal-case">
        <h2 className="tw:m-0 tw:text-base tw:font-bold tw:text-destructive">Something went wrong on this screen.</h2>
        <pre className="tw:m-0 tw:max-w-full tw:overflow-auto tw:text-[11px] tw:whitespace-pre-wrap tw:text-foreground">{String(this.state.error)}</pre>
        <Button variant="default" onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
    );
  }
}
