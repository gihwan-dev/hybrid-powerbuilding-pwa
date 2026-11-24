import { CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';
import { create } from 'zustand';

interface ToastStoreState {
  message: string | null;
  id: number;
  show: (message: string) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastStoreState>()((set) => ({
  message: null,
  id: 0,
  show: (message) =>
    set((state) => ({
      message,
      id: state.id + 1,
    })),
  dismiss: () => set({ message: null }),
}));

export function showToast(message: string): void {
  useToastStore.getState().show(message);
}

export function Toast() {
  const message = useToastStore((state) => state.message);
  const id = useToastStore((state) => state.id);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => {
      dismiss();
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [message, id, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4 pb-safe"
    >
      {message ? (
        <div className="pointer-events-auto inline-flex max-w-md items-center gap-2 rounded-full bg-[#191F28] px-4 py-3 text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(15,23,42,0.18)]">
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-[#03B26C]"
            aria-hidden="true"
          />
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
