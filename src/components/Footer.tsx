import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircleIcon, WebProtectionIcon, CameraVideoIcon, SparklesIcon, Shield02Icon } from 'hugeicons-react';
import { Logo } from './Logo';
import { LEGAL, LEGAL_PATHS } from '../legal/config';

export const Footer: React.FC = () => {
  const linkClass = 'transition-colors hover:text-white';

  return (
    <footer className="relative mt-auto border-t border-white/[0.06] bg-[#07060d]/80">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/40 to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-4 sm:col-span-2 lg:col-span-4">
            <Link to="/" aria-label="U-R-LIVE home" className="inline-block">
              <Logo size="md" />
            </Link>
            <p className="max-w-xs text-xs leading-relaxed text-neutral-400">
              An adults-only (18+) live video social platform. Peer-to-peer WebRTC media,
              server-authoritative matchmaking, and a strict zero video retention policy.
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/[0.07] px-3 py-1.5 text-[11px] font-bold text-rose-300">
              <AlertCircleIcon className="h-3.5 w-3.5" />
              <span>Strictly 18+ only</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
                <Shield02Icon className="h-3 w-3 text-emerald-400" />
                DTLS / SRTP
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
                <CameraVideoIcon className="h-3 w-3 text-[#22d3ee]" />
                Zero recordings
              </span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Platform</h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <Link to="/live" className={linkClass}>
                  Random video chat
                </Link>
              </li>
              <li>
                <Link to="/news" className={linkClass}>
                  Kerala results news
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className={linkClass}>
                  How it works
                </a>
              </li>
              <li>
                <Link to="/admin" className="text-neutral-500 transition-colors hover:text-neutral-300">
                  Staff portal
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Safety &amp; trust</h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <Link to="/safety" className={linkClass}>
                  Safety Centre
                </Link>
              </li>
              <li>
                <Link to={LEGAL_PATHS['community-rules']} className={linkClass}>
                  Community Rules
                </Link>
              </li>
              <li>
                <Link to="/safety#reporting" className={linkClass}>
                  Report &amp; block
                </Link>
              </li>
              <li>
                <Link to="/safety" className={linkClass}>
                  Age assurance policy
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-4">
            <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Legal &amp; grievances</h4>
            <ul className="space-y-2.5 text-xs text-neutral-400">
              <li>
                <Link to={LEGAL_PATHS.privacy} className={linkClass}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to={LEGAL_PATHS.cookies} className={linkClass}>
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to={LEGAL_PATHS.terms} className={linkClass}>
                  Terms of Service
                </Link>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <WebProtectionIcon className="h-3.5 w-3.5 text-neutral-600" />
                <span className="text-neutral-500">Grievance officer:</span>
                <a href={`mailto:${LEGAL.grievanceEmail}`} className="text-neutral-300 hover:text-white">
                  {LEGAL.grievanceEmail}
                </a>
              </li>
              <li className="text-neutral-500">Complaints acknowledged within 24 hours</li>
            </ul>

            <Link
              to="/live"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold text-neutral-300 transition-all hover:border-[#8b5cf6]/40 hover:text-white"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
              Set match filters
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-7 text-[11px] text-neutral-500 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span>© {new Date().getFullYear()} {LEGAL.productName}</span>
            <span className="text-neutral-700">·</span>
            <span>Zero video retention guarantee</span>
            <span className="text-neutral-700">·</span>
            <span>Built for adults 18+</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Free video chat · India</span>
            <span className="hidden text-neutral-700 sm:inline">·</span>
            <a href={`mailto:${LEGAL.supportEmail}`} className="text-neutral-600 transition-colors hover:text-neutral-300">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
