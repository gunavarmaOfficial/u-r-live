import React from 'react';
import {
  CameraOff01Icon,
  CameraVideoIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Message01Icon,
  RefreshIcon,
  SecurityCheckIcon,
  Settings01Icon,
} from 'hugeicons-react';
import { ModalShell } from './ModalShell';

export type PermissionErrorType =
  | 'prompt'
  | 'denied'
  | 'not_found'
  | 'in_use'
  | 'unsupported';

interface PermissionModalProps {
  isOpen: boolean;
  errorType?: PermissionErrorType;
  errorMessage?: string;
  onClose: () => void;
  onRetry: () => void;
  onSwitchToText?: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  errorType = 'prompt',
  errorMessage,
  onClose,
  onRetry,
  onSwitchToText,
}) => {
  if (!isOpen) return null;

  // Device & Browser detection for targeted step-by-step unblock instructions
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = /firefox/i.test(ua);

  const getBrowserName = () => {
    if (isIOS) return 'Safari on iPhone / iPad';
    if (isAndroid) return 'Chrome on Android';
    if (isSafari) return 'Safari on Mac';
    if (isFirefox) return 'Firefox';
    return 'Chrome / Edge / Brave';
  };

  const renderSteps = () => {
    if (isIOS) {
      return (
        <ol className="space-y-2 text-left text-xs text-neutral-600 dark:text-neutral-300">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
              1
            </span>
            <span>
              Tap the <strong>'aA'</strong> or <strong>Page Settings</strong> icon on the left of Safari's address bar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
              2
            </span>
            <span>
              Tap <strong>Website Settings</strong> and set both <strong>Camera</strong> and <strong>Microphone</strong> to <strong>Allow</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
              3
            </span>
            <span>Tap <strong>Done</strong>, then tap the <strong>Try Again</strong> button below.</span>
          </li>
        </ol>
      );
    }

    if (isAndroid) {
      return (
        <ol className="space-y-2 text-left text-xs text-neutral-600 dark:text-neutral-300">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
              1
            </span>
            <span>
              Tap the <strong>Lock (🔒)</strong> or <strong>Tune</strong> icon on the left side of Chrome's address bar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
              2
            </span>
            <span>
              Tap <strong>Permissions</strong> and toggle ON both <strong>Camera</strong> and <strong>Microphone</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
              3
            </span>
            <span>Tap <strong>Try Again</strong> below or refresh the page.</span>
          </li>
        </ol>
      );
    }

    return (
      <ol className="space-y-2 text-left text-xs text-neutral-600 dark:text-neutral-300">
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
            1
          </span>
          <span>
            Click the <strong>Lock (🔒)</strong> or <strong>Site Settings</strong> icon on the left of your browser address bar.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
            2
          </span>
          <span>
            Switch <strong>Camera</strong> and <strong>Microphone</strong> from "Block" to <strong>"Allow"</strong>.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[11px] font-bold text-red-500">
            3
          </span>
          <span>Click <strong>Try Again</strong> below to connect.</span>
        </li>
      </ol>
    );
  };

  const getTitleAndSubtitle = () => {
    switch (errorType) {
      case 'denied':
        return {
          title: 'Camera & Mic Access Blocked',
          subtitle: `Your browser has blocked camera access for U-R-LIVE. Follow the steps below to enable permissions for ${getBrowserName()}.`,
        };
      case 'not_found':
        return {
          title: 'No Camera or Microphone Found',
          subtitle: 'We could not detect a camera device on your phone or computer. Connect a webcam or switch to Text Chat mode.',
        };
      case 'in_use':
        return {
          title: 'Camera In Use by Another App',
          subtitle: 'Another app (such as FaceTime, Zoom, Teams, or another browser tab) is currently using your camera. Please close it and retry.',
        };
      case 'unsupported':
        return {
          title: 'WebRTC Not Supported',
          subtitle: 'Your browser or connection does not support live video chat. Please use an updated modern browser with HTTPS.',
        };
      case 'prompt':
      default:
        return {
          title: 'Allow Camera & Microphone',
          subtitle: 'U-R-LIVE requires camera and microphone access so you and your matched stranger can see and talk to each other.',
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} ariaLabel="Camera & Microphone Permissions">
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#120f18] text-neutral-900 dark:text-neutral-100 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
          aria-label="Close"
        >
          <Cancel01Icon size={16} />
        </button>

        {/* Top Header Medallion */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 text-white shadow-xl shadow-red-600/30">
            {errorType === 'denied' || errorType === 'not_found' ? (
              <CameraOff01Icon size={32} />
            ) : (
              <CameraVideoIcon size={32} />
            )}
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white border-2 border-[#120f18]">
              {errorType === 'denied' ? (
                <Settings01Icon size={12} className="text-amber-400" />
              ) : (
                <SecurityCheckIcon size={12} className="text-emerald-400" />
              )}
            </span>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm">
              {errorMessage || subtitle}
            </p>
          </div>
        </div>

        {/* Steps container if permission was denied */}
        {errorType === 'denied' && (
          <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <span>How to unblock on {getBrowserName()}</span>
            </div>
            {renderSteps()}
          </div>
        )}

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-3 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckmarkCircle01Icon size={14} />
            <span>Encrypted P2P</span>
          </span>
          <span>•</span>
          <span>No recordings saved</span>
          <span>•</span>
          <span>100% Private</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 py-3 px-4 font-black text-sm text-white shadow-xl shadow-red-600/35 transition active:scale-95 cursor-pointer"
          >
            <RefreshIcon size={16} />
            <span>{errorType === 'denied' ? 'Try Again (I enabled it)' : 'Allow Camera & Microphone'}</span>
          </button>

          {onSwitchToText && (
            <button
              type="button"
              onClick={() => {
                onSwitchToText();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:bg-neutral-50 dark:hover:bg-white/[0.08] py-2.5 px-4 font-bold text-xs text-neutral-700 dark:text-neutral-300 transition active:scale-95 cursor-pointer"
            >
              <Message01Icon size={14} />
              <span>Continue in Text Chat Only (No Camera Needed)</span>
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
