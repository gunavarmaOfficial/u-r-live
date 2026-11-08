import { createContext, useContext } from 'react';
import { Subscription, UserProfile } from '../types';

export type PreferredGender = 'any' | 'male' | 'female';
export type SessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AppContextValue {
  user: UserProfile | null;
  isPro: boolean;
  subscription: Subscription | null;
  preferredGender: PreferredGender;
  sessionStatus: SessionStatus;
  sessionError: string | null;
  googleEnabled: boolean;
  isGoogleUser: boolean;
  loadSession: (options?: { createGuest?: boolean }) => Promise<void>;
  applySession: (payload: {
    user: UserProfile;
    isPro?: boolean;
    subscription?: Subscription | null;
  }) => void;
  updateUser: (user: UserProfile) => void;
  setPreferredGender: (gender: PreferredGender) => void;
  signOut: () => void;
  openUpgrade: (reason?: string) => void;
  openSettings: () => void;
  openGoogle: () => void;
  openReport: (userId: string, userName: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppContext.Provider');
  return value;
}
