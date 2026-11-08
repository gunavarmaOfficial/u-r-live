import { UserProfile, Subscription, PlanInfo, UserReport } from '../types';

const STORAGE_USER_ID_KEY = 'omelive_session_user_id';
const STORAGE_SESSION_TOKEN_KEY = 'omelive_session_token';

/**
 * Optional backend origin for split deploys: static frontend on a host like
 * Vercel/Netlify + the Express/WebSocket server elsewhere. Empty string means
 * same-origin (the default, e.g. npm run dev or the full server deployment).
 * Set VITE_API_URL at build time, e.g. https://api.u-r-live.com
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
    if (!id.startsWith('guest_')) {
      localStorage.setItem(STORAGE_USER_ID_KEY, id);
    }
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
    const userId = getStoredUserId();
    if (userId && !userId.startsWith('guest_')) {
      localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, token);
    }
  } catch {}
}

export function clearStoredSessionToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_SESSION_TOKEN_KEY);
    localStorage.removeItem(STORAGE_SESSION_TOKEN_KEY);
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredSessionToken();
  const userId = getStoredUserId();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-session-token', token);
  }
  if (userId) headers.set('x-user-id', userId);

  const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

  const text = await res.text();
  let body: { error?: string; code?: string } | null = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      body?.error ||
        (text.trimStart().startsWith('<')
          ? 'The server returned a web page instead of a JSON response. Is the API server running?'
          : `Request failed with status ${res.status}`),
      res.status,
      body?.code
    );
  }

  if (body === null) {
    throw new ApiError(
      text.trimStart().startsWith('<')
        ? 'The server returned a web page instead of a JSON response. Is the API server running?'
        : 'The server returned an unreadable response.',
      res.status
    );
  }

  return body as T;
}

function persistSession(data: {
  user?: UserProfile;
  sessionToken?: string;
}): void {
  if (data.sessionToken) setStoredSessionToken(data.sessionToken);
  if (data.user?.id) setStoredUserId(data.user.id);
}

export interface SessionResponse {
  user: UserProfile;
  isPro: boolean;
  subscription: Subscription | null;
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
    return request<PublicConfig>('/api/config');
  },

  /**
   * Guarantees a valid signed session token before opening a signaling socket.
   */
  async ensureSessionToken(forceRefresh = false): Promise<string | null> {
    if (forceRefresh) clearStoredSessionToken();
    else {
      const existing = getStoredSessionToken();
      if (existing) return existing;
    }

    const data = await request<SessionResponse>('/api/auth/session');
    persistSession(data);
    return data.sessionToken || null;
  },

  async getSession(): Promise<SessionResponse> {
    const data = await request<SessionResponse>('/api/auth/session');
    persistSession(data);
    return data;
  },

  async login(payload: {
    displayName?: string;
    gender?: string;
    country?: string;
    isAdultVerified?: boolean;
  }): Promise<SessionResponse> {
    const data = await request<SessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSession(data);
    return data;
  },

  async loginWithGoogle(payload: {
    credential: string;
    termsVersion: string;
    ageConfirmed: boolean;
  }): Promise<SessionResponse> {
    const data = await request<SessionResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSession(data);
    return data;
  },

  async acceptLegal(payload: {
    termsVersion: string;
    ageConfirmed: boolean;
  }): Promise<SessionResponse & { acceptedAt: number }> {
    const data = await request<SessionResponse & { acceptedAt: number }>('/api/legal/accept', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSession(data);
    return data;
  },

  async getLegalStatus(): Promise<{
    currentVersion: string;
    acceptedVersion: string | null;
    needsAcceptance: boolean;
  }> {
    return request('/api/legal/status');
  },

  async updateProfile(payload: {
    displayName?: string;
    gender?: string;
    country?: string;
    isAdultVerified?: boolean;
  }): Promise<SessionResponse> {
    const data = await request<SessionResponse>('/api/profile/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSession(data);
    return data;
  },

  async getPlans(): Promise<{ plans: PlanInfo[] }> {
    return request('/api/subscription/plans');
  },

  async createSubscriptionOrder(): Promise<any> {
    return request('/api/subscription/create-order', { method: 'POST' });
  },

  async verifySubscriptionPayment(payload: {
    orderId: string;
  }): Promise<{ success: boolean; message: string; subscription: Subscription; isPro: boolean }> {
    return request('/api/subscription/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async adminLogin(adminKey: string): Promise<{ user: UserProfile; sessionToken: string; isPro: boolean }> {
    const data = await request<{ user: UserProfile; sessionToken: string; isPro: boolean }>(
      '/api/auth/admin-login',
      { method: 'POST', body: JSON.stringify({ adminKey }) }
    );
    if (data.sessionToken) setStoredSessionToken(data.sessionToken);
    return data;
  },

  async cancelSubscription(): Promise<{ success: boolean; message: string; subscription: Subscription }> {
    return request('/api/subscription/cancel', { method: 'POST' });
  },

  async submitReport(payload: {
    reportedUserId: string;
    reportedUserName?: string;
    category: string;
    description: string;
    sessionId?: string;
    turnstileToken?: string;
  }): Promise<{ success: boolean; message: string; reportId: string }> {
    return request('/api/safety/report', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async blockUser(blockedUserId: string): Promise<{ success: boolean }> {
    return request('/api/safety/block', {
      method: 'POST',
      body: JSON.stringify({ blockedUserId }),
    });
  },

  async unblockUser(blockedUserId: string): Promise<{ success: boolean }> {
    return request('/api/safety/unblock', {
      method: 'POST',
      body: JSON.stringify({ blockedUserId }),
    });
  },

  async getBlockedUsers(): Promise<{ blockedUserIds: string[] }> {
    return request('/api/safety/blocks');
  },

  async getIceServers(): Promise<{ iceServers: RTCIceServer[] }> {
    return request('/api/webrtc/ice-servers');
  },

  async getSystemHealth(): Promise<{
    status: string;
    uptimeSeconds: number;
    queueLength: number;
    activeMatches: number;
    turnConfigured: boolean;
  }> {
    return request('/api/system/health');
  },

  async getUserPreferences(): Promise<{ preferences: any; isPro: boolean }> {
    return request('/api/user/preferences');
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
  }): Promise<{ success: boolean; preferences: any; isPro: boolean }> {
    return request('/api/user/preferences', {
      method: 'POST',
      body: JSON.stringify(prefs),
    });
  },

  async resetUserPreferences(): Promise<{ success: boolean; preferences: any }> {
    return request('/api/user/preferences/reset', { method: 'POST' });
  },

  async getAdminOverview(): Promise<{
    totalUsers: number;
    activeQueueLength: number;
    activeMatchesCount: number;
    proSubscribers: number;
    monthlyRevenueInr: number;
    pendingReportsCount: number;
    totalReportsCount: number;
  }> {
    return request('/api/admin/overview');
  },

  async getAdminReports(): Promise<{ reports: UserReport[] }> {
    return request('/api/admin/reports');
  },

  async updateReportAction(
    reportId: string,
    payload: {
      status: 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'escalated';
      actionTaken?: 'none' | 'warned' | 'suspended' | 'banned';
      notes?: string;
    }
  ): Promise<{ success: boolean; report: UserReport }> {
    return request(`/api/admin/reports/${reportId}/action`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAdminUsers(): Promise<{ users: (UserProfile & { isPro: boolean })[] }> {
    return request('/api/admin/users');
  },

  async updateUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'banned'
  ): Promise<{ success: boolean; user: UserProfile }> {
    return request(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },
};

export async function ensureSessionToken(forceRefresh = false): Promise<string | null> {
  return api.ensureSessionToken(forceRefresh);
}
