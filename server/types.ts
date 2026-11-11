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
  termsVersion?: string;
  termsAcceptedAt?: number;
  ageConfirmedAt?: number;
  createdAt: number;
  lastActiveAt: number;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  role: 'user' | 'admin';
  isGuest: boolean;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  lastActiveAt: number;
}

export type LegalConsentKind = 'terms' | 'age';

export interface LegalConsent {
  id: string;
  userId: string;
  kind: LegalConsentKind;
  version: string;
  acceptedAt: number;
  ipHash?: string;
  userAgentHash?: string;
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
  targetType: 'user' | 'report' | 'system';
  targetId: string;
  details?: Record<string, unknown>;
  createdAt: number;
}

// Signaling & Matchmaking Protocol
export interface MatchPreferences {
  mode?: ChatMode;
  preferredGender?: 'any' | 'male' | 'female';
  preferredCountry?: string; // e.g. "IN", "US", "GLOBAL"
  preferredCountries?: string[]; // multiple countries e.g. ["IN", "US"]
  isMultipleCountries?: boolean;
  interests?: string[];
  interestMatchingEnabled?: boolean;
  languages?: string[];
  preferredLanguages?: string[];
  primaryLanguage?: string;
}

export interface QueueEntry {
  userId: string;
  socketId: string;
  gender: UserGender;
  country: string;
  mode?: ChatMode;
  interests?: string[];
  languages?: string[];
  preferences: MatchPreferences;
  joinedAt: number;
  displayName?: string;
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
  | 'typing'
  | 'media_state'
  | 'skip_match'
  | 'match_ended'
  | 'peer_disconnected'
  | 'partner_disconnected'
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
