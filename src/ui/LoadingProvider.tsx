import { createContext, useContext, type ReactNode } from 'react';
import { useLoadingService } from './useLoadingService';

interface LoadingStore {
  track<T>(promise: Promise<T>): Promise<T>;
}

// Provider 밖에서 쓰면 추적 없이 그대로 통과한다. 기존 화면 테스트가 깨지지 않는다.
const LoadingContext = createContext<LoadingStore>({ track: (p) => p });

export function useLoading(): LoadingStore {
  return useContext(LoadingContext);
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const { track, show } = useLoadingService();

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
