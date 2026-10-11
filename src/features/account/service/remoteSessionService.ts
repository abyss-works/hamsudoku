import { cloudAuthApi } from '../api/accountApi';

export interface RemoteSessionUser {
  uid: string | null;
}

export async function fetchRemoteSessionUser(): Promise<RemoteSessionUser> {
  try {
    const me = await cloudAuthApi.me();
    return { uid: me.uid };
  } catch {
    return { uid: null };
  }
}
