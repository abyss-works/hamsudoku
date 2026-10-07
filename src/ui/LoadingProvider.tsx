import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useDelayedLoading } from './useDelayedLoading';

interface LoadingStore {
  track<T>(promise: Promise<T>): Promise<T>;
}

// Provider 밖에서 쓰면 추적 없이 그대로 통과한다. 기존 화면 테스트가 깨지지 않는다.
const LoadingContext = createContext<LoadingStore>({ track: (p) => p });

export function useLoading(): LoadingStore {
  return useContext(LoadingContext);
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);
  const track = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    setPending((n) => n + 1);
    const done = () => setPending((n) => Math.max(0, n - 1));
    return promise.then(
      (v) => {
        done();
        return v;
      },
      (e) => {
        done();
        throw e;
      },
    );
  }, []);
  // 베일은 끝나면 즉시 치운다. 임계(80ms) 덕분에 짧은 작업은 뜨지도 않는다.
  const show = useDelayedLoading(pending > 0, 80, 0);

  return (
    <LoadingContext.Provider value={{ track }}>
      {children}
      {show && (
        <div className="loading-veil" aria-hidden="true">
          <div className="boot-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}
