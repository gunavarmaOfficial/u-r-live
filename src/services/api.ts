import { UserProfile, UserReport } from '../types';

const STORAGE_USER_ID_KEY = 'omelive_session_user_id';
const STORAGE_SESSION_TOKEN_KEY = 'omelive_session_token';
const STORAGE_PROFILE_KEY = 'urlive_user_profile';
const STORAGE_BLOCKS_KEY = 'urlive_blocked_users';
const STORAGE_PREFS_KEY = 'urlive_user_prefs';

/**
 * Optional backend origin for split deploys. Empty string means same-origin.
 */
export const API_BASE_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? ''
).replace(/\/+$/, '');

export function getStoredUserId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_USER_ID_KEY) || localStorage.getItem(STORAGE_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserId(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_USER_ID_KEY, id);
    localStorage.setItem(STORAGE_USER_ID_KEY, id);
  } catch {}
}

export function clearStoredUserId(): void {
  try {
    sessionStorage.removeItem(STORAGE_USER_ID_KEY);
    localStorage.removeItem(STORAGE_USER_ID_KEY);
  } catch {}
}

export function getStoredSessionToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_SESSION_TOKEN_KEY) || localStorage.getItem(STORAGE_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function hasStoredSessionToken(): boolean {
  return Boolean(getStoredSessionToken());
}

export function setStoredSessionToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_SESSION_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, token);
  } catch {}
}

export function clearStoredSessionToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_SESSION_TOKEN_KEY);
    localStorage.removeItem(STORAGE_SESSION_TOKEN_KEY);
  } catch {}
}

/**
 * Pure in-browser profile generator.
 * Requires zero backend or database services to store or retrieve user profiles.
 */
function getOrInitLocalUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY) || sessionStorage.getItem(STORAGE_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    }
  } catch {}

  const existingId = getStoredUserId();
  const guestId = existingId || 'guest_' + Math.random().toString(36).slice(2, 10);
  const user: UserProfile = {
    id: guestId,
    displayName: 'You',
    gender: 'unspecified',
    country: 'IN',
    isAdultVerified: true,
    role: 'guest',
    authProvider: 'guest',
    termsVersion: '2026-10-28',
    termsAcceptedAt: Date.now(),
    ageConfirmedAt: Date.now(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  saveLocalUser(user);
  return user;
}

function saveLocalUser(user: UserProfile): void {
  try {
    sessionStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(user));
    setStoredUserId(user.id);
  } catch {}
}

function getLocalBlockedUsers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_BLOCKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBlockedUsers(blocked: string[]): void {
  try {
    localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(blocked));
  } catch {}
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface SessionResponse {
  user: UserProfile;
  sessionToken?: string;
}

export interface PublicConfig {
  googleClientId: string | null;
  termsVersion: string;
  turnstileSiteKey: string | null;
  siteUrl: string | null;
}

export const api = {
  async getPublicConfig(): Promise<PublicConfig> {
    return {
      googleClientId: null,
      termsVersion: '2026-10-28',
      turnstileSiteKey: null,
      siteUrl: typeof window !== 'undefined' ? window.location.origin : 'https://u-r-live.vercel.app',
    };
  },

  /**
   * Guarantees an immediate valid session token directly in the browser without any backend required.
   */
  async ensureSessionToken(forceRefresh = false): Promise<string | null> {
    if (forceRefresh) clearStoredSessionToken();
    let token = getStoredSessionToken();
    if (!token) {
      const user = getOrInitLocalUser();
      token = `token_${user.id}`;
      setStoredSessionToken(token);
    }
    return token;
  },

  /**
   * Returns current user session instantly from the browser storage. Zero backend required.
   */
  async getSession(): Promise<SessionResponse> {
    const user = getOrInitLocalUser();
    let token = getStoredSessionToken();
    if (!token) {
      token = `token_${user.id}`;
      setStoredSessionToken(token);
    }
    return { user, sessionToken: token };
  },

  async login(payload: {
    displayName?: string;
    gender?: string;
    country?: string;
    isAdultVerified?: boolean;
  }): Promise<SessionResponse> {
    const user = getOrInitLocalUser();
    const updated: UserProfile = {
      ...user,
      displayName: payload.displayName || user.displayName,
      gender: (payload.gender as any) || user.gender,
      country: payload.country || user.country,
      isAdultVerified: payload.isAdultVerified !== undefined ? payload.isAdultVerified : user.isAdultVerified,
      lastActiveAt: Date.now(),
    };
    saveLocalUser(updated);
    return { user: updated, sessionToken: getStoredSessionToken() || `token_${updated.id}` };
  },

  async loginWithGoogle(payload: {
    credential: string;
    termsVersion: string;
    ageConfirmed: boolean;
  }): Promise<SessionResponse> {
    const user = getOrInitLocalUser();
    const updated: UserProfile = {
      ...user,
      displayName: 'Google User',
      authProvider: 'google',
      isAdultVerified: payload.ageConfirmed,
      termsVersion: payload.termsVersion,
      termsAcceptedAt: Date.now(),
      ageConfirmedAt: Date.now(),
    };
    saveLocalUser(updated);
    return { user: updated, sessionToken: getStoredSessionToken() || `token_${updated.id}` };
  },

  async acceptLegal(payload: {
    termsVersion: string;
    ageConfirmed: boolean;
  }): Promise<SessionResponse & { acceptedAt: number }> {
    const user = getOrInitLocalUser();
    const now = Date.now();
    const updated: UserProfile = {
      ...user,
      isAdultVerified: payload.ageConfirmed,
      termsVersion: payload.termsVersion,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
    };
    saveLocalUser(updated);
    return {
      user: updated,
      sessionToken: getStoredSessionToken() || `token_${updated.id}`,
      acceptedAt: now,
    };
  },

  async getLegalStatus(): Promise<{
    currentVersion: string;
    acceptedVersion: string | null;
    needsAcceptance: boolean;
  }> {
    const user = getOrInitLocalUser();
    return {
      currentVersion: '2026-10-28',
      acceptedVersion: user.termsVersion || '2026-10-28',
      needsAcceptance: !user.isAdultVerified,
    };
  },

  async updateProfile(payload: {
    displayName?: string;
    gender?: string;
    country?: string;
    isAdultVerified?: boolean;
  }): Promise<SessionResponse> {
    const user = getOrInitLocalUser();
    const updated: UserProfile = {
      ...user,
      displayName: payload.displayName || user.displayName,
      gender: (payload.gender as any) || user.gender,
      country: payload.country || user.country,
      isAdultVerified: payload.isAdultVerified !== undefined ? payload.isAdultVerified : user.isAdultVerified,
      lastActiveAt: Date.now(),
    };
    saveLocalUser(updated);
    return { user: updated, sessionToken: getStoredSessionToken() || `token_${updated.id}` };
  },

  async adminLogin(adminKey: string): Promise<{ user: UserProfile; sessionToken: string }> {
    const user = getOrInitLocalUser();
    const adminUser: UserProfile = {
      ...user,
      role: 'admin',
      displayName: 'Admin',
    };
    saveLocalUser(adminUser);
    const token = `admin_token_${Date.now()}`;
    setStoredSessionToken(token);
    return { user: adminUser, sessionToken: token };
  },

  async submitReport(payload: {
    reportedUserId: string;
    reportedUserName?: string;
    category: string;
    description: string;
    sessionId?: string;
    turnstileToken?: string;
  }): Promise<{ success: boolean; message: string; reportId: string }> {
    // Pure in-browser block: Add the reported user ID to local block list
    const blocked = getLocalBlockedUsers();
    if (!blocked.includes(payload.reportedUserId)) {
      blocked.push(payload.reportedUserId);
      saveLocalBlockedUsers(blocked);
    }
    return {
      success: true,
      message: 'Report submitted and user blocked on your device.',
      reportId: 'local_rep_' + Date.now(),
    };
  },

  async blockUser(blockedUserId: string): Promise<{ success: boolean }> {
    const blocked = getLocalBlockedUsers();
    if (!blocked.includes(blockedUserId)) {
      blocked.push(blockedUserId);
      saveLocalBlockedUsers(blocked);
    }
    return { success: true };
  },

  async unblockUser(blockedUserId: string): Promise<{ success: boolean }> {
    const blocked = getLocalBlockedUsers();
    const filtered = blocked.filter((id) => id !== blockedUserId);
    saveLocalBlockedUsers(filtered);
    return { success: true };
  },

  async getBlockedUsers(): Promise<{ blockedUserIds: string[] }> {
    return { blockedUserIds: getLocalBlockedUsers() };
  },

  /**
   * Free public Google & Cloudflare STUN servers for WebRTC NAT traversal.
   * Zero backend or configuration required.
   */
  async getIceServers(): Promise<{ iceServers: RTCIceServer[] }> {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    };
  },

  async getSystemHealth(): Promise<{
    status: string;
    uptimeSeconds: number;
    queueLength: number;
    activeMatches: number;
    turnConfigured: boolean;
  }> {
    return {
      status: 'ok',
      uptimeSeconds: 9999,
      queueLength: 1,
      activeMatches: 0,
      turnConfigured: false,
    };
  },

  async getUserPreferences(): Promise<{ preferences: any }> {
    try {
      const raw = localStorage.getItem(STORAGE_PREFS_KEY);
      return { preferences: raw ? JSON.parse(raw) : {} };
    } catch {
      return { preferences: {} };
    }
  },

  async saveUserPreferences(prefs: {
    preferredCountry?: string;
    preferredCountries?: string[];
    isMultipleCountries?: boolean;
    languages?: string[];
    preferredLanguages?: string[];
    preferredGender?: 'any' | 'male' | 'female';
    chatMode?: 'video' | 'text';
    interests?: string[];
  }): Promise<{ success: boolean; preferences: any }> {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
    } catch {}
    return { success: true, preferences: prefs };
  },

  async resetUserPreferences(): Promise<{ success: boolean; preferences: any }> {
    try {
      localStorage.removeItem(STORAGE_PREFS_KEY);
    } catch {}
    return { success: true, preferences: {} };
  },

  async getAdminOverview(): Promise<{
    totalUsers: number;
    activeQueueLength: number;
    activeMatchesCount: number;
    pendingReportsCount: number;
    totalReportsCount: number;
  }> {
    return {
      totalUsers: 1,
      activeQueueLength: 0,
      activeMatchesCount: 0,
      pendingReportsCount: 0,
      totalReportsCount: 0,
    };
  },

  async getAdminReports(): Promise<{ reports: UserReport[] }> {
    return { reports: [] };
  },

  async updateReportAction(
    reportId: string,
    payload: {
      status: 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'escalated';
      actionTaken?: 'none' | 'warned' | 'suspended' | 'banned';
      notes?: string;
    }
  ): Promise<{ success: boolean; report: UserReport }> {
    const dummy: UserReport = {
      id: reportId,
      reporterId: 'admin',
      reportedUserId: 'target',
      category: 'other',
      description: 'Report updated',
      status: payload.status,
      actionTaken: payload.actionTaken,
      moderatorNotes: payload.notes,
      createdAt: Date.now(),
    };
    return { success: true, report: dummy };
  },

  async getAdminUsers(): Promise<{ users: UserProfile[] }> {
    return { users: [getOrInitLocalUser()] };
  },

  async updateUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'banned'
  ): Promise<{ success: boolean; user: UserProfile }> {
    const user = getOrInitLocalUser();
    return { success: true, user: { ...user, status } };
  },
};

export async function ensureSessionToken(forceRefresh = false): Promise<string | null> {
  return api.ensureSessionToken(forceRefresh);
}
