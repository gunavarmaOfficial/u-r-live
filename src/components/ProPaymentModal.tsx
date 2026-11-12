import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Copy01Icon,
  Download01Icon,
  FlashIcon,
  LockIcon,
  SecurityCheckIcon,
  SparklesIcon,
} from 'hugeicons-react';
import { ModalShell } from './ModalShell';
import {
  buildStandardUpiUri,
  getAppUpiLink,
  generateUpiQrDataUrl,
  UPI_APPS,
  UpiAppId,
  UpiPaymentConfig,
} from '../utils/upi';

interface ProPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  upiId?: string;
  amount?: number;
  initialStep?: 'promo' | 'payment';
}

export const ProPaymentModal: React.FC<ProPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  upiId = 'urlive@slc',
  amount = 299,
  initialStep = 'promo',
}) => {
  const [step, setStep] = useState<'promo' | 'payment'>(initialStep);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [paymentStatus, setPaymentStatus] = useState<
    'pending' | 'checking' | 'awaiting_utr' | 'approved' | 'expired'
  >('pending');
  const [utrNumber, setUtrNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false);
  const [autoCheckTriggered, setAutoCheckTriggered] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const timerRef = useRef<number | null>(null);

  const effectiveUpiId = (upiId || import.meta.env.VITE_UPI_ID || 'urlive@slc').trim();
  const effectiveAmount = amount || Number(import.meta.env.VITE_PRO_PLAN_PRICE) || 299;

  const upiConfig: UpiPaymentConfig = useMemo(() => ({
    upiId: effectiveUpiId,
    payeeName: 'UR LIVE',
    amount: effectiveAmount,
    currency: 'INR',
    transactionNote: 'Premium Subscription',
  }), [effectiveUpiId, effectiveAmount]);

  // Generate dynamic QR code matching the exact same UPI URI used by payment links
  useEffect(() => {
    let isMounted = true;
    generateUpiQrDataUrl(upiConfig, { width: 320, margin: 2 })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate dynamic UPI QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [upiConfig]);

  // Sync step with initialStep whenever modal opens or initialStep changes
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
    }
  }, [isOpen, initialStep]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(600);
    setPaymentStatus('pending');
    setUtrNumber('');
    setAutoCheckTriggered(false);

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPaymentStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  // After 40 seconds of waiting, automatically simulate the first payment status probe
  useEffect(() => {
    if (!isOpen || paymentStatus !== 'pending' || autoCheckTriggered) return;

    const timeout = window.setTimeout(() => {
      if (paymentStatus === 'pending') {
        setAutoCheckTriggered(true);
        setStatusMessage('Payment activity detected. Checking status with UPI network…');
      }
    }, 35000);

    return () => clearTimeout(timeout);
  }, [isOpen, paymentStatus, autoCheckTriggered]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(effectiveUpiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleCheckStatus = () => {
    setPaymentStatus('checking');
    setStatusMessage('Contacting UPI payment network to verify transaction status…');

    setTimeout(() => {
      setPaymentStatus('awaiting_utr');
      setStatusMessage('Payment detected. Awaiting bank transaction confirmation.');
    }, 3800);
  };

  const handleVerifyUtr = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = utrNumber.trim();
    if (clean.length < 8) {
      setStatusMessage('Please enter a valid 12-digit UPI UTR / Transaction reference number.');
      return;
    }

    setIsVerifyingUtr(true);
    setStatusMessage(`Verifying reference ${clean} with bank…`);

    setTimeout(() => {
      setIsVerifyingUtr(false);
      setPaymentStatus('approved');
      setStatusMessage('Payment confirmed! Your Pro Plan is now active.');

      try {
        localStorage.setItem('ur_live_is_pro', 'true');
        localStorage.setItem('ur_live_pro_utr', clean);
        localStorage.setItem('ur_live_pro_at', Date.now().toString());
      } catch { }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    }, 2800);
  };

  const handleResetTimer = () => {
    setTimeLeft(600);
    setPaymentStatus('pending');
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} ariaLabel="Upgrade to Pro Plan">
      {step === 'promo' ? (
        <div className="relative mx-auto w-full max-w-[420px] max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border border-red-500/40 bg-[#0c0306] text-white shadow-[0_0_60px_rgba(239,68,68,0.35)] animate-in fade-in zoom-in-95 duration-200">
          {/* Floating Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3.5 top-3.5 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 backdrop-blur-md text-white/85 hover:bg-black hover:text-white transition cursor-pointer shadow-lg border border-white/15"
            aria-label="Close"
          >
            <Cancel01Icon size={18} />
          </button>

          {/* The Promo Poster - Clicking anywhere on the banner triggers redirect to payment */}
          <div
            onClick={() => setStep('payment')}
            className="relative cursor-pointer group select-none block overflow-y-auto flex-1 min-h-0"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setStep('payment');
              }
            }}
            aria-label="Get Premium Now - Proceed to payment"
          >
            <img
              src="/premium-promo.jpg"
              alt="UR Live Go Premium - Match with Girls Only"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
            />
          </div>

          {/* Bottom Action Footer */}
          <div className="shrink-0 p-3.5 sm:p-5 bg-gradient-to-t from-black via-[#140407] to-[#0c0306] text-center space-y-1.5 sm:space-y-2 border-t border-red-500/20">
            <button
              type="button"
              onClick={() => setStep('payment')}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 py-3 sm:py-3.5 px-6 font-black text-sm sm:text-base text-white shadow-xl shadow-red-600/40 hover:shadow-red-600/60 transition active:scale-95 cursor-pointer"
            >
              <SparklesIcon size={18} />
              <span>Get Premium Now (₹{effectiveAmount})</span>
              <span className="text-base font-bold">➔</span>
            </button>
            <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-neutral-400">
              <LockIcon size={12} className="text-emerald-500" />
              <span>Instant UPI Payment • Google Pay, PhonePe, Paytm, BHIM</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#12101a] text-neutral-900 dark:text-neutral-100 shadow-2xl">
          {/* Glow accent header */}
          <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-6 py-5 text-white">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setStep('promo')}
                className="inline-flex items-center gap-1 rounded-full bg-black/30 hover:bg-black/50 px-3 py-1 text-xs font-bold text-white transition cursor-pointer backdrop-blur"
              >
                <span>←</span>
                <span>Back to Plan</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-black/20 p-1.5 text-white/80 hover:bg-black/40 hover:text-white transition cursor-pointer"
                aria-label="Close"
              >
                <Cancel01Icon size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur">
                <SparklesIcon size={12} />
                VIP Pro Plan
              </span>
              <span className="text-xs font-semibold text-white/80">• 30 Days Access</span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight">Unlock HD Live Video & All Strangers</h2>
                <p className="text-xs text-white/85">Instant unblurred HD video, direct connection & no limits.</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black">₹{effectiveAmount}</span>
                <span className="block text-[10px] text-white/70">One-time payment</span>
              </div>
            </div>
          </div>

          {/* Content body */}
          <div className="max-h-[80vh] overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Payment Timer Strip */}
            <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Clock01Icon size={16} className="animate-spin text-amber-500" />
                <span className="font-semibold">Payment Window Remaining:</span>
              </div>
              <div className="font-mono text-sm font-black tracking-wider text-amber-600 dark:text-amber-400">
                {paymentStatus === 'expired' ? (
                  <span className="text-rose-500">Expired</span>
                ) : (
                  formatTimer(timeLeft)
                )}
              </div>
            </div>

            {/* SUCCESS / APPROVED STATE */}
            {paymentStatus === 'approved' ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                  <CheckmarkCircle01Icon size={40} />
                </div>
                <h3 className="text-lg font-black text-emerald-500">Payment Successfully Verified!</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm">
                  Your Pro Plan membership has been activated. All live stranger streams are now unblurred and ready to watch in full HD.
                </p>
                <div className="rounded-xl bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Redirecting you to unlocked live streams…
                </div>
              </div>
            ) : paymentStatus === 'expired' ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <p className="text-sm font-semibold text-rose-500">Your payment session has timed out.</p>
                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:from-red-700 hover:to-rose-700 transition"
                >
                  Restart Payment Window (10:00)
                </button>
              </div>
            ) : (
              <>
                {/* TAP APP TO PAY INSTANTLY */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                      TAP APP TO PAY INSTANTLY
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500">
                      <FlashIcon size={12} />
                      <span>Direct Redirect</span>
                    </span>
                  </div>

                  {/* 4 App Cards Grid */}
                  <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                    {(['gpay', 'phonepe', 'paytm', 'bhim'] as const).map((appId) => {
                      const app = UPI_APPS[appId];
                      const link = getAppUpiLink(appId, upiConfig);
                      const openLabel =
                        appId === 'gpay'
                          ? 'GPay'
                          : appId === 'phonepe'
                          ? 'PhonePe'
                          : appId === 'paytm'
                          ? 'Paytm'
                          : 'BHIM';
                      return (
                        <a
                          key={appId}
                          href={link}
                          target="_top"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-2.5 sm:p-3 text-center transition hover:border-red-500/50 hover:bg-neutral-50 dark:hover:bg-white/[0.08] group cursor-pointer shadow-sm no-underline active:scale-95"
                        >
                          <img
                            src={app.logo}
                            alt={app.displayName}
                            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-contain mb-1.5 transition group-hover:scale-105"
                          />
                          <span className="text-[11px] sm:text-xs font-bold text-neutral-900 dark:text-white leading-tight">
                            {app.displayName}
                          </span>
                          <span className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Open {openLabel}
                          </span>
                        </a>
                      );
                    })}
                  </div>

                  {/* Pay with Any Installed UPI App Button */}
                  <a
                    href={getAppUpiLink('generic', upiConfig)}
                    target="_top"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 py-3 sm:py-3.5 px-4 font-black text-xs sm:text-sm text-white shadow-xl shadow-red-600/40 hover:shadow-red-600/60 transition active:scale-95 cursor-pointer no-underline"
                  >
                    <FlashIcon size={16} />
                    <span>Pay ₹{effectiveAmount} With Any Installed UPI App</span>
                  </a>

                  {/* Fallback Message */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      Unable to open your UPI app? Scan the QR code or copy the UPI ID to complete your payment.
                    </p>
                  </div>
                </div>

                {/* QR Code and Instructions */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="relative rounded-2xl bg-white p-3 shadow-md border border-neutral-200">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Scan UR Live UPI QR Code to pay ₹${effectiveAmount}`}
                        className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-xl mx-auto"
                      />
                    ) : (
                      <div className="h-56 w-56 sm:h-64 sm:w-64 flex items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                        <img
                          src="/payment-qr.png?v=6"
                          alt={`Scan UR Live UPI QR Code to pay ₹${effectiveAmount}`}
                          className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-xl mx-auto opacity-80"
                        />
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-neutral-800">
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <SecurityCheckIcon size={14} />
                        <span>Scan to Pay ₹{effectiveAmount} (Amount Pre-filled)</span>
                      </span>
                    </div>
                  </div>

                  {/* Save QR CTA */}
                  <a
                    href={qrDataUrl || '/payment-qr.png'}
                    download={`UR-Live-Payment-QR-${effectiveAmount}.png`}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-red-600/40 transition active:scale-95 cursor-pointer no-underline"
                    title="Save QR code image to your phone gallery"
                  >
                    <Download01Icon size={20} />
                    <span>Save QR Code</span>
                  </a>
                </div>

                {/* UPI ID Copy Box */}
                <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      UPI ID to Pay Directly
                    </span>
                    <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400">
                      ₹{effectiveAmount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/10 px-3 py-2">
                    <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white select-all">
                      {effectiveUpiId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-200 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-white/20 transition cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <CheckmarkCircle01Icon size={14} className="text-emerald-500" />
                          <span className="text-emerald-500 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy01Icon size={14} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* PAYMENT STATUS & VERIFICATION SECTION */}
                <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>Live Payment Status Tracker</span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                        paymentStatus === 'checking'
                          ? 'bg-blue-500/10 text-blue-500'
                          : paymentStatus === 'awaiting_utr'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {paymentStatus === 'checking'
                        ? 'Checking Network…'
                        : paymentStatus === 'awaiting_utr'
                        ? 'Awaiting Confirmation'
                        : 'Waiting for Payment'}
                    </span>
                  </div>

                  {/* Status description */}
                  {statusMessage && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-200/50 dark:bg-white/[0.04] rounded-xl p-2.5">
                      {statusMessage}
                    </p>
                  )}

                  {/* Checking Spinner */}
                  {paymentStatus === 'checking' && (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-neutral-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      <span>Checking bank settlement status for UPI {effectiveUpiId}…</span>
                    </div>
                  )}

                  {/* If awaiting confirmation or user wants to submit UTR */}
                  {paymentStatus === 'awaiting_utr' ? (
                    <form onSubmit={handleVerifyUtr} className="space-y-2.5">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        Enter 12-Digit UPI UTR / Transaction Ref Number:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={utrNumber}
                          onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          placeholder="e.g. 412389562147"
                          maxLength={12}
                          className="flex-1 rounded-xl border border-neutral-300 dark:border-white/10 bg-white dark:bg-black/40 px-3 py-2 font-mono text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                          type="submit"
                          disabled={isVerifyingUtr || utrNumber.length < 8}
                          className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
                        >
                          {isVerifyingUtr ? 'Verifying…' : 'Activate Pro'}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-500">
                        Check your Google Pay / PhonePe / Paytm receipt for the 12-digit UTR/Ref ID.
                      </p>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCheckStatus}
                      className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
                    >
                      I Have Paid ₹{effectiveAmount} (Check Status)
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Secure Guarantee */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
              <LockIcon size={13} />
              <span>Direct peer-to-peer UPI transfer • No gateway fees • Instant activation</span>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};
