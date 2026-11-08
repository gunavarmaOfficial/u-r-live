import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight01Icon, WebProtectionIcon } from 'hugeicons-react';
import { SafetyCentreView } from '../components/SafetyCentreView';
import { Seo } from '../components/Seo';
import { FAQ_ITEMS } from '../data/faq';
import { LEGAL_PATHS } from '../legal/config';

export const SafetyPage: React.FC = () => {
  return (
    <>
      <Seo path="/safety" />
      <SafetyCentreView />

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6" aria-labelledby="faq-heading">
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 sm:p-9">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#8b5cf6]/25 bg-[#8b5cf6]/12 text-[#c4b5fd]">
              <WebProtectionIcon className="h-4 w-4" />
            </span>
            <h2 id="faq-heading" className="font-display text-xl font-bold tracking-tight text-white">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-6 divide-y divide-white/[0.06]">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white marker:content-none">
                  <span>{item.question}</span>
                  <ArrowRight01Icon className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-neutral-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-400">
          <span>Read the full policies:</span>
          <Link to={LEGAL_PATHS.terms} className="text-neutral-200 underline decoration-white/20 underline-offset-2 hover:text-white">
            Terms of Service
          </Link>
          <Link to={LEGAL_PATHS.privacy} className="text-neutral-200 underline decoration-white/20 underline-offset-2 hover:text-white">
            Privacy Policy
          </Link>
          <Link to={LEGAL_PATHS.cookies} className="text-neutral-200 underline decoration-white/20 underline-offset-2 hover:text-white">
            Cookie Policy
          </Link>
          <Link to={LEGAL_PATHS['community-rules']} className="text-neutral-200 underline decoration-white/20 underline-offset-2 hover:text-white">
            Community Rules
          </Link>
        </div>
      </section>
    </>
  );
};
