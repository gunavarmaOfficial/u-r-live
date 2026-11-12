import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingView } from '../components/LandingView';
import { Seo } from '../components/Seo';
import { useApp } from '../context/AppContext';
import { ProPaymentModal } from '../components/ProPaymentModal';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, googleEnabled, openGoogle, setChatMode } = useApp();
  const [showProModal, setShowProModal] = useState(false);
  const [proModalStep, setProModalStep] = useState<'promo' | 'payment'>('promo');
  const [isPro, setIsPro] = useState(() => {
    try {
      return localStorage.getItem('ur_live_is_pro') === 'true';
    } catch {
      return false;
    }
  });

  // Entrance popup: Open the promo popup when user enters the site
  useEffect(() => {
    if (!isPro) {
      const timer = setTimeout(() => {
        setProModalStep('promo');
        setShowProModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPro]);

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

      <ProPaymentModal
        isOpen={showProModal}
        initialStep={proModalStep}
        onClose={() => setShowProModal(false)}
        onSuccess={() => {
          setIsPro(true);
        }}
        upiId="gunavarma0000-5@okicici"
        amount={299}
      />
    </>
  );
};
