import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LandingView } from './components/LandingView';
import { VideoChatView } from './components/VideoChatView';
import { OnboardingView } from './components/OnboardingView';
import { SafetyCentreView } from './components/SafetyCentreView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AgeVerificationModal } from './components/AgeVerificationModal';
import { ReportModal } from './components/ReportModal';
import { ProUpgradeModal } from './components/ProUpgradeModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { UserProfile, Subscription, UserGender } from './types';
import { api } from './services/api';

export default function App() {
  // Navigation views: 'onboarding' is now a dedicated full-page screen!
  const [currentView, setCurrentView] = useState<'video' | 'safety' | 'admin' | 'landing' | 'onboarding'>('onboarding');
  const [user, setUser] = useState<UserProfile>(() => ({
    id: 'guest_' + Math.random().toString(36).substring(2, 10),
    displayName: 'Stranger ' + Math.floor(1000 + Math.random() * 9000),
    gender: 'unspecified',
    country: 'GLOBAL',
    isAdultVerified: false,
    role: 'user',
    status: 'active',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  }));
  
  const [isPro, setIsPro] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Preferred partner matching filter
  const [preferredGender, setPreferredGender] = useState<'any' | 'male' | 'female'>('any');

  // Modals (Checkout & Safety only, onboarding is on-page)
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string>('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Safety timeout: If server does not respond within 1.5s, continue with local guest user
    const timer = setTimeout(() => {
      setIsLoadingSession(false);
    }, 1500);

    api
      .getSession()
      .then((data) => {
        clearTimeout(timer);
        if (data.user) {
          setUser(data.user);
        }
        setIsPro(data.isPro);
        setSubscription(data.subscription);

        // If gender is unspecified or age verification is not completed, show onboarding directly on page!
        if (!data.user?.isAdultVerified || data.user?.gender === 'unspecified') {
          setCurrentView('onboarding');
        } else {
          setCurrentView('video');
        }
      })
      .catch((err) => {
        console.warn('Session loading fallback:', err);
        setCurrentView('onboarding');
      })
      .finally(() => {
        clearTimeout(timer);
        setIsLoadingSession(false);
      });

    return () => clearTimeout(timer);
  }, []);

  const handleStartChatClicked = () => {
    if (!user?.isAdultVerified || user?.gender === 'unspecified') {
      setCurrentView('onboarding');
    } else {
      setCurrentView('video');
    }
  };

  const handleOnboardingComplete = (gender: UserGender, prefGender: 'any' | 'male' | 'female') => {
    setPreferredGender(prefGender);
    if (user) {
      setUser({ ...user, gender, isAdultVerified: true });
    }
    // Smoothly transition straight into video chat on page!
    setCurrentView('video');
  };

  const handleAgeVerified = async () => {
    setIsAgeModalOpen(false);
    try {
      const res = await api.updateProfile({ isAdultVerified: true });
      setUser(res.user);
      setIsPro(res.isPro);
      setSubscription(res.subscription);
      setCurrentView('video');
    } catch (err) {
      console.error('Failed to update adult verification:', err);
      if (user) {
        setUser({ ...user, isAdultVerified: true });
      }
      setCurrentView('video');
    }
  };

  const handleProSuccess = (sub: Subscription) => {
    setSubscription(sub);
    setIsPro(true);
    // If the reason was female filter, automatically set female matching!
    if (upgradeReason.includes('Female')) {
      setPreferredGender('female');
    } else if (upgradeReason.includes('Male')) {
      setPreferredGender('male');
    }
  };

  const handleGoogleSuccess = (
    googleUser: UserProfile,
    googleIsPro: boolean,
    googleSub: Subscription | null
  ) => {
    setUser(googleUser);
    setIsPro(googleIsPro);
    setSubscription(googleSub);
    if (!googleUser.isAdultVerified || googleUser.gender === 'unspecified') {
      setCurrentView('onboarding');
    }
  };

  const handleLogout = async () => {
    try {
      const res = await api.login({
        role: 'user',
        displayName: 'Stranger ' + Math.floor(1000 + Math.random() * 9000),
      });
      setUser(res.user);
      setIsPro(res.isPro);
      setSubscription(res.subscription);
      setPreferredGender('any');
      setCurrentView('onboarding');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isGoogleUser = user?.authProvider === 'google';

  return (
    <div
      className={`flex flex-col bg-[#111215] text-neutral-100 font-sans ${
        currentView === 'video' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
      }`}
    >
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        user={user}
        isPro={isPro}
        onOpenUpgradeModal={() => {
          setUpgradeReason('Upgrade to U-R-LIVE Pro to unlock priority queue, location filter, and verified badge.');
          setIsUpgradeModalOpen(true);
        }}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        onOpenOnboarding={() => setCurrentView('onboarding')}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoadingSession ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-xs text-neutral-400 font-sans space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-emerald-500 animate-spin" />
            <p>Connecting to U-R-LIVE server...</p>
          </div>
        ) : (
          <>
            {/* 1. Dedicated On-Page Onboarding Screen (Step 1 Gender -> Step 2 Target Partner) */}
            {currentView === 'onboarding' && user && (
              <OnboardingView
                user={user}
                isPro={isPro}
                onComplete={handleOnboardingComplete}
                onOpenUpgradeModal={() => {
                  setUpgradeReason('Connecting with Female partners alone requires U-R-LIVE Pro (₹299/month).');
                  setIsUpgradeModalOpen(true);
                }}
              />
            )}

            {/* 2. Live Random Video Chat Screen */}
            {currentView === 'video' && user && (
              <VideoChatView
                user={user}
                isPro={isPro}
                preferredGender={preferredGender}
                onChangePreferredGender={(g) => setPreferredGender(g)}
                onOpenUpgradeModal={(reason) => {
                  setUpgradeReason(
                    reason || 'Connecting with Female partners alone requires U-R-LIVE Pro (₹299/month).'
                  );
                  setIsUpgradeModalOpen(true);
                }}
                onOpenReportModal={(partnerId, partnerName) => {
                  setReportTarget({ id: partnerId, name: partnerName });
                }}
                onRequireAgeVerification={() => setCurrentView('onboarding')}
                onOpenOnboarding={() => setCurrentView('onboarding')}
              />
            )}

            {/* 3. Safety Center */}
            {currentView === 'safety' && (
              <div className="flex-1 overflow-y-auto">
                <SafetyCentreView />
              </div>
            )}

            {/* 4. Admin Dashboard */}
            {currentView === 'admin' && (
              <div className="flex-1 overflow-y-auto">
                <AdminDashboardView />
              </div>
            )}

            {/* 5. Landing / About */}
            {currentView === 'landing' && (
              <div className="flex-1 overflow-y-auto">
                <LandingView
                  onStartChat={() => {
                    handleStartChatClicked();
                  }}
                  onOpenUpgradeModal={() => {
                    setUpgradeReason('Upgrade to U-R-LIVE Pro to unlock female matching and priority queue.');
                    setIsUpgradeModalOpen(true);
                  }}
                  onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
                  onNavigateToSafety={() => setCurrentView('safety')}
                  isPro={isPro}
                  isGoogleUser={isGoogleUser}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer only on non-video, non-onboarding scrollable pages */}
      {currentView !== 'video' && currentView !== 'onboarding' && (
        <Footer onNavigate={(view) => setCurrentView(view)} />
      )}

      {/* Google Authentication Modal */}
      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={handleGoogleSuccess}
      />

      {/* Age 18+ Verification Gate Modal (Fallback) */}
      <AgeVerificationModal
        isOpen={isAgeModalOpen}
        onConfirm={handleAgeVerified}
        onCancel={() => setIsAgeModalOpen(false)}
      />

      {/* Pro Upgrade ₹299/mo Modal */}
      <ProUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={handleProSuccess}
        activeSubscription={subscription}
        upgradeReason={upgradeReason}
      />

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={true}
          reportedUserId={reportTarget.id}
          reportedUserName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => setReportTarget(null)}
        />
      )}

      {/* Account Settings Modal */}
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
          onOpenUpgradeModal={() => {
            setUpgradeReason('Upgrade to U-R-LIVE Pro to unlock gender filters and priority queue.');
            setIsUpgradeModalOpen(true);
          }}
          onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
        />
      )}
    </div>
  );
}
