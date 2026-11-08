import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft01Icon, Calendar03Icon, LegalDocument01Icon, Shield02Icon } from 'hugeicons-react';
import { Seo } from '../components/Seo';
import { LEGAL, LEGAL_DOCS, LEGAL_PATHS, LegalDocSlug } from '../legal/config';
import { LEGAL_CONTENT } from '../legal/content';
import type { LegalBlock } from '../legal/content';

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'ul') {
    return (
      <ul className="mt-3 space-y-2.5 pl-5 text-sm leading-relaxed text-neutral-400">
        {block.items?.map((item) => (
          <li key={item} className="list-disc marker:text-neutral-600">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'note') {
    return (
      <div className="mt-4 rounded-2xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/[0.06] p-4 text-xs leading-relaxed text-neutral-300">
        {block.text}
      </div>
    );
  }

  return <p className="mt-3 text-sm leading-relaxed text-neutral-400">{block.text}</p>;
}

interface LegalPageProps {
  slug: LegalDocSlug;
}

export const LegalPage: React.FC<LegalPageProps> = ({ slug }) => {
  const doc = LEGAL_CONTENT[slug];
  const otherDocs = LEGAL_DOCS.filter((item) => item !== slug);

  return (
    <>
      <Seo path={LEGAL_PATHS[slug]} />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[11px] text-neutral-500">
          <Link to="/" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
            <ArrowLeft01Icon className="h-3.5 w-3.5" />
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-300">{doc.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">On this page</p>
                <ol className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-neutral-400">
                  {doc.sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="transition-colors hover:text-white">
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-[11px] leading-relaxed text-neutral-400">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                  <Shield02Icon className="h-3.5 w-3.5" />
                  18+ only
                </span>
                <p className="mt-1.5">Media is peer-to-peer and never recorded by U-R-LIVE.</p>
              </div>
            </div>
          </aside>

          <article className="min-w-0">
            <header className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-[#8b5cf6]/[0.09] via-white/[0.02] to-[#22d3ee]/[0.05] px-6 py-8 sm:px-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-300">
                <LegalDocument01Icon className="h-3.5 w-3.5 text-[#c4b5fd]" />
                Legal
              </div>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {doc.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">{doc.intro}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                  <Calendar03Icon className="h-3 w-3" />
                  Effective {LEGAL.effectiveDate}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                  Version {LEGAL.termsVersion}
                </span>
              </div>
            </header>

            <div className="mt-8 space-y-9">
              {doc.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">{section.heading}</h2>
                  {section.blocks.map((block, index) => (
                    <Block key={`${section.id}-${index}`} block={block} />
                  ))}
                </section>
              ))}
            </div>

            <footer className="mt-12 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Related pages</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {otherDocs.map((item) => (
                  <Link
                    key={item}
                    to={LEGAL_PATHS[item]}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
                  >
                    {LEGAL_CONTENT[item].title}
                  </Link>
                ))}
                <Link
                  to="/safety"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
                >
                  Safety Centre
                </Link>
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-neutral-500">
                Questions about this document? Email{' '}
                <a href={`mailto:${LEGAL.grievanceEmail}`} className="text-neutral-300 underline decoration-white/20 underline-offset-2 hover:text-white">
                  {LEGAL.grievanceEmail}
                </a>
                .
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
};
