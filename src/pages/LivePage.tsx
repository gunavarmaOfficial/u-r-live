import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshIcon } from 'hugeicons-react';
import { OnboardingView } from '../components/OnboardingView';
import { VideoChatView } from '../components/VideoChatView';
import { Seo } from '../components/Seo';
import { useApp } from '../context/AppContext';
import { LEGAL } from '../legal/config';
import { UserGender } from '../types';

const LiveSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-12" role="status" aria-live="polite">
    <div className="relative flex h-14 w-14 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-2 border-white/10" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#8b5cf6] border-r-[#22d3ee]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-[#f472b6]" />
    </div>
    <p className="text-xs font-medium text-neutral-500">{label}</p>
  </div>
);

export const LivePage: React.FC = () => {
  const {
    user,
    preferredGender,
    sessionStatus,
    sessionError,
    loadSession,
    updateUser,
    setPreferredGender,
    openReport,
  } = useApp();
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStatus === 'idle') {
      void loadSession();
    }
  }, [sessionStatus, loadSession]);

  const needsOnboarding =
    !user ||
    !user.isAdultVerified ||
    user.gender === 'unspecified' ||
    user.termsVersion !== LEGAL.termsVersion;

  if (sessionStatus === 'error') {
    return (
      <>
        <Seo path="/live" />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7 text-center">
            <h1 className="font-display text-xl font-bold text-white">Can’t start a live session</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {sessionError || 'The server could not be reached. Check your connection and try again.'}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button type="button" onClick={() => void loadSession()} className="btn-primary h-11 w-full text-xs font-bold">
                <RefreshIcon className="h-4 w-4" />
                Try again
              </button>
              <Link to="/" className="btn-secondary h-11 w-full text-xs font-bold">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Seo path="/live" />
        <LiveSkeleton label="Starting a secure guest session…" />
      </>
    );
  }

  if (forceOnboarding || needsOnboarding) {
    return (
      <>
        <Seo path="/live" />
        <OnboardingView
          user={user}
          onComplete={(gender: UserGender, pref: 'any' | 'male' | 'female') => {
            updateUser({
              ...user,
              gender,
              isAdultVerified: true,
              termsVersion: LEGAL.termsVersion,
              termsAcceptedAt: Date.now(),
              ageConfirmedAt: Date.now(),
            });
            setPreferredGender(pref);
            setForceOnboarding(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Seo path="/live" />
      <VideoChatView
        user={user}
        preferredGender={preferredGender}
        onChangePreferredGender={setPreferredGender}
        onOpenReportModal={(partnerId, partnerName) => openReport(partnerId, partnerName)}
        onRequireAgeVerification={() => setForceOnboarding(true)}
        onOpenOnboarding={() => setForceOnboarding(true)}
        onUserUpdated={updateUser}
        onOpenSafetyCentre={() => navigate('/safety')}
      />
    </>
  );
};
