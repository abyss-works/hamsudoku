// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

describe('ErrorBoundary', () => {
  it('captures a render error and retries its children', () => {
    let shouldThrow = true;
    const error = new Error('render failed');

    function Child() {
      if (shouldThrow) throw error;
      return <p>화면을 다시 표시했습니다.</p>;
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary renderFallback={({ retry }) => <button onClick={retry}>다시 시도</button>}>
        <Child />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith(error);

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(screen.getByText('화면을 다시 표시했습니다.')).toBeTruthy();

    consoleError.mockRestore();
  });
});
