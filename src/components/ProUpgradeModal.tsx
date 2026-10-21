import React, { useState } from 'react';
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

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sub: Subscription) => void;
  activeSubscription?: Subscription | null;
  upgradeReason?: string;
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

  if (!isOpen) return null;

  const handleStartCheckout = async () => {
    setIsProcessing(true);
    setError('');

    try {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#161618] p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-full bg-[#FF385C]/15 text-[#FF385C]">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">U-R-LIVE Pro</h2>
              <p className="text-xs text-neutral-400">Unlock Preferred Matching</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <Cancel01Icon className="w-4 h-4" />
          </button>
        </div>

        {isAlreadyPro ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Active Pro Subscription</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-neutral-300">
                Plan: ₹299/month · Renews on{' '}
                {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              {activeSubscription.cancelAtPeriodEnd && (
                <p className="text-xs text-amber-400">
                  Scheduled to expire at the end of the current billing cycle.
                </p>
              )}
            </div>

            {cancelSuccess ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs rounded-2xl text-center">
                Subscription renewal cancelled successfully.
              </div>
            ) : !activeSubscription.cancelAtPeriodEnd ? (
              <button
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                className="w-full py-3 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-rose-300 transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Cancel Subscription Renewal'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {upgradeReason && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-500/15 to-neutral-900 border border-amber-500/40 flex items-center gap-3 text-xs animate-in fade-in duration-150">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
                  <SparklesIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-white">Exclusive Filter Feature</p>
                  <p className="text-neutral-300 text-[11px] mt-0.5">{upgradeReason}</p>
                </div>
              </div>
            )}

            {/* Price Presentation (Airbnb Style) */}
            <div className="p-5 rounded-2xl bg-[#0F0F11] border border-neutral-800 flex items-baseline justify-between">
              <div>
                <p className="text-xs text-neutral-400 font-medium">Monthly Membership</p>
                <p className="text-3xl font-extrabold text-white font-mono mt-0.5">₹299</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-300 font-semibold">Billed monthly</span>
                <p className="text-[11px] text-neutral-500">Cancel anytime</p>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3 text-xs text-neutral-200">
              <div className="flex items-center gap-2.5">
                <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                <span>Preferred Gender Matching (Male / Female filter)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                <span>Country Location Filter (India, US, UK, Global)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                <span>Priority placement in matchmaking queue</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                <span>100% Ad-Free experience</span>
              </div>
            </div>

            {/* Compliance notice */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                <WebProtectionIcon className="w-3.5 h-3.5 text-[#FF385C]" />
                <span>Cashfree Payments Recurring Compliance</span>
              </div>
              <p>
                Recurring subscription of ₹299/month processed securely via Cashfree Payments. You can cancel renewal anytime in Account Settings before the end of your billing cycle.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                <AlertCircleIcon className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleStartCheckout}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] hover:from-[#E00B41] hover:to-[#D70438] disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-[#FF385C]/30 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <LockIcon className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Processing Cashfree Payment...' : 'Proceed to Checkout with Cashfree (₹299)'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
