import { X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';

const openSheetStack: string[] = [];
let savedBodyOverflow: string | null = null;

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  hideCloseButton?: boolean;
  closeLabel?: string;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  hideCloseButton = false,
  closeLabel = '닫기',
  children,
}: BottomSheetProps) {
  const sheetId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const shouldReduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const activeElement = document.activeElement;
    previousActiveElementRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;

    if (openSheetStack.length === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openSheetStack.push(sheetId);

    panelRef.current?.focus();

    const isTopmostSheet = () =>
      openSheetStack[openSheetStack.length - 1] === sheetId;

    const getFocusableElements = (): HTMLElement[] => {
      const root = panelRef.current;
      if (!root) return [];
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');
      return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute('aria-hidden'),
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostSheet()) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        const focusables = getFocusableElements();
        if (focusables.length === 0) {
          event.preventDefault();
          panelRef.current?.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;

        const current = document.activeElement;
        const root = panelRef.current;
        if (!root || !(current instanceof Node) || !root.contains(current)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }

        if (event.shiftKey && (current === first || current === root)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && current === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const stackIdx = openSheetStack.lastIndexOf(sheetId);
      if (stackIdx !== -1) {
        openSheetStack.splice(stackIdx, 1);
      }
      if (openSheetStack.length === 0 && savedBodyOverflow !== null) {
        document.body.style.overflow = savedBodyOverflow;
        savedBodyOverflow = null;
      }
      const previousTrigger = previousActiveElementRef.current;
      previousActiveElementRef.current = null;
      if (previousTrigger && document.contains(previousTrigger)) {
        previousTrigger.focus();
      }
    };
  }, [open, sheetId]);

  if (!open) {
    return null;
  }

  const motionProps = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { y: '100%' },
        animate: { y: 0 },
        transition: { type: 'spring' as const, duration: 0.26, bounce: 0 },
      };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-[#191F28]/45"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        {...motionProps}
        className="relative z-10 w-full max-w-lg max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-[#191F28] focus:outline-none"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#E5E8EB]"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pt-1">
            <h2
              id={titleId}
              className="text-[19px] font-bold leading-snug tracking-tight text-[#191F28]"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-1 text-[14px] leading-relaxed text-[#4E5968]"
              >
                {description}
              </p>
            ) : null}
          </div>
          {!hideCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="inline-flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#4E5968] hover:bg-[#F2F4F6] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </motion.div>
    </div>
  );
}
