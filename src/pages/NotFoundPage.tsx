import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight01Icon, Home01Icon } from 'hugeicons-react';
import { Seo } from '../components/Seo';

export const NotFoundPage: React.FC = () => {
  const location = useLocation();

  return (
    <>
      <Seo path={location.pathname} />
      <section className="mx-auto flex min-h-[70dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-[#a78bfa]">Error 404</p>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          This page has left the chat.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          The page you were looking for does not exist or has moved. You can head back home or go
          straight into a live conversation.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className="btn-secondary h-11 px-5 text-xs font-bold">
            <Home01Icon className="h-4 w-4" />
            Back to home
          </Link>
          <Link to="/live" className="btn-primary h-11 px-5 text-xs font-bold">
            Start live chat
            <ArrowRight01Icon className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-8 text-[11px] text-neutral-500">
          Need help?{' '}
          <Link to="/safety" className="text-neutral-300 underline decoration-white/20 underline-offset-2 hover:text-white">
            Visit the Safety Centre
          </Link>
        </p>
      </section>
    </>
  );
};
