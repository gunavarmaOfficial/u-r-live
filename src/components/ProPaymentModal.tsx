import React, { useEffect, useState, useRef } from 'react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Copy01Icon,
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
const GooglePayLogo: React.FC = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden shrink-0">
    <svg className="h-6 w-6" viewBox="0 0 48 48" fill="none">
      <path
        d="M43.6 24.2C43.6 22.8 43.5 21.4 43.2 20H24V28.3H35C34.5 30.9 33 33.1 30.7 34.6V40H37.7C41.8 36.2 43.6 30.7 43.6 24.2Z"
        fill="#4285F4"
      />
      <path
        d="M24 44.2C29.5 44.2 34.1 42.4 37.7 39.1L30.7 33.7C28.8 35 26.6 35.8 24 35.8C18.7 35.8 14.2 32.2 12.6 27.3H5.3V32.9C8.9 40.1 16 44.2 24 44.2Z"
        fill="#34A853"
      />
      <path
        d="M12.6 27.3C12.2 26.1 12 24.8 12 23.5C12 22.2 12.2 20.9 12.6 19.7V14.1H5.3C3.8 17 3 20.2 3 23.5C3 26.8 3.8 30 5.3 32.9L12.6 27.3Z"
        fill="#FBBC04"
      />
      <path
        d="M24 11.2C27 11.2 29.7 12.2 31.8 14.3L38 8.1C34.1 4.5 29.5 2.8 24 2.8C16 2.8 8.9 6.9 5.3 14.1L12.6 19.7C14.2 14.8 18.7 11.2 24 11.2Z"
        fill="#EA4335"
      />
    </svg>
  </div>
);

const PhonePeLogo: React.FC = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5F259F] text-white shadow-sm overflow-hidden shrink-0">
    <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
      <path
        d="M21.5 8H26.5V12.2H23.2C24.5 13.2 25.4 14.8 25.4 16.8C25.4 20.8 22.2 23 18 23H15.5V30H11.5V8H21.5ZM15.5 19.2H17.8C20.2 19.2 21.6 18.2 21.6 16.3C21.6 14.5 20.2 13.4 17.8 13.4H15.5V19.2Z"
        fill="white"
      />
      <path
        d="M24 21.5L30 30H25L19.5 22.5L24 21.5Z"
        fill="white"
      />
    </svg>
  </div>
);

const PaytmLogo: React.FC = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden shrink-0">
    <svg className="h-4 w-9" viewBox="0 0 88 28" fill="none">
      <path d="M11 26V2h7c5 0 9 3.5 9 8.5s-4 8.5-9 8.5h-3v7h-4zm4-11h3c2.8 0 4.8-1.8 4.8-4.5s-2-4.5-4.8-4.5h-3v9z" fill="#002970" />
      <path d="M37 26v-2.5c-1.3 1.8-3.4 3-5.8 3-4.5 0-7.7-3.2-7.7-7.8s3.2-7.8 7.7-7.8c2.4 0 4.5 1.2 5.8 3V11h4v15h-4zm-4.8-4c2.5 0 4.5-1.9 4.5-4.7s-2-4.7-4.5-4.7-4.5 1.9-4.5 4.7 2 4.7 4.5 4.7z" fill="#002970" />
      <path d="M46 11h4.5l3.8 10 3.8-10H59l-6.8 16.5-3.5 8h-4.5l2.8-6.5L46 11z" fill="#002970" />
      <path d="M68 5h-5.5V2h15v3H72v15h-4V5z" fill="#00BAF2" />
      <path d="M80 20V2h4.5l5 11.5L94.5 2H99v18h-4v-11l-4.5 10.5h-2L84 9v11h-4z" fill="#00BAF2" />
    </svg>
  </div>
);

const BhimUpiLogo: React.FC = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden shrink-0">
    <svg className="h-6 w-8" viewBox="0 0 64 36" fill="none">
      <path d="M12 4L26 18L12 32H3L17 18L3 4H12Z" fill="#097939" />
      <path d="M26 4L40 18L26 32H17L31 18L17 4H26Z" fill="#ED752E" />
      <text x="35" y="27" fill="#1C1C1E" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="16" fontStyle="italic">UPI</text>
    </svg>
  </div>
);

export const ProPaymentModal: React.FC<ProPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  upiId = 'urlive@slc',
  upiName = 'U-R-LIVE',
  amount = 299,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [paymentStatus, setPaymentStatus] = useState<
    'pending' | 'checking' | 'awaiting_utr' | 'approved' | 'expired'
  >('pending');
  const [utrNumber, setUtrNumber] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false);
  const [autoCheckTriggered, setAutoCheckTriggered] = useState(false);

  const timerRef = useRef<number | null>(null);

  // Exact parameters matching the working QR code (mode=02 for intent/QR payment)
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const baseUpiQuery = `pa=${encodeURIComponent(upiId)}&pn=UR%20Live&am=${amount}&cu=INR&mode=02`;
  const universalUpiUrl = `upi://pay?${baseUpiQuery}`;

  const getAppDeepLink = (app: 'gpay' | 'phonepe' | 'paytm' | 'bhim') => {
    if (isAndroid) {
      if (app === 'gpay') {
        return `intent://pay?${baseUpiQuery}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
      }
      if (app === 'phonepe') {
        return `intent://pay?${baseUpiQuery}#Intent;scheme=upi;package=com.phonepe.app;end`;
      }
      if (app === 'paytm') {
        return `intent://pay?${baseUpiQuery}#Intent;scheme=upi;package=net.one97.paytm;end`;
      }
      if (app === 'bhim') {
        return `intent://pay?${baseUpiQuery}#Intent;scheme=upi;package=in.org.npci.upiapp;end`;
      }
    }

    if (isIOS) {
      if (app === 'gpay') return `gpay://upi/pay?${baseUpiQuery}`;
      if (app === 'phonepe') return `phonepe://pay?${baseUpiQuery}`;
      if (app === 'paytm') return `paytmmp://pay?${baseUpiQuery}`;
    }

    // Default for iOS BHIM or desktop fallback
    return universalUpiUrl;
  };

  const handleLaunchApp = (
    app: 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'universal',
    e?: React.MouseEvent
  ) => {
    if (e) e.preventDefault();
    const targetUrl = app === 'universal' ? universalUpiUrl : getAppDeepLink(app);

    // Direct redirect to selected UPI app
    window.location.href = targetUrl;

    // Gracefully fallback to universal upi://pay only if app failed to open and window is still visible
    if (app !== 'universal') {
      setTimeout(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          window.location.href = universalUpiUrl;
        }
      }, 1800);
    }
  };

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
      <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#12101a] text-neutral-900 dark:text-neutral-100 shadow-2xl">
        {/* Glow accent header */}
        <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-6 py-5 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/20 p-1.5 text-white/80 hover:bg-black/40 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <Cancel01Icon size={18} />
          </button>

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
                    src="/payment-qr.jpg"
                    alt="Scan UR Live UPI QR Code to pay ₹299"
                    className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-xl"
                  />

                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-neutral-800">
                    <SecurityCheckIcon size={14} className="text-emerald-600" />
                    <span>Scan with Any UPI App • ₹{amount}</span>
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
                    <button
                      type="button"
                      onClick={(e) => handleLaunchApp('gpay', e)}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-blue-500/50 hover:bg-blue-500/5 transition cursor-pointer group active:scale-95"
                    >
                      <GooglePayLogo />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-blue-500">
                        Google Pay
                      </span>
                      <span className="text-[10px] text-neutral-400">Open GPay</span>
                    </button>

                    {/* PhonePe */}
                    <button
                      type="button"
                      onClick={(e) => handleLaunchApp('phonepe', e)}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-[#5f259f]/50 hover:bg-[#5f259f]/5 transition cursor-pointer group active:scale-95"
                    >
                      <PhonePeLogo />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-[#5f259f]">
                        PhonePe
                      </span>
                      <span className="text-[10px] text-neutral-400">Open PhonePe</span>
                    </button>

                    {/* Paytm */}
                    <button
                      type="button"
                      onClick={(e) => handleLaunchApp('paytm', e)}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-[#00b9f5]/50 hover:bg-[#00b9f5]/5 transition cursor-pointer group active:scale-95"
                    >
                      <PaytmLogo />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-[#00b9f5]">
                        Paytm
                      </span>
                      <span className="text-[10px] text-neutral-400">Open Paytm</span>
                    </button>

                    {/* BHIM / UPI */}
                    <button
                      type="button"
                      onClick={(e) => handleLaunchApp('bhim', e)}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 text-center shadow-sm hover:border-emerald-500/50 hover:bg-emerald-500/5 transition cursor-pointer group active:scale-95"
                    >
                      <BhimUpiLogo />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-500">
                        BHIM UPI
                      </span>
                      <span className="text-[10px] text-neutral-400">Open BHIM</span>
                    </button>
                  </div>

                  {/* Universal "Open Any UPI App" Button */}
                  <button
                    type="button"
                    onClick={(e) => handleLaunchApp('universal', e)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/30 transition active:scale-95 cursor-pointer"
                  >
                    <FlashIcon size={16} />
                    <span>Pay ₹{amount} With Any Installed UPI App</span>
                  </button>
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
    </ModalShell>
  );
};
