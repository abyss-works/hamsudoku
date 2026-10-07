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
  // 베일은 전환(다음 판·재도전) 전용이다. 진입 게이트와 겹치지 않게
  // 임계를 길게 둬서 일반적인 전환은 베일 없이 지나간다.
  const show = useDelayedLoading(pending > 0, 200, 0);

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
