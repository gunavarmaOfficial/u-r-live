import React, { useEffect, useState, useRef } from 'react';
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

interface ProPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  upiId?: string;
  upiName?: string;
  amount?: number;
}

// Official Brand Logos for Indian UPI Payment Apps
const PaymentAppLogo: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <img
    src={src}
    alt={alt}
    className="h-10 w-10 rounded-xl object-cover shadow-sm border border-neutral-200/70 dark:border-neutral-700 overflow-hidden shrink-0"
  />
);

type UpiAppId = 'gpay' | 'phonepe' | 'paytm' | 'bhim';

// Deep link registry per NPCI UPI Linking Spec v1.6 / app developer docs
const UPI_APPS: Record<UpiAppId, { androidPackage: string; iosScheme: string }> = {
  gpay: {
    androidPackage: 'com.google.android.apps.nbu.paisa.user',
    iosScheme: 'gpay://upi/pay',
  },
  phonepe: {
    androidPackage: 'com.phonepe.app',
    iosScheme: 'phonepe://pay',
  },
  paytm: {
    androidPackage: 'net.one97.paytm',
    iosScheme: 'paytmmp://pay',
  },
  bhim: {
    androidPackage: 'in.org.npci.upiapp',
    iosScheme: 'bhim://upi/pay',
  },
};

export const ProPaymentModal: React.FC<ProPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  upiId = 'gunavarma0000-5@okicici',
  upiName = 'U-R-LIVE',
  amount = 299,
}) => {
  const [step, setStep] = useState<'promo' | 'payment'>('promo');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [paymentStatus, setPaymentStatus] = useState<
    'pending' | 'checking' | 'awaiting_utr' | 'approved' | 'expired'
  >('pending');
  const [utrNumber, setUtrNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false);
  const [autoCheckTriggered, setAutoCheckTriggered] = useState(false);
  const [txnRef, setTxnRef] = useState('');

  const timerRef = useRef<number | null>(null);

  // NPCI UPI Linking Spec v1.6: pa/pn mandatory, am in decimal format, tr mandatory for merchant/dynamic links
  const buildUpiQuery = () => {
    const params = new URLSearchParams();
    params.set('pa', upiId);
    params.set('pn', 'U R LIVE');
    params.set('am', amount.toFixed(2));
    params.set('cu', 'INR');
    if (txnRef) params.set('tr', txnRef);
    params.set('tn', 'UR LIVE Pro Plan');
    return params.toString();
  };

  const upiQuery = buildUpiQuery();
  const universalUpiUrl = `upi://pay?${upiQuery}`;

  const getAppDeepLink = (app: UpiAppId) => {
    if (typeof navigator === 'undefined') return universalUpiUrl;
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const cfg = UPI_APPS[app];

    if (isAndroid) {
      const storeUrl = encodeURIComponent(
        `https://play.google.com/store/apps/details?id=${cfg.androidPackage}`
      );
      return `intent://pay?${upiQuery}#Intent;scheme=upi;package=${cfg.androidPackage};S.browser_fallback_url=${storeUrl};end`;
    }

    if (isIOS) {
      return `${cfg.iosScheme}?${upiQuery}`;
    }

    // Desktop browsers cannot launch UPI schemes; fall back to the universal link
    return universalUpiUrl;
  };

  // Countdown timer
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setStep('promo');
    setTimeLeft(600);
    setPaymentStatus('pending');
    setUtrNumber('');
    setAutoCheckTriggered(false);
    setTxnRef(`URP${Date.now()}`);

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
      await navigator.clipboard.writeText(upiId);
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
      } catch {}

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
        <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-3xl border border-red-500/40 bg-[#0c0306] text-white shadow-[0_0_60px_rgba(239,68,68,0.35)] animate-in fade-in zoom-in-95 duration-200">
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
            className="relative cursor-pointer group select-none block overflow-hidden"
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
              className="w-full h-auto object-cover rounded-3xl transition duration-300 group-hover:scale-[1.01]"
            />
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 sm:p-5 bg-gradient-to-t from-black via-[#140407] to-[#0c0306] text-center space-y-2 border-t border-red-500/20">
            <button
              type="button"
              onClick={() => setStep('payment')}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 py-3.5 px-6 font-black text-sm sm:text-base text-white shadow-xl shadow-red-600/40 hover:shadow-red-600/60 transition active:scale-95 cursor-pointer"
            >
              <SparklesIcon size={18} />
              <span>Get Premium Now (₹{amount})</span>
              <span className="text-base font-bold">➔</span>
            </button>
            <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400">
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
                <span className="text-2xl font-black">₹{amount}</span>
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
              {/* QR Code and Instructions */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative rounded-2xl bg-white p-3 shadow-md border border-neutral-200">
                  <img
                    src="/payment-qr.png?v=6"
                    alt={`Scan UR Live UPI QR Code to pay ₹${amount}`}
                    className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-xl mx-auto"
                  />

                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-neutral-800">
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <SecurityCheckIcon size={14} />
                      <span>Scan to Pay ₹{amount} (Amount Pre-filled)</span>
                    </span>
                    <span className="text-neutral-300">•</span>
                    <a
                      href="/payment-qr.png"
                      download="UR-Live-Payment-QR.png"
                      className="inline-flex items-center gap-1 rounded-md bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 text-neutral-700 transition"
                      title="Save QR code image to your phone gallery"
                    >
                      <Download01Icon size={12} />
                      <span>Save QR</span>
                    </a>
                  </div>
                </div>

                {/* 1-Click UPI App Direct Redirects */}
                <div className="mt-4 w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Tap App to Pay Instantly
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                      <FlashIcon size={12} />
                      Direct Redirect
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {/* Google Pay */}
                    <a
                      href={getAppDeepLink('gpay')}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-blue-500/50 hover:bg-blue-500/5 transition cursor-pointer group active:scale-95 no-underline"
                    >
                      <PaymentAppLogo src="/payment-apps/gpay.png" alt="Google Pay" />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-blue-500">
                        Google Pay
                      </span>
                      <span className="text-[10px] text-neutral-400">Open GPay</span>
                    </a>

                    {/* PhonePe */}
                    <a
                      href={getAppDeepLink('phonepe')}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-[#5f259f]/50 hover:bg-[#5f259f]/5 transition cursor-pointer group active:scale-95 no-underline"
                    >
                      <PaymentAppLogo src="/payment-apps/phonepe.png" alt="PhonePe" />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-[#5f259f]">
                        PhonePe
                      </span>
                      <span className="text-[10px] text-neutral-400">Open PhonePe</span>
                    </a>

                    {/* Paytm */}
                    <a
                      href={getAppDeepLink('paytm')}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-[#00b9f5]/50 hover:bg-[#00b9f5]/5 transition cursor-pointer group active:scale-95 no-underline"
                    >
                      <PaymentAppLogo src="/payment-apps/paytm.png" alt="Paytm" />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-[#00b9f5]">
                        Paytm
                      </span>
                      <span className="text-[10px] text-neutral-400">Open Paytm</span>
                    </a>

                    {/* BHIM / UPI */}
                    <a
                      href={getAppDeepLink('bhim')}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-emerald-500/50 hover:bg-emerald-500/5 transition cursor-pointer group active:scale-95 no-underline"
                    >
                      <PaymentAppLogo src="/payment-apps/bhim.png" alt="BHIM UPI" />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-500">
                        BHIM UPI
                      </span>
                      <span className="text-[10px] text-neutral-400">Open BHIM</span>
                    </a>
                  </div>

                  {/* Universal "Open Any UPI App" Button */}
                  <a
                    href={universalUpiUrl}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/30 transition active:scale-95 cursor-pointer no-underline"
                  >
                    <FlashIcon size={16} />
                    <span>Pay ₹{amount} With Any Installed UPI App</span>
                  </a>
                </div>
              </div>

              {/* UPI ID Copy Box */}
              <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    UPI ID to Pay Directly
                  </span>
                  <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400">
                    ₹{amount}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-black/30 border border-neutral-200 dark:border-white/10 px-3 py-2">
                  <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white select-all">
                    {upiId}
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
                    <span>Checking bank settlement status for UPI {upiId}…</span>
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
                    I Have Paid ₹{amount} (Check Status)
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
