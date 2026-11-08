import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingView } from '../components/LandingView';
import { Seo } from '../components/Seo';
import { useApp } from '../context/AppContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isPro, user, googleEnabled, openUpgrade, openGoogle } = useApp();

  return (
    <>
      <Seo path="/" />
      <LandingView
        onStartChat={() => navigate('/live')}
        onOpenUpgradeModal={() =>
          openUpgrade('Upgrade to U-R-LIVE Pro to unlock gender, country and language filters.')
        }
        onOpenGoogleModal={openGoogle}
        onNavigateToSafety={() => navigate('/safety')}
        isPro={isPro}
        isGoogleUser={user?.authProvider === 'google'}
        googleEnabled={googleEnabled}
      />
    </>
  );
};
