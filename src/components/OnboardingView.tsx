import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Shield02Icon,
  CameraVideoIcon,
  UserCheck01Icon,
  ZapIcon,
} from 'hugeicons-react';
import { UserProfile, UserGender } from '../types';
import { api } from '../services/api';
import { LEGAL } from '../legal/config';
import { Logo } from './Logo';
import {
  ThreeDMaleAvatar,
  ThreeDFemaleAvatar,
  ThreeDOtherAvatar,
  ThreeDGlobeIcon,
} from './ThreeDIcons';

interface OnboardingViewProps {
  user: UserProfile;
  onComplete: (gender: UserGender, preferredGender: 'any' | 'male' | 'female') => void;
}

const GENDER_OPTIONS: Array<{
  value: UserGender;
  title: string;
  subtitle: string;
  avatar: React.ComponentType<{ className?: string }>;
  selected: string;
  idle: string;
  glow: string;
}> = [
  {
    value: 'male',
    title: 'Male',
    subtitle: 'I am a guy',
    avatar: ThreeDMaleAvatar,
    selected: 'border-[#60a5fa]/70 bg-[#60a5fa]/10 ring-1 ring-[#60a5fa]/40',
    idle: 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]',
    glow: 'from-[#3b82f6]/25 to-[#60a5fa]/5 text-[#93c5fd]',
  },
  {
    value: 'female',
    title: 'Female',
    subtitle: 'I am a girl',
    avatar: ThreeDFemaleAvatar,
    selected: 'border-[#f472b6]/70 bg-[#f472b6]/10 ring-1 ring-[#f472b6]/40',
    idle: 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]',
    glow: 'from-[#f472b6]/25 to-[#8b5cf6]/5 text-[#f9a8d4]',
  },
  {
    value: 'non-binary',
    title: 'Other',
    subtitle: 'Non-binary',
    avatar: ThreeDOtherAvatar,
    selected: 'border-[#a78bfa]/70 bg-[#a78bfa]/10 ring-1 ring-[#a78bfa]/40',
    idle: 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]',
    glow: 'from-[#8b5cf6]/25 to-[#22d3ee]/5 text-[#c4b5fd]',
  },
];

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  user,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const initialGender: UserGender = user.gender !== 'unspecified' ? user.gender : 'male';
  const [selectedGender, setSelectedGender] = useState<UserGender>(initialGender);
  const [targetPreference, setTargetPreference] = useState<'any' | 'female' | 'male'>('any');
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(Boolean(user.ageConfirmedAt) || user.isAdultVerified);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(user.termsVersion === LEGAL.termsVersion);
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

  const handleFinishOnboarding = async () => {
    setError('');
    const effectivePref = targetPreference;

    if (!selectedGender || selectedGender === 'unspecified') {
      setCurrentStep(1);
      setError('Please select your gender first.');
      return;
    }

    if (!ageConfirmed) {
      setError('You must confirm you are at least 18 years old to enter U-R-LIVE.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsSaving(true);
    try {
      await api.acceptLegal({ termsVersion: LEGAL.termsVersion, ageConfirmed: true });
      await api.updateProfile({
        gender: selectedGender,
        isAdultVerified: true,
      });
      onComplete(selectedGender, effectivePref);
    } catch (err: any) {
      console.error('Failed to save onboarding profile:', err);
      setError(err.message || 'Failed to save your consent and settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#07060d] text-neutral-100 no-scrollbar">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -left-32 top-0 h-[440px] w-[440px] rounded-full bg-[#8b5cf6]/18 blur-[130px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-[#22d3ee]/10 blur-[130px]" />

      <div className="relative mx-auto grid w-full max-w-6xl items-start gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10">
        {/* ---------- Brand / context panel ---------- */}
        <aside className="hidden lg:sticky lg:top-8 lg:flex lg:flex-col lg:gap-6">
          <Logo size="lg" showText={false} />

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">Welcome to U-R-LIVE</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-4xl">
              Two quick choices.
              <br />
              <span className="text-gradient-brand">Then you are live.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-400">
              Your gender helps the matcher build fair, compatible pairs. Your preference
              decides who appears on the other side of the call.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                icon: UserCheck01Icon,
                title: 'Tell us who you are',
                body: 'Male, female or non-binary — this stays editable later.',
              },
              {
                icon: ZapIcon,
                title: 'Choose your match type',
                body: 'Anyone is instant. Gender filters are free for everyone.',
              },
              {
                icon: Shield02Icon,
                title: 'Confirm you are 18+',
                body: 'Adults only. Respectful conduct is enforced by moderators.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#8b5cf6]/25 bg-[#8b5cf6]/10 text-[#c4b5fd]">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-white">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <p className="text-[11px] leading-relaxed text-neutral-400">
              <span className="font-semibold text-emerald-300">Matchmaking is live.</span> The server pairs
              you with the next compatible adult as soon as one is available.
            </p>
          </div>
        </aside>

        {/* ---------- Wizard card ---------- */}
        <div className="w-full">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Logo size="sm" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-neutral-400">
              <Shield02Icon className="h-3 w-3 text-emerald-400" />
              18+ only
            </span>
          </div>

          <div className="surface-strong overflow-hidden rounded-3xl">
            {/* Stepper */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    currentStep === 1
                      ? 'bg-gradient-to-tr from-[#8b5cf6] to-[#22d3ee] text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.8)]'
                      : 'border border-[#8b5cf6]/30 bg-[#8b5cf6]/15 text-[#c4b5fd]'
                  }`}
                >
                  {currentStep > 1 ? <CheckmarkCircle01Icon className="h-4 w-4" /> : '1'}
                </span>
                <div className="leading-tight">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${currentStep === 1 ? 'text-white' : 'text-neutral-500'}`}>
                    Your gender
                  </p>
                  <p className="text-[10px] text-neutral-600">Step one</p>
                </div>
              </div>

              <div className="h-px flex-1 bg-white/[0.07]">
                <div
                  className={`h-px bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] transition-all duration-500 ${
                    currentStep >= 2 ? 'w-full' : 'w-0'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    currentStep === 2
                      ? 'bg-gradient-to-tr from-[#8b5cf6] to-[#22d3ee] text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.8)]'
                      : 'border border-white/[0.08] bg-white/[0.03] text-neutral-500'
                  }`}
                >
                  2
                </span>
                <div className="leading-tight">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${currentStep === 2 ? 'text-white' : 'text-neutral-500'}`}>
                    Your match
                  </p>
                  <p className="text-[10px] text-neutral-600">Step two</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              {/* ============ STEP 1 ============ */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#8b5cf6]/25 bg-[#8b5cf6]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">
                      <UserCheck01Icon className="h-3 w-3" />
                      Step 1 of 2
                    </div>
                    <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-[1.7rem]">
                      How do you identify?
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-400 sm:text-[13px]">
                      This helps U-R-LIVE build balanced, compatible pairs. You can change it
                      anytime from your account menu.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {GENDER_OPTIONS.map((option) => {
                      const Avatar = option.avatar;
                      const isSelected = selectedGender === option.value;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => {
                            setSelectedGender(option.value);
                            setError('');
                          }}
                          className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-all ${
                            isSelected ? option.selected : option.idle
                          }`}
                        >
                          <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-black/20">
                            {isSelected && <span className="h-2 w-2 rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#22d3ee]" />}
                          </span>
                          <span className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b ${option.glow} p-1.5`}>
                            <Avatar className="h-full w-full drop-shadow-md" />
                          </span>
                          <span>
                            <span className="block text-sm font-bold text-white">{option.title}</span>
                            <span className="mt-0.5 block text-[11px] text-neutral-500">{option.subtitle}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-3 text-xs text-rose-200">
                      <AlertCircleIcon className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleNextToStep2}
                    disabled={!selectedGender || selectedGender === 'unspecified'}
                    className="btn-primary h-12 w-full text-sm"
                  >
                    <span>Continue to match preference</span>
                    <ArrowRight01Icon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* ============ STEP 2 ============ */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleBackToStep1}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 transition-colors hover:text-white"
                      >
                        <ArrowLeft01Icon className="h-3.5 w-3.5" />
                        Back to gender
                      </button>
                    </div>

                    <div className="mb-2 mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#8b5cf6]/25 bg-[#8b5cf6]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">
                      <ZapIcon className="h-3 w-3" />
                      Step 2 of 2
                    </div>
                    <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-[1.7rem]">
                      Who should we match you with?
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-400 sm:text-[13px]">
                      Pick a partner category. "Anyone" gives you the fastest queue.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Anyone */}
                    <button
                      type="button"
                      onClick={() => handleSelectPreference('any')}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
                        targetPreference === 'any'
                          ? 'border-emerald-400/60 bg-emerald-400/[0.08] ring-1 ring-emerald-400/30'
                          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="flex items-center gap-3.5">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-1">
                          <ThreeDGlobeIcon className="h-full w-full" />
                        </span>
                        <span>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">Anyone</span>
                            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                              Fastest
                            </span>
                          </span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-neutral-400">
                            Meet all genders worldwide with zero wait preference.
                          </span>
                        </span>
                      </span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${targetPreference === 'any' ? 'border-emerald-400 bg-emerald-400 text-[#06110d]' : 'border-white/20'}`}>
                        {targetPreference === 'any' && <CheckmarkCircle01Icon className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {/* Female */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectPreference('female')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectPreference('female')}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        targetPreference === 'female'
                          ? 'border-[#f472b6]/60 bg-[#f472b6]/[0.07] ring-1 ring-[#f472b6]/30'
                          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f472b6]/25 bg-[#f472b6]/10 p-1">
                            <ThreeDFemaleAvatar className="h-full w-full" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-white">Female partners</span>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                              Connect exclusively with verified female adults.
                            </p>
                          </div>
                        </div>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${targetPreference === 'female' ? 'border-[#f472b6] bg-[#f472b6] text-[#1a0a12]' : 'border-white/20'}`}>
                          {targetPreference === 'female' && <CheckmarkCircle01Icon className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                    </div>

                    {/* Male */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectPreference('male')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectPreference('male')}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        targetPreference === 'male'
                          ? 'border-[#60a5fa]/60 bg-[#60a5fa]/[0.07] ring-1 ring-[#60a5fa]/30'
                          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#60a5fa]/25 bg-[#60a5fa]/10 p-1">
                            <ThreeDMaleAvatar className="h-full w-full" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-white">Male partners</span>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                              Connect exclusively with male adults worldwide.
                            </p>
                          </div>
                        </div>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${targetPreference === 'male' ? 'border-[#60a5fa] bg-[#60a5fa] text-[#0a1220]' : 'border-white/20'}`}>
                          {targetPreference === 'male' && <CheckmarkCircle01Icon className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
                      <input
                        type="checkbox"
                        checked={ageConfirmed}
                        onChange={(e) => {
                          setAgeConfirmed(e.target.checked);
                          setError('');
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-black/40 accent-[#8b5cf6]"
                      />
                      <span className="text-[11px] leading-relaxed text-neutral-400">
                        I certify that I am at least{' '}
                        <strong className="font-bold text-white">{LEGAL.minimumAge} years old</strong> and
                        understand that U-R-LIVE is an adults-only platform.
                      </span>
                    </label>

                    <label className="flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          setError('');
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-black/40 accent-[#8b5cf6]"
                      />
                      <span className="text-[11px] leading-relaxed text-neutral-400">
                        I agree to the{' '}
                        <Link
                          to="/terms"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#c4b5fd] underline decoration-[#c4b5fd]/40 underline-offset-2 hover:text-white"
                        >
                          Terms of Service
                        </Link>
                        ,{' '}
                        <Link
                          to="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#c4b5fd] underline decoration-[#c4b5fd]/40 underline-offset-2 hover:text-white"
                        >
                          Privacy Policy
                        </Link>{' '}
                        and{' '}
                        <Link
                          to="/community-rules"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#c4b5fd] underline decoration-[#c4b5fd]/40 underline-offset-2 hover:text-white"
                        >
                          Community Rules
                        </Link>
                        .
                      </span>
                    </label>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-3 text-xs text-rose-200">
                      <AlertCircleIcon className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleFinishOnboarding()}
                    disabled={!ageConfirmed || !acceptedTerms || isSaving}
                    className="btn-primary h-12 w-full text-sm"
                  >
                    <CameraVideoIcon className="h-4 w-4" />
                    <span>{isSaving ? 'Saving profile…' : 'Enter live video chat'}</span>
                    <ArrowRight01Icon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-neutral-500">
            <Shield02Icon className="h-3.5 w-3.5 text-neutral-600" />
            <span>Strictly 18+ · encrypted WebRTC · anonymous guest sessions</span>
          </div>
        </div>
      </div>
    </div>
  );
};
