import { UserProfile, Subscription, PlanInfo, UserReport } from '../types';

const STORAGE_USER_ID_KEY = 'omelive_session_user_id';

export function getStoredUserId(): string | null {
  return localStorage.getItem(STORAGE_USER_ID_KEY);
}

export function setStoredUserId(id: string): void {
  localStorage.setItem(STORAGE_USER_ID_KEY, id);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const userId = getStoredUserId();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (userId) {
    headers.set('x-user-id', userId);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  async getSession(): Promise<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }> {
    const data = await request<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }>(
      '/api/auth/session'
    );
    if (data.user?.id) {
      setStoredUserId(data.user.id);
    }
    return data;
  },

  async login(payload: {
    role?: 'user' | 'admin';
    displayName?: string;
    gender?: string;
    country?: string;
    isAdultVerified?: boolean;
  }): Promise<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }> {
    const data = await request<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (data.user?.id) {
      setStoredUserId(data.user.id);
    }
    return data;
  },

  async loginWithGoogle(payload: {
    email: string;
    name: string;
    avatarUrl?: string;
    googleId?: string;
  }): Promise<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }> {
    const data = await request<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (data.user?.id) {
      setStoredUserId(data.user.id);
    }
    return data;
  },

  async updateProfile(payload: {
    displayName?: string;
    gender?: string;
    country?: string;
    isAdultVerified?: boolean;
  }): Promise<{ user: UserProfile; isPro: boolean; subscription: Subscription | null }> {
    return request('/api/profile/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getPlans(): Promise<{ plans: PlanInfo[] }> {
    return request('/api/subscription/plans');
  },

  async createSubscriptionOrder(): Promise<any> {
    return request('/api/subscription/create-order', {
      method: 'POST',
    });
  },

  async verifySubscriptionPayment(payload: {
    orderId?: string;
    subscriptionId?: string;
    paymentId?: string;
    referenceId?: string;
    signature?: string;
    isMockTest?: boolean;
  }): Promise<{ success: boolean; message: string; subscription: Subscription; isPro: boolean }> {
    return request('/api/subscription/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelSubscription(): Promise<{ success: boolean; message: string; subscription: Subscription }> {
    return request('/api/subscription/cancel', {
      method: 'POST',
    });
  },

  async submitReport(payload: {
    reportedUserId: string;
    reportedUserName?: string;
    category: string;
    description: string;
    sessionId?: string;
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

  // Admin endpoints
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
