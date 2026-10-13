import { createContext, useContext, type ReactNode } from 'react';
import { useLoadingService } from '../orchestration/useLoadingService';

interface LoadingStore {
  track<T>(promise: Promise<T>): Promise<T>;
}

// Provider 외부에서는 전달받은 Promise를 추적 없이 반환한다.
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
