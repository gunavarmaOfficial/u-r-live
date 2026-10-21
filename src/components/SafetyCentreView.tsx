import React from 'react';
import {
  WebProtectionIcon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  LockIcon,
  Cancel01Icon,
} from 'hugeicons-react';

export const SafetyCentreView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-neutral-300 space-y-12">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 text-xs font-bold text-[#FF385C] bg-[#FF385C]/10 border border-[#FF385C]/30 rounded-full">
          <WebProtectionIcon className="w-3.5 h-3.5" />
          <span>Strict Community Safety & Zero Tolerance</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          U-R-LIVE Safety Centre & Policies
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-3xl">
          U-R-LIVE is an adult-only social video communication platform. We implement zero tolerance for unlawful conduct, underage access, sexual exploitation, non-consensual imagery, and harassment.
        </p>
      </div>

      {/* 1. Adult-Only 18+ Policy */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-white">
          <AlertCircleIcon className="w-5 h-5 text-[#FF385C]" />
          <h2 className="text-xl font-bold">1. Adult-Only (18+) Eligibility Policy</h2>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The service is strictly restricted to adults aged 18 and above (or the legal age of majority in your jurisdiction). Minors are strictly prohibited from using, accessing, or appearing in any video stream on U-R-LIVE.
        </p>
        <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 space-y-2 text-xs">
          <p className="font-bold text-white">Underage Detection & Immediate Ban Protocol:</p>
          <p className="text-neutral-400 leading-relaxed">
            Any user suspected or reported as being underage is immediately blocked from the matchmaking queue, subjected to priority admin review, and permanently banned. Instances involving child sexual exploitation and abuse are reported to law enforcement authorities without exception.
          </p>
        </div>
      </section>

      {/* 2. Prohibited Conduct */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-white">
          <Cancel01Icon className="w-5 h-5 text-rose-400" />
          <h2 className="text-xl font-bold">2. Prohibited Conduct & Community Standards</h2>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The following behaviours are strictly prohibited and result in immediate termination of access and potential legal referral:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Non-Consensual Intimate Imagery</span>
            </h3>
            <p className="text-neutral-400">
              Broadcasting, recording, or displaying private sexual content without full, affirmative consent.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Harassment, Bullying & Hate Speech</span>
            </h3>
            <p className="text-neutral-400">
              Targeted attacks based on race, ethnicity, religion, disability, sexual orientation, or gender.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Commercial Spam & Automated Bots</span>
            </h3>
            <p className="text-neutral-400">
              Broadcasting automated loops, prerecorded videos, advertisements, financial scams, or affiliate links.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Weapons, Violence & Self-Harm</span>
            </h3>
            <p className="text-neutral-400">
              Displaying firearms, real weapons in a threatening manner, violence, or promoting self-harm.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Privacy & Zero Media Storage Guarantee */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-white">
          <LockIcon className="w-5 h-5 text-[#FF385C]" />
          <h2 className="text-xl font-bold">3. Privacy & Zero Video Recording Policy</h2>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          We believe personal video conversations should remain completely confidential.
        </p>

        <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 space-y-3 text-xs leading-relaxed">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckmarkCircle01Icon className="w-4 h-4" />
            <span>Zero Video Storage Guarantee</span>
          </div>
          <p className="text-neutral-400">
            Video and audio are transmitted peer-to-peer (P2P) between participating browsers using WebRTC protocols. U-R-LIVE servers do not inspect, record, or retain any video frames or audio tracks.
          </p>
          <div className="flex items-center gap-2 text-[#FF385C] font-bold pt-1">
            <LockIcon className="w-4 h-4" />
            <span>Data Minimization</span>
          </div>
          <p className="text-neutral-400">
            We only collect ephemeral signaling identifiers during an active match to facilitate connection establishment. When you disconnect or click Next, session identifiers are purged.
          </p>
        </div>
      </section>

      {/* 4. Grievance Redressal & Legal Officer */}
      <section className="space-y-4 border-t border-neutral-800 pt-8">
        <div className="flex items-center gap-2.5 text-white">
          <WebProtectionIcon className="w-5 h-5 text-[#FF385C]" />
          <h2 className="text-xl font-bold">4. Grievance Officer & Complaint Redressal</h2>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          In compliance with applicable intermediary guidelines and online safety rules, users may reach our designated Grievance Officer directly:
        </p>

        <div className="p-5 rounded-2xl bg-[#161618] border border-neutral-800 text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-2">
            <div>
              <p className="font-bold text-white">Designated Grievance & Compliance Officer</p>
              <p className="text-neutral-500">Legal & Trust Safety Division</p>
            </div>
            <p className="font-mono text-[#FF385C]">grievance@u-r-live.local</p>
          </div>
          <p className="text-neutral-400">
            <strong>Response SLA:</strong> Acknowledgment within 24 hours; formal resolution within statutory timelines.
          </p>
        </div>
      </section>
    </div>
  );
};
