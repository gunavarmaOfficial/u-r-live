import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { SafetyPage } from './pages/SafetyPage';
import { LegalPage } from './pages/LegalPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProUpgradeModal } from './components/ProUpgradeModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { ReportModal } from './components/ReportModal';
import { AppContext, PreferredGender, SessionStatus } from './context/AppContext';
import { useVisibility } from './hooks/useVisibility';
import { Subscription, UserProfile } from './types';
import {
  api,
  clearStoredSessionToken,
  clearStoredUserId,
  hasStoredSessionToken,
} from './services/api';

const LivePage = lazy(() => import('./pages/LivePage').then((module) => ({ default: module.LivePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));

const RouteFallback: React.FC = () => (
  <div className="flex flex-1 items-center justify-center p-12" role="status" aria-live="polite">
    <div className="relative flex h-12 w-12 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-2 border-white/10" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#8b5cf6] border-r-[#22d3ee]" />
    </div>
    <span className="sr-only">Loading</span>
  </div>
);

export default function App() {
  const location = useLocation();
  useVisibility();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [preferredGender, setPreferredGender] = useState<PreferredGender>('any');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  const sessionInFlight = useRef(false);

  const applySession = useCallback(
    (payload: { user: UserProfile; isPro?: boolean; subscription?: Subscription | null }) => {
      setUser(payload.user);
      setIsPro(Boolean(payload.isPro));
      setSubscription(payload.subscription ?? null);
      setSessionError(null);
    },
    []
  );

  const loadSession = useCallback(async () => {
    if (sessionInFlight.current) return;
    sessionInFlight.current = true;
    setSessionStatus('loading');
    setSessionError(null);
    try {
      const data = await api.getSession();
      applySession(data);
      setSessionStatus('ready');
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Could not reach the server.');
      setSessionStatus('error');
    } finally {
      sessionInFlight.current = false;
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    api
      .getPublicConfig()
      .then((config) => {
        if (!cancelled) {
          setGoogleClientId(config.googleClientId);
          setGoogleEnabled(Boolean(config.googleClientId));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleClientId(null);
          setGoogleEnabled(false);
        }
      });

    if (hasStoredSessionToken()) {
      void loadSession();
    }

    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  const openUpgrade = useCallback((reason?: string) => {
    setUpgradeReason(
      reason || 'Upgrade to U-R-LIVE Pro to unlock priority queue, country filters and verified badge.'
    );
    setIsUpgradeModalOpen(true);
  }, []);

  const updateUser = useCallback((next: UserProfile) => {
    setUser(next);
  }, []);

  const signOut = useCallback(() => {
    clearStoredSessionToken();
    clearStoredUserId();
    setUser(null);
    setIsPro(false);
    setSubscription(null);
    setSessionStatus('idle');
    setSessionError(null);
    if (window.location.pathname === '/live') {
      void loadSession();
    }
  }, [loadSession]);

  const isGoogleUser = user?.authProvider === 'google';
  const isLiveRoute = location.pathname === '/live';
  const showFooter = !isLiveRoute && location.pathname !== '/admin';

  const contextValue = React.useMemo(
    () => ({
      user,
      isPro,
      subscription,
      preferredGender,
      sessionStatus,
      sessionError,
      googleEnabled,
      isGoogleUser,
      loadSession,
      applySession,
      updateUser,
      setPreferredGender,
      signOut,
      openUpgrade,
      openSettings: () => setIsSettingsModalOpen(true),
      openGoogle: () => {
        if (googleEnabled) setIsGoogleModalOpen(true);
      },
      openReport: (userId: string, userName: string) => setReportTarget({ id: userId, name: userName }),
    }),
    [
      user,
      isPro,
      subscription,
      preferredGender,
      sessionStatus,
      sessionError,
      googleEnabled,
      isGoogleUser,
      loadSession,
      applySession,
      updateUser,
      signOut,
      openUpgrade,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div
        className={`relative flex flex-col bg-[#07060d] font-sans text-neutral-100 ${
          isLiveRoute ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
        }`}
      >
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-lg bg-white px-4 py-2 text-sm font-bold text-black focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
        >
          Skip to content
        </a>

        <Header />

        <main
          id="main-content"
          tabIndex={-1}
          className={`flex min-h-0 flex-1 flex-col outline-none ${
            isLiveRoute ? 'overflow-hidden' : 'overflow-visible'
          }`}
        >
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/safety" element={<SafetyPage />} />
              <Route path="/terms" element={<LegalPage slug="terms" />} />
              <Route path="/privacy" element={<LegalPage slug="privacy" />} />
              <Route path="/cookies" element={<LegalPage slug="cookies" />} />
              <Route path="/community-rules" element={<LegalPage slug="community-rules" />} />
              <Route path="/live" element={<LivePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>

        {showFooter && <Footer />}

        <GoogleAuthModal
          isOpen={isGoogleModalOpen}
          clientId={googleClientId}
          onClose={() => setIsGoogleModalOpen(false)}
          onSuccess={(googleUser, googleIsPro, googleSub) => {
            applySession({ user: googleUser, isPro: googleIsPro, subscription: googleSub });
            setSessionStatus('ready');
          }}
        />

        <ProUpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          onSuccess={(sub: Subscription) => {
            setSubscription(sub);
            setIsPro(true);
            if (upgradeReason.includes('Female')) setPreferredGender('female');
            else if (upgradeReason.includes('Male')) setPreferredGender('male');
          }}
          activeSubscription={subscription}
          upgradeReason={upgradeReason}
        />

        {reportTarget && (
          <ReportModal
            isOpen={true}
            reportedUserId={reportTarget.id}
            reportedUserName={reportTarget.name}
            onClose={() => setReportTarget(null)}
            onSubmitted={() => setReportTarget(null)}
          />
        )}

        {user && (
          <AccountSettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            user={user}
            isPro={isPro}
            subscription={subscription}
            onProfileUpdated={(updated, pro, sub) => {
              setUser(updated);
              setIsPro(pro);
              setSubscription(sub);
            }}
            onOpenUpgradeModal={() =>
              openUpgrade('Upgrade to U-R-LIVE Pro to unlock gender filters and priority queue.')
            }
            onOpenGoogleModal={() => {
              if (googleEnabled) setIsGoogleModalOpen(true);
            }}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}
