import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingView } from '../components/LandingView';
import { Seo } from '../components/Seo';
import { useApp } from '../context/AppContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, googleEnabled, openGoogle, setChatMode } = useApp();

  return (
    <>
      <Seo path="/" />
      <LandingView
        onStartChat={(mode = 'video') => {
          setChatMode(mode);
          navigate('/live');
        }}
        onOpenGoogleModal={openGoogle}
        onNavigateToSafety={() => navigate('/safety')}
        isGoogleUser={user?.authProvider === 'google'}
        googleEnabled={googleEnabled}
      />
    </>
  );
};
