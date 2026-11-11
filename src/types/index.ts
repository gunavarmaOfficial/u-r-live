export type UserGender = 'unspecified' | 'male' | 'female' | 'non-binary';

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
  termsVersion?: string;
  termsAcceptedAt?: number;
  ageConfirmedAt?: number;
  createdAt: number;
  lastActiveAt: number;
}

export type ChatMode = 'video' | 'text';

export interface MatchPreferences {
  mode?: ChatMode;
  preferredGender: 'any' | 'male' | 'female';
  preferredCountry: string;
  preferredCountries?: string[];
  isMultipleCountries?: boolean;
  interests?: string[];
  interestMatchingEnabled?: boolean;
  languages?: string[];
  preferredLanguages?: string[];
  primaryLanguage?: string;
}

export type WebRTCState =
  | 'idle'
  | 'requesting_permissions'
  | 'camera_unavailable'
  | 'waiting_for_match'
  | 'match_found'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'remote_disconnected'
  | 'local_disconnected'
  | 'match_skipped'
  | 'failed';

export interface ChatMessage {
  id: string;
  senderId: string;
  isLocal: boolean;
  text: string;
  timestamp: number;
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
