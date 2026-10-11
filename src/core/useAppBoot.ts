import { useEffect, useState } from 'react';
import { useDelayedLoading } from '../ui/useDelayedLoading';
import { useFontsReady } from '../ui/useFontsReady';
import { dismissStaticSplash } from './appBrowser';
import { BOOT_TIMEOUT_MS, bootReady } from './appLogic';

export interface AppBootOptions {
  accountLoading: boolean;
  stagesLoading: boolean;
  cloud: boolean;
  hasSummary: boolean;
}

export function useAppBoot({ accountLoading, stagesLoading, cloud, hasSummary }: AppBootOptions) {
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [bootCompleted, setBootCompleted] = useState(false);
  const fontsReady = useFontsReady();

  useEffect(() => {
    const timer = setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const ready = bootCompleted || bootReady(fontsReady, bootTimedOut, accountLoading, stagesLoading, cloud, hasSummary);
  const showBootLoading = useDelayedLoading(!ready);

  useEffect(() => {
    if (ready) {
      setBootCompleted(true);
      dismissStaticSplash();
    }
  }, [ready]);

  return {
    ready,
    showBootLoading,
  };
}
