import React from 'react';
import {
  WebProtectionIcon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  LockIcon,
  Cancel01Icon,
} from 'hugeicons-react';

const CARD = 'rounded-3xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm';
const H2 = 'font-display text-xl font-bold tracking-tight text-white';
const BODY = 'text-sm leading-relaxed text-white/50';

const PROHIBITED = [
  {
    title: 'Non-consensual intimate imagery',
    body: 'Broadcasting, recording, or displaying private sexual content without full, affirmative consent.',
  },
  {
    title: 'Harassment, bullying & hate speech',
    body: 'Targeted attacks based on race, ethnicity, religion, disability, sexual orientation, or gender.',
  },
  {
    title: 'Commercial spam & automated bots',
    body: 'Automated loops, prerecorded videos, advertisements, financial scams, or affiliate links.',
  },
  {
    title: 'Weapons, violence & self-harm',
    body: 'Displaying firearms or weapons in a threatening manner, violence, or promoting self-harm.',
  },
];

export const SafetyCentreView: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.10] via-white/[0.03] to-cyan-400/[0.06] px-6 py-9 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">
            <WebProtectionIcon className="h-3.5 w-3.5" />
            Zero tolerance community
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Safety Centre &amp; policies
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/50">
            U-R-LIVE is an adult-only social video platform. We enforce zero tolerance for unlawful
            conduct, underage access, sexual exploitation, non-consensual imagery and harassment.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/50">
              18+ only
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/50">
              P2P encrypted media
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/50">
              Zero recordings
            </span>
          </div>
        </div>
      </header>

      <div className="mt-10 space-y-10">
        {/* 1 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-rose-400/25 bg-rose-500/12 text-rose-300">
              <AlertCircleIcon className="h-4 w-4" />
            </span>
            <h2 className={H2}>1. Adult-only (18+) eligibility</h2>
          </div>
          <p className={BODY}>
            The service is strictly restricted to adults aged 18 and above, or the legal age of majority
            in your jurisdiction. Minors may not use, access, or appear in any video stream on U-R-LIVE.
          </p>
          <div className={`${CARD} p-5`}>
            <p className="text-xs font-bold text-white/85">Underage detection &amp; immediate ban protocol</p>
            <p className="mt-2 text-xs leading-relaxed text-white/45">
              Any user suspected or reported as underage is removed from the matchmaking queue, escalated
              to priority admin review and permanently banned. Cases involving child sexual exploitation
              and abuse are reported to law enforcement without exception.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-rose-300">
              <Cancel01Icon className="h-4 w-4" />
            </span>
            <h2 className={H2}>2. Prohibited conduct</h2>
          </div>
          <p className={BODY}>
            The following behaviours result in immediate termination of access and possible legal referral.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {PROHIBITED.map((item) => (
              <div key={item.title} className={`${CARD} p-5`}>
                <h3 className="flex items-center gap-2 text-xs font-bold text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/40">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-300">
              <LockIcon className="h-4 w-4" />
            </span>
            <h2 className={H2}>3. Privacy &amp; zero recordings</h2>
          </div>
          <p className={BODY}>Personal video conversations stay confidential by design.</p>

          <div className={`${CARD} space-y-3 p-5`}>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <CheckmarkCircle01Icon className="h-4 w-4" />
              Zero video storage guarantee
            </div>
            <p className="text-xs leading-relaxed text-white/45">
              Video and audio travel peer-to-peer between browsers over WebRTC. U-R-LIVE servers never
              inspect, record or retain video frames or audio tracks.
            </p>
            <div className="flex items-center gap-2 border-t border-white/[0.07] pt-3 text-xs font-bold text-violet-300">
              <LockIcon className="h-4 w-4" />
              Data minimisation
            </div>
            <p className="text-xs leading-relaxed text-white/45">
              Only ephemeral signaling identifiers exist while a match is active. On disconnect or Next,
              the session identifiers are purged.
            </p>
          </div>
        </section>

        {/* 4 */}
        <section className="space-y-4 border-t border-white/[0.07] pt-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/12 text-violet-300">
              <WebProtectionIcon className="h-4 w-4" />
            </span>
            <h2 className={H2}>4. Grievance officer</h2>
          </div>
          <p className={BODY}>
            In line with applicable intermediary and online safety rules, you can reach our designated
            Grievance Officer directly.
          </p>

          <div className={`${CARD} p-5`}>
            <div className="flex flex-col gap-2 border-b border-white/[0.07] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-white/85">Grievance &amp; Compliance Officer</p>
                <p className="mt-0.5 text-[11px] text-white/35">Legal &amp; Trust Safety Division</p>
              </div>
              <a
                href="mailto:grievance@u-r-live.local"
                className="text-[11px] font-semibold text-violet-300 hover:text-violet-200"
              >
                grievance@u-r-live.local
              </a>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/45">
              <strong className="font-semibold text-white/70">Response SLA:</strong> acknowledgement within
              24 hours; formal resolution within statutory timelines.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
