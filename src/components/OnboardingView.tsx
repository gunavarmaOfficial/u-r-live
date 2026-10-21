import React, { useState } from 'react';
import {
  SparklesIcon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  LockIcon,
  Shield02Icon,
} from 'hugeicons-react';
import { UserProfile, UserGender } from '../types';
import { api } from '../services/api';
import { Logo } from './Logo';
import {
  ThreeDMaleAvatar,
  ThreeDFemaleAvatar,
  ThreeDOtherAvatar,
  ThreeDGlobeIcon,
} from './ThreeDIcons';

interface OnboardingViewProps {
  user: UserProfile;
  isPro: boolean;
  onComplete: (gender: UserGender, preferredGender: 'any' | 'male' | 'female') => void;
  onOpenUpgradeModal: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  user,
  isPro,
  onComplete,
  onOpenUpgradeModal,
}) => {
  // Wizard steps on page: 1 = "Select Your Gender First", 2 = "Who Do You Want to Connect With?"
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const initialGender: UserGender = user.gender !== 'unspecified' ? user.gender : 'male';
  const [selectedGender, setSelectedGender] = useState<UserGender>(initialGender);
  const [targetPreference, setTargetPreference] = useState<'any' | 'female' | 'male'>('any');
  const [agreedAge, setAgreedAge] = useState<boolean>(user.isAdultVerified || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNextToStep2 = () => {
    if (!selectedGender || selectedGender === 'unspecified') {
      setError('Please select your gender to continue.');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleBackToStep1 = () => {
    setError('');
    setCurrentStep(1);
  };

  const handleSelectPreference = (pref: 'any' | 'female' | 'male') => {
    setError('');
    setTargetPreference(pref);
  };

  const handleFinishOnboarding = async (overridePreference?: 'any') => {
    setError('');
    const effectivePref = overridePreference || targetPreference;

    if (!selectedGender || selectedGender === 'unspecified') {
      setCurrentStep(1);
      setError('Please select your gender first.');
      return;
    }

    if (!agreedAge) {
      setError('You must confirm you are at least 18 years old to enter U-R-LIVE.');
      return;
    }

    if (effectivePref === 'female' && !isPro) {
      onOpenUpgradeModal();
      return;
    }

    setIsSaving(true);
    try {
      await api.updateProfile({
        gender: selectedGender,
        isAdultVerified: true,
      });
      onComplete(selectedGender, effectivePref);
    } catch (err: any) {
      console.error('Failed to save onboarding profile:', err);
      setError(err.message || 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 bg-[#0c0d10] text-neutral-100 overflow-y-auto no-scrollbar">
      <div className="w-full max-w-xl my-auto py-4 sm:py-8 space-y-6">
        {/* Onboarding Header with Progress Indicator */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <Logo size="md" showText={true} />
          </div>

          {/* Stepper Progress Badges */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center transition-all ${
                  currentStep === 1
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {currentStep > 1 ? '✓' : '1'}
              </span>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  currentStep === 1 ? 'text-white' : 'text-emerald-400'
                }`}
              >
                Your Gender
              </span>
            </div>

            <div
              className={`w-10 sm:w-16 h-0.5 rounded-full transition-all duration-300 ${
                currentStep >= 2 ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}
            />

            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center transition-all ${
                  currentStep === 2
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                2
              </span>
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  currentStep === 2 ? 'text-white' : 'text-neutral-500'
                }`}
              >
                Match Preference
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PAGE SCREEN 1: "Select Your Gender First"                */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="bg-[#141519] border border-neutral-800/90 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-98 duration-200">
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Step 1 of 2
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                Select Your Gender First
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Choose your gender to begin random matchmaking with people around the world.
              </p>
            </div>

            {/* Gender Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Male Option Card */}
              <div
                onClick={() => {
                  setSelectedGender('male');
                  setError('');
                }}
                className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 ${
                  selectedGender === 'male'
                    ? 'border-emerald-500 bg-emerald-500/15 text-white ring-2 ring-emerald-500/50 shadow-xl shadow-emerald-500/10'
                    : 'border-neutral-800 bg-[#191a20] text-neutral-300 hover:border-neutral-700 hover:bg-[#1f2027]'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-900/10 border border-blue-500/30 flex items-center justify-center shrink-0 p-1 shadow-lg shadow-blue-500/10">
                  <ThreeDMaleAvatar className="w-full h-full drop-shadow-md" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Male</h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">I am a guy</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    selectedGender === 'male'
                      ? 'border-emerald-500 bg-emerald-500 text-black'
                      : 'border-neutral-700'
                  }`}
                >
                  {selectedGender === 'male' && <CheckmarkCircle01Icon className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Female Option Card */}
              <div
                onClick={() => {
                  setSelectedGender('female');
                  setError('');
                }}
                className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 ${
                  selectedGender === 'female'
                    ? 'border-pink-500 bg-pink-500/15 text-white ring-2 ring-pink-500/50 shadow-xl shadow-pink-500/10'
                    : 'border-neutral-800 bg-[#191a20] text-neutral-300 hover:border-neutral-700 hover:bg-[#1f2027]'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-pink-500/20 to-pink-900/10 border border-pink-500/30 flex items-center justify-center shrink-0 p-1 shadow-lg shadow-pink-500/10">
                  <ThreeDFemaleAvatar className="w-full h-full drop-shadow-md" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Female</h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">I am a girl</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    selectedGender === 'female'
                      ? 'border-pink-500 bg-pink-500 text-white'
                      : 'border-neutral-700'
                  }`}
                >
                  {selectedGender === 'female' && <CheckmarkCircle01Icon className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Other / Non-Binary Option Card */}
              <div
                onClick={() => {
                  setSelectedGender('non-binary');
                  setError('');
                }}
                className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 ${
                  selectedGender === 'non-binary'
                    ? 'border-purple-500 bg-purple-500/15 text-white ring-2 ring-purple-500/50 shadow-xl shadow-purple-500/10'
                    : 'border-neutral-800 bg-[#191a20] text-neutral-300 hover:border-neutral-700 hover:bg-[#1f2027]'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-purple-500/20 to-purple-900/10 border border-purple-500/30 flex items-center justify-center shrink-0 p-1 shadow-lg shadow-purple-500/10">
                  <ThreeDOtherAvatar className="w-full h-full drop-shadow-md" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Other</h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">Non-binary</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    selectedGender === 'non-binary'
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-neutral-700'
                  }`}
                >
                  {selectedGender === 'non-binary' && <CheckmarkCircle01Icon className="w-3.5 h-3.5" />}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                <AlertCircleIcon className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Next Screen Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleNextToStep2}
                disabled={!selectedGender || selectedGender === 'unspecified'}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Next: Who Do You Want to Connect With?</span>
                <ArrowRight01Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE SCREEN 2: "Who Do You Want to Connect With?"        */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="bg-[#141519] border border-neutral-800/90 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-98 duration-200">
            {/* Header with Back Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBackToStep1}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white transition-colors"
                >
                  <ArrowLeft01Icon className="w-3.5 h-3.5" />
                  <span>Back to Gender Selection</span>
                </button>

                {isPro && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3 text-amber-400" />
                    <span>PRO ACTIVE</span>
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Step 2 of 2
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                  Who Do You Want to Connect With?
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Select your preferred partner category for random matchmaking.
                </p>
              </div>
            </div>

            {/* Target Partner Selection Cards */}
            {/* Target Partner Selection Cards */}
            <div className="space-y-3">
              {/* Option 1: Anyone (Free) */}
              <div
                onClick={() => handleSelectPreference('any')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  targetPreference === 'any'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white ring-2 ring-emerald-500/50 shadow-md'
                    : 'border-neutral-800 bg-[#191a20] text-neutral-300 hover:border-neutral-700 hover:bg-[#1f2027]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-emerald-950/20 border border-emerald-500/30 flex items-center justify-center shrink-0 p-1 shadow-lg shadow-emerald-500/10">
                    <ThreeDGlobeIcon className="w-full h-full drop-shadow-md" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-white">
                        Anyone (All Genders)
                      </span>
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full">
                        FREE & FASTEST
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Connect instantly with friendly strangers worldwide with zero wait time.
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                    targetPreference === 'any'
                      ? 'border-emerald-500 bg-emerald-500 text-black'
                      : 'border-neutral-700'
                  }`}
                >
                  {targetPreference === 'any' && <CheckmarkCircle01Icon className="w-3.5 h-3.5" />}
                </div>
              </div>

              {/* Option 2: Female Alone (PRO) */}
              <div
                onClick={() => handleSelectPreference('female')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  targetPreference === 'female'
                    ? 'border-pink-500 bg-pink-500/10 text-white ring-2 ring-pink-500/50 shadow-md'
                    : 'border-neutral-800 bg-[#191a20] text-neutral-300 hover:border-neutral-700 hover:bg-[#1f2027]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-pink-500/20 to-pink-950/20 border border-pink-500/30 flex items-center justify-center shrink-0 p-1 shadow-lg shadow-pink-500/10">
                      <ThreeDFemaleAvatar className="w-full h-full drop-shadow-md" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm sm:text-base text-white">
                          Female Alone / Girls Only
                        </span>
                        <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-pink-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <SparklesIcon className="w-3 h-3" />
                          <span>PRO PLAN ₹299</span>
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Connect exclusively with verified female partners worldwide.
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                      targetPreference === 'female'
                        ? 'border-pink-500 bg-pink-500 text-white'
                        : 'border-neutral-700'
                    }`}
                  >
                    {targetPreference === 'female' && <CheckmarkCircle01Icon className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Upgrade to Pro button directly inside this card itself */}
                {!isPro && (
                  <div className="mt-3 pt-3 border-t border-pink-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <p className="text-[11px] text-pink-200/90 leading-tight">
                      ⭐ Exclusive Pro filter for 1-on-1 female matching
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUpgradeModal();
                      }}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wide shadow-md shadow-pink-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                    >
                      <LockIcon className="w-3.5 h-3.5" />
                      <span>Upgrade to Pro Plan (₹299)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Option 3: Male Alone (PRO) */}
              <div
                onClick={() => handleSelectPreference('male')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  targetPreference === 'male'
                    ? 'border-blue-500 bg-blue-500/10 text-white ring-2 ring-blue-500/50 shadow-md'
                    : 'border-neutral-800 bg-[#191a20] text-neutral-300 hover:border-neutral-700 hover:bg-[#1f2027]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-950/20 border border-blue-500/30 flex items-center justify-center shrink-0 p-1 shadow-lg shadow-blue-500/10">
                      <ThreeDMaleAvatar className="w-full h-full drop-shadow-md" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm sm:text-base text-white">
                          Male Alone / Guys Only
                        </span>
                        <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-blue-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <SparklesIcon className="w-3 h-3" />
                          <span>PRO PLAN ₹299</span>
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Connect exclusively with male partners worldwide.
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                      targetPreference === 'male'
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-neutral-700'
                    }`}
                  >
                    {targetPreference === 'male' && <CheckmarkCircle01Icon className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Upgrade to Pro button directly inside this card itself */}
                {!isPro && (
                  <div className="mt-3 pt-3 border-t border-blue-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <p className="text-[11px] text-blue-200/90 leading-tight">
                      ⭐ Exclusive Pro filter for 1-on-1 male matching
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUpgradeModal();
                      }}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-blue-600 hover:from-amber-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wide shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                    >
                      <LockIcon className="w-3.5 h-3.5" />
                      <span>Upgrade to Pro Plan (₹299)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 18+ Verification Checkbox */}
            <div className="p-4 rounded-2xl bg-[#191a20] border border-neutral-800 text-xs space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedAge}
                  onChange={(e) => setAgreedAge(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                />
                <span className="text-neutral-300 text-xs leading-relaxed">
                  I certify that I am at least <strong className="text-white">18 years of age</strong> and agree to lawful, respectful conduct (strict ban on nudity, harassment, and unauthorized recordings).
                </span>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                <AlertCircleIcon className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Single Clean Action Button for Screen 2 */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleFinishOnboarding()}
                disabled={!agreedAge || isSaving}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <span>{isSaving ? 'Saving Profile...' : 'Start Random Video Chat'}</span>
                <ArrowRight01Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Safety Note */}
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
          <Shield02Icon className="w-3.5 h-3.5 text-neutral-400" />
          <span>Strictly 18+ · End-to-end encrypted WebRTC · Anonymous & Secure</span>
        </div>
      </div>
    </div>
  );
};
