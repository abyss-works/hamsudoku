import { useCallback, useEffect, useRef, useState } from 'react';
import { profileApi, type ProfileResult } from './accountApi';
import {
  applyProfileNickname,
  createInitialProfileState,
  resetProfileState,
  setProfileTarget,
  type ProfileState,
} from './profileState';

export interface ProfileService {
  nickname: string | null;
  loadProfile: (uid: string | null) => Promise<string | null>;
  saveNickname: (nickname: string, currentUid: string | null) => Promise<ProfileResult>;
  resetProfile: () => void;
}

export function useProfileService(initialUid: string | null = null): ProfileService {
  const [state, setState] = useState<ProfileState>(() => createInitialProfileState(initialUid));
  const generationRef = useRef(0);
  const isMountedRef = useRef(true);
  const mountInstanceIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    ++mountInstanceIdRef.current;
    return () => {
      isMountedRef.current = false;
      ++mountInstanceIdRef.current;
    };
  }, []);

  const resetProfile = useCallback(() => {
    const nextGen = ++generationRef.current;
    setState((prev) => resetProfileState(prev, nextGen));
  }, []);

  const loadProfile = useCallback(async (uid: string | null): Promise<string | null> => {
    if (!uid) {
      resetProfile();
      return null;
    }

    const currentMount = mountInstanceIdRef.current;
    const requestGen = ++generationRef.current;
    setState((prev) => setProfileTarget(prev, uid, requestGen));

    try {
      const p = await profileApi.get();
      if (!isMountedRef.current || currentMount !== mountInstanceIdRef.current) {
        return p.nickname;
      }
      if (generationRef.current !== requestGen) {
        return p.nickname;
      }
      setState((prev) => applyProfileNickname(prev, uid, requestGen, p.nickname));
      return p.nickname;
    } catch {
      return null;
    }
  }, [resetProfile]);

  const saveNickname = useCallback(
    async (nickname: string, currentUid: string | null): Promise<ProfileResult> => {
      const currentMount = mountInstanceIdRef.current;
      const requestGen = generationRef.current;

      const res = await profileApi.save(nickname);

      if (!isMountedRef.current || currentMount !== mountInstanceIdRef.current) {
        return res;
      }
      if (generationRef.current !== requestGen) {
        return res;
      }

      if (res.ok) {
        setState((prev) => applyProfileNickname(prev, currentUid, requestGen, res.nickname));
      }

      return res;
    },
    []
  );

  return {
    nickname: state.nickname,
    loadProfile,
    saveNickname,
    resetProfile,
  };
}
