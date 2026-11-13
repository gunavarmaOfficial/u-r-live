import { describe, it, expect, beforeEach } from 'vitest';

// Provide browser storage polyfill for Vitest Node runner
class MockStorage implements Storage {
  private store: Record<string, string> = {};
  get length(): number {
    return Object.keys(this.store).length;
  }
  clear(): void {
    this.store = {};
  }
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  (globalThis as any).localStorage = new MockStorage();
}
if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage.clear !== 'function') {
  (globalThis as any).sessionStorage = new MockStorage();
}

import { api, getStoredUserId, getStoredSessionToken } from './api';

describe('Zero-Backend In-Browser Storage & P2P API', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initializes a guest session instantly in browser without requiring a backend server', async () => {
    const session = await api.getSession();
    expect(session).toBeDefined();
    expect(session.user).toBeDefined();
    expect(session.user.id).toMatch(/^guest_/);
    expect(session.user.isAdultVerified).toBe(true);
    expect(session.sessionToken).toBeDefined();
    expect(getStoredUserId()).toBe(session.user.id);
    expect(getStoredSessionToken()).toBe(session.sessionToken);
  });

  it('guarantees session token immediately with zero network delay', async () => {
    const token = await api.ensureSessionToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token!.length).toBeGreaterThan(0);
  });

  it('returns standard public Google and Cloudflare STUN servers without backend dependency', async () => {
    const { iceServers } = await api.getIceServers();
    expect(Array.isArray(iceServers)).toBe(true);
    expect(iceServers.length).toBeGreaterThan(0);
    const urls = iceServers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
    expect(urls.some((u) => u.includes('google.com'))).toBe(true);
  });

  it('blocks and unblocks users purely in client browser without database storage', async () => {
    const userToBlock = 'stranger_bad_actor_99';
    await api.blockUser(userToBlock);
    const { blockedUserIds } = await api.getBlockedUsers();
    expect(blockedUserIds).toContain(userToBlock);

    await api.unblockUser(userToBlock);
    const afterUnblock = await api.getBlockedUsers();
    expect(afterUnblock.blockedUserIds).not.toContain(userToBlock);
  });

  it('submits reports and immediately records client-side peer block', async () => {
    const abuser = 'abuser_123';
    const reportRes = await api.submitReport({
      reportedUserId: abuser,
      category: 'inappropriate_behavior',
      description: 'Violation',
    });
    expect(reportRes.success).toBe(true);
    const { blockedUserIds } = await api.getBlockedUsers();
    expect(blockedUserIds).toContain(abuser);
  });
});
