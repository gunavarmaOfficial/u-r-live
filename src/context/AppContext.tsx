import { createContext, useContext } from 'react';
import { UserProfile, ChatMode } from '../types';

export type PreferredGender = 'any' | 'male' | 'female';
export type SessionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AppContextValue {
  user: UserProfile | null;
  preferredGender: PreferredGender;
  interests: string[];
  chatMode: ChatMode;
  sessionStatus: SessionStatus;
  sessionError: string | null;
  googleEnabled: boolean;
  isGoogleUser: boolean;
  loadSession: (options?: { createGuest?: boolean }) => Promise<void>;
  applySession: (payload: { user: UserProfile }) => void;
  updateUser: (user: UserProfile) => void;
  setPreferredGender: (gender: PreferredGender) => void;
  setInterests: (interests: string[]) => void;
  setChatMode: (mode: ChatMode) => void;
  signOut: () => void;
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
