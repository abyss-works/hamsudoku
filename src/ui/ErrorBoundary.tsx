import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// 렌더 예외가 흰 화면으로 끝나지 않게 받는다. 다시 시도는 자식을 처음부터 그린다.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    Sentry.captureException(error);
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) {
      return (
        <div className="error-fallback" role="alert">
          <p className="error-fallback-title">문제가 생겨 화면을 그리지 못했어요.</p>
          <p className="error-fallback-sub">기록은 기기에 그대로 있어요. 다시 시도해 보세요.</p>
          <div className="error-fallback-actions">
            <Button variant="sticker" className="btn-primary" onClick={this.retry}>
              다시 시도
            </Button>
            <Button variant="sticker" onClick={() => window.location.reload()}>
              새로고침
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
