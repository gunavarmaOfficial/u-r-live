import React, { useEffect, useState } from 'react';
import {
  SparklesIcon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
  WebProtectionIcon,
  LockIcon,
  Cancel01Icon,
} from 'hugeicons-react';
import { api } from '../services/api';
import { Subscription } from '../types';
import { ModalShell } from './ModalShell';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sub: Subscription) => void;
  activeSubscription?: Subscription | null;
  upgradeReason?: string;
}

const REASON_COPY: Record<string, string> = {
  country_filter: 'Country matching is a Pro feature. Upgrade to meet people from specific places.',
  language_filter: 'Language matching is a Pro feature. Upgrade to be paired with speakers you understand.',
  country_filter_multiple: 'Selecting multiple countries is a Pro feature.',
  country_filter_banner: 'Unlock country and language filters with U-R-LIVE Pro.',
  gender_filter: 'Preferred gender matching is a Pro feature.',
};

const PRO_FEATURES = [
  'Preferred gender matching — male, female or anyone',
  'Country filters with multi-country selection',
  'Language filters across 20+ languages',
  'Priority placement in the matchmaking queue',
  '100% ad-free, uninterrupted video chat',
];

// The Cashfree SDK is ~100 KB of third-party JS; load it only when someone opens
// the Pro modal instead of blocking the landing page.
const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';
let cashfreeSdkPromise: Promise<void> | null = null;

function loadCashfreeSdk(): Promise<void> {
  if ((window as any).Cashfree) return Promise.resolve();
  if (!cashfreeSdkPromise) {
    cashfreeSdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CASHFREE_SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        cashfreeSdkPromise = null;
        script.remove();
        reject(new Error('Cashfree checkout could not be loaded. Please check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return cashfreeSdkPromise;
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeSubscription,
  upgradeReason,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void loadCashfreeSdk().catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartCheckout = async () => {
    setIsProcessing(true);
    setError('');

    try {
      await loadCashfreeSdk();
      const orderData = await api.createSubscriptionOrder();

      // If Cashfree JS SDK is available in window, launch official dropin modal
      const win = window as any;
      if (win.Cashfree && orderData.paymentSessionId) {
        const cashfreeMode = orderData.environment === 'PRODUCTION' ? 'production' : 'sandbox';
        const cashfree = win.Cashfree({ mode: cashfreeMode });
        cashfree
          .checkout({
            paymentSessionId: orderData.paymentSessionId,
            redirectTarget: '_modal',
          })
          .then(async (result: any) => {
            if (result.error) {
              setError(result.error.message || 'Payment was cancelled or could not be completed.');
              setIsProcessing(false);
              return;
            }

            try {
              const verificationResult = await api.verifySubscriptionPayment({
                orderId: orderData.orderId,
              });

              if (verificationResult.success) {
                onSuccess(verificationResult.subscription);
                onClose();
              } else {
                setError(verificationResult.message || 'Payment verification failed.');
              }
            } catch (verErr: any) {
              setError(verErr.message || 'Payment verification failed.');
            } finally {
              setIsProcessing(false);
            }
          });
        return;
      }

      setError('Cashfree checkout could not be loaded. Please ensure you are connected to the internet.');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Cashfree subscription checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsProcessing(true);
    setError('');
    try {
      await api.cancelSubscription();
      setCancelSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Could not cancel subscription');
      setIsProcessing(false);
    }
  };

  const isAlreadyPro = activeSubscription?.status === 'active';
  const reasonText = upgradeReason
    ? REASON_COPY[upgradeReason] || upgradeReason.replace(/_/g, ' ')
    : '';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="U-R-LIVE Pro"
      overlayClassName="z-[90]"
      panelClassName="max-w-md rounded-t-[28px] border border-white/10 bg-[#0b0914]/95 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:rounded-[28px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
      />

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-400/15 border border-violet-400/30 text-violet-200 shadow-[0_0_28px_-10px_rgba(139,92,246,0.9)]">
              <SparklesIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight">U-R-LIVE Pro</h2>
                <span className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white">
                  Pro
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/45">Unlock preferred matching</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            aria-label="Close"
          >
            <Cancel01Icon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {isAlreadyPro ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Active Pro subscription</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                    Active
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  ₹299 / month · renews on{' '}
                  <span className="font-semibold text-white/85">
                    {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </p>
                {activeSubscription.cancelAtPeriodEnd && (
                  <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                    Ends at the close of the current billing cycle.
                  </p>
                )}
              </div>

              {cancelSuccess ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-center text-xs font-medium text-emerald-200">
                  Renewal cancelled. Pro stays active until your cycle ends.
                </div>
              ) : !activeSubscription.cancelAtPeriodEnd ? (
                <button
                  onClick={handleCancelSubscription}
                  disabled={isProcessing}
                  className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 text-xs font-semibold text-rose-300 transition-colors hover:border-rose-400/30 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  {isProcessing ? 'Processing…' : 'Cancel renewal'}
                </button>
              ) : null}

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-1">
              {reasonText && (
                <div className="flex items-start gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/[0.08] p-3.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/20 text-violet-200">
                    <SparklesIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-300">
                      Unlock this feature
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/60">{reasonText}</p>
                  </div>
                </div>
              )}

              {/* Price */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.14] via-white/[0.03] to-cyan-400/[0.07] p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Monthly membership
                    </p>
                    <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-white">
                      ₹299
                      <span className="ml-1 text-sm font-semibold text-white/40">/mo</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-white/70">Billed monthly</p>
                    <p className="mt-0.5 text-[10px] text-white/40">Cancel anytime</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-xs text-white/75">
                    <CheckmarkCircle01Icon className="mt-px h-4 w-4 shrink-0 text-violet-300" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Compliance */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/65">
                  <WebProtectionIcon className="h-3.5 w-3.5 text-emerald-300" />
                  Cashfree recurring payments
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                  ₹299/month processed securely by Cashfree Payments. Cancel renewal anytime from
                  Account Settings before your billing cycle ends — access continues to the period end.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleStartCheckout}
                disabled={isProcessing}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-xs"
              >
                <LockIcon className="h-3.5 w-3.5" />
                <span>{isProcessing ? 'Processing payment…' : 'Continue to checkout · ₹299'}</span>
              </button>

              <p className="text-center text-[10px] text-white/30">
                Secure checkout via Cashfree · 18+ only
              </p>
            </div>
          )}
      </div>
    </ModalShell>
  );
};
