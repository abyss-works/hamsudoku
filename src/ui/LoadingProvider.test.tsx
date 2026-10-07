// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LoadingProvider, useLoading } from './LoadingProvider';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Probe({ task }: { task: Promise<unknown> }) {
  const { track } = useLoading();
  return (
    <button
      onClick={() => {
        void track(task).catch(() => {});
      }}
    >
      go
    </button>
  );
}

describe('LoadingProvider', () => {
  it('track 중인 작업이 임계를 넘기면 베일이 뜬다', () => {
    vi.useFakeTimers();
    const gate = new Promise<string>(() => {});
    const { container } = render(
      <LoadingProvider>
        <Probe task={gate} />
      </LoadingProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(container.querySelector('.loading-veil')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.querySelector('.loading-veil')).toBeTruthy();
  });

  it('작업이 끝나면 최소 표시 뒤에 베일이 사라진다', async () => {
    vi.useFakeTimers();
    let resolve!: (v: string) => void;
    const gate = new Promise<string>((r) => {
      resolve = r;
    });
    const { container } = render(
      <LoadingProvider>
        <Probe task={gate} />
      </LoadingProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(container.querySelector('.loading-veil')).toBeTruthy();
    await act(async () => {
      resolve('done');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('.loading-veil')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.loading-veil')).toBeNull();
  });

  it('실패한 작업도 카운트를 내리고 최소 표시 뒤에 치운다', async () => {
    vi.useFakeTimers();
    let reject!: (e: Error) => void;
    const gate = new Promise<string>((_, rej) => {
      reject = rej;
    });
    const { container } = render(
      <LoadingProvider>
        <Probe task={gate} />
      </LoadingProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'go' }));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(container.querySelector('.loading-veil')).toBeTruthy();
    await act(async () => {
      reject(new Error('boom'));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('.loading-veil')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.loading-veil')).toBeNull();
  });
});
