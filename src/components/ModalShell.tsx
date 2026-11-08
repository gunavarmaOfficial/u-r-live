import React, { useEffect, useRef } from 'react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  labelledBy?: string;
  /** Classes for the overlay wrapper. */
  overlayClassName?: string;
  /** Classes for the panel card. */
  panelClassName?: string;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal wrapper: focus trap, Escape to close, scroll lock,
 * aria wiring and focus restoration on close.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  ariaLabel,
  labelledBy,
  overlayClassName = '',
  panelClassName = '',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ||
        panel.querySelector<HTMLElement>(FOCUSABLE) ||
        panel;
      target.focus({ preventScroll: true });
    };
    const timer = window.setTimeout(focusFirst, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-xl animate-in fade-in duration-200 sm:items-center sm:p-4 ${overlayClassName}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`animate-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden text-white outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
