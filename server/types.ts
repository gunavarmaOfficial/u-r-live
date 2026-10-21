/**
 * Server domain models and signaling types for U-R-LIVE
 */
import { InterestId, LanguageCode } from './interests_languages';

export type UserGender = 'unspecified' | 'male' | 'female' | 'non-binary';
export type ChatMode = 'video' | 'text';

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  googleId?: string;
  authProvider?: 'guest' | 'google';
  gender: UserGender;
  country: string;
  isAdultVerified: boolean;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  allowFriendRequests?: boolean;
  createdAt: number;
  lastActiveAt: number;
}

export type SubscriptionPlan = 'free' | 'pro';

export interface Subscription {
  id: string;
  userId: string;
  provider: 'cashfree';
  providerCustomerId: string;
  providerSubscriptionId: string;
  planCode: 'pro_monthly_299';
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PaymentEvent {
  id: string;
  provider: 'cashfree';
  providerEventId: string;
  eventType: string;
  processingStatus: 'processed' | 'ignored' | 'failed';
  receivedAt: number;
  payload: Record<string, unknown>;
}

export type ReportCategory =
  | 'harassment'
  | 'suspected_underage'
  | 'sexual_misconduct'
  | 'threats_abuse'
  | 'scam_spam'
  | 'non_consensual'
  | 'other';

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  category: ReportCategory;
  description: string;
  sessionId?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'escalated';
  createdAt: number;
  resolvedAt?: number;
  actionTaken?: 'none' | 'warned' | 'suspended' | 'banned';
  moderatorNotes?: string;
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  resolvedAt?: number;
}

export interface FriendConnection {
  id: string;
  userA: string;
  userB: string;
  createdAt: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  category: 'conversations' | 'starters' | 'games' | 'interests' | 'languages';
  points: number;
}

export interface UserStreakProgress {
  userId: string;
  currentDate: string; // YYYY-MM-DD UTC
  counts: Record<string, number>; // challengeId -> current count
  claimed: string[]; // challengeId[]
  streakDays: number;
  lastActiveDate: string;
  totalPoints: number;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  targetType: 'user' | 'report' | 'subscription' | 'system';
  targetId: string;
  details?: Record<string, unknown>;
  createdAt: number;
}

// Signaling & Matchmaking Protocol
export interface MatchPreferences {
  mode?: ChatMode;
  preferredGender?: 'any' | 'male' | 'female';
  preferredCountry?: string; // e.g. "IN", "US", "GLOBAL"
  interests?: string[];
  interestMatchingEnabled?: boolean;
  strictInterests?: boolean; // Pro only
  languages?: string[];
  primaryLanguage?: string;
  strictLanguage?: boolean; // Pro only
  priorityQueue?: boolean; // Pro only
}

export interface QueueEntry {
  userId: string;
  socketId: string;
  gender: UserGender;
  country: string;
  isPro: boolean;
  mode?: ChatMode;
  interests?: string[];
  languages?: string[];
  preferences: MatchPreferences;
  joinedAt: number;
}

export interface ActiveMatch {
  matchId: string;
  mode?: ChatMode;
  user1: { userId: string; socketId: string };
  user2: { userId: string; socketId: string };
  sharedInterests?: string[];
  sharedLanguages?: string[];
  createdAt: number;
}

export interface ActiveGameSession {
  matchId: string;
  questionId: string;
  type: 'would_you_rather' | 'this_or_that';
  question: string;
  optionA: string;
  optionB: string;
  answers: Record<string, string>; // userId -> 'optionA' | 'optionB'
  status: 'waiting' | 'revealed';
  startedAt: number;
}

export type SignalingMessageType =
  | 'join_queue'
  | 'leave_queue'
  | 'queue_status'
  | 'match_found'
  | 'offer'
  | 'answer'
  | 'ice_candidate'
  | 'chat_message'
  | 'skip_match'
  | 'match_ended'
  | 'peer_disconnected'
  | 'conversation_starter'
  | 'game_start'
  | 'game_answer'
  | 'game_result'
  | 'game_close'
  | 'friend_request_send'
  | 'friend_request_received'
  | 'friend_request_respond'
  | 'friend_request_result'
  | 'reconnect_request'
  | 'reconnect_incoming'
  | 'reconnect_response'
  | 'error'
  | 'ping'
  | 'pong';

export interface SignalingMessage {
  type: SignalingMessageType;
  matchId?: string;
  targetUserId?: string;
  payload?: any;
}
