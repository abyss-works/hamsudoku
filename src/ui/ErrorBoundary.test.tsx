// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('자식 예외를 스티커 폴백으로 받는다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
      expect(screen.getByText('문제가 생겨 화면을 그리지 못했어요.')).toBeTruthy();
    } finally {
      (console.error as ReturnType<typeof vi.spyOn>).mockRestore();
      cleanup();
    }
  });

  it('다시 시도를 누르면 자식을 다시 그린다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let alive = false;
      function Maybe() {
        if (!alive) throw new Error('boom');
        return <p>살아났다</p>;
      }
      render(
        <ErrorBoundary>
          <Maybe />
        </ErrorBoundary>,
      );
      alive = true;
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
      expect(screen.getByText('살아났다')).toBeTruthy();
    } finally {
      (console.error as ReturnType<typeof vi.spyOn>).mockRestore();
      cleanup();
    }
  });
});
